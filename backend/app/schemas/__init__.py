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


# ---------- Tests ----------
class AnswerOptionCreate(BaseModel):
    text: str
    is_correct: bool = False


class QuestionCreate(BaseModel):
    text: str
    question_type: str = "single"
    points: float = 1.0
    options: list[AnswerOptionCreate]


class TestCreate(BaseModel):
    title: str
    passing_score: float = 60.0
    questions: list[QuestionCreate]


class AnswerOptionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    text: str


class QuestionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    text: str
    question_type: str
    points: float
    options: list[AnswerOptionOut]


class TestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    lesson_id: int
    title: str
    passing_score: float
    created_at: datetime
    questions: list[QuestionOut]


# ---------- Attempts ----------
class AttemptStart(BaseModel):
    attempt_id: int
    test_id: int
    test_title: str
    questions: list[QuestionOut]


class AnswerSubmit(BaseModel):
    question_id: int
    selected_option_ids: list[int]


class AttemptSubmit(BaseModel):
    answers: list[AnswerSubmit]


class AttemptResult(BaseModel):
    attempt_id: int
    test_id: int
    score: float
    max_score: float
    percent: float
    passed: bool
    status: str


# ---------- Progress ----------
class LessonResult(BaseModel):
    lesson_id: int
    lesson_title: str
    completed: bool
    has_test: bool
    percent: float | None = None
    best_score: float | None = None
    max_score: float | None = None


class CourseProgress(BaseModel):
    course_id: int
    course_title: str
    lessons: list[LessonResult]
    average_percent: float
    completed_lessons: int
    total_lessons: int


class StudentProgressRow(BaseModel):
    student_id: int
    student_email: EmailStr
    student_full_name: str
    completed_lessons: int
    total_lessons: int
    average_percent: float