import * as storage from './storage.js';
import * as groups from './groups.js';

let gameState = null;

function startGame(settings) {
    gameState = {
        words: settings.words,
        pairs: [],
        matched: 0,
        errors: 0,
        startTime: Date.now(),
        timeLimit: settings.timeLimit,
        showTimer: settings.showTimer,
        selectedLeft: null,
        timerInterval: null,
        groupName: settings.groupName
    };
    
    // Перемешать и создать пары
    const shuffledWords = [...gameState.words].sort(() => Math.random() - 0.5);
    gameState.pairs = shuffledWords.slice(0, settings.pairsCount);
    
    // Показать экран игры
    showScreen('game');
    renderGameField();
    
    // Запустить таймер
    if (gameState.timeLimit > 0) {
        startTimer();
    }
    
    // Обновить заголовок
    document.getElementById('game-group-name').textContent = `Группа: ${gameState.groupName}`;
    updateProgress();
}

function renderGameField() {
    const leftColumn = document.getElementById('left-column');
    const rightColumn = document.getElementById('right-column');
    
    leftColumn.innerHTML = '';
    rightColumn.innerHTML = '';
    
    // Левый столбец (слова) - перемешанные
    const leftCards = [...gameState.pairs].sort(() => Math.random() - 0.5);
    leftCards.forEach(word => {
        const card = createCard(word.front, word.id, 'left');
        leftColumn.appendChild(card);
    });
    
    // Правый столбец (переводы) - перемешанные
    const rightCards = [...gameState.pairs].sort(() => Math.random() - 0.5);
    rightCards.forEach(word => {
        const card = createCard(word.back, word.id, 'right');
        rightColumn.appendChild(card);
    });
}

function createCard(text, wordId, side) {
    const card = document.createElement('div');
    card.className = 'card';
    card.textContent = text;
    card.dataset.wordId = wordId;
    card.dataset.side = side;
    
    card.onclick = () => handleCardClick(card, wordId, side);
    
    return card;
}

function handleCardClick(card, wordId, side) {
    if (card.classList.contains('correct')) return;
    
    if (side === 'left') {
        // Выбор левой карточки
        document.querySelectorAll('.card[data-side="left"]').forEach(c => {
            c.classList.remove('selected');
        });
        card.classList.add('selected');
        gameState.selectedLeft = wordId;
    } else {
        // Выбор правой карточки - проверка
        if (!gameState.selectedLeft) return;
        
        const leftCard = document.querySelector(`.card[data-side="left"][data-word-id="${gameState.selectedLeft}"]`);
        
        if (gameState.selectedLeft === wordId) {
            // Правильно!
            card.classList.add('correct');
            leftCard.classList.add('correct');
            
            setTimeout(() => {
                card.style.display = 'none';
                leftCard.style.display = 'none';
                gameState.matched++;
                updateProgress();
                
                // Проверка на завершение
                if (gameState.matched === gameState.pairs.length) {
                    endGame(true);
                }
            }, 600);
        } else {
            // Неправильно
            card.classList.add('wrong');
            leftCard.classList.add('wrong');
            gameState.errors++;
            
            setTimeout(() => {
                card.classList.remove('wrong');
                leftCard.classList.remove('wrong');
                leftCard.classList.remove('selected');
            }, 300);
        }
        
        gameState.selectedLeft = null;
    }
}

function startTimer() {
    const timerBar = document.getElementById('timer-bar');
    const timerText = document.getElementById('game-timer');
    
    if (!gameState.showTimer) {
        timerBar.style.display = 'none';
        timerText.style.display = 'none';
    }
    
    let elapsed = 0;
    
    gameState.timerInterval = setInterval(() => {
        elapsed++;
        const remaining = gameState.timeLimit - elapsed;
        
        if (remaining <= 0) {
            endGame(false);
            return;
        }
        
        // Обновить таймер
        if (gameState.showTimer) {
            const mins = Math.floor(remaining / 60);
            const secs = remaining % 60;
            timerText.textContent = `⏱ ${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
            
            // Прогресс-бар
            const percent = (remaining / gameState.timeLimit) * 100;
            timerBar.style.width = percent + '%';
            
            // Цвет по времени
            if (percent > 50) {
                timerBar.className = 'timer-bar';
            } else if (percent > 20) {
                timerBar.className = 'timer-bar warning';
            } else {
                timerBar.className = 'timer-bar danger';
            }
        }
    }, 1000);
}

function updateProgress() {
    const progressEl = document.getElementById('game-progress');
    progressEl.textContent = `✓ ${gameState.matched}/${gameState.pairs.length}`;
}

function endGame(completed) {
    if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
    }
    
    const elapsedTime = Math.floor((Date.now() - gameState.startTime) / 1000);
    const score = gameState.matched * 10 - gameState.errors * 3;
    
    showResults({
        completed,
        matched: gameState.matched,
        total: gameState.pairs.length,
        time: elapsedTime,
        errors: gameState.errors,
        score: Math.max(0, score)
    });
}

function showResults(results) {
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
}

function showGameSettings() {
    const groupId = groups.getSelectedGroup();
    if (!groupId) {
        groups.showToast('Сначала выберите группу', 'error');
        return;
    }
    
    const modal = document.getElementById('modal-game-settings');
    const overlay = document.getElementById('modal-overlay');
    
    // Загрузить настройки
    const settings = storage.getSettings();
    
    document.getElementById('pairs-count').value = settings.pairsCount || 6;
    document.getElementById('pairs-count-value').textContent = settings.pairsCount || 6;
    document.getElementById('show-timer').checked = settings.showTimer !== false;
    
    // Установить активное время
    document.querySelectorAll('.pill').forEach(pill => {
        pill.classList.remove('active');
        if (parseInt(pill.dataset.time) === (settings.timeLimit || 30)) {
            pill.classList.add('active');
        }
    });
    
    // Текущая группа
    const group = storage.getGroup(groupId);
    document.getElementById('game-source-current-label').textContent = `Текущая группа (${group.name})`;
    
    overlay.classList.add('active');
    modal.classList.add('active');
}

function setupGameSettingsHandlers() {
    const pairsSlider = document.getElementById('pairs-count');
    const pairsValue = document.getElementById('pairs-count-value');
    
    pairsSlider.oninput = () => {
        pairsValue.textContent = pairsSlider.value;
    };
    
    // Pills для времени
    document.querySelectorAll('.pill').forEach(pill => {
        pill.onclick = () => {
            document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
        };
    });
    
    // Начать игру
    document.getElementById('btn-start-game').onclick = () => {
        const groupId = groups.getSelectedGroup();
        const sourceType = document.querySelector('input[name="game-source"]:checked').value;
        
        let words = [];
        
        if (sourceType === 'current') {
            words = storage.getWordsByGroup(groupId);
        } else if (sourceType === 'recursive') {
            const allGroupIds = groups.getAllChildGroups(groupId);
            allGroupIds.forEach(gid => {
                words.push(...storage.getWordsByGroup(gid));
            });
        }
        
        const pairsCount = parseInt(document.getElementById('pairs-count').value);
        const timeLimit = parseInt(document.querySelector('.pill.active').dataset.time);
        const showTimer = document.getElementById('show-timer').checked;
        
        // Проверка достаточности слов
        if (words.length < pairsCount) {
            document.getElementById('game-warning').textContent = `В выбранном источнике только ${words.length} слов. Количество пар автоматически уменьшено.`;
            document.getElementById('game-warning').style.display = 'block';
            document.getElementById('pairs-count').value = words.length;
            document.getElementById('pairs-count-value').textContent = words.length;
            return;
        } else {
            document.getElementById('game-warning').style.display = 'none';
        }
        
        // Сохранить настройки
        storage.updateSettings({ pairsCount, timeLimit, showTimer });
        
        // Закрыть модал
        document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
        document.getElementById('modal-overlay').classList.remove('active');
        
        // Начать игру
        const group = storage.getGroup(groupId);
        startGame({
            words,
            pairsCount,
            timeLimit,
            showTimer,
            groupName: group.name
        });
    };
}

function showScreen(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(`screen-${name}`).classList.add('active');
}

function exitGame() {
    if (gameState && gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
    }
    gameState = null;
    showScreen('library');
}

export {
    startGame,
    showGameSettings,
    setupGameSettingsHandlers,
    showScreen,
    exitGame,
    showResults
};
