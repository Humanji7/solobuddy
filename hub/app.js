/* ============================================
   SoloBuddy Hub — App Logic
   ============================================ */

// Data stores (loaded from API)
let sessionLogData = [];
let backlogData = [];
let draftsData = [];

// DOM Elements
const sessionLogContent = document.getElementById('session-log-content');
const backlogContent = document.getElementById('backlog-content');
const draftsContent = document.getElementById('drafts-content');
const addIdeaBtn = document.getElementById('add-idea-btn');
const modal = document.getElementById('add-idea-modal');
const modalClose = document.getElementById('modal-close');
const ideaForm = document.getElementById('idea-form');
const sessionLogBadge = document.querySelector('.session-log .badge');
const buddyMessageEl = document.getElementById('buddy-message');

// ============================================
// API Functions
// ============================================

async function fetchSessionLog() {
    try {
        const response = await fetch('/api/session-log');
        if (!response.ok) throw new Error('Failed to fetch session log');
        return await response.json();
    } catch (error) {
        console.error('Error fetching session log:', error);
        return [];
    }
}

async function fetchBacklog() {
    try {
        const response = await fetch('/api/backlog');
        if (!response.ok) throw new Error('Failed to fetch backlog');
        return await response.json();
    } catch (error) {
        console.error('Error fetching backlog:', error);
        return [];
    }
}

async function fetchDrafts() {
    try {
        const response = await fetch('/api/drafts');
        if (!response.ok) throw new Error('Failed to fetch drafts');
        return await response.json();
    } catch (error) {
        console.error('Error fetching drafts:', error);
        return [];
    }
}

async function saveIdea(idea) {
    try {
        const response = await fetch('/api/backlog', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(idea)
        });
        if (!response.ok) throw new Error('Failed to save idea');
        return await response.json();
    } catch (error) {
        console.error('Error saving idea:', error);
        throw error;
    }
}

async function fetchBuddyMessage() {
    try {
        const response = await fetch('/api/buddy-message');
        if (!response.ok) throw new Error('Failed to fetch buddy message');
        return await response.json();
    } catch (error) {
        console.error('Error fetching buddy message:', error);
        return { message: 'Привет! Проекты дышат ровно.', type: 'calm' };
    }
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

    // Update badge
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

function renderBuddyMessage(data) {
    const textEl = buddyMessageEl.querySelector('.message-text');
    const timeEl = buddyMessageEl.querySelector('.message-time');

    textEl.textContent = data.message;

    if (data.timestamp) {
        const time = new Date(data.timestamp);
        timeEl.textContent = time.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }

    buddyMessageEl.classList.remove('loading');
}

// ============================================
// Data Loading
// ============================================

async function loadAllData() {
    // Show loading state
    sessionLogContent.innerHTML = '<div class="loading">Loading...</div>';
    backlogContent.innerHTML = '<div class="loading">Loading...</div>';
    draftsContent.innerHTML = '<div class="loading">Loading...</div>';
    buddyMessageEl.classList.add('loading');

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
    renderBuddyMessage(buddyMessage);

    console.log('✅ SoloBuddy Hub loaded:', {
        sessionLog: sessionLogData.length,
        backlog: backlogData.length,
        drafts: draftsData.length,
        buddyMessage: buddyMessage.message
    });
}

// ============================================
// Modal Functions
// ============================================

function openModal() {
    modal.classList.add('active');
    document.getElementById('idea-title').focus();
}

function closeModal() {
    modal.classList.remove('active');
    ideaForm.reset();
}

// ============================================
// Event Listeners
// ============================================

addIdeaBtn.addEventListener('click', openModal);
modalClose.addEventListener('click', closeModal);

modal.addEventListener('click', (e) => {
    if (e.target === modal) {
        closeModal();
    }
});

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
        // Save to backend
        await saveIdea({ title, format, priority });

        // Reload backlog data
        backlogData = await fetchBacklog();
        renderBacklog();

        closeModal();

        // Visual feedback
        const firstItem = backlogContent.querySelector('.idea-item');
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

// ============================================
// GitHub OAuth Functions
// ============================================

// GitHub DOM Elements
const githubConnectBtn = document.getElementById('github-connect-btn');
const githubReposModal = document.getElementById('github-repos-modal');
const reposModalClose = document.getElementById('repos-modal-close');
const reposList = document.getElementById('repos-list');
const connectSelectedBtn = document.getElementById('connect-selected');

// Track selected repos
let selectedRepos = [];

async function checkGitHubStatus() {
    try {
        const response = await fetch('/api/github/status');
        const { connected } = await response.json();

        if (connected) {
            githubConnectBtn.textContent = '✓ GitHub Connected';
            githubConnectBtn.classList.add('connected');
        } else {
            githubConnectBtn.textContent = '🐙 Connect GitHub';
            githubConnectBtn.classList.remove('connected');
        }

        return connected;
    } catch (error) {
        console.error('Error checking GitHub status:', error);
        return false;
    }
}

function startGitHubAuth() {
    window.location.href = '/auth/github';
}

async function loadReposList() {
    reposList.innerHTML = '<div class="loading">Loading repositories...</div>';
    selectedRepos = [];
    updateConnectButton();

    try {
        const response = await fetch('/api/github/repos');
        if (!response.ok) {
            if (response.status === 401) {
                startGitHubAuth();
                return;
            }
            throw new Error('Failed to fetch repos');
        }

        const repos = await response.json();
        renderReposList(repos);
    } catch (error) {
        console.error('Error loading repos:', error);
        reposList.innerHTML = '<div class="empty-state">Failed to load repositories</div>';
    }
}

function renderReposList(repos) {
    if (repos.length === 0) {
        reposList.innerHTML = '<div class="empty-state">No repositories found</div>';
        return;
    }

    reposList.innerHTML = repos.map(repo => `
        <div class="repo-item" data-id="${repo.id}" data-repo='${JSON.stringify(repo)}'>
            <input type="checkbox" id="repo-${repo.id}">
            <div class="repo-info">
                <div class="repo-name">
                    ${repo.name}
                    ${repo.private ? '<span class="private-badge">Private</span>' : ''}
                </div>
                ${repo.description ? `<div class="repo-description">${repo.description}</div>` : ''}
                <div class="repo-meta">
                    Updated ${formatDate(repo.pushed_at)}
                </div>
            </div>
            ${repo.hasLocal ? '<span class="repo-local-badge">📁 Local</span>' : ''}
        </div>
    `).join('');

    // Add click handlers
    reposList.querySelectorAll('.repo-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.type !== 'checkbox') {
                const checkbox = item.querySelector('input[type="checkbox"]');
                checkbox.checked = !checkbox.checked;
            }
            toggleRepoSelection(item);
        });
    });
}

function toggleRepoSelection(item) {
    const checkbox = item.querySelector('input[type="checkbox"]');
    const repoData = JSON.parse(item.dataset.repo);

    if (checkbox.checked) {
        item.classList.add('selected');
        if (!selectedRepos.find(r => r.id === repoData.id)) {
            selectedRepos.push(repoData);
        }
    } else {
        item.classList.remove('selected');
        selectedRepos = selectedRepos.filter(r => r.id !== repoData.id);
    }

    updateConnectButton();
}

function updateConnectButton() {
    const count = selectedRepos.length;
    connectSelectedBtn.textContent = `Connect Selected (${count})`;
    connectSelectedBtn.disabled = count === 0;
}

async function connectSelectedRepos() {
    if (selectedRepos.length === 0) return;

    const originalText = connectSelectedBtn.textContent;
    connectSelectedBtn.textContent = 'Connecting...';
    connectSelectedBtn.disabled = true;

    try {
        const response = await fetch('/api/github/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ repos: selectedRepos })
        });

        const result = await response.json();

        if (result.success) {
            closeReposModal();
            showToast(`✓ Added ${result.added} project(s) to monitoring`);
            // Reload buddy message to reflect changes
            const buddyMessage = await fetchBuddyMessage();
            renderBuddyMessage(buddyMessage);
        } else {
            showToast(result.error || 'Failed to connect', true);
        }
    } catch (error) {
        console.error('Error connecting repos:', error);
        showToast('Failed to connect repositories', true);
    } finally {
        connectSelectedBtn.textContent = originalText;
        connectSelectedBtn.disabled = selectedRepos.length === 0;
    }
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
}

function showToast(message, isError = false) {
    const toast = document.createElement('div');
    toast.className = `toast ${isError ? 'error' : ''}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}

function openReposModal() {
    githubReposModal.classList.add('active');
    loadReposList();
}

function closeReposModal() {
    githubReposModal.classList.remove('active');
    selectedRepos = [];
}

// GitHub Event Listeners
githubConnectBtn.addEventListener('click', async () => {
    const connected = await checkGitHubStatus();
    if (connected) {
        openReposModal();
    } else {
        startGitHubAuth();
    }
});

reposModalClose.addEventListener('click', closeReposModal);

githubReposModal.addEventListener('click', (e) => {
    if (e.target === githubReposModal) {
        closeReposModal();
    }
});

connectSelectedBtn.addEventListener('click', connectSelectedRepos);

// Handle OAuth callback URL params
function handleOAuthCallback() {
    const params = new URLSearchParams(window.location.search);

    if (params.get('github_connected') === 'true') {
        // Clear URL params
        window.history.replaceState({}, '', window.location.pathname);
        // Open repos modal automatically
        setTimeout(() => openReposModal(), 500);
    }

    if (params.get('github_error')) {
        const error = params.get('github_error');
        window.history.replaceState({}, '', window.location.pathname);
        showToast(`GitHub error: ${error}`, true);
    }
}

// ============================================
// Initialize
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    loadAllData();
    checkGitHubStatus();
    handleOAuthCallback();
});
