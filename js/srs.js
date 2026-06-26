// SRS Module — Spaced Repetition System (SM-2)
// Отдельный localStorage ключ: 'wm_progress'

const SRS_KEY = 'wm_progress';

const SRS = {
    // ═══════════════════════════════════════
    // ХРАНИЛИЩЕ
    // ═══════════════════════════════════════

    loadProgress() {
        try {
            const raw = localStorage.getItem(SRS_KEY);
            if (!raw) return { version: 1, streak: 0, lastStudyDate: null, words: {} };
            return JSON.parse(raw);
        } catch (e) {
            console.error('SRS: ошибка загрузки прогресса:', e);
            return { version: 1, streak: 0, lastStudyDate: null, words: {} };
        }
    },

    saveProgress(progress) {
        try {
            localStorage.setItem(SRS_KEY, JSON.stringify(progress));
        } catch (e) {
            console.error('SRS: ошибка сохранения прогресса:', e);
        }
    },

    // ═══════════════════════════════════════
    // ДАТЫ
    // ═══════════════════════════════════════

    today() {
        const d = new Date();
        return d.getFullYear() + '-' +
            String(d.getMonth() + 1).padStart(2, '0') + '-' +
            String(d.getDate()).padStart(2, '0');
    },

    addDays(dateStr, days) {
        const d = new Date(dateStr + 'T00:00:00');
        d.setDate(d.getDate() + days);
        return d.getFullYear() + '-' +
            String(d.getMonth() + 1).padStart(2, '0') + '-' +
            String(d.getDate()).padStart(2, '0');
    },

    formatDateRu(dateStr) {
        if (!dateStr) return '—';
        const months = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
        const d = new Date(dateStr + 'T00:00:00');
        const today = this.today();
        const tomorrow = this.addDays(today, 1);
        const yesterday = this.addDays(today, -1);

        if (dateStr === today) return 'сегодня';
        if (dateStr === tomorrow) return 'завтра';
        if (dateStr === yesterday) return 'вчера';
        return d.getDate() + ' ' + months[d.getMonth()];
    },

    // ═══════════════════════════════════════
    // SM-2 АЛГОРИТМ
    // ═══════════════════════════════════════

    sm2(word, quality) {
        // quality: 0-2 = провал, 3 = с трудом, 4 = хорошо, 5 = легко
        if (quality < 3) {
            word.repetitions = 0;
            word.interval = 1;
        } else {
            if (word.repetitions === 0) word.interval = 1;
            else if (word.repetitions === 1) word.interval = 3;
            else word.interval = Math.round(word.interval * word.easiness);
            word.repetitions += 1;
        }

        word.easiness = Math.max(
            1.3,
            word.easiness + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
        );

        word.nextReview = this.addDays(this.today(), word.interval);
        word.lastReview = this.today();
        return word;
    },

    getDefaultWordProgress() {
        return {
            interval: 0,
            easiness: 2.5,
            repetitions: 0,
            nextReview: null,
            lastReview: null
        };
    },

    // ═══════════════════════════════════════
    // QUALITY — определение из игры
    // ═══════════════════════════════════════

    computeQuality(errors, elapsedMs, matched) {
        if (!matched) return 0; // Не угадано (таймер)
        if (errors >= 2) return 2;
        if (errors === 1) return 3;
        // 0 ошибок
        if (elapsedMs < 4000) return 5; // Быстро
        return 4; // Нормально
    },

    // ═══════════════════════════════════════
    // ОБРАБОТКА РЕЗУЛЬТАТОВ РАУНДА
    // ═══════════════════════════════════════

    processRoundResults(allPairs, pairQuality, completed) {
        const progress = this.loadProgress();
        const summary = { learned: 0, inProgress: 0, regressed: 0, nextReview: null };

        allPairs.forEach(pair => {
            const wordId = pair.id;
            const quality = (wordId in pairQuality) ? pairQuality[wordId] : 0;

            if (!progress.words[wordId]) {
                progress.words[wordId] = this.getDefaultWordProgress();
            }

            const before = { ...progress.words[wordId] };
            this.sm2(progress.words[wordId], quality);
            const after = progress.words[wordId];

            // Считаем статистику
            if (after.interval > 21 && before.interval <= 21) {
                summary.learned++;
            } else if (quality < 3) {
                summary.regressed++;
            } else if (after.repetitions > before.repetitions) {
                summary.inProgress++;
            }

            // Ближайший повтор
            if (after.nextReview) {
                if (!summary.nextReview || after.nextReview < summary.nextReview) {
                    summary.nextReview = after.nextReview;
                }
            }
        });

        this.saveProgress(progress);
        return summary;
    },

    // ═══════════════════════════════════════
    // STREAK
    // ═══════════════════════════════════════

    updateStreak() {
        const progress = this.loadProgress();
        const today = this.today();
        const yesterday = this.addDays(today, -1);

        if (progress.lastStudyDate === today) {
            // Уже играли сегодня — не трогаем
        } else if (progress.lastStudyDate === yesterday) {
            progress.streak = (progress.streak || 0) + 1;
        } else {
            progress.streak = 1;
        }
        progress.lastStudyDate = today;
        this.saveProgress(progress);
        return progress.streak;
    },

    getStreak() {
        const progress = this.loadProgress();
        const today = this.today();
        const yesterday = this.addDays(today, -1);
        // Актуальный streak: если последний день = сегодня или вчера
        if (progress.lastStudyDate === today || progress.lastStudyDate === yesterday) {
            return progress.streak || 0;
        }
        return 0;
    },

    // ═══════════════════════════════════════
    // СТАТУСЫ СЛОВ
    // ═══════════════════════════════════════

    getWordStatus(wordId) {
        const progress = this.loadProgress();
        const w = progress.words[wordId];
        if (!w) return { status: 'new', icon: '🔴', label: 'Новое слово', tooltip: 'Новое слово' };

        const today = this.today();
        const isDue = w.nextReview && w.nextReview <= today;

        if (isDue) {
            return {
                status: 'due',
                icon: '📅',
                label: 'К повтору',
                tooltip: 'К повтору сегодня'
            };
        }
        if (w.interval > 21) {
            return {
                status: 'learned',
                icon: '🟢',
                label: 'Выучено',
                tooltip: 'Выучено (интервал ' + w.interval + ' дн.)'
            };
        }
        if (w.repetitions > 0) {
            return {
                status: 'learning',
                icon: '🟡',
                label: 'Изучается',
                tooltip: 'Следующий повтор: ' + this.formatDateRu(w.nextReview)
            };
        }
        return { status: 'new', icon: '🔴', label: 'Новое слово', tooltip: 'Новое слово' };
    },

    // ═══════════════════════════════════════
    // ОЧЕРЕДЬ ПОВТОРА
    // ═══════════════════════════════════════

    getDueWords(groupIds) {
        // groupIds — массив ID групп, null = вся библиотека
        const progress = this.loadProgress();
        const today = this.today();

        // Собираем все слова из указанных групп
        let allWords = [];
        if (groupIds && groupIds.length > 0) {
            groupIds.forEach(gid => {
                allWords.push(...Storage.getWordsByGroup(gid));
            });
        } else {
            // Вся библиотека
            const groups = Storage.getAllGroups();
            groups.forEach(g => {
                allWords.push(...Storage.getWordsByGroup(g.id));
            });
        }

        const overdue = [];
        const dueToday = [];
        const newWords = [];

        allWords.forEach(word => {
            const wp = progress.words[word.id];
            if (!wp) {
                newWords.push(word);
            } else if (wp.nextReview && wp.nextReview < today) {
                overdue.push(word);
            } else if (wp.nextReview && wp.nextReview === today) {
                dueToday.push(word);
            }
        });

        // Приоритет: просроченные → сегодня → новые
        // Лимит: макс 20, новых макс 10
        const result = [];
        result.push(...overdue);
        result.push(...dueToday);

        const remainingSlots = 20 - result.length;
        if (remainingSlots > 0) {
            const newLimit = Math.min(remainingSlots, 10);
            result.push(...newWords.slice(0, newLimit));
        }

        return result.slice(0, 20);
    },

    getDueCount(groupIds) {
        return this.getDueWords(groupIds).length;
    },

    // ═══════════════════════════════════════
    // СТАТИСТИКА ГРУППЫ
    // ═══════════════════════════════════════

    getStats(groupId) {
        const progress = this.loadProgress();
        const today = this.today();

        // Получаем все слова группы (рекурсивно)
        let wordIds = [];
        if (groupId) {
            const allGroupIds = Groups.getAllChildGroups(groupId);
            allGroupIds.forEach(gid => {
                Storage.getWordsByGroup(gid).forEach(w => wordIds.push(w.id));
            });
        } else {
            Storage.getAllGroups().forEach(g => {
                Storage.getWordsByGroup(g.id).forEach(w => wordIds.push(w.id));
            });
        }

        const stats = { total: wordIds.length, newCount: 0, learning: 0, learned: 0, due: 0 };

        wordIds.forEach(id => {
            const w = progress.words[id];
            if (!w) {
                stats.newCount++;
                return;
            }
            const isDue = w.nextReview && w.nextReview <= today;
            if (isDue) stats.due++;
            if (w.interval > 21) stats.learned++;
            else if (w.repetitions > 0) stats.learning++;
            else stats.newCount++;
        });

        stats.percent = stats.total > 0 ? Math.round((stats.learned / stats.total) * 100) : 0;
        return stats;
    },

    // ═══════════════════════════════════════
    // ЭКСПОРТ / ИМПОРТ ПРОГРЕССА
    // ═══════════════════════════════════════

    exportProgress() {
        const progress = this.loadProgress();
        const json = JSON.stringify(progress, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'wordmatcher-progress.json';
        a.click();
        URL.revokeObjectURL(url);
    },

    importProgress(data, mode) {
        // mode: 'replace' или 'merge'
        try {
            const parsed = typeof data === 'string' ? JSON.parse(data) : data;
            if (!parsed.words) throw new Error('Неверный формат');

            if (mode === 'replace') {
                this.saveProgress(parsed);
                return true;
            }

            // Merge — берём запись с более поздним lastReview
            const current = this.loadProgress();
            for (const wordId in parsed.words) {
                const incoming = parsed.words[wordId];
                const existing = current.words[wordId];
                if (!existing || (incoming.lastReview && (!existing.lastReview || incoming.lastReview > existing.lastReview))) {
                    current.words[wordId] = incoming;
                }
            }
            // Streak — берём больший если дата свежее
            if (parsed.lastStudyDate && (!current.lastStudyDate || parsed.lastStudyDate >= current.lastStudyDate)) {
                current.streak = Math.max(current.streak || 0, parsed.streak || 0);
                current.lastStudyDate = parsed.lastStudyDate;
            }
            this.saveProgress(current);
            return true;
        } catch (e) {
            console.error('SRS: ошибка импорта:', e);
            return false;
        }
    },

    getProgressPreview(data) {
        try {
            const parsed = typeof data === 'string' ? JSON.parse(data) : data;
            const wordCount = parsed.words ? Object.keys(parsed.words).length : 0;
            const streak = parsed.streak || 0;
            const date = parsed.lastStudyDate || '—';
            return { wordCount, streak, date, valid: true };
        } catch (e) {
            return { valid: false };
        }
    }
};
