import * as storage from './storage.js';
import * as groups from './groups.js';
import * as words from './words.js';
import * as importer from './importer.js';
import * as game from './game.js';

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupEventListeners();
});

function initApp() {
    // Загрузить и отобразить группы
    groups.renderGroupsTree();
    words.renderWordsView();
    
    // Настроить импорт
    importer.setupImportHandlers();
    
    // Настроить игру
    game.setupGameSettingsHandlers();
}

function setupEventListeners() {
    // Библиотека - группы
    document.getElementById('btn-new-group').onclick = () => {
        const name = prompt('Имя новой группы:');
        if (name && name.trim()) {
            storage.addGroup(name.trim(), null);
            groups.renderGroupsTree();
            groups.showToast('Группа создана', 'success');
        }
    };
    
    // Welcome блок кнопки
    document.querySelectorAll('.btn-welcome-group').forEach(btn => {
        btn.onclick = () => {
            const name = prompt('Имя новой группы:');
            if (name && name.trim()) {
                storage.addGroup(name.trim(), null);
                groups.renderGroupsTree();
                words.renderWordsView();
                groups.showToast('Группа создана', 'success');
            }
        };
    });
    
    document.querySelectorAll('.btn-welcome-import').forEach(btn => {
        btn.onclick = () => importer.showImportModal();
    });
    
    // События выбора группы
    window.addEventListener('group-selected', () => {
        words.renderWordsView();
    });
    
    window.addEventListener('words-moved', () => {
        groups.renderGroupsTree();
        words.renderWordsList();
    });
    
    // Контекстное меню групп
    document.getElementById('context-menu').addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        const groupId = document.getElementById('context-menu').dataset.groupId;
        if (action && groupId) {
            groups.handleContextMenuAction(action, groupId);
        }
    });
    
    // Библиотека - слова
    document.getElementById('btn-add-word').onclick = () => words.showAddWordModal();
    document.getElementById('btn-import-txt').onclick = () => importer.showImportModal();
    document.getElementById('btn-export-json').onclick = () => {
        storage.exportData();
        groups.showToast('Данные экспортированы', 'success');
    };
    document.getElementById('btn-play').onclick = () => game.showGameSettings();
    
    // Поиск по словам
    document.getElementById('search-words').oninput = (e) => {
        words.handleSearch(e.target.value);
    };
    
    // Сортировка
    document.querySelectorAll('.sortable').forEach(th => {
        th.onclick = () => {
            const field = th.dataset.sort;
            words.handleSort(field);
        };
    });
    
    // Чекбокс "Выбрать всё"
    document.getElementById('select-all').onchange = (e) => {
        words.handleSelectAll(e.target.checked);
    };
    
    // Групповые действия
    document.getElementById('btn-move-selected').onclick = () => words.handleBatchMove();
    document.getElementById('btn-copy-selected').onclick = () => words.handleBatchCopy();
    document.getElementById('btn-delete-selected').onclick = () => words.handleBatchDelete();
    
    // Модальные окна
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.onclick = () => words.closeModal();
    });
    
    document.getElementById('modal-overlay').onclick = () => words.closeModal();
    
    // Игра
    document.getElementById('btn-exit-game').onclick = () => {
        if (confirm('Выйти из игры?')) {
            game.exitGame();
        }
    };
    
    // Результаты
    document.getElementById('btn-play-again').onclick = () => {
        game.showScreen('library');
        setTimeout(() => game.showGameSettings(), 100);
    };
    
    document.getElementById('btn-change-settings').onclick = () => {
        game.showScreen('library');
        setTimeout(() => game.showGameSettings(), 100);
    };
    
    document.getElementById('btn-to-library').onclick = () => {
        game.showScreen('library');
    };
}
