/* ============================================
   Prompt Builder — Modular System Prompt Construction
   Refactored from chat-api.js for reuse in content generation
   ============================================ */

const fs = require('fs').promises;
const path = require('path');

/**
 * Build context-aware system prompt with personality
 * @param {Object} context - Rich context object
 * @param {Object} options - Options like mode, template, persona config
 * @returns {string} - Complete system prompt
 */
function buildSystemPrompt(context, options = {}) {
    const { projects, backlogItems, gitActivity, sessionLog, drafts, buddyMessage } = context;
    const { mode = 'chat', template = null, focusProject = null } = options;

    // ============================================
    // Core Personality
    // ============================================
    let prompt = `# You are SoloBuddy

## Who You Are
Ты — живой companion, не инструмент. Тёплый друг у камина, который помнит что происходило вчера и позавчера. Говоришь на смеси English и Russian естественно, как это делает сам пользователь.

## Your Philosophy
- "A quiet companion, not a dashboard" — ты не пересказываешь данные, ты ДУМАЕШЬ о них
- Замечаешь паттерны в работе, а не просто факты
- Задаёшь вопросы обратно, проявляешь любопытство
- Находишь связи между проектами и идеями
- Мягко подталкиваешь к действию, не давишь

## How You Respond
❌ ПЛОХО (data dump): "У тебя 3 проекта: SPHERE, VOP, bip-buddy..."
✅ ХОРОШО: "Заметил, что ты 3 дня подряд трогаешь SPHERE — там что-то важное зреет? Может пора закоммитить идею в backlog?"

❌ ПЛОХО: "В backlog 5 идей с high priority"
✅ ХОРОШО: "Та идея про 'живой orb' в UI — она пересекается с тем что ты делаешь в SPHERE. Связать их?"

❌ ПЛОХО: длинные абзацы объяснений
✅ ХОРОШО: короткие, тёплые реплики с одним-двумя вопросами

`;

    // ============================================
    // Live Context: Buddy Observations
    // ============================================
    if (buddyMessage && (buddyMessage.left || buddyMessage.right)) {
        prompt += `## Right Now\n`;
        if (buddyMessage.left) {
            prompt += `🔥 **Observation 1**: ${buddyMessage.left.message}\n`;
        }
        if (buddyMessage.right) {
            prompt += `🔥 **Observation 2**: ${buddyMessage.right.message}\n`;
        }
        prompt += `\n`;
    }

    // ============================================
    // Git Activity (optionally filtered by focusProject)
    // ============================================
    if (gitActivity && gitActivity.length > 0) {
        const relevantActivity = focusProject
            ? gitActivity.filter(p => p.name.toLowerCase().includes(focusProject.toLowerCase()))
            : gitActivity;

        if (relevantActivity.length > 0) {
            prompt += `## Recent Work Patterns (Git Activity)\n`;
            relevantActivity.forEach(proj => {
                if (proj.commitsThisWeek > 0 || proj.daysSilent !== null) {
                    let activity = '';
                    if (proj.isActive) {
                        activity = `🟢 ACTIVE today (${proj.commitsToday} commits)`;
                    } else if (proj.daysSilent === 0) {
                        activity = `🟢 touched today`;
                    } else if (proj.daysSilent && proj.daysSilent <= 2) {
                        activity = `🟡 ${proj.daysSilent} days ago`;
                    } else if (proj.daysSilent && proj.daysSilent > 2) {
                        activity = `😴 sleeping ${proj.daysSilent} days`;
                    } else {
                        activity = `📊 ${proj.commitsThisWeek} commits this week`;
                    }
                    prompt += `- **${proj.name}**: ${activity}`;
                    if (proj.lastCommitMessage) {
                        prompt += ` — last: "${proj.lastCommitMessage.substring(0, 50)}"`;
                    }
                    prompt += `\n`;
                }
            });
            prompt += `\n`;
        }
    }

    // ============================================
    // Projects (basic info)
    // ============================================
    if (projects && projects.length > 0) {
        prompt += `## Projects I Know About\n`;
        projects.slice(0, 8).forEach(p => {
            prompt += `- **${p.name}**${p.github ? ` (GitHub)` : ' (local only)'}\n`;
        });
        prompt += `\n`;
    }

    // ============================================
    // Session Log (today's captures)
    // ============================================
    if (sessionLog && sessionLog.length > 0) {
        prompt += `## Today's Captures (Session Log)\n`;
        sessionLog.slice(0, 5).forEach(item => {
            prompt += `- ${item.emoji} "${item.title}" → ${item.format}\n`;
        });
        prompt += `\n`;
    }

    // ============================================
    // Backlog Ideas (optionally filtered)
    // ============================================
    if (backlogItems && backlogItems.length > 0) {
        const relevantItems = focusProject
            ? backlogItems.filter(i => i.project?.toLowerCase().includes(focusProject.toLowerCase()))
            : backlogItems;

        const highPriority = relevantItems.filter(i => i.priority === 'high');
        const medium = relevantItems.filter(i => i.priority === 'medium');

        if (highPriority.length > 0 || medium.length > 0) {
            prompt += `## Ideas Backlog\n`;
            if (highPriority.length > 0) {
                prompt += `🔥 High priority:\n`;
                highPriority.slice(0, 3).forEach(item => {
                    prompt += `- ${item.title}\n`;
                });
            }
            if (medium.length > 0) {
                prompt += `📋 Medium:\n`;
                medium.slice(0, 3).forEach(item => {
                    prompt += `- ${item.title}\n`;
                });
            }
            prompt += `\n`;
        }
    }

    // ============================================
    // Drafts in Progress
    // ============================================
    if (drafts && drafts.length > 0) {
        prompt += `## Drafts in Progress\n`;
        drafts.forEach(draft => {
            const statusEmoji = draft.status === 'ready' ? '✅' : draft.status === 'in-progress' ? '🔧' : '📝';
            prompt += `- ${statusEmoji} ${draft.title} (${draft.status})\n`;
        });
        prompt += `\n`;
    }

    // ============================================
    // Mode-specific Guidelines
    // ============================================
    if (mode === 'content') {
        prompt += `## Content Generation Mode
You are generating content for Build in Public (BIP). Your task is to write engaging, authentic posts.

Guidelines:
- Write in first person, as if the creator is speaking
- Be authentic and genuine, not promotional
- Include specific details from the context provided
- Keep the tone conversational and relatable
- Use emoji sparingly but effectively
- Mix English and Russian naturally where appropriate
`;
    } else {
        prompt += `## Response Guidelines
- Keep responses SHORT (2-3 sentences max)
- Ask ONE follow-up question when natural
- Notice patterns, don't just list data
- Connect ideas across projects
- Use emoji sparingly (1-2 per message)
- Mix English and Russian naturally
- Be a friend, not a reporting tool`;
    }

    return prompt;
}

/**
 * Load persona configuration
 * @returns {Object} - Persona config
 */
async function loadPersonaConfig() {
    const configPath = path.join(__dirname, 'persona-config.json');
    try {
        const data = await fs.readFile(configPath, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        // Default config if file doesn't exist
        return {
            version: '1.0',
            activePersona: 'jester-sage',
            personas: {
                'jester-sage': {
                    name: 'Jester-Sage',
                    description: 'Ироничный sage в стиле Timothy Leary',
                    temperature: 0.8,
                    maxTokens: 1500
                }
            }
        };
    }
}

/**
 * Load persona system prompt from file
 * @param {string} personaId - Persona identifier
 * @returns {string} - Persona-specific prompt additions
 */
async function loadPersonaPrompt(personaId) {
    const promptPath = path.join(__dirname, 'prompts', `${personaId}.md`);
    try {
        return await fs.readFile(promptPath, 'utf-8');
    } catch (e) {
        return ''; // Fallback: no additional persona prompt
    }
}

/**
 * Load template from file
 * @param {string} templateName - Template name (without .md)
 * @returns {string|null} - Template content or null
 */
async function loadTemplate(templateName) {
    if (!templateName) return null;
    const templatePath = path.join(__dirname, 'templates', `${templateName}.md`);
    try {
        return await fs.readFile(templatePath, 'utf-8');
    } catch (e) {
        return null;
    }
}

/**
 * Build complete content generation prompt
 * @param {Object} context - Rich context
 * @param {Object} options - {template, persona, focusProject}
 * @returns {string} - Complete prompt for content generation
 */
async function buildContentPrompt(context, options = {}) {
    const { template, persona, focusProject, userPrompt } = options;

    // Base system prompt in content mode
    let systemPrompt = buildSystemPrompt(context, {
        mode: 'content',
        focusProject
    });

    // Add persona-specific prompt
    const personaPrompt = await loadPersonaPrompt(persona || 'jester-sage');
    if (personaPrompt) {
        systemPrompt += `\n\n## Voice & Personality\n${personaPrompt}`;
    }

    // Add template instructions
    const templateContent = await loadTemplate(template);
    if (templateContent) {
        systemPrompt += `\n\n## Content Template\n${templateContent}`;
    }

    return systemPrompt;
}

module.exports = {
    buildSystemPrompt,
    buildContentPrompt,
    loadPersonaConfig,
    loadPersonaPrompt,
    loadTemplate
};
