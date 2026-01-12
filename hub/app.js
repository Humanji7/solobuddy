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

// Buddy message elements (4 slots: 0,1 visible, 2,3 hidden by default)
const buddyBlocks = {
    0: document.getElementById('buddy-0'),
    1: document.getElementById('buddy-1'),
    2: document.getElementById('buddy-2'),
    3: document.getElementById('buddy-3')
};

// ============================================
// Buddy Queue System (4-slot rotation)
// ============================================

let insightsQueue = [];       // All insights from server
let slotIndices = [0, 1, 2, 3]; // Current insight index for each slot
let autoRotateInterval = null;
const AUTO_ROTATE_MS = 45000; // 45 seconds

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

async function saveIdea(idea) {
    const response = await fetch('/api/backlog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(idea)
    });
    if (!response.ok) throw new Error('Failed to save idea');
    return await response.json();
}

async function fetchBuddyMessage() {
    const data = await fetchApi('/api/buddy-message', { insights: [], projectsCount: 0 });
    insightsQueue = data.insights || [];
    return data;
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
        // Queue exhausted — hide permanently
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
        // Rotate all visible slots that aren't exhausted
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
 * Stop auto-rotation (e.g., on page unload)
 */
function stopAutoRotation() {
    if (autoRotateInterval) {
        clearInterval(autoRotateInterval);
        autoRotateInterval = null;
    }
}

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

// ============================================
// Expandable Buddy Messages (+/- buttons)
// ============================================

function saveBuddyExpandState() {
    const state = {
        leftExpanded: buddyBlocks[2] && !buddyBlocks[2].classList.contains('buddy-hidden'),
        rightExpanded: buddyBlocks[3] && !buddyBlocks[3].classList.contains('buddy-hidden')
    };
    localStorage.setItem('buddyExpandState', JSON.stringify(state));
}

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
        // Ensure slotIndices is properly set for this slot
        if (slotIndices[slotIndex] < insightsQueue.length) {
            renderBuddySlot(slotIndex);
        }
        saveBuddyExpandState();
    }
}

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

// ============================================
// Data Loading
// ============================================

async function loadAllData() {
    // Show loading state
    sessionLogContent.innerHTML = '<div class="loading">Loading...</div>';
    backlogContent.innerHTML = '<div class="loading">Loading...</div>';
    draftsContent.innerHTML = '<div class="loading">Loading...</div>';
    buddyBlocks[0]?.classList.add('loading');
    buddyBlocks[1]?.classList.add('loading');

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
        insights: insightsQueue.length
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
        <div class="repo-item ${repo.alreadyConnected ? 'connected' : ''}" data-id="${repo.id}" data-repo='${JSON.stringify(repo)}'>
            <input type="checkbox" id="repo-${repo.id}" ${repo.alreadyConnected ? 'disabled checked' : ''}>
            <div class="repo-info">
                <div class="repo-name">
                    ${repo.name}
                    ${repo.private ? '<span class="private-badge">Private</span>' : ''}
                    ${repo.alreadyConnected ? '<span class="connected-badge">✓ Connected</span>' : ''}
                </div>
                ${repo.description ? `<div class="repo-description">${repo.description}</div>` : ''}
                <div class="repo-meta">
                    Updated ${formatDate(repo.pushed_at)}
                </div>
            </div>
            ${repo.hasLocal ? '<span class="repo-local-badge">📁 Local</span>' : ''}
        </div>
    `).join('');

    // Add click handlers (skip connected items)
    reposList.querySelectorAll('.repo-item:not(.connected)').forEach(item => {
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
// Local Projects Functions
// ============================================

// Local Projects DOM Elements
const localConnectBtn = document.getElementById('local-connect-btn');
const localReposModal = document.getElementById('local-repos-modal');
const localModalClose = document.getElementById('local-modal-close');
const localReposList = document.getElementById('local-repos-list');
const connectLocalSelectedBtn = document.getElementById('connect-local-selected');

// Track selected local projects
let selectedLocalProjects = [];

async function loadLocalProjects() {
    localReposList.innerHTML = '<div class="loading">Scanning local directories...</div>';
    selectedLocalProjects = [];
    updateLocalConnectButton();

    try {
        const response = await fetch('/api/local/scan');
        if (!response.ok) throw new Error('Failed to scan local projects');

        const projects = await response.json();
        renderLocalProjects(projects);
    } catch (error) {
        console.error('Error loading local projects:', error);
        localReposList.innerHTML = '<div class="empty-state">Failed to scan local projects</div>';
    }
}

function renderLocalProjects(projects) {
    if (projects.length === 0) {
        localReposList.innerHTML = '<div class="empty-state">No new local Git projects found</div>';
        return;
    }

    localReposList.innerHTML = projects.map(proj => `
        <div class="repo-item" data-path="${proj.path}" data-project='${JSON.stringify(proj)}'>
            <input type="checkbox" id="local-${proj.path.replace(/\//g, '-')}">
            <div class="repo-info">
                <div class="repo-name">
                    ${proj.name}
                    ${proj.remoteUrl ? '<span class="github-badge">🐙 Remote</span>' : '<span class="local-only-badge">📂 Local Only</span>'}
                </div>
                <div class="repo-meta">
                    ${proj.path}
                </div>
            </div>
        </div>
    `).join('');

    // Add click handlers
    localReposList.querySelectorAll('.repo-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.type !== 'checkbox') {
                const checkbox = item.querySelector('input[type="checkbox"]');
                checkbox.checked = !checkbox.checked;
            }
            toggleLocalProjectSelection(item);
        });
    });
}

function toggleLocalProjectSelection(item) {
    const checkbox = item.querySelector('input[type="checkbox"]');
    const projectData = JSON.parse(item.dataset.project);

    if (checkbox.checked) {
        item.classList.add('selected');
        if (!selectedLocalProjects.find(p => p.path === projectData.path)) {
            selectedLocalProjects.push(projectData);
        }
    } else {
        item.classList.remove('selected');
        selectedLocalProjects = selectedLocalProjects.filter(p => p.path !== projectData.path);
    }

    updateLocalConnectButton();
}

function updateLocalConnectButton() {
    const count = selectedLocalProjects.length;
    connectLocalSelectedBtn.textContent = `Connect Selected (${count})`;
    connectLocalSelectedBtn.disabled = count === 0;
}

async function connectSelectedLocalProjects() {
    if (selectedLocalProjects.length === 0) return;

    const originalText = connectLocalSelectedBtn.textContent;
    connectLocalSelectedBtn.textContent = 'Connecting...';
    connectLocalSelectedBtn.disabled = true;

    try {
        const response = await fetch('/api/local/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projects: selectedLocalProjects })
        });

        const result = await response.json();

        if (result.success) {
            closeLocalModal();
            showToast(`✓ Added ${result.added} project(s) to monitoring`);
            // Reload buddy message to reflect changes
            const buddyMessage = await fetchBuddyMessage();
            renderBuddyMessage(buddyMessage);
        } else {
            showToast(result.error || 'Failed to connect', true);
        }
    } catch (error) {
        console.error('Error connecting local projects:', error);
        showToast('Failed to connect local projects', true);
    } finally {
        connectLocalSelectedBtn.textContent = originalText;
        connectLocalSelectedBtn.disabled = selectedLocalProjects.length === 0;
    }
}

function openLocalModal() {
    localReposModal.classList.add('active');
    loadLocalProjects();
}

function closeLocalModal() {
    localReposModal.classList.remove('active');
    selectedLocalProjects = [];
}

// Local Projects Event Listeners
localConnectBtn.addEventListener('click', openLocalModal);
localModalClose.addEventListener('click', closeLocalModal);

localReposModal.addEventListener('click', (e) => {
    if (e.target === localReposModal) {
        closeLocalModal();
    }
});

connectLocalSelectedBtn.addEventListener('click', connectSelectedLocalProjects);

// ============================================
// Chat Interface Functions
// ============================================

const CHAT_STORAGE_KEY = 'solobuddy_chat_history';
const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const chatSubmit = chatForm.querySelector('.chat-submit');

let chatHistory = [];
let isTyping = false;

function loadChatHistory() {
    try {
        const stored = localStorage.getItem(CHAT_STORAGE_KEY);
        if (stored) {
            chatHistory = JSON.parse(stored);
            chatHistory.forEach(msg => renderChatMessage(msg.role, msg.text, false));
            scrollChatToBottom();
        }
    } catch (e) {
        console.error('Error loading chat history:', e);
        chatHistory = [];
    }
}

function saveChatHistory() {
    try {
        // Keep only last 50 messages
        const toSave = chatHistory.slice(-50);
        localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(toSave));
    } catch (e) {
        console.error('Error saving chat history:', e);
    }
}

function renderChatMessage(role, text, animate = true) {
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${role}`;
    if (!animate) bubble.style.animation = 'none';

    const p = document.createElement('p');
    // Simple markdown-ish: convert \n to <br>
    p.innerHTML = text.replace(/\n/g, '<br>');
    bubble.appendChild(p);

    chatMessages.appendChild(bubble);
    scrollChatToBottom();
}

function scrollChatToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showTypingIndicator() {
    if (isTyping) return;
    isTyping = true;

    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.id = 'typing-indicator';
    indicator.innerHTML = '<span></span><span></span><span></span>';
    chatMessages.appendChild(indicator);
    scrollChatToBottom();
}

function hideTypingIndicator() {
    isTyping = false;
    const indicator = document.getElementById('typing-indicator');
    if (indicator) indicator.remove();
}

async function sendChatMessage(text) {
    if (!text.trim()) return;

    // Add user message
    chatHistory.push({ role: 'user', text });
    renderChatMessage('user', text);
    saveChatHistory();

    // Disable input while waiting
    chatInput.disabled = true;
    chatSubmit.disabled = true;
    showTypingIndicator();

    try {
        // ============================================
        // Step 1: Check for actionable intent first
        // ============================================
        const intentResponse = await fetch('/api/intent/parse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text })
        });

        if (intentResponse.ok) {
            const intentData = await intentResponse.json();

            // If we have an actionable intent with high enough confidence, show Action Card
            if (intentData.actionCard && intentData.confidence >= 60) {
                hideTypingIndicator();

                // Render Action Card in chat
                const card = renderActionCard(intentData.actionCard, {
                    onAction: async (action, data) => {
                        if (action === 'add') {
                            // Add to backlog via existing API (Phase 2: include project)
                            const response = await fetch('/api/backlog', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    title: data.title,
                                    format: data.format,
                                    priority: data.priority,
                                    project: data.project || null  // Phase 2: project linking
                                })
                            });

                            if (!response.ok) {
                                throw new Error('Failed to add idea');
                            }

                            // Refresh backlog display
                            backlogData = await fetchBacklog();
                            renderBacklog();

                            return { id: Date.now(), ...data }; // Return for undo
                        }

                        if (action === 'clarify') {
                            // User said "not this" - add follow-up prompt
                            chatInput.value = 'No, I meant ';
                            chatInput.focus();
                        }
                    },
                    onDismiss: () => {
                        // User dismissed card - continue with normal chat
                        console.log('Action card dismissed');
                    },
                    onFeedback: (type, data) => {
                        console.log('Feedback:', type, data);
                        // TODO: Store feedback for learning
                    }
                });

                if (card) {
                    chatMessages.appendChild(card);
                    scrollChatToBottom();

                    // Add a brief buddy acknowledgment
                    chatHistory.push({
                        role: 'buddy',
                        text: `Got it! ${intentData.intentType === 'add_to_backlog' ? 'Adding idea?' : 'Here\'s what I found:'}`
                    });
                    saveChatHistory();

                    chatInput.disabled = false;
                    chatSubmit.disabled = false;
                    chatInput.focus();
                    return; // Don't proceed to Claude chat
                }
            }
        }

        // ============================================
        // Step 2: Fallback to Claude chat if no Action Card
        // ============================================

        // Build history for API (convert role names)
        const apiHistory = chatHistory.slice(-10).map(m => ({
            role: m.role === 'buddy' ? 'assistant' : m.role,
            content: m.text
        }));

        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: text,
                history: apiHistory.slice(0, -1) // Exclude current message (server adds it)
            })
        });

        hideTypingIndicator();

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to get response');
        }

        const data = await response.json();

        // Add buddy response
        chatHistory.push({ role: 'buddy', text: data.response });
        renderChatMessage('buddy', data.response);
        saveChatHistory();

    } catch (error) {
        hideTypingIndicator();
        console.error('Chat error:', error);
        showToast(error.message || 'Chat error', true);
    } finally {
        chatInput.disabled = false;
        chatSubmit.disabled = false;
        chatInput.focus();
    }
}

chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (text) {
        sendChatMessage(text);
        chatInput.value = '';
    }
});

// Keyboard: Enter to send, Escape to clear
chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        chatInput.value = '';
    }
});

// ============================================
// Initialize
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    loadAllData();
    loadBuddyExpandState();
    checkGitHubStatus();
    handleOAuthCallback();
    loadChatHistory();

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

    // Help button toggle
    const helpBtn = document.getElementById('help-btn');
    const helpTooltip = document.getElementById('help-tooltip');
    if (helpBtn && helpTooltip) {
        helpBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            helpTooltip.classList.toggle('visible');
        });

        // Close tooltip on click outside
        document.addEventListener('click', (e) => {
            if (!helpBtn.contains(e.target) && !helpTooltip.contains(e.target)) {
                helpTooltip.classList.remove('visible');
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

    async function loadAiDrafts() {
        aiDraftsList.innerHTML = '<div class="loading">Loading drafts...</div>';
        try {
            const response = await fetch('/api/ai-drafts');
            const drafts = await response.json();

            // Update counter
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
                    loadAiDrafts(); // Reload
                });
            });

        } catch (error) {
            console.error('Error loading AI drafts:', error);
            aiDraftsList.innerHTML = '<div class="empty-state">Failed to load drafts</div>';
        }
    }

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

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function openAiDraftsModal() {
        aiDraftsModal.classList.add('active');
        loadAiDrafts();
    }

    function closeAiDraftsModal() {
        aiDraftsModal.classList.remove('active');
    }

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

    // Nielsen: Show first-run tooltip for new users
    if (typeof showFirstRunTooltip === 'function') {
        setTimeout(showFirstRunTooltip, 2000); // Delay to not overwhelm
    }

    // ============================================
    // Project Voice Modal — Talk to your project
    // ============================================
    const voiceBtn = document.getElementById('voice-btn');
    const voiceModal = document.getElementById('project-voice-modal');
    const voiceModalClose = document.getElementById('voice-modal-close');
    const voiceProjectSelect = document.getElementById('voice-project-select');
    const voiceChatMessages = document.getElementById('voice-chat-messages');
    const voiceChatForm = document.getElementById('voice-chat-form');
    const voiceChatInput = document.getElementById('voice-chat-input');
    const voiceChatSubmit = voiceChatForm?.querySelector('.voice-chat-submit');

    let voiceChatHistory = [];
    let currentVoiceProject = null;

    async function loadProjectsForVoice() {
        try {
            const response = await fetch('/api/github/repos');
            // If not authenticated, try local projects list
            if (!response.ok) {
                // Fallback: read from internal projects list
                const fallbackResponse = await fetch('/api/buddy-message');
                const buddyData = await fallbackResponse.json();
                // Extract project names from buddy message context
                return [];
            }
            return await response.json();
        } catch (e) {
            return [];
        }
    }

    async function populateVoiceProjectDropdown() {
        // Load projects dynamically from /api/projects
        try {
            const response = await fetch('/api/projects');
            const projects = await response.json();

            voiceProjectSelect.innerHTML = '<option value="">Select a project...</option>';

            if (projects.length === 0) {
                voiceProjectSelect.innerHTML = '<option value="">No projects connected</option>';
                return;
            }

            projects.forEach(proj => {
                const option = document.createElement('option');
                option.value = proj.name;
                option.textContent = proj.name;
                voiceProjectSelect.appendChild(option);
            });
        } catch (e) {
            console.error('Error loading projects for voice:', e);
            voiceProjectSelect.innerHTML = '<option value="">Error loading projects</option>';
        }
    }

    function openVoiceModal() {
        voiceModal.classList.add('active');
        populateVoiceProjectDropdown();
        voiceChatHistory = [];
        currentVoiceProject = null;
        voiceChatMessages.innerHTML = '<div class="voice-placeholder">Choose a project to start talking...</div>';
        voiceChatInput.disabled = true;
        voiceChatSubmit.disabled = true;
    }

    function closeVoiceModal() {
        voiceModal.classList.remove('active');
        voiceChatHistory = [];
        currentVoiceProject = null;
    }

    function renderVoiceMessage(role, text) {
        const bubble = document.createElement('div');
        bubble.className = `voice-bubble ${role}`;
        const p = document.createElement('p');
        p.innerHTML = text.replace(/\n/g, '<br>');
        bubble.appendChild(p);
        voiceChatMessages.appendChild(bubble);
        voiceChatMessages.scrollTop = voiceChatMessages.scrollHeight;
    }

    function showVoiceTyping() {
        const indicator = document.createElement('div');
        indicator.className = 'voice-typing';
        indicator.id = 'voice-typing';
        indicator.innerHTML = '<span></span><span></span><span></span>';
        voiceChatMessages.appendChild(indicator);
        voiceChatMessages.scrollTop = voiceChatMessages.scrollHeight;
    }

    function hideVoiceTyping() {
        const indicator = document.getElementById('voice-typing');
        if (indicator) indicator.remove();
    }

    async function sendVoiceMessage(text) {
        if (!text.trim() || !currentVoiceProject) return;

        // Add user message
        voiceChatHistory.push({ role: 'user', content: text });
        renderVoiceMessage('user', text);

        // Disable input
        voiceChatInput.disabled = true;
        voiceChatSubmit.disabled = true;
        showVoiceTyping();

        try {
            const response = await fetch('/api/project-voice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectName: currentVoiceProject,
                    message: text,
                    history: voiceChatHistory.slice(0, -1) // Exclude current
                })
            });

            hideVoiceTyping();

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to get response');
            }

            const data = await response.json();

            // Add project response
            voiceChatHistory.push({ role: 'project', content: data.response });
            renderVoiceMessage('project', data.response);

        } catch (error) {
            hideVoiceTyping();
            console.error('Voice chat error:', error);
            renderVoiceMessage('project', `Sorry, I can't respond right now... (${error.message})`);
        } finally {
            voiceChatInput.disabled = false;
            voiceChatSubmit.disabled = false;
            voiceChatInput.focus();
        }
    }

    // Event listeners
    if (voiceBtn) {
        voiceBtn.addEventListener('click', openVoiceModal);
    }

    if (voiceModalClose) {
        voiceModalClose.addEventListener('click', closeVoiceModal);
    }

    if (voiceModal) {
        voiceModal.addEventListener('click', (e) => {
            if (e.target === voiceModal) closeVoiceModal();
        });
    }

    if (voiceProjectSelect) {
        voiceProjectSelect.addEventListener('change', async () => {
            const selected = voiceProjectSelect.value;
            if (selected) {
                // Phase 2.7: Check if SOUL onboarding is needed
                const needsOnboarding = await checkSoulOnboarding(selected);

                if (needsOnboarding) {
                    // Onboarding wizard will handle the rest
                    // Reset UI state
                    voiceChatMessages.innerHTML = '<div class="voice-placeholder">Complete SOUL onboarding first...</div>';
                    voiceChatInput.disabled = true;
                    voiceChatSubmit.disabled = true;
                    return;
                }

                // Normal flow - start voice chat
                currentVoiceProject = selected;
                voiceChatMessages.innerHTML = ''; // Clear placeholder
                voiceChatInput.disabled = false;
                voiceChatSubmit.disabled = false;
                voiceChatInput.focus();
                voiceChatInput.placeholder = `Talk to ${selected}...`;

                // Optional: auto-greet
                renderVoiceMessage('project', `Hey. I am ${selected}. What do you want to talk about?`);
            } else {
                currentVoiceProject = null;
                voiceChatMessages.innerHTML = '<div class="voice-placeholder">Choose a project to start talking...</div>';
                voiceChatInput.disabled = true;
                voiceChatSubmit.disabled = true;
            }
        });
    }

    // Make startProjectVoiceChat available globally for onboarding callback
    window.startProjectVoiceChat = function (projectName) {
        if (voiceProjectSelect) {
            voiceProjectSelect.value = projectName;
        }
        currentVoiceProject = projectName;
        voiceChatMessages.innerHTML = '';
        voiceChatInput.disabled = false;
        voiceChatSubmit.disabled = false;
        voiceChatInput.focus();
        voiceChatInput.placeholder = `Talk to ${projectName}...`;
        renderVoiceMessage('project', `Hey. I am ${projectName}. Now I have a soul! What shall we talk about?`);
    };

    if (voiceChatForm) {
        voiceChatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const text = voiceChatInput.value.trim();
            if (text) {
                sendVoiceMessage(text);
                voiceChatInput.value = '';
            }
        });
    }

    // Escape to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && voiceModal?.classList.contains('active')) {
            closeVoiceModal();
        }
    });
});

// ============================================
// My Posts (Voice Training Dataset)
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    const myPostsBtn = document.getElementById('my-posts-btn');
    const myPostsModal = document.getElementById('my-posts-modal');
    const myPostsModalClose = document.getElementById('my-posts-modal-close');
    const myPostsList = document.getElementById('my-posts-list');
    const addPostBtn = document.getElementById('add-post-btn');
    const newPostContent = document.getElementById('new-post-content');
    const newPostPlatform = document.getElementById('new-post-platform');
    const newPostProject = document.getElementById('new-post-project');
    const postsCount = document.getElementById('posts-count');

    let myPostsData = [];

    async function loadMyPosts() {
        try {
            const response = await fetch('/api/posts');
            myPostsData = await response.json();
            renderMyPosts();
        } catch (error) {
            console.error('Error loading posts:', error);
            myPostsList.innerHTML = '<div class="my-posts-empty">Failed to load posts</div>';
        }
    }

    async function loadProjectsForPosts() {
        try {
            const response = await fetch('/api/projects');
            const projects = await response.json();
            newPostProject.innerHTML = '<option value="">No project</option>';
            projects.forEach(p => {
                const option = document.createElement('option');
                option.value = p.name;
                option.textContent = p.name;
                newPostProject.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading projects for posts:', error);
        }
    }

    function renderMyPosts() {
        if (myPostsData.length === 0) {
            myPostsList.innerHTML = '<div class="my-posts-empty">No posts yet. Add your first published post to train the AI voice.</div>';
            postsCount.textContent = '0 posts';
            return;
        }

        postsCount.textContent = myPostsData.length + ' posts';

        myPostsList.innerHTML = myPostsData
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .map(post => {
                const contentDiv = document.createElement('div');
                contentDiv.textContent = post.content;
                const escapedContent = contentDiv.innerHTML;
                const date = new Date(post.createdAt);
                const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                return '<div class="my-post-item" data-id="' + post.id + '">' +
                    '<div class="my-post-content">' + escapedContent + '</div>' +
                    '<div class="my-post-meta">' +
                        '<span class="my-post-platform">' + post.platform + '</span>' +
                        (post.project ? '<span>📁 ' + post.project + '</span>' : '') +
                        '<span>' + dateStr + '</span>' +
                    '</div>' +
                    '<button class="my-post-delete" data-id="' + post.id + '" title="Delete">×</button>' +
                '</div>';
            }).join('');

        // Add delete handlers
        myPostsList.querySelectorAll('.my-post-delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.dataset.id;
                if (confirm('Delete this post?')) {
                    await deletePost(id);
                }
            });
        });
    }

    async function addPost() {
        const content = newPostContent.value.trim();
        if (!content) {
            alert('Please enter post content');
            return;
        }

        try {
            const response = await fetch('/api/posts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content,
                    platform: newPostPlatform.value,
                    project: newPostProject.value || null
                })
            });

            if (!response.ok) throw new Error('Failed to add post');

            newPostContent.value = '';
            await loadMyPosts();
        } catch (error) {
            console.error('Error adding post:', error);
            alert('Failed to add post');
        }
    }

    async function deletePost(id) {
        try {
            const response = await fetch('/api/posts/' + id, { method: 'DELETE' });
            if (!response.ok) throw new Error('Failed to delete post');
            await loadMyPosts();
        } catch (error) {
            console.error('Error deleting post:', error);
            alert('Failed to delete post');
        }
    }

    function openMyPostsModal() {
        myPostsModal.classList.add('active');
        loadMyPosts();
        loadProjectsForPosts();
    }

    function closeMyPostsModal() {
        myPostsModal.classList.remove('active');
    }

    // Event listeners
    if (myPostsBtn) {
        myPostsBtn.addEventListener('click', openMyPostsModal);
    }

    if (myPostsModalClose) {
        myPostsModalClose.addEventListener('click', closeMyPostsModal);
    }

    if (myPostsModal) {
        myPostsModal.addEventListener('click', (e) => {
            if (e.target === myPostsModal) closeMyPostsModal();
        });
    }

    if (addPostBtn) {
        addPostBtn.addEventListener('click', addPost);
    }

    // Ctrl+Enter to add post
    if (newPostContent) {
        newPostContent.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                addPost();
            }
        });
    }

    // Escape to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && myPostsModal && myPostsModal.classList.contains('active')) {
            closeMyPostsModal();
        }
    });
});
