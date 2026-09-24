from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models import Course, Enrollment, Grade, User, UserRole
from app.schemas import GradeCreate, GradeOut, JournalRow

router = APIRouter(prefix="/grades", tags=["grades"])


# ---------- Выставить оценку (teacher/admin) ----------
@router.post("", response_model=GradeOut, status_code=status.HTTP_201_CREATED)
def create_grade(
    payload: GradeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.teacher, UserRole.admin)),
) -> Grade:
    course = db.get(Course, payload.course_id)
    if not course:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Course not found")

    if course.author_id != current_user.id and current_user.role != UserRole.admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your course")

    student = db.get(User, payload.student_id)
    if not student or student.role != UserRole.student:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Student not found")

    # Студент должен быть записан на курс
    enrolled = (
        db.query(Enrollment)
        .filter(
            Enrollment.student_id == payload.student_id,
            Enrollment.course_id == payload.course_id,
        )
        .first()
    )
    if not enrolled:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Student is not enrolled in this course",
        )

    grade = Grade(
        student_id=payload.student_id,
        course_id=payload.course_id,
        value=payload.value,
        comment=payload.comment,
    )
    db.add(grade)
    db.commit()
    db.refresh(grade)
    return grade


# ---------- Мои оценки (student) ----------
@router.get("/my", response_model=list[GradeOut])
def my_grades(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Grade]:
    return (
        db.query(Grade)
        .filter(Grade.student_id == current_user.id)
        .order_by(Grade.created_at.desc())
        .all()
    )


# ---------- Оценки конкретного студента (teacher/admin) ----------
@router.get("/student/{student_id}", response_model=list[GradeOut])
def student_grades(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.teacher, UserRole.admin)),
) -> list[Grade]:
    student = db.get(User, student_id)
    if not student:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Student not found")

    return (
        db.query(Grade)
        .filter(Grade.student_id == student_id)
        .order_by(Grade.created_at.desc())
        .all()
    )


# ---------- Журнал по курсу (teacher/admin) ----------
@router.get("/journal/{course_id}", response_model=list[JournalRow])
def course_journal(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.teacher, UserRole.admin)),
) -> list[JournalRow]:
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

    rows: list[JournalRow] = []
    for e in enrollments:
        student = db.get(User, e.student_id)
        if not student:
            continue

        grades = (
            db.query(Grade)
            .filter(
                Grade.student_id == student.id,
                Grade.course_id == course_id,
            )
            .order_by(Grade.created_at.desc())
            .all()
        )

        avg = (
            sum(g.value for g in grades) / len(grades) if grades else 0.0
        )

        rows.append(
            JournalRow(
                student_id=student.id,
                student_email=student.email,
                student_full_name=student.full_name,
                grades=[GradeOut.model_validate(g) for g in grades],
                average=round(avg, 2),
            )
        )

    return rows