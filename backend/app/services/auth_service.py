from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User
from app.schemas.auth import UserRegister, UserLogin
from app.common.security import get_password_hash, verify_password, create_access_token, create_refresh_token, decode_token
from app.common.exceptions import AppException, UnauthorizedException


class AuthService:
    @staticmethod
    async def get_user_by_email(db: AsyncSession, email: str) -> Optional[User]:
        stmt = select(User).where(User.email == email.lower().strip())
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def get_user_by_id(db: AsyncSession, user_id: str) -> Optional[User]:
        stmt = select(User).where(User.id == user_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @classmethod
    async def register(cls, db: AsyncSession, data: UserRegister) -> User:
        existing = await cls.get_user_by_email(db, data.email)
        if existing:
            raise AppException("An account with this email already exists", status_code=409, error_code="USER_ALREADY_EXISTS")

        user = User(
            email=data.email.lower().strip(),
            hashed_password=get_password_hash(data.password),
            full_name=data.full_name.strip(),
            phone=data.phone,
            role=data.role if data.role in ["customer", "admin"] else "customer",
            is_active=True,
            preferences={"favorite_genres": [], "preferred_city": "Delhi"},
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user

    @classmethod
    async def authenticate(cls, db: AsyncSession, data: UserLogin) -> dict:
        user = await cls.get_user_by_email(db, data.email)
        if not user or not verify_password(data.password, user.hashed_password):
            raise UnauthorizedException("Invalid email or password")

        if not user.is_active:
            raise AppException("Account has been deactivated", status_code=403, error_code="ACCOUNT_INACTIVE")

        access_token = create_access_token(subject=user.id, role=user.role)
        refresh_token = create_refresh_token(subject=user.id)

        return {
            "user": user,
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": 86400,
        }

    @classmethod
    async def refresh_tokens(cls, db: AsyncSession, refresh_token: str) -> dict:
        try:
            payload = decode_token(refresh_token)
            if payload.get("type") != "refresh":
                raise UnauthorizedException("Invalid token type")
            user_id = payload.get("sub")
        except Exception:
            raise UnauthorizedException("Invalid or expired refresh token")

        user = await cls.get_user_by_id(db, user_id)
        if not user or not user.is_active:
            raise UnauthorizedException("User not found or inactive")

        access_token = create_access_token(subject=user.id, role=user.role)
        new_refresh = create_refresh_token(subject=user.id)
        return {
            "access_token": access_token,
            "refresh_token": new_refresh,
            "token_type": "bearer",
            "expires_in": 86400,
        }
