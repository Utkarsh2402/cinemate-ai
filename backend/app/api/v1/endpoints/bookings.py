from typing import List, Optional
from fastapi import APIRouter, Depends, Header, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.booking import (
    BookingCreate,
    BookingResponse,
    BookingDetailResponse,
    BookingCancelRequest,
    BookingCancelResponse,
)
from app.services.booking_service import BookingService
from app.dependencies import get_current_user
from app.models.user import User

router = APIRouter()


@router.post("", response_model=BookingResponse, status_code=status.HTTP_201_CREATED)
async def create_booking(
    data: BookingCreate,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    booking = await BookingService.create_booking_from_hold(
        db, data=data, user_id=current_user.id, idempotency_key=idempotency_key
    )
    return BookingResponse.model_validate(booking)


@router.get("", response_model=List[BookingDetailResponse])
async def list_user_bookings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    bookings = await BookingService.list_user_bookings(db, user_id=current_user.id)
    return [BookingService.to_detail_response(b) for b in bookings]


@router.get("/{booking_id}", response_model=BookingDetailResponse)
async def get_booking(
    booking_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    booking = await BookingService.get_booking_by_id(db, booking_id=booking_id, user_id=current_user.id)
    return BookingService.to_detail_response(booking)


@router.post("/{booking_id}/cancel", response_model=BookingCancelResponse)
async def cancel_booking(
    booking_id: str,
    data: BookingCancelRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    booking, refund_amount = await BookingService.cancel_booking(
        db, booking_id=booking_id, user_id=current_user.id, reason=data.reason
    )
    return BookingCancelResponse(
        booking_id=booking.id,
        status=booking.status,
        refund_amount=refund_amount,
        message="Booking cancelled successfully and refund initiated.",
    )
