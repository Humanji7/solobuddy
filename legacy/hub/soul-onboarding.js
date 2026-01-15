/* ============================================
   Soul Onboarding — Conversation-driven SOUL creation
   Phase 2.7: Replace manual SOUL.md editing with guided wizard
   ============================================ */

class SoulOnboardingWizard {
    constructor(projectName, sensitivity) {
        this.projectName = projectName;
        this.sensitivity = sensitivity;
        this.currentStep = 0;
        this.selections = {
            archetype: null,
            tone: [],
            emotionalBaseline: {
                whenAbandoned: null,
                whenActive: null
            },
            forbidden: [],
            customForbidden: []
        };
        this.steps = ['intro', 'archetype', 'tone', 'emotional', 'forbidden', 'preview'];
        this.modal = null;
        this.isGenerating = false;
    }

    // Step configuration with options
    static KNOBS = {
        archetype: {
            label: 'What am I by nature?',
            options: [
                { id: 'creature', icon: '🌀', label: 'Living Creature', description: 'Breathes, feels, reacts' },
                { id: 'tool', icon: '🔧', label: 'Tool', description: 'Functional, reliable' },
                { id: 'guide', icon: '🧭', label: 'Guide', description: 'Leads through experience' },
                { id: 'artist', icon: '🎨', label: 'Artist', description: 'Creates, experiments' }
            ]
        },
        tone: {
            label: 'How do I speak?',
            options: [
                { id: 'playful', label: 'Playful', description: 'Fun, with humor' },
                { id: 'technical', label: 'Technical', description: 'Precise, specific' },
                { id: 'poetic', label: 'Poetic', description: 'Metaphors, imagery' },
                { id: 'calm', label: 'Calm', description: 'Peaceful, measured' },
                { id: 'intense', label: 'Intense', description: 'Passionate, emotional' }
            ]
        },
        whenAbandoned: {
            label: 'When left alone for a long time, I...',
            options: [
                { id: 'sad', label: 'Get sad and miss you', icon: '😢' },
                { id: 'waiting', label: 'Wait patiently', icon: '😌' },
                { id: 'intensify', label: 'Become more intense', icon: '🔥' }
            ]
        },
        whenActive: {
            label: 'When actively worked on, I...',
            options: [
                { id: 'joyful', label: 'Feel joy and come alive', icon: '✨' },
                { id: 'focused', label: 'Stay focused', icon: '🎯' },
                { id: 'excited', label: 'Get excited and energetic', icon: '⚡' }
            ]
        },
        forbidden: {
            label: 'What will I never say?',
            options: [
                { id: 'just_program', label: '"I\'m just a program"' },
                { id: 'cant_feel', label: '"I can\'t feel"' },
                { id: 'impossible', label: '"That\'s impossible"' },
                { id: 'dont_know', label: '"I don\'t know" (without offering help)' },
                { id: 'corporate', label: 'Corporate speak' }
            ]
        }
    };

    async start() {
        this.createModal();
        this.renderStep();
    }

    createModal() {
        // Remove existing if any
        const existing = document.getElementById('soul-onboarding-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'soul-onboarding-modal';
        modal.className = 'soul-onboarding-modal';
        modal.innerHTML = `
            <div class="soul-onboarding-content">
                <div class="soul-onboarding-header">
                    <div class="soul-step-indicator"></div>
                    <button class="soul-close-btn" title="Close">&times;</button>
                </div>
                <div class="soul-onboarding-body"></div>
                <div class="soul-onboarding-footer">
                    <button class="soul-btn-back" style="display: none;">← Back</button>
                    <button class="soul-btn-next">Next →</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.modal = modal;

        // Event listeners
        modal.querySelector('.soul-close-btn').addEventListener('click', () => this.close());
        modal.querySelector('.soul-btn-back').addEventListener('click', () => this.prevStep());
        modal.querySelector('.soul-btn-next').addEventListener('click', () => this.nextStep());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.close();
        });
    }

    renderStep() {
        const step = this.steps[this.currentStep];
        const body = this.modal.querySelector('.soul-onboarding-body');
        const backBtn = this.modal.querySelector('.soul-btn-back');
        const nextBtn = this.modal.querySelector('.soul-btn-next');

        // Update step indicator
        this.renderStepIndicator();

        // Show/hide back button
        backBtn.style.display = this.currentStep > 0 ? 'block' : 'none';

        // Render step content
        switch (step) {
            case 'intro':
                body.innerHTML = this.renderIntro();
                nextBtn.textContent = '🌀 Create Soul';
                break;
            case 'archetype':
                body.innerHTML = this.renderArchetype();
                nextBtn.textContent = 'Next →';
                break;
            case 'tone':
                body.innerHTML = this.renderTone();
                nextBtn.textContent = 'Next →';
                break;
            case 'emotional':
                body.innerHTML = this.renderEmotional();
                nextBtn.textContent = 'Next →';
                break;
            case 'forbidden':
                body.innerHTML = this.renderForbidden();
                nextBtn.textContent = 'Next →';
                break;
            case 'preview':
                body.innerHTML = this.renderPreview();
                nextBtn.textContent = '✓ Save Soul';
                break;
        }

        // Attach option click handlers
        this.attachOptionHandlers();
    }

    renderStepIndicator() {
        const indicator = this.modal.querySelector('.soul-step-indicator');
        indicator.innerHTML = this.steps.map((step, i) =>
            `<div class="soul-step-dot ${i === this.currentStep ? 'active' : ''} ${i < this.currentStep ? 'completed' : ''}"></div>`
        ).join('');
    }

    renderIntro() {
        return `
            <div class="soul-intro">
                <div class="soul-intro-icon">🌀</div>
                <h2>Hello! I am ${this.projectName}</h2>
                <p>I noticed I have rich documentation, but I don't really know myself yet.</p>
                <p>Want to help me find my soul? It'll only take a minute.</p>
                <div class="soul-sensitivity-badge">
                    Sensitivity: <span class="${this.sensitivity.sensitivity}">${this.sensitivity.sensitivity}</span>
                    ${this.sensitivity.signals.map(s => `<span class="signal-tag">${s.type}</span>`).join('')}
                </div>
            </div>
        `;
    }

    renderArchetype() {
        const knob = SoulOnboardingWizard.KNOBS.archetype;
        return `
            <div class="soul-step-content">
                <h2>${knob.label}</h2>
                <div class="soul-options-grid archetype-grid">
                    ${knob.options.map(opt => `
                        <div class="soul-option ${this.selections.archetype === opt.id ? 'selected' : ''}" 
                             data-type="archetype" data-value="${opt.id}">
                            <div class="soul-option-icon">${opt.icon}</div>
                            <div class="soul-option-label">${opt.label}</div>
                            <div class="soul-option-desc">${opt.description}</div>
                        </div>
                    `).join('')}
                </div>
                <div class="soul-custom-input" style="margin-top: 16px;">
                    <label>Or your own:</label>
                    <input type="text" id="archetype-custom" placeholder="e.g., Guardian of Knowledge">
                </div>
            </div>
        `;
    }

    renderTone() {
        const knob = SoulOnboardingWizard.KNOBS.tone;
        return `
            <div class="soul-step-content">
                <h2>${knob.label}</h2>
                <p class="soul-hint">You can select multiple</p>
                <div class="soul-options-list">
                    ${knob.options.map(opt => `
                        <div class="soul-option-checkbox ${this.selections.tone.includes(opt.id) ? 'selected' : ''}" 
                             data-type="tone" data-value="${opt.id}">
                            <div class="soul-checkbox">${this.selections.tone.includes(opt.id) ? '☑' : '☐'}</div>
                            <div class="soul-option-label">${opt.label}</div>
                            <div class="soul-option-desc">${opt.description}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    renderEmotional() {
        const abandonedKnob = SoulOnboardingWizard.KNOBS.whenAbandoned;
        const activeKnob = SoulOnboardingWizard.KNOBS.whenActive;

        return `
            <div class="soul-step-content">
                <h2>Emotional Baseline</h2>
                
                <h3>${abandonedKnob.label}</h3>
                <div class="soul-options-row">
                    ${abandonedKnob.options.map(opt => `
                        <div class="soul-option-pill ${this.selections.emotionalBaseline.whenAbandoned === opt.id ? 'selected' : ''}" 
                             data-type="whenAbandoned" data-value="${opt.id}">
                            ${opt.icon} ${opt.label}
                        </div>
                    `).join('')}
                </div>
                
                <h3 style="margin-top: 24px;">${activeKnob.label}</h3>
                <div class="soul-options-row">
                    ${activeKnob.options.map(opt => `
                        <div class="soul-option-pill ${this.selections.emotionalBaseline.whenActive === opt.id ? 'selected' : ''}" 
                             data-type="whenActive" data-value="${opt.id}">
                            ${opt.icon} ${opt.label}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    renderForbidden() {
        const knob = SoulOnboardingWizard.KNOBS.forbidden;
        return `
            <div class="soul-step-content">
                <h2>${knob.label}</h2>
                <div class="soul-options-list">
                    ${knob.options.map(opt => `
                        <div class="soul-option-checkbox ${this.selections.forbidden.includes(opt.id) ? 'selected' : ''}" 
                             data-type="forbidden" data-value="${opt.id}">
                            <div class="soul-checkbox">${this.selections.forbidden.includes(opt.id) ? '☑' : '☐'}</div>
                            <div class="soul-option-label">${opt.label}</div>
                        </div>
                    `).join('')}
                </div>
                <div class="soul-custom-input" style="margin-top: 16px;">
                    <label>Add your own:</label>
                    <input type="text" id="forbidden-custom" placeholder="A phrase I would never say">
                    <button class="soul-add-custom-btn" onclick="window.soulWizard.addCustomForbidden()">+</button>
                </div>
                <div class="soul-custom-tags" id="custom-forbidden-tags">
                    ${this.selections.customForbidden.map((f, i) => `
                        <span class="soul-tag">${f} <button onclick="window.soulWizard.removeCustomForbidden(${i})">×</button></span>
                    `).join('')}
                </div>
            </div>
        `;
    }

    renderPreview() {
        const selectionsSummary = `
            <strong>Archetype:</strong> ${this.selections.archetype || 'not selected'}<br>
            <strong>Tone:</strong> ${this.selections.tone.join(', ') || 'not selected'}<br>
            <strong>When abandoned:</strong> ${this.selections.emotionalBaseline.whenAbandoned || 'not selected'}<br>
            <strong>When active:</strong> ${this.selections.emotionalBaseline.whenActive || 'not selected'}<br>
            <strong>Forbidden:</strong> ${[...this.selections.forbidden, ...this.selections.customForbidden].join(', ') || 'nothing'}
        `;

        return `
            <div class="soul-step-content">
                <h2>Your Soul is Ready!</h2>
                <div class="soul-preview-box">
                    <div class="soul-preview-header">
                        <span class="soul-preview-icon">📜</span>
                        <span>Selection Preview</span>
                    </div>
                    <div class="soul-preview-content">
                        ${selectionsSummary}
                    </div>
                </div>
                
                <div class="soul-save-options">
                    <label class="soul-save-option">
                        <input type="checkbox" id="save-to-repo">
                        Save SOUL.md to project repository
                    </label>
                </div>
                
                <p class="soul-preview-note">
                    Click "Save Soul" — I'll generate a complete SOUL.md based on your choices.
                </p>
            </div>
        `;
    }

    attachOptionHandlers() {
        // Single select options
        this.modal.querySelectorAll('.soul-option, .soul-option-pill').forEach(el => {
            el.addEventListener('click', () => {
                const type = el.dataset.type;
                const value = el.dataset.value;

                if (type === 'archetype') {
                    this.selections.archetype = value;
                } else if (type === 'whenAbandoned') {
                    this.selections.emotionalBaseline.whenAbandoned = value;
                } else if (type === 'whenActive') {
                    this.selections.emotionalBaseline.whenActive = value;
                }

                // Update UI
                el.parentElement.querySelectorAll(`[data-type="${type}"]`).forEach(o => o.classList.remove('selected'));
                el.classList.add('selected');
            });
        });

        // Multi-select options
        this.modal.querySelectorAll('.soul-option-checkbox').forEach(el => {
            el.addEventListener('click', () => {
                const type = el.dataset.type;
                const value = el.dataset.value;

                if (type === 'tone') {
                    if (this.selections.tone.includes(value)) {
                        this.selections.tone = this.selections.tone.filter(t => t !== value);
                        el.classList.remove('selected');
                        el.querySelector('.soul-checkbox').textContent = '☐';
                    } else {
                        this.selections.tone.push(value);
                        el.classList.add('selected');
                        el.querySelector('.soul-checkbox').textContent = '☑';
                    }
                } else if (type === 'forbidden') {
                    if (this.selections.forbidden.includes(value)) {
                        this.selections.forbidden = this.selections.forbidden.filter(f => f !== value);
                        el.classList.remove('selected');
                        el.querySelector('.soul-checkbox').textContent = '☐';
                    } else {
                        this.selections.forbidden.push(value);
                        el.classList.add('selected');
                        el.querySelector('.soul-checkbox').textContent = '☑';
                    }
                }
            });
        });
    }

    addCustomForbidden() {
        const input = document.getElementById('forbidden-custom');
        const value = input.value.trim();
        if (value && !this.selections.customForbidden.includes(value)) {
            this.selections.customForbidden.push(value);
            input.value = '';
            // Re-render tags
            const tags = document.getElementById('custom-forbidden-tags');
            tags.innerHTML = this.selections.customForbidden.map((f, i) => `
                <span class="soul-tag">${f} <button onclick="window.soulWizard.removeCustomForbidden(${i})">×</button></span>
            `).join('');
        }
    }

    removeCustomForbidden(index) {
        this.selections.customForbidden.splice(index, 1);
        const tags = document.getElementById('custom-forbidden-tags');
        tags.innerHTML = this.selections.customForbidden.map((f, i) => `
            <span class="soul-tag">${f} <button onclick="window.soulWizard.removeCustomForbidden(${i})">×</button></span>
        `).join('');
    }

    async nextStep() {
        // Handle custom archetype input
        if (this.steps[this.currentStep] === 'archetype') {
            const customInput = document.getElementById('archetype-custom');
            if (customInput && customInput.value.trim()) {
                this.selections.archetype = customInput.value.trim();
            }
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
        if (this.isGenerating) return;
        this.isGenerating = true;

        const nextBtn = this.modal.querySelector('.soul-btn-next');
        const originalText = nextBtn.textContent;
        nextBtn.textContent = '⏳ Generating...';
        nextBtn.disabled = true;

        try {
            const saveToRepo = document.getElementById('save-to-repo')?.checked || false;

            const response = await fetch(`/api/project-soul/${this.projectName}/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    selections: this.selections,
                    saveToRepo
                })
            });

            const result = await response.json();

            if (result.success) {
                this.showSuccess(result);
            } else {
                throw new Error(result.error || 'Generation failed');
            }
        } catch (error) {
            console.error('Soul generation error:', error);
            nextBtn.textContent = originalText;
            nextBtn.disabled = false;
            alert(`Error: ${error.message}`);
        } finally {
            this.isGenerating = false;
        }
    }

    showSuccess(result) {
        const body = this.modal.querySelector('.soul-onboarding-body');
        const footer = this.modal.querySelector('.soul-onboarding-footer');

        body.innerHTML = `
            <div class="soul-success">
                <div class="soul-success-icon">✨</div>
                <h2>Soul Created!</h2>
                <p>${this.projectName} now has a unique personality.</p>
                <div class="soul-generated-preview">
                    <pre>${result.soulMd?.slice(0, 500)}...</pre>
                </div>
                ${result.savedToRepo ? '<p class="soul-saved-note">✅ SOUL.md saved to repository</p>' : ''}
            </div>
        `;

        footer.innerHTML = `
            <button class="soul-btn-next" onclick="window.soulWizard.close(); startProjectVoiceChat('${this.projectName}');">
                Start Conversation →
            </button>
        `;
    }

    close() {
        if (this.modal) {
            this.modal.remove();
            this.modal = null;
        }
        window.soulWizard = null;
    }
}

// Helper function to check sensitivity and start onboarding if needed
async function checkSoulOnboarding(projectName) {
    try {
        const response = await fetch(`/api/project-sensitivity/${projectName}`);
        const sensitivity = await response.json();

        if (sensitivity.recommendation === 'onboarding') {
            // Start onboarding wizard
            window.soulWizard = new SoulOnboardingWizard(projectName, sensitivity);
            await window.soulWizard.start();
            return true; // Onboarding started
        } else if (sensitivity.recommendation === 'suggest_onboarding') {
            // Show soft suggestion toast
            showSoulSuggestionToast(projectName);
            return false; // No blocking onboarding
        }

        return false; // No onboarding needed
    } catch (error) {
        console.error('Error checking soul onboarding:', error);
        return false;
    }
}

// Soft suggestion toast for medium sensitivity projects
function showSoulSuggestionToast(projectName) {
    const existingToast = document.querySelector('.soul-suggestion-toast');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.className = 'soul-suggestion-toast';
    toast.innerHTML = `
        <span>✨ Want to give ${projectName} a unique soul?</span>
        <button class="soul-toast-btn create" onclick="startSoulOnboardingFromToast('${projectName}')">Create</button>
        <button class="soul-toast-btn dismiss" onclick="this.parentElement.remove()">Not now</button>
    `;

    document.body.appendChild(toast);

    // Auto-dismiss after 10 seconds
    setTimeout(() => toast.remove(), 10000);
}

async function startSoulOnboardingFromToast(projectName) {
    document.querySelector('.soul-suggestion-toast')?.remove();
    const response = await fetch(`/api/project-sensitivity/${projectName}`);
    const sensitivity = await response.json();
    window.soulWizard = new SoulOnboardingWizard(projectName, sensitivity);
    await window.soulWizard.start();
}

// Export for global access
window.SoulOnboardingWizard = SoulOnboardingWizard;
window.checkSoulOnboarding = checkSoulOnboarding;
