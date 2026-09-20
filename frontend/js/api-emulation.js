class LanguageAPI {
    constructor() {
        if (!localStorage.getItem('language_dictionaries')) {
            const defaultDict = {
                id: 1,
                name: 'Основной словарь',
                words: [
                    { id: 1, word: 'apple', translation: 'яблоко', example: 'I eat an apple every day' },
                    { id: 2, word: 'cat', translation: 'кот', example: 'My cat is black' },
                    { id: 3, word: 'dog', translation: 'собака', example: 'The dog is barking' },
                    { id: 4, word: 'house', translation: 'дом', example: 'My house is big' },
                    { id: 5, word: 'car', translation: 'машина', example: 'I drive a red car' }
                ]
            };
            localStorage.setItem('language_dictionaries', JSON.stringify([defaultDict]));
        }
    }

    async getDictionaries() {
        const dictionaries = JSON.parse(localStorage.getItem('language_dictionaries'));
        return { success: true, data: dictionaries };
    }

    async createDictionary(name) {
        const dictionaries = JSON.parse(localStorage.getItem('language_dictionaries'));
        const newId = dictionaries.length > 0 ? Math.max(...dictionaries.map(d => d.id)) + 1 : 1;
        const newDict = {
            id: newId,
            name: name,
            words: []
        };
        dictionaries.push(newDict);
        localStorage.setItem('language_dictionaries', JSON.stringify(dictionaries));
        return { success: true, data: newDict };
    }

    async renameDictionary(dictId, newName) {
        const dictionaries = JSON.parse(localStorage.getItem('language_dictionaries'));
        const dictIndex = dictionaries.findIndex(d => d.id === parseInt(dictId));
        if (dictIndex !== -1) {
            dictionaries[dictIndex].name = newName;
            localStorage.setItem('language_dictionaries', JSON.stringify(dictionaries));
            return { success: true };
        }
        return { success: false };
    }

    async deleteDictionary(dictId) {
        let dictionaries = JSON.parse(localStorage.getItem('language_dictionaries'));
        dictionaries = dictionaries.filter(d => d.id !== parseInt(dictId));
        
        if (dictionaries.length === 0) {
            const newDict = {
                id: 1,
                name: 'Основной словарь',
                words: []
            };
            dictionaries = [newDict];
        }
        
        localStorage.setItem('language_dictionaries', JSON.stringify(dictionaries));
        return { success: true };
    }

    async addWordToDict(dictId, wordData) {
        const dictionaries = JSON.parse(localStorage.getItem('language_dictionaries'));
        const dictIndex = dictionaries.findIndex(d => d.id === parseInt(dictId));
        
        if (dictIndex !== -1) {
            const words = dictionaries[dictIndex].words;
            const newId = words.length > 0 ? Math.max(...words.map(w => w.id)) + 1 : 1;
            const newWord = { id: newId, ...wordData };
            dictionaries[dictIndex].words.push(newWord);
            localStorage.setItem('language_dictionaries', JSON.stringify(dictionaries));
            return { success: true, data: newWord };
        }
        return { success: false };
    }

    async deleteWordFromDict(wordId, dictId) {
        const dictionaries = JSON.parse(localStorage.getItem('language_dictionaries'));
        const dictIndex = dictionaries.findIndex(d => d.id === parseInt(dictId));
        
        if (dictIndex !== -1) {
            dictionaries[dictIndex].words = dictionaries[dictIndex].words.filter(w => w.id !== parseInt(wordId));
            localStorage.setItem('language_dictionaries', JSON.stringify(dictionaries));
            return { success: true };
        }
        return { success: false };
    }

    async getWordsForTest(dictIds) {
        const dictionaries = JSON.parse(localStorage.getItem('language_dictionaries'));
        let allWords = [];
        
        for (const dictId of dictIds) {
            const dict = dictionaries.find(d => d.id === parseInt(dictId));
            if (dict) {
                allWords = allWords.concat(dict.words.map(w => ({ ...w, dictId: dict.id, dictName: dict.name })));
            }
        }
        
        return { success: true, data: allWords };
    }
}

window.api = new LanguageAPI();