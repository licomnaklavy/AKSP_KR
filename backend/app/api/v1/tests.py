from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models import (
    AnswerOption,
    Course,
    Lesson,
    Question,
    Test,
    TestAnswer,
    TestAttempt,
    User,
    UserRole,
)
from app.schemas import (
    AttemptResult,
    AttemptStart,
    AttemptSubmit,
    TestCreate,
    TestOut,
)

router = APIRouter(prefix="/tests", tags=["tests"])


# ---------- Создание теста (teacher/admin) ----------
@router.post(
    "/lesson/{lesson_id}",
    response_model=TestOut,
    status_code=status.HTTP_201_CREATED,
)
def create_test(
    lesson_id: int,
    payload: TestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.teacher, UserRole.admin)),
) -> Test:
    lesson = db.get(Lesson, lesson_id)
    if not lesson:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lesson not found")

    course = db.get(Course, lesson.course_id)
    if course.author_id != current_user.id and current_user.role != UserRole.admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your course")

    if not payload.questions:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Test must contain at least one question"
        )

    test = Test(
        lesson_id=lesson_id,
        title=payload.title,
        passing_score=payload.passing_score,
    )
    db.add(test)
    db.flush()

    for q in payload.questions:
        if not q.options:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Question '{q.text[:30]}...' has no options",
            )
        if not any(o.is_correct for o in q.options):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Question '{q.text[:30]}...' has no correct option",
            )

        question = Question(
            test_id=test.id,
            text=q.text,
            question_type=q.question_type,
            points=q.points,
        )
        db.add(question)
        db.flush()

        for o in q.options:
            db.add(
                AnswerOption(
                    question_id=question.id,
                    text=o.text,
                    is_correct=o.is_correct,
                )
            )

    db.commit()
    db.refresh(test)
    return test


# ---------- Получить все тесты урока + мои результаты ----------
@router.get("/by-lesson/{lesson_id}", response_model=list[TestOut])
def get_tests_by_lesson(
    lesson_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[TestOut]:
    tests = (
        db.query(Test)
        .filter(Test.lesson_id == lesson_id)
        .order_by(Test.created_at)
        .all()
    )

    result: list[TestOut] = []
    for test in tests:
        # Ищем лучшую попытку текущего пользователя по этому тесту
        attempts = (
            db.query(TestAttempt)
            .filter(
                TestAttempt.test_id == test.id,
                TestAttempt.student_id == current_user.id,
                TestAttempt.status == "finished",
                TestAttempt.max_score > 0,
            )
            .all()
        )

        best_percent = None
        best_score = None
        best_max_score = None
        if attempts:
            def percent_of(a: TestAttempt) -> float:
                return a.score / a.max_score * 100

            best = max(attempts, key=percent_of)
            best_percent = round(percent_of(best), 2)
            best_score = best.score
            best_max_score = best.max_score

        out = TestOut.model_validate(test)
        out.my_best_percent = best_percent
        out.my_best_score = best_score
        out.my_max_score = best_max_score
        result.append(out)

    return result


# ---------- Просмотр теста ----------
@router.get("/{test_id}", response_model=TestOut)
def get_test(
    test_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Test:
    test = db.get(Test, test_id)
    if not test:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Test not found")
    return test


# ---------- Старт попытки ----------
@router.post("/{test_id}/start", response_model=AttemptStart)
def start_attempt(
    test_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AttemptStart:
    test = db.get(Test, test_id)
    if not test:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Test not found")

    attempt = TestAttempt(
        test_id=test_id,
        student_id=current_user.id,
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)

    safe_questions = [
        {
            "id": q.id,
            "text": q.text,
            "question_type": q.question_type,
            "points": q.points,
            "options": [{"id": o.id, "text": o.text} for o in q.options],
        }
        for q in test.questions
    ]

    return AttemptStart(
        attempt_id=attempt.id,
        test_id=test.id,
        test_title=test.title,
        questions=safe_questions,
    )


# ---------- Отправка ответов ----------
@router.post("/attempts/{attempt_id}/submit", response_model=AttemptResult)
def submit_attempt(
    attempt_id: int,
    payload: AttemptSubmit,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AttemptResult:
    attempt = db.get(TestAttempt, attempt_id)
    if not attempt or attempt.student_id != current_user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Attempt not found")

    if attempt.status != "in_progress":
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Attempt already finished"
        )

    test = db.get(Test, attempt.test_id)

    score = 0.0
    max_score = 0.0

    for ans in payload.answers:
        question = db.get(Question, ans.question_id)
        if not question or question.test_id != test.id:
            continue

        max_score += question.points
        correct_ids = {o.id for o in question.options if o.is_correct}
        selected_ids = set(ans.selected_option_ids)
        is_correct = correct_ids == selected_ids
        points_awarded = question.points if is_correct else 0.0
        score += points_awarded

        db.add(
            TestAnswer(
                attempt_id=attempt.id,
                question_id=question.id,
                selected_option_ids=",".join(map(str, ans.selected_option_ids)),
                is_correct=is_correct,
                points_awarded=points_awarded,
            )
        )

    attempt.score = score
    attempt.max_score = max_score
    attempt.finished_at = datetime.now(timezone.utc)
    attempt.status = "finished"
    db.commit()
    db.refresh(attempt)

    percent = (score / max_score * 100) if max_score > 0 else 0.0
    passed = percent >= test.passing_score

    return AttemptResult(
        attempt_id=attempt.id,
        test_id=test.id,
        score=score,
        max_score=max_score,
        percent=round(percent, 2),
        passed=passed,
        status=attempt.status,
    )


# ---------- Просмотр результата попытки ----------
@router.get("/attempts/{attempt_id}", response_model=AttemptResult)
def get_attempt_result(
    attempt_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AttemptResult:
    attempt = db.get(TestAttempt, attempt_id)
    if not attempt or attempt.student_id != current_user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Attempt not found")

    test = db.get(Test, attempt.test_id)
    percent = (
        attempt.score / attempt.max_score * 100 if attempt.max_score > 0 else 0.0
    )
    return AttemptResult(
        attempt_id=attempt.id,
        test_id=test.id,
        score=attempt.score,
        max_score=attempt.max_score,
        percent=round(percent, 2),
        passed=percent >= test.passing_score,
        status=attempt.status,
    )


# ---------- Список попыток студента по тесту ----------
@router.get("/{test_id}/my-attempts", response_model=list[AttemptResult])
def my_attempts(
    test_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[AttemptResult]:
    test = db.get(Test, test_id)
    if not test:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Test not found")

    attempts = (
        db.query(TestAttempt)
        .filter(
            TestAttempt.test_id == test_id,
            TestAttempt.student_id == current_user.id,
        )
        .order_by(TestAttempt.started_at.desc())
        .all()
    )

    results = []
    for attempt in attempts:
        percent = (
            attempt.score / attempt.max_score * 100
            if attempt.max_score > 0
            else 0.0
        )
        results.append(
            AttemptResult(
                attempt_id=attempt.id,
                test_id=test_id,
                score=attempt.score,
                max_score=attempt.max_score,
                percent=round(percent, 2),
                passed=percent >= test.passing_score,
                status=attempt.status,
            )
        )
    return results