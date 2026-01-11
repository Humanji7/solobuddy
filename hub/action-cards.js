/* ============================================
   SoloBuddy Hub — Action Cards Components
   Nielsen-Approved Frontend Implementation
   ============================================ */

/**
 * Initialize keyboard navigation for Action Card (Nielsen: Flexibility/Efficiency)
 * - Enter = confirm primary action
 * - Esc = dismiss card
 * - Tab = cycle through focusable elements (browser native)
 * @param {HTMLElement} card - The action card element
 */
function initKeyboardNav(card) {
    // Make card focusable
    card.setAttribute('tabindex', '0');

    card.addEventListener('keydown', (e) => {
        // Esc = dismiss
        if (e.key === 'Escape') {
            e.preventDefault();
            card.querySelector('.card-dismiss')?.click();
        }

        // Enter = confirm (but not when on select/button to allow their native behavior)
        if (e.key === 'Enter' && !e.target.matches('select, button')) {
            e.preventDefault();
            card.querySelector('.btn-primary')?.click();
        }
    });

    // Auto-focus card on render for immediate keyboard use
    requestAnimationFrame(() => card.focus());
}

/**
 * Render an Action Card based on type
 * @param {Object} actionCard - Action card specification from intent-parser
 * @param {Object} options - { onAction, onDismiss, onFeedback }
 * @returns {HTMLElement}
 */
function renderActionCard(actionCard, options = {}) {
    if (!actionCard) return null;

    const { type } = actionCard;

    switch (type) {
        case 'AddIdeaCard':
            return renderAddIdeaCard(actionCard, options);
        case 'FindIdeaCard':
            return renderFindIdeaCard(actionCard, options);
        case 'ActivityCard':
            return renderActivityCard(actionCard, options);
        case 'ChangePriorityCard':
            return renderChangePriorityCard(actionCard, options);
        case 'ContentGeneratorCard':
            return renderContentGeneratorCard(actionCard, options);
        default:
            console.warn('Unknown action card type:', type);
            return null;
    }
}

/**
 * AddIdeaCard — Add new idea or link existing to backlog
 */
function renderAddIdeaCard(data, options = {}) {
    const {
        title,
        existingIdea,
        suggestedPriority,
        suggestedFormat,
        links,
        confidence,
        confidenceLevel,
        confidenceBadge,
        hasDuplicateWarning
    } = data;

    const card = document.createElement('div');
    card.className = 'action-card add-idea';
    card.dataset.cardType = 'AddIdeaCard';

    // Nielsen: Duplicate warning
    const duplicateLink = links?.find(l => l.type === 'duplicate_warning');

    // Phase 2: Find all project suggestions (with temporal scoring)
    const projectSuggestions = links?.filter(l =>
        l.type === 'project_suggestion' || l.type === 'recent_activity'
    ) || [];
    const topProjectSuggestion = projectSuggestions[0];

    card.innerHTML = `
        <button class="card-dismiss" aria-label="Закрыть">×</button>
        
        <div class="card-header">
            <div class="card-title">🔮 ${escapeHtml(title)}</div>
            <span class="confidence-badge ${confidenceLevel}">${confidenceBadge} ${confidence}%</span>
        </div>
        
        ${duplicateLink ? `
            <div class="card-suggestions warning">
                <span class="suggestion-text">${duplicateLink.suggestion}</span>
                <button class="link-btn" data-action="use-existing">Использовать</button>
            </div>
        ` : ''}
        
        <div class="card-controls">
            <select name="format" class="format-select">
                <option value="thread" ${suggestedFormat === 'thread' ? 'selected' : ''}>Thread</option>
                <option value="gif" ${suggestedFormat === 'gif' ? 'selected' : ''}>GIF + Caption</option>
                <option value="post" ${suggestedFormat === 'post' ? 'selected' : ''}>Short Post</option>
                <option value="video" ${suggestedFormat === 'video' ? 'selected' : ''}>Video</option>
            </select>
            
            <div class="priority-toggle">
                <button class="priority-btn ${suggestedPriority === 'high' ? 'active' : ''}" data-value="high">🔥</button>
                <button class="priority-btn ${suggestedPriority === 'medium' ? 'active' : ''}" data-value="medium">⚡</button>
                <button class="priority-btn ${suggestedPriority === 'low' ? 'active' : ''}" data-value="low">💭</button>
            </div>
        </div>
        
        ${projectSuggestions.length > 0 ? `
            <div class="card-suggestions project-suggestions">
                <span class="suggestion-label">📌 Проект:</span>
                <select name="project" class="project-select">
                    <option value="">— Без проекта —</option>
                    ${projectSuggestions.map((ps, idx) => `
                        <option value="${escapeHtml(ps.project)}" ${idx === 0 ? 'selected' : ''}>
                            ${escapeHtml(ps.project)} ${ps.score >= 100 ? '🔥' : ps.score >= 70 ? '⚡' : ''}
                        </option>
                    `).join('')}
                </select>
                ${topProjectSuggestion ? `
                    <span class="suggestion-hint">💡 ${escapeHtml(topProjectSuggestion.suggestion)}</span>
                ` : ''}
            </div>
        ` : ''}
        
        <div class="card-actions">
            <button class="btn-primary" data-action="add">Добавить</button>
            <button class="btn-secondary" data-action="cancel">Отмена</button>
        </div>
        
        <div class="card-feedback">
            <button class="feedback-btn positive" data-feedback="correct" title="Buddy понял правильно">👍</button>
            <button class="feedback-btn negative" data-feedback="wrong" title="Не то что я имел в виду">👎</button>
            <span class="not-this-link" data-action="not-this">Не то? Уточни</span>
        </div>
    `;

    // Bind event handlers
    bindAddIdeaCardEvents(card, data, options);

    // Phase 3: Keyboard navigation
    initKeyboardNav(card);

    return card;
}

/**
 * Bind events for AddIdeaCard
 */
function bindAddIdeaCardEvents(card, data, options) {
    // Dismiss
    card.querySelector('.card-dismiss').addEventListener('click', () => {
        card.remove();
        options.onDismiss?.();
    });

    // Priority toggle
    card.querySelectorAll('.priority-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            card.querySelectorAll('.priority-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    // Add button
    card.querySelector('[data-action="add"]').addEventListener('click', async () => {
        const format = card.querySelector('.format-select').value;
        const priority = card.querySelector('.priority-btn.active')?.dataset.value || 'medium';

        // Phase 2: Get selected project from dropdown
        const projectSelect = card.querySelector('.project-select');
        const project = projectSelect?.value || null;

        // Show loading
        card.classList.add('loading');

        try {
            const result = await options.onAction?.('add', {
                title: data.title,
                format,
                priority,
                project  // Phase 2: Pass selected project
            });

            // Success - remove card and show undo toast
            card.remove();
            showUndoToast(`Добавил "${data.title}" в backlog`, async () => {
                await options.onAction?.('undo', result);
            });

        } catch (error) {
            card.classList.remove('loading');
            showCardError(card, error.message || 'Не удалось добавить');
        }
    });

    // Cancel button
    card.querySelector('[data-action="cancel"]').addEventListener('click', () => {
        card.remove();
        options.onDismiss?.();
    });

    // Use existing (duplicate)
    const useExistingBtn = card.querySelector('[data-action="use-existing"]');
    if (useExistingBtn) {
        useExistingBtn.addEventListener('click', () => {
            options.onAction?.('use-existing', data.links.find(l => l.type === 'duplicate_warning')?.existingIdea);
            card.remove();
        });
    }

    // Add link to project
    const addLinkBtn = card.querySelector('[data-action="add-link"]');
    if (addLinkBtn) {
        addLinkBtn.addEventListener('click', () => {
            addLinkBtn.textContent = '✓ Связано';
            addLinkBtn.disabled = true;
        });
    }

    // Feedback buttons — Phase 3: Wire to API with visual confirmation
    card.querySelectorAll('.feedback-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const feedback = btn.dataset.feedback;

            // Call external handler if provided
            options.onFeedback?.(feedback, data);

            // Send to API for learning
            try {
                await fetch('/api/feedback', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        cardType: data.type || 'AddIdeaCard',
                        intent: data.title,
                        feedback,
                        timestamp: Date.now()
                    })
                });
            } catch (e) {
                console.error('Failed to send feedback:', e);
            }

            // Visual confirmation
            btn.style.transform = 'scale(1.3)';
            const originalContent = btn.textContent;
            btn.textContent = feedback === 'correct' ? '✓' : '✗';

            setTimeout(() => {
                btn.style.transform = '';
                // Fade out the feedback area
                const feedbackArea = card.querySelector('.card-feedback');
                if (feedbackArea) {
                    feedbackArea.style.opacity = '0.5';
                    feedbackArea.style.pointerEvents = 'none';
                }
            }, 500);
        });
    });

    // "Not this" link
    const notThisLink = card.querySelector('[data-action="not-this"]');
    if (notThisLink) {
        notThisLink.addEventListener('click', () => {
            options.onAction?.('clarify', data);
            card.remove();
        });
    }
}

/**
 * FindIdeaCard — Show found idea with options
 */
function renderFindIdeaCard(data, options = {}) {
    const { foundIdea, searchQuery, confidence, confidenceLevel, confidenceBadge } = data;

    const card = document.createElement('div');
    card.className = 'action-card find-idea';
    card.dataset.cardType = 'FindIdeaCard';

    if (foundIdea) {
        card.innerHTML = `
            <button class="card-dismiss" aria-label="Закрыть">×</button>
            
            <div class="card-header">
                <div class="card-title">🔍 Нашёл: ${escapeHtml(foundIdea.title)}</div>
                <span class="confidence-badge ${confidenceLevel}">${confidenceBadge} ${confidence}%</span>
            </div>
            
            <div class="card-controls">
                <span class="idea-meta">
                    ${getPriorityEmoji(foundIdea.priority)} ${foundIdea.priority} · ${foundIdea.format}
                </span>
            </div>
            
            <div class="card-actions">
                <button class="btn-primary" data-action="edit">Редактировать</button>
                <button class="btn-secondary" data-action="view">Показать</button>
            </div>
            
            <div class="card-feedback">
                <button class="feedback-btn positive" data-feedback="correct">👍</button>
                <button class="feedback-btn negative" data-feedback="wrong">👎</button>
                <span class="not-this-link" data-action="not-this">Не та идея</span>
            </div>
        `;
    } else {
        card.innerHTML = `
            <button class="card-dismiss" aria-label="Закрыть">×</button>
            
            <div class="card-header">
                <div class="card-title">🔍 Не нашёл "${escapeHtml(searchQuery)}"</div>
            </div>
            
            <div class="card-actions">
                <button class="btn-primary" data-action="create">Создать новую</button>
                <button class="btn-secondary" data-action="cancel">Отмена</button>
            </div>
        `;
    }

    // Bind events
    card.querySelector('.card-dismiss').addEventListener('click', () => {
        card.remove();
        options.onDismiss?.();
    });

    // Phase 3: Keyboard navigation
    initKeyboardNav(card);

    return card;
}

/**
 * Show error state on card (Nielsen: Error Recovery)
 */
function showCardError(card, message) {
    // Remove existing error
    const existingError = card.querySelector('.card-error');
    if (existingError) existingError.remove();

    card.classList.add('error');

    const errorDiv = document.createElement('div');
    errorDiv.className = 'card-error';
    errorDiv.innerHTML = `
        <span class="error-text">⚠️ ${escapeHtml(message)}</span>
        <button class="retry-btn">Повторить</button>
    `;

    errorDiv.querySelector('.retry-btn').addEventListener('click', () => {
        card.classList.remove('error');
        errorDiv.remove();
        // Re-trigger the add action
        card.querySelector('[data-action="add"]')?.click();
    });

    card.appendChild(errorDiv);
}

/**
 * Show Undo Toast (Nielsen: User Control)
 */
function showUndoToast(message, onUndo) {
    // Remove existing toast
    const existingToast = document.querySelector('.undo-toast');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.className = 'undo-toast';
    toast.innerHTML = `
        <span class="toast-text">${escapeHtml(message)}</span>
        <button class="undo-btn">Отменить</button>
    `;

    let timeout;

    const dismiss = () => {
        clearTimeout(timeout);
        toast.classList.add('hiding');
        setTimeout(() => toast.remove(), 300);
    };

    toast.querySelector('.undo-btn').addEventListener('click', async () => {
        dismiss();
        await onUndo?.();
    });

    document.body.appendChild(toast);

    // Auto-dismiss after 5 seconds
    timeout = setTimeout(dismiss, 5000);
}

/**
 * Show First-Run Tooltip (Nielsen: Help/Onboarding)
 */
function showFirstRunTooltip() {
    const STORAGE_KEY = 'solobuddy_first_run_dismissed';

    // Check if already dismissed
    if (localStorage.getItem(STORAGE_KEY)) return;

    const tooltip = document.createElement('div');
    tooltip.className = 'first-run-tooltip';
    tooltip.innerHTML = `
        <div class="tooltip-text">
            💡 <strong>Tip:</strong> Говори как хочешь — Buddy найдёт нужное!
            <br><br>
            Попробуй: "та штука про orb" или "добавь идею X"
        </div>
        <button class="tooltip-dismiss">Понятно!</button>
    `;

    tooltip.querySelector('.tooltip-dismiss').addEventListener('click', () => {
        localStorage.setItem(STORAGE_KEY, 'true');
        tooltip.remove();
    });

    document.body.appendChild(tooltip);

    // Auto-dismiss after 15 seconds
    setTimeout(() => {
        if (tooltip.parentNode) {
            localStorage.setItem(STORAGE_KEY, 'true');
            tooltip.remove();
        }
    }, 15000);
}

/**
 * Utility: Escape HTML
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Utility: Priority emoji
 */
function getPriorityEmoji(priority) {
    const emojis = { high: '🔥', medium: '⚡', low: '💭' };
    return emojis[priority] || '📌';
}

/**
 * Placeholder: Activity Card
 */
function renderActivityCard(data, options = {}) {
    const card = document.createElement('div');
    card.className = 'action-card activity';
    card.innerHTML = `
        <button class="card-dismiss" aria-label="Закрыть">×</button>
        <div class="card-header">
            <div class="card-title">📊 Activity Card (TODO Phase 2)</div>
        </div>
    `;

    card.querySelector('.card-dismiss').addEventListener('click', () => card.remove());
    return card;
}

/**
 * Placeholder: Change Priority Card
 */
function renderChangePriorityCard(data, options = {}) {
    const card = document.createElement('div');
    card.className = 'action-card change-priority';
    card.innerHTML = `
        <button class="card-dismiss" aria-label="Закрыть">×</button>
        <div class="card-header">
            <div class="card-title">⚡ Change Priority Card (TODO Phase 3)</div>
        </div>
    `;

    card.querySelector('.card-dismiss').addEventListener('click', () => card.remove());
    return card;
}

/**
 * ContentGeneratorCard — Generate BIP content with AI (Phase 4.1)
 */
function renderContentGeneratorCard(data, options = {}) {
    const { prompt, template, project, confidence, confidenceLevel, confidenceBadge } = data;

    const card = document.createElement('div');
    card.className = 'action-card content-generator';
    card.dataset.cardType = 'ContentGeneratorCard';

    // Determine template display name
    const templateNames = { thread: 'Thread 🧵', tip: 'Tip 💡', post: 'Post 📝' };
    const templateName = templateNames[template] || 'Thread 🧵';

    card.innerHTML = `
        <button class="card-dismiss" aria-label="Закрыть">×</button>
        
        <div class="card-header">
            <div class="card-title">✨ Генерация контента</div>
            <span class="confidence-badge ${confidenceLevel}">${confidenceBadge} ${confidence}%</span>
        </div>
        
        <div class="card-preview">
            <span class="preview-label">📝 Prompt:</span>
            <span class="preview-text">${escapeHtml(prompt.substring(0, 80))}${prompt.length > 80 ? '...' : ''}</span>
        </div>
        
        <div class="card-controls">
            <select name="template" class="template-select">
                <option value="thread" ${template === 'thread' ? 'selected' : ''}>Thread 🧵</option>
                <option value="tip" ${template === 'tip' ? 'selected' : ''}>Tip 💡</option>
                <option value="post" ${template === 'post' ? 'selected' : ''}>Post 📝</option>
            </select>
            
            <select name="persona" class="persona-select">
                <option value="jester-sage" selected>Jester-Sage 🎭</option>
                <option value="technical-writer">Technical Writer 📐</option>
            </select>
        </div>
        
        ${project ? `
            <div class="card-project">
                <span class="project-label">📁 Проект:</span>
                <span class="project-name">${escapeHtml(project)}</span>
            </div>
        ` : ''}
        
        <div class="card-actions">
            <button class="btn-primary" data-action="generate">🚀 Сгенерировать</button>
            <button class="btn-secondary" data-action="cancel">Отмена</button>
        </div>
        
        <div class="generation-progress" style="display: none;">
            <div class="progress-bar"><div class="progress-fill"></div></div>
            <span class="progress-text">Генерирую...</span>
        </div>
        
        <div class="card-feedback">
            <button class="feedback-btn positive" data-feedback="correct" title="Buddy понял правильно">👍</button>
            <button class="feedback-btn negative" data-feedback="wrong" title="Не то что я имел в виду">👎</button>
        </div>
    `;

    // Bind events
    bindContentGeneratorEvents(card, data, options);

    // Keyboard navigation
    initKeyboardNav(card);

    return card;
}

/**
 * Bind events for ContentGeneratorCard
 */
function bindContentGeneratorEvents(card, data, options) {
    // Dismiss
    card.querySelector('.card-dismiss').addEventListener('click', () => {
        card.remove();
        options.onDismiss?.();
    });

    // Cancel
    card.querySelector('[data-action="cancel"]').addEventListener('click', () => {
        card.remove();
        options.onDismiss?.();
    });

    // Generate button
    card.querySelector('[data-action="generate"]').addEventListener('click', async () => {
        const template = card.querySelector('.template-select').value;
        const persona = card.querySelector('.persona-select').value;

        // Show loading state
        const generateBtn = card.querySelector('[data-action="generate"]');
        const progressDiv = card.querySelector('.generation-progress');
        const progressFill = card.querySelector('.progress-fill');
        const progressText = card.querySelector('.progress-text');

        generateBtn.disabled = true;
        generateBtn.textContent = '⏳ Генерирую...';
        progressDiv.style.display = 'block';

        // Animate progress bar
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress = Math.min(progress + 5, 90);
            progressFill.style.width = progress + '%';
        }, 300);

        try {
            const response = await fetch('/api/content/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: data.prompt,
                    template,
                    persona,
                    project: data.project
                })
            });

            clearInterval(progressInterval);

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Generation failed');
            }

            const result = await response.json();

            // Complete progress
            progressFill.style.width = '100%';
            progressText.textContent = '✓ Готово!';

            // Push to Post Editor
            if (window.pushToEditor) {
                window.pushToEditor(result.content);
            }

            // Show success and remove card
            setTimeout(() => {
                card.remove();
                if (typeof showToast === 'function') {
                    showToast(`✓ Контент сгенерирован (${result.metadata?.tokensUsed || '?'} tokens)`);
                }
            }, 500);

        } catch (error) {
            clearInterval(progressInterval);
            progressDiv.style.display = 'none';
            generateBtn.disabled = false;
            generateBtn.textContent = '🚀 Сгенерировать';
            showCardError(card, error.message || 'Ошибка генерации');
        }
    });

    // Feedback buttons
    card.querySelectorAll('.feedback-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const feedback = btn.dataset.feedback;

            try {
                await fetch('/api/feedback', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        cardType: 'ContentGeneratorCard',
                        intent: data.prompt.substring(0, 100),
                        feedback,
                        timestamp: Date.now()
                    })
                });
            } catch (e) {
                console.error('Failed to send feedback:', e);
            }

            // Visual confirmation
            btn.style.transform = 'scale(1.3)';
            btn.textContent = feedback === 'correct' ? '✓' : '✗';

            setTimeout(() => {
                btn.style.transform = '';
                const feedbackArea = card.querySelector('.card-feedback');
                if (feedbackArea) {
                    feedbackArea.style.opacity = '0.5';
                    feedbackArea.style.pointerEvents = 'none';
                }
            }, 500);
        });
    });
}

// Export for use in app.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        renderActionCard,
        showUndoToast,
        showFirstRunTooltip,
        showCardError
    };
}
