from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models import Course, Enrollment, Lesson, User, UserRole
from app.schemas import (
    CourseCreate,
    CourseOut,
    CourseUpdate,
    LessonCreate,
    LessonOut,
)

router = APIRouter(prefix="/courses", tags=["courses"])


# ---------- Courses ----------
@router.get("", response_model=list[CourseOut])
def list_courses(db: Session = Depends(get_db)) -> list[Course]:
    """Каталог опубликованных курсов."""
    return (
        db.query(Course)
        .filter(Course.is_published.is_(True))
        .order_by(Course.created_at.desc())
        .all()
    )


@router.get("/my", response_model=list[CourseOut])
def my_courses(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.teacher, UserRole.admin)),
) -> list[Course]:
    """Курсы текущего преподавателя (включая черновики)."""
    return (
        db.query(Course)
        .filter(Course.author_id == current_user.id)
        .order_by(Course.created_at.desc())
        .all()
    )


@router.post("", response_model=CourseOut, status_code=status.HTTP_201_CREATED)
def create_course(
    payload: CourseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.teacher, UserRole.admin)),
) -> Course:
    course = Course(
        title=payload.title,
        description=payload.description,
        level=payload.level,
        is_published=False,
        author_id=current_user.id,
    )
    db.add(course)
    db.commit()
    db.refresh(course)
    return course


@router.get("/{course_id}", response_model=CourseOut)
def get_course(course_id: int, db: Session = Depends(get_db)) -> Course:
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Course not found")
    return course


@router.patch("/{course_id}", response_model=CourseOut)
def update_course(
    course_id: int,
    payload: CourseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.teacher, UserRole.admin)),
) -> Course:
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Course not found")

    if course.author_id != current_user.id and current_user.role != UserRole.admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your course")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(course, field, value)

    db.commit()
    db.refresh(course)
    return course


@router.delete("/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_course(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.teacher, UserRole.admin)),
) -> None:
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Course not found")

    if course.author_id != current_user.id and current_user.role != UserRole.admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your course")

    db.delete(course)
    db.commit()


# ---------- Enrollment ----------
@router.post("/{course_id}/enroll", status_code=status.HTTP_201_CREATED)
def enroll(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Course not found")

    if not course.is_published:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Course is not published")

    existing = (
        db.query(Enrollment)
        .filter(
            Enrollment.student_id == current_user.id,
            Enrollment.course_id == course_id,
        )
        .first()
    )
    if existing:
        return {"status": "already enrolled", "enrollment_id": existing.id}

    enrollment = Enrollment(
        student_id=current_user.id,
        course_id=course_id,
    )
    db.add(enrollment)
    db.commit()
    db.refresh(enrollment)
    return {"status": "enrolled", "enrollment_id": enrollment.id}


# ---------- Lessons ----------
@router.get("/{course_id}/lessons", response_model=list[LessonOut])
def list_lessons(course_id: int, db: Session = Depends(get_db)) -> list[Lesson]:
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Course not found")

    return (
        db.query(Lesson)
        .filter(Lesson.course_id == course_id)
        .order_by(Lesson.order_index)
        .all()
    )


@router.post(
    "/{course_id}/lessons",
    response_model=LessonOut,
    status_code=status.HTTP_201_CREATED,
)
def create_lesson(
    course_id: int,
    payload: LessonCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.teacher, UserRole.admin)),
) -> Lesson:
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Course not found")

    if course.author_id != current_user.id and current_user.role != UserRole.admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your course")

    lesson = Lesson(
        course_id=course_id,
        title=payload.title,
        theory=payload.theory,
        order_index=payload.order_index,
    )
    db.add(lesson)
    db.commit()
    db.refresh(lesson)
    return lesson


# ---------- Students of course ----------
@router.get("/{course_id}/students")
def course_students(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.teacher, UserRole.admin)),
) -> list[dict]:
    """Список студентов, записанных на курс (только автор курса или admin)."""
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Course not found")

    if course.author_id != current_user.id and current_user.role != UserRole.admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your course")

    enrollments = (
        db.query(Enrollment)
        .filter(Enrollment.course_id == course_id)
        .all()
    )

    result = []
    for e in enrollments:
        student = db.get(User, e.student_id)
        if student:
            result.append({
                "student_id": student.id,
                "email": student.email,
                "full_name": student.full_name,
                "enrolled_at": e.enrolled_at,
            })
    return result