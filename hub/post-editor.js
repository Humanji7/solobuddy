/* ============================================
   Post Editor Panel — Logic
   ============================================ */

// Panel elements (initialized after DOM ready)
let postEditorPanel = null;
let postEditorOverlay = null;
let postTextarea = null;
let charCounter = null;

// Twitter character limit
const TWITTER_LIMIT = 280;

/**
 * Initialize Post Editor (call from app.js after DOM ready)
 */
function initPostEditor() {
    postEditorPanel = document.getElementById('post-editor-panel');
    postEditorOverlay = document.getElementById('post-editor-overlay');
    postTextarea = document.getElementById('post-content');
    charCounter = document.getElementById('char-counter');

    if (!postEditorPanel) {
        console.warn('Post Editor panel not found in DOM');
        return;
    }

    // Close button
    const closeBtn = postEditorPanel.querySelector('.post-editor-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', closePostEditor);
    }

    // Overlay click to close
    if (postEditorOverlay) {
        postEditorOverlay.addEventListener('click', closePostEditor);
    }

    // Character counter
    if (postTextarea && charCounter) {
        postTextarea.addEventListener('input', updateCharCounter);
    }

    // Copy button
    const copyBtn = document.getElementById('copy-draft-btn');
    if (copyBtn) {
        copyBtn.addEventListener('click', copyDraft);
    }

    // Keyboard shortcut: Escape to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && postEditorPanel?.classList.contains('open')) {
            closePostEditor();
        }
    });

    console.log('Post Editor initialized');
}

/**
 * Open the Post Editor panel
 * @param {string} content - Optional initial content
 */
function openPostEditor(content = '') {
    if (!postEditorPanel) return;

    if (content && postTextarea) {
        postTextarea.value = content;
        updateCharCounter();
    }

    postEditorPanel.classList.add('open');
    if (postEditorOverlay) {
        postEditorOverlay.classList.add('visible');
    }

    // Focus textarea
    setTimeout(() => {
        postTextarea?.focus();
    }, 300);
}

/**
 * Close the Post Editor panel
 */
function closePostEditor() {
    if (!postEditorPanel) return;

    postEditorPanel.classList.remove('open');
    if (postEditorOverlay) {
        postEditorOverlay.classList.remove('visible');
    }
}

/**
 * Update character counter based on textarea content
 */
function updateCharCounter() {
    if (!postTextarea || !charCounter) return;

    const length = postTextarea.value.length;
    charCounter.textContent = `${length} / ${TWITTER_LIMIT}`;

    // Visual feedback
    charCounter.classList.remove('warning', 'danger');
    if (length > TWITTER_LIMIT) {
        charCounter.classList.add('danger');
    } else if (length > TWITTER_LIMIT - 30) {
        charCounter.classList.add('warning');
    }
}

/**
 * Copy draft content to clipboard
 */
async function copyDraft() {
    if (!postTextarea) return;

    const content = postTextarea.value;
    if (!content.trim()) {
        showToast('Nothing to copy', true);
        return;
    }

    try {
        await navigator.clipboard.writeText(content);

        // Visual feedback
        const copyBtn = document.getElementById('copy-draft-btn');
        if (copyBtn) {
            const original = copyBtn.innerHTML;
            copyBtn.classList.add('copied');
            copyBtn.innerHTML = '✓ Copied!';

            setTimeout(() => {
                copyBtn.classList.remove('copied');
                copyBtn.innerHTML = original;
            }, 2000);
        }

        showToast('Copied to clipboard');
    } catch (err) {
        console.error('Failed to copy:', err);
        showToast('Failed to copy', true);
    }
}

/**
 * Push content to editor from external source (buddy, chat, etc.)
 * Global API for integration
 */
window.pushToEditor = function (content) {
    openPostEditor(content);
};

// Export for use in app.js
window.initPostEditor = initPostEditor;
window.openPostEditor = openPostEditor;
window.closePostEditor = closePostEditor;
