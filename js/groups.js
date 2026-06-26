import * as storage from './storage.js';

let selectedGroupId = null;
let expandedGroups = new Set();

function getSelectedGroup() {
    return selectedGroupId;
}

function setSelectedGroup(id) {
    selectedGroupId = id;
}

function renderGroupsTree() {
    const container = document.getElementById('groups-tree');
    const groups = storage.getAllGroups();
    
    if (groups.length === 0) {
        container.innerHTML = '<div style="padding: 1rem; color: var(--text-muted); text-align: center;">Нет групп</div>';
        return;
    }
    
    container.innerHTML = '';
    
    function renderGroup(group, level = 0) {
        const words = storage.getWordsByGroup(group.id);
        const children = groups.filter(g => g.parentId === group.id);
        const hasChildren = children.length > 0;
        const isExpanded = expandedGroups.has(group.id);
        const isActive = selectedGroupId === group.id;
        
        // Подсчёт слов включая подгруппы
        function countWordsRecursive(gid) {
            let count = storage.getWordsByGroup(gid).length;
            const childs = groups.filter(g => g.parentId === gid);
            childs.forEach(c => count += countWordsRecursive(c.id));
            return count;
        }
        
        const totalWords = countWordsRecursive(group.id);
        
        const item = document.createElement('div');
        item.className = `group-item ${isActive ? 'active' : ''}`;
        item.style.paddingLeft = `${level * 16 + 8}px`;
        item.dataset.groupId = group.id;
        item.draggable = false;
        
        const toggle = document.createElement('span');
        toggle.className = 'group-toggle';
        toggle.textContent = hasChildren ? (isExpanded ? '▼' : '▶') : '';
        toggle.onclick = (e) => {
            e.stopPropagation();
            if (hasChildren) {
                if (isExpanded) {
                    expandedGroups.delete(group.id);
                } else {
                    expandedGroups.add(group.id);
                }
                renderGroupsTree();
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
            showContextMenu(e, group.id);
        };
        
        item.appendChild(toggle);
        item.appendChild(name);
        item.appendChild(count);
        item.appendChild(menuBtn);
        
        item.onclick = () => {
            selectedGroupId = group.id;
            renderGroupsTree();
            window.dispatchEvent(new CustomEvent('group-selected', { detail: group.id }));
        };
        
        // Drag and drop
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
            const wordIds = JSON.parse(e.dataTransfer.getData('text/plain'));
            if (wordIds && wordIds.length > 0) {
                storage.moveWords(wordIds, group.id);
                window.dispatchEvent(new CustomEvent('words-moved'));
            }
        });
        
        container.appendChild(item);
        
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
}

function showContextMenu(event, groupId) {
    const menu = document.getElementById('context-menu');
    menu.style.display = 'block';
    menu.style.left = event.pageX + 'px';
    menu.style.top = event.pageY + 'px';
    menu.dataset.groupId = groupId;
    
    // Закрыть при клике вне меню
    setTimeout(() => {
        document.addEventListener('click', function closeMenu() {
            menu.style.display = 'none';
            document.removeEventListener('click', closeMenu);
        });
    }, 0);
}

function handleContextMenuAction(action, groupId) {
    const group = storage.getGroup(groupId);
    if (!group) return;
    
    switch (action) {
        case 'rename':
            const newName = prompt('Новое имя группы:', group.name);
            if (newName && newName.trim()) {
                storage.updateGroup(groupId, { name: newName.trim() });
                renderGroupsTree();
                showToast('Группа переименована', 'success');
            }
            break;
            
        case 'add-subgroup':
            const subName = prompt('Имя подгруппы:');
            if (subName && subName.trim()) {
                storage.addGroup(subName.trim(), groupId);
                expandedGroups.add(groupId);
                renderGroupsTree();
                showToast('Подгруппа создана', 'success');
            }
            break;
            
        case 'move-words':
            // TODO: показать диалог выбора целевой группы
            const targetId = prompt('ID целевой группы:');
            if (targetId) {
                const words = storage.getWordsByGroup(groupId);
                storage.moveWords(words.map(w => w.id), targetId);
                window.dispatchEvent(new CustomEvent('words-moved'));
                showToast(`Перемещено ${words.length} слов`, 'success');
            }
            break;
            
        case 'merge':
            // TODO: диалог выбора группы для слияния
            const mergeId = prompt('ID группы для слияния:');
            if (mergeId) {
                const words = storage.getWordsByGroup(mergeId);
                storage.moveWords(words.map(w => w.id), groupId);
                storage.deleteGroup(mergeId);
                renderGroupsTree();
                window.dispatchEvent(new CustomEvent('words-moved'));
                showToast('Группы объединены', 'success');
            }
            break;
            
        case 'split':
            // TODO: диалог выбора слов для выноса
            showToast('Функция в разработке', 'error');
            break;
            
        case 'delete':
            const words = storage.getWordsByGroup(groupId);
            const allGroups = storage.getAllGroups();
            const children = allGroups.filter(g => g.parentId === groupId);
            
            let msg = `Удалить группу "${group.name}"?`;
            if (words.length > 0) msg += `\n(${words.length} слов)`;
            if (children.length > 0) msg += `\n(${children.length} подгрупп)`;
            
            if (confirm(msg)) {
                storage.deleteGroup(groupId);
                if (selectedGroupId === groupId) {
                    selectedGroupId = null;
                }
                renderGroupsTree();
                window.dispatchEvent(new CustomEvent('group-selected', { detail: null }));
                showToast('Группа удалена', 'success');
            }
            break;
    }
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

function getGroupsForSelect(excludeId = null) {
    const groups = storage.getAllGroups();
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
}

function getAllChildGroups(groupId) {
    const groups = storage.getAllGroups();
    const result = [groupId];
    let i = 0;
    while (i < result.length) {
        const children = groups.filter(g => g.parentId === result[i]);
        result.push(...children.map(c => c.id));
        i++;
    }
    return result;
}

export {
    getSelectedGroup,
    setSelectedGroup,
    renderGroupsTree,
    showContextMenu,
    handleContextMenuAction,
    showToast,
    getGroupsForSelect,
    getAllChildGroups,
    expandedGroups
};
