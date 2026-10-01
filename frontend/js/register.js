document.addEventListener("DOMContentLoaded", () => {
    if (api.isAuthenticated()) {
        window.location.href = "courses.html";
        return;
    }

    const form = document.getElementById("registerForm");
    const fullNameInput = document.getElementById("fullName");
    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");
    const roleSelect = document.getElementById("role");
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
        const fullName = fullNameInput.value.trim();
        const role = roleSelect.value;

        if (!email || !password) {
            showError("Заполните email и пароль");
            return;
        }
        if (password.length < 6) {
            showError("Пароль должен быть не менее 6 символов");
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = "Создаём аккаунт...";

        try {
            await api.register({
                email,
                password,
                full_name: fullName,
                role,
            });

            // После регистрации — логинимся автоматически
            await api.login(email, password);
            window.location.href = "courses.html";
        } catch (err) {
            showError(err.message || "Ошибка регистрации");
            submitBtn.disabled = false;
            submitBtn.textContent = "Зарегистрироваться";
        }
    });
});