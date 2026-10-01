async function renderHeaderUser() {
    const nav = document.querySelector(".nav");
    if (!nav) return;

    // --- Проверка авторизации с редиректом ---
    const PUBLIC_PAGES = ["index.html", "login.html", "register.html"];
    const currentPage = location.pathname.split("/").pop() || "index.html";

    if (!api.isAuthenticated() && !PUBLIC_PAGES.includes(currentPage)) {
        window.location.href = "login.html";
        return;
    }
    // --- конец проверки ---

    // --- Очистка от предыдущих запусков и статичных элементов ---
    nav.querySelectorAll(".nav-user-btn").forEach((el) => el.remove());
    nav.querySelectorAll(".nav-logout-btn").forEach((el) => el.remove());
    nav.querySelectorAll('a[href="profile.html"]').forEach((el) => el.remove());
    nav.querySelectorAll('button[data-nav="logout"]').forEach((el) => el.remove());

    // --- Управление видимостью статичных ссылок ---
    // Для неавторизованного пользователя скрываем "Курсы" и "Словарь".
    const protectedLinks = nav.querySelectorAll(
        'a[href="courses.html"], a[href="vocabulary.html"]'
    );

    if (!api.isAuthenticated()) {
        protectedLinks.forEach((link) => {
            link.style.display = "none";
        });
    } else {
        protectedLinks.forEach((link) => {
            link.style.display = "";
        });
    }
    // --- конец управления видимостью ---

    // --- Отрисовка правой части ---
    if (!api.isAuthenticated()) {
        const loginLink = document.createElement("a");
        loginLink.href = "login.html";
        loginLink.className = "nav-link nav-user-btn";
        loginLink.textContent = "Войти";
        nav.appendChild(loginLink);
        return;
    }

    let user = null;
    try {
        user = await api.me();
    } catch (_) {
        const loginLink = document.createElement("a");
        loginLink.href = "login.html";
        loginLink.className = "nav-link nav-user-btn";
        loginLink.textContent = "Войти";
        nav.appendChild(loginLink);
        return;
    }

    // Ссылка "Профиль" с подсветкой активной страницы
    const isOnProfile = location.pathname.endsWith("profile.html");
    const profileLink = document.createElement("a");
    profileLink.href = "profile.html";
    profileLink.className = isOnProfile
        ? "nav-link nav-user-btn active"
        : "nav-link nav-user-btn";
    profileLink.textContent = "Профиль";

    // Кнопка "Выйти"
    const logoutBtn = document.createElement("button");
    logoutBtn.type = "button";
    logoutBtn.className = "nav-link nav-logout-btn nav-user-btn";
    logoutBtn.textContent = "Выйти";
    logoutBtn.onclick = () => {
        api.logout();
        window.location.href = "index.html";
    };

    // Блок с именем и ролью
    const userWrap = document.createElement("div");
    userWrap.className = "nav-user-btn nav-user-wrap";

    const name = document.createElement("span");
    name.className = "nav-user-name";
    name.textContent = user.full_name || user.email;

    const roleBadge = document.createElement("span");
    roleBadge.className = `nav-user-role nav-user-role-${user.role}`;
    roleBadge.textContent =
        user.role === "teacher" ? "преподаватель" :
        user.role === "admin" ? "админ" : "студент";

    userWrap.appendChild(name);
    userWrap.appendChild(roleBadge);

    nav.appendChild(profileLink);
    nav.appendChild(logoutBtn);
    nav.appendChild(userWrap);
}

document.addEventListener("DOMContentLoaded", renderHeaderUser);