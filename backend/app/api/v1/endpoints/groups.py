import secrets
import string
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.group import GroupPlan, GroupMember, GroupVote
from app.models.user import User
from app.schemas.ai import (
    GroupPlannerRequest,
    GroupMemberPreferenceInput,
    GroupPlannerResponse,
)
from app.services.ai_service import AIService

router = APIRouter()


class CreateSessionRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100, example="Friday Movie Night")
    host_name: Optional[str] = "Host"


class JoinSessionRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, example="Rohan")
    preferred_genres: List[str] = Field(default_factory=list, example=["Action", "Comedy"])
    preferred_languages: List[str] = Field(default_factory=lambda: ["Hindi"], example=["Hindi"])
    max_budget: float = Field(default=400.0, ge=100.0, le=2000.0, example=450.0)


class GroupMemberResponse(BaseModel):
    id: str
    name: str
    preferred_genres: List[str]
    preferred_languages: List[str]
    max_budget: float

    model_config = {"from_attributes": True}


class GroupSessionResponse(BaseModel):
    id: str
    name: str
    invite_code: str
    status: str
    members: List[GroupMemberResponse]
    consensus_result: Optional[GroupPlannerResponse] = None


def generate_invite_code() -> str:
    chars = string.ascii_uppercase + string.digits
    # Generate 6-char code like CNM-9284
    return f"CNM-{''.join(secrets.choice(chars) for _ in range(4))}"


@router.post("/sessions", response_model=GroupSessionResponse, status_code=status.HTTP_201_CREATED)
async def create_group_session(data: CreateSessionRequest, db: AsyncSession = Depends(get_db)):
    # Find any active user for foreign key constraint or first user
    user_res = await db.execute(select(User).limit(1))
    user = user_res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=500, detail="User system not initialized.")

    invite_code = generate_invite_code()

    # Ensure invite_code uniqueness
    for _ in range(5):
        existing = await db.execute(select(GroupPlan).where(GroupPlan.invite_code == invite_code))
        if not existing.scalar_one_or_none():
            break
        invite_code = generate_invite_code()

    group = GroupPlan(
        name=data.name,
        creator_id=user.id,
        invite_code=invite_code,
        status="PLANNING",
    )
    db.add(group)
    await db.flush()

    # Add host as the initial member
    host_member = GroupMember(
        group_id=group.id,
        user_id=user.id,
        name=data.host_name or "Host",
        preferred_genres=["Action", "Sci-Fi", "Comedy"],
        preferred_languages=["Hindi", "English"],
        max_budget=500.0,
        available_dates=[],
    )
    db.add(host_member)
    await db.commit()
    await db.refresh(group)

    # Re-fetch with members loaded
    group_stmt = (
        select(GroupPlan)
        .options(selectinload(GroupPlan.members))
        .where(GroupPlan.id == group.id)
    )
    group_full = (await db.execute(group_stmt)).scalar_one()

    return GroupSessionResponse(
        id=group_full.id,
        name=group_full.name,
        invite_code=group_full.invite_code,
        status=group_full.status,
        members=[GroupMemberResponse.model_validate(m) for m in group_full.members],
    )


@router.get("/sessions/{invite_code}", response_model=GroupSessionResponse)
async def get_group_session(invite_code: str, db: AsyncSession = Depends(get_db)):
    code = invite_code.strip().upper()
    stmt = (
        select(GroupPlan)
        .options(selectinload(GroupPlan.members))
        .where(GroupPlan.invite_code == code)
    )
    group = (await db.execute(stmt)).scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail=f"Group session with code '{invite_code}' not found.")

    # If already decided, calculate or retrieve decision
    consensus = None
    if group.status == "DECIDED" and len(group.members) >= 1:
        member_inputs = [
            GroupMemberPreferenceInput(
                name=m.name,
                preferred_genres=m.preferred_genres or ["Comedy"],
                preferred_languages=m.preferred_languages or ["Hindi"],
                max_budget=m.max_budget,
            )
            for m in group.members
        ]
        planner_req = GroupPlannerRequest(
            group_name=group.name,
            city="Delhi",
            members=member_inputs if len(member_inputs) >= 2 else member_inputs + member_inputs,
        )
        consensus = await AIService.plan_group_movie(db, data=planner_req)

    return GroupSessionResponse(
        id=group.id,
        name=group.name,
        invite_code=group.invite_code,
        status=group.status,
        members=[GroupMemberResponse.model_validate(m) for m in group.members],
        consensus_result=consensus,
    )


@router.post("/sessions/{invite_code}/join", response_model=GroupSessionResponse)
async def join_group_session(invite_code: str, data: JoinSessionRequest, db: AsyncSession = Depends(get_db)):
    code = invite_code.strip().upper()
    stmt = (
        select(GroupPlan)
        .options(selectinload(GroupPlan.members))
        .where(GroupPlan.invite_code == code)
    )
    group = (await db.execute(stmt)).scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail=f"Group session with code '{invite_code}' not found.")

    if group.status == "DECIDED":
        raise HTTPException(status_code=400, detail="This session has already finalized its movie choice.")

    # Check if a member with this name already joined
    existing_member = next((m for m in group.members if m.name.lower() == data.name.lower()), None)
    if existing_member:
        # Update existing member preferences
        existing_member.preferred_genres = data.preferred_genres
        existing_member.preferred_languages = data.preferred_languages
        existing_member.max_budget = data.max_budget
    else:
        new_member = GroupMember(
            group_id=group.id,
            name=data.name,
            preferred_genres=data.preferred_genres or ["Comedy"],
            preferred_languages=data.preferred_languages or ["Hindi"],
            max_budget=data.max_budget,
            available_dates=[],
        )
        db.add(new_member)

    await db.commit()

    # Re-fetch
    refreshed = (await db.execute(stmt)).scalar_one()

    return GroupSessionResponse(
        id=refreshed.id,
        name=refreshed.name,
        invite_code=refreshed.invite_code,
        status=refreshed.status,
        members=[GroupMemberResponse.model_validate(m) for m in refreshed.members],
    )


@router.post("/sessions/{invite_code}/decide", response_model=GroupSessionResponse)
async def decide_group_session(invite_code: str, db: AsyncSession = Depends(get_db)):
    code = invite_code.strip().upper()
    stmt = (
        select(GroupPlan)
        .options(selectinload(GroupPlan.members))
        .where(GroupPlan.invite_code == code)
    )
    group = (await db.execute(stmt)).scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail=f"Group session with code '{invite_code}' not found.")

    if len(group.members) == 0:
        raise HTTPException(status_code=400, detail="At least 1 friend must join before calculating.")

    member_inputs = [
        GroupMemberPreferenceInput(
            name=m.name,
            preferred_genres=m.preferred_genres or ["Comedy"],
            preferred_languages=m.preferred_languages or ["Hindi"],
            max_budget=m.max_budget,
        )
        for m in group.members
    ]

    # Run AI consensus algorithm
    planner_req = GroupPlannerRequest(
        group_name=group.name,
        city="Delhi",
        members=member_inputs if len(member_inputs) >= 2 else member_inputs + [member_inputs[0]],
    )
    consensus = await AIService.plan_group_movie(db, data=planner_req)

    group.status = "DECIDED"
    if consensus.recommendations:
        group.selected_movie_id = consensus.recommendations[0].movie_id

    await db.commit()

    return GroupSessionResponse(
        id=group.id,
        name=group.name,
        invite_code=group.invite_code,
        status=group.status,
        members=[GroupMemberResponse.model_validate(m) for m in group.members],
        consensus_result=consensus,
    )
