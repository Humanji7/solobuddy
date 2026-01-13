/* ============================================
   Local Projects UI Module
   Local directory scanning and connection
   ============================================ */

// DOM Elements
const localConnectBtn = document.getElementById('local-connect-btn');
const localReposModal = document.getElementById('local-repos-modal');
const localModalClose = document.getElementById('local-modal-close');
const localReposList = document.getElementById('local-repos-list');
const connectLocalSelectedBtn = document.getElementById('connect-local-selected');

// State
let selectedLocalProjects = [];

/**
 * Load local projects from API
 */
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

/**
 * Render local projects list
 */
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

/**
 * Toggle local project selection state
 */
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

/**
 * Update connect button text with count
 */
function updateLocalConnectButton() {
    const count = selectedLocalProjects.length;
    connectLocalSelectedBtn.textContent = `Connect Selected (${count})`;
    connectLocalSelectedBtn.disabled = count === 0;
}

/**
 * Connect selected local projects
 */
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
            window.showToast(`✓ Added ${result.added} project(s) to monitoring`);
            // Reload buddy message to reflect changes
            if (window.refreshBuddyMessage) {
                await window.refreshBuddyMessage();
            }
        } else {
            window.showToast(result.error || 'Failed to connect', true);
        }
    } catch (error) {
        console.error('Error connecting local projects:', error);
        window.showToast('Failed to connect local projects', true);
    } finally {
        connectLocalSelectedBtn.textContent = originalText;
        connectLocalSelectedBtn.disabled = selectedLocalProjects.length === 0;
    }
}

/**
 * Open local projects modal
 */
function openLocalModal() {
    localReposModal.classList.add('active');
    loadLocalProjects();
}

/**
 * Close local projects modal
 */
function closeLocalModal() {
    localReposModal.classList.remove('active');
    selectedLocalProjects = [];
}

/**
 * Initialize local projects UI event listeners
 */
function initLocalProjectsUI() {
    if (localConnectBtn) {
        localConnectBtn.addEventListener('click', openLocalModal);
    }

    if (localModalClose) {
        localModalClose.addEventListener('click', closeLocalModal);
    }

    if (localReposModal) {
        localReposModal.addEventListener('click', (e) => {
            if (e.target === localReposModal) {
                closeLocalModal();
            }
        });
    }

    if (connectLocalSelectedBtn) {
        connectLocalSelectedBtn.addEventListener('click', connectSelectedLocalProjects);
    }
}

// Export for global access
window.LocalProjectsUI = {
    init: initLocalProjectsUI,
    openModal: openLocalModal,
    closeModal: closeLocalModal
};
