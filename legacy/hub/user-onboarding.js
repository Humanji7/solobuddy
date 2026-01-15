/* ============================================
   User Onboarding — Conversation-driven user context setup
   Collects user preferences for personalized BIP advice
   ============================================ */

class UserOnboardingWizard {
    constructor() {
        this.currentStep = 0;
        this.selections = {
            phase: 'shotgun',
            projects: [],
            platforms: [],
            skills: [],
            timePerDay: 30,
            goals: [],
            language: 'ru'
        };
        this.steps = ['intro', 'phase', 'projects', 'platforms', 'skills', 'time', 'goals', 'preview'];
        this.modal = null;
        this.isSubmitting = false;
    }

    // Step configuration with options
    static KNOBS = {
        phase: {
            label: 'Current Phase',
            options: [
                { id: 'shotgun', icon: '🎯', label: 'Shotgun', description: 'Testing multiple projects, finding PMF' },
                { id: 'sniper', icon: '🔫', label: 'Sniper', description: 'Focused on one main project' },
                { id: 'exploring', icon: '🔍', label: 'Exploring', description: 'Just starting, observing what works' }
            ]
        },
        platforms: {
            label: 'Where do you publish?',
            options: [
                { id: 'twitter', icon: '𝕏', label: 'Twitter/X' },
                { id: 'telegram', icon: '📱', label: 'Telegram' },
                { id: 'threads', icon: '🧵', label: 'Threads' },
                { id: 'linkedin', icon: '💼', label: 'LinkedIn' },
                { id: 'youtube', icon: '📺', label: 'YouTube' },
                { id: 'tiktok', icon: '🎵', label: 'TikTok' },
                { id: 'indiehackers', icon: '🚀', label: 'IndieHackers' },
                { id: 'devto', icon: '👨‍💻', label: 'Dev.to' }
            ]
        },
        skills: {
            label: 'Your superpowers',
            options: [
                { id: 'developer', label: '💻 Developer' },
                { id: 'ai_creator', label: '🤖 AI Creator' },
                { id: 'video', label: '🎬 Video Maker' },
                { id: 'writer', label: '✍️ Writer' },
                { id: 'designer', label: '🎨 Designer' },
                { id: 'marketer', label: '📈 Marketer' }
            ]
        },
        timePerDay: {
            label: 'Time for content per day',
            options: [
                { id: 15, label: '15 min', description: 'Quick posts only' },
                { id: 30, label: '30 min', description: 'Posts + engagement' },
                { id: 45, label: '45 min', description: 'Posts + video + engagement' },
                { id: 60, label: '60+ min', description: 'Full content production' }
            ]
        },
        goals: {
            label: 'Main goals',
            options: [
                { id: 'discipline', icon: '📅', label: 'Build publishing habit' },
                { id: 'networking', icon: '🤝', label: 'Networking & connections' },
                { id: 'sales', icon: '💰', label: 'Drive sales/signups' },
                { id: 'learning', icon: '📚', label: 'Learn in public' },
                { id: 'audience', icon: '👥', label: 'Grow audience' },
                { id: 'pmf', icon: '🎯', label: 'Find product-market fit' }
            ]
        },
        language: {
            label: 'Primary language',
            options: [
                { id: 'ru', icon: '🇷🇺', label: 'Русский' },
                { id: 'en', icon: '🇬🇧', label: 'English' },
                { id: 'both', icon: '🌐', label: 'Both' }
            ]
        }
    };

    async start() {
        // Check if already onboarded
        try {
            const response = await fetch('/api/user-context');
            const context = await response.json();
            if (context.onboarded) {
                // Already onboarded, show edit mode
                this.selections = { ...this.selections, ...context };
                this.isEditMode = true;
            }
        } catch (error) {
            console.log('Starting fresh onboarding');
        }

        this.createModal();
        this.renderStep();
    }

    createModal() {
        // Remove existing if any
        const existing = document.getElementById('user-onboarding-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'user-onboarding-modal';
        modal.className = 'user-onboarding-modal';
        modal.innerHTML = `
            <div class="user-onboarding-content">
                <div class="user-onboarding-header">
                    <div class="user-step-indicator"></div>
                    <button class="user-close-btn" title="Close">&times;</button>
                </div>
                <div class="user-onboarding-body"></div>
                <div class="user-onboarding-footer">
                    <button class="user-btn-back" style="display: none;">← Back</button>
                    <button class="user-btn-next">Next →</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.modal = modal;

        // Event listeners
        modal.querySelector('.user-close-btn').addEventListener('click', () => this.close());
        modal.querySelector('.user-btn-back').addEventListener('click', () => this.prevStep());
        modal.querySelector('.user-btn-next').addEventListener('click', () => this.nextStep());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.close();
        });
    }

    renderStep() {
        const step = this.steps[this.currentStep];
        const body = this.modal.querySelector('.user-onboarding-body');
        const backBtn = this.modal.querySelector('.user-btn-back');
        const nextBtn = this.modal.querySelector('.user-btn-next');

        // Update step indicator
        this.renderStepIndicator();

        // Show/hide back button
        backBtn.style.display = this.currentStep > 0 ? 'block' : 'none';

        // Render step content
        switch (step) {
            case 'intro':
                body.innerHTML = this.renderIntro();
                nextBtn.textContent = '🚀 Start Setup';
                break;
            case 'phase':
                body.innerHTML = this.renderPhase();
                nextBtn.textContent = 'Next →';
                break;
            case 'projects':
                body.innerHTML = this.renderProjects();
                nextBtn.textContent = 'Next →';
                break;
            case 'platforms':
                body.innerHTML = this.renderPlatforms();
                nextBtn.textContent = 'Next →';
                break;
            case 'skills':
                body.innerHTML = this.renderSkills();
                nextBtn.textContent = 'Next →';
                break;
            case 'time':
                body.innerHTML = this.renderTime();
                nextBtn.textContent = 'Next →';
                break;
            case 'goals':
                body.innerHTML = this.renderGoals();
                nextBtn.textContent = 'Next →';
                break;
            case 'preview':
                body.innerHTML = this.renderPreview();
                nextBtn.textContent = '✓ Save & Start';
                break;
        }

        // Attach option click handlers
        this.attachOptionHandlers();
    }

    renderStepIndicator() {
        const indicator = this.modal.querySelector('.user-step-indicator');
        indicator.innerHTML = this.steps.map((step, i) =>
            `<div class="user-step-dot ${i === this.currentStep ? 'active' : ''} ${i < this.currentStep ? 'completed' : ''}"></div>`
        ).join('');
    }

    renderIntro() {
        return `
            <div class="user-intro">
                <div class="user-intro-icon">👋</div>
                <h2>${this.isEditMode ? 'Update Your Profile' : 'Welcome to BIP Buddy!'}</h2>
                <p>${this.isEditMode
                ? 'Update your settings to get better personalized advice.'
                : 'Let me learn about you to give personalized Build-in-Public advice.'}</p>
                <p>This takes about 1 minute.</p>
                <div class="user-feature-list">
                    <div class="user-feature">📊 Tailored content strategies</div>
                    <div class="user-feature">⏱️ Time-optimized recommendations</div>
                    <div class="user-feature">🎯 Platform-specific tactics</div>
                </div>
            </div>
        `;
    }

    renderPhase() {
        const knob = UserOnboardingWizard.KNOBS.phase;
        return `
            <div class="user-step-content">
                <h2>${knob.label}</h2>
                <p class="user-hint">Where are you in your journey?</p>
                <div class="user-options-grid phase-grid">
                    ${knob.options.map(opt => `
                        <div class="user-option ${this.selections.phase === opt.id ? 'selected' : ''}" 
                             data-type="phase" data-value="${opt.id}">
                            <div class="user-option-icon">${opt.icon}</div>
                            <div class="user-option-label">${opt.label}</div>
                            <div class="user-option-desc">${opt.description}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    renderProjects() {
        return `
            <div class="user-step-content">
                <h2>Your Projects</h2>
                <p class="user-hint">Add your current projects (you can change this later)</p>
                <div class="user-projects-list" id="projects-list">
                    ${this.selections.projects.map((p, i) => `
                        <div class="user-project-item">
                            <input type="text" value="${p.name}" placeholder="Project name" 
                                   data-field="name" data-index="${i}">
                            <select data-field="status" data-index="${i}">
                                <option value="idea" ${p.status === 'idea' ? 'selected' : ''}>💡 Idea</option>
                                <option value="building" ${p.status === 'building' ? 'selected' : ''}>🔨 Building</option>
                                <option value="live" ${p.status === 'live' ? 'selected' : ''}>🚀 Live</option>
                            </select>
                            <button class="user-remove-btn" data-index="${i}">×</button>
                        </div>
                    `).join('')}
                </div>
                <button class="user-add-project-btn" id="add-project-btn">+ Add Project</button>
            </div>
        `;
    }

    renderPlatforms() {
        const knob = UserOnboardingWizard.KNOBS.platforms;
        return `
            <div class="user-step-content">
                <h2>${knob.label}</h2>
                <p class="user-hint">Select your platforms and add follower count</p>
                <div class="user-platforms-grid">
                    ${knob.options.map(opt => {
            const platform = this.selections.platforms.find(p => p.id === opt.id);
            const isSelected = !!platform;
            const followers = platform?.followers || '';
            return `
                            <div class="user-platform-item ${isSelected ? 'selected' : ''}" data-id="${opt.id}">
                                <div class="user-platform-header" data-type="platform" data-value="${opt.id}">
                                    <span class="user-platform-icon">${opt.icon}</span>
                                    <span class="user-platform-label">${opt.label}</span>
                                    <span class="user-platform-check">${isSelected ? '☑' : '☐'}</span>
                                </div>
                                <input type="number" 
                                       class="user-platform-followers ${isSelected ? 'visible' : ''}" 
                                       placeholder="Followers" 
                                       value="${followers}"
                                       data-platform="${opt.id}">
                            </div>
                        `;
        }).join('')}
                </div>
            </div>
        `;
    }

    renderSkills() {
        const knob = UserOnboardingWizard.KNOBS.skills;
        return `
            <div class="user-step-content">
                <h2>${knob.label}</h2>
                <p class="user-hint">Select all that apply</p>
                <div class="user-options-row">
                    ${knob.options.map(opt => `
                        <div class="user-option-pill ${this.selections.skills.includes(opt.id) ? 'selected' : ''}"
                             data-type="skill" data-value="${opt.id}">
                            ${opt.label}
                        </div>
                    `).join('')}
                </div>
                <div class="user-custom-input" style="margin-top: 16px;">
                    <input type="text" id="skill-custom" placeholder="Other skill...">
                    <button class="user-add-custom-btn" id="add-skill-btn">+</button>
                </div>
            </div>
        `;
    }

    renderTime() {
        const knob = UserOnboardingWizard.KNOBS.timePerDay;
        return `
            <div class="user-step-content">
                <h2>${knob.label}</h2>
                <p class="user-hint">Be realistic — I'll optimize for your actual capacity</p>
                <div class="user-options-grid time-grid">
                    ${knob.options.map(opt => `
                        <div class="user-option ${this.selections.timePerDay === opt.id ? 'selected' : ''}"
                             data-type="time" data-value="${opt.id}">
                            <div class="user-option-label">${opt.label}</div>
                            <div class="user-option-desc">${opt.description}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    renderGoals() {
        const knob = UserOnboardingWizard.KNOBS.goals;
        return `
            <div class="user-step-content">
                <h2>${knob.label}</h2>
                <p class="user-hint">Select your top priorities</p>
                <div class="user-options-list">
                    ${knob.options.map(opt => `
                        <div class="user-option-checkbox ${this.selections.goals.includes(opt.id) ? 'selected' : ''}"
                             data-type="goal" data-value="${opt.id}">
                            <div class="user-checkbox">${this.selections.goals.includes(opt.id) ? '☑' : '☐'}</div>
                            <span class="user-goal-icon">${opt.icon}</span>
                            <div class="user-option-label">${opt.label}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    renderPreview() {
        const languageKnob = UserOnboardingWizard.KNOBS.language;

        return `
            <div class="user-step-content">
                <h2>Almost done! 🎉</h2>
                
                <div class="user-preview-box">
                    <div class="user-preview-header">
                        <span class="user-preview-icon">📋</span>
                        <span>Your Profile Summary</span>
                    </div>
                    <div class="user-preview-content">
                        <div class="user-preview-row">
                            <strong>Phase:</strong> 
                            <span class="user-preview-value">${this.getPhaseLabel()}</span>
                        </div>
                        <div class="user-preview-row">
                            <strong>Projects:</strong> 
                            <span class="user-preview-value">${this.selections.projects.length || 'None yet'}</span>
                        </div>
                        <div class="user-preview-row">
                            <strong>Platforms:</strong> 
                            <span class="user-preview-value">${this.getPlatformLabels()}</span>
                        </div>
                        <div class="user-preview-row">
                            <strong>Skills:</strong> 
                            <span class="user-preview-value">${this.selections.skills.join(', ') || 'Not specified'}</span>
                        </div>
                        <div class="user-preview-row">
                            <strong>Time:</strong> 
                            <span class="user-preview-value">${this.selections.timePerDay} min/day</span>
                        </div>
                        <div class="user-preview-row">
                            <strong>Goals:</strong> 
                            <span class="user-preview-value">${this.getGoalLabels()}</span>
                        </div>
                    </div>
                </div>

                <div class="user-language-section">
                    <h3>${languageKnob.label}</h3>
                    <div class="user-options-row language-row">
                        ${languageKnob.options.map(opt => `
                            <div class="user-option-pill ${this.selections.language === opt.id ? 'selected' : ''}"
                                 data-type="language" data-value="${opt.id}">
                                ${opt.icon} ${opt.label}
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    getPhaseLabel() {
        const phase = UserOnboardingWizard.KNOBS.phase.options.find(p => p.id === this.selections.phase);
        return phase ? `${phase.icon} ${phase.label}` : this.selections.phase;
    }

    getPlatformLabels() {
        if (!this.selections.platforms.length) return 'None selected';
        return this.selections.platforms.map(p => {
            const platform = UserOnboardingWizard.KNOBS.platforms.options.find(opt => opt.id === p.id);
            return `${platform?.icon || ''} ${p.id}${p.followers ? ` (${p.followers})` : ''}`;
        }).join(', ');
    }

    getGoalLabels() {
        if (!this.selections.goals.length) return 'Not specified';
        return this.selections.goals.map(g => {
            const goal = UserOnboardingWizard.KNOBS.goals.options.find(opt => opt.id === g);
            return goal?.label || g;
        }).join(', ');
    }

    attachOptionHandlers() {
        // Single select options (phase, time, language)
        this.modal.querySelectorAll('.user-option').forEach(el => {
            el.addEventListener('click', () => {
                const type = el.dataset.type;
                const value = el.dataset.value;

                if (type === 'phase') {
                    this.selections.phase = value;
                } else if (type === 'time') {
                    this.selections.timePerDay = parseInt(value);
                } else if (type === 'language') {
                    this.selections.language = value;
                }

                // Update UI
                el.parentElement.querySelectorAll(`[data-type="${type}"]`).forEach(o => o.classList.remove('selected'));
                el.classList.add('selected');
            });
        });

        // Language pills in preview
        this.modal.querySelectorAll('.user-option-pill[data-type="language"]').forEach(el => {
            el.addEventListener('click', () => {
                this.selections.language = el.dataset.value;
                el.parentElement.querySelectorAll('[data-type="language"]').forEach(o => o.classList.remove('selected'));
                el.classList.add('selected');
            });
        });

        // Multi-select skills
        this.modal.querySelectorAll('.user-option-pill[data-type="skill"]').forEach(el => {
            el.addEventListener('click', () => {
                const value = el.dataset.value;
                if (this.selections.skills.includes(value)) {
                    this.selections.skills = this.selections.skills.filter(s => s !== value);
                    el.classList.remove('selected');
                } else {
                    this.selections.skills.push(value);
                    el.classList.add('selected');
                }
            });
        });

        // Multi-select goals
        this.modal.querySelectorAll('.user-option-checkbox[data-type="goal"]').forEach(el => {
            el.addEventListener('click', () => {
                const value = el.dataset.value;
                if (this.selections.goals.includes(value)) {
                    this.selections.goals = this.selections.goals.filter(g => g !== value);
                    el.classList.remove('selected');
                    el.querySelector('.user-checkbox').textContent = '☐';
                } else {
                    this.selections.goals.push(value);
                    el.classList.add('selected');
                    el.querySelector('.user-checkbox').textContent = '☑';
                }
            });
        });

        // Platform toggles
        this.modal.querySelectorAll('.user-platform-header').forEach(el => {
            el.addEventListener('click', () => {
                const platformId = el.dataset.value;
                const item = el.closest('.user-platform-item');
                const input = item.querySelector('.user-platform-followers');
                const check = el.querySelector('.user-platform-check');

                const existingIndex = this.selections.platforms.findIndex(p => p.id === platformId);

                if (existingIndex >= 0) {
                    this.selections.platforms.splice(existingIndex, 1);
                    item.classList.remove('selected');
                    input.classList.remove('visible');
                    check.textContent = '☐';
                } else {
                    this.selections.platforms.push({ id: platformId, followers: parseInt(input.value) || 0 });
                    item.classList.add('selected');
                    input.classList.add('visible');
                    check.textContent = '☑';
                }
            });
        });

        // Platform follower inputs
        this.modal.querySelectorAll('.user-platform-followers').forEach(input => {
            input.addEventListener('change', () => {
                const platformId = input.dataset.platform;
                const platform = this.selections.platforms.find(p => p.id === platformId);
                if (platform) {
                    platform.followers = parseInt(input.value) || 0;
                }
            });
        });

        // Projects handlers
        const addProjectBtn = this.modal.querySelector('#add-project-btn');
        if (addProjectBtn) {
            addProjectBtn.addEventListener('click', () => this.addProject());
        }

        // Project input changes
        this.modal.querySelectorAll('.user-project-item input, .user-project-item select').forEach(el => {
            el.addEventListener('change', () => {
                const index = parseInt(el.dataset.index);
                const field = el.dataset.field;
                if (this.selections.projects[index]) {
                    this.selections.projects[index][field] = el.value;
                }
            });
        });

        // Remove project buttons
        this.modal.querySelectorAll('.user-remove-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.index);
                this.selections.projects.splice(index, 1);
                this.renderStep();
            });
        });

        // Add custom skill
        const addSkillBtn = this.modal.querySelector('#add-skill-btn');
        if (addSkillBtn) {
            addSkillBtn.addEventListener('click', () => {
                const input = this.modal.querySelector('#skill-custom');
                if (input.value.trim() && !this.selections.skills.includes(input.value.trim())) {
                    this.selections.skills.push(input.value.trim());
                    input.value = '';
                    this.renderStep();
                }
            });
        }
    }

    addProject() {
        this.selections.projects.push({ name: '', status: 'building' });
        this.renderStep();
        // Focus the new input
        const inputs = this.modal.querySelectorAll('.user-project-item input');
        if (inputs.length) {
            inputs[inputs.length - 1].focus();
        }
    }

    async nextStep() {
        // Validate current step
        if (this.steps[this.currentStep] === 'projects') {
            // Filter out empty projects
            this.selections.projects = this.selections.projects.filter(p => p.name.trim());
        }

        if (this.currentStep < this.steps.length - 1) {
            this.currentStep++;
            this.renderStep();
        } else {
            // Submit
            await this.submit();
        }
    }

    prevStep() {
        if (this.currentStep > 0) {
            this.currentStep--;
            this.renderStep();
        }
    }

    async submit() {
        if (this.isSubmitting) return;
        this.isSubmitting = true;

        const nextBtn = this.modal.querySelector('.user-btn-next');
        const originalText = nextBtn.textContent;
        nextBtn.textContent = '⏳ Saving...';
        nextBtn.disabled = true;

        try {
            const response = await fetch('/api/user-context', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.selections)
            });

            const result = await response.json();

            if (result.success) {
                this.showSuccess();
            } else {
                throw new Error(result.error || 'Save failed');
            }
        } catch (error) {
            console.error('User context save error:', error);
            nextBtn.textContent = originalText;
            nextBtn.disabled = false;
            alert(`Error: ${error.message}`);
        } finally {
            this.isSubmitting = false;
        }
    }

    showSuccess() {
        const body = this.modal.querySelector('.user-onboarding-body');
        const footer = this.modal.querySelector('.user-onboarding-footer');

        body.innerHTML = `
            <div class="user-success">
                <div class="user-success-icon">🎉</div>
                <h2>You're all set!</h2>
                <p>I now understand your context and can give personalized advice.</p>
                <div class="user-success-tips">
                    <div class="user-tip">💡 Ask me "what should I post today?"</div>
                    <div class="user-tip">📊 Share your weekly results for analysis</div>
                    <div class="user-tip">🎯 Ask for platform-specific strategies</div>
                </div>
            </div>
        `;

        footer.innerHTML = `
            <button class="user-btn-next" onclick="window.userOnboardingWizard.close()">
                Start Chatting →
            </button>
        `;
    }

    close() {
        if (this.modal) {
            this.modal.remove();
            this.modal = null;
        }
        window.userOnboardingWizard = null;
    }
}

// Auto-check and start onboarding if needed
async function checkUserOnboarding() {
    try {
        const response = await fetch('/api/user-context');
        const context = await response.json();

        if (!context.onboarded) {
            // Start onboarding wizard
            window.userOnboardingWizard = new UserOnboardingWizard();
            await window.userOnboardingWizard.start();
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error checking user onboarding:', error);
        return false;
    }
}

// Manual start for edit mode
async function openUserSettings() {
    window.userOnboardingWizard = new UserOnboardingWizard();
    await window.userOnboardingWizard.start();
}

// Export for global access
window.UserOnboardingWizard = UserOnboardingWizard;
window.checkUserOnboarding = checkUserOnboarding;
window.openUserSettings = openUserSettings;
