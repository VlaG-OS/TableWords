// Word Matcher - объединённый JS файл
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
        return { groups: [], words: [], settings: { pairsCount: 6, timeLimit: 30, showTimer: true } };
    }
}

function saveData(data) {
    try {
        const json = JSON.stringify(data);
        const sizeInMB = (json.length / (1024 * 1024)).toFixed(2);
        const maxSizeMB = 5;
        const warningThreshold = maxSizeMB * 0.8; // 80% от 5MB = 4MB
        
        // Предупреждение при приближении к лимиту
        if (json.length > warningThreshold * 1024 * 1024) {
            console.warn(`Внимание: использовано ${sizeInMB}MB из ~${maxSizeMB}MB localStorage`);
            showToast(`⚠️ Хранилище заполнено на ${Math.round((json.length / (maxSizeMB * 1024 * 1024)) * 100)}%. Рекомендуем создать бэкап.`, 'warning');
        }
        
        localStorage.setItem(STORAGE_KEY, json);
        return true;
    } catch (e) {
        console.error('Ошибка сохранения:', e);
        
        // Обработка превышения квоты
        if (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014) {
            showToast('❌ КРИТИЧЕСКАЯ ОШИБКА: Превышен лимит хранилища! Данные НЕ сохранены. Срочно создайте бэкап (кнопка "💾 Бэкап") и удалите лишние группы.', 'error');
            
            // Показать повторное уведомление через 3 секунды
            setTimeout(() => {
                showToast('Данные в опасности! Нажмите "💾 Бэкап" прямо сейчас.', 'error');
            }, 3000);
            
            return false;
        }
        
        // Другие ошибки
        showToast('Ошибка сохранения данных. Проверьте консоль.', 'error');
        return false;
    }
}

// Storage API
const Storage = {
    getAllGroups() {
        return loadData().groups;
    },
    
    getGroup(id) {
        return this.getAllGroups().find(g => g.id === id);
    },
    
    addGroup(name, parentId = null) {
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
    },
    
    updateGroup(id, updates) {
        const data = loadData();
        const index = data.groups.findIndex(g => g.id === id);
        if (index !== -1) {
            data.groups[index] = { ...data.groups[index], ...updates };
            saveData(data);
            return data.groups[index];
        }
        return null;
    },
    
    deleteGroup(id) {
        const data = loadData();
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
    },
    
    getAllWords() {
        return loadData().words;
    },
    
    getWordsByGroup(groupId) {
        return this.getAllWords().filter(w => w.groupId === groupId);
    },
    
    getWord(id) {
        return this.getAllWords().find(w => w.id === id);
    },
    
    addWord(front, back, groupId) {
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
    },
    
    updateWord(id, updates) {
        const data = loadData();
        const index = data.words.findIndex(w => w.id === id);
        if (index !== -1) {
            data.words[index] = { ...data.words[index], ...updates };
            saveData(data);
            return data.words[index];
        }
        return null;
    },
    
    deleteWord(id) {
        const data = loadData();
        data.words = data.words.filter(w => w.id !== id);
        saveData(data);
    },
    
    deleteWords(ids) {
        const data = loadData();
        data.words = data.words.filter(w => !ids.includes(w.id));
        saveData(data);
    },
    
    moveWords(wordIds, targetGroupId) {
        const data = loadData();
        wordIds.forEach(id => {
            const word = data.words.find(w => w.id === id);
            if (word) word.groupId = targetGroupId;
        });
        saveData(data);
    },
    
    copyWords(wordIds, targetGroupId) {
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
    },
    
    getSettings() {
        return loadData().settings;
    },
    
    updateSettings(updates) {
        const data = loadData();
        data.settings = { ...data.settings, ...updates };
        saveData(data);
    },
    
    exportData() {
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
};

// Groups module
const Groups = {
    selectedGroupId: null,
    expandedGroups: new Set(),
    
    getSelectedGroup() {
        return this.selectedGroupId;
    },
    
    setSelectedGroup(id) {
        this.selectedGroupId = id;
    },
    
    renderGroupsTree() {
        const container = document.getElementById('groups-tree');
        const groups = Storage.getAllGroups();
        
        if (groups.length === 0) {
            container.innerHTML = '<div style="padding: 1rem; color: var(--text-muted); text-align: center;">Нет групп</div>';
            return;
        }
        
        container.innerHTML = '';
        const self = this;
        
        function countWordsRecursive(gid) {
            let count = Storage.getWordsByGroup(gid).length;
            const childs = groups.filter(g => g.parentId === gid);
            childs.forEach(c => count += countWordsRecursive(c.id));
            return count;
        }
        
        function renderGroup(group, level = 0) {
            const children = groups.filter(g => g.parentId === group.id);
            const hasChildren = children.length > 0;
            const isExpanded = self.expandedGroups.has(group.id);
            const isActive = self.selectedGroupId === group.id;
            const totalWords = countWordsRecursive(group.id);
            
            const item = document.createElement('div');
            item.className = `group-item ${isActive ? 'active' : ''}`;
            item.style.paddingLeft = `${level * 16 + 8}px`;
            item.dataset.groupId = group.id;
            
            const toggle = document.createElement('span');
            toggle.className = 'group-toggle';
            toggle.textContent = hasChildren ? (isExpanded ? '▼' : '▶') : '';
            toggle.onclick = (e) => {
                e.stopPropagation();
                if (hasChildren) {
                    if (isExpanded) {
                        self.expandedGroups.delete(group.id);
                    } else {
                        self.expandedGroups.add(group.id);
                    }
                    self.renderGroupsTree();
                }
            };
            
            const name = document.createElement('span');
            name.className = 'group-name';
            name.textContent = group.name;
            
            const count = document.createElement('span');
            count.className = 'group-count';
            count.textContent = totalWords;
            
            const menuBtn = document.createElement('button');
            menuBtn.className = 'group-menu-btn';
            menuBtn.textContent = '⋯';
            menuBtn.onclick = (e) => {
                e.stopPropagation();
                self.showContextMenu(e, group.id);
            };
            
            item.appendChild(toggle);
            item.appendChild(name);
            item.appendChild(count);
            item.appendChild(menuBtn);
            
            item.onclick = () => {
                self.selectedGroupId = group.id;
                self.renderGroupsTree();
                
                // Скрываем мобильную панель
                document.querySelector('.groups-panel').classList.remove('mobile-show');
                
                window.dispatchEvent(new CustomEvent('group-selected', { detail: group.id }));
            };
            
            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                item.classList.add('drag-over');
            });
            
            item.addEventListener('dragleave', () => {
                item.classList.remove('drag-over');
            });
            
            item.addEventListener('drop', (e) => {
                e.preventDefault();
                item.classList.remove('drag-over');
                try {
                    const wordIds = JSON.parse(e.dataTransfer.getData('text/plain'));
                    if (wordIds && wordIds.length > 0) {
                        Storage.moveWords(wordIds, group.id);
                        window.dispatchEvent(new CustomEvent('words-moved'));
                    }
                } catch(err) {}
            });
            
            container.appendChild(item);
            
            // SRS статистика под группой
            try {
                const stats = SRS.getStats(group.id);
                if (stats.total > 0) {
                    const statsEl = document.createElement('div');
                    statsEl.className = 'group-srs-stats';
                    
                    const parts = [];
                    if (stats.newCount > 0)  parts.push(`🔴 ${stats.newCount}`);
                    if (stats.learning > 0)  parts.push(`🟡 ${stats.learning}`);
                    if (stats.learned > 0)   parts.push(`🟢 ${stats.learned}`);
                    if (stats.due > 0) {
                        const dueBadge = document.createElement('span');
                        dueBadge.className = 'due-badge';
                        dueBadge.textContent = `📅 ${stats.due}`;
                        dueBadge.title = `${stats.due} слов к повтору`;
                        dueBadge.onclick = (e) => {
                            e.stopPropagation();
                            self.selectedGroupId = group.id;
                            self.renderGroupsTree();
                            window.dispatchEvent(new CustomEvent('group-selected', { detail: group.id }));
                            Game.showGameSettings(true);
                        };
                        statsEl.innerHTML = parts.join('  ');
                        statsEl.appendChild(dueBadge);
                        container.appendChild(statsEl);
                    } else {
                        statsEl.textContent = parts.join('  ');
                        container.appendChild(statsEl);
                    }
                    
                    // Progress bar
                    const barWrap = document.createElement('div');
                    barWrap.className = 'group-srs-bar-wrap';
                    const bar = document.createElement('div');
                    bar.className = 'group-srs-bar';
                    const fill = document.createElement('div');
                    fill.className = 'group-srs-bar-fill';
                    fill.style.width = stats.percent + '%';
                    bar.appendChild(fill);
                    barWrap.appendChild(bar);
                    barWrap.insertAdjacentHTML('beforeend', `<span>${stats.percent}%</span>`);
                    container.appendChild(barWrap);
                }
            } catch(e) {}
            
            if (hasChildren && isExpanded) {
                children
                    .sort((a, b) => a.order - b.order)
                    .forEach(child => renderGroup(child, level + 1));
            }
        }
        
        groups
            .filter(g => g.parentId === null)
            .sort((a, b) => a.order - b.order)
            .forEach(g => renderGroup(g, 0));
    },
    
    showContextMenu(event, groupId) {
        const menu = document.getElementById('context-menu');
        menu.style.display = 'block';
        menu.style.left = event.pageX + 'px';
        menu.style.top = event.pageY + 'px';
        menu.dataset.groupId = groupId;
        
        setTimeout(() => {
            document.addEventListener('click', function closeMenu() {
                menu.style.display = 'none';
                document.removeEventListener('click', closeMenu);
            });
        }, 0);
    },
    
    handleContextMenuAction(action, groupId) {
        const group = Storage.getGroup(groupId);
        if (!group) return;
        
        switch (action) {
            case 'rename':
                const newName = prompt('Новое имя группы:', group.name);
                if (newName && newName.trim()) {
                    Storage.updateGroup(groupId, { name: newName.trim() });
                    this.renderGroupsTree();
                    showToast('Группа переименована', 'success');
                }
                break;
                
            case 'add-subgroup':
                const subName = prompt('Имя подгруппы:');
                if (subName && subName.trim()) {
                    Storage.addGroup(subName.trim(), groupId);
                    this.expandedGroups.add(groupId);
                    this.renderGroupsTree();
                    showToast('Подгруппа создана', 'success');
                }
                break;
                
            case 'share':
                Sharing.showShareModal(groupId);
                break;
                
            case 'move-words':
                const targetGroups = this.getGroupsForSelect(groupId);
                if (targetGroups.length === 0) {
                    showToast('Нет других групп для перемещения', 'error');
                    return;
                }
                
                const targetId = prompt(`Переместить все слова из "${group.name}" в:\n\n${targetGroups.map((g, i) => `${i+1}. ${g.name}`).join('\n')}\n\nВведите номер:`);
                if (targetId && !isNaN(targetId)) {
                    const idx = parseInt(targetId) - 1;
                    if (idx >= 0 && idx < targetGroups.length) {
                        const words = Storage.getWordsByGroup(groupId);
                        Storage.moveWords(words.map(w => w.id), targetGroups[idx].id);
                        window.dispatchEvent(new CustomEvent('words-moved'));
                        showToast(`Перемещено ${words.length} слов`, 'success');
                    }
                }
                break;
                
            case 'merge':
                const mergeGroups = this.getGroupsForSelect(groupId);
                if (mergeGroups.length === 0) {
                    showToast('Нет других групп для слияния', 'error');
                    return;
                }
                
                const mergeId = prompt(`Слить "${group.name}" с:\n\n${mergeGroups.map((g, i) => `${i+1}. ${g.name}`).join('\n')}\n\nВведите номер:`);
                if (mergeId && !isNaN(mergeId)) {
                    const idx = parseInt(mergeId) - 1;
                    if (idx >= 0 && idx < mergeGroups.length) {
                        const targetGroup = mergeGroups[idx];
                        const words = Storage.getWordsByGroup(groupId);
                        Storage.moveWords(words.map(w => w.id), targetGroup.id);
                        Storage.deleteGroup(groupId);
                        if (this.selectedGroupId === groupId) {
                            this.selectedGroupId = targetGroup.id;
                        }
                        this.renderGroupsTree();
                        window.dispatchEvent(new CustomEvent('words-moved'));
                        showToast(`Группы объединены (${words.length} слов)`, 'success');
                    }
                }
                break;
                
            case 'split':
                showToast('Функция "Разделить" в разработке', 'error');
                break;
                
            case 'delete':
                const words = Storage.getWordsByGroup(groupId);
                const allGroups = Storage.getAllGroups();
                const children = allGroups.filter(g => g.parentId === groupId);
                
                let msg = `Удалить группу "${group.name}"?`;
                if (words.length > 0) msg += `\n(${words.length} слов)`;
                if (children.length > 0) msg += `\n(${children.length} подгрупп)`;
                
                if (confirm(msg)) {
                    Storage.deleteGroup(groupId);
                    if (this.selectedGroupId === groupId) {
                        this.selectedGroupId = null;
                    }
                    this.renderGroupsTree();
                    window.dispatchEvent(new CustomEvent('group-selected', { detail: null }));
                    showToast('Группа удалена', 'success');
                }
                break;
        }
    },
    
    getGroupsForSelect(excludeId = null) {
        const groups = Storage.getAllGroups();
        const result = [];
        
        function addGroup(group, level = 0) {
            if (group.id !== excludeId) {
                result.push({
                    id: group.id,
                    name: '  '.repeat(level) + group.name,
                    level
                });
                const children = groups.filter(g => g.parentId === group.id);
                children.forEach(c => addGroup(c, level + 1));
            }
        }
        
        groups
            .filter(g => g.parentId === null)
            .forEach(g => addGroup(g));
        
        return result;
    },
    
    getAllChildGroups(groupId) {
        const groups = Storage.getAllGroups();
        const result = [groupId];
        let i = 0;
        while (i < result.length) {
            const children = groups.filter(g => g.parentId === result[i]);
            result.push(...children.map(c => c.id));
            i++;
        }
        return result;
    }
};

// Words module
const Words = {
    currentSort: { field: 'front', asc: true },
    selectedWords: new Set(),
    searchQuery: '',
    
    renderWordsView() {
        const groupId = Groups.getSelectedGroup();
        const welcomeBlock = document.querySelector('.welcome-block');
        const wordsView = document.querySelector('.words-view');
        const allGroups = Storage.getAllGroups();
        if (allGroups.length === 0) {
            welcomeBlock.style.display = 'block';
            wordsView.style.display = 'none';
            document.getElementById('menu-share-group').style.display = 'none';
            return;
        }
        
        welcomeBlock.style.display = 'none';
        wordsView.style.display = 'block';
        
        // Обновляем colspan для пустой таблицы
        if (!groupId) {
            document.getElementById('words-table-body').innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">Выберите группу</td></tr>';
            document.querySelector('.words-counter').textContent = '';
            document.getElementById('menu-share-group').style.display = 'none';
            return;
        }
        
        document.getElementById('menu-share-group').style.display = 'flex';
        this.renderWordsList();
    },
    
    renderWordsList() {
        const groupId = Groups.getSelectedGroup();
        if (!groupId) return;
        
        let words = Storage.getWordsByGroup(groupId);
        
        if (this.searchQuery) {
            const q = this.searchQuery.toLowerCase();
            words = words.filter(w => 
                w.front.toLowerCase().includes(q) || 
                w.back.toLowerCase().includes(q)
            );
        }
        
        words.sort((a, b) => {
            let aVal = a[this.currentSort.field];
            let bVal = b[this.currentSort.field];
            if (typeof aVal === 'string') {
                aVal = aVal.toLowerCase();
                bVal = bVal.toLowerCase();
            }
            if (aVal < bVal) return this.currentSort.asc ? -1 : 1;
            if (aVal > bVal) return this.currentSort.asc ? 1 : -1;
            return 0;
        });
        
        const tbody = document.getElementById('words-table-body');
        tbody.innerHTML = '';
        
        if (words.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">Нет слов в этой группе</td></tr>';
            document.querySelector('.words-counter').textContent = '';
            return;
        }
        
        const self = this;
        
        words.forEach(word => {
            const tr = document.createElement('tr');
            tr.dataset.wordId = word.id;
            
            const tdCheck = document.createElement('td');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = self.selectedWords.has(word.id);
            checkbox.onchange = () => {
                if (checkbox.checked) {
                    self.selectedWords.add(word.id);
                } else {
                    self.selectedWords.delete(word.id);
                }
                self.updateBatchActions();
            };
            tdCheck.appendChild(checkbox);
            tr.appendChild(tdCheck);
            
            // SRS статус слова
            const tdStatus = document.createElement('td');
            tdStatus.className = 'col-status';
            try {
                const st = SRS.getWordStatus(word.id);
                const statusIcon = document.createElement('span');
                statusIcon.className = 'word-status-icon';
                statusIcon.textContent = st.icon;
                statusIcon.title = st.tooltip;
                tdStatus.appendChild(statusIcon);
            } catch(e) {
                tdStatus.textContent = '🔴';
            }
            tr.appendChild(tdStatus);
            
            const tdFront = document.createElement('td');
            tdFront.textContent = word.front;
            tdFront.className = 'editable';
            tdFront.onclick = () => self.editWordInline(word, 'front');
            tr.appendChild(tdFront);
            
            const tdBack = document.createElement('td');
            tdBack.textContent = word.back;
            tdBack.className = 'editable';
            tdBack.onclick = () => self.editWordInline(word, 'back');
            tr.appendChild(tdBack);
            
            const tdActions = document.createElement('td');
            tdActions.className = 'word-actions';
            
            const editBtn = document.createElement('button');
            editBtn.textContent = '✏️';
            editBtn.className = 'btn-icon';
            editBtn.style.fontSize = '1rem';
            editBtn.style.width = '32px';
            editBtn.style.height = '32px';
            editBtn.onclick = () => self.showEditWordModal(word);
            
            const delBtn = document.createElement('button');
            delBtn.textContent = '🗑️';
            delBtn.className = 'btn-icon';
            delBtn.style.fontSize = '1rem';
            delBtn.style.width = '32px';
            delBtn.style.height = '32px';
            delBtn.style.background = 'var(--error)';
            delBtn.onclick = () => {
                if (confirm(`Удалить слово "${word.front}"?`)) {
                    Storage.deleteWord(word.id);
                    self.selectedWords.delete(word.id);
                    self.renderWordsList();
                    showToast('Слово удалено', 'success');
                }
            };
            
            tdActions.appendChild(editBtn);
            tdActions.appendChild(delBtn);
            tr.appendChild(tdActions);
            
            tbody.appendChild(tr);
        });
        
        const counter = document.querySelector('.words-counter');
        const total = Storage.getWordsByGroup(groupId).length;
        counter.textContent = `Показано: ${words.length} из ${total}`;
        
        this.updateBatchActions();
    },
    
    editWordInline(word, field) {
        // Открыть модальное окно вместо prompt для редактирования обоих полей
        this.showEditWordModal(word);
    },
    
    showEditWordModal(word) {
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
        
        const self = this;
        saveBtn.onclick = () => {
            if (frontInput.value.trim() && backInput.value.trim()) {
                Storage.updateWord(word.id, {
                    front: frontInput.value.trim(),
                    back: backInput.value.trim()
                });
                closeModal();
                self.renderWordsList();
                showToast('Слово обновлено', 'success');
            }
        };
        
        overlay.classList.add('active');
        modal.classList.add('active');
        frontInput.focus();
    },
    
    showAddWordModal() {
        const groupId = Groups.getSelectedGroup();
        if (!groupId) {
            showToast('Сначала выберите группу', 'error');
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
        
        const self = this;
        
        function addWord(closeAfter = false) {
            if (frontInput.value.trim() && backInput.value.trim()) {
                Storage.addWord(frontInput.value.trim(), backInput.value.trim(), groupId);
                self.renderWordsList();
                showToast('Слово добавлено', 'success');
                
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
        
        backInput.onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addWord(false);
            }
        };
        
        overlay.classList.add('active');
        modal.classList.add('active');
        frontInput.focus();
    },
    
    updateBatchActions() {
        const panel = document.querySelector('.batch-actions');
        const selectAll = document.getElementById('select-all');
        
        if (this.selectedWords.size > 0) {
            panel.style.display = 'flex';
        } else {
            panel.style.display = 'none';
        }
        
        const groupId = Groups.getSelectedGroup();
        const totalWords = groupId ? Storage.getWordsByGroup(groupId).length : 0;
        selectAll.checked = totalWords > 0 && this.selectedWords.size === totalWords;
    },
    
    handleSelectAll(checked) {
        const groupId = Groups.getSelectedGroup();
        if (!groupId) return;
        
        const words = Storage.getWordsByGroup(groupId);
        
        if (checked) {
            words.forEach(w => this.selectedWords.add(w.id));
        } else {
            this.selectedWords.clear();
        }
        
        this.renderWordsList();
    },
    
    handleBatchMove() {
        if (this.selectedWords.size === 0) return;
        
        const targetGroups = Groups.getGroupsForSelect();
        const currentGroupId = Groups.getSelectedGroup();
        const filtered = targetGroups.filter(g => g.id !== currentGroupId);
        
        if (filtered.length === 0) {
            showToast('Нет других групп для перемещения', 'error');
            return;
        }
        
        const options = filtered.map((g, i) => `${i+1}. ${g.name}`).join('\n');
        const answer = prompt(`Переместить ${this.selectedWords.size} слов(а) в группу:\n\n${options}\n\nВведите номер:`);
        
        if (answer && !isNaN(answer)) {
            const idx = parseInt(answer) - 1;
            if (idx >= 0 && idx < filtered.length) {
                Storage.moveWords([...this.selectedWords], filtered[idx].id);
                this.selectedWords.clear();
                this.renderWordsList();
                showToast('Слова перемещены', 'success');
            } else {
                showToast('Неверный номер', 'error');
            }
        }
    },
    
    handleBatchCopy() {
        if (this.selectedWords.size === 0) return;
        
        const targetGroups = Groups.getGroupsForSelect();
        const options = targetGroups.map((g, i) => `${i+1}. ${g.name}`).join('\n');
        
        const answer = prompt(`Скопировать ${this.selectedWords.size} слов(а) в группу:\n\n${options}\n\nВведите номер:`);
        
        if (answer && !isNaN(answer)) {
            const idx = parseInt(answer) - 1;
            if (idx >= 0 && idx < targetGroups.length) {
                Storage.copyWords([...this.selectedWords], targetGroups[idx].id);
                showToast('Слова скопированы', 'success');
            } else {
                showToast('Неверный номер', 'error');
            }
        }
    },
    
    handleBatchDelete() {
        if (this.selectedWords.size === 0) return;
        
        if (confirm(`Удалить ${this.selectedWords.size} слов(а)?`)) {
            Storage.deleteWords([...this.selectedWords]);
            this.selectedWords.clear();
            this.renderWordsList();
            showToast('Слова удалены', 'success');
        }
    },
    
    handleSort(field) {
        if (this.currentSort.field === field) {
            this.currentSort.asc = !this.currentSort.asc;
        } else {
            this.currentSort.field = field;
            this.currentSort.asc = true;
        }
        this.renderWordsList();
    },
    
    handleSearch(query) {
        this.searchQuery = query;
        this.renderWordsList();
    }
};

// Sharing module
const Sharing = {
    encodePacket(groups) {
        const packet = {
            v: 1,
            name: groups.length === 1 ? groups[0].name : `${groups.length} групп`,
            groups: groups.map(g => ({
                name: g.name,
                words: Storage.getWordsByGroup(g.id).map(w => ({
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
    },
    
    decodePacket(hash) {
        try {
            console.log('Начало декодирования, hash длина:', hash.length);
            const base64 = hash.replace(/^#pack=/, '');
            console.log('Base64 длина:', base64.length);
            
            const encoded = atob(base64);
            console.log('После atob, encoded длина:', encoded.length);
            
            const jsonString = decodeURIComponent(encoded);
            console.log('После decodeURIComponent, json длина:', jsonString.length);
            console.log('JSON preview:', jsonString.substring(0, 100));
            
            const packet = JSON.parse(jsonString);
            console.log('Пакет декодирован успешно:', packet);
            
            if (packet.v !== 1) {
                return { error: 'version', message: 'Этот пакет создан в новой версии Word Matcher. Обновите страницу или попробуйте позже.' };
            }
            
            if (!packet.groups || !Array.isArray(packet.groups)) {
                return { error: 'invalid', message: 'Невалидная структура пакета' };
            }
            
            return { success: true, packet };
        } catch (e) {
            console.error('Ошибка декодирования пакета:', e);
            return { error: 'decode', message: 'Не удалось открыть пакет слов — ссылка повреждена' };
        }
    },
    
    importPacket(packet, skipDuplicates = true) {
        let importedGroups = 0;
        let importedWords = 0;
        
        for (const groupData of packet.groups) {
            let groupId;
            const existing = Storage.getAllGroups().find(g => g.name === groupData.name && !g.parentId);
            
            if (existing) {
                groupId = existing.id;
            } else {
                const newGroup = Storage.addGroup(groupData.name, null);
                groupId = newGroup.id;
                importedGroups++;
            }
            
            const existingWords = Storage.getWordsByGroup(groupId);
            
            for (const word of groupData.words) {
                if (skipDuplicates) {
                    const isDuplicate = existingWords.some(
                        w => w.front.toLowerCase() === word.f.toLowerCase() && 
                             w.back.toLowerCase() === word.b.toLowerCase()
                    );
                    if (isDuplicate) continue;
                }
                
                Storage.addWord(word.f, word.b, groupId);
                importedWords++;
            }
        }
        
        return { importedGroups, importedWords };
    },
    
    countWordsInPacket(packet) {
        return packet.groups.reduce((sum, g) => sum + g.words.length, 0);
    },
    
    generateShareLink(base64) {
        const baseUrl = window.location.href.split('#')[0];
        return `${baseUrl}#pack=${base64}`;
    },
    
    showShareModal(groupId) {
        const group = Storage.getGroup(groupId);
        if (!group) return;
        
        const modal = document.getElementById('modal-share');
        const overlay = document.getElementById('modal-overlay');
        const title = document.getElementById('share-title');
        const includeSubgroups = document.getElementById('share-include-subgroups');
        const statsDiv = document.getElementById('share-stats');
        const linksContainer = document.getElementById('share-links-container');
        const warningDiv = document.getElementById('share-warning');
        
        title.textContent = `Поделиться группой "${group.name}"`;
        includeSubgroups.checked = true;
        
        const self = this;
        const WORDS_PER_CHUNK = 50;
        
        function updateLink() {
            const groupsToShare = includeSubgroups.checked 
                ? Groups.getAllChildGroups(groupId).map(id => Storage.getGroup(id))
                : [group];
            
            const totalWords = groupsToShare.reduce((sum, g) => 
                sum + Storage.getWordsByGroup(g.id).length, 0
            );
            
            statsDiv.textContent = includeSubgroups.checked && groupsToShare.length > 1
                ? `(найдено ${totalWords} слов в ${groupsToShare.length} группах)`
                : `(${totalWords} слов)`;
            
            linksContainer.innerHTML = '';
            
            if (totalWords > WORDS_PER_CHUNK) {
                const chunks = self.createChunkedPackets(groupsToShare, WORDS_PER_CHUNK);
                
                chunks.forEach((chunk, i) => {
                    const link = self.generateShareLink(chunk.base64);
                    const linkItem = document.createElement('div');
                    linkItem.className = 'share-link-item';
                    
                    // Безопасное создание структуры
                    const header = document.createElement('div');
                    header.className = 'share-link-item-header';
                    
                    const title = document.createElement('span');
                    title.className = 'share-link-item-title';
                    title.textContent = `Часть ${i+1}/${chunks.length} (${chunk.wordsCount} слов)`;
                    
                    const btn = document.createElement('button');
                    btn.className = 'btn-primary btn-copy-chunk';
                    btn.setAttribute('data-link', link);
                    btn.textContent = '📋 Скопировать';
                    
                    header.appendChild(title);
                    header.appendChild(btn);
                    
                    const input = document.createElement('input');
                    input.type = 'text';
                    input.className = 'share-link-item-input';
                    input.value = link;
                    input.readOnly = true;
                    
                    linkItem.appendChild(header);
                    linkItem.appendChild(input);
                    
                    linksContainer.appendChild(linkItem);
                });
                
                // Добавить обработчики на кнопки копирования
                linksContainer.querySelectorAll('.btn-copy-chunk').forEach(btn => {
                    btn.onclick = () => {
                        const link = btn.getAttribute('data-link');
                        navigator.clipboard.writeText(link).then(() => {
                            const originalText = btn.textContent;
                            btn.textContent = '✓ Скопировано!';
                            setTimeout(() => {
                                btn.textContent = originalText;
                            }, 2000);
                        });
                    };
                });
                
                // Клик на input выделяет текст
                linksContainer.querySelectorAll('.share-link-item-input').forEach(input => {
                    input.onclick = () => input.select();
                });
                
                warningDiv.textContent = '';
                const warningText = document.createTextNode('⚠️ ');
                warningDiv.appendChild(warningText);
                
                const strongEl = document.createElement('strong');
                strongEl.textContent = 'Большая группа!';
                warningDiv.appendChild(strongEl);
                
                const descText = document.createTextNode(` Создано ${chunks.length} ссылок по ~${WORDS_PER_CHUNK} слов.`);
                warningDiv.appendChild(descText);
                
                const br = document.createElement('br');
                warningDiv.appendChild(br);
                
                const reminderText = document.createTextNode('Получатель должен импортировать все части по очереди.');
                warningDiv.appendChild(reminderText);
                
                warningDiv.style.display = 'block';
            } else {
                const base64 = self.encodePacket(groupsToShare);
                if (base64) {
                    const link = self.generateShareLink(base64);
                    
                    const linkItem = document.createElement('div');
                    linkItem.className = 'share-link-item';
                    
                    // Безопасное создание структуры
                    const header = document.createElement('div');
                    header.className = 'share-link-item-header';
                    
                    const title = document.createElement('span');
                    title.className = 'share-link-item-title';
                    title.textContent = 'Ссылка для импорта';
                    
                    const btn = document.createElement('button');
                    btn.className = 'btn-primary btn-copy-chunk';
                    btn.setAttribute('data-link', link);
                    btn.textContent = '📋 Скопировать';
                    
                    header.appendChild(title);
                    header.appendChild(btn);
                    
                    const input = document.createElement('input');
                    input.type = 'text';
                    input.className = 'share-link-item-input';
                    input.value = link;
                    input.readOnly = true;
                    
                    linkItem.appendChild(header);
                    linkItem.appendChild(input);
                    
                    linksContainer.appendChild(linkItem);
                    
                    // Обработчик на кнопку копирования
                    linkItem.querySelector('.btn-copy-chunk').onclick = () => {
                        navigator.clipboard.writeText(link).then(() => {
                            const btn = linkItem.querySelector('.btn-copy-chunk');
                            const originalText = btn.textContent;
                            btn.textContent = '✓ Скопировано!';
                            setTimeout(() => {
                                btn.textContent = originalText;
                            }, 2000);
                        });
                    };
                    
                    // Клик на input выделяет текст
                    linkItem.querySelector('.share-link-item-input').onclick = function() {
                        this.select();
                    };
                    
                    if (base64.length > 8000) {
                        warningDiv.textContent = `⚠️ Ссылка очень длинная (${totalWords} слов). Некоторые мессенджеры могут её обрезать.`;
                        warningDiv.style.display = 'block';
                    } else {
                        warningDiv.style.display = 'none';
                    }
                }
            }
        }
        
        includeSubgroups.onchange = updateLink;
        updateLink();
        
        overlay.classList.add('active');
        modal.classList.add('active');
    },
    
    createChunkedPackets(groups, wordsPerChunk) {
        const allWords = [];
        
        groups.forEach(g => {
            const words = Storage.getWordsByGroup(g.id);
            words.forEach(w => {
                allWords.push({
                    front: w.front,
                    back: w.back,
                    groupName: g.name
                });
            });
        });
        
        const chunks = [];
        for (let i = 0; i < allWords.length; i += wordsPerChunk) {
            const chunkWords = allWords.slice(i, i + wordsPerChunk);
            
            const groupedByName = {};
            chunkWords.forEach(w => {
                if (!groupedByName[w.groupName]) {
                    groupedByName[w.groupName] = [];
                }
                groupedByName[w.groupName].push({ f: w.front, b: w.back });
            });
            
            const packet = {
                v: 1,
                name: groups.length === 1 ? groups[0].name : `${groups.length} групп`,
                chunk: {
                    current: chunks.length + 1,
                    total: Math.ceil(allWords.length / wordsPerChunk)
                },
                groups: Object.keys(groupedByName).map(name => ({
                    name: name,
                    words: groupedByName[name]
                }))
            };
            
            const jsonString = JSON.stringify(packet);
            const encoded = encodeURIComponent(jsonString);
            const base64 = btoa(encoded);
            
            chunks.push({
                base64: base64,
                wordsCount: chunkWords.length
            });
        }
        
        return chunks;
    },
    
    showIncomingPackModal(packet) {
        const modal = document.getElementById('modal-incoming-pack');
        const overlay = document.getElementById('modal-overlay');
        const infoDiv = document.getElementById('incoming-pack-info');
        const previewDiv = document.getElementById('incoming-pack-preview');
        
        const totalWords = this.countWordsInPacket(packet);
        const totalGroups = packet.groups.length;
        
        // Безопасное отображение информации о пакете
        infoDiv.textContent = '';
        const infoText = document.createTextNode(`📦 "${packet.name}" — ${totalWords} слов${totalGroups > 1 ? `, ${totalGroups} групп` : ''}`);
        infoDiv.appendChild(infoText);
        
        // Добавить chunk info если есть
        if (packet.chunk) {
            const chunkSpan = document.createElement('span');
            chunkSpan.style.color = 'var(--accent)';
            chunkSpan.style.fontWeight = 'bold';
            chunkSpan.textContent = ` [Часть ${packet.chunk.current}/${packet.chunk.total}]`;
            infoDiv.appendChild(chunkSpan);
        }
        
        // Безопасное отображение предпросмотра
        previewDiv.textContent = '';
        
        const previewHeader = document.createElement('div');
        previewHeader.style.color = 'var(--text-muted)';
        previewHeader.style.marginBottom = '0.5rem';
        previewHeader.textContent = 'Предпросмотр (первые 5):';
        previewDiv.appendChild(previewHeader);
        
        let count = 0;
        for (const group of packet.groups) {
            if (count >= 5) break;
            for (const word of group.words) {
                if (count >= 5) break;
                const wordDiv = document.createElement('div');
                wordDiv.textContent = `${word.f} → ${word.b}`;
                previewDiv.appendChild(wordDiv);
                count++;
            }
        }
        
        if (totalWords > 5) {
            const moreDiv = document.createElement('div');
            moreDiv.style.color = 'var(--text-muted)';
            moreDiv.style.marginTop = '0.5rem';
            moreDiv.textContent = '...';
            previewDiv.appendChild(moreDiv);
        }
        
        // Добавить напоминание о следующей части
        if (packet.chunk && packet.chunk.current < packet.chunk.total) {
            const reminderDiv = document.createElement('div');
            reminderDiv.style.marginTop = '1rem';
            reminderDiv.style.padding = '0.75rem';
            reminderDiv.style.background = 'var(--accent)';
            reminderDiv.style.color = 'white';
            reminderDiv.style.borderRadius = '6px';
            reminderDiv.style.fontSize = '0.875rem';
            reminderDiv.textContent = `💡 После импорта откройте ссылку на часть ${packet.chunk.current + 1}/${packet.chunk.total}`;
            previewDiv.appendChild(reminderDiv);
        }
        
        const self = this;
        
        document.getElementById('btn-accept-pack').onclick = () => {
            const result = self.importPacket(packet, true);
            closeModal();
            
            if (window.history && window.history.replaceState) {
                window.history.replaceState(null, '', window.location.href.split('#')[0]);
            }
            
            Groups.renderGroupsTree();
            Words.renderWordsView();
            
            // Сообщение о прогрессе
            let message = `Импортировано ${result.importedWords} слов`;
            if (packet.chunk) {
                message += ` (часть ${packet.chunk.current}/${packet.chunk.total})`;
            }
            if (result.importedGroups > 0) {
                message += ` в ${result.importedGroups} групп(у)`;
            }
            showToast(message, 'success');
        };
        
        document.getElementById('btn-reject-pack').onclick = () => {
            closeModal();
            if (window.history && window.history.replaceState) {
                window.history.replaceState(null, '', window.location.href.split('#')[0]);
            }
        };
        
        overlay.classList.add('active');
        modal.classList.add('active');
    },
    
    checkIncomingPack() {
        if (!window.location.hash.startsWith('#pack=')) return;
        
        console.log('Обнаружен входящий пакет, hash:', window.location.hash.substring(0, 50) + '...');
        const result = this.decodePacket(window.location.hash);
        
        if (result.error) {
            console.error('Ошибка декодирования:', result.error, result.message);
            if (result.error !== 'decode') {
                showToast(result.message, 'error');
            }
            if (window.history && window.history.replaceState) {
                window.history.replaceState(null, '', window.location.href.split('#')[0]);
            }
            return;
        }
        
        if (result.success) {
            console.log('Пакет успешно декодирован:', result.packet);
            this.showIncomingPackModal(result.packet);
        }
    }
};

// Importer module
const Importer = {
    parseTxtFile(text) {
        const lines = text.split('\n');
        const result = {
            groupsWithWords: [],
            orphanWords: []
        };
        
        let currentGroup = null;
        
        for (let line of lines) {
            line = line.trim();
            
            if (!line || line.startsWith('#')) continue;
            
            if (line.startsWith('[') && line.endsWith(']')) {
                const groupName = line.slice(1, -1).trim();
                if (groupName) {
                    currentGroup = { groupName, words: [] };
                    result.groupsWithWords.push(currentGroup);
                }
                continue;
            }
            
            let front, back;
            
            if (line.includes('=')) {
                [front, back] = line.split('=').map(s => s.trim());
            } else if (line.includes('\t')) {
                [front, back] = line.split('\t').map(s => s.trim());
            } else {
                continue;
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
    },
    
    importFromParsed(parsed, targetGroupId = null, skipDuplicates = true) {
        let importedGroups = 0;
        let importedWords = 0;
        
        for (const item of parsed.groupsWithWords) {
            let groupId;
            const existing = Storage.getAllGroups().find(g => g.name === item.groupName && !g.parentId);
            
            if (existing) {
                groupId = existing.id;
            } else {
                const newGroup = Storage.addGroup(item.groupName, null);
                groupId = newGroup.id;
                importedGroups++;
            }
            
            const count = this.importWords(item.words, groupId, skipDuplicates);
            importedWords += count;
        }
        
        if (parsed.orphanWords.length > 0) {
            if (!targetGroupId) {
                const newGroup = Storage.addGroup('Импортированные слова', null);
                targetGroupId = newGroup.id;
                importedGroups++;
            }
            
            const count = this.importWords(parsed.orphanWords, targetGroupId, skipDuplicates);
            importedWords += count;
        }
        
        return { importedGroups, importedWords };
    },
    
    importWords(words, groupId, skipDuplicates) {
        const existing = Storage.getWordsByGroup(groupId);
        let count = 0;
        
        for (const word of words) {
            if (skipDuplicates) {
                const isDuplicate = existing.some(
                    w => w.front.toLowerCase() === word.front.toLowerCase() && 
                         w.back.toLowerCase() === word.back.toLowerCase()
                );
                if (isDuplicate) continue;
            }
            
            Storage.addWord(word.front, word.back, groupId);
            count++;
        }
        
        return count;
    },
    
    showImportModal() {
        const modal = document.getElementById('modal-import');
        const overlay = document.getElementById('modal-overlay');
        
        document.getElementById('import-dropzone').style.display = 'block';
        document.getElementById('import-preview').style.display = 'none';
        document.getElementById('btn-do-import').style.display = 'none';
        
        overlay.classList.add('active');
        modal.classList.add('active');
    },
    
    setupImportHandlers() {
        const dropzone = document.getElementById('import-dropzone');
        const fileInput = document.getElementById('import-file-input');
        const previewDiv = document.getElementById('import-preview');
        const previewText = document.getElementById('import-preview-text');
        const groupSelectDiv = document.getElementById('import-group-select');
        const groupSelect = document.getElementById('import-target-group');
        const importBtn = document.getElementById('btn-do-import');
        
        let parsedData = null;
        const self = this;
        
        dropzone.querySelector('button').onclick = () => fileInput.click();
        
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
                parsedData = self.parseTxtFile(text);
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
            
            if (data.orphanWords.length > 0) {
                groupSelectDiv.style.display = 'block';
                
                groupSelect.innerHTML = '';
                
                const optNew = document.createElement('option');
                optNew.value = 'NEW';
                optNew.textContent = `Создать новую группу: "${filename.replace('.txt', '')}"`;
                groupSelect.appendChild(optNew);
                
                const allGroups = Groups.getGroupsForSelect();
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
                    const newGroup = Storage.addGroup(filename, null);
                    targetGroupId = newGroup.id;
                } else {
                    targetGroupId = selected;
                }
            }
            
            const result = self.importFromParsed(parsedData, targetGroupId, skipDuplicates);
            
            closeModal();
            
            Groups.renderGroupsTree();
            window.dispatchEvent(new CustomEvent('words-moved'));
            
            showToast(`Импортировано ${result.importedWords} слов${result.importedGroups > 0 ? ` в ${result.importedGroups} групп(у)` : ''}`, 'success');
        };
    }
};

// Game module
const Game = {
    gameState: null,
    lastGameSettings: null, // Сохраняем настройки последней игры
    keyboardHandler: null, // Хендлер для keyboard navigation
    resultsKeyboardHandler: null, // Хендлер для results screen
    inputMode: 'mouse', // Режим управления: mouse, qwer, numbers
    numbersPhase: 1, // Для режима numbers: фаза 1 (левая) или 2 (правая)
    
    startGame(settings) {
        // КРИТИЧНО: Очистить предыдущий таймер перед запуском нового
        if (this.gameState && this.gameState.timerInterval) {
            clearInterval(this.gameState.timerInterval);
            this.gameState.timerInterval = null;
        }
        
        // Загружаем режим управления из localStorage
        this.inputMode = localStorage.getItem('inputMode') || 'mouse';
        this.numbersPhase = 1; // Сброс фазы для режима numbers
        
        this.gameState = {
            words: settings.words,
            allPairs: [], // Все пары для batch-обработки
            pairs: [], // Текущий batch (макс 8)
            matched: 0,
            errors: 0,
            startTime: Date.now(),
            timeLimit: settings.timeLimit,
            showTimer: settings.showTimer,
            selectedLeft: null,
            timerInterval: null,
            groupName: settings.groupName,
            currentBatch: 0,
            totalBatches: 0,
            batchMatched: 0, // Угадано в текущем batch
            // SRS tracking
            pairAttempts: {}, // wordId -> число ошибок
            pairStartTime: {}, // wordId -> timestamp начала попытки
            pairQuality: {}  // wordId -> вычисленное качество
        };
        
        // Если переданы конкретные пары - использовать их
        if (settings.specificPairs) {
            this.gameState.allPairs = settings.specificPairs;
        } else {
            // Иначе выбрать случайные из words
            const shuffledWords = [...this.gameState.words].sort(() => Math.random() - 0.5);
            this.gameState.allPairs = shuffledWords.slice(0, settings.pairsCount);
        }
        
        // Разбиваем на batch по 8 пар
        const BATCH_SIZE = 8;
        this.gameState.totalBatches = Math.ceil(this.gameState.allPairs.length / BATCH_SIZE);
        this.gameState.currentBatch = 0;
        
        // Загружаем первый batch
        this.loadBatch(0);
        
        // Сохраняем настройки для быстрого рестарта
        this.lastGameSettings = {
            groupId: settings.groupId,
            words: settings.words,
            pairs: this.gameState.allPairs, // Сохраняем все пары!
            pairsCount: settings.pairsCount,
            timeLimit: settings.timeLimit,
            showTimer: settings.showTimer,
            groupName: settings.groupName,
            sourceType: settings.sourceType || 'current'
        };
        
        showScreen('game');
        this.renderGameField();
        
        if (this.gameState.timeLimit > 0) {
            this.startTimer();
        }
        
        // Обновляем индикаторы режима и фазы
        this.updateInputModeIndicator();
        this.updatePhaseIndicator();
        
        // Подключаем keyboard navigation
        this.attachKeyboardListener();
        
        document.getElementById('game-group-name').textContent = `Группа: ${this.gameState.groupName}`;
        this.updateProgress();
    },
    
    loadBatch(batchIndex) {
        const BATCH_SIZE = 8;
        const start = batchIndex * BATCH_SIZE;
        const end = Math.min(start + BATCH_SIZE, this.gameState.allPairs.length);
        this.gameState.pairs = this.gameState.allPairs.slice(start, end);
        this.gameState.currentBatch = batchIndex;
        this.gameState.batchMatched = 0;
    },
    
    updateInputModeIndicator() {
        const indicator = document.getElementById('input-mode-indicator');
        if (this.inputMode === 'qwer') {
            indicator.textContent = '⌨ QWER';
            indicator.style.display = 'inline';
        } else if (this.inputMode === 'numbers') {
            indicator.textContent = '⌨ 1–8';
            indicator.style.display = 'inline';
        } else {
            indicator.style.display = 'none';
        }
    },
    
    updatePhaseIndicator() {
        const indicator = document.getElementById('phase-indicator');
        if (this.inputMode === 'numbers') {
            indicator.style.display = 'block';
            indicator.textContent = this.numbersPhase === 1 ? '← выбери слово' : 'выбери перевод →';
        } else {
            indicator.style.display = 'none';
        }
    },
    
    attachKeyboardListener() {
        const self = this;
        
        // Удаляем старый listener если был
        if (this.keyboardHandler) {
            document.removeEventListener('keydown', this.keyboardHandler);
        }
        
        // Если режим мыши — не вешаем listener
        if (this.inputMode === 'mouse') {
            this.keyboardHandler = null;
            return;
        }
        
        this.keyboardHandler = function(e) {
            // Игнорируем если фокус в input
            if (document.activeElement.tagName === 'INPUT' || 
                document.activeElement.tagName === 'TEXTAREA') {
                return;
            }
            
            const key = e.key.toLowerCase();
            
            // Escape — сброс выбора и фазы
            if (key === 'escape') {
                self.clearSelection();
                if (self.inputMode === 'numbers') {
                    self.numbersPhase = 1;
                    self.updatePhaseIndicator();
                }
                return;
            }
            
            // ═══════════════════════════════════════
            // РЕЖИМ 1: QWER / UIOP
            // ═══════════════════════════════════════
            if (self.inputMode === 'qwer') {
                // Маппинг нажатой клавиши (EN/RU) → data-key карточки
                const leftKeyToDataKey = {
                    'q': 'q', 'й': 'q',
                    'w': 'w', 'ц': 'w',
                    'e': 'e', 'у': 'e',
                    'r': 'r', 'к': 'r',
                    'a': 'a', 'ф': 'a',
                    's': 's', 'ы': 's',
                    'd': 'd', 'в': 'd',
                    'f': 'f', 'а': 'f'
                };
                
                if (key in leftKeyToDataKey) {
                    const dataKey = leftKeyToDataKey[key];
                    const card = document.querySelector('.card[data-side="left"][data-key="' + dataKey + '"]:not(.matched)');
                    if (card) card.click();
                    return;
                }
                
                // Правая колонка: U I O P J K L ; (и русские эквиваленты)
                const rightKeyToDataKey = {
                    'u': 'u', 'г': 'u',
                    'i': 'i', 'ш': 'i',
                    'o': 'o', 'щ': 'o',
                    'p': 'p', 'з': 'p',
                    'j': 'j', 'о': 'j',
                    'k': 'k', 'л': 'k',
                    'l': 'l', 'д': 'l',
                    ';': ';', 'ж': ';'
                };
                
                if (key in rightKeyToDataKey) {
                    const dataKey = rightKeyToDataKey[key];
                    const card = document.querySelector('.card[data-side="right"][data-key="' + dataKey + '"]:not(.matched)');
                    if (card) card.click();
                    return;
                }
            }
            
            // ═══════════════════════════════════════
            // РЕЖИМ 2: Цифры 1-8 (двухфазный)
            // ═══════════════════════════════════════
            if (self.inputMode === 'numbers') {
                const numberKeys = ['1', '2', '3', '4', '5', '6', '7', '8'];
                
                if (numberKeys.includes(key)) {
                    if (self.numbersPhase === 1) {
                        // Фаза 1: выбор левой карточки по data-key
                        const card = document.querySelector('.card[data-side="left"][data-key="' + key + '"]:not(.matched)');
                        if (card) {
                            card.click();
                            self.numbersPhase = 2;
                            self.updatePhaseIndicator();
                        }
                    } else {
                        // Фаза 2: выбор правой карточки по data-key
                        const card = document.querySelector('.card[data-side="right"][data-key="' + key + '"]:not(.matched)');
                        if (card) {
                            card.click();
                            // После матчинга возвращаемся в фазу 1
                            self.numbersPhase = 1;
                            self.updatePhaseIndicator();
                        }
                    }
                    return;
                }
            }
        };
        
        document.addEventListener('keydown', this.keyboardHandler);
    },
    
    clearSelection() {
        document.querySelectorAll('.card[data-side="left"]').forEach(c => {
            c.classList.remove('selected');
        });
        this.gameState.selectedLeft = null;
    },
    
    renderGameField() {
        const leftColumn = document.getElementById('left-column');
        const rightColumn = document.getElementById('right-column');
        
        leftColumn.innerHTML = '';
        rightColumn.innerHTML = '';
        
        const timerBar = document.getElementById('timer-bar');
        if (timerBar) {
            timerBar.style.width = '100%';
        }
        
        // Keyboard shortcuts в зависимости от режима
        let leftKeys, rightKeys;
        
        if (this.inputMode === 'qwer') {
            leftKeys = ['Q', 'W', 'E', 'R', 'A', 'S', 'D', 'F'];
            rightKeys = ['U', 'I', 'O', 'P', 'J', 'K', 'L', ';'];
        } else if (this.inputMode === 'numbers') {
            leftKeys = ['1', '2', '3', '4', '5', '6', '7', '8'];
            rightKeys = ['1', '2', '3', '4', '5', '6', '7', '8'];
        } else {
            // Режим мыши — без hints
            leftKeys = Array(8).fill(null);
            rightKeys = Array(8).fill(null);
        }
        
        const leftCards = [...this.gameState.pairs].sort(() => Math.random() - 0.5);
        leftCards.forEach((word, index) => {
            const card = this.createCard(word.front, word.id, 'left', leftKeys[index]);
            leftColumn.appendChild(card);
        });
        
        const rightCards = [...this.gameState.pairs].sort(() => Math.random() - 0.5);
        rightCards.forEach((word, index) => {
            const card = this.createCard(word.back, word.id, 'right', rightKeys[index]);
            rightColumn.appendChild(card);
        });
    },
    
    createCard(text, wordId, side, keyHint) {
        const card = document.createElement('div');
        card.className = 'card';
        card.dataset.wordId = wordId;
        card.dataset.side = side;
        
        // Фиксируем клавишу для keyboard navigation (НЕ меняется после угадывания)
        if (keyHint) {
            card.dataset.key = keyHint.toLowerCase(); // Сохраняем в lowercase для поиска
        }
        
        // Badge с клавишей
        if (keyHint) {
            const badge = document.createElement('span');
            badge.className = 'card-key-badge';
            badge.textContent = keyHint;
            card.appendChild(badge);
        }
        
        // Текст карточки
        const textNode = document.createElement('span');
        textNode.className = 'card-text';
        textNode.textContent = text;
        card.appendChild(textNode);
        
        const self = this;
        card.onclick = () => self.handleCardClick(card, wordId, side);
        
        return card;
    },
    
    handleCardClick(card, wordId, side) {
        if (card.classList.contains('correct') || card.classList.contains('matched')) return;
        
        if (side === 'left') {
            document.querySelectorAll('.card[data-side="left"]').forEach(c => {
                c.classList.remove('selected');
            });
            card.classList.add('selected');
            this.gameState.selectedLeft = wordId;
            // SRS: записываем момент начала попытки
            this.gameState.pairStartTime[wordId] = Date.now();
        } else {
            if (!this.gameState.selectedLeft) return;
            
            const leftCard = document.querySelector(`.card[data-side="left"][data-word-id="${this.gameState.selectedLeft}"]`);
            
            if (this.gameState.selectedLeft === wordId) {
                card.classList.add('correct');
                leftCard.classList.add('correct');
                card.classList.add('matched');
                leftCard.classList.add('matched');
                
                // SRS: вычисляем quality
                const matchedWordId = this.gameState.selectedLeft;
                const elapsed = Date.now() - (this.gameState.pairStartTime[matchedWordId] || Date.now());
                const attempts = this.gameState.pairAttempts[matchedWordId] || 0;
                this.gameState.pairQuality[matchedWordId] = SRS.computeQuality(attempts, elapsed, true);
                
                const self = this;
                setTimeout(() => {
                    card.style.visibility = 'hidden';
                    leftCard.style.visibility = 'hidden';
                    self.gameState.matched++;
                    self.gameState.batchMatched++;
                    self.updateProgress();
                    
                    // Проверяем завершение текущего batch
                    if (self.gameState.batchMatched === self.gameState.pairs.length) {
                        // Все пары в batch угаданы
                        const nextBatch = self.gameState.currentBatch + 1;
                        
                        if (nextBatch < self.gameState.totalBatches) {
                            // Загружаем следующий batch
                            setTimeout(() => {
                                self.loadBatch(nextBatch);
                                self.renderGameField();
                                self.updateProgress();
                            }, 800);
                        } else {
                            // Все batch завершены — игра окончена
                            self.endGame(true);
                        }
                    }
                }, 300);
            } else {
                card.classList.add('wrong');
                leftCard.classList.add('wrong');
                this.gameState.errors++;
                // SRS: считаем ошибку для текущей пары
                const lwId = this.gameState.selectedLeft;
                this.gameState.pairAttempts[lwId] = (this.gameState.pairAttempts[lwId] || 0) + 1;
                
                setTimeout(() => {
                    card.classList.remove('wrong');
                    leftCard.classList.remove('wrong');
                    leftCard.classList.remove('selected');
                }, 300);
            }
            
            this.gameState.selectedLeft = null;
        }
    },
    
    startTimer() {
        // КРИТИЧНО: Очистить предыдущий интервал перед созданием нового
        if (this.gameState.timerInterval) {
            clearInterval(this.gameState.timerInterval);
            this.gameState.timerInterval = null;
        }
        
        const timerBar = document.getElementById('timer-bar');
        const timerText = document.getElementById('game-timer');
        
        if (!this.gameState.showTimer) {
            timerBar.style.display = 'none';
            timerText.style.display = 'none';
        }
        
        let elapsed = 0;
        const self = this;
        
        this.gameState.timerInterval = setInterval(() => {
            elapsed++;
            const remaining = self.gameState.timeLimit - elapsed;
            
            if (remaining <= 0) {
                self.endGame(false);
                return;
            }
            
            if (self.gameState.showTimer) {
                const mins = Math.floor(remaining / 60);
                const secs = remaining % 60;
                timerText.textContent = `⏱ ${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
                
                const percent = (remaining / self.gameState.timeLimit) * 100;
                timerBar.style.width = percent + '%';
            }
        }, 1000);
    },
    
    updateProgress() {
        const progressEl = document.getElementById('game-progress');
        
        // Показываем общий прогресс + batch info если batches > 1
        if (this.gameState.totalBatches > 1) {
            const batchInfo = ` | Batch ${this.gameState.currentBatch + 1}/${this.gameState.totalBatches}`;
            progressEl.textContent = `✓ ${this.gameState.matched}/${this.gameState.allPairs.length}${batchInfo}`;
        } else {
            progressEl.textContent = `✓ ${this.gameState.matched}/${this.gameState.allPairs.length}`;
        }
    },
    
    endGame(completed) {
        // Очистка keyboard listener
        if (this.keyboardHandler) {
            document.removeEventListener('keydown', this.keyboardHandler);
            this.keyboardHandler = null;
        }
        
        if (this.gameState.timerInterval) {
            clearInterval(this.gameState.timerInterval);
            this.gameState.timerInterval = null;
        }
        
        const elapsedTime = Math.floor((Date.now() - this.gameState.startTime) / 1000);
        const score = this.gameState.matched * 10 - this.gameState.errors * 3;
        
        // SRS: обработка результатов раунда
        let srsResult = null;
        let newStreak = null;
        try {
            // Для неугаданных пар (таймаут) проставляем quality = 0
            this.gameState.allPairs.forEach(pair => {
                if (!(pair.id in this.gameState.pairQuality)) {
                    this.gameState.pairQuality[pair.id] = 0;
                }
            });
            srsResult = SRS.processRoundResults(
                this.gameState.allPairs,
                this.gameState.pairQuality,
                completed
            );
            newStreak = SRS.updateStreak();
            this.updateSRSUI(); // Обновляем бейдж streak и кнопку повтора
        } catch (e) {
            console.error('SRS error:', e);
        }
        
        this.showResults({
            completed,
            matched: this.gameState.matched,
            total: this.gameState.allPairs.length,
            time: elapsedTime,
            errors: this.gameState.errors,
            score: Math.max(0, score),
            srsResult,
            newStreak
        });
    },
    
    showResults(results) {
        showScreen('results');
        
        const icon = document.getElementById('results-icon');
        const title = document.getElementById('results-title');
        const timeEl = document.getElementById('results-time');
        const errorsEl = document.getElementById('results-errors');
        const scoreEl = document.getElementById('results-score');
        
        if (results.completed) {
            icon.textContent = '✓';
            title.textContent = `${results.matched} из ${results.total} пар угадано!`;
        } else {
            icon.textContent = '⏱';
            title.textContent = `Время вышло! ${results.matched} из ${results.total} пар`;
        }
        
        const mins = Math.floor(results.time / 60);
        const secs = results.time % 60;
        timeEl.textContent = mins > 0 ? `${mins} мин ${secs} сек` : `${secs} сек`;
        errorsEl.textContent = results.errors;
        scoreEl.textContent = results.score;
        
        // SRS блок результатов
        const srsBlock = document.getElementById('srs-results-block');
        if (srsBlock && results.srsResult) {
            const s = results.srsResult;
            let html = '';
            if (s.learned > 0) html += `<span class="srs-line">🟢 +${s.learned} выучено</span>`;
            if (s.inProgress > 0) html += `<span class="srs-line">🟡 +${s.inProgress} в процессе</span>`;
            if (s.regressed > 0) html += `<span class="srs-line">🔴 ${s.regressed} слова вернутся скорее</span>`;
            if (s.nextReview) {
                const dateLabel = SRS.formatDateRu(s.nextReview);
                html += `<span class="srs-next-review">Следующий повтор: ${dateLabel}</span>`;
            }
            if (results.newStreak && results.newStreak > 0) {
                html += `<span class="srs-streak">🔥 ${results.newStreak} дней подряд!</span>`;
            }
            srsBlock.innerHTML = html;
            srsBlock.style.display = html ? 'block' : 'none';
        } else if (srsBlock) {
            srsBlock.style.display = 'none';
        }
        
        // Добавляем key hints на кнопки
        this.addResultsKeyHints();
        
        // Подключаем keyboard navigation для результатов
        this.attachResultsKeyboardListener();
    },
    
    addResultsKeyHints() {
        const buttons = {
            'btn-play-same-words': 'R',
            'btn-to-library': 'E',
            'btn-change-settings': 'W',
            'btn-play-again': 'Space'
        };
        
        Object.keys(buttons).forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (btn) {
                // Проверяем уже обработана ли кнопка
                if (btn.querySelector('.btn-key-badge')) {
                    return; // Уже есть badge, пропускаем
                }
                
                // Сохраняем оригинальный текст
                const originalText = btn.textContent;
                
                // Очищаем кнопку
                btn.innerHTML = '';
                
                // Создаём wrapper для текста
                const textSpan = document.createElement('span');
                textSpan.className = 'btn-text';
                textSpan.textContent = originalText;
                
                // Создаём badge
                const badge = document.createElement('span');
                badge.className = 'btn-key-badge';
                badge.textContent = buttons[btnId];
                
                // Добавляем оба элемента
                btn.appendChild(textSpan);
                btn.appendChild(badge);
            }
        });
    },
    
    attachResultsKeyboardListener() {
        const self = this;
        
        // Удаляем старый listener если был
        if (this.resultsKeyboardHandler) {
            document.removeEventListener('keydown', this.resultsKeyboardHandler);
        }
        
        this.resultsKeyboardHandler = function(e) {
            // Игнорируем если фокус в input
            if (document.activeElement.tagName === 'INPUT' || 
                document.activeElement.tagName === 'TEXTAREA') {
                return;
            }
            
            const key = e.key.toLowerCase();
            
            // R / К → Повторить эти слова
            if (key === 'r' || key === 'к') {
                const btn = document.getElementById('btn-play-same-words');
                if (btn) btn.click();
                return;
            }
            
            // E / У → В библиотеку
            if (key === 'e' || key === 'у') {
                const btn = document.getElementById('btn-to-library');
                if (btn) btn.click();
                return;
            }
            
            // W / Ц → Изменить настройки
            if (key === 'w' || key === 'ц') {
                const btn = document.getElementById('btn-change-settings');
                if (btn) btn.click();
                return;
            }
            
            // Space → Ещё раунд
            if (key === ' ') {
                e.preventDefault(); // Предотвращаем скролл страницы
                const btn = document.getElementById('btn-play-again');
                if (btn) btn.click();
                return;
            }
        };
        
        document.addEventListener('keydown', this.resultsKeyboardHandler);
    },
    
    detachResultsKeyboardListener() {
        if (this.resultsKeyboardHandler) {
            document.removeEventListener('keydown', this.resultsKeyboardHandler);
            this.resultsKeyboardHandler = null;
        }
    },
    
    showGameSettings(prefillSRS = false) {
        const groupId = Groups.getSelectedGroup();
        if (!groupId) {
            showToast('Сначала выберите группу', 'error');
            return;
        }
        
        const modal = document.getElementById('modal-game-settings');
        const overlay = document.getElementById('modal-overlay');
        
        const settings = Storage.getSettings();
        
        document.getElementById('pairs-count').value = settings.pairsCount || 6;
        document.getElementById('pairs-count-value').textContent = settings.pairsCount || 6;
        document.getElementById('show-timer').checked = settings.showTimer !== false;
        
        // Загружаем inputMode из localStorage
        const savedInputMode = localStorage.getItem('inputMode') || 'mouse';
        document.querySelectorAll('input[name="input-mode"]').forEach(radio => {
            radio.checked = radio.value === savedInputMode;
        });
        
        document.querySelectorAll('.pill').forEach(pill => {
            pill.classList.remove('active');
            if (parseInt(pill.dataset.time) === (settings.timeLimit || 30)) {
                pill.classList.add('active');
            }
        });
        
        const group = Storage.getGroup(groupId);
        document.getElementById('game-source-current-label').textContent = `Текущая группа (${group.name})`;
        
        // SRS очередь
        try {
            const allGroupIds = Groups.getAllChildGroups(groupId);
            const dueCount = SRS.getDueCount(allGroupIds);
            const queueCountEl = document.getElementById('srs-queue-count');
            if (queueCountEl) queueCountEl.textContent = dueCount;
            
            // Если вызвано с prefillSRS — автовыбор радио SM-2
            if (prefillSRS && dueCount > 0) {
                const srsRadio = document.querySelector('input[name="word-mode"][value="srs"]');
                if (srsRadio) srsRadio.click();
            } else {
                const randomRadio = document.querySelector('input[name="word-mode"][value="random"]');
                if (randomRadio) randomRadio.checked = true;
            }
            this.updateSRSSliderState();
        } catch(e) {}
        
        overlay.classList.add('active');
        modal.classList.add('active');
    },
    
    updateSRSSliderState() {
        const isSRS = document.querySelector('input[name="word-mode"]:checked')?.value === 'srs';
        const slider = document.getElementById('pairs-count');
        const hint = document.querySelector('.srs-locked-hint');
        if (!slider) return;
        if (isSRS) {
            slider.classList.add('srs-locked');
            slider.disabled = true;
            if (hint) hint.style.display = 'block';
        } else {
            slider.classList.remove('srs-locked');
            slider.disabled = false;
            if (hint) hint.style.display = 'none';
        }
    },
    
    updateSRSUI() {
        try {
            const streak = SRS.getStreak();
            const badge = document.getElementById('streak-badge');
            if (badge) {
                if (streak > 0) {
                    badge.textContent = `🔥 ${streak}`;
                    badge.title = `${streak} дней подряд`;
                } else {
                    badge.textContent = '';
                }
            }
            
            // Число слов к повтору (вся библиотека)
            const dueCount = SRS.getDueCount(null);
            const dueEl = document.getElementById('srs-due-count');
            if (dueEl) dueEl.textContent = dueCount;
            
            const reviewBtn = document.getElementById('btn-srs-review');
            if (reviewBtn) {
                if (dueCount > 0) {
                    reviewBtn.classList.remove('btn-srs-done');
                    reviewBtn.innerHTML = `📅 Повторить (<span id="srs-due-count">${dueCount}</span>)`;
                    reviewBtn.style.pointerEvents = '';
                    reviewBtn.title = 'Повторить слова из очереди SM-2';
                } else {
                    reviewBtn.classList.add('btn-srs-done');
                    reviewBtn.innerHTML = '✅ На сегодня всё';
                    reviewBtn.title = 'Сегодня нечего повторять';
                }
            }
        } catch(e) {
            console.error('updateSRSUI error:', e);
        }
    },
    
    setupGameSettingsHandlers() {
        const pairsSlider = document.getElementById('pairs-count');
        const pairsValue = document.getElementById('pairs-count-value');
        
        pairsSlider.oninput = () => {
            pairsValue.textContent = pairsSlider.value;
        };
        
        const self = this;
        // SM-2 радио — блокируем/разблокируем слайдер
        document.querySelectorAll('input[name="word-mode"]').forEach(radio => {
            radio.onchange = () => self.updateSRSSliderState();
        });
        
        document.querySelectorAll('.pill').forEach(pill => {
            pill.onclick = () => {
                document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
            };
        });
        
        document.getElementById('btn-start-game').onclick = () => {
            const groupId = Groups.getSelectedGroup();
            const sourceType = document.querySelector('input[name="game-source"]:checked').value;
            const wordMode = document.querySelector('input[name="word-mode"]:checked')?.value || 'random';
            
            let words = [];
            let specificPairs = null;
            
            if (wordMode === 'srs') {
                try {
                    const allGroupIds = Groups.getAllChildGroups(groupId);
                    const dueWords = SRS.getDueWords(allGroupIds);
                    if (dueWords.length < 2) {
                        showToast('Недостаточно слов в очереди SM-2 (мин. 2)', 'error');
                        return;
                    }
                    specificPairs = dueWords.map(w => ({ id: w.id, front: w.front, back: w.back }));
                    words = dueWords;
                } catch(e) {
                    showToast('Ошибка получения очереди SM-2', 'error');
                    return;
                }
            } else if (sourceType === 'current') {
                words = Storage.getWordsByGroup(groupId);
            } else if (sourceType === 'recursive') {
                const allGroupIds = Groups.getAllChildGroups(groupId);
                allGroupIds.forEach(gid => {
                    words.push(...Storage.getWordsByGroup(gid));
                });
            }
            
            const pairsCount = wordMode === 'srs' ? Math.min(words.length, 20) : parseInt(document.getElementById('pairs-count').value);
            const timeLimit = parseInt(document.querySelector('.pill.active').dataset.time);
            const showTimer = document.getElementById('show-timer').checked;
            const inputMode = document.querySelector('input[name="input-mode"]:checked').value;
            
            localStorage.setItem('inputMode', inputMode);
            
            if (wordMode !== 'srs' && words.length < pairsCount) {
                document.getElementById('game-warning').textContent = 'В выбранном источнике только ' + words.length + ' слов. Количество пар автоматически уменьшено.';
                document.getElementById('game-warning').style.display = 'block';
                document.getElementById('pairs-count').value = words.length;
                document.getElementById('pairs-count-value').textContent = words.length;
                return;
            } else {
                document.getElementById('game-warning').style.display = 'none';
            }
            
            Storage.updateSettings({ pairsCount, timeLimit, showTimer });
            closeModal();
            
            const group = Storage.getGroup(groupId);
            self.startGame({
                words,
                specificPairs,
                pairsCount,
                timeLimit,
                showTimer,
                groupName: group.name,
                groupId: groupId,
                sourceType: sourceType
            });
        };
    },
    
    restartWithSameWords() {
        if (!this.lastGameSettings) return;
        
        // Отключаем keyboard listener результатов
        this.detachResultsKeyboardListener();
        
        // Перезапустить с ТЕМИ ЖЕ парами
        this.startGame({
            words: this.lastGameSettings.words,
            specificPairs: this.lastGameSettings.pairs, // Используем сохранённые пары!
            pairsCount: this.lastGameSettings.pairsCount,
            timeLimit: this.lastGameSettings.timeLimit,
            showTimer: this.lastGameSettings.showTimer,
            groupName: this.lastGameSettings.groupName,
            groupId: this.lastGameSettings.groupId,
            sourceType: this.lastGameSettings.sourceType
        });
    },
    
    restartWithNewWords() {
        if (!this.lastGameSettings) return;
        
        // Отключаем keyboard listener результатов
        this.detachResultsKeyboardListener();
        
        // Получить слова заново из группы
        const groupId = this.lastGameSettings.groupId;
        const sourceType = this.lastGameSettings.sourceType;
        
        let words = [];
        
        if (sourceType === 'current') {
            words = Storage.getWordsByGroup(groupId);
        } else if (sourceType === 'recursive') {
            const allGroupIds = Groups.getAllChildGroups(groupId);
            allGroupIds.forEach(gid => {
                words.push(...Storage.getWordsByGroup(gid));
            });
        }
        
        if (words.length === 0) {
            showToast('В группе нет слов', 'error');
            return;
        }
        
        this.startGame({
            words,
            pairsCount: Math.min(this.lastGameSettings.pairsCount, words.length),
            timeLimit: this.lastGameSettings.timeLimit,
            showTimer: this.lastGameSettings.showTimer,
            groupName: this.lastGameSettings.groupName,
            groupId: groupId,
            sourceType: sourceType
        });
    },
    
    exitGame() {
        // Очистка keyboard listener
        if (this.keyboardHandler) {
            document.removeEventListener('keydown', this.keyboardHandler);
            this.keyboardHandler = null;
        }
        
        if (this.gameState && this.gameState.timerInterval) {
            clearInterval(this.gameState.timerInterval);
            this.gameState.timerInterval = null;
        }
        this.gameState = null;
        showScreen('library');
    }
};

// PasteText module
const PasteText = {
    debounceTimer: null,
    
    showPasteModal() {
        const modal = document.getElementById('modal-paste-text');
        const overlay = document.getElementById('modal-overlay');
        const textarea = document.getElementById('paste-textarea');
        
        textarea.value = '';
        document.getElementById('paste-preview').innerHTML = '';
        document.getElementById('paste-group-select').style.display = 'none';
        
        overlay.classList.add('active');
        modal.classList.add('active');
        textarea.focus();
    },
    
    setupPasteHandlers() {
        const textarea = document.getElementById('paste-textarea');
        const previewDiv = document.getElementById('paste-preview');
        const groupSelectDiv = document.getElementById('paste-group-select');
        const groupSelect = document.getElementById('paste-target-group');
        const importBtn = document.getElementById('btn-do-paste-import');
        
        let parsedData = null;
        const self = this;
        
        textarea.oninput = () => {
            clearTimeout(self.debounceTimer);
            self.debounceTimer = setTimeout(() => {
                const text = textarea.value.trim();
                
                if (!text) {
                    previewDiv.innerHTML = '';
                    groupSelectDiv.style.display = 'none';
                    return;
                }
                
                parsedData = Importer.parseTxtFile(text);
                self.showPreview(parsedData, previewDiv, groupSelectDiv, groupSelect);
            }, 300);
        };
        
        importBtn.onclick = () => {
            if (!parsedData) return;
            
            let targetGroupId = null;
            
            if (parsedData.orphanWords.length > 0) {
                const selected = groupSelect.value;
                if (selected === 'NEW') {
                    const newName = prompt('Имя новой группы:', 'Вставленные слова');
                    if (!newName || !newName.trim()) return;
                    const newGroup = Storage.addGroup(newName.trim(), null);
                    targetGroupId = newGroup.id;
                } else {
                    targetGroupId = selected;
                }
            }
            
            const result = Importer.importFromParsed(parsedData, targetGroupId, true);
            
            closeModal();
            
            Groups.renderGroupsTree();
            Words.renderWordsView();
            
            showToast(`Импортировано ${result.importedWords} слов${result.importedGroups > 0 ? ` в ${result.importedGroups} групп(у)` : ''}`, 'success');
        };
    },
    
    showPreview(data, previewDiv, groupSelectDiv, groupSelect) {
        const totalWords = data.groupsWithWords.reduce((sum, g) => sum + g.words.length, 0) + data.orphanWords.length;
        const totalGroups = data.groupsWithWords.length;
        
        let cssClass = 'success';
        
        // Очистить предыдущий контент
        previewDiv.textContent = '';
        
        if (totalWords === 0) {
            const errorSpan = document.createElement('span');
            errorSpan.className = 'error';
            errorSpan.textContent = '❌ Слова не найдены. Проверьте формат (слово = перевод)';
            previewDiv.appendChild(errorSpan);
            cssClass = 'error';
            groupSelectDiv.style.display = 'none';
        } else {
            if (totalGroups > 0) {
                const successSpan = document.createElement('span');
                successSpan.className = 'success';
                successSpan.textContent = `✓ Найдено ${totalWords} слов в ${totalGroups} группах`;
                previewDiv.appendChild(successSpan);
                
                const detailsDiv = document.createElement('div');
                detailsDiv.style.marginTop = '0.5rem';
                detailsDiv.style.fontSize = '0.875rem';
                detailsDiv.style.color = 'var(--text-muted)';
                
                data.groupsWithWords.forEach(g => {
                    const groupDiv = document.createElement('div');
                    groupDiv.textContent = `• ${g.groupName}: ${g.words.length} слов`;
                    detailsDiv.appendChild(groupDiv);
                });
                
                previewDiv.appendChild(detailsDiv);
            }
            
            if (data.orphanWords.length > 0) {
                if (totalGroups > 0) {
                    previewDiv.appendChild(document.createElement('br'));
                }
                
                const warningSpan = document.createElement('span');
                warningSpan.className = 'warning';
                warningSpan.textContent = `⚠ ${data.orphanWords.length} слов без группы`;
                previewDiv.appendChild(warningSpan);
                cssClass = 'warning';
                
                groupSelectDiv.style.display = 'block';
                
                groupSelect.innerHTML = '';
                
                const optNew = document.createElement('option');
                optNew.value = 'NEW';
                optNew.textContent = 'Создать новую группу...';
                groupSelect.appendChild(optNew);
                
                const allGroups = Groups.getGroupsForSelect();
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
        
        previewDiv.className = `paste-preview ${cssClass}`;
    }
};

// Backup module
const Backup = {
    createBackup() {
        const rawData = localStorage.getItem(STORAGE_KEY);
        
        if (!rawData) {
            showToast('Нет данных для бэкапа', 'error');
            return;
        }
        
        const data = {
            version: 1,
            timestamp: new Date().toISOString(),
            data: rawData
        };
        
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const date = new Date().toISOString().split('T')[0];
        a.href = url;
        a.download = `word-matcher-backup-${date}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        showToast('Бэкап создан успешно!', 'success');
    },
    
    showRestoreModal() {
        const modal = document.getElementById('modal-restore');
        const overlay = document.getElementById('modal-overlay');
        const dropzone = document.getElementById('restore-dropzone');
        const fileInput = document.getElementById('restore-file-input');
        const previewDiv = document.getElementById('restore-preview');
        const previewText = document.getElementById('restore-preview-text');
        const btnRestore = document.getElementById('btn-do-restore');
        
        let backupData = null;
        
        dropzone.querySelector('button').onclick = () => fileInput.click();
        
        dropzone.ondragover = (e) => {
            e.preventDefault();
            dropzone.style.background = 'var(--accent-light)';
        };
        
        dropzone.ondragleave = () => {
            dropzone.style.background = '';
        };
        
        dropzone.ondrop = (e) => {
            e.preventDefault();
            dropzone.style.background = '';
            const file = e.dataTransfer.files[0];
            if (file) this.processBackupFile(file);
        };
        
        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (file) this.processBackupFile(file);
        };
        
        btnRestore.onclick = () => {
            if (!backupData) return;
            
            if (!confirm('⚠️ ВНИМАНИЕ! Это действие полностью заменит все текущие данные. Продолжить?')) {
                return;
            }
            
            try {
                // Проверка размера перед восстановлением
                const dataSize = backupData.data.length;
                const sizeMB = (dataSize / (1024 * 1024)).toFixed(2);
                
                if (dataSize > 4.5 * 1024 * 1024) {
                    showToast(`⚠️ Предупреждение: Размер бэкапа ${sizeMB}MB. Восстановление может превысить лимит хранилища.`, 'warning');
                }
                
                localStorage.setItem(STORAGE_KEY, backupData.data);
                
                showToast('Данные восстановлены! Обновите страницу.', 'success');
                
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            } catch (err) {
                console.error('Restore error:', err);
                
                // Обработка превышения квоты
                if (err.name === 'QuotaExceededError' || err.code === 22 || err.code === 1014) {
                    showToast('❌ ОШИБКА: Недостаточно места для восстановления бэкапа. Очистите данные браузера или используйте меньший бэкап.', 'error');
                } else {
                    showToast('Ошибка восстановления данных', 'error');
                }
            }
        };
        
        this.processBackupFile = (file) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const backup = JSON.parse(e.target.result);
                    
                    if (!backup.version || !backup.data) {
                        showToast('Невалидный файл бэкапа', 'error');
                        return;
                    }
                    
                    backupData = backup;
                    
                    const parsed = JSON.parse(backup.data);
                    const date = backup.timestamp ? new Date(backup.timestamp).toLocaleString('ru-RU') : 'неизвестна';
                    
                    // Безопасное отображение информации
                    previewText.textContent = '';
                    
                    const dateStrong = document.createElement('strong');
                    dateStrong.textContent = 'Бэкап от:';
                    previewText.appendChild(dateStrong);
                    previewText.appendChild(document.createTextNode(` ${date}`));
                    previewText.appendChild(document.createElement('br'));
                    
                    const groupsStrong = document.createElement('strong');
                    groupsStrong.textContent = 'Групп:';
                    previewText.appendChild(groupsStrong);
                    previewText.appendChild(document.createTextNode(` ${parsed.groups ? parsed.groups.length : 0}`));
                    previewText.appendChild(document.createElement('br'));
                    
                    const wordsStrong = document.createElement('strong');
                    wordsStrong.textContent = 'Слов:';
                    previewText.appendChild(wordsStrong);
                    previewText.appendChild(document.createTextNode(` ${parsed.words ? parsed.words.length : 0}`));
                    
                    previewDiv.style.display = 'block';
                    btnRestore.style.display = 'inline-block';
                    
                } catch (err) {
                    showToast('Ошибка чтения файла бэкапа', 'error');
                    console.error('Parse error:', err);
                }
            };
            
            reader.readAsText(file);
        };
        
        overlay.classList.add('active');
        modal.classList.add('active');
    }
};

// Utility functions
function showScreen(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(`screen-${name}`).classList.add('active');
}

function closeModal() {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    document.getElementById('modal-overlay').classList.remove('active');
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideInRight 300ms ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Initialization and event listeners
document.addEventListener('DOMContentLoaded', () => {
    Groups.renderGroupsTree();
    Words.renderWordsView();
    Importer.setupImportHandlers();
    PasteText.setupPasteHandlers();
    Game.setupGameSettingsHandlers();
    
    // Проверить входящий пакет в URL
    setTimeout(() => Sharing.checkIncomingPack(), 100);
    
    // Библиотека - группы
    document.getElementById('btn-new-group').onclick = () => {
        const name = prompt('Имя новой группы:');
        if (name && name.trim()) {
            Storage.addGroup(name.trim(), null);
            Groups.renderGroupsTree();
            showToast('Группа создана', 'success');
        }
    };
    
    document.querySelectorAll('.btn-welcome-group').forEach(btn => {
        btn.onclick = () => {
            const name = prompt('Имя новой группы:');
            if (name && name.trim()) {
                Storage.addGroup(name.trim(), null);
                Groups.renderGroupsTree();
                Words.renderWordsView();
                showToast('Группа создана', 'success');
            }
        };
    });
    
    document.querySelectorAll('.btn-welcome-import').forEach(btn => {
        btn.onclick = () => Importer.showImportModal();
    });
    
    window.addEventListener('group-selected', () => {
        Words.renderWordsView();
    });
    
    window.addEventListener('words-moved', () => {
        Groups.renderGroupsTree();
        Words.renderWordsList();
    });
    
    document.getElementById('context-menu').addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        const groupId = document.getElementById('context-menu').dataset.groupId;
        if (action && groupId) {
            Groups.handleContextMenuAction(action, groupId);
        }
    });
    
    // Библиотека - слова
    document.getElementById('btn-add-word').onclick = () => Words.showAddWordModal();
    
    const ioBtn = document.getElementById('btn-io-menu');
    const ioMenu = document.getElementById('io-menu');
    
    function toggleDropdown(show) {
        if (show) {
            ioMenu.classList.add('show');
            document.addEventListener('click', onOutsideClick);
            document.addEventListener('keydown', onEscKey);
        } else {
            ioMenu.classList.remove('show');
            document.removeEventListener('click', onOutsideClick);
            document.removeEventListener('keydown', onEscKey);
        }
    }
    
    function onOutsideClick(e) {
        if (!ioMenu.contains(e.target) && e.target !== ioBtn) {
            toggleDropdown(false);
        }
    }
    
    function onEscKey(e) {
        if (e.key === 'Escape') {
            toggleDropdown(false);
        }
    }
    
    ioBtn.onclick = (e) => {
        e.stopPropagation();
        const willShow = !ioMenu.classList.contains('show');
        toggleDropdown(willShow);
    };
    
    document.getElementById('menu-import-txt').onclick = () => {
        toggleDropdown(false);
        Importer.showImportModal();
    };
    
    document.getElementById('menu-paste-text').onclick = () => {
        toggleDropdown(false);
        PasteText.showPasteModal();
    };
    
    document.getElementById('menu-share-group').onclick = () => {
        toggleDropdown(false);
        const groupId = Groups.getSelectedGroup();
        if (groupId) Sharing.showShareModal(groupId);
    };
    
    document.getElementById('menu-export-json').onclick = () => {
        toggleDropdown(false);
        Storage.exportData();
        showToast('Данные экспортированы', 'success');
    };
    
    document.getElementById('menu-backup').onclick = () => {
        toggleDropdown(false);
        Backup.createBackup();
    };
    
    document.getElementById('menu-restore').onclick = () => {
        toggleDropdown(false);
        Backup.showRestoreModal();
    };
    
    document.getElementById('menu-export-progress').onclick = () => {
        toggleDropdown(false);
        SRS.exportProgress();
        showToast('Прогресс скачан', 'success');
    };
    
    document.getElementById('menu-import-progress').onclick = () => {
        toggleDropdown(false);
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const text = await file.text();
            const preview = SRS.getProgressPreview(text);
            if (!preview.valid) {
                showToast('Неверный формат файла прогресса', 'error');
                return;
            }
            const msg = 'Прогресс: ' + preview.wordCount + ' слов, серия ' + preview.streak + ' дн., дата: ' + preview.date +
                '\n\nOK = Заменить (полная замена)\nОтмена = Объединить (взять самые свежие)';
            const mode = confirm(msg) ? 'replace' : 'merge';
            const ok = SRS.importProgress(text, mode);
            if (ok) {
                showToast('Прогресс импортирован (' + (mode === 'replace' ? 'замена' : 'объединение') + ')', 'success');
                Game.updateSRSUI();
                Groups.renderGroupsTree();
                Words.renderWordsList();
            } else {
                showToast('Ошибка импорта прогресса', 'error');
            }
        };
        input.click();
    };
    
    document.getElementById('btn-srs-review').onclick = () => {
        const groupId = Groups.getSelectedGroup();
        if (!groupId) {
            showToast('Сначала выберите группу', 'error');
            return;
        }
        Game.showGameSettings(true);
    };
    
    document.getElementById('btn-play').onclick = () => Game.showGameSettings();
    
    document.getElementById('search-words').oninput = (e) => {
        Words.handleSearch(e.target.value);
    };
    
    document.querySelectorAll('.sortable').forEach(th => {
        th.onclick = () => {
            const field = th.dataset.sort;
            Words.handleSort(field);
        };
    });
    
    document.getElementById('select-all').onchange = (e) => {
        Words.handleSelectAll(e.target.checked);
    };
    
    document.getElementById('btn-move-selected').onclick = () => Words.handleBatchMove();
    document.getElementById('btn-copy-selected').onclick = () => Words.handleBatchCopy();
    document.getElementById('btn-delete-selected').onclick = () => Words.handleBatchDelete();
    
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.onclick = () => closeModal();
    });
    
    document.getElementById('modal-overlay').onclick = () => closeModal();
    
    // Игра
    document.getElementById('btn-exit-game').onclick = () => {
        if (confirm('Выйти из игры?')) {
            Game.exitGame();
        }
    };
    
    // Результаты
    document.getElementById('btn-play-same-words').onclick = () => {
        Game.restartWithSameWords();
    };
    
    document.getElementById('btn-play-again').onclick = () => {
        Game.restartWithNewWords();
    };
    
    document.getElementById('btn-change-settings').onclick = () => {
        Game.detachResultsKeyboardListener();
        showScreen('library');
        setTimeout(() => Game.showGameSettings(), 100);
    };
    
    document.getElementById('btn-to-library').onclick = () => {
        Game.detachResultsKeyboardListener();
        showScreen('library');
    };
    
    // Шаринг - копирование ссылки
    document.getElementById('btn-copy-link').onclick = function() {
        const linkInput = document.getElementById('share-link');
        linkInput.select();
        linkInput.setSelectionRange(0, 99999); // Для мобильных
        
        try {
            document.execCommand('copy');
            const btn = this;
            const originalText = btn.textContent;
            btn.textContent = '✓ Скопировано!';
            btn.style.background = 'var(--success)';
            
            setTimeout(() => {
                btn.textContent = originalText;
                btn.style.background = '';
            }, 2000);
        } catch (err) {
            // Fallback для современных браузеров
            navigator.clipboard.writeText(linkInput.value).then(() => {
                const btn = this;
                const originalText = btn.textContent;
                btn.textContent = '✓ Скопировано!';
                btn.style.background = 'var(--success)';
                
                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.style.background = '';
                }, 2000);
            }).catch(err => {
                showToast('Не удалось скопировать', 'error');
            });
        }
    };

    // Мобильное переключение групп
    document.getElementById('btn-toggle-groups').onclick = () => {
        const panel = document.querySelector('.groups-panel');
        panel.classList.toggle('mobile-show');
    };

    document.getElementById('btn-close-groups').onclick = () => {
        document.querySelector('.groups-panel').classList.remove('mobile-show');
    };

    // Инициализация SRS UI
    Game.updateSRSUI();
});
