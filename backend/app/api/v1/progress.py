from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
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
from app.schemas import CourseProgress, LessonResult, StudentProgressRow

router = APIRouter(tags=["progress"])


def _parse_completed(csv: str) -> set[int]:
    if not csv:
        return set()
    return {int(x) for x in csv.split(",") if x.strip().isdigit()}


def _serialize_completed(ids: set[int]) -> str:
    return ",".join(str(i) for i in sorted(ids))


def _best_attempt_percent(
    db: Session, student_id: int, test_id: int
) -> tuple[float | None, float | None, float | None]:
    """Возвращает (percent, best_score, max_score) лучшей попытки или (None, None, None)."""
    attempts = (
        db.query(TestAttempt)
        .filter(
            TestAttempt.student_id == student_id,
            TestAttempt.test_id == test_id,
            TestAttempt.status == "finished",
            TestAttempt.max_score > 0,
        )
        .all()
    )
    if not attempts:
        return None, None, None

    def percent_of(a: TestAttempt) -> float:
        return a.score / a.max_score * 100

    best = max(attempts, key=percent_of)
    return percent_of(best), best.score, best.max_score


def _build_lesson_result(
    db: Session, student_id: int, lesson: Lesson, completed_ids: set[int]
) -> LessonResult:
    test = db.query(Test).filter(Test.lesson_id == lesson.id).first()
    completed = lesson.id in completed_ids

    if test is None:
        percent = 100.0 if completed else None
        return LessonResult(
            lesson_id=lesson.id,
            lesson_title=lesson.title,
            completed=completed,
            has_test=False,
            percent=percent,
            best_score=None,
            max_score=None,
        )

    best_percent, best_score, max_score = _best_attempt_percent(
        db, student_id, test.id
    )

    if best_percent is not None and best_percent >= test.passing_score and not completed:
        completed = True

    return LessonResult(
        lesson_id=lesson.id,
        lesson_title=lesson.title,
        completed=completed,
        has_test=True,
        percent=round(best_percent, 2) if best_percent is not None else None,
        best_score=best_score,
        max_score=max_score,
    )


def _build_course_progress(
    db: Session, student_id: int, course: Course
) -> CourseProgress:
    enrollment = (
        db.query(Enrollment)
        .filter(
            Enrollment.student_id == student_id,
            Enrollment.course_id == course.id,
        )
        .first()
    )
    completed_ids = (
        _parse_completed(enrollment.completed_lesson_ids) if enrollment else set()
    )

    lessons = (
        db.query(Lesson)
        .filter(Lesson.course_id == course.id)
        .order_by(Lesson.order_index)
        .all()
    )

    lesson_results = [
        _build_lesson_result(db, student_id, lesson, completed_ids)
        for lesson in lessons
    ]

    percents = [lr.percent for lr in lesson_results if lr.percent is not None]
    average = round(sum(percents) / len(percents), 2) if percents else 0.0

    return CourseProgress(
        course_id=course.id,
        course_title=course.title,
        lessons=lesson_results,
        average_percent=average,
        completed_lessons=sum(1 for lr in lesson_results if lr.completed),
        total_lessons=len(lesson_results),
    )


# ---------- Мой прогресс по курсу ----------
@router.get("/courses/{course_id}/my-progress", response_model=CourseProgress)
def my_course_progress(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CourseProgress:
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Course not found")

    enrollment = (
        db.query(Enrollment)
        .filter(
            Enrollment.student_id == current_user.id,
            Enrollment.course_id == course_id,
        )
        .first()
    )
    if not enrollment:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "You are not enrolled in this course",
        )

    return _build_course_progress(db, current_user.id, course)


# ---------- Отметить урок как изученный ----------
@router.post("/lessons/{lesson_id}/complete", status_code=status.HTTP_201_CREATED)
def complete_lesson(
    lesson_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    lesson = db.get(Lesson, lesson_id)
    if not lesson:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lesson not found")

    enrollment = (
        db.query(Enrollment)
        .filter(
            Enrollment.student_id == current_user.id,
            Enrollment.course_id == lesson.course_id,
        )
        .first()
    )
    if not enrollment:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "You are not enrolled in this course",
        )

    completed = _parse_completed(enrollment.completed_lesson_ids)
    completed.add(lesson.id)
    enrollment.completed_lesson_ids = _serialize_completed(completed)
    db.commit()
    return {"status": "completed", "lesson_id": lesson.id}


# ---------- Результат по одному уроку ----------
@router.get("/lessons/{lesson_id}/my-result", response_model=LessonResult)
def lesson_result(
    lesson_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LessonResult:
    lesson = db.get(Lesson, lesson_id)
    if not lesson:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lesson not found")

    enrollment = (
        db.query(Enrollment)
        .filter(
            Enrollment.student_id == current_user.id,
            Enrollment.course_id == lesson.course_id,
        )
        .first()
    )
    completed = (
        _parse_completed(enrollment.completed_lesson_ids) if enrollment else set()
    )

    return _build_lesson_result(db, current_user.id, lesson, completed)


# ---------- Прогресс всех студентов по курсу ----------
@router.get(
    "/courses/{course_id}/progress",
    response_model=list[StudentProgressRow],
)
def course_progress(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[StudentProgressRow]:
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

    rows: list[StudentProgressRow] = []
    for e in enrollments:
        student = db.get(User, e.student_id)
        if not student:
            continue

        cp = _build_course_progress(db, student.id, course)
        rows.append(
            StudentProgressRow(
                student_id=student.id,
                student_email=student.email,
                student_full_name=student.full_name,
                completed_lessons=cp.completed_lessons,
                total_lessons=cp.total_lessons,
                average_percent=cp.average_percent,
            )
        )

    return rows