from typing import Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.reservation import SeatHoldCreate, SeatHoldBatchResponse, SeatHoldItem
from app.services.reservation_service import ReservationService
from app.dependencies import get_current_user, get_optional_current_user
from app.models.user import User

router = APIRouter()


@router.post("", response_model=SeatHoldBatchResponse, status_code=status.HTTP_201_CREATED)
async def hold_seats(
    data: SeatHoldCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await ReservationService.hold_seats(
        db, show_id=data.show_id, seat_ids=data.seat_ids, user_id=current_user.id
    )


@router.get("/{hold_token}", response_model=SeatHoldBatchResponse)
async def get_seat_hold(
    hold_token: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Retrieve holds for this token
    from sqlalchemy import select
    from app.models.reservation import SeatHold
    from app.models.theater import Seat
    from app.models.show import ShowPricing
    from app.common.exceptions import SeatHoldExpiredException

    now = datetime.now(timezone.utc)
    stmt = (
        select(SeatHold, Seat, ShowPricing.price)
        .join(Seat, SeatHold.seat_id == Seat.id)
        .outerjoin(
            ShowPricing,
            (ShowPricing.show_id == SeatHold.show_id) & (ShowPricing.seat_type == Seat.seat_type),
        )
        .where(
            SeatHold.hold_token == hold_token,
            SeatHold.user_id == current_user.id,
            SeatHold.status == "HELD",
        )
    )
    result = await db.execute(stmt)
    rows = result.all()

    if not rows:
        raise SeatHoldExpiredException(hold_token)

    from app.models.base import ensure_utc

    first_hold = rows[0][0]
    if ensure_utc(first_hold.expires_at) <= now:
        await ReservationService.cleanup_hold_token(db, hold_token)
        raise SeatHoldExpiredException(hold_token)

    remaining = max(0, int((first_hold.expires_at - now).total_seconds()))

    hold_items = []
    subtotal = 0.0
    for h, s, price in rows:
        p = price or 250.0
        subtotal += p
        hold_items.append(
            SeatHoldItem(
                hold_id=h.id,
                seat_id=s.id,
                row=s.row,
                number=s.number,
                seat_type=s.seat_type,
                price=p,
                expires_at=h.expires_at,
            )
        )

    return SeatHoldBatchResponse(
        show_id=first_hold.show_id,
        hold_token=hold_token,
        holds=hold_items,
        expires_at=first_hold.expires_at,
        remaining_seconds=remaining,
        subtotal=round(subtotal, 2),
        message="Active hold details",
    )


@router.delete("/{hold_token}")
async def release_seat_hold(
    hold_token: str,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = current_user.id if current_user else None
    success = await ReservationService.release_hold(db, hold_token, user_id=user_id)
    return {"success": success, "message": "Seats released successfully" if success else "No active hold found"}
