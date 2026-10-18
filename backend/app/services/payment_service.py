import secrets
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.payment import Payment, PaymentStatus, Refund, RefundStatus
from app.models.booking import Booking, BookingStatus, BookingSeat
from app.models.reservation import SeatHold
from app.schemas.payment import CheckoutRequest, CheckoutResponse, WebhookPayload
from app.services.booking_service import BookingService
from app.common.security import verify_webhook_signature
from app.common.exceptions import (
    AppException,
    ResourceNotFoundException,
    PaymentFailedException,
    UnauthorizedException,
)
import logging

logger = logging.getLogger("cinemate.payment_service")


class PaymentService:
    @classmethod
    async def initiate_checkout(
        cls,
        db: AsyncSession,
        data: CheckoutRequest,
        user_id: str,
        idempotency_key: Optional[str] = None,
    ) -> CheckoutResponse:
        booking_stmt = select(Booking).where(Booking.id == data.booking_id)
        booking = (await db.execute(booking_stmt)).scalar_one_or_none()
        if not booking:
            raise ResourceNotFoundException("Booking", data.booking_id)

        if booking.user_id != user_id:
            raise AppException("Unauthorized to pay for this booking", status_code=403)

        if booking.status != BookingStatus.PENDING:
            raise AppException(f"Cannot checkout booking in '{booking.status}' status", status_code=400)

        # Check existing payment with idempotency key
        if idempotency_key:
            stmt = select(Payment).where(Payment.idempotency_key == idempotency_key)
            existing = (await db.execute(stmt)).scalar_one_or_none()
            if existing:
                return CheckoutResponse(
                    payment_id=existing.id,
                    booking_id=existing.booking_id,
                    amount=existing.amount,
                    currency=existing.currency,
                    status=existing.status,
                    client_secret=f"sec_{existing.id[:8]}",
                )

        transaction_id = f"txn_{secrets.token_hex(12)}"
        payment = Payment(
            booking_id=booking.id,
            user_id=user_id,
            amount=booking.total_amount,
            currency="INR",
            status=PaymentStatus.PENDING,
            provider="SANDBOX",
            idempotency_key=idempotency_key,
            transaction_id=transaction_id,
            payment_method=data.payment_method,
        )
        db.add(payment)
        await db.commit()
        await db.refresh(payment)

        # If user explicitly requested failure simulation for testing:
        if data.simulate_failure:
            payment.status = PaymentStatus.FAILED
            payment.error_message = "Sandbox simulated bank decline"
            booking.status = BookingStatus.PAYMENT_FAILED
            await db.commit()
            raise PaymentFailedException("Payment declined: Sandbox simulated bank decline", payment_id=payment.id)

        client_secret = f"sec_sandbox_{payment.id}_{secrets.token_hex(8)}"
        return CheckoutResponse(
            payment_id=payment.id,
            booking_id=booking.id,
            amount=payment.amount,
            currency=payment.currency,
            status=payment.status,
            client_secret=client_secret,
            redirect_url=f"/checkout/success?payment_id={payment.id}",
        )

    @classmethod
    async def process_webhook(
        cls,
        db: AsyncSession,
        raw_body: bytes,
        signature: Optional[str],
        payload: WebhookPayload,
    ) -> dict:
        # Verify HMAC signature
        if signature:
            is_valid = verify_webhook_signature(raw_body, signature)
            if not is_valid:
                logger.warning("Invalid webhook signature attempt!")
                raise UnauthorizedException("Invalid payment webhook signature")

        payment_stmt = select(Payment).where(Payment.id == payload.payment_id)
        payment = (await db.execute(payment_stmt)).scalar_one_or_none()
        if not payment:
            raise ResourceNotFoundException("Payment", payload.payment_id)

        booking = await BookingService.get_booking_by_id(db, payment.booking_id)

        if payload.event_type == "payment.succeeded":
            if payment.status == PaymentStatus.SUCCEEDED:
                return {"status": "already_processed", "booking_id": booking.id}

            payment.status = PaymentStatus.SUCCEEDED
            payment.transaction_id = payload.transaction_id

            # Critical Section 6 Check: Did the seat hold expire or did competing booking occur?
            # Check if all seats are still free or belonging to this booking
            seat_ids = [s.seat_id for s in booking.seats]
            conflict_stmt = (
                select(BookingSeat)
                .join(Booking, BookingSeat.booking_id == Booking.id)
                .where(
                    BookingSeat.show_id == booking.show_id,
                    BookingSeat.seat_id.in_(seat_ids),
                    BookingSeat.booking_id != booking.id,
                    BookingSeat.status == "CONFIRMED",
                    Booking.status == BookingStatus.CONFIRMED,
                )
            )
            conflicts = list((await db.execute(conflict_stmt)).scalars().all())

            if conflicts:
                # SEATS WERE TAKEN: Automatic Recovery & Refund!
                logger.error(
                    "Payment succeeded for booking %s but seats %s were already claimed! Triggering automatic refund.",
                    booking.booking_code,
                    [c.seat_id for c in conflicts],
                )
                booking.status = BookingStatus.EXPIRED
                booking.cancellation_reason = "Payment completed after seat hold expiration and seats were claimed by another customer."
                
                # Create automatic refund
                refund = Refund(
                    payment_id=payment.id,
                    booking_id=booking.id,
                    amount=payment.amount,
                    status=RefundStatus.COMPLETED,
                    reason="Automatic refund: seats unavailable upon late payment confirmation",
                    transaction_id=f"ref_{secrets.token_hex(10)}",
                )
                db.add(refund)
                payment.status = PaymentStatus.REFUNDED
                await db.commit()

                return {
                    "status": "refunded_due_to_expired_hold",
                    "booking_id": booking.id,
                    "refund_amount": payment.amount,
                }

            # Seats are valid, confirm the booking
            await BookingService.confirm_booking(db, booking.id, payment.id)
            return {"status": "confirmed", "booking_id": booking.id}

        elif payload.event_type == "payment.failed":
            payment.status = PaymentStatus.FAILED
            payment.error_message = payload.failure_reason or "Payment failed"
            booking.status = BookingStatus.PAYMENT_FAILED

            # Release seat hold records
            for b_seat in booking.seats:
                b_seat.status = "CANCELLED"

            await db.commit()
            return {"status": "payment_failed", "booking_id": booking.id}

        return {"status": "ignored"}

    @classmethod
    async def process_refund_for_cancelled_booking(
        cls,
        db: AsyncSession,
        booking_id: str,
        amount: float,
        reason: str,
    ) -> Refund:
        # Find succeeded payment
        stmt = select(Payment).where(Payment.booking_id == booking_id, Payment.status == PaymentStatus.SUCCEEDED)
        payment = (await db.execute(stmt)).scalar_one_or_none()
        if not payment:
            raise AppException("No successful payment found to refund for this booking", status_code=400)

        refund = Refund(
            payment_id=payment.id,
            booking_id=booking_id,
            amount=amount,
            status=RefundStatus.COMPLETED,
            reason=reason,
            transaction_id=f"ref_{secrets.token_hex(10)}",
        )
        db.add(refund)
        payment.status = PaymentStatus.REFUNDED
        await db.commit()
        await db.refresh(refund)
        return refund
