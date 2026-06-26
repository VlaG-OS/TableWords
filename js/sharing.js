// Модуль для шаринга групп через ссылку
import * as storage from './storage.js';

function encodePacket(groups) {
    // Создать компактный JSON пакет
    const packet = {
        v: 1,
        name: groups.length === 1 ? groups[0].name : `${groups.length} групп`,
        groups: groups.map(g => ({
            name: g.name,
            words: storage.getWordsByGroup(g.id).map(w => ({
                f: w.front,
                b: w.back
            }))
        }))
    };
    
    try {
        const jsonString = JSON.stringify(packet);
        const encoded = encodeURIComponent(jsonString);
        const base64 = btoa(encoded);
        return base64;
    } catch (e) {
        console.error('Ошибка кодирования пакета:', e);
        return null;
    }
}

function decodePacket(hash) {
    try {
        // Убрать #pack= если есть
        const base64 = hash.replace(/^#pack=/, '');
        const encoded = atob(base64);
        const jsonString = decodeURIComponent(encoded);
        const packet = JSON.parse(jsonString);
        
        // Проверить версию
        if (packet.v !== 1) {
            return { error: 'version', message: 'Этот пакет создан в новой версии Word Matcher. Обновите страницу или попробуйте позже.' };
        }
        
        // Валидация структуры
        if (!packet.groups || !Array.isArray(packet.groups)) {
            return { error: 'invalid', message: 'Невалидная структура пакета' };
        }
        
        return { success: true, packet };
    } catch (e) {
        console.error('Ошибка декодирования пакета:', e);
        return { error: 'decode', message: 'Не удалось открыть пакет слов — ссылка повреждена' };
    }
}

function importPacket(packet, skipDuplicates = true) {
    let importedGroups = 0;
    let importedWords = 0;
    
    for (const groupData of packet.groups) {
        // Проверить существование группы
        let groupId;
        const existing = storage.getAllGroups().find(g => g.name === groupData.name && !g.parentId);
        
        if (existing) {
            groupId = existing.id;
        } else {
            const newGroup = storage.addGroup(groupData.name, null);
            groupId = newGroup.id;
            importedGroups++;
        }
        
        // Импортировать слова
        const existingWords = storage.getWordsByGroup(groupId);
        
        for (const word of groupData.words) {
            if (skipDuplicates) {
                const isDuplicate = existingWords.some(
                    w => w.front.toLowerCase() === word.f.toLowerCase() && 
                         w.back.toLowerCase() === word.b.toLowerCase()
                );
                if (isDuplicate) continue;
            }
            
            storage.addWord(word.f, word.b, groupId);
            importedWords++;
        }
    }
    
    return { importedGroups, importedWords };
}

function countWordsInPacket(packet) {
    return packet.groups.reduce((sum, g) => sum + g.words.length, 0);
}

function generateShareLink(base64) {
    const baseUrl = window.location.href.split('#')[0];
    return `${baseUrl}#pack=${base64}`;
}

export {
    encodePacket,
    decodePacket,
    importPacket,
    countWordsInPacket,
    generateShareLink
};
