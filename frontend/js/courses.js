let allCourses = [];        // курсы, видимые пользователю (для каталога)
let myCourses = [];         // курсы текущего teacher'а (включая черновики)
let currentSearch = "";
let currentUser = null;
let isTeacherOrAdmin = false;

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
        currentUser = await api.me();
    } catch (_) {
        window.location.href = "/login.html";
        return;
    }

    isTeacherOrAdmin =
        currentUser.role === "teacher" || currentUser.role === "admin";

    // Загружаем каталог
    try {
        allCourses = await api.getCourses();
    } catch (err) {
        container.innerHTML = `<div class="empty-state">Ошибка загрузки: ${escapeHtml(err.message)}</div>`;
        return;
    }

    // Для teacher'а — грузим свои курсы и показываем блок управления
    if (isTeacherOrAdmin) {
        try {
            myCourses = await api.getMyCourses();
        } catch (_) {
            myCourses = [];
        }
        renderTeacherPanel();
        document.getElementById("createCourseBtn").addEventListener("click", () => {
            openCreateCourseModal();
        });
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

// ---------------------------------------------------------------------------
// Блок управления для teacher'а
// ---------------------------------------------------------------------------
function renderTeacherPanel() {
    const panel = document.getElementById("teacherPanel");
    if (!panel) return;

    panel.style.display = "block";
    const list = document.getElementById("teacherCoursesList");

    if (myCourses.length === 0) {
        list.innerHTML = `<div class="empty-state">У вас пока нет курсов. Создайте первый.</div>`;
        return;
    }

    list.innerHTML = myCourses
        .map(
            (c) => `
        <div class="teacher-course-row">
            <div class="teacher-course-info">
                <div class="teacher-course-title">${escapeHtml(c.title)}</div>
                <div class="teacher-course-meta">
                    ${c.lessons_count || 0} уроков ·
                    <span class="status ${c.is_published ? "published" : "draft"}">
                        ${c.is_published ? "опубликован" : "черновик"}
                    </span>
                </div>
            </div>
            <div class="teacher-course-actions">
                <button class="btn btn-outline btn-small edit-course-btn" data-id="${c.id}">Настроить</button>
                <a class="btn btn-outline btn-small" href="/course-detail.html?id=${c.id}">Открыть</a>
            </div>
        </div>`
        )
        .join("");

    list.querySelectorAll(".edit-course-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            const course = myCourses.find((c) => c.id === parseInt(btn.dataset.id));
            if (course) openEditCourseModal(course);
        });
    });
}

// ---------------------------------------------------------------------------
// Рендер каталога
// ---------------------------------------------------------------------------
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
        container.innerHTML = '<div class="empty-state">Курсы не найдены</div>';
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
                <div class="course-image" style="background-image: url('/assets/images/english-course.jpg')">
                    <span class="course-level ${escapeHtml(course.level)}">${getLevelText(course.level)}</span>
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
            window.location.href = `/course-detail.html?id=${courseId}`;
        });
    });
}

// ---------------------------------------------------------------------------
// Модалка: создать курс
// ---------------------------------------------------------------------------
function openCreateCourseModal() {
    const modal = document.createElement("div");
    modal.className = "modal active";
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Новый курс</h3>
                <button class="modal-close" data-close>&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>Название</label>
                    <input type="text" id="courseTitle" class="form-input" placeholder="Например: Английский язык. Введение">
                </div>
                <div class="form-group">
                    <label>Описание</label>
                    <textarea id="courseDescription" class="form-textarea" rows="4" placeholder="Кратко о чём курс"></textarea>
                </div>
                <div class="form-group">
                    <label>Уровень</label>
                    <select id="courseLevel" class="form-input">
                        <option value="beginner">Начинающий</option>
                        <option value="intermediate">Средний</option>
                        <option value="advanced">Продвинутый</option>
                    </select>
                </div>
                <div class="form-actions">
                    <button class="btn btn-outline" data-close>Отмена</button>
                    <button class="btn btn-primary" id="saveCourseBtn">Создать</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    modal.querySelectorAll("[data-close]").forEach((el) =>
        el.addEventListener("click", () => modal.remove())
    );

    document.getElementById("saveCourseBtn").addEventListener("click", async () => {
        const title = document.getElementById("courseTitle").value.trim();
        const description = document.getElementById("courseDescription").value.trim();
        const level = document.getElementById("courseLevel").value;

        if (!title) {
            alert("Введите название курса");
            return;
        }

        const saveBtn = document.getElementById("saveCourseBtn");
        saveBtn.disabled = true;
        saveBtn.textContent = "Создаём...";

        try {
            await api.createCourse({ title, description, level });
            modal.remove();
            myCourses = await api.getMyCourses();
            renderTeacherPanel();
            allCourses = await api.getCourses();
            renderCourses();
        } catch (err) {
            alert("Ошибка: " + err.message);
            saveBtn.disabled = false;
            saveBtn.textContent = "Создать";
        }
    });
}

// ---------------------------------------------------------------------------
// Модалка: настроить курс
// ---------------------------------------------------------------------------
function openEditCourseModal(course) {
    const modal = document.createElement("div");
    modal.className = "modal active";
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Настройки курса</h3>
                <button class="modal-close" data-close>&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>Название</label>
                    <input type="text" id="editCourseTitle" class="form-input" value="${escapeHtml(course.title)}">
                </div>
                <div class="form-group">
                    <label>Описание</label>
                    <textarea id="editCourseDescription" class="form-textarea" rows="4">${escapeHtml(course.description)}</textarea>
                </div>
                <div class="form-group">
                    <label>Уровень</label>
                    <select id="editCourseLevel" class="form-input">
                        <option value="beginner" ${course.level === "beginner" ? "selected" : ""}>Начинающий</option>
                        <option value="intermediate" ${course.level === "intermediate" ? "selected" : ""}>Средний</option>
                        <option value="advanced" ${course.level === "advanced" ? "selected" : ""}>Продвинутый</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="editCoursePublished" ${course.is_published ? "checked" : ""}>
                        Опубликован (виден студентам)
                    </label>
                </div>
                <div class="form-actions">
                    <button class="btn btn-outline" data-close>Отмена</button>
                    <button class="btn btn-primary" id="updateCourseBtn">Сохранить</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    modal.querySelectorAll("[data-close]").forEach((el) =>
        el.addEventListener("click", () => modal.remove())
    );

    document.getElementById("updateCourseBtn").addEventListener("click", async () => {
        const title = document.getElementById("editCourseTitle").value.trim();
        const description = document.getElementById("editCourseDescription").value.trim();
        const level = document.getElementById("editCourseLevel").value;
        const is_published = document.getElementById("editCoursePublished").checked;

        if (!title) {
            alert("Введите название курса");
            return;
        }

        const saveBtn = document.getElementById("updateCourseBtn");
        saveBtn.disabled = true;
        saveBtn.textContent = "Сохраняем...";

        try {
            await api.updateCourse(course.id, { title, description, level, is_published });
            modal.remove();
            myCourses = await api.getMyCourses();
            renderTeacherPanel();
            allCourses = await api.getCourses();
            renderCourses();
        } catch (err) {
            alert("Ошибка: " + err.message);
            saveBtn.disabled = false;
            saveBtn.textContent = "Сохранить";
        }
    });
}

// ---------------------------------------------------------------------------
// Утилиты
// ---------------------------------------------------------------------------
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
    div.textContent = text == null ? "" : text;
    return div.innerHTML;
}