/* ============================================
   Idea Modal Module
   Add idea modal and AI drafts modal
   ============================================ */

// Idea Modal DOM Elements
const addIdeaBtn = document.getElementById('add-idea-btn');
const modal = document.getElementById('add-idea-modal');
const modalClose = document.getElementById('modal-close');
const ideaForm = document.getElementById('idea-form');

/**
 * Open idea modal
 */
function openModal() {
    modal.classList.add('active');
    document.getElementById('idea-title').focus();
}

/**
 * Close idea modal
 */
function closeModal() {
    modal.classList.remove('active');
    ideaForm.reset();
}

/**
 * Initialize idea modal event listeners
 */
function initIdeaModal() {
    if (addIdeaBtn) {
        addIdeaBtn.addEventListener('click', openModal);
    }

    if (modalClose) {
        modalClose.addEventListener('click', closeModal);
    }

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
    }

    if (ideaForm) {
        ideaForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const title = document.getElementById('idea-title').value;
            const format = document.getElementById('idea-format').value;
            const priority = document.getElementById('idea-priority').value;

            const submitBtn = ideaForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Saving...';
            submitBtn.disabled = true;

            try {
                await window.saveIdea({ title, format, priority });

                // Reload backlog data
                if (window.refreshBacklog) {
                    await window.refreshBacklog();
                }

                closeModal();

                // Visual feedback
                const backlogContent = document.getElementById('backlog-content');
                const firstItem = backlogContent?.querySelector('.idea-item');
                if (firstItem) {
                    firstItem.style.animation = 'slideUp 0.3s ease';
                }
            } catch (error) {
                alert('Failed to save idea. Please try again.');
            } finally {
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }
        });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
        }
        if (e.key === 'n' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            openModal();
        }
    });
}

// ============================================
// AI Drafts Modal
// ============================================

const aiDraftsBtn = document.getElementById('ai-drafts-btn');
const aiDraftsModal = document.getElementById('ai-drafts-modal');
const aiDraftsModalClose = document.getElementById('ai-drafts-modal-close');
const aiDraftsList = document.getElementById('ai-drafts-list');
const draftsCount = document.getElementById('drafts-count');

/**
 * Load AI drafts from API
 */
async function loadAiDrafts() {
    aiDraftsList.innerHTML = '<div class="loading">Loading drafts...</div>';
    try {
        const response = await fetch('/api/ai-drafts');
        const drafts = await response.json();

        if (draftsCount) draftsCount.textContent = drafts.length;

        if (drafts.length === 0) {
            aiDraftsList.innerHTML = '<div class="empty-state">No saved drafts.<br>They will appear automatically after generation.</div>';
            return;
        }

        aiDraftsList.innerHTML = drafts.map(draft => `
            <div class="ai-draft-item" data-id="${draft.id}">
                <div class="draft-header">
                    <span class="draft-template">${draft.template === 'thread' ? '🧵' : draft.template === 'tip' ? '💡' : '📝'} ${draft.template}</span>
                    ${draft.project ? `<span class="draft-project">📁 ${draft.project}</span>` : ''}
                    <span class="draft-time">${formatRelativeTime(draft.timestamp)}</span>
                </div>
                <div class="draft-preview">${escapeHtml(draft.content.substring(0, 150))}${draft.content.length > 150 ? '...' : ''}</div>
                <div class="draft-actions">
                    <button class="draft-copy" data-content="${encodeURIComponent(draft.content)}">📋 Copy</button>
                    <button class="draft-use" data-content="${encodeURIComponent(draft.content)}">✎ Use</button>
                    <button class="draft-delete" data-id="${draft.id}">🗑</button>
                </div>
            </div>
        `).join('');

        // Bind events
        aiDraftsList.querySelectorAll('.draft-copy').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const content = decodeURIComponent(btn.dataset.content);
                await navigator.clipboard.writeText(content);
                btn.textContent = '✓ Copied';
                setTimeout(() => btn.textContent = '📋 Copy', 1500);
            });
        });

        aiDraftsList.querySelectorAll('.draft-use').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const content = decodeURIComponent(btn.dataset.content);
                if (window.pushToEditor) {
                    window.pushToEditor(content);
                }
                closeAiDraftsModal();
            });
        });

        aiDraftsList.querySelectorAll('.draft-delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                await fetch(`/api/ai-drafts/${id}`, { method: 'DELETE' });
                loadAiDrafts();
            });
        });

    } catch (error) {
        console.error('Error loading AI drafts:', error);
        aiDraftsList.innerHTML = '<div class="empty-state">Failed to load drafts</div>';
    }
}

/**
 * Format timestamp to relative time
 */
function formatRelativeTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
}

/**
 * Escape HTML entities
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Open AI drafts modal
 */
function openAiDraftsModal() {
    aiDraftsModal.classList.add('active');
    loadAiDrafts();
}

/**
 * Close AI drafts modal
 */
function closeAiDraftsModal() {
    aiDraftsModal.classList.remove('active');
}

/**
 * Initialize AI drafts modal
 */
function initAiDraftsModal() {
    if (aiDraftsBtn) {
        aiDraftsBtn.addEventListener('click', openAiDraftsModal);
    }
    if (aiDraftsModalClose) {
        aiDraftsModalClose.addEventListener('click', closeAiDraftsModal);
    }
    if (aiDraftsModal) {
        aiDraftsModal.addEventListener('click', (e) => {
            if (e.target === aiDraftsModal) closeAiDraftsModal();
        });
    }

    // Load initial count
    fetch('/api/ai-drafts').then(r => r.json()).then(d => {
        if (draftsCount) draftsCount.textContent = d.length || 0;
    }).catch(() => { });
}

// Export for global access
window.IdeaModal = {
    init: initIdeaModal,
    open: openModal,
    close: closeModal
};

window.AiDraftsModal = {
    init: initAiDraftsModal,
    open: openAiDraftsModal,
    close: closeAiDraftsModal,
    load: loadAiDrafts
};

// Utils export
window.escapeHtml = escapeHtml;
window.formatRelativeTime = formatRelativeTime;
