import * as storage from './storage.js';
import * as groups from './groups.js';

let currentSort = { field: 'front', asc: true };
let selectedWords = new Set();
let searchQuery = '';

function renderWordsView() {
    const groupId = groups.getSelectedGroup();
    const welcomeBlock = document.querySelector('.welcome-block');
    const wordsView = document.querySelector('.words-view');
    const allGroups = storage.getAllGroups();
    
    if (allGroups.length === 0) {
        welcomeBlock.style.display = 'block';
        wordsView.style.display = 'none';
        return;
    }
    
    welcomeBlock.style.display = 'none';
    wordsView.style.display = 'block';
    
    if (!groupId) {
        document.getElementById('words-table-body').innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">Выберите группу</td></tr>';
        document.querySelector('.words-counter').textContent = '';
        return;
    }
    
    renderWordsList();
}

function renderWordsList() {
    const groupId = groups.getSelectedGroup();
    if (!groupId) return;
    
    let words = storage.getWordsByGroup(groupId);
    
    // Поиск
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        words = words.filter(w => 
            w.front.toLowerCase().includes(q) || 
            w.back.toLowerCase().includes(q)
        );
    }
    
    // Сортировка
    words.sort((a, b) => {
        let aVal = a[currentSort.field];
        let bVal = b[currentSort.field];
        if (typeof aVal === 'string') {
            aVal = aVal.toLowerCase();
            bVal = bVal.toLowerCase();
        }
        if (aVal < bVal) return currentSort.asc ? -1 : 1;
        if (aVal > bVal) return currentSort.asc ? 1 : -1;
        return 0;
    });
    
    const tbody = document.getElementById('words-table-body');
    tbody.innerHTML = '';
    
    if (words.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">Нет слов в этой группе</td></tr>';
        document.querySelector('.words-counter').textContent = '';
        return;
    }
    
    words.forEach(word => {
        const tr = document.createElement('tr');
        tr.dataset.wordId = word.id;
        
        // Чекбокс
        const tdCheck = document.createElement('td');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = selectedWords.has(word.id);
        checkbox.onchange = () => {
            if (checkbox.checked) {
                selectedWords.add(word.id);
            } else {
                selectedWords.delete(word.id);
            }
            updateBatchActions();
        };
        tdCheck.appendChild(checkbox);
        tr.appendChild(tdCheck);
        
        // Front
        const tdFront = document.createElement('td');
        tdFront.textContent = word.front;
        tdFront.className = 'editable';
        tdFront.onclick = () => editWordInline(word, 'front');
        tr.appendChild(tdFront);
        
        // Back
        const tdBack = document.createElement('td');
        tdBack.textContent = word.back;
        tdBack.className = 'editable';
        tdBack.onclick = () => editWordInline(word, 'back');
        tr.appendChild(tdBack);
        
        // Действия
        const tdActions = document.createElement('td');
        tdActions.className = 'word-actions';
        
        const editBtn = document.createElement('button');
        editBtn.textContent = '✏️';
        editBtn.className = 'btn-icon';
        editBtn.style.fontSize = '1rem';
        editBtn.style.width = '32px';
        editBtn.style.height = '32px';
        editBtn.onclick = () => showEditWordModal(word);
        
        const delBtn = document.createElement('button');
        delBtn.textContent = '🗑️';
        delBtn.className = 'btn-icon';
        delBtn.style.fontSize = '1rem';
        delBtn.style.width = '32px';
        delBtn.style.height = '32px';
        delBtn.style.background = 'var(--error)';
        delBtn.onclick = () => {
            if (confirm(`Удалить слово "${word.front}"?`)) {
                storage.deleteWord(word.id);
                selectedWords.delete(word.id);
                renderWordsList();
                groups.showToast('Слово удалено', 'success');
            }
        };
        
        tdActions.appendChild(editBtn);
        tdActions.appendChild(delBtn);
        tr.appendChild(tdActions);
        
        tbody.appendChild(tr);
    });
    
    // Счётчик
    const counter = document.querySelector('.words-counter');
    const total = storage.getWordsByGroup(groupId).length;
    counter.textContent = `Показано: ${words.length} из ${total}`;
    
    updateBatchActions();
}

function editWordInline(word, field) {
    const input = prompt(`Редактировать ${field === 'front' ? 'слово' : 'перевод'}:`, word[field]);
    if (input !== null && input.trim() !== word[field]) {
        storage.updateWord(word.id, { [field]: input.trim() });
        renderWordsList();
        groups.showToast('Слово обновлено', 'success');
    }
}

function showEditWordModal(word) {
    const modal = document.getElementById('modal-word');
    const overlay = document.getElementById('modal-overlay');
    const title = document.getElementById('modal-word-title');
    const frontInput = document.getElementById('input-front');
    const backInput = document.getElementById('input-back');
    const addMoreBtn = document.getElementById('btn-word-add-more');
    const saveBtn = document.getElementById('btn-word-save');
    
    title.textContent = 'Редактировать слово';
    frontInput.value = word.front;
    backInput.value = word.back;
    addMoreBtn.style.display = 'none';
    
    saveBtn.onclick = () => {
        if (frontInput.value.trim() && backInput.value.trim()) {
            storage.updateWord(word.id, {
                front: frontInput.value.trim(),
                back: backInput.value.trim()
            });
            closeModal();
            renderWordsList();
            groups.showToast('Слово обновлено', 'success');
        }
    };
    
    overlay.classList.add('active');
    modal.classList.add('active');
    frontInput.focus();
}

function showAddWordModal() {
    const groupId = groups.getSelectedGroup();
    if (!groupId) {
        groups.showToast('Сначала выберите группу', 'error');
        return;
    }
    
    const modal = document.getElementById('modal-word');
    const overlay = document.getElementById('modal-overlay');
    const title = document.getElementById('modal-word-title');
    const frontInput = document.getElementById('input-front');
    const backInput = document.getElementById('input-back');
    const addMoreBtn = document.getElementById('btn-word-add-more');
    const saveBtn = document.getElementById('btn-word-save');
    
    title.textContent = 'Добавить слово';
    frontInput.value = '';
    backInput.value = '';
    addMoreBtn.style.display = 'inline-block';
    
    function addWord(closeAfter = false) {
        if (frontInput.value.trim() && backInput.value.trim()) {
            storage.addWord(frontInput.value.trim(), backInput.value.trim(), groupId);
            renderWordsList();
            groups.showToast('Слово добавлено', 'success');
            
            if (closeAfter) {
                closeModal();
            } else {
                frontInput.value = '';
                backInput.value = '';
                frontInput.focus();
            }
        }
    }
    
    addMoreBtn.onclick = () => addWord(false);
    saveBtn.onclick = () => addWord(true);
    saveBtn.textContent = 'Сохранить и закрыть';
    
    // Enter в back = добавить ещё
    backInput.onkeydown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addWord(false);
        }
    };
    
    overlay.classList.add('active');
    modal.classList.add('active');
    frontInput.focus();
}

function closeModal() {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    document.getElementById('modal-overlay').classList.remove('active');
}

function updateBatchActions() {
    const panel = document.querySelector('.batch-actions');
    const selectAll = document.getElementById('select-all');
    
    if (selectedWords.size > 0) {
        panel.style.display = 'flex';
    } else {
        panel.style.display = 'none';
    }
    
    const groupId = groups.getSelectedGroup();
    const totalWords = groupId ? storage.getWordsByGroup(groupId).length : 0;
    selectAll.checked = totalWords > 0 && selectedWords.size === totalWords;
}

function handleSelectAll(checked) {
    const groupId = groups.getSelectedGroup();
    if (!groupId) return;
    
    const words = storage.getWordsByGroup(groupId);
    
    if (checked) {
        words.forEach(w => selectedWords.add(w.id));
    } else {
        selectedWords.clear();
    }
    
    renderWordsList();
}

function handleBatchMove() {
    if (selectedWords.size === 0) return;
    
    const targetGroups = groups.getGroupsForSelect();
    const currentGroupId = groups.getSelectedGroup();
    const options = targetGroups
        .filter(g => g.id !== currentGroupId)
        .map(g => `${g.id}. ${g.name}`)
        .join('\n');
    
    const targetId = prompt(`Переместить ${selectedWords.size} слов(а) в группу:\n${options}\n\nВведите ID:`);
    if (targetId && storage.getGroup(targetId)) {
        storage.moveWords([...selectedWords], targetId);
        selectedWords.clear();
        renderWordsList();
        groups.showToast('Слова перемещены', 'success');
    }
}

function handleBatchCopy() {
    if (selectedWords.size === 0) return;
    
    const targetGroups = groups.getGroupsForSelect();
    const options = targetGroups.map(g => `${g.id}. ${g.name}`).join('\n');
    
    const targetId = prompt(`Скопировать ${selectedWords.size} слов(а) в группу:\n${options}\n\nВведите ID:`);
    if (targetId && storage.getGroup(targetId)) {
        storage.copyWords([...selectedWords], targetId);
        groups.showToast('Слова скопированы', 'success');
    }
}

function handleBatchDelete() {
    if (selectedWords.size === 0) return;
    
    if (confirm(`Удалить ${selectedWords.size} слов(а)?`)) {
        storage.deleteWords([...selectedWords]);
        selectedWords.clear();
        renderWordsList();
        groups.showToast('Слова удалены', 'success');
    }
}

function handleSort(field) {
    if (currentSort.field === field) {
        currentSort.asc = !currentSort.asc;
    } else {
        currentSort.field = field;
        currentSort.asc = true;
    }
    renderWordsList();
}

function handleSearch(query) {
    searchQuery = query;
    renderWordsList();
}

function startDragWords() {
    if (selectedWords.size === 0) return;
    return [...selectedWords];
}

export {
    renderWordsView,
    renderWordsList,
    showAddWordModal,
    showEditWordModal,
    closeModal,
    updateBatchActions,
    handleSelectAll,
    handleBatchMove,
    handleBatchCopy,
    handleBatchDelete,
    handleSort,
    handleSearch,
    startDragWords,
    selectedWords
};
