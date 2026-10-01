// frontend/js/courses.js
// Каталог курсов: загрузка с реального API, поиск, прогресс, переход к курсу.

let allCourses = [];
let currentSearch = "";

document.addEventListener("DOMContentLoaded", async () => {
    const container = document.getElementById("coursesContainer");
    const searchInput = document.getElementById("searchInput");
    const searchBtn = document.getElementById("searchBtn");

    if (!api.isAuthenticated()) {
        container.innerHTML =
            '<div class="empty-state">Войдите, чтобы увидеть курсы</div>';
        return;
    }

    try {
        allCourses = await api.getCourses();
    } catch (err) {
        container.innerHTML = `<div class="empty-state">Ошибка загрузки: ${escapeHtml(err.message)}</div>`;
        return;
    }

    renderCourses();

    const doSearch = () => {
        currentSearch = (searchInput.value || "").trim().toLowerCase();
        renderCourses();
    };
    searchBtn.addEventListener("click", doSearch);
    searchInput.addEventListener("keyup", (e) => {
        if (e.key === "Enter") doSearch();
    });
});

function renderCourses() {
    const container = document.getElementById("coursesContainer");

    let filtered = [...allCourses];
    if (currentSearch) {
        filtered = filtered.filter(
            (c) =>
                (c.title || "").toLowerCase().includes(currentSearch) ||
                (c.description || "").toLowerCase().includes(currentSearch)
        );
    }

    if (filtered.length === 0) {
        container.innerHTML =
            '<div class="empty-state">Курсы не найдены</div>';
        return;
    }

    container.innerHTML = filtered
        .map((course) => {
            const totalLessons = course.lessons_count || 0;
            const lessonsText = getLessonsText(totalLessons);

            let progress = 0;
            let progressLabel = "Не записан";
            if (course.my_progress != null) {
                progress = Math.round(course.my_progress);
                progressLabel = `${progress}%`;
            }

            return `
            <div class="course-card" data-id="${course.id}">
                <div class="course-image" style="background-image: url('assets/images/english-course.jpg')">
                    <span class="course-level ${escapeHtml(course.level)}">${getLevelText(course.level)}</span>
                    ${!course.is_published ? '<span class="course-level draft">черновик</span>' : ""}
                </div>
                <div class="course-content">
                    <h3 class="course-title">${escapeHtml(course.title)}</h3>
                    <p class="course-description">${escapeHtml(course.description)}</p>
                    <div class="course-meta">
                        <span class="course-stat">${lessonsText}</span>
                    </div>
                    <div class="course-progress">
                        <div class="progress-label">
                            <span>Прогресс</span>
                            <span>${progressLabel}</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${progress}%"></div>
                        </div>
                    </div>
                    <button class="btn btn-primary btn-course" data-id="${course.id}">
                        Перейти к курсу
                    </button>
                </div>
            </div>`;
        })
        .join("");

    document.querySelectorAll(".btn-course").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const courseId = btn.dataset.id;
            window.location.href = `course-detail.html?id=${courseId}`;
        });
    });
}

function getLessonsText(n) {
    if (n === 1) return "1 урок";
    if (n >= 2 && n <= 4) return `${n} урока`;
    return `${n} уроков`;
}

function getLevelText(level) {
    const levels = {
        beginner: "Начинающий",
        intermediate: "Средний",
        advanced: "Продвинутый",
    };
    return levels[level] || level || "—";
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}