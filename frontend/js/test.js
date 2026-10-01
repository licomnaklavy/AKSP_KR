// frontend/js/test.js
// Прохождение теста, привязанного к уроку.
// URL: test.html?testId=...&courseId=...&lessonId=...

let testId = null;
let courseId = null;
let lessonId = null;

let test = null;
let attemptId = null;
let questions = [];
let currentIndex = 0;
let userAnswers = {}; // question_id -> [selected_option_ids]

document.addEventListener("DOMContentLoaded", async () => {
    const container = document.getElementById("testContainer");

    if (!api.isAuthenticated()) {
        window.location.href = "login.html";
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    testId = parseInt(urlParams.get("testId"));
    courseId = parseInt(urlParams.get("courseId"));
    lessonId = parseInt(urlParams.get("lessonId"));

    if (!testId) {
        container.innerHTML = `
            <div class="test-error">
                <h2>Тест не указан</h2>
                <a href="courses.html" class="btn btn-primary">← К курсам</a>
            </div>`;
        return;
    }

    try {
        test = await api.getTest(testId);
    } catch (err) {
        container.innerHTML = `
            <div class="test-error">
                <h2>Тест не найден</h2>
                <p>${escapeHtml(err.message)}</p>
                <a href="courses.html" class="btn btn-primary">← К курсам</a>
            </div>`;
        return;
    }

    try {
        const attempt = await api.startAttempt(testId);
        attemptId = attempt.attempt_id;
        questions = attempt.questions;
        currentIndex = 0;
        userAnswers = {};
        renderQuestion();
    } catch (err) {
        container.innerHTML = `
            <div class="test-error">
                <h2>Не удалось начать тест</h2>
                <p>${escapeHtml(err.message)}</p>
                <a href="courses.html" class="btn btn-primary">← К курсам</a>
            </div>`;
    }
});

function renderQuestion() {
    const container = document.getElementById("testContainer");

    if (currentIndex >= questions.length) {
        submitAllAnswers();
        return;
    }

    const q = questions[currentIndex];
    const isMultiple = q.question_type === "multiple";
    const selected = userAnswers[q.id] || [];

    container.innerHTML = `
        <div class="test-header">
            <div class="test-mode-badge">${escapeHtml(test.title)}</div>
            <div class="test-progress">
                Вопрос ${currentIndex + 1} из ${questions.length}
            </div>
        </div>
        <div class="test-card">
            <div class="test-word">
                ${escapeHtml(q.text)}
                <span style="display:block; font-size:0.75rem; color:#888; font-weight:400; margin-top:6px;">
                    ${q.points} б.${isMultiple ? " · несколько вариантов" : ""}
                </span>
            </div>
            <div class="test-options" id="testOptions">
                ${q.options
                    .map(
                        (opt) => `
                    <label class="test-option ${
                        selected.includes(opt.id) ? "selected" : ""
                    }" data-opt-id="${opt.id}">
                        <input
                            type="${isMultiple ? "checkbox" : "radio"}"
                            name="answer"
                            value="${opt.id}"
                            ${selected.includes(opt.id) ? "checked" : ""}
                        >
                        <span>${escapeHtml(opt.text)}</span>
                    </label>`
                    )
                    .join("")}
            </div>
            <div class="test-actions">
                ${
                    currentIndex > 0
                        ? `<button class="btn btn-outline" id="prevBtn">← Назад</button>`
                        : `<span></span>`
                }
                <button class="btn btn-primary" id="nextBtn">
                    ${
                        currentIndex + 1 < questions.length
                            ? "Следующий вопрос →"
                            : "Завершить тест"
                    }
                </button>
            </div>
        </div>
    `;

    container.querySelectorAll(".test-option").forEach((el) => {
        el.addEventListener("click", (e) => {
            const input = el.querySelector("input");
            if (e.target.tagName !== "INPUT") {
                input.checked = !input.checked;
            }
            const optId = parseInt(el.dataset.optId);
            if (isMultiple) {
                const arr = userAnswers[q.id] || [];
                if (input.checked) {
                    if (!arr.includes(optId)) arr.push(optId);
                } else {
                    const idx = arr.indexOf(optId);
                    if (idx !== -1) arr.splice(idx, 1);
                }
                userAnswers[q.id] = arr;
            } else {
                userAnswers[q.id] = [optId];
            }
            container.querySelectorAll(".test-option").forEach((o) => {
                const i = o.querySelector("input");
                o.classList.toggle("selected", i.checked);
            });
        });
    });

    const prevBtn = document.getElementById("prevBtn");
    if (prevBtn) {
        prevBtn.addEventListener("click", () => {
            currentIndex--;
            renderQuestion();
            window.scrollTo({ top: 0, behavior: "smooth" });
        });
    }

    const nextBtn = document.getElementById("nextBtn");
    nextBtn.addEventListener("click", () => {
        const selectedIds = userAnswers[q.id] || [];
        if (selectedIds.length === 0) {
            alert("Выберите ответ");
            return;
        }

        if (currentIndex + 1 < questions.length) {
            currentIndex++;
            renderQuestion();
            window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
            submitAllAnswers();
        }
    });
}

async function submitAllAnswers() {
    const container = document.getElementById("testContainer");

    const answers = questions.map((q) => ({
        question_id: q.id,
        selected_option_ids: userAnswers[q.id] || [],
    }));

    container.innerHTML = `
        <div class="test-result">
            <h2>Отправляем ответы...</h2>
        </div>
    `;

    try {
        const result = await api.submitAttempt(attemptId, answers);
        renderResult(result);
    } catch (err) {
        container.innerHTML = `
            <div class="test-error">
                <h2>Ошибка отправки</h2>
                <p>${escapeHtml(err.message)}</p>
                <a href="courses.html" class="btn btn-primary">← К курсам</a>
            </div>`;
    }
}

function renderResult(result) {
    const container = document.getElementById("testContainer");
    const percent = Math.round(result.percent);
    const passed = result.passed;

    let resultClass = "bad";
    if (percent === 100) resultClass = "perfect";
    else if (percent >= 80) resultClass = "good";
    else if (percent >= 60) resultClass = "normal";

    const passedText = passed
        ? "Тест пройден!"
        : "Тест не пройден. Попробуйте ещё раз.";

    const backUrl =
        lessonId && courseId
            ? `course-detail.html?id=${courseId}`
            : "courses.html";

    container.innerHTML = `
        <div class="test-result ${resultClass}">
            <h2>Тест завершён</h2>
            <div class="result-score">
                <span class="score-number">${result.score}</span>
                <span class="score-total">/${result.max_score}</span>
                <div class="score-percent">(${percent}%)</div>
            </div>
            <p class="result-message">${passedText}</p>
            <div class="result-actions">
                <a href="${backUrl}" class="btn btn-outline">← К курсу</a>
                <button class="btn btn-primary" id="retryBtn">Пройти заново</button>
            </div>
        </div>
    `;

    document.getElementById("retryBtn").addEventListener("click", () => {
        window.location.reload();
    });
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text == null ? "" : text;
    return div.innerHTML;
}