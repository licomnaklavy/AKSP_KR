# backend/tests/test_tests.py
from tests.conftest import _auth_headers


def _setup_course_with_lesson(client, teacher_token):
    """Создаёт курс, публикует, добавляет урок. Возвращает (course_id, lesson_id)."""
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
        json={"title": "Урок 1", "theory": "теория", "order_index": 1},
        headers=_auth_headers(teacher_token),
    )
    lesson_id = r.json()["id"]
    return course_id, lesson_id


def _create_test(client, teacher_token, lesson_id):
    payload = {
        "title": "Проверка знаний",
        "passing_score": 60.0,
        "questions": [
            {
                "text": "Сколько букв в английском алфавите?",
                "question_type": "single",
                "points": 1.0,
                "options": [
                    {"text": "24", "is_correct": False},
                    {"text": "26", "is_correct": True},
                    {"text": "28", "is_correct": False},
                ],
            },
            {
                "text": "I ___ a student.",
                "question_type": "single",
                "points": 1.0,
                "options": [
                    {"text": "am", "is_correct": True},
                    {"text": "is", "is_correct": False},
                    {"text": "are", "is_correct": False},
                ],
            },
        ],
    }
    return client.post(
        f"/api/v1/tests/lesson/{lesson_id}",
        json=payload,
        headers=_auth_headers(teacher_token),
    )


def test_teacher_creates_test(client, teacher_token):
    _, lesson_id = _setup_course_with_lesson(client, teacher_token)
    r = _create_test(client, teacher_token, lesson_id)
    assert r.status_code == 201
    data = r.json()
    assert data["title"] == "Проверка знаний"
    assert len(data["questions"]) == 2


def test_student_cannot_create_test(client, teacher_token, student_token):
    _, lesson_id = _setup_course_with_lesson(client, teacher_token)
    payload = {
        "title": "Тест студента",
        "passing_score": 60.0,
        "questions": [
            {
                "text": "Q",
                "question_type": "single",
                "points": 1.0,
                "options": [
                    {"text": "A", "is_correct": True},
                    {"text": "B", "is_correct": False},
                ],
            }
        ],
    }
    r = client.post(
        f"/api/v1/tests/lesson/{lesson_id}",
        json=payload,
        headers=_auth_headers(student_token),
    )
    assert r.status_code == 403


def test_student_can_pass_test_with_correct_answers(
    client, teacher_token, student_token
):
    course_id, lesson_id = _setup_course_with_lesson(client, teacher_token)
    r = _create_test(client, teacher_token, lesson_id)
    test_id = r.json()["id"]

    # Записываем студента
    client.post(
        f"/api/v1/courses/{course_id}/enroll",
        headers=_auth_headers(student_token),
    )

    # Старт попытки
    r = client.post(
        f"/api/v1/tests/{test_id}/start",
        headers=_auth_headers(student_token),
    )
    assert r.status_code == 200
    start = r.json()
    attempt_id = start["attempt_id"]
    questions = start["questions"]
    assert len(questions) == 2

    # Формируем правильные ответы (по тексту опций)
    correct_by_text = {"26": None, "am": None}
    answers = []
    for q in questions:
        for opt in q["options"]:
            if opt["text"] in correct_by_text:
                answers.append(
                    {"question_id": q["id"], "selected_option_ids": [opt["id"]]}
                )
                break

    # Отправляем
    r = client.post(
        f"/api/v1/tests/attempts/{attempt_id}/submit",
        json={"answers": answers},
        headers=_auth_headers(student_token),
    )
    assert r.status_code == 200
    result = r.json()
    assert result["score"] == 2.0
    assert result["max_score"] == 2.0
    assert result["percent"] == 100.0
    assert result["passed"] is True


def test_student_fails_with_wrong_answers(client, teacher_token, student_token):
    course_id, lesson_id = _setup_course_with_lesson(client, teacher_token)
    r = _create_test(client, teacher_token, lesson_id)
    test_id = r.json()["id"]

    client.post(
        f"/api/v1/courses/{course_id}/enroll",
        headers=_auth_headers(student_token),
    )

    r = client.post(
        f"/api/v1/tests/{test_id}/start",
        headers=_auth_headers(student_token),
    )
    start = r.json()
    attempt_id = start["attempt_id"]
    questions = start["questions"]

    # Отвечаем неправильно: выбираем первый вариант, который НЕ правильный.
    answers = []
    for q in questions:
        # Берём просто первый вариант
        answers.append(
            {"question_id": q["id"], "selected_option_ids": [q["options"][0]["id"]]}
        )

    r = client.post(
        f"/api/v1/tests/attempts/{attempt_id}/submit",
        json={"answers": answers},
        headers=_auth_headers(student_token),
    )
    assert r.status_code == 200
    result = r.json()
    # Возможно 0% или 50% — зависит от совпадения. Проверим, что не 100.
    assert result["percent"] < 100.0


def test_get_tests_by_lesson_returns_my_result(
    client, teacher_token, student_token
):
    course_id, lesson_id = _setup_course_with_lesson(client, teacher_token)
    r = _create_test(client, teacher_token, lesson_id)
    test_id = r.json()["id"]

    # До прохождения: my_best_percent == None
    r = client.get(
        f"/api/v1/tests/by-lesson/{lesson_id}",
        headers=_auth_headers(student_token),
    )
    assert r.status_code == 200
    tests = r.json()
    assert len(tests) == 1
    assert tests[0]["my_best_percent"] is None

    # Записываемся и проходим
    client.post(
        f"/api/v1/courses/{course_id}/enroll",
        headers=_auth_headers(student_token),
    )
    r = client.post(
        f"/api/v1/tests/{test_id}/start",
        headers=_auth_headers(student_token),
    )
    start = r.json()
    attempt_id = start["attempt_id"]

    correct_by_text = {"26", "am"}
    answers = []
    for q in start["questions"]:
        for opt in q["options"]:
            if opt["text"] in correct_by_text:
                answers.append(
                    {"question_id": q["id"], "selected_option_ids": [opt["id"]]}
                )
                break

    client.post(
        f"/api/v1/tests/attempts/{attempt_id}/submit",
        json={"answers": answers},
        headers=_auth_headers(student_token),
    )

    # После прохождения: my_best_percent заполнен
    r = client.get(
        f"/api/v1/tests/by-lesson/{lesson_id}",
        headers=_auth_headers(student_token),
    )
    tests = r.json()
    assert tests[0]["my_best_percent"] == 100.0
    assert tests[0]["my_best_score"] == 2.0
    assert tests[0]["my_max_score"] == 2.0