let currentSearch = '';

const coursesData = [
    {
        id: 1,
        title: "Английский язык. Введение",
        description: "Изучите основы английского языка: алфавит, местоимения и базовую грамматику",
        level: "beginner",
        lessons: 1,
        image: "assets/images/english-course.jpg"
    },
    {
        id: 2,
        title: "Английский язык. Времена",
        description: "Изучите времена английского языка: Present, Past, Future",
        level: "intermediate",
        lessons: 2,
        image: "assets/images/english-course.jpg"
    }
];

document.addEventListener('DOMContentLoaded', () => {
    renderCourses();
    
    const needCheck = localStorage.getItem('language_check_achievements');
    if (needCheck === 'true') {
        localStorage.removeItem('language_check_achievements');
        import('./achievements.js').then(module => {
            module.updateAchievements();
        });
    }
    
    document.getElementById('searchBtn').onclick = () => {
        currentSearch = document.getElementById('searchInput').value.toLowerCase();
        renderCourses();
    };
    
    document.getElementById('searchInput').onkeyup = (e) => {
        if (e.key === 'Enter') {
            currentSearch = e.target.value.toLowerCase();
            renderCourses();
        }
    };
});

function getCourseProgress(courseId) {
    const completedLessons = JSON.parse(localStorage.getItem('language_completed_lessons') || '{}');
    const course = coursesData.find(c => c.id === courseId);
    if (!course) return 0;
    
    const completed = completedLessons[courseId] || [];
    return Math.round((completed.length / course.lessons) * 100);
}

function renderCourses() {
    let filteredCourses = [...coursesData];
    
    if (currentSearch) {
        filteredCourses = filteredCourses.filter(course => 
            course.title.toLowerCase().includes(currentSearch) || 
            course.description.toLowerCase().includes(currentSearch)
        );
    }
    
    const container = document.getElementById('coursesContainer');
    
    if (filteredCourses.length === 0) {
        container.innerHTML = '<div class="empty-state">Курсы не найдены</div>';
        return;
    }
    
    container.innerHTML = filteredCourses.map(course => {
        const progress = getCourseProgress(course.id);
        const lessonsText = getLessonsText(course.lessons);
        return `
            <div class="course-card" data-id="${course.id}">
                <div class="course-image" style="background-image: url('${course.image}')">
                    <span class="course-level ${course.level}">${getLevelText(course.level)}</span>
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
                            <span>${progress}%</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${progress}%"></div>
                        </div>
                    </div>
                    <button class="btn btn-primary btn-course" data-id="${course.id}">
                        Перейти к курсу
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    document.querySelectorAll('.btn-course, .course-card').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const card = el.closest('.course-card');
            if (card) {
                const courseId = card.dataset.id;
                window.location.href = `course-detail.html?id=${courseId}`;
            }
        });
    });
}

function getLessonsText(lessons) {
    if (lessons === 1) {
        return '1 урок';
    } else if (lessons >= 2 && lessons <= 4) {
        return `${lessons} урока`;
    } else {
        return `${lessons} уроков`;
    }
}

function getLevelText(level) {
    const levels = {
        beginner: 'Начинающий',
        intermediate: 'Средний',
        advanced: 'Продвинутый'
    };
    return levels[level] || level;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}