from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models import (
    Course,
    Enrollment,
    Lesson,
    Test,
    TestAttempt,
    User,
    UserRole,
)
from app.schemas import (
    CourseCreate,
    CourseOut,
    CourseUpdate,
    LessonCreate,
    LessonOut,
)

router = APIRouter(prefix="/courses", tags=["courses"])


# ---------- Helpers ----------
def _attach_lessons_count(db: Session, courses: list[Course]) -> None:
    """Проставляет каждому курсу в списке поле lessons_count."""
    if not courses:
        return
    counts = dict(
        db.query(Lesson.course_id, func.count(Lesson.id))
        .filter(Lesson.course_id.in_([c.id for c in courses]))
        .group_by(Lesson.course_id)
        .all()
    )
    for c in courses:
        c.lessons_count = counts.get(c.id, 0)


def _parse_completed(csv: str) -> set[int]:
    if not csv:
        return set()
    return {int(x) for x in csv.split(",") if x.strip().isdigit()}


def _attach_progress_for_student(
    db: Session, courses: list[Course], user: User
) -> None:
    """
    Проставляет каждому курсу в списке поле my_progress —
    средний процент по урокам для текущего студента.
    Для teacher/admin и незаписанных курсов — None.
    """
    if not courses:
        return

    if user.role != UserRole.student:
        for c in courses:
            c.my_progress = None
        return

    for course in courses:
        enrollment = (
            db.query(Enrollment)
            .filter(
                Enrollment.student_id == user.id,
                Enrollment.course_id == course.id,
            )
            .first()
        )
        if not enrollment:
            course.my_progress = None
            continue

        lessons = (
            db.query(Lesson)
            .filter(Lesson.course_id == course.id)
            .all()
        )
        completed_ids = _parse_completed(enrollment.completed_lesson_ids or "")
        percents: list[float] = []

        for lesson in lessons:
            test = db.query(Test).filter(Test.lesson_id == lesson.id).first()
            if test is None:
                # Урок без теста: если завершён — 100%
                if lesson.id in completed_ids:
                    percents.append(100.0)
                continue

            # Лучшая попытка по тесту
            attempts = (
                db.query(TestAttempt)
                .filter(
                    TestAttempt.test_id == test.id,
                    TestAttempt.student_id == user.id,
                    TestAttempt.status == "finished",
                    TestAttempt.max_score > 0,
                )
                .all()
            )
            if attempts:
                best = max(
                    attempts,
                    key=lambda a: a.score / a.max_score * 100,
                )
                percents.append(best.score / best.max_score * 100)

        if percents:
            course.my_progress = round(sum(percents) / len(percents), 2)
        else:
            course.my_progress = 0.0


# ---------- Courses ----------
@router.get("", response_model=list[CourseOut])
def list_courses(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Course]:
    """
    Каталог курсов:
    - студент видит только опубликованные;
    - teacher/admin видит все опубликованные + свои черновики.
    """
    query = db.query(Course)

    if current_user.role in (UserRole.teacher, UserRole.admin):
        query = query.filter(
            (Course.is_published.is_(True)) | (Course.author_id == current_user.id)
        )
    else:
        query = query.filter(Course.is_published.is_(True))

    courses = query.order_by(Course.created_at.desc()).all()
    _attach_lessons_count(db, courses)
    _attach_progress_for_student(db, courses, current_user)
    return courses


@router.get("/my", response_model=list[CourseOut])
def my_courses(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.teacher, UserRole.admin)),
) -> list[Course]:
    """Курсы текущего преподавателя (включая черновики)."""
    courses = (
        db.query(Course)
        .filter(Course.author_id == current_user.id)
        .order_by(Course.created_at.desc())
        .all()
    )
    _attach_lessons_count(db, courses)
    _attach_progress_for_student(db, courses, current_user)
    return courses


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
    course.lessons_count = 0
    course.my_progress = None
    return course


@router.get("/{course_id}", response_model=CourseOut)
def get_course(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Course:
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Course not found")
    course.lessons_count = (
        db.query(Lesson).filter(Lesson.course_id == course.id).count()
    )
    _attach_progress_for_student(db, [course], current_user)
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
    course.lessons_count = (
        db.query(Lesson).filter(Lesson.course_id == course.id).count()
    )
    course.my_progress = None
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