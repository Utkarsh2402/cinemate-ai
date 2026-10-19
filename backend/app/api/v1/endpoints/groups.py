import secrets
import string
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.orm.attributes import flag_modified

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
    name: str = Field(..., min_length=2, max_length=100, examples=["Friday Movie Night"])
    host_name: Optional[str] = "Host"


class JoinSessionRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, examples=["Rohan"])
    preferred_genres: List[str] = Field(default_factory=list, examples=[["Action", "Comedy"]])
    preferred_languages: List[str] = Field(default_factory=lambda: ["Hindi"], examples=[["Hindi"]])
    max_budget: float = Field(default=400.0, ge=100.0, le=2000.0, examples=[450.0])


class MovieSuggestionCreateRequest(BaseModel):
    movie_id: Optional[str] = None
    movie_title: str = Field(..., min_length=1, max_length=150)
    movie_poster: Optional[str] = None
    suggested_by: str = Field(..., min_length=1, max_length=100)
    description: str = Field(..., min_length=1, max_length=1000)


class ToggleLikeRequest(BaseModel):
    member_name: str = Field(..., min_length=1, max_length=100)


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
    movie_suggestions: List[dict] = Field(default_factory=list)
    consensus_result: Optional[GroupPlannerResponse] = None


def generate_invite_code() -> str:
    # Strictly 4-digit numeric code between 1000 and 9999
    return str(secrets.randbelow(9000) + 1000)


def _build_session_response(group: GroupPlan, consensus: Optional[GroupPlannerResponse] = None) -> GroupSessionResponse:
    return GroupSessionResponse(
        id=group.id,
        name=group.name,
        invite_code=group.invite_code,
        status=group.status,
        members=[GroupMemberResponse.model_validate(m) for m in group.members],
        movie_suggestions=group.movie_suggestions or [],
        consensus_result=consensus,
    )


async def _get_group_by_code(invite_code: str, db: AsyncSession) -> Optional[GroupPlan]:
    code = invite_code.strip().upper()
    clean_code = code.replace("CNM-", "").replace(" ", "").replace("-", "")
    stmt = (
        select(GroupPlan)
        .options(selectinload(GroupPlan.members))
        .where(
            (GroupPlan.invite_code == code)
            | (GroupPlan.invite_code == clean_code)
            | (GroupPlan.invite_code == f"CNM-{clean_code}")
        )
    )
    group = (await db.execute(stmt)).scalar_one_or_none()
    if group:
        # Self-heal legacy codes: if invite_code is not strictly a 4-digit number, upgrade it in DB
        if not group.invite_code.isdigit() or len(group.invite_code) != 4:
            new_code = generate_invite_code()
            for _ in range(10):
                existing = await db.execute(select(GroupPlan).where(GroupPlan.invite_code == new_code))
                if not existing.scalar_one_or_none():
                    break
                new_code = generate_invite_code()
            group.invite_code = new_code
            await db.commit()
            await db.refresh(group)
    return group


@router.post("/sessions", response_model=GroupSessionResponse, status_code=status.HTTP_201_CREATED)
async def create_group_session(data: CreateSessionRequest, db: AsyncSession = Depends(get_db)):
    # Find any active user for foreign key constraint or first user
    user_res = await db.execute(select(User).limit(1))
    user = user_res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=500, detail="User system not initialized.")

    invite_code = generate_invite_code()

    # Ensure invite_code uniqueness
    for _ in range(10):
        existing = await _get_group_by_code(invite_code, db)
        if not existing:
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

    return _build_session_response(group_full)


@router.get("/sessions/{invite_code}", response_model=GroupSessionResponse)
async def get_group_session(invite_code: str, db: AsyncSession = Depends(get_db)):
    group = await _get_group_by_code(invite_code, db)
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

    return _build_session_response(group, consensus)


@router.post("/sessions/{invite_code}/join", response_model=GroupSessionResponse)
async def join_group_session(invite_code: str, data: JoinSessionRequest, db: AsyncSession = Depends(get_db)):
    group = await _get_group_by_code(invite_code, db)
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
        group.members.append(new_member)
        db.add(new_member)

    await db.commit()
    await db.refresh(group, ["members"])

    return _build_session_response(group)


@router.post("/sessions/{invite_code}/decide", response_model=GroupSessionResponse)
async def decide_group_session(invite_code: str, db: AsyncSession = Depends(get_db)):
    group = await _get_group_by_code(invite_code, db)
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

    return _build_session_response(group, consensus)


@router.post("/sessions/{invite_code}/movie-suggestions", response_model=GroupSessionResponse)
async def add_movie_suggestion(
    invite_code: str,
    data: MovieSuggestionCreateRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Allows members in the group to suggest a particular movie and attach their custom description / notes / pitch.
    """
    group = await _get_group_by_code(invite_code, db)
    if not group:
        raise HTTPException(status_code=404, detail=f"Group session with code '{invite_code}' not found.")

    current_suggestions = list(group.movie_suggestions or [])
    # Check if a suggestion for the same movie already exists
    existing = next(
        (s for s in current_suggestions if s.get("movie_title", "").strip().lower() == data.movie_title.strip().lower()),
        None,
    )
    if existing:
        existing["description"] = data.description.strip()
        existing["suggested_by"] = data.suggested_by.strip()
        if data.movie_poster:
            existing["movie_poster"] = data.movie_poster
    else:
        new_item = {
            "id": f"sug_{secrets.token_hex(4)}",
            "movie_id": data.movie_id,
            "movie_title": data.movie_title.strip(),
            "movie_poster": data.movie_poster,
            "suggested_by": data.suggested_by.strip(),
            "description": data.description.strip(),
            "likes": [data.suggested_by.strip()],
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        current_suggestions.insert(0, new_item)

    group.movie_suggestions = current_suggestions
    flag_modified(group, "movie_suggestions")
    await db.commit()
    await db.refresh(group, ["members"])

    return _build_session_response(group)


@router.post("/sessions/{invite_code}/movie-suggestions/{suggestion_id}/like", response_model=GroupSessionResponse)
async def toggle_suggestion_like(
    invite_code: str,
    suggestion_id: str,
    data: ToggleLikeRequest,
    db: AsyncSession = Depends(get_db),
):
    group = await _get_group_by_code(invite_code, db)
    if not group:
        raise HTTPException(status_code=404, detail=f"Group session with code '{invite_code}' not found.")

    current_suggestions = list(group.movie_suggestions or [])
    target = next((s for s in current_suggestions if s.get("id") == suggestion_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Movie suggestion not found in this group.")

    likes = list(target.get("likes") or [])
    user_name = data.member_name.strip()
    if user_name in likes:
        likes.remove(user_name)
    else:
        likes.append(user_name)
    target["likes"] = likes

    group.movie_suggestions = current_suggestions
    flag_modified(group, "movie_suggestions")
    await db.commit()
    await db.refresh(group, ["members"])

    return _build_session_response(group)


@router.delete("/sessions/{invite_code}/movie-suggestions/{suggestion_id}", response_model=GroupSessionResponse)
async def delete_movie_suggestion(
    invite_code: str,
    suggestion_id: str,
    db: AsyncSession = Depends(get_db),
):
    group = await _get_group_by_code(invite_code, db)
    if not group:
        raise HTTPException(status_code=404, detail=f"Group session with code '{invite_code}' not found.")

    current_suggestions = [s for s in (group.movie_suggestions or []) if s.get("id") != suggestion_id]
    group.movie_suggestions = current_suggestions
    flag_modified(group, "movie_suggestions")
    await db.commit()
    await db.refresh(group, ["members"])

    return _build_session_response(group)
