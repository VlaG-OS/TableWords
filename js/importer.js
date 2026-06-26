import * as storage from './storage.js';
import * as groups from './groups.js';

function parseTxtFile(text) {
    const lines = text.split('\n');
    const result = {
        groupsWithWords: [], // [{ groupName, words: [{front, back}] }]
        orphanWords: []      // [{front, back}] без группы
    };
    
    let currentGroup = null;
    
    for (let line of lines) {
        line = line.trim();
        
        // Пропустить комментарии и пустые строки
        if (!line || line.startsWith('#')) continue;
        
        // Заголовок группы: [Название]
        if (line.startsWith('[') && line.endsWith(']')) {
            const groupName = line.slice(1, -1).trim();
            if (groupName) {
                currentGroup = { groupName, words: [] };
                result.groupsWithWords.push(currentGroup);
            }
            continue;
        }
        
        // Парсинг пары слово = перевод
        let front, back;
        
        // Разделитель = или \t
        if (line.includes('=')) {
            [front, back] = line.split('=').map(s => s.trim());
        } else if (line.includes('\t')) {
            [front, back] = line.split('\t').map(s => s.trim());
        } else {
            continue; // Неверный формат строки
        }
        
        if (front && back) {
            const word = { front, back };
            
            if (currentGroup) {
                currentGroup.words.push(word);
            } else {
                result.orphanWords.push(word);
            }
        }
    }
    
    return result;
}

function importFromParsed(parsed, targetGroupId = null, skipDuplicates = true) {
    let importedGroups = 0;
    let importedWords = 0;
    
    // Импорт групп с их словами
    for (const item of parsed.groupsWithWords) {
        // Проверить, существует ли группа с таким именем
        let groupId;
        const existing = storage.getAllGroups().find(g => g.name === item.groupName && !g.parentId);
        
        if (existing) {
            groupId = existing.id;
        } else {
            const newGroup = storage.addGroup(item.groupName, null);
            groupId = newGroup.id;
            importedGroups++;
        }
        
        // Добавить слова в эту группу
        const count = importWords(item.words, groupId, skipDuplicates);
        importedWords += count;
    }
    
    // Импорт слов без группы
    if (parsed.orphanWords.length > 0) {
        if (!targetGroupId) {
            // Создать группу с именем "Импортированные"
            const newGroup = storage.addGroup('Импортированные слова', null);
            targetGroupId = newGroup.id;
            importedGroups++;
        }
        
        const count = importWords(parsed.orphanWords, targetGroupId, skipDuplicates);
        importedWords += count;
    }
    
    return { importedGroups, importedWords };
}

function importWords(words, groupId, skipDuplicates) {
    const existing = storage.getWordsByGroup(groupId);
    let count = 0;
    
    for (const word of words) {
        // Проверка на дубликаты
        if (skipDuplicates) {
            const isDuplicate = existing.some(
                w => w.front.toLowerCase() === word.front.toLowerCase() && 
                     w.back.toLowerCase() === word.back.toLowerCase()
            );
            if (isDuplicate) continue;
        }
        
        storage.addWord(word.front, word.back, groupId);
        count++;
    }
    
    return count;
}

function showImportModal() {
    const modal = document.getElementById('modal-import');
    const overlay = document.getElementById('modal-overlay');
    
    // Сброс состояния
    document.getElementById('import-dropzone').style.display = 'block';
    document.getElementById('import-preview').style.display = 'none';
    document.getElementById('btn-do-import').style.display = 'none';
    
    overlay.classList.add('active');
    modal.classList.add('active');
}

function setupImportHandlers() {
    const dropzone = document.getElementById('import-dropzone');
    const fileInput = document.getElementById('import-file-input');
    const previewDiv = document.getElementById('import-preview');
    const previewText = document.getElementById('import-preview-text');
    const groupSelectDiv = document.getElementById('import-group-select');
    const groupSelect = document.getElementById('import-target-group');
    const importBtn = document.getElementById('btn-do-import');
    
    let parsedData = null;
    
    // Кнопка выбора файла
    dropzone.querySelector('button').onclick = () => fileInput.click();
    
    // Drag and drop
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('drag-over');
    });
    
    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('drag-over');
    });
    
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file && file.type === 'text/plain') {
            handleFile(file);
        }
    });
    
    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) handleFile(file);
    };
    
    function handleFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result;
            parsedData = parseTxtFile(text);
            showPreview(parsedData, file.name);
        };
        reader.readAsText(file);
    }
    
    function showPreview(data, filename) {
        dropzone.style.display = 'none';
        previewDiv.style.display = 'block';
        importBtn.style.display = 'inline-block';
        
        const totalWords = data.groupsWithWords.reduce((sum, g) => sum + g.words.length, 0) + data.orphanWords.length;
        const totalGroups = data.groupsWithWords.length;
        
        previewText.textContent = `Найдено: ${totalWords} слов${totalGroups > 0 ? `, ${totalGroups} групп` : ''}`;
        
        // Если есть слова без группы, показать выбор группы
        if (data.orphanWords.length > 0) {
            groupSelectDiv.style.display = 'block';
            
            // Заполнить список групп
            groupSelect.innerHTML = '';
            
            // Опция: создать новую группу
            const optNew = document.createElement('option');
            optNew.value = 'NEW';
            optNew.textContent = `Создать новую группу: "${filename.replace('.txt', '')}"`;
            groupSelect.appendChild(optNew);
            
            // Существующие группы
            const allGroups = groups.getGroupsForSelect();
            allGroups.forEach(g => {
                const opt = document.createElement('option');
                opt.value = g.id;
                opt.textContent = g.name;
                groupSelect.appendChild(opt);
            });
        } else {
            groupSelectDiv.style.display = 'none';
        }
    }
    
    importBtn.onclick = () => {
        if (!parsedData) return;
        
        const skipDuplicates = document.getElementById('import-skip-duplicates').checked;
        let targetGroupId = null;
        
        if (parsedData.orphanWords.length > 0) {
            const selected = groupSelect.value;
            if (selected === 'NEW') {
                const filename = fileInput.files[0]?.name.replace('.txt', '') || 'Импортированные';
                const newGroup = storage.addGroup(filename, null);
                targetGroupId = newGroup.id;
            } else {
                targetGroupId = selected;
            }
        }
        
        const result = importFromParsed(parsedData, targetGroupId, skipDuplicates);
        
        // Закрыть модал
        document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
        document.getElementById('modal-overlay').classList.remove('active');
        
        // Обновить интерфейс
        groups.renderGroupsTree();
        window.dispatchEvent(new CustomEvent('words-moved'));
        
        groups.showToast(`Импортировано ${result.importedWords} слов${result.importedGroups > 0 ? ` в ${result.importedGroups} групп(у)` : ''}`, 'success');
    };
}

export {
    parseTxtFile,
    importFromParsed,
    showImportModal,
    setupImportHandlers
};
