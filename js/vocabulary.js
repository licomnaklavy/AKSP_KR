import { updateAchievements } from './achievements.js';

let currentSearch = '';
let selectedDicts = [];
let allDictionaries = [];

document.addEventListener('DOMContentLoaded', async () => {
    await loadDictionaries();
    await loadVocabulary();
    
    document.getElementById('addWordBtn').onclick = () => openAddModal();
    document.getElementById('testBtn').onclick = () => openTestSettings();
    document.getElementById('importBtn').onclick = () => openImportModal();
    document.getElementById('clearBtn').onclick = () => openClearConfirmModal();
    document.getElementById('searchBtn').onclick = () => {
        currentSearch = document.getElementById('searchInput').value.toLowerCase();
        loadVocabulary();
    };
    document.getElementById('searchInput').onkeyup = (e) => {
        if (e.key === 'Enter') {
            currentSearch = e.target.value.toLowerCase();
            loadVocabulary();
        }
    };
    document.getElementById('createDictBtn').onclick = () => openCreateDictModal();
    
    document.getElementById('closeModalBtn').onclick = () => closeModal();
    document.getElementById('saveWordBtn').onclick = saveWord;
    
    document.getElementById('closeTestSettingsBtn').onclick = () => closeTestSettingsModal();
    document.getElementById('startTestBtn').onclick = () => startTest();
    
    document.getElementById('testCountType').onchange = (e) => {
        const presetContainer = document.getElementById('presetCountContainer');
        const customContainer = document.getElementById('customCountContainer');
        if (e.target.value === 'preset') {
            presetContainer.style.display = 'block';
            customContainer.style.display = 'none';
        } else {
            presetContainer.style.display = 'none';
            customContainer.style.display = 'block';
        }
    };
    
    document.getElementById('closeCreateDictBtn').onclick = () => closeCreateDictModal();
    document.getElementById('cancelCreateDictBtn').onclick = () => closeCreateDictModal();
    document.getElementById('confirmCreateDictBtn').onclick = () => createDictionary();
    
    const createModal = document.getElementById('createDictModal');
    createModal.addEventListener('click', (e) => {
        if (e.target === createModal) closeCreateDictModal();
    });
    
    const importModal = document.getElementById('importModal');
    const closeImportBtn = document.getElementById('closeImportModalBtn');
    const cancelImportBtn = document.getElementById('cancelImportBtn');
    const confirmImportBtn = document.getElementById('confirmImportBtn');
    
    if (closeImportBtn) closeImportBtn.onclick = () => closeImportModal();
    if (cancelImportBtn) cancelImportBtn.onclick = () => closeImportModal();
    if (confirmImportBtn) confirmImportBtn.onclick = () => importWords();
    
    if (importModal) {
        importModal.addEventListener('click', (e) => {
            if (e.target === importModal) closeImportModal();
        });
    }
    
    const clearModal = document.getElementById('clearConfirmModal');
    const closeClearBtn = document.getElementById('closeClearModalBtn');
    const cancelClearBtn = document.getElementById('cancelClearBtn');
    const confirmClearBtn = document.getElementById('confirmClearBtn');
    
    if (closeClearBtn) closeClearBtn.onclick = () => closeClearConfirmModal();
    if (cancelClearBtn) cancelClearBtn.onclick = () => closeClearConfirmModal();
    if (confirmClearBtn) confirmClearBtn.onclick = () => clearAllWords();
    
    if (clearModal) {
        clearModal.addEventListener('click', (e) => {
            if (e.target === clearModal) closeClearConfirmModal();
        });
    }
    
    const wordModal = document.getElementById('wordModal');
    if (wordModal) {
        wordModal.addEventListener('click', (e) => {
            if (e.target === wordModal) closeModal();
        });
    }
    
    const testSettingsModal = document.getElementById('testSettingsModal');
    if (testSettingsModal) {
        testSettingsModal.addEventListener('click', (e) => {
            if (e.target === testSettingsModal) closeTestSettingsModal();
        });
    }
});

async function loadDictionaries() {
    const response = await api.getDictionaries();
    allDictionaries = response.data;
    
    const savedSelected = localStorage.getItem('language_selected_dicts');
    if (savedSelected) {
        selectedDicts = JSON.parse(savedSelected);
    } else {
        selectedDicts = allDictionaries.map(d => d.id);
        localStorage.setItem('language_selected_dicts', JSON.stringify(selectedDicts));
    }
    
    const dictsList = document.getElementById('dictsList');
    dictsList.innerHTML = allDictionaries.map(dict => `
        <label class="dict-item ${selectedDicts.includes(dict.id) ? 'selected' : ''}">
            <input type="checkbox" class="dict-checkbox-item" value="${dict.id}" 
                ${selectedDicts.includes(dict.id) ? 'checked' : ''}>
            <span class="dict-name">${escapeHtml(dict.name)}</span>
            <span class="dict-count">(${dict.words.length} слов)</span>
            <button class="dict-rename-btn" data-id="${dict.id}" data-name="${escapeHtml(dict.name)}">✏️</button>
            <button class="dict-delete-btn" data-id="${dict.id}">🗑</button>
        </label>
    `).join('');
    
    document.querySelectorAll('.dict-checkbox-item').forEach(cb => {
        cb.onchange = () => {
            const dictId = parseInt(cb.value);
            if (cb.checked) {
                if (!selectedDicts.includes(dictId)) {
                    selectedDicts.push(dictId);
                }
            } else {
                selectedDicts = selectedDicts.filter(id => id !== dictId);
            }
            localStorage.setItem('language_selected_dicts', JSON.stringify(selectedDicts));
            cb.closest('.dict-item').classList.toggle('selected', cb.checked);
            loadVocabulary();
        };
    });
    
    document.querySelectorAll('.dict-rename-btn').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const dictId = btn.dataset.id;
            const dictName = btn.dataset.name;
            openRenameDictModal(dictId, dictName);
        };
    });
    
    document.querySelectorAll('.dict-delete-btn').forEach(btn => {
        btn.onclick = async (e) => {
            e.stopPropagation();
            const dictId = parseInt(btn.dataset.id);
            if (confirm('Удалить этот словарь? Все слова из него будут потеряны.')) {
                await api.deleteDictionary(dictId);
                await loadDictionaries();
                await loadVocabulary();
                updateAchievements();
            }
        };
    });
    
    updateDictSelects();
}

function updateDictSelects() {
    const wordDictSelect = document.getElementById('wordDictSelect');
    if (wordDictSelect) {
        wordDictSelect.innerHTML = allDictionaries.map(dict => 
            `<option value="${dict.id}">${escapeHtml(dict.name)} (${dict.words.length} слов)</option>`
        ).join('');
    }
    
    const importDictSelect = document.getElementById('importDictSelect');
    if (importDictSelect) {
        importDictSelect.innerHTML = allDictionaries.map(dict => 
            `<option value="${dict.id}">${escapeHtml(dict.name)} (${dict.words.length} слов)</option>`
        ).join('');
    }
    
    const dictsForTest = document.getElementById('dictsForTest');
    if (dictsForTest) {
        dictsForTest.innerHTML = allDictionaries.map(dict => `
            <label class="dict-checkbox">
                <input type="checkbox" value="${dict.id}" ${dict.words.length > 0 ? 'checked' : 'disabled'}>
                <span>${escapeHtml(dict.name)}</span>
                <span class="dict-word-count">(${dict.words.length} слов)</span>
                ${dict.words.length === 0 ? '<span class="dict-empty-warning">(пусто)</span>' : ''}
            </label>
        `).join('');
    }
}

async function loadVocabulary() {
    if (selectedDicts.length === 0) {
        document.getElementById('wordsList').innerHTML = '<div class="empty-state">Не выбран ни один словарь. Выберите словари для отображения.</div>';
        return;
    }
    
    let wordsWithDict = [];
    
    for (const dictId of selectedDicts) {
        const dict = allDictionaries.find(d => d.id === dictId);
        if (dict) {
            for (const word of dict.words) {
                wordsWithDict.push({
                    ...word,
                    dictId: dict.id,
                    dictName: dict.name
                });
            }
        }
    }
    
    if (currentSearch) {
        wordsWithDict = wordsWithDict.filter(w => 
            w.word.toLowerCase().includes(currentSearch) || 
            w.translation.toLowerCase().includes(currentSearch)
        );
    }
    
    const container = document.getElementById('wordsList');
    if (wordsWithDict.length === 0) {
        container.innerHTML = '<div class="empty-state">Слова не найдены. Добавьте первое слово или импортируйте из файла</div>';
        return;
    }
    
    container.innerHTML = wordsWithDict.map(word => `
        <div class="word-item" data-id="${word.id}" data-dict="${word.dictId}">
            <div class="word-info">
                <div class="word-dict-badge">${escapeHtml(word.dictName)}</div>
                <h3>${escapeHtml(word.word)}</h3>
                <div class="word-translation">${escapeHtml(word.translation)}</div>
                ${word.example ? `<div class="word-example">"${escapeHtml(word.example)}"</div>` : ''}
            </div>
            <div class="word-actions">
                <button class="edit-btn" data-id="${word.id}" data-dict="${word.dictId}">Редактировать</button>
                <button class="delete-btn" data-id="${word.id}" data-dict="${word.dictId}">Удалить</button>
            </div>
        </div>
    `).join('');
    
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.onclick = () => openEditModal(btn.dataset.id, btn.dataset.dict);
    });
    
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.onclick = async () => {
            if (confirm('Удалить это слово?')) {
                await api.deleteWordFromDict(btn.dataset.id, btn.dataset.dict);
                await loadDictionaries();
                await loadVocabulary();
                updateAchievements();
            }
        };
    });
}

function openAddModal() {
    document.getElementById('modalTitle').textContent = 'Добавить слово';
    document.getElementById('wordInput').value = '';
    document.getElementById('translationInput').value = '';
    document.getElementById('exampleInput').value = '';
    document.getElementById('editWordId').value = '';
    document.getElementById('editDictId').value = '';
    
    if (allDictionaries.length > 0) {
        document.getElementById('wordDictSelect').value = allDictionaries[0].id;
    }
    
    openModal();
}

async function openEditModal(wordId, dictId) {
    const dict = allDictionaries.find(d => d.id === parseInt(dictId));
    const word = dict?.words.find(w => w.id === parseInt(wordId));
    
    if (word) {
        document.getElementById('modalTitle').textContent = 'Редактировать слово';
        document.getElementById('wordDictSelect').value = dictId;
        document.getElementById('wordInput').value = word.word;
        document.getElementById('translationInput').value = word.translation;
        document.getElementById('exampleInput').value = word.example || '';
        document.getElementById('editWordId').value = word.id;
        document.getElementById('editDictId').value = dictId;
        openModal();
    }
}

async function saveWord() {
    const dictId = document.getElementById('wordDictSelect').value;
    const word = document.getElementById('wordInput').value.trim();
    const translation = document.getElementById('translationInput').value.trim();
    const example = document.getElementById('exampleInput').value.trim();
    const editWordId = document.getElementById('editWordId').value;
    const editDictId = document.getElementById('editDictId').value;
    
    if (!word || !translation) {
        alert('Заполните слово и перевод');
        return;
    }
    
    if (editWordId && editDictId) {
        await api.deleteWordFromDict(editWordId, editDictId);
        await api.addWordToDict(dictId, { word, translation, example });
    } else {
        await api.addWordToDict(dictId, { word, translation, example });
    }
    
    closeModal();
    await loadDictionaries();
    await loadVocabulary();
    updateAchievements();
}

function openModal() {
    document.getElementById('wordModal').classList.add('active');
}

function closeModal() {
    document.getElementById('wordModal').classList.remove('active');
}

function openCreateDictModal() {
    document.getElementById('newDictName').value = '';
    document.getElementById('createDictModal').classList.add('active');
}

function closeCreateDictModal() {
    document.getElementById('createDictModal').classList.remove('active');
}

async function createDictionary() {
    const name = document.getElementById('newDictName').value.trim();
    if (!name) {
        alert('Введите название словаря');
        return;
    }
    await api.createDictionary(name);
    closeCreateDictModal();
    await loadDictionaries();
    await loadVocabulary();
    updateAchievements();
}

function openRenameDictModal(dictId, currentName) {
    const newName = prompt('Введите новое название:', currentName);
    if (newName && newName.trim()) {
        renameDictionary(dictId, newName.trim());
    }
}

async function renameDictionary(dictId, newName) {
    await api.renameDictionary(dictId, newName);
    await loadDictionaries();
    await loadVocabulary();
    updateAchievements();
}

async function openTestSettings() {
    if (allDictionaries.length === 0) {
        alert('Нет доступных словарей. Сначала создайте словарь.');
        return;
    }
    
    let hasWords = false;
    for (const dict of allDictionaries) {
        if (dict.words.length > 0) {
            hasWords = true;
            break;
        }
    }
    
    if (!hasWords) {
        alert('В словарях нет слов. Добавьте слова перед тестированием.');
        return;
    }
    
    updateDictSelects();
    document.getElementById('testSettingsModal').classList.add('active');
}

function closeTestSettingsModal() {
    document.getElementById('testSettingsModal').classList.remove('active');
}

function startTest() {
    const selectedTestDicts = Array.from(document.querySelectorAll('#dictsForTest input:checked'))
        .map(cb => cb.value);
    
    if (selectedTestDicts.length === 0) {
        alert('Выберите хотя бы один словарь для тестирования');
        return;
    }
    
    const questionMode = document.getElementById('questionMode').value;
    
    const countType = document.getElementById('testCountType').value;
    let questionsCount;
    
    let totalAvailableWords = 0;
    for (const dictId of selectedTestDicts) {
        const dict = allDictionaries.find(d => d.id == dictId);
        if (dict) totalAvailableWords += dict.words.length;
    }
    
    if (countType === 'preset') {
        const presetValue = document.getElementById('testCountPreset').value;
        if (presetValue === 'all') {
            questionsCount = totalAvailableWords;
        } else {
            questionsCount = parseInt(presetValue);
        }
    } else {
        const customValue = parseInt(document.getElementById('testCountCustom').value);
        if (isNaN(customValue) || customValue < 1) {
            alert('Введите корректное количество слов (от 1)');
            return;
        }
        questionsCount = customValue;
    }
    
    if (questionsCount > totalAvailableWords) {
        alert(`Вы выбрали ${questionsCount} слов, но в выбранных словарях только ${totalAvailableWords} слов. Уменьшите количество или выберите больше словарей.`);
        return;
    }
    
    const testMode = document.getElementById('testMode').value;
    
    closeTestSettingsModal();
    window.location.href = `test.html?count=${questionsCount}&mode=${testMode}&dicts=${selectedTestDicts.join(',')}&questionMode=${questionMode}`;
}

function openImportModal() {
    document.getElementById('importFile').value = '';
    document.getElementById('importText').value = '';
    document.getElementById('importModal').classList.add('active');
}

function closeImportModal() {
    document.getElementById('importModal').classList.remove('active');
}

async function importWords() {
    const dictId = document.getElementById('importDictSelect').value;
    const fileInput = document.getElementById('importFile');
    const textArea = document.getElementById('importText').value;
    let content = '';
    
    if (fileInput.files && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        try {
            content = await readFile(file);
        } catch (error) {
            alert('Ошибка при чтении файла: ' + error.message);
            return;
        }
    } else if (textArea.trim()) {
        content = textArea;
    } else {
        alert('Выберите файл или введите текст для импорта');
        return;
    }
    
    const words = parseImportContent(content);
    
    if (words.length === 0) {
        alert('Не найдено слов для импорта. Проверьте формат: слово|перевод|пример');
        return;
    }
    
    for (const wordData of words) {
        if (wordData.word && wordData.translation) {
            await api.addWordToDict(dictId, {
                word: wordData.word,
                translation: wordData.translation,
                example: wordData.example || ''
            });
        }
    }
    
    closeImportModal();
    await loadDictionaries();
    await loadVocabulary();
    updateAchievements();
}

function readFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e.target.error);
        reader.readAsText(file, 'UTF-8');
    });
}

function parseImportContent(content) {
    const lines = content.split(/\r?\n/);
    const words = [];
    
    for (let line of lines) {
        line = line.trim();
        if (line === '' || line.startsWith('#')) continue;
        
        const parts = line.split('|');
        
        if (parts.length >= 2) {
            words.push({
                word: parts[0].trim(),
                translation: parts[1].trim(),
                example: parts.length >= 3 ? parts[2].trim() : ''
            });
        }
    }
    
    return words;
}

function openClearConfirmModal() {
    document.getElementById('clearConfirmModal').classList.add('active');
}

function closeClearConfirmModal() {
    document.getElementById('clearConfirmModal').classList.remove('active');
}

async function clearAllWords() {
    for (const dictId of selectedDicts) {
        const dict = allDictionaries.find(d => d.id === dictId);
        if (dict) {
            for (const word of dict.words) {
                await api.deleteWordFromDict(word.id, dictId);
            }
        }
    }
    
    closeClearConfirmModal();
    await loadDictionaries();
    await loadVocabulary();
    updateAchievements();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}