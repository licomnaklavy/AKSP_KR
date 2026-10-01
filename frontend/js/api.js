// frontend/js/api.js
// Обёртка над fetch для работы с реальным API бэкенда.

const API_BASE = "/api/v1";

function getToken() {
    return localStorage.getItem("lms_token");
}

function setToken(token) {
    localStorage.setItem("lms_token", token);
}

function clearToken() {
    localStorage.removeItem("lms_token");
}

async function request(path, options = {}) {
    const headers = options.headers || {};

    if (!headers["Content-Type"] && !(options.body instanceof FormData)) {
        headers["Content-Type"] = "application/json";
    }

    const token = getToken();
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const url = API_BASE + path;
    const res = await fetch(url, { ...options, headers });

    if (res.status === 401) {
        clearToken();
        if (!location.pathname.endsWith("login.html")) {
            window.location.href = "login.html";
        }
        throw new Error("Unauthorized");
    }

    if (res.status === 204) {
        return null;
    }

    const contentType = res.headers.get("content-type") || "";
    let data = null;
    if (contentType.includes("application/json")) {
        data = await res.json();
    }

    if (!res.ok) {
        const msg = (data && (data.detail || data.message)) || `HTTP ${res.status}`;
        throw new Error(msg);
    }

    return data;
}

const api = {
    // --- Авторизация ---
    register: (payload) =>
        request("/auth/register", {
            method: "POST",
            body: JSON.stringify(payload),
        }),

    login: async (email, password) => {
        const body = new URLSearchParams({ username: email, password });
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body,
        });
        if (!res.ok) {
            let msg = "Неверный email или пароль";
            try {
                const data = await res.json();
                if (data.detail) msg = data.detail;
            } catch (_) {}
            throw new Error(msg);
        }
        const data = await res.json();
        setToken(data.access_token);
        return data;
    },

    logout: () => clearToken(),
    me: () => request("/auth/me"),
    isAuthenticated: () => !!getToken(),

    // --- Курсы ---
    getCourses: () => request("/courses"),
    getMyCourses: () => request("/courses/my"),
    getCourse: (id) => request(`/courses/${id}`),
    createCourse: (payload) =>
        request("/courses", {
            method: "POST",
            body: JSON.stringify(payload),
        }),
    updateCourse: (id, payload) =>
        request(`/courses/${id}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
        }),
    deleteCourse: (id) => request(`/courses/${id}`, { method: "DELETE" }),

    enroll: (courseId) =>
        request(`/courses/${courseId}/enroll`, { method: "POST" }),

    getLessons: (courseId) => request(`/courses/${courseId}/lessons`),
    createLesson: (courseId, payload) =>
        request(`/courses/${courseId}/lessons`, {
            method: "POST",
            body: JSON.stringify(payload),
        }),

    getCourseStudents: (courseId) => request(`/courses/${courseId}/students`),

    // --- Тесты ---
    getTest: (testId) => request(`/tests/${testId}`),
    getTestByLesson: (lessonId) => request(`/tests/by-lesson/${lessonId}`),
    createTest: (lessonId, payload) =>
        request(`/tests/lesson/${lessonId}`, {
            method: "POST",
            body: JSON.stringify(payload),
        }),
    startAttempt: (testId) =>
        request(`/tests/${testId}/start`, { method: "POST" }),
    submitAttempt: (attemptId, answers) =>
        request(`/tests/attempts/${attemptId}/submit`, {
            method: "POST",
            body: JSON.stringify({ answers }),
        }),
    getAttemptResult: (attemptId) => request(`/tests/attempts/${attemptId}`),
    getMyAttempts: (testId) => request(`/tests/${testId}/my-attempts`),

    // --- Прогресс ---
    getMyProgress: (courseId) => request(`/courses/${courseId}/my-progress`),
    completeLesson: (lessonId) =>
        request(`/lessons/${lessonId}/complete`, { method: "POST" }),
    getLessonResult: (lessonId) => request(`/lessons/${lessonId}/my-result`),
    getCourseProgress: (courseId) => request(`/courses/${courseId}/progress`),

    // --- Словари ---
    getDictionaries: () => request("/dictionaries"),
    getDictionary: (id) => request(`/dictionaries/${id}`),
    createDictionary: (name) =>
        request("/dictionaries", {
            method: "POST",
            body: JSON.stringify({ name }),
        }),
    renameDictionary: (id, name) =>
        request(`/dictionaries/${id}`, {
            method: "PATCH",
            body: JSON.stringify({ name }),
        }),
    deleteDictionary: (id) =>
        request(`/dictionaries/${id}`, { method: "DELETE" }),

    addWord: (dictId, payload) =>
        request(`/dictionaries/${dictId}/words`, {
            method: "POST",
            body: JSON.stringify(payload),
        }),
    updateWord: (dictId, wordId, payload) =>
        request(`/dictionaries/${dictId}/words/${wordId}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
        }),
    deleteWord: (dictId, wordId) =>
        request(`/dictionaries/${dictId}/words/${wordId}`, { method: "DELETE" }),
    bulkImportWords: (dictId, words) =>
        request(`/dictionaries/${dictId}/words/bulk`, {
            method: "POST",
            body: JSON.stringify(words),
        }),
};

window.api = api;