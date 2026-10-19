from typing import Optional, List
from sqlalchemy import String, Float, ForeignKey, JSON, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class GroupPlan(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "group_plans"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    creator_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    invite_code: Mapped[str] = mapped_column(String(20), unique=True, index=True, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="PLANNING", nullable=False)  # PLANNING, DECIDED, ARCHIVED
    selected_movie_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("movies.id", ondelete="SET NULL"), nullable=True)
    movie_suggestions: Mapped[List[dict]] = mapped_column(JSON, default=list, nullable=False)

    # Relationships
    members: Mapped[List["GroupMember"]] = relationship("GroupMember", back_populates="group", cascade="all, delete-orphan")
    votes: Mapped[List["GroupVote"]] = relationship("GroupVote", back_populates="group", cascade="all, delete-orphan")


class GroupMember(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "group_members"

    group_id: Mapped[str] = mapped_column(String(36), ForeignKey("group_plans.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    preferred_genres: Mapped[List[str]] = mapped_column(JSON, default=list, nullable=False)
    preferred_languages: Mapped[List[str]] = mapped_column(JSON, default=list, nullable=False)
    max_budget: Mapped[float] = mapped_column(Float, default=500.0, nullable=False)
    available_dates: Mapped[List[str]] = mapped_column(JSON, default=list, nullable=False)

    # Relationships
    group: Mapped["GroupPlan"] = relationship("GroupPlan", back_populates="members")
    user: Mapped[Optional["User"]] = relationship("User", back_populates="group_memberships")


class GroupVote(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "group_votes"

    group_id: Mapped[str] = mapped_column(String(36), ForeignKey("group_plans.id", ondelete="CASCADE"), nullable=False, index=True)
    member_id: Mapped[str] = mapped_column(String(36), ForeignKey("group_members.id", ondelete="CASCADE"), nullable=False, index=True)
    movie_id: Mapped[str] = mapped_column(String(36), ForeignKey("movies.id", ondelete="CASCADE"), nullable=False, index=True)
    score: Mapped[int] = mapped_column(Integer, default=5, nullable=False)  # 1 to 5

    # Relationships
    group: Mapped["GroupPlan"] = relationship("GroupPlan", back_populates="votes")
    member: Mapped["GroupMember"] = relationship("GroupMember")

    __table_args__ = (
        UniqueConstraint("group_id", "member_id", "movie_id", name="uq_group_member_movie_vote"),
    )
