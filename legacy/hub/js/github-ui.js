/* ============================================
   GitHub UI Module
   OAuth flow, repos modal, connection management
   ============================================ */

// DOM Elements
const githubConnectBtn = document.getElementById('github-connect-btn');
const githubReposModal = document.getElementById('github-repos-modal');
const reposModalClose = document.getElementById('repos-modal-close');
const reposList = document.getElementById('repos-list');
const connectSelectedBtn = document.getElementById('connect-selected');

// State
let selectedRepos = [];

/**
 * Check GitHub connection status
 */
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

/**
 * Start GitHub OAuth flow
 */
function startGitHubAuth() {
    window.location.href = '/auth/github';
}

/**
 * Load repositories list from API
 */
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

/**
 * Render repositories list
 */
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

/**
 * Toggle repo selection state
 */
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

/**
 * Update connect button text with count
 */
function updateConnectButton() {
    const count = selectedRepos.length;
    connectSelectedBtn.textContent = `Connect Selected (${count})`;
    connectSelectedBtn.disabled = count === 0;
}

/**
 * Connect selected repositories
 */
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
            window.showToast(`✓ Added ${result.added} project(s) to monitoring`);
            // Reload buddy message to reflect changes
            if (window.refreshBuddyMessage) {
                await window.refreshBuddyMessage();
            }
        } else {
            window.showToast(result.error || 'Failed to connect', true);
        }
    } catch (error) {
        console.error('Error connecting repos:', error);
        window.showToast('Failed to connect repositories', true);
    } finally {
        connectSelectedBtn.textContent = originalText;
        connectSelectedBtn.disabled = selectedRepos.length === 0;
    }
}

/**
 * Format date to relative string
 */
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

/**
 * Open repos modal
 */
function openReposModal() {
    githubReposModal.classList.add('active');
    loadReposList();
}

/**
 * Close repos modal
 */
function closeReposModal() {
    githubReposModal.classList.remove('active');
    selectedRepos = [];
}

/**
 * Handle OAuth callback URL params
 */
function handleOAuthCallback() {
    const params = new URLSearchParams(window.location.search);

    if (params.get('github_connected') === 'true') {
        window.history.replaceState({}, '', window.location.pathname);
        setTimeout(() => openReposModal(), 500);
    }

    if (params.get('github_error')) {
        const error = params.get('github_error');
        window.history.replaceState({}, '', window.location.pathname);
        window.showToast(`GitHub error: ${error}`, true);
    }
}

/**
 * Initialize GitHub UI event listeners
 */
function initGitHubUI() {
    if (githubConnectBtn) {
        githubConnectBtn.addEventListener('click', async () => {
            const connected = await checkGitHubStatus();
            if (connected) {
                openReposModal();
            } else {
                startGitHubAuth();
            }
        });
    }

    if (reposModalClose) {
        reposModalClose.addEventListener('click', closeReposModal);
    }

    if (githubReposModal) {
        githubReposModal.addEventListener('click', (e) => {
            if (e.target === githubReposModal) {
                closeReposModal();
            }
        });
    }

    if (connectSelectedBtn) {
        connectSelectedBtn.addEventListener('click', connectSelectedRepos);
    }
}

// Export for global access
window.GitHubUI = {
    init: initGitHubUI,
    checkStatus: checkGitHubStatus,
    handleOAuthCallback,
    formatDate
};
