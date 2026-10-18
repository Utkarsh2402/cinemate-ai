from typing import Optional
from fastapi import APIRouter, Depends, Header, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.schemas.payment import (
    CheckoutRequest,
    CheckoutResponse,
    WebhookPayload,
    RazorpayOrderRequest,
    RazorpayOrderResponse,
    RazorpayVerifyRequest,
)
from app.models.payment import Payment
from app.services.payment_service import PaymentService
from app.dependencies import get_current_user
from app.models.user import User
from app.common.exceptions import ResourceNotFoundException

router = APIRouter()


@router.post("/razorpay/order", response_model=RazorpayOrderResponse)
async def create_razorpay_order(
    data: RazorpayOrderRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await PaymentService.create_razorpay_order(
        db, booking_id=data.booking_id, user_id=current_user.id
    )


@router.post("/razorpay/verify")
async def verify_razorpay_payment(
    data: RazorpayVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await PaymentService.verify_razorpay_payment(
        db, data=data, user_id=current_user.id
    )



@router.post("/checkout", response_model=CheckoutResponse)
async def checkout(
    data: CheckoutRequest,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await PaymentService.initiate_checkout(
        db, data=data, user_id=current_user.id, idempotency_key=idempotency_key
    )


@router.get("/{payment_id}")
async def get_payment(
    payment_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Payment).where(Payment.id == payment_id)
    payment = (await db.execute(stmt)).scalar_one_or_none()
    if not payment:
        raise ResourceNotFoundException("Payment", payment_id)

    return {
        "payment_id": payment.id,
        "booking_id": payment.booking_id,
        "amount": payment.amount,
        "currency": payment.currency,
        "status": payment.status,
        "transaction_id": payment.transaction_id,
        "error_message": payment.error_message,
        "created_at": payment.created_at,
    }


@router.post("/webhook")
async def payment_webhook(
    request: Request,
    payload: WebhookPayload,
    x_signature: Optional[str] = Header(None, alias="X-Signature"),
    db: AsyncSession = Depends(get_db),
):
    raw_body = await request.body()
    result = await PaymentService.process_webhook(
        db, raw_body=raw_body, signature=x_signature, payload=payload
    )
    return result
