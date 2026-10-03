# backend/tests/test_courses.py
from tests.conftest import _auth_headers


def _create_course(client, token, title="Курс 1"):
    return client.post(
        "/api/v1/courses",
        json={"title": title, "description": "desc", "level": "beginner"},
        headers=_auth_headers(token),
    )


def test_student_cannot_create_course(client, student_token):
    r = _create_course(client, student_token)
    assert r.status_code == 403


def test_teacher_creates_course(client, teacher_token):
    r = _create_course(client, teacher_token)
    assert r.status_code == 201
    data = r.json()
    assert data["title"] == "Курс 1"
    assert data["is_published"] is False
    assert data["lessons_count"] == 0


def test_catalog_shows_only_published_for_student(client, teacher_token, student_token):
    # Создаём два курса: один опубликован, другой нет
    r1 = _create_course(client, teacher_token, title="Опубликованный")
    course1_id = r1.json()["id"]
    client.patch(
        f"/api/v1/courses/{course1_id}",
        json={"is_published": True},
        headers=_auth_headers(teacher_token),
    )

    r2 = _create_course(client, teacher_token, title="Черновик")
    course2_id = r2.json()["id"]

    # Студент видит только опубликованный
    r = client.get("/api/v1/courses", headers=_auth_headers(student_token))
    assert r.status_code == 200
    titles = [c["title"] for c in r.json()]
    assert "Опубликованный" in titles
    assert "Черновик" not in titles


def test_teacher_sees_own_drafts(client, teacher_token):
    _create_course(client, teacher_token, title="Мой черновик")
    r = client.get("/api/v1/courses", headers=_auth_headers(teacher_token))
    assert r.status_code == 200
    titles = [c["title"] for c in r.json()]
    assert "Мой черновик" in titles


def test_other_teacher_cannot_edit_course(client, teacher_token, other_teacher_token):
    r = _create_course(client, teacher_token)
    course_id = r.json()["id"]

    r = client.patch(
        f"/api/v1/courses/{course_id}",
        json={"title": "Изменённый"},
        headers=_auth_headers(other_teacher_token),
    )
    assert r.status_code == 403


def test_enroll_and_repeat(client, teacher_token, student_token):
    r = _create_course(client, teacher_token)
    course_id = r.json()["id"]
    client.patch(
        f"/api/v1/courses/{course_id}",
        json={"is_published": True},
        headers=_auth_headers(teacher_token),
    )

    r = client.post(
        f"/api/v1/courses/{course_id}/enroll",
        headers=_auth_headers(student_token),
    )
    assert r.status_code == 201
    assert r.json()["status"] == "enrolled"

    # Повторная запись — «already enrolled»
    r = client.post(
        f"/api/v1/courses/{course_id}/enroll",
        headers=_auth_headers(student_token),
    )
    assert r.status_code == 201
    assert r.json()["status"] == "already enrolled"


def test_cannot_enroll_unpublished(client, teacher_token, student_token):
    r = _create_course(client, teacher_token)
    course_id = r.json()["id"]
    r = client.post(
        f"/api/v1/courses/{course_id}/enroll",
        headers=_auth_headers(student_token),
    )
    assert r.status_code == 400


def test_create_lesson_only_by_author(client, teacher_token, other_teacher_token):
    r = _create_course(client, teacher_token)
    course_id = r.json()["id"]

    # Автор может
    r = client.post(
        f"/api/v1/courses/{course_id}/lessons",
        json={"title": "Урок 1", "theory": "теория", "order_index": 1},
        headers=_auth_headers(teacher_token),
    )
    assert r.status_code == 201

    # Другой teacher не может
    r = client.post(
        f"/api/v1/courses/{course_id}/lessons",
        json={"title": "Урок 2", "theory": "теория", "order_index": 2},
        headers=_auth_headers(other_teacher_token),
    )
    assert r.status_code == 403