/* ============================================
   Settings Modal Logic
   ============================================ */

(function() {
    // DOM Elements
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const settingsModalClose = document.getElementById('settings-modal-close');
    const settingsSaveBtn = document.getElementById('settings-save-btn');
    const settingsTabs = document.querySelectorAll('.settings-tab');
    const settingsTabContents = document.querySelectorAll('.settings-tab-content');

    // Form elements
    const bipStartInput = document.getElementById('settings-bip-start');
    const phaseSelect = document.getElementById('settings-phase');
    const timezoneSelect = document.getElementById('settings-timezone');
    const goalsTextarea = document.getElementById('settings-goals');

    // Platform inputs
    const twitterHandle = document.getElementById('settings-twitter-handle');
    const twitterFollowers = document.getElementById('settings-twitter-followers');
    const telegramHandle = document.getElementById('settings-telegram-handle');
    const telegramFollowers = document.getElementById('settings-telegram-followers');
    const linkedinHandle = document.getElementById('settings-linkedin-handle');
    const linkedinFollowers = document.getElementById('settings-linkedin-followers');

    // Projects list
    const projectsList = document.getElementById('settings-projects-list');

    let currentSettings = null;

    /**
     * Load settings from API
     */
    async function loadSettings() {
        try {
            const response = await fetch('/api/settings');
            currentSettings = await response.json();
            populateForm(currentSettings);
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    /**
     * Populate form with settings data
     */
    function populateForm(settings) {
        // Profile tab
        if (settings.profile) {
            if (settings.profile.bipStartDate) {
                bipStartInput.value = settings.profile.bipStartDate;
            }
            if (settings.profile.currentPhase) {
                phaseSelect.value = settings.profile.currentPhase;
            }
            if (settings.profile.timezone) {
                timezoneSelect.value = settings.profile.timezone;
            }
            if (settings.profile.goals && Array.isArray(settings.profile.goals)) {
                goalsTextarea.value = settings.profile.goals.join('\n');
            }
        }

        // Platforms tab
        if (settings.platforms) {
            if (settings.platforms.twitter) {
                twitterHandle.value = settings.platforms.twitter.handle || '';
                twitterFollowers.value = settings.platforms.twitter.followers || '';
            }
            if (settings.platforms.telegram) {
                telegramHandle.value = settings.platforms.telegram.handle || '';
                telegramFollowers.value = settings.platforms.telegram.followers || '';
            }
            if (settings.platforms.linkedin) {
                linkedinHandle.value = settings.platforms.linkedin.handle || '';
                linkedinFollowers.value = settings.platforms.linkedin.followers || '';
            }
        }
    }

    /**
     * Load projects for Projects tab
     */
    async function loadProjects() {
        try {
            const response = await fetch('/api/projects');
            const projects = await response.json();
            renderProjects(projects);
        } catch (error) {
            console.error('Error loading projects:', error);
            projectsList.innerHTML = '<div class="empty-state">Failed to load projects</div>';
        }
    }

    /**
     * Render projects list
     */
    function renderProjects(projects) {
        if (projects.length === 0) {
            projectsList.innerHTML = '<div class="empty-state">No projects connected yet</div>';
            return;
        }

        projectsList.innerHTML = projects.map(project => `
            <div class="settings-project-item">
                <div class="project-info">
                    <span class="project-name">${project.name}</span>
                    ${project.hasSoul ? '<span class="soul-badge">Has Soul</span>' : '<span class="no-soul-badge">No Soul</span>'}
                </div>
                <span class="project-path">${project.path || project.url || ''}</span>
            </div>
        `).join('');
    }

    /**
     * Collect form data
     */
    function collectFormData() {
        const goalsText = goalsTextarea.value.trim();
        const goals = goalsText ? goalsText.split('\n').filter(g => g.trim()) : [];

        return {
            profile: {
                bipStartDate: bipStartInput.value || null,
                currentPhase: phaseSelect.value,
                timezone: timezoneSelect.value,
                goals: goals
            },
            platforms: {
                twitter: {
                    handle: twitterHandle.value.trim(),
                    followers: parseInt(twitterFollowers.value) || 0
                },
                telegram: {
                    handle: telegramHandle.value.trim(),
                    followers: parseInt(telegramFollowers.value) || 0
                },
                linkedin: {
                    handle: linkedinHandle.value.trim(),
                    followers: parseInt(linkedinFollowers.value) || 0
                }
            }
        };
    }

    /**
     * Save settings to API
     */
    async function saveSettings() {
        const data = collectFormData();

        settingsSaveBtn.textContent = 'Saving...';
        settingsSaveBtn.disabled = true;

        try {
            const response = await fetch('/api/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                throw new Error('Failed to save settings');
            }

            const result = await response.json();
            currentSettings = result.settings;

            // Show success feedback
            settingsSaveBtn.textContent = 'Saved!';
            setTimeout(() => {
                settingsSaveBtn.textContent = 'Save Settings';
                settingsSaveBtn.disabled = false;
            }, 1500);

            // Show toast
            if (typeof showToast === 'function') {
                showToast('Settings saved');
            }

        } catch (error) {
            console.error('Error saving settings:', error);
            settingsSaveBtn.textContent = 'Save Settings';
            settingsSaveBtn.disabled = false;

            if (typeof showToast === 'function') {
                showToast('Failed to save settings', true);
            }
        }
    }

    /**
     * Switch tabs
     */
    function switchTab(tabName) {
        // Update tab buttons
        settingsTabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        // Update tab contents
        settingsTabContents.forEach(content => {
            const contentId = content.id.replace('tab-', '');
            content.classList.toggle('active', contentId === tabName);
        });

        // Load projects if switching to projects tab
        if (tabName === 'projects') {
            loadProjects();
        }
    }

    /**
     * Open modal
     */
    function openSettingsModal() {
        settingsModal.classList.add('active');
        loadSettings();
        // Reset to first tab
        switchTab('profile');
    }

    /**
     * Close modal
     */
    function closeSettingsModal() {
        settingsModal.classList.remove('active');
    }

    // Event Listeners
    if (settingsBtn) {
        settingsBtn.addEventListener('click', openSettingsModal);
    }

    if (settingsModalClose) {
        settingsModalClose.addEventListener('click', closeSettingsModal);
    }

    if (settingsModal) {
        settingsModal.addEventListener('click', (e) => {
            if (e.target === settingsModal) {
                closeSettingsModal();
            }
        });
    }

    if (settingsSaveBtn) {
        settingsSaveBtn.addEventListener('click', saveSettings);
    }

    // Tab switching
    settingsTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            switchTab(tab.dataset.tab);
        });
    });

    // Keyboard: Escape to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && settingsModal && settingsModal.classList.contains('active')) {
            closeSettingsModal();
        }
    });

    // Expose for external use if needed
    window.openSettingsModal = openSettingsModal;
    window.closeSettingsModal = closeSettingsModal;
})();
