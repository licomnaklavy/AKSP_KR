// frontend/js/course-detail.js
// Страница курса: просмотр, запись, изучение уроков, создание контента (teacher).

let courseId = null;
let course = null;
let lessons = [];
let user = null;
let myProgress = null;
let isEnrolled = false;
let currentLessonId = null;
let currentTests = [];
let mode = "student"; // "student" | "teacher"

document.addEventListener("DOMContentLoaded", async () => {
    const container = document.getElementById("courseContainer");

    if (!api.isAuthenticated()) {
        window.location.href = "login.html";
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    courseId = parseInt(urlParams.get("id"));
    if (!courseId) {
        window.location.href = "courses.html";
        return;
    }

    try {
        user = await api.me();
    } catch (_) {
        window.location.href = "login.html";
        return;
    }

    try {
        course = await api.getCourse(courseId);
    } catch (err) {
        container.innerHTML = `
            <div class="empty-state">
                Курс не найден или удалён.<br>
                <a href="courses.html" class="btn btn-outline" style="margin-top:12px;">← К каталогу</a>
            </div>`;
        return;
    }

    const isOwner = course.author_id === user.id || user.role === "admin";
    mode = isOwner ? "teacher" : "student";

    try {
        lessons = await api.getLessons(courseId);
    } catch (_) {
        lessons = [];
    }

    if (mode === "student") {
        try {
            myProgress = await api.getMyProgress(courseId);
            isEnrolled = true;
        } catch (_) {
            myProgress = null;
            isEnrolled = false;
        }
    }

    if (!course.is_published && !isOwner) {
        container.innerHTML = `
            <div class="empty-state">
                Курс ещё не опубликован.<br>
                <a href="courses.html" class="btn btn-outline" style="margin-top:12px;">← К каталогу</a>
            </div>`;
        return;
    }

    currentLessonId = lessons.length > 0 ? lessons[0].id : null;

    if (mode === "student" && currentLessonId && isEnrolled) {
        await loadTestsForLesson(currentLessonId);
    }

    render();
});

// ---------------------------------------------------------------------------
// Загрузка тестов для урока
// ---------------------------------------------------------------------------
async function loadTestsForLesson(lessonId) {
    currentTests = [];
    try {
        const data = await api.getTestByLesson(lessonId);
        currentTests = Array.isArray(data) ? data : [];
    } catch (_) {
        currentTests = [];
    }
}

// ---------------------------------------------------------------------------
// Рендер
// ---------------------------------------------------------------------------
function render() {
    const container = document.getElementById("courseContainer");

    const headerHtml = `
        <div class="course-header">
            <h1>${escapeHtml(course.title)}</h1>
            <div class="course-badge ${escapeHtml(course.level)}">${getLevelText(course.level)}</div>
            ${!course.is_published ? '<span class="course-badge draft">черновик</span>' : ""}
        </div>
        <p class="course-description-full">${escapeHtml(course.description)}</p>
    `;

    if (mode === "teacher") {
        container.innerHTML = headerHtml + renderTeacherPanel();
        bindTeacherEvents();
    } else {
        container.innerHTML = headerHtml + renderStudentPanel();
        bindStudentEvents();
    }
}

// ---------------------------------------------------------------------------
// Панель студента
// ---------------------------------------------------------------------------
function renderStudentPanel() {
    if (!isEnrolled) {
        return `
            <div class="enroll-cta">
                <p>Вы ещё не записаны на этот курс.</p>
                <button class="btn btn-primary" id="enrollBtn">Записаться на курс</button>
            </div>
        `;
    }

    if (lessons.length === 0) {
        return `<div class="empty-state">В курсе пока нет уроков. Загляните позже.</div>`;
    }

    const currentLesson = lessons.find((l) => l.id === currentLessonId) || lessons[0];

    const lessonsSelect = `
        <div class="lessons-selector">
            <label class="selector-label">Урок:</label>
            <select id="lessonSelect" class="lesson-select">
                ${lessons
                    .map((lesson, idx) => {
                        const completed =
                            myProgress &&
                            myProgress.lessons.some(
                                (lr) => lr.lesson_id === lesson.id && lr.completed
                            );
                        return `
                        <option value="${lesson.id}" ${
                            lesson.id === currentLessonId ? "selected" : ""
                        }>
                            Урок ${idx + 1}: ${escapeHtml(lesson.title)}${completed ? " ✓" : ""}
                        </option>`;
                    })
                    .join("")}
            </select>
        </div>
    `;

    const currentIndex = lessons.findIndex((l) => l.id === currentLesson.id);
    const nextExists = currentIndex + 1 < lessons.length;

    const lessonProgress = myProgress
        ? myProgress.lessons.find((lr) => lr.lesson_id === currentLesson.id)
        : null;

    const completedBadge =
        lessonProgress && lessonProgress.completed
            ? `<div class="lesson-completed-badge">✓ Изучено${
                  lessonProgress.percent != null ? ` — ${lessonProgress.percent}%` : ""
              }</div>`
            : "";

    const actionBtnHtml = `<button class="btn btn-primary" id="nextLessonBtn">
        ${nextExists ? "Следующий урок →" : "Завершить курс"}
    </button>`;

    let testBlocksHtml = "";
    if (currentTests.length > 0) {
        testBlocksHtml = `
            <div class="lesson-test-block">
                <h3>Тесты урока (${currentTests.length})</h3>
                ${currentTests
                    .map((t, idx) => {
                        let resultHtml = `<span class="test-info-sub">Ещё не проходили</span>`;
                        if (t.my_best_percent != null) {
                            const passed =
                                t.my_best_percent >= t.passing_score;
                            resultHtml = `
                                <span class="test-info-sub">
                                    Лучший результат:
                                    <strong class="${passed ? "test-passed" : "test-failed"}">
                                        ${t.my_best_percent}%
                                    </strong>
                                    (${t.my_best_score}/${t.my_max_score} б.)
                                </span>
                            `;
                        }
                        return `
                    <div class="test-item-row">
                        <div class="test-item-info">
                            <strong>${idx + 1}. ${escapeHtml(t.title)}</strong>
                            <span class="test-info-sub">Проходной балл: ${t.passing_score}%</span>
                            ${resultHtml}
                        </div>
                        <button class="btn btn-primary btn-small" data-test-id="${t.id}">
                            ${t.my_best_percent != null ? "Пройти заново" : "Пройти"}
                        </button>
                    </div>`;
                    })
                    .join("")}
            </div>`;
    }

    return `
        ${lessonsSelect}
        <div class="theory-content">
            <h2>${escapeHtml(currentLesson.title)}</h2>
            ${currentLesson.theory || "<p><em>Теория не заполнена.</em></p>"}
            ${completedBadge}
        </div>
        ${testBlocksHtml}
        <div class="course-actions">
            ${actionBtnHtml}
            <a href="courses.html" class="btn btn-outline">Выйти</a>
        </div>
    `;
}

function bindStudentEvents() {
    const enrollBtn = document.getElementById("enrollBtn");
    if (enrollBtn) {
        enrollBtn.addEventListener("click", async () => {
            enrollBtn.disabled = true;
            enrollBtn.textContent = "Записываемся...";
            try {
                await api.enroll(courseId);
                myProgress = await api.getMyProgress(courseId);
                isEnrolled = true;
                currentLessonId = lessons.length > 0 ? lessons[0].id : null;
                if (currentLessonId) {
                    await loadTestsForLesson(currentLessonId);
                }
                render();
            } catch (err) {
                alert("Ошибка записи: " + err.message);
                enrollBtn.disabled = false;
                enrollBtn.textContent = "Записаться на курс";
            }
        });
    }

    const lessonSelect = document.getElementById("lessonSelect");
    if (lessonSelect) {
        lessonSelect.addEventListener("change", async (e) => {
            currentLessonId = parseInt(e.target.value);
            await loadTestsForLesson(currentLessonId);
            render();
            window.scrollTo({ top: 0, behavior: "smooth" });
        });
    }

    const nextBtn = document.getElementById("nextLessonBtn");
    if (nextBtn) {
        nextBtn.addEventListener("click", async () => {
            if (!currentLessonId) return;
            const currentIndex = lessons.findIndex((l) => l.id === currentLessonId);
            const nextExists = currentIndex + 1 < lessons.length;

            try {
                await api.completeLesson(currentLessonId);
                myProgress = await api.getMyProgress(courseId);
            } catch (err) {
                console.warn("Не удалось отметить урок:", err.message);
            }

            if (nextExists) {
                currentLessonId = lessons[currentIndex + 1].id;
                await loadTestsForLesson(currentLessonId);
                render();
                window.scrollTo({ top: 0, behavior: "smooth" });
            } else {
                alert(
                    "Курс пройден! Итоговый процент: " +
                        Math.round(myProgress.average_percent) +
                        "%"
                );
                window.location.href = "courses.html";
            }
        });
    }

    document.querySelectorAll("[data-test-id]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const testId = btn.dataset.testId;
            window.location.href = `test.html?testId=${testId}&courseId=${courseId}&lessonId=${currentLessonId}`;
        });
    });
}

// ---------------------------------------------------------------------------
// Панель учителя
// ---------------------------------------------------------------------------
function renderTeacherPanel() {
    const lessonsHtml =
        lessons.length === 0
            ? `<div class="empty-state" style="margin: 15px 0;">Уроков пока нет. Добавьте первый урок.</div>`
            : lessons
                  .map(
                      (l, idx) => `
            <div class="teacher-lesson-row">
                <div class="teacher-lesson-info">
                    <strong>Урок ${idx + 1}:</strong> ${escapeHtml(l.title)}
                    <span class="teacher-lesson-meta">(порядок: ${l.order_index})</span>
                </div>
                <div class="teacher-lesson-actions">
                    <button class="btn btn-outline btn-small view-lesson-btn" data-lesson-id="${l.id}">Открыть</button>
                    <button class="btn btn-outline btn-small create-test-btn" data-lesson-id="${l.id}" data-lesson-title="${escapeHtml(l.title)}">
                        + Тест
                    </button>
                    <button class="btn btn-outline btn-small view-tests-btn" data-lesson-id="${l.id}">Тесты</button>
                </div>
            </div>`
                  )
                  .join("");

    return `
        <div class="teacher-panel">
            <div class="teacher-panel-header">
                <h2>Панель управления курсом</h2>
                <div class="teacher-panel-actions">
                    <button class="btn btn-outline" id="togglePublishBtn">
                        ${course.is_published ? "Снять с публикации" : "Опубликовать"}
                    </button>
                    <button class="btn btn-primary" id="addLessonBtn">+ Добавить урок</button>
                </div>
            </div>

            <h3>Уроки</h3>
            <div class="teacher-lessons">
                ${lessonsHtml}
            </div>

            <h3>Студенты на курсе</h3>
            <div id="studentsBlock">
                <div class="empty-state" style="margin: 15px 0;">Загрузка...</div>
            </div>
        </div>
    `;
}

function bindTeacherEvents() {
    const toggleBtn = document.getElementById("togglePublishBtn");
    if (toggleBtn) {
        toggleBtn.addEventListener("click", async () => {
            toggleBtn.disabled = true;
            try {
                course = await api.updateCourse(courseId, {
                    is_published: !course.is_published,
                });
                render();
            } catch (err) {
                alert("Ошибка: " + err.message);
                toggleBtn.disabled = false;
            }
        });
    }

    const addLessonBtn = document.getElementById("addLessonBtn");
    if (addLessonBtn) {
        addLessonBtn.addEventListener("click", () => openAddLessonModal());
    }

    document.querySelectorAll(".create-test-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            openCreateTestModal(
                parseInt(btn.dataset.lessonId),
                btn.dataset.lessonTitle
            );
        });
    });

    document.querySelectorAll(".view-lesson-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            openLessonPreview(parseInt(btn.dataset.lessonId));
        });
    });

    document.querySelectorAll(".view-tests-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            openTestsListForLesson(parseInt(btn.dataset.lessonId));
        });
    });

    loadStudents();
}

async function loadStudents() {
    const block = document.getElementById("studentsBlock");
    if (!block) return;

    try {
        const students = await api.getCourseStudents(courseId);
        if (!students || students.length === 0) {
            block.innerHTML = `<div class="empty-state" style="margin: 15px 0;">Студентов пока нет.</div>`;
            return;
        }

        block.innerHTML = `
            <table class="students-table">
                <thead>
                    <tr>
                        <th>Имя</th>
                        <th>Email</th>
                        <th>Дата записи</th>
                    </tr>
                </thead>
                <tbody>
                    ${students
                        .map(
                            (s) => `
                        <tr>
                            <td>${escapeHtml(s.full_name || "—")}</td>
                            <td>${escapeHtml(s.email)}</td>
                            <td>${formatDate(s.enrolled_at)}</td>
                        </tr>`
                        )
                        .join("")}
                </tbody>
            </table>
        `;
    } catch (err) {
        block.innerHTML = `<div class="empty-state" style="margin: 15px 0;">Ошибка: ${escapeHtml(err.message)}</div>`;
    }
}

// ---------------------------------------------------------------------------
// Модалка: добавить урок
// ---------------------------------------------------------------------------
function openAddLessonModal() {
    const modal = document.createElement("div");
    modal.className = "modal active";
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Новый урок</h3>
                <button class="modal-close" data-close>&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>Название урока</label>
                    <input type="text" id="newLessonTitle" class="form-input" placeholder="Например: Урок 1. Алфавит">
                </div>
                <div class="form-group">
                    <label>Порядковый номер</label>
                    <input type="number" id="newLessonOrder" class="form-input" value="${lessons.length + 1}" min="1">
                </div>
                <div class="form-group">
                    <label>Теория (HTML допустим)</label>
                    <textarea id="newLessonTheory" class="form-textarea" rows="8" placeholder="<h2>Заголовок</h2><p>Текст...</p>"></textarea>
                </div>
                <div class="form-actions">
                    <button class="btn btn-outline" data-close>Отмена</button>
                    <button class="btn btn-primary" id="saveLessonBtn">Создать урок</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    modal
        .querySelectorAll("[data-close]")
        .forEach((el) => el.addEventListener("click", () => modal.remove()));

    document
        .getElementById("saveLessonBtn")
        .addEventListener("click", async () => {
            const title = document.getElementById("newLessonTitle").value.trim();
            const order =
                parseInt(document.getElementById("newLessonOrder").value) || 1;
            const theory = document.getElementById("newLessonTheory").value;

            if (!title) {
                alert("Введите название урока");
                return;
            }

            const saveBtn = document.getElementById("saveLessonBtn");
            saveBtn.disabled = true;
            saveBtn.textContent = "Создаём...";

            try {
                await api.createLesson(courseId, {
                    title,
                    theory,
                    order_index: order,
                });
                modal.remove();
                lessons = await api.getLessons(courseId);
                render();
            } catch (err) {
                alert("Ошибка: " + err.message);
                saveBtn.disabled = false;
                saveBtn.textContent = "Создать урок";
            }
        });
}

// ---------------------------------------------------------------------------
// Модалка: создать тест
// ---------------------------------------------------------------------------
function openCreateTestModal(lessonId, lessonTitle) {
    const modal = document.createElement("div");
    modal.className = "modal active";
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 700px;">
            <div class="modal-header">
                <h3>Новый тест для урока «${escapeHtml(lessonTitle)}»</h3>
                <button class="modal-close" data-close>&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>Название теста</label>
                    <input type="text" id="testTitle" class="form-input" value="Тест по уроку">
                </div>
                <div class="form-group">
                    <label>Проходной балл (%)</label>
                    <input type="number" id="testPassingScore" class="form-input" value="60" min="0" max="100">
                </div>

                <div id="questionsList"></div>

                <button class="btn btn-outline" id="addQuestionBtn" style="margin-top: 10px;">+ Добавить вопрос</button>

                <div class="form-actions" style="margin-top: 20px;">
                    <button class="btn btn-outline" data-close>Отмена</button>
                    <button class="btn btn-primary" id="saveTestBtn">Создать тест</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    modal
        .querySelectorAll("[data-close]")
        .forEach((el) => el.addEventListener("click", () => modal.remove()));

    const questionsList = document.getElementById("questionsList");
    let questionCounter = 0;

    function addQuestion() {
        questionCounter++;
        const qid = questionCounter;
        const block = document.createElement("div");
        block.className = "question-block";
        block.dataset.qid = qid;
        block.innerHTML = `
            <div class="question-header">
                <strong>Вопрос ${qid}</strong>
                <button class="modal-close" data-remove-question>&times;</button>
            </div>
            <div class="form-group">
                <label>Текст вопроса</label>
                <input type="text" class="form-input q-text" placeholder="Введите вопрос">
            </div>
            <div class="form-group">
                <label>Баллы</label>
                <input type="number" class="form-input q-points" value="1" min="0" step="0.5">
            </div>
            <div class="form-group">
                <label>Варианты ответа (отметьте правильный)</label>
                <div class="options-list">
                    ${[1, 2, 3, 4]
                        .map(
                            (i) => `
                        <div class="option-row">
                            <input type="radio" name="correct_${qid}" value="${i}" ${i === 1 ? "checked" : ""}>
                            <input type="text" class="form-input option-text" placeholder="Вариант ${i}">
                        </div>`
                        )
                        .join("")}
                </div>
            </div>
        `;
        block
            .querySelector("[data-remove-question]")
            .addEventListener("click", () => block.remove());
        questionsList.appendChild(block);
    }

    document.getElementById("addQuestionBtn").addEventListener("click", addQuestion);
    addQuestion();

    document
        .getElementById("saveTestBtn")
        .addEventListener("click", async () => {
            const title = document.getElementById("testTitle").value.trim();
            const passingScore =
                parseFloat(document.getElementById("testPassingScore").value) || 60;

            if (!title) {
                alert("Введите название теста");
                return;
            }

            const questionBlocks =
                questionsList.querySelectorAll(".question-block");
            if (questionBlocks.length === 0) {
                alert("Добавьте хотя бы один вопрос");
                return;
            }

            const questions = [];
            for (const block of questionBlocks) {
                const text = block.querySelector(".q-text").value.trim();
                const points =
                    parseFloat(block.querySelector(".q-points").value) || 1;
                const correctRadio = block.querySelector(
                    'input[type="radio"]:checked'
                );
                const correctIdx = correctRadio ? parseInt(correctRadio.value) : 1;

                const optionInputs = block.querySelectorAll(".option-text");
                const options = [];
                optionInputs.forEach((inp, idx) => {
                    const val = inp.value.trim();
                    if (val) {
                        options.push({
                            text: val,
                            is_correct: idx + 1 === correctIdx,
                        });
                    }
                });

                if (!text || options.length < 2) {
                    alert("Заполните все вопросы и добавьте минимум 2 варианта");
                    return;
                }
                if (!options.some((o) => o.is_correct)) {
                    alert("У вопроса должен быть правильный вариант");
                    return;
                }

                questions.push({
                    text,
                    question_type: "single",
                    points,
                    options,
                });
            }

            const saveBtn = document.getElementById("saveTestBtn");
            saveBtn.disabled = true;
            saveBtn.textContent = "Создаём...";

            try {
                await api.createTest(lessonId, {
                    title,
                    passing_score: passingScore,
                    questions,
                });
                modal.remove();
            } catch (err) {
                alert("Ошибка: " + err.message);
                saveBtn.disabled = false;
                saveBtn.textContent = "Создать тест";
            }
        });
}

// ---------------------------------------------------------------------------
// Просмотр урока (превью)
// ---------------------------------------------------------------------------
function openLessonPreview(lessonId) {
    const lesson = lessons.find((l) => l.id === lessonId);
    if (!lesson) return;

    const modal = document.createElement("div");
    modal.className = "modal active";
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 1000px;">
            <div class="modal-header">
                <h3>${escapeHtml(lesson.title)}</h3>
                <button class="modal-close" data-close>&times;</button>
            </div>
            <div class="modal-body">
                <div class="theory-content" style="box-shadow:none; margin:0; padding:0; max-width:100%;">
                    ${lesson.theory || "<p><em>Теория не заполнена.</em></p>"}
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal
        .querySelectorAll("[data-close]")
        .forEach((el) => el.addEventListener("click", () => modal.remove()));
}

// ---------------------------------------------------------------------------
// Просмотр тестов для урока
// ---------------------------------------------------------------------------
async function openTestsListForLesson(lessonId) {
    const modal = document.createElement("div");
    modal.className = "modal active";
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 1000px;">
            <div class="modal-header">
                <h3>Тесты урока</h3>
                <button class="modal-close" data-close>&times;</button>
            </div>
            <div class="modal-body" id="testsListBody">
                <div class="empty-state">Загрузка...</div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal
        .querySelectorAll("[data-close]")
        .forEach((el) => el.addEventListener("click", () => modal.remove()));

    const body = modal.querySelector("#testsListBody");

    let tests = [];
    try {
        const data = await api.getTestByLesson(lessonId);
        tests = Array.isArray(data) ? data : [];
    } catch (_) {
        tests = [];
    }

    function render() {
        if (tests.length === 0) {
            body.innerHTML = `
                <div class="empty-state">
                    Тестов для этого урока пока нет.
                    <br><br>
                    <button class="btn btn-primary" id="createTestFromModal">+ Создать тест</button>
                </div>
            `;
            const btn = body.querySelector("#createTestFromModal");
            if (btn) {
                btn.addEventListener("click", () => {
                    modal.remove();
                    const lesson = lessons.find((l) => l.id === lessonId);
                    openCreateTestModal(lessonId, lesson ? lesson.title : "");
                });
            }
            return;
        }

        body.innerHTML = `
            <div class="tests-list-header">
                <button class="btn btn-primary" id="createTestFromModal">+ Добавить ещё тест</button>
            </div>
            ${tests
                .map(
                    (test, idx) => `
                <div class="test-preview-block">
                    <div class="test-preview-header">
                        <h4>${idx + 1}. ${escapeHtml(test.title)}</h4>
                        <p class="test-info">Проходной балл: ${test.passing_score}%</p>
                    </div>
                    <div class="test-questions-preview">
                        ${test.questions
                            .map(
                                (q, qidx) => `
                            <div class="test-question-preview">
                                <div class="tqp-header">
                                    <strong>Вопрос ${qidx + 1}.</strong> ${escapeHtml(q.text)}
                                    <span class="tqp-points">${q.points} б.</span>
                                </div>
                                <ul class="tqp-options">
                                    ${q.options
                                        .map(
                                            (o) => `
                                        <li class="${o.is_correct ? "correct" : ""}">
                                            ${escapeHtml(o.text)}
                                            ${o.is_correct ? " ✓" : ""}
                                        </li>`
                                        )
                                        .join("")}
                                </ul>
                            </div>`
                            )
                            .join("")}
                    </div>
                </div>`
                )
                .join("")}
        `;

        const btn = body.querySelector("#createTestFromModal");
        if (btn) {
            btn.addEventListener("click", () => {
                modal.remove();
                const lesson = lessons.find((l) => l.id === lessonId);
                openCreateTestModal(lessonId, lesson ? lesson.title : "");
            });
        }
    }

    render();
}

// ---------------------------------------------------------------------------
// Утилиты
// ---------------------------------------------------------------------------
function getLevelText(level) {
    const levels = {
        beginner: "Начинающий",
        intermediate: "Средний",
        advanced: "Продвинутый",
    };
    return levels[level] || level || "—";
}

function formatDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("ru-RU");
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text == null ? "" : text;
    return div.innerHTML;
}