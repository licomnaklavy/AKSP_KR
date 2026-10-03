# backend/tests/test_progress.py
from tests.conftest import _auth_headers


def _setup(client, teacher_token):
    """Курс + 2 урока (один с тестом), всё опубликовано."""
    r = client.post(
        "/api/v1/courses",
        json={"title": "Курс", "description": "", "level": "beginner"},
        headers=_auth_headers(teacher_token),
    )
    course_id = r.json()["id"]
    client.patch(
        f"/api/v1/courses/{course_id}",
        json={"is_published": True},
        headers=_auth_headers(teacher_token),
    )
    r = client.post(
        f"/api/v1/courses/{course_id}/lessons",
        json={"title": "Урок 1 без теста", "theory": "...", "order_index": 1},
        headers=_auth_headers(teacher_token),
    )
    lesson1_id = r.json()["id"]
    r = client.post(
        f"/api/v1/courses/{course_id}/lessons",
        json={"title": "Урок 2 с тестом", "theory": "...", "order_index": 2},
        headers=_auth_headers(teacher_token),
    )
    lesson2_id = r.json()["id"]

    # Тест на урок 2
    r = client.post(
        f"/api/v1/tests/lesson/{lesson2_id}",
        json={
            "title": "Тест",
            "passing_score": 60.0,
            "questions": [
                {
                    "text": "Q",
                    "question_type": "single",
                    "points": 1.0,
                    "options": [
                        {"text": "Correct", "is_correct": True},
                        {"text": "Wrong", "is_correct": False},
                    ],
                }
            ],
        },
        headers=_auth_headers(teacher_token),
    )
    test_id = r.json()["id"]

    return course_id, lesson1_id, lesson2_id, test_id


def test_progress_after_completing_lesson_without_test(
    client, teacher_token, student_token
):
    course_id, lesson1_id, _, _ = _setup(client, teacher_token)

    client.post(
        f"/api/v1/courses/{course_id}/enroll",
        headers=_auth_headers(student_token),
    )

    # Отмечаем урок 1 как пройденный
    r = client.post(
        f"/api/v1/lessons/{lesson1_id}/complete",
        headers=_auth_headers(student_token),
    )
    assert r.status_code == 201

    # Результат по уроку 1
    r = client.get(
        f"/api/v1/lessons/{lesson1_id}/my-result",
        headers=_auth_headers(student_token),
    )
    assert r.status_code == 200
    result = r.json()
    assert result["completed"] is True
    assert result["has_test"] is False
    assert result["percent"] == 100.0

    # Общий прогресс по курсу
    r = client.get(
        f"/api/v1/courses/{course_id}/my-progress",
        headers=_auth_headers(student_token),
    )
    assert r.status_code == 200
    progress = r.json()
    assert progress["completed_lessons"] == 1
    assert progress["total_lessons"] == 2
    # средний — только по урокам с процентом (урок 1 = 100%, урок 2 = нет)
    assert progress["average_percent"] == 100.0


def test_progress_includes_test_result(client, teacher_token, student_token):
    course_id, _, lesson2_id, test_id = _setup(client, teacher_token)

    client.post(
        f"/api/v1/courses/{course_id}/enroll",
        headers=_auth_headers(student_token),
    )

    # Проходим тест урока 2
    r = client.post(
        f"/api/v1/tests/{test_id}/start",
        headers=_auth_headers(student_token),
    )
    attempt_id = r.json()["attempt_id"]
    q = r.json()["questions"][0]
    correct_opt = next(o for o in q["options"] if o["text"] == "Correct")

    client.post(
        f"/api/v1/tests/attempts/{attempt_id}/submit",
        json={
            "answers": [
                {"question_id": q["id"], "selected_option_ids": [correct_opt["id"]]}
            ]
        },
        headers=_auth_headers(student_token),
    )

    # Результат по уроку 2 — тест пройден на 100%
    r = client.get(
        f"/api/v1/lessons/{lesson2_id}/my-result",
        headers=_auth_headers(student_token),
    )
    result = r.json()
    assert result["has_test"] is True
    assert result["percent"] == 100.0
    assert result["completed"] is True


def test_course_progress_for_teacher_shows_students(
    client, teacher_token, student_token
):
    course_id, lesson1_id, _, _ = _setup(client, teacher_token)

    client.post(
        f"/api/v1/courses/{course_id}/enroll",
        headers=_auth_headers(student_token),
    )
    client.post(
        f"/api/v1/lessons/{lesson1_id}/complete",
        headers=_auth_headers(student_token),
    )

    r = client.get(
        f"/api/v1/courses/{course_id}/progress",
        headers=_auth_headers(teacher_token),
    )
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) == 1
    assert rows[0]["student_email"] == "student@test.ru"
    assert rows[0]["completed_lessons"] == 1


def test_student_cannot_see_course_progress(
    client, teacher_token, student_token
):
    course_id, _, _, _ = _setup(client, teacher_token)
    r = client.get(
        f"/api/v1/courses/{course_id}/progress",
        headers=_auth_headers(student_token),
    )
    assert r.status_code == 403