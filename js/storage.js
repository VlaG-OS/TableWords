// CRUD операции над localStorage
const STORAGE_KEY = 'wordmatcher_data';

function generateId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function loadData() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (!data) {
            return {
                groups: [],
                words: [],
                settings: {
                    pairsCount: 6,
                    timeLimit: 30,
                    showTimer: true
                }
            };
        }
        return JSON.parse(data);
    } catch (e) {
        console.error('Ошибка загрузки данных:', e);
        return { groups: [], words: [], settings: {} };
    }
}

function saveData(data) {
    try {
        const json = JSON.stringify(data);
        
        // Проверка квоты (~5MB)
        if (json.length > 4 * 1024 * 1024) {
            console.warn('Внимание: использовано >4MB localStorage');
        }
        
        localStorage.setItem(STORAGE_KEY, json);
        return true;
    } catch (e) {
        console.error('Ошибка сохранения:', e);
        return false;
    }
}

// Группы
function getAllGroups() {
    return loadData().groups;
}

function getGroup(id) {
    return getAllGroups().find(g => g.id === id);
}

function addGroup(name, parentId = null) {
    const data = loadData();
    const group = {
        id: generateId('g'),
        name,
        parentId,
        order: data.groups.filter(g => g.parentId === parentId).length,
        createdAt: new Date().toISOString()
    };
    data.groups.push(group);
    saveData(data);
    return group;
}

function updateGroup(id, updates) {
    const data = loadData();
    const index = data.groups.findIndex(g => g.id === id);
    if (index !== -1) {
        data.groups[index] = { ...data.groups[index], ...updates };
        saveData(data);
        return data.groups[index];
    }
    return null;
}

function deleteGroup(id) {
    const data = loadData();
    
    // Удалить группу и все её подгруппы
    const toDelete = [id];
    let i = 0;
    while (i < toDelete.length) {
        const children = data.groups.filter(g => g.parentId === toDelete[i]);
        toDelete.push(...children.map(c => c.id));
        i++;
    }
    
    data.groups = data.groups.filter(g => !toDelete.includes(g.id));
    data.words = data.words.filter(w => !toDelete.includes(w.groupId));
    
    saveData(data);
    return toDelete.length;
}

// Слова
function getAllWords() {
    return loadData().words;
}

function getWordsByGroup(groupId) {
    return getAllWords().filter(w => w.groupId === groupId);
}

function getWord(id) {
    return getAllWords().find(w => w.id === id);
}

function addWord(front, back, groupId) {
    const data = loadData();
    const word = {
        id: generateId('w'),
        front: front.trim(),
        back: back.trim(),
        groupId,
        createdAt: new Date().toISOString()
    };
    data.words.push(word);
    saveData(data);
    return word;
}

function updateWord(id, updates) {
    const data = loadData();
    const index = data.words.findIndex(w => w.id === id);
    if (index !== -1) {
        data.words[index] = { ...data.words[index], ...updates };
        saveData(data);
        return data.words[index];
    }
    return null;
}

function deleteWord(id) {
    const data = loadData();
    data.words = data.words.filter(w => w.id !== id);
    saveData(data);
}

function deleteWords(ids) {
    const data = loadData();
    data.words = data.words.filter(w => !ids.includes(w.id));
    saveData(data);
}

function moveWords(wordIds, targetGroupId) {
    const data = loadData();
    wordIds.forEach(id => {
        const word = data.words.find(w => w.id === id);
        if (word) word.groupId = targetGroupId;
    });
    saveData(data);
}

function copyWords(wordIds, targetGroupId) {
    const data = loadData();
    wordIds.forEach(id => {
        const word = data.words.find(w => w.id === id);
        if (word) {
            data.words.push({
                ...word,
                id: generateId('w'),
                groupId: targetGroupId,
                createdAt: new Date().toISOString()
            });
        }
    });
    saveData(data);
}

// Настройки
function getSettings() {
    return loadData().settings;
}

function updateSettings(updates) {
    const data = loadData();
    data.settings = { ...data.settings, ...updates };
    saveData(data);
}

// Экспорт/импорт
function exportData() {
    const data = loadData();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wordmatcher_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importData(jsonData) {
    try {
        const imported = JSON.parse(jsonData);
        const current = loadData();
        
        // Объединить данные, разрешить конфликты ID
        const existingIds = new Set([
            ...current.groups.map(g => g.id),
            ...current.words.map(w => w.id)
        ]);
        
        const idMap = new Map();
        
        // Импорт групп
        imported.groups?.forEach(group => {
            let newId = group.id;
            if (existingIds.has(newId)) {
                newId = generateId('g');
                idMap.set(group.id, newId);
            }
            current.groups.push({ ...group, id: newId });
        });
        
        // Импорт слов с обновлёнными groupId
        imported.words?.forEach(word => {
            let newId = word.id;
            if (existingIds.has(newId)) {
                newId = generateId('w');
            }
            const groupId = idMap.get(word.groupId) || word.groupId;
            current.words.push({ ...word, id: newId, groupId });
        });
        
        // Обновить настройки (не перезаписывать)
        if (imported.settings) {
            current.settings = { ...current.settings, ...imported.settings };
        }
        
        saveData(current);
        return { groups: imported.groups?.length || 0, words: imported.words?.length || 0 };
    } catch (e) {
        throw new Error('Неверный формат JSON');
    }
}

export {
    generateId,
    loadData,
    saveData,
    getAllGroups,
    getGroup,
    addGroup,
    updateGroup,
    deleteGroup,
    getAllWords,
    getWordsByGroup,
    getWord,
    addWord,
    updateWord,
    deleteWord,
    deleteWords,
    moveWords,
    copyWords,
    getSettings,
    updateSettings,
    exportData,
    importData
};
