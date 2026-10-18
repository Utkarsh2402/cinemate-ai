from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.ai import (
    MovieDiscoveryRequest,
    MovieDiscoveryResponse,
    GroupPlannerRequest,
    GroupPlannerResponse,
    AIChatRequest,
    AIChatResponse,
)
from app.services.ai_service import AIService

router = APIRouter()


@router.post("/discover", response_model=MovieDiscoveryResponse)
async def discover_movies(data: MovieDiscoveryRequest, db: AsyncSession = Depends(get_db)):
    return await AIService.discover_movies(db, query=data.query, city=data.city or "Delhi")


@router.post("/recommendations", response_model=GroupPlannerResponse)
@router.post("/group-planner", response_model=GroupPlannerResponse)
async def plan_group_movie(data: GroupPlannerRequest, db: AsyncSession = Depends(get_db)):
    return await AIService.plan_group_movie(db, data=data)


@router.post("/chat", response_model=AIChatResponse)
async def chat_with_ai(data: AIChatRequest, db: AsyncSession = Depends(get_db)):
    return await AIService.chat(db, request=data)
