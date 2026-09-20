let testWords = [];
let currentQuestionIndex = 0;
let userAnswers = [];
let testTotalQuestions = 0;
let waitingForNext = false;
let testMode = 'en2ru';
let questionMode = 'strict';
let selectedDictsIds = [];
let allWordsFromSelectedDicts = [];
let allWordsFromAllDicts = [];

const urlParams = new URLSearchParams(window.location.search);
const questionsCount = parseInt(urlParams.get('count'));
const modeParam = urlParams.get('mode');
const dictsParam = urlParams.get('dicts');
const questionModeParam = urlParams.get('questionMode');

document.addEventListener('DOMContentLoaded', async () => {
    if (modeParam === 'ru2en') {
        testMode = 'ru2en';
    } else {
        testMode = 'en2ru';
    }
    
    if (questionModeParam === 'selected_dicts') {
        questionMode = 'selected_dicts';
    } else if (questionModeParam === 'all_dicts') {
        questionMode = 'all_dicts';
    } else {
        questionMode = 'strict';
    }
    
    selectedDictsIds = dictsParam ? dictsParam.split(',').map(id => parseInt(id)) : [];
    
    await loadAllWords();
    await startTest();
});

async function loadAllWords() {
    const response = await api.getDictionaries();
    const allDictionaries = response.data;
    
    allWordsFromSelectedDicts = [];
    allWordsFromAllDicts = [];
    
    for (const dict of allDictionaries) {
        for (const word of dict.words) {
            const wordWithDict = { ...word, dictId: dict.id, dictName: dict.name };
            allWordsFromAllDicts.push(wordWithDict);
            
            if (selectedDictsIds.includes(dict.id)) {
                allWordsFromSelectedDicts.push(wordWithDict);
            }
        }
    }
}

async function startTest() {
    const sourceWordsForQuestions = [...allWordsFromSelectedDicts];
    
    if (sourceWordsForQuestions.length === 0) {
        document.getElementById('testContainer').innerHTML = `
            <div class="test-error">
                <h2>Нет слов для тестирования</h2>
                <p>В выбранных словарях нет слов.</p>
                <a href="vocabulary.html" class="btn btn-primary">Вернуться к словарю</a>
            </div>
        `;
        return;
    }
    
    let questionsToTake = questionsCount;
    if (isNaN(questionsToTake) || questionsToTake > sourceWordsForQuestions.length) {
        questionsToTake = Math.min(10, sourceWordsForQuestions.length);
    }
    
    const shuffled = [...sourceWordsForQuestions];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    testWords = shuffled.slice(0, questionsToTake);
    testTotalQuestions = testWords.length;
    currentQuestionIndex = 0;
    userAnswers = [];
    waitingForNext = false;
    
    renderQuestion();
}

function renderQuestion() {
    const container = document.getElementById('testContainer');
    
    if (currentQuestionIndex >= testTotalQuestions) {
        showResults();
        return;
    }
    
    const currentWord = testWords[currentQuestionIndex];
    let questionText = '';
    let correctAnswer = '';
    let options = [];
    
    if (testMode === 'en2ru') {
        questionText = currentWord.word;
        correctAnswer = currentWord.translation;
        options = getOptionsForEn2Ru(currentWord);
    } else {
        questionText = currentWord.translation;
        correctAnswer = currentWord.word;
        options = getOptionsForRu2En(currentWord);
    }
    
    container.innerHTML = `
        <div class="test-header">
            <div class="test-mode-badge">
                ${testMode === 'en2ru' ? 'Английский → Русский' : 'Русский → Английский'}
            </div>
            <div class="test-progress">
                Вопрос ${currentQuestionIndex + 1} из ${testTotalQuestions}
            </div>
            <button class="btn btn-outline" id="exitTestBtn">Завершить тест</button>
        </div>
        <div class="test-card">
            <div class="test-word">${escapeHtml(questionText)}</div>
            <div class="test-options" id="testOptions">
                ${options.map((opt, idx) => `
                    <div class="test-option" data-value="${escapeHtml(opt)}">
                        <input type="radio" name="answer" value="${escapeHtml(opt)}" id="opt_${idx}">
                        <label for="opt_${idx}">${escapeHtml(opt)}</label>
                    </div>
                `).join('')}
            </div>
            <div class="test-actions">
                <button class="btn btn-primary" id="submitAnswerBtn">Ответить</button>
            </div>
        </div>
    `;
    
    document.getElementById('exitTestBtn').onclick = () => confirmExit();
    document.getElementById('submitAnswerBtn').onclick = () => handleAnswer(correctAnswer, currentWord);
}

function getOptionsForEn2Ru(currentWord) {
    let poolWords = [];
    
    if (questionMode === 'strict') {
        poolWords = testWords.filter(w => w.id !== currentWord.id);
    } else if (questionMode === 'selected_dicts') {
        poolWords = allWordsFromSelectedDicts.filter(w => w.id !== currentWord.id);
    } else {
        poolWords = allWordsFromAllDicts.filter(w => w.id !== currentWord.id);
    }
    
    const translations = poolWords.map(w => w.translation);
    
    for (let i = translations.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [translations[i], translations[j]] = [translations[j], translations[i]];
    }
    
    const options = [currentWord.translation, ...translations.slice(0, 3)];
    
    for (let i = options.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [options[i], options[j]] = [options[j], options[i]];
    }
    
    return options;
}

function getOptionsForRu2En(currentWord) {
    let poolWords = [];
    
    if (questionMode === 'strict') {
        poolWords = testWords.filter(w => w.id !== currentWord.id);
    } else if (questionMode === 'selected_dicts') {
        poolWords = allWordsFromSelectedDicts.filter(w => w.id !== currentWord.id);
    } else {
        poolWords = allWordsFromAllDicts.filter(w => w.id !== currentWord.id);
    }
    
    const wordsList = poolWords.map(w => w.word);
    
    for (let i = wordsList.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [wordsList[i], wordsList[j]] = [wordsList[j], wordsList[i]];
    }
    
    const options = [currentWord.word, ...wordsList.slice(0, 3)];
    
    for (let i = options.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [options[i], options[j]] = [options[j], options[i]];
    }
    
    return options;
}

function handleAnswer(correctAnswer, currentWord) {
    if (waitingForNext) return;
    
    const selectedRadio = document.querySelector('input[name="answer"]:checked');
    
    if (!selectedRadio) {
        alert('Выберите вариант ответа');
        return;
    }
    
    const isCorrect = selectedRadio.value === correctAnswer;
    
    userAnswers.push({
        question: testMode === 'en2ru' ? currentWord.word : currentWord.translation,
        correctAnswer: correctAnswer,
        userAnswer: selectedRadio.value,
        isCorrect: isCorrect,
        mode: testMode
    });
    
    const options = document.querySelectorAll('.test-option');
    options.forEach(opt => {
        const radio = opt.querySelector('input');
        radio.disabled = true;
        
        const labelText = opt.querySelector('label').innerText;
        if (labelText === correctAnswer) {
            opt.classList.add('correct');
        }
        
        if (radio.checked && labelText !== correctAnswer) {
            opt.classList.add('wrong');
        }
    });
    
    const submitBtn = document.getElementById('submitAnswerBtn');
    submitBtn.textContent = 'Следующий вопрос →';
    waitingForNext = true;
    
    submitBtn.onclick = () => {
        currentQuestionIndex++;
        waitingForNext = false;
        renderQuestion();
    };
}

function showResults() {
    const container = document.getElementById('testContainer');
    const correctCount = userAnswers.filter(a => a.isCorrect).length;
    const answeredCount = userAnswers.length;
    const percentage = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0;
    
    let resultMessage = '';
    let resultClass = '';
    
    if (percentage === 100) {
        resultMessage = 'Отлично! Вы знаете все слова!';
        resultClass = 'perfect';
    } else if (percentage >= 80) {
        resultMessage = 'Хороший результат! Так держать!';
        resultClass = 'good';
    } else if (percentage >= 60) {
        resultMessage = 'Неплохо, но есть над чем поработать.';
        resultClass = 'normal';
    } else {
        resultMessage = 'Стоит повторить слова перед следующим тестом.';
        resultClass = 'bad';
    }
    
    const wrongAnswers = userAnswers.filter(a => !a.isCorrect);
    let mistakesHtml = '';
    if (wrongAnswers.length > 0) {
        mistakesHtml = `
            <div class="test-mistakes">
                <h3>Ошибки:</h3>
                <div class="mistakes-list">
                    ${wrongAnswers.map(a => `
                        <div class="mistake-item">
                            <span class="mistake-word">${escapeHtml(a.question)}</span>
                            <span class="mistake-correct">→ ${escapeHtml(a.correctAnswer)}</span>
                            <span class="mistake-wrong">(ваш ответ: ${escapeHtml(a.userAnswer)})</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    let completionMessage = '';
    if (answeredCount < testTotalQuestions) {
        completionMessage = `<p class="early-completion">Тест завершён досрочно. Отвечено на ${answeredCount} из ${testTotalQuestions} вопросов.</p>`;
    }
    
    container.innerHTML = `
        <div class="test-result ${resultClass}">
            <h2>Тестирование завершено!</h2>
            ${completionMessage}
            <div class="result-score">
                <span class="score-number">${correctCount}</span>
                <span class="score-total">/${answeredCount}</span>
                <div class="score-percent">(${percentage}%)</div>
            </div>
            <p class="result-message">${resultMessage}</p>
            ${mistakesHtml}
            <div class="result-actions">
                <a href="vocabulary.html" class="btn btn-outline">Вернуться к словарю</a>
                <button class="btn btn-primary" id="restartTestBtn">Пройти заново</button>
            </div>
        </div>
    `;
    
    document.getElementById('restartTestBtn').onclick = () => {
        startTest();
    };
}

function confirmExit() {
    if (userAnswers.length > 0) {
        if (confirm('Вы уверены, что хотите завершить тест досрочно? Будет показана статистика по отвеченным вопросам.')) {
            showResults();
        }
    } else {
        if (confirm('Вы уверены, что хотите завершить тест?')) {
            window.location.href = 'vocabulary.html';
        }
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}