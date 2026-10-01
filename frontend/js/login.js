document.addEventListener("DOMContentLoaded", () => {
    // Если уже авторизован — сразу на курсы
    if (api.isAuthenticated()) {
        window.location.href = "courses.html";
        return;
    }

    const form = document.getElementById("loginForm");
    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");
    const errorBox = document.getElementById("errorBox");
    const submitBtn = document.getElementById("submitBtn");

    function showError(message) {
        errorBox.textContent = message;
        errorBox.hidden = false;
    }

    function hideError() {
        errorBox.hidden = true;
        errorBox.textContent = "";
    }

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        hideError();

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        if (!email || !password) {
            showError("Заполните email и пароль");
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = "Входим...";

        try {
            await api.login(email, password);
            window.location.href = "courses.html";
        } catch (err) {
            showError(err.message || "Ошибка входа");
            submitBtn.disabled = false;
            submitBtn.textContent = "Войти";
        }
    });
});