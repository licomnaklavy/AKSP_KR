# backend/tests/test_auth.py
from tests.conftest import _register, _login, _auth_headers


def test_register_and_login(client):
    r = _register(client, "new@test.ru", "pass123", role="student", full_name="Тест")
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["email"] == "new@test.ru"
    assert data["role"] == "student"
    assert "id" in data
    assert "hashed_password" not in data

    token = _login(client, "new@test.ru", "pass123")
    assert token


def test_register_duplicate_email(client):
    _register(client, "dup@test.ru", "pass123")
    r = _register(client, "dup@test.ru", "pass123")
    assert r.status_code == 400


def test_login_wrong_password(client):
    _register(client, "user@test.ru", "correct")
    r = client.post(
        "/api/v1/auth/login",
        data={"username": "user@test.ru", "password": "wrong"},
    )
    assert r.status_code == 401


def test_me_requires_token(client):
    r = client.get("/api/v1/auth/me")
    assert r.status_code == 401


def test_me_returns_user(client, student_token):
    r = client.get("/api/v1/auth/me", headers=_auth_headers(student_token))
    assert r.status_code == 200
    assert r.json()["email"] == "student@test.ru"