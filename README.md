# Language LMS — платформа онлайн-обучения

Клиент-серверное веб-приложение для онлайн-обучения с поддержкой курсов, уроков, тестирования и автоматической оценки знаний. Курсовой проект по дисциплине «Архитектура клиент-серверных приложений».

## Возможности

**Для студентов:**
- Регистрация и вход по JWT
- Каталог опубликованных курсов с прогрессом
- Запись на курсы
- Изучение уроков (теория + отметка о прохождении)
- Прохождение тестов (одиночный и множественный выбор)
- Автоматическая оценка знаний в процентах
- Множественные попытки без ограничений, засчитывается лучший результат
- Личный словарь с импортом слов и тренировочными тестами

**Для преподавателей:**
- Регистрация и вход по JWT
- Создание курсов и уроков
- Публикация и снятие с публикации
- Создание неограниченного числа тестов на урок
- Просмотр и редактирование содержимого
- Список записавшихся студентов и их прогресс

## Технологии

- **Frontend:** JS, HTML5, CSS3, Fetch API
- **Backend:** Python 3.11, FastAPI, SQLAlchemy 2.0, Alembic
- **Аутентификация:** JWT (python-jose), bcrypt (passlib)
- **БД:** PostgreSQL 16
- **Web-сервер:** Nginx (раздача статики + reverse proxy на backend)
- **Контейнеризация:** Docker, Docker Compose
- **Тестирование:** pytest, httpx
- **CI:** GitHub Actions

## Архитектура

Браузер обращается к Nginx, который раздаёт статику и проксирует запросы `/api/*` на FastAPI. Backend хранит все данные в PostgreSQL.

- **Frontend** — статические HTML/CSS/JS, отдаются через nginx
- **Nginx** — раздаёт статику и проксирует `/api/*` на backend
- **Backend** — FastAPI-приложение с JWT-аутентификацией
- **PostgreSQL** — единый источник для всех данных

## Структура проекта

```
AKSP_KR/
├── backend/
│   ├── app/
│   │   ├── api/          # роутеры FastAPI
│   │   ├── core/         # config, security
│   │   ├── db/           # подключение к БД
│   │   ├── models/       # SQLAlchemy-модели
│   │   ├── schemas/      # Pydantic-схемы
│   │   └── main.py       # точка входа
│   ├── alembic/          # миграции БД
│   ├── tests/            # pytest
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── .env              # для локальной разработки
│   └── .env.docker       # для docker compose
├── frontend/
│   ├── css/
│   ├── js/               # api.js, header.js, courses.js и др.
│   ├── *.html
│   ├── Dockerfile
│   └── nginx.conf
├── .github/workflows/    # GitHub Actions
├── docker-compose.yml
└── README.md
```

## Быстрый запуск

**Требования:** Docker Desktop (или Docker + Compose v2), Git.

```bash
git clone https://github.com/USERNAME/REPO.git
cd REPO
docker compose up -d --build
```

После запуска открыть:

- **Frontend:** http://localhost:8080
- **Swagger UI:** http://localhost:8000/docs
- **Healthcheck:** http://localhost:8000/health

Остановка:

```bash
docker compose down        # сохраняет данные
docker compose down -v     # удаляет БД
```

**Порты:**

- Frontend (nginx): 8080
- Backend (FastAPI): 8000
- PostgreSQL: 5433

## Локальная разработка (без Docker)

**Backend:**

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1       # Windows
# source .venv/bin/activate      # Linux / macOS
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

В `backend/.env` должно быть `POSTGRES_HOST=localhost` и `POSTGRES_PORT=5432`, локальный PostgreSQL 17 запущен, в нём есть пользователь `lms` (пароль `lms`) и база `lms`.

**Frontend:** открой через Live Server или через nginx из Docker. При работе без Docker фронтенд не сможет проксировать `/api/*` — нужно указать полный URL бэкенда в `js/api.js`:

```javascript
const API_BASE = "http://localhost:8000/api/v1";
```

## Тестовые учётные записи

После запуска зарегистрируй пользователей через `/register.html` или через Swagger:

- **Студент:** `student@test.ru` / `12345`, роль `student`
- **Преподаватель:** `teacher@test.ru` / `12345`, роль `teacher`

Роль выбирается на странице регистрации.

## Тестирование

22 интеграционных теста на pytest. Используют SQLite in-memory и TestClient FastAPI, не требуют запущенного PostgreSQL.

```powershell
cd backend
pytest -v
```

Ожидаемый результат: `22 passed in ~20s`.

**Что покрывают тесты:**

- Регистрация, вход, дубликаты email, доступ к `/me`
- Роли: студент не может создавать курсы, чужой teacher не редактирует
- Курсы: CRUD, публикация, каталог, доступ к черновикам автора
- Запись на курс и повторная запись
- Создание урока только автором курса
- Создание и прохождение тестов, автоматическая оценка
- Прогресс по курсу и журнал для преподавателя

**CI:** GitHub Actions запускает тесты при каждом пуше в `main` и при создании pull request. Конфигурация — `.github/workflows/ci.yml`.

## API

Полная документация — http://localhost:8000/docs.

Краткий обзор эндпоинтов:

**Аутентификация:** `POST /auth/register`, `POST /auth/login`, `GET /auth/me`

**Курсы:** `GET /courses`, `POST /courses`, `PATCH/DELETE /courses/{id}`, `POST /courses/{id}/enroll`, `GET/POST /courses/{id}/lessons`, `GET /courses/{id}/students`, `GET /courses/{id}/my-progress`

**Тесты:** `POST /tests/lesson/{lesson_id}`, `GET /tests/by-lesson/{lesson_id}`, `POST /tests/{id}/start`, `POST /tests/attempts/{id}/submit`, `GET /tests/{id}/my-attempts`

**Словари:** `GET/POST /dictionaries`, `PATCH/DELETE /dictionaries/{id}`, `POST/PATCH/DELETE /dictionaries/{id}/words[/{word_id}]`, `POST /dictionaries/{id}/words/bulk`

## Схема БД

- `users` — пользователи (student, teacher, admin)
- `courses`, `lessons`, `enrollments` — курсы, уроки, записи
- `tests`, `questions`, `answer_options` — тесты и вопросы
- `test_attempts`, `test_answers` — попытки и ответы
- `dictionaries`, `words` — словари и слова