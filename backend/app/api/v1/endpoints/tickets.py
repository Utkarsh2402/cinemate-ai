from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.ticket import TicketResponse, TicketVerifyRequest, TicketVerifyResponse
from app.services.ticket_service import TicketService
from app.dependencies import get_current_user
from app.models.user import User

router = APIRouter()


@router.get("/{ticket_id}", response_model=TicketResponse)
async def get_ticket(
    ticket_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ticket = await TicketService.get_ticket_by_id_or_number(db, ticket_id)
    return TicketService.to_ticket_response(ticket)


@router.post("/verify", response_model=TicketVerifyResponse)
async def verify_ticket(
    data: TicketVerifyRequest,
    db: AsyncSession = Depends(get_db),
):
    # Public or theater staff scanner endpoint to validate QR code at gate
    return await TicketService.verify_ticket(
        db, verification_hash=data.verification_hash, ticket_number=data.ticket_number
    )
