import asyncio
import logging
from app.worker.celery_app import celery_app
from app.database import AsyncSessionLocal
from app.services.reservation_service import ReservationService
from app.models.outbox import OutboxEvent
from sqlalchemy import select

logger = logging.getLogger("cinemate.worker.tasks")


def run_async(coro):
    """Utility to run async coroutines within synchronous Celery task worker"""
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop.run_until_complete(coro)


@celery_app.task(name="app.worker.tasks.clean_expired_holds_task", bind=True, max_retries=3)
def clean_expired_holds_task(self):
    async def _clean():
        async with AsyncSessionLocal() as db:
            cleaned = await ReservationService.cleanup_all_expired_holds(db)
            return cleaned

    try:
        cleaned = run_async(_clean())
        return {"status": "success", "cleaned_holds": cleaned}
    except Exception as exc:
        logger.error("Failed to run clean_expired_holds_task: %s", exc)
        raise self.retry(exc=exc, countdown=10)


@celery_app.task(name="app.worker.tasks.send_booking_confirmation_email_task", bind=True, max_retries=3)
def send_booking_confirmation_email_task(self, booking_id: str, email: str, booking_code: str):
    logger.info("Sending confirmation email for booking %s to %s", booking_code, email)
    # Simulated email sending
    return {"status": "sent", "booking_code": booking_code, "recipient": email}


@celery_app.task(name="app.worker.tasks.send_cancellation_notification_task", bind=True, max_retries=3)
def send_cancellation_notification_task(self, booking_code: str, email: str, refund_amount: float):
    logger.info("Sending cancellation & refund notification for %s (Refund: ₹%.2f) to %s", booking_code, refund_amount, email)
    return {"status": "sent", "booking_code": booking_code, "refund_amount": refund_amount}


@celery_app.task(name="app.worker.tasks.process_outbox_events_task", bind=True, max_retries=3)
def process_outbox_events_task(self):
    async def _process_outbox():
        async with AsyncSessionLocal() as db:
            stmt = select(OutboxEvent).where(OutboxEvent.status == "PENDING").limit(50)
            events = list((await db.execute(stmt)).scalars().all())
            processed_count = 0
            for event in events:
                try:
                    logger.info("Processing outbox event %s for %s (%s)", event.event_type, event.aggregate_type, event.aggregate_id)
                    event.status = "PROCESSED"
                    processed_count += 1
                except Exception as err:
                    event.retry_count += 1
                    event.error_message = str(err)
                    if event.retry_count >= 5:
                        event.status = "FAILED"
            if processed_count > 0:
                await db.commit()
            return processed_count

    try:
        processed = run_async(_process_outbox())
        return {"status": "success", "processed_events": processed}
    except Exception as exc:
        logger.error("Failed to process outbox events: %s", exc)
        raise self.retry(exc=exc, countdown=10)
