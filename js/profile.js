import { 
    getAllAchievementsWithProgress, 
    getAchievementsStats, 
    updateAchievements, 
    onAchievementsUpdate 
} from './achievements.js';

const coursesList = [
    { id: 1, title: "Английский язык. Введение", lessons: 1 },
    { id: 2, title: "Английский язык. Времена", lessons: 2 }
];

function getCompletedCoursesCount() {
    const completedLessons = JSON.parse(localStorage.getItem('language_completed_lessons') || '{}');
    let completedCourses = 0;
    
    for (const course of coursesList) {
        const courseCompleted = completedLessons[course.id] || [];
        if (courseCompleted.length === course.lessons) {
            completedCourses++;
        }
    }
    return completedCourses;
}

function getTotalLessonsCompleted() {
    const completedLessons = JSON.parse(localStorage.getItem('language_completed_lessons') || '{}');
    let totalLessons = 0;
    
    for (const courseId in completedLessons) {
        totalLessons += completedLessons[courseId].length;
    }
    return totalLessons;
}

function getVocabularyStats() {
    const dictionaries = JSON.parse(localStorage.getItem('language_dictionaries') || '[]');
    let totalWords = 0;
    let totalDictionaries = dictionaries.length;
    
    for (const dict of dictionaries) {
        totalWords += dict.words.length;
    }
    
    return { totalDictionaries, totalWords };
}

function loadProfileStats() {
    const completedCourses = getCompletedCoursesCount();
    const totalLessons = getTotalLessonsCompleted();
    const vocabStats = getVocabularyStats();
    const stats = getAchievementsStats();
    
    const statsContainer = document.getElementById('profileStats');
    if (statsContainer) {
        statsContainer.innerHTML = `
            <div class="stat-item">
                <span class="stat-value">${completedCourses}</span>
                <span class="stat-label">пройдено курсов</span>
            </div>
            <div class="stat-item">
                <span class="stat-value">${totalLessons}</span>
                <span class="stat-label">пройдено уроков</span>
            </div>
            <div class="stat-item">
                <span class="stat-value">${vocabStats.totalDictionaries}</span>
                <span class="stat-label">словарей</span>
            </div>
            <div class="stat-item">
                <span class="stat-value">${vocabStats.totalWords}</span>
                <span class="stat-label">всего слов</span>
            </div>
        `;
    }
    
    const subtitle = document.getElementById('profileSubtitle');
    if (subtitle) {
        subtitle.innerHTML = `Статистика обучения • ${stats.unlockedCount} из ${stats.totalCount} достижений`;
    }
}

function loadAchievements() {
    const container = document.getElementById('achievementsGrid');
    if (!container) return;
    
    const achievements = getAllAchievementsWithProgress();
    
    const achievementsHtml = achievements.map(achievement => {
        return `
            <div class="achievement-card ${!achievement.isUnlocked ? 'locked' : ''}">
                <div class="achievement-info">
                    <div class="achievement-title">${achievement.title}</div>
                    <div class="achievement-description">${achievement.description}</div>
                    ${!achievement.isUnlocked ? `
                        <div class="achievement-progress">
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${achievement.progressPercent}%"></div>
                            </div>
                            <span>${achievement.progress.current}/${achievement.progress.total}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = achievementsHtml;
}

function refreshUI() {
    updateAchievements();
    loadProfileStats();
    loadAchievements();
}

document.addEventListener('DOMContentLoaded', () => {
    refreshUI();
    
    onAchievementsUpdate(() => {
        loadProfileStats();
        loadAchievements();
    });
});

window.addEventListener('storage', (e) => {
    if (e.key === 'language_completed_lessons' || e.key === 'language_dictionaries') {
        refreshUI();
    }
});