/* ============================================
   Buddy Slots Module
   4-slot rotation system for buddy messages
   ============================================ */

// State
let insightsQueue = [];
let slotIndices = [0, 1, 2, 3];
let autoRotateInterval = null;
const AUTO_ROTATE_MS = 45000;

// DOM references
const buddyBlocks = {
    0: document.getElementById('buddy-0'),
    1: document.getElementById('buddy-1'),
    2: document.getElementById('buddy-2'),
    3: document.getElementById('buddy-3')
};

/**
 * Set insights queue from API response
 */
function setInsightsQueue(insights) {
    insightsQueue = insights || [];
}

/**
 * Get current insights queue
 */
function getInsightsQueue() {
    return insightsQueue;
}

/**
 * Render a buddy slot by index (0-3)
 */
function renderBuddySlot(slotIndex) {
    const block = buddyBlocks[slotIndex];
    const insightIndex = slotIndices[slotIndex];
    const insight = insightsQueue[insightIndex];

    if (!block || !insight) return;

    const textEl = block.querySelector('.message-text');
    if (textEl) {
        textEl.textContent = insight.message;
    }

    // Apply color
    if (insight.colorScheme) {
        block.style.setProperty('--buddy-accent', insight.colorScheme.accent);
    }

    // Reset classes and animate
    block.classList.remove('loading', 'dismissed', 'queue-empty');

    // Trigger appear animation
    block.classList.remove('appearing');
    void block.offsetWidth; // Force reflow
    block.classList.add('appearing');
}

/**
 * Dismiss and show next insight for a slot
 * @param {number|string} slotOrSide - Slot index (0-3) or legacy 'left'/'right'
 */
function dismissAndShowNext(slotOrSide) {
    // Convert legacy side to slot index
    let slotIndex;
    if (typeof slotOrSide === 'string') {
        slotIndex = slotOrSide === 'left' ? 0 : 1;
    } else {
        slotIndex = slotOrSide;
    }

    const block = buddyBlocks[slotIndex];
    if (!block) return;

    // Calculate next index (skip by 4 to avoid overlap with other slots)
    const currentIndex = slotIndices[slotIndex];
    const nextIndex = currentIndex + 4;

    if (nextIndex < insightsQueue.length) {
        slotIndices[slotIndex] = nextIndex;
        renderBuddySlot(slotIndex);
    } else {
        // Queue exhausted - hide permanently
        block.classList.add('dismissed', 'queue-empty');
    }
}

/**
 * Start auto-rotation carousel for all active slots
 */
function startAutoRotation() {
    if (autoRotateInterval) {
        clearInterval(autoRotateInterval);
    }

    autoRotateInterval = setInterval(() => {
        [0, 1, 2, 3].forEach(slotIndex => {
            const block = buddyBlocks[slotIndex];
            if (block &&
                !block.classList.contains('buddy-hidden') &&
                !block.classList.contains('queue-empty')) {
                dismissAndShowNext(slotIndex);
            }
        });
    }, AUTO_ROTATE_MS);
}

/**
 * Stop auto-rotation
 */
function stopAutoRotation() {
    if (autoRotateInterval) {
        clearInterval(autoRotateInterval);
        autoRotateInterval = null;
    }
}

/**
 * Render buddy message data into slots
 */
function renderBuddyMessage(data) {
    // Reset indices for all 4 slots
    slotIndices = [0, 1, 2, 3];

    // Render initial messages for visible slots (0 and 1)
    renderBuddySlot(0);
    renderBuddySlot(1);

    // If slots 2 and 3 are expanded, render them too
    if (buddyBlocks[2] && !buddyBlocks[2].classList.contains('buddy-hidden')) {
        renderBuddySlot(2);
    }
    if (buddyBlocks[3] && !buddyBlocks[3].classList.contains('buddy-hidden')) {
        renderBuddySlot(3);
    }

    // Update status text with project count
    if (data.projectsCount !== undefined) {
        const statusText = document.getElementById('status-text');
        if (statusText) {
            statusText.textContent = `Watching ${data.projectsCount} projects`;
        }
    }

    // Start auto-rotation
    startAutoRotation();
}

/**
 * Show loading state on buddy blocks
 */
function showBuddyLoading() {
    buddyBlocks[0]?.classList.add('loading');
    buddyBlocks[1]?.classList.add('loading');
}

/**
 * Save expand state to localStorage
 */
function saveBuddyExpandState() {
    const state = {
        leftExpanded: buddyBlocks[2] && !buddyBlocks[2].classList.contains('buddy-hidden'),
        rightExpanded: buddyBlocks[3] && !buddyBlocks[3].classList.contains('buddy-hidden')
    };
    localStorage.setItem('buddyExpandState', JSON.stringify(state));
}

/**
 * Load expand state from localStorage
 */
function loadBuddyExpandState() {
    try {
        const state = JSON.parse(localStorage.getItem('buddyExpandState'));
        if (state) {
            if (state.leftExpanded) expandBuddySlot('left');
            if (state.rightExpanded) expandBuddySlot('right');
        }
    } catch (e) {
        // Ignore parsing errors
    }
}

/**
 * Expand a buddy slot column
 */
function expandBuddySlot(column) {
    const col = document.querySelector(`.buddy-column-${column}`);
    if (!col) return;

    const hiddenMsg = col.querySelector('.buddy-hidden');
    const addBtn = col.querySelector('.buddy-add');
    const removeBtn = col.querySelector('.buddy-remove');

    if (hiddenMsg) {
        hiddenMsg.classList.remove('buddy-hidden');
        hiddenMsg.classList.add('buddy-expanded');
        if (addBtn) addBtn.style.display = 'none';
        if (removeBtn) removeBtn.style.display = 'block';

        // Fill with insight using the new slot system
        const slotIndex = column === 'left' ? 2 : 3;
        if (slotIndices[slotIndex] < insightsQueue.length) {
            renderBuddySlot(slotIndex);
        }
        saveBuddyExpandState();
    }
}

/**
 * Collapse a buddy slot column
 */
function collapseBuddySlot(column) {
    const col = document.querySelector(`.buddy-column-${column}`);
    if (!col) return;

    const expandedMsg = col.querySelector('.buddy-expanded');
    const addBtn = col.querySelector('.buddy-add');
    const removeBtn = col.querySelector('.buddy-remove');

    if (expandedMsg) {
        expandedMsg.classList.add('buddy-hidden');
        expandedMsg.classList.remove('buddy-expanded');
        if (addBtn) addBtn.style.display = 'block';
        if (removeBtn) removeBtn.style.display = 'none';
        saveBuddyExpandState();
    }
}

/**
 * Initialize buddy slots event listeners
 */
function initBuddySlots() {
    // Dismiss handlers for all buddy message slots (0-3)
    [0, 1, 2, 3].forEach(slotIndex => {
        const block = buddyBlocks[slotIndex];
        if (block) {
            const dismissBtn = block.querySelector('.buddy-dismiss');
            if (dismissBtn) {
                dismissBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    dismissAndShowNext(slotIndex);
                });
            }
        }
    });

    // Add button handlers
    document.querySelectorAll('.buddy-add').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const column = btn.dataset.column;
            expandBuddySlot(column);
        });
    });

    // Remove button handlers
    document.querySelectorAll('.buddy-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const column = btn.dataset.column;
            collapseBuddySlot(column);
        });
    });
}

// Export for global access
window.BuddySlots = {
    init: initBuddySlots,
    setInsightsQueue,
    getInsightsQueue,
    renderBuddyMessage,
    showLoading: showBuddyLoading,
    loadExpandState: loadBuddyExpandState,
    startAutoRotation,
    stopAutoRotation
};
