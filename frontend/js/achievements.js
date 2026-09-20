/**
 * achievements.js
 * Модуль для управления достижениями
 */

const achievementsList = [
    {
        id: 1,
        title: "Первые шаги",
        description: "Завершите первый урок",
        check: () => {
            const completedLessons = JSON.parse(localStorage.getItem('language_completed_lessons') || '{}');
            let totalLessons = 0;
            for (const courseId in completedLessons) {
                totalLessons += completedLessons[courseId].length;
            }
            return totalLessons >= 1;
        },
        getProgress: () => {
            const completedLessons = JSON.parse(localStorage.getItem('language_completed_lessons') || '{}');
            let totalLessons = 0;
            for (const courseId in completedLessons) {
                totalLessons += completedLessons[courseId].length;
            }
            return { current: Math.min(totalLessons, 1), total: 1 };
        }
    },
    {
        id: 2,
        title: "Любознательный",
        description: "Добавьте 50 слов в словари",
        check: () => {
            const dictionaries = JSON.parse(localStorage.getItem('language_dictionaries') || '[]');
            let totalWords = 0;
            for (const dict of dictionaries) {
                totalWords += dict.words.length;
            }
            return totalWords >= 50;
        },
        getProgress: () => {
            const dictionaries = JSON.parse(localStorage.getItem('language_dictionaries') || '[]');
            let totalWords = 0;
            for (const dict of dictionaries) {
                totalWords += dict.words.length;
            }
            return { current: Math.min(totalWords, 50), total: 50 };
        }
    },
    {
        id: 3,
        title: "Полиглот",
        description: "Создайте 2 словаря",
        check: () => {
            const dictionaries = JSON.parse(localStorage.getItem('language_dictionaries') || '[]');
            return dictionaries.length >= 2;
        },
        getProgress: () => {
            const dictionaries = JSON.parse(localStorage.getItem('language_dictionaries') || '[]');
            return { current: Math.min(dictionaries.length, 2), total: 2 };
        }
    }
];

export function getUnlockedAchievements() {
    return JSON.parse(localStorage.getItem('language_unlocked_achievements') || '[]');
}

function showAchievementNotification(achievement) {
    const notification = document.createElement('div');
    notification.className = 'achievement-notification';
    notification.innerHTML = `
        <div class="notification-content">
            <div class="notification-title">Достижение</div>
            <div class="notification-name">${achievement.title}</div>
            <div class="notification-desc">${achievement.description}</div>
        </div>
    `;
    
    notification.style.cssText = `
        position: fixed;
        bottom: 30px;
        right: 30px;
        background: var(--primary);
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 9999;
        animation: notificationSlideIn 0.3s ease;
        max-width: 300px;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'notificationSlideOut 0.2s ease forwards';
            setTimeout(() => notification.remove(), 200);
        }
    }, 2000);
}

export function updateAchievements() {
    const unlockedAchievements = getUnlockedAchievements();
    let updated = false;
    let newAchievements = [];
    
    for (const achievement of achievementsList) {
        if (!unlockedAchievements.includes(achievement.id) && achievement.check()) {
            unlockedAchievements.push(achievement.id);
            updated = true;
            newAchievements.push(achievement);
        }
    }
    
    if (updated) {
        localStorage.setItem('language_unlocked_achievements', JSON.stringify(unlockedAchievements));
        newAchievements.forEach(achievement => {
            showAchievementNotification(achievement);
        });
        window.dispatchEvent(new CustomEvent('achievements-updated'));
    }
    
    return unlockedAchievements;
}

export function getAchievementsStats() {
    const unlocked = getUnlockedAchievements();
    return {
        unlockedCount: unlocked.length,
        totalCount: achievementsList.length
    };
}

export function getAllAchievementsWithProgress() {
    const unlocked = getUnlockedAchievements();
    
    return achievementsList.map(achievement => {
        const isUnlocked = unlocked.includes(achievement.id);
        const progress = achievement.getProgress();
        
        return {
            id: achievement.id,
            title: achievement.title,
            description: achievement.description,
            isUnlocked: isUnlocked,
            progress: progress,
            progressPercent: (progress.current / progress.total) * 100
        };
    });
}

export function onAchievementsUpdate(callback) {
    window.addEventListener('achievements-updated', callback);
    return () => window.removeEventListener('achievements-updated', callback);
}