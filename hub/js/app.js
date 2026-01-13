/* ============================================
   SoloBuddy Hub — Main App Controller
   Orchestrates all UI modules
   ============================================ */

// ============================================
// Data Stores
// ============================================

let sessionLogData = [];
let backlogData = [];
let draftsData = [];

// ============================================
// DOM Elements
// ============================================

const sessionLogContent = document.getElementById('session-log-content');
const backlogContent = document.getElementById('backlog-content');
const draftsContent = document.getElementById('drafts-content');
const sessionLogBadge = document.querySelector('.session-log .badge');

// ============================================
// API Functions
// ============================================

async function fetchApi(endpoint, defaultValue = []) {
    try {
        const response = await fetch(endpoint);
        if (!response.ok) throw new Error(`Failed to fetch ${endpoint}`);
        return await response.json();
    } catch (error) {
        console.error(`Error fetching ${endpoint}:`, error);
        return defaultValue;
    }
}

const fetchSessionLog = () => fetchApi('/api/session-log');
const fetchBacklog = () => fetchApi('/api/backlog');
const fetchDrafts = () => fetchApi('/api/drafts');

async function fetchBuddyMessage() {
    const data = await fetchApi('/api/buddy-message', { insights: [], projectsCount: 0 });
    window.BuddySlots.setInsightsQueue(data.insights || []);
    return data;
}

async function saveIdea(idea) {
    const response = await fetch('/api/backlog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(idea)
    });
    if (!response.ok) throw new Error('Failed to save idea');
    return await response.json();
}

// ============================================
// Render Functions
// ============================================

function renderSessionLog() {
    if (sessionLogData.length === 0) {
        sessionLogContent.innerHTML = '<div class="empty-state">No moments captured yet</div>';
        return;
    }

    sessionLogContent.innerHTML = sessionLogData.map(moment => `
        <div class="moment-item" data-id="${moment.id}">
            <div class="item-title">${moment.emoji} ${moment.title}</div>
            <div class="item-hook">"${moment.hook}"</div>
            <div class="item-meta">
                <span>📅 ${moment.date}</span>
                <span>📋 ${moment.format}</span>
            </div>
        </div>
    `).join('');

    if (sessionLogBadge) {
        sessionLogBadge.textContent = `${sessionLogData.length} moments`;
    }
}

function renderBacklog() {
    if (backlogData.length === 0) {
        backlogContent.innerHTML = '<div class="empty-state">No ideas yet. Add one!</div>';
        return;
    }

    backlogContent.innerHTML = backlogData.map(idea => `
        <div class="idea-item ${idea.priority}" data-id="${idea.id}">
            <div class="item-title">${idea.title}</div>
            ${idea.hook ? `<div class="item-hook">"${idea.hook}"</div>` : ''}
            <div class="item-meta">
                <span>📋 ${idea.format}</span>
                <span class="priority-badge">${getPriorityEmoji(idea.priority)} ${idea.priority}</span>
            </div>
        </div>
    `).join('');
}

function renderDrafts() {
    if (draftsData.length === 0) {
        draftsContent.innerHTML = '<div class="empty-state">No drafts yet</div>';
        return;
    }

    draftsContent.innerHTML = draftsData.map(draft => `
        <div class="draft-item" data-id="${draft.id}">
            <div class="item-title">📄 ${draft.title}</div>
            <div class="item-meta">
                <span>${draft.filename}</span>
                <span class="status-badge ${draft.status}">${getStatusEmoji(draft.status)} ${draft.status}</span>
            </div>
        </div>
    `).join('');
}

function getPriorityEmoji(priority) {
    const emojis = {
        high: '🔥',
        medium: '⚡',
        low: '💭'
    };
    return emojis[priority] || '📌';
}

function getStatusEmoji(status) {
    const emojis = {
        'in-progress': '🔄',
        'ready': '✅',
        'draft': '📝'
    };
    return emojis[status] || '📄';
}

// ============================================
// Toast Notifications
// ============================================

function showToast(message, isError = false) {
    const toast = document.createElement('div');
    toast.className = `toast ${isError ? 'error' : ''}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// ============================================
// Data Loading
// ============================================

async function loadAllData() {
    // Show loading state
    sessionLogContent.innerHTML = '<div class="loading">Loading...</div>';
    backlogContent.innerHTML = '<div class="loading">Loading...</div>';
    draftsContent.innerHTML = '<div class="loading">Loading...</div>';
    window.BuddySlots.showLoading();

    // Fetch all data in parallel
    const [sessionLog, backlog, drafts, buddyMessage] = await Promise.all([
        fetchSessionLog(),
        fetchBacklog(),
        fetchDrafts(),
        fetchBuddyMessage()
    ]);

    sessionLogData = sessionLog;
    backlogData = backlog;
    draftsData = drafts;

    // Render
    renderSessionLog();
    renderBacklog();
    renderDrafts();
    window.BuddySlots.renderBuddyMessage(buddyMessage);

    console.log('SoloBuddy Hub loaded:', {
        sessionLog: sessionLogData.length,
        backlog: backlogData.length,
        drafts: draftsData.length,
        insights: window.BuddySlots.getInsightsQueue().length
    });
}

/**
 * Refresh backlog data and re-render
 */
async function refreshBacklog() {
    backlogData = await fetchBacklog();
    renderBacklog();
}

/**
 * Refresh buddy message data
 */
async function refreshBuddyMessage() {
    const buddyMessage = await fetchBuddyMessage();
    window.BuddySlots.renderBuddyMessage(buddyMessage);
}

// ============================================
// Global Exports
// ============================================

window.showToast = showToast;
window.saveIdea = saveIdea;
window.refreshBacklog = refreshBacklog;
window.refreshBuddyMessage = refreshBuddyMessage;
window.fetchBacklog = fetchBacklog;

// ============================================
// Initialize
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Initialize all modules
    window.BuddySlots.init();
    window.GitHubUI.init();
    window.LocalProjectsUI.init();
    window.ChatUI.init();
    window.IdeaModal.init();
    window.AiDraftsModal.init();
    window.VoiceModal.init();
    window.MyPostsModal.init();

    // Load data
    loadAllData();

    // Check and trigger user onboarding for first-time users
    if (typeof checkUserOnboarding === 'function') {
        checkUserOnboarding();
    }

    // Load buddy expand state from localStorage
    window.BuddySlots.loadExpandState();

    // Check GitHub status and handle OAuth callback
    window.GitHubUI.checkStatus();
    window.GitHubUI.handleOAuthCallback();

    // Load chat history
    window.ChatUI.loadHistory();

    // Initialize Post Editor
    if (typeof initPostEditor === 'function') {
        initPostEditor();
    }

    // Editor toggle button
    const editorToggleBtn = document.getElementById('editor-toggle-btn');
    if (editorToggleBtn) {
        editorToggleBtn.addEventListener('click', () => {
            if (typeof openPostEditor === 'function') {
                openPostEditor();
            }
        });
    }

    // Nielsen: Show first-run tooltip for new users
    if (typeof showFirstRunTooltip === 'function') {
        setTimeout(showFirstRunTooltip, 2000);
    }
});
