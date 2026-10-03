# backend/tests/conftest.py
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app as fastapi_app
from app.db.session import Base, get_db
import app.models  # noqa: F401 — регистрирует модели в Base.metadata


# ---------- Тестовая БД (SQLite в памяти) ----------
SQLALCHEMY_DATABASE_URL = "sqlite://"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(
    bind=engine, autoflush=False, autocommit=False
)


@pytest.fixture(scope="function")
def db():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass

    fastapi_app.dependency_overrides[get_db] = override_get_db
    with TestClient(fastapi_app) as c:
        yield c
    fastapi_app.dependency_overrides.clear()


# ---------- Хелперы для регистрации / логина ----------
def _register(client, email: str, password: str, role: str = "student", full_name: str = ""):
    return client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": password,
            "role": role,
            "full_name": full_name,
        },
    )


def _login(client, email: str, password: str) -> str:
    r = client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": password},
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def teacher_token(client):
    _register(client, "teacher@test.ru", "12345", role="teacher", full_name="Учитель У.")
    return _login(client, "teacher@test.ru", "12345")


@pytest.fixture
def student_token(client):
    _register(client, "student@test.ru", "12345", role="student", full_name="Студент С.")
    return _login(client, "student@test.ru", "12345")


@pytest.fixture
def other_teacher_token(client):
    _register(client, "teacher2@test.ru", "12345", role="teacher", full_name="Второй У.")
    return _login(client, "teacher2@test.ru", "12345")