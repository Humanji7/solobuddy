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

    // Prompts tab elements
    const chatPromptTextarea = document.getElementById('settings-chat-prompt');
    const chatPromptSaveBtn = document.getElementById('prompt-chat-save');
    const chatPromptResetBtn = document.getElementById('prompt-chat-reset');

    // Voice tab elements
    const voicePromptTextarea = document.getElementById('settings-voice-prompt');
    const voicePromptSaveBtn = document.getElementById('prompt-voice-save');
    const voicePromptResetBtn = document.getElementById('prompt-voice-reset');

    // Soul tab elements
    const soulProjectSelect = document.getElementById('settings-soul-project');
    const soulContentTextarea = document.getElementById('settings-soul-content');
    const soulSaveBtn = document.getElementById('prompt-soul-save');

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

    // ============================================
    // Prompts Tab Functions
    // ============================================

    /**
     * Load chat prompt
     */
    async function loadChatPrompt() {
        try {
            chatPromptTextarea.placeholder = 'Loading...';
            const response = await fetch('/api/prompts/chat');
            const data = await response.json();
            chatPromptTextarea.value = data.content || '';
            chatPromptTextarea.placeholder = 'Enter system prompt...';
        } catch (error) {
            console.error('Error loading chat prompt:', error);
            chatPromptTextarea.placeholder = 'Failed to load';
        }
    }

    /**
     * Save chat prompt
     */
    async function saveChatPrompt() {
        chatPromptSaveBtn.textContent = 'Saving...';
        chatPromptSaveBtn.disabled = true;

        try {
            const response = await fetch('/api/prompts/chat', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: chatPromptTextarea.value })
            });

            if (!response.ok) throw new Error('Failed to save');

            chatPromptSaveBtn.textContent = 'Saved!';
            if (typeof showToast === 'function') showToast('Chat prompt saved');
        } catch (error) {
            console.error('Error saving chat prompt:', error);
            if (typeof showToast === 'function') showToast('Failed to save', true);
        } finally {
            setTimeout(() => {
                chatPromptSaveBtn.textContent = 'Save';
                chatPromptSaveBtn.disabled = false;
            }, 1500);
        }
    }

    /**
     * Reset chat prompt to default
     */
    async function resetChatPrompt() {
        if (!confirm('Reset chat prompt to default? Your changes will be lost.')) return;

        chatPromptResetBtn.textContent = 'Resetting...';
        chatPromptResetBtn.disabled = true;

        try {
            const response = await fetch('/api/prompts/chat/reset', { method: 'POST' });
            const data = await response.json();

            if (!response.ok) throw new Error('Failed to reset');

            chatPromptTextarea.value = data.content || '';
            if (typeof showToast === 'function') showToast('Reset to default');
        } catch (error) {
            console.error('Error resetting chat prompt:', error);
            if (typeof showToast === 'function') showToast('Failed to reset', true);
        } finally {
            setTimeout(() => {
                chatPromptResetBtn.textContent = 'Reset to Default';
                chatPromptResetBtn.disabled = false;
            }, 1500);
        }
    }

    // ============================================
    // Voice Tab Functions
    // ============================================

    /**
     * Load voice prompt
     */
    async function loadVoicePrompt() {
        try {
            voicePromptTextarea.placeholder = 'Loading...';
            const response = await fetch('/api/prompts/voice');
            const data = await response.json();
            voicePromptTextarea.value = data.content || '';
            voicePromptTextarea.placeholder = 'Enter voice prompt...';
        } catch (error) {
            console.error('Error loading voice prompt:', error);
            voicePromptTextarea.placeholder = 'Failed to load';
        }
    }

    /**
     * Save voice prompt
     */
    async function saveVoicePrompt() {
        voicePromptSaveBtn.textContent = 'Saving...';
        voicePromptSaveBtn.disabled = true;

        try {
            const response = await fetch('/api/prompts/voice', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: voicePromptTextarea.value })
            });

            if (!response.ok) throw new Error('Failed to save');

            voicePromptSaveBtn.textContent = 'Saved!';
            if (typeof showToast === 'function') showToast('Voice prompt saved');
        } catch (error) {
            console.error('Error saving voice prompt:', error);
            if (typeof showToast === 'function') showToast('Failed to save', true);
        } finally {
            setTimeout(() => {
                voicePromptSaveBtn.textContent = 'Save';
                voicePromptSaveBtn.disabled = false;
            }, 1500);
        }
    }

    /**
     * Reset voice prompt to default
     */
    async function resetVoicePrompt() {
        if (!confirm('Reset voice prompt to default? Your changes will be lost.')) return;

        voicePromptResetBtn.textContent = 'Resetting...';
        voicePromptResetBtn.disabled = true;

        try {
            const response = await fetch('/api/prompts/voice/reset', { method: 'POST' });
            const data = await response.json();

            if (!response.ok) throw new Error('Failed to reset');

            voicePromptTextarea.value = data.content || '';
            if (typeof showToast === 'function') showToast('Reset to default');
        } catch (error) {
            console.error('Error resetting voice prompt:', error);
            if (typeof showToast === 'function') showToast('Failed to reset', true);
        } finally {
            setTimeout(() => {
                voicePromptResetBtn.textContent = 'Reset to Default';
                voicePromptResetBtn.disabled = false;
            }, 1500);
        }
    }

    // ============================================
    // Soul Tab Functions
    // ============================================

    /**
     * Load projects list for soul dropdown
     */
    async function loadSoulProjects() {
        try {
            const response = await fetch('/api/prompts/soul/list');
            const projects = await response.json();

            soulProjectSelect.innerHTML = '<option value="">-- Select a project --</option>';

            projects.forEach(project => {
                const option = document.createElement('option');
                option.value = project.name;
                option.textContent = project.name + (project.hasSoulContent ? ' (has soul)' : '');
                soulProjectSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading soul projects:', error);
        }
    }

    /**
     * Load soul content for selected project
     */
    async function loadSoulContent(projectName) {
        if (!projectName) {
            soulContentTextarea.value = '';
            soulContentTextarea.placeholder = 'Select a project to view its soul...';
            return;
        }

        try {
            soulContentTextarea.placeholder = 'Loading...';
            const response = await fetch(`/api/prompts/soul?projectName=${encodeURIComponent(projectName)}`);

            if (!response.ok) {
                if (response.status === 404) {
                    soulContentTextarea.value = '';
                    soulContentTextarea.placeholder = 'No soul found for this project. Run onboarding first.';
                    return;
                }
                throw new Error('Failed to load');
            }

            const data = await response.json();
            soulContentTextarea.value = data.content || '';
            soulContentTextarea.placeholder = 'Soul content...';
        } catch (error) {
            console.error('Error loading soul content:', error);
            soulContentTextarea.placeholder = 'Failed to load';
        }
    }

    /**
     * Save soul content
     */
    async function saveSoulContent() {
        const projectName = soulProjectSelect.value;
        if (!projectName) {
            if (typeof showToast === 'function') showToast('Select a project first', true);
            return;
        }

        soulSaveBtn.textContent = 'Saving...';
        soulSaveBtn.disabled = true;

        try {
            const response = await fetch('/api/prompts/soul', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectName: projectName,
                    content: soulContentTextarea.value
                })
            });

            if (!response.ok) throw new Error('Failed to save');

            soulSaveBtn.textContent = 'Saved!';
            if (typeof showToast === 'function') showToast('Soul saved');
        } catch (error) {
            console.error('Error saving soul:', error);
            if (typeof showToast === 'function') showToast('Failed to save', true);
        } finally {
            setTimeout(() => {
                soulSaveBtn.textContent = 'Save';
                soulSaveBtn.disabled = false;
            }, 1500);
        }
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

        // Load data for specific tabs
        if (tabName === 'projects') {
            loadProjects();
        } else if (tabName === 'prompts') {
            loadChatPrompt();
        } else if (tabName === 'voice') {
            loadVoicePrompt();
        } else if (tabName === 'soul') {
            loadSoulProjects();
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

    // Prompts tab buttons
    if (chatPromptSaveBtn) {
        chatPromptSaveBtn.addEventListener('click', saveChatPrompt);
    }
    if (chatPromptResetBtn) {
        chatPromptResetBtn.addEventListener('click', resetChatPrompt);
    }

    // Voice tab buttons
    if (voicePromptSaveBtn) {
        voicePromptSaveBtn.addEventListener('click', saveVoicePrompt);
    }
    if (voicePromptResetBtn) {
        voicePromptResetBtn.addEventListener('click', resetVoicePrompt);
    }

    // Soul tab
    if (soulProjectSelect) {
        soulProjectSelect.addEventListener('change', (e) => {
            loadSoulContent(e.target.value);
        });
    }
    if (soulSaveBtn) {
        soulSaveBtn.addEventListener('click', saveSoulContent);
    }

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
