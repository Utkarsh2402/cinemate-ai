from typing import Optional, Dict, Any
from pydantic import BaseModel, EmailStr, Field


class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6, description="Minimum 6 characters")
    full_name: str = Field(..., min_length=2)
    phone: Optional[str] = None
    role: Optional[str] = "customer"


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    phone: Optional[str] = None
    role: str
    is_active: bool
    preferences: Optional[Dict[str, Any]] = None

    model_config = {"from_attributes": True}


class UserUpdatePreferences(BaseModel):
    preferences: Dict[str, Any]
