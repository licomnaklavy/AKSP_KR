let user = null;
let myCourses = [];

document.addEventListener("DOMContentLoaded", async () => {
    const container = document.getElementById("profileContainer");

    if (!api.isAuthenticated()) {
        window.location.href = "login.html";
        return;
    }

    try {
        user = await api.me();
    } catch (_) {
        window.location.href = "login.html";
        return;
    }

    try {
        if (user.role === "teacher" || user.role === "admin") {
            myCourses = await api.getMyCourses();
        } else {
            const all = await api.getCourses();
            myCourses = all.filter((c) => c.my_progress != null);
        }
    } catch (_) {
        myCourses = [];
    }

    render();
});

// ---------------------------------------------------------------------------
// Рендер
// ---------------------------------------------------------------------------
function render() {
    const container = document.getElementById("profileContainer");

    const initials = getInitials(user.full_name || user.email);
    const roleText =
        user.role === "teacher" ? "Преподаватель" :
        user.role === "admin" ? "Администратор" : "Студент";
    const roleClass = `role-${user.role}`;

    const statsHtml = user.role === "student"
        ? renderStudentStats()
        : renderTeacherStats();

    container.innerHTML = `
        <div class="profile-header">
            <div class="profile-avatar">${escapeHtml(initials)}</div>
            <div class="profile-info">
                <h1>${escapeHtml(user.full_name || user.email)}</h1>
                <p>${escapeHtml(user.email)}</p>
                <span class="profile-role ${roleClass}">${roleText}</span>
            </div>
        </div>

        <div class="profile-stats-card">
            ${statsHtml}
        </div>

        <div class="profile-section">
            <h2>Мои курсы</h2>
            ${renderCoursesList()}
        </div>
    `;
}

// ---------------------------------------------------------------------------
// Статистика студента
// ---------------------------------------------------------------------------
function renderStudentStats() {
    const total = myCourses.length;
    let totalLessons = 0;
    let percents = [];

    for (const c of myCourses) {
        totalLessons += c.lessons_count || 0;
        if (c.my_progress != null) {
            percents.push(c.my_progress);
        }
    }

    const avg = percents.length
        ? Math.round(percents.reduce((a, b) => a + b, 0) / percents.length)
        : 0;

    const completedLessons = Math.round((avg / 100) * totalLessons);

    return `
        <div class="stat-item">
            <span class="stat-value">${total}</span>
            <span class="stat-label">${pluralCourses(total)}</span>
        </div>
        <div class="stat-item">
            <span class="stat-value">${completedLessons}/${totalLessons}</span>
            <span class="stat-label">уроков пройдено</span>
        </div>
        <div class="stat-item">
            <span class="stat-value">${avg}%</span>
            <span class="stat-label">средний прогресс</span>
        </div>
    `;
}

// ---------------------------------------------------------------------------
// Статистика преподавателя
// ---------------------------------------------------------------------------
function renderTeacherStats() {
    const total = myCourses.length;
    const published = myCourses.filter((c) => c.is_published).length;
    const totalLessons = myCourses.reduce(
        (acc, c) => acc + (c.lessons_count || 0),
        0
    );

    return `
        <div class="stat-item">
            <span class="stat-value">${total}</span>
            <span class="stat-label">${pluralCourses(total)}</span>
        </div>
        <div class="stat-item">
            <span class="stat-value">${published}</span>
            <span class="stat-label">опубликовано</span>
        </div>
        <div class="stat-item">
            <span class="stat-value">${totalLessons}</span>
            <span class="stat-label">${pluralLessons(totalLessons)}</span>
        </div>
    `;
}

// ---------------------------------------------------------------------------
// Список курсов
// ---------------------------------------------------------------------------
function renderCoursesList() {
    if (myCourses.length === 0) {
        const isStudent = user.role === "student";
        const msg = isStudent
            ? "Вы ещё не записаны ни на один курс."
            : "Вы ещё не создали ни одного курса.";
        return `
            <div class="empty-state">
                ${msg}<br><br>
                <a href="courses.html" class="btn btn-primary">Перейти к курсам</a>
            </div>
        `;
    }

    return `
        <div class="profile-courses-list">
            ${myCourses
                .map((c) => {
                    const isStudent = user.role === "student";

                    let progressText = "";
                    let progressBarHtml = "";
                    if (isStudent) {
                        const percent =
                            c.my_progress != null ? Math.round(c.my_progress) : 0;
                        progressText = `${percent}%`;
                        progressBarHtml = `
                            <div class="progress-bar" style="margin-top:6px;">
                                <div class="progress-fill" style="width: ${percent}%"></div>
                            </div>`;
                    } else {
                        progressText = c.is_published ? "опубликован" : "черновик";
                        progressBarHtml = `
                            <span class="course-status-badge ${
                                c.is_published ? "published" : "draft"
                            }">
                                ${c.is_published ? "Опубликован" : "Черновик"}
                            </span>`;
                    }

                    return `
                    <a class="profile-course-row" href="course-detail.html?id=${c.id}">
                        <div class="profile-course-info">
                            <div class="profile-course-title">${escapeHtml(c.title)}</div>
                            <div class="profile-course-meta">
                                ${c.lessons_count || 0} уроков
                                ${isStudent ? " · " + progressText : ""}
                            </div>
                            ${isStudent ? progressBarHtml : ""}
                        </div>
                        <div class="profile-course-right">
                            ${isStudent ? "" : progressBarHtml}
                            <span class="profile-course-arrow">→</span>
                        </div>
                    </a>`;
                })
                .join("")}
        </div>
    `;
}

// ---------------------------------------------------------------------------
// Утилиты
// ---------------------------------------------------------------------------
function getInitials(name) {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
}

function pluralCourses(n) {
    if (n % 10 === 1 && n % 100 !== 11) return "курс";
    if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100))
        return "курса";
    return "курсов";
}

function pluralLessons(n) {
    if (n % 10 === 1 && n % 100 !== 11) return "урок";
    if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100))
        return "урока";
    return "уроков";
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text == null ? "" : text;
    return div.innerHTML;
}