from datetime import datetime

from pydantic import BaseModel, EmailStr, ConfigDict

from app.models import UserRole


# ---------- Auth / Users ----------
class UserRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str = ""
    role: UserRole = UserRole.student


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    full_name: str
    role: UserRole
    created_at: datetime