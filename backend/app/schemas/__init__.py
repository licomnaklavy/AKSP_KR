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


# ---------- Courses ----------
class CourseCreate(BaseModel):
    title: str
    description: str = ""
    level: str = "beginner"


class CourseUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    level: str | None = None
    is_published: bool | None = None


class CourseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str
    level: str
    is_published: bool
    author_id: int
    created_at: datetime


# ---------- Lessons ----------
class LessonCreate(BaseModel):
    title: str
    theory: str = ""
    order_index: int = 0


class LessonOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    course_id: int
    title: str
    theory: str
    order_index: int