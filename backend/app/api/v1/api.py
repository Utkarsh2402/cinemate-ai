from fastapi import APIRouter
from app.api.v1.endpoints import (
    auth,
    movies,
    theaters,
    shows,
    seat_holds,
    bookings,
    payments,
    tickets,
    ai,
    admin,
    groups,
)

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(movies.router, prefix="/movies", tags=["Movies"])
api_router.include_router(theaters.router, prefix="/theaters", tags=["Theaters"])
api_router.include_router(shows.router, prefix="/shows", tags=["Shows"])
api_router.include_router(seat_holds.router, prefix="/seat-holds", tags=["Seat Holds & Concurrency"])
api_router.include_router(bookings.router, prefix="/bookings", tags=["Bookings"])
api_router.include_router(payments.router, prefix="/payments", tags=["Payments Sandbox"])
api_router.include_router(tickets.router, prefix="/tickets", tags=["Digital Tickets"])
api_router.include_router(ai.router, prefix="/ai", tags=["AI Movie Discovery"])
api_router.include_router(groups.router, prefix="/groups", tags=["Group Movie Planner"])
api_router.include_router(admin.router, prefix="/admin", tags=["Administration & Analytics"])
