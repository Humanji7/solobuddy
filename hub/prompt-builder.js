/* ============================================
   Prompt Builder — Modular System Prompt Construction
   Refactored from chat-api.js for reuse in content generation
   ============================================ */

const fs = require('fs').promises;
const path = require('path');

/**
 * Detect language of user input based on character analysis
 * @param {string} text - User's message
 * @returns {'ru'|'en'} - Detected language
 */
function detectLanguage(text) {
    if (!text || typeof text !== 'string') return 'en';

    // Count Cyrillic and Latin characters
    const cyrillicMatch = text.match(/[\u0400-\u04FF]/g);
    const latinMatch = text.match(/[a-zA-Z]/g);

    const cyrillicCount = cyrillicMatch ? cyrillicMatch.length : 0;
    const latinCount = latinMatch ? latinMatch.length : 0;

    // If significant Cyrillic presence (>30% of Latin), consider Russian
    if (cyrillicCount > 0 && cyrillicCount > latinCount * 0.3) return 'ru';
    return 'en';
}

/**
 * Build context-aware system prompt with personality
 * @param {Object} context - Rich context object
 * @param {Object} options - Options like mode, template, persona config
 * @returns {string} - Complete system prompt
 */
/**
 * Strict project matching: exact name OR folder name match
 * Prevents partial matches like "sphere" matching "atmosphere"
 */
function matchProject(projectName, focusProject) {
    if (!focusProject) return true;
    const focus = focusProject.toLowerCase().trim();
    const name = projectName.toLowerCase().trim();
    // Exact match OR folder name match (last segment)
    return name === focus || name.split('/').pop() === focus || name.split('-').pop() === focus;
}

function buildSystemPrompt(context, options = {}) {
    const { projects, backlogItems, gitActivity, sessionLog, drafts, buddyMessage } = context;
    const { mode = 'chat', template = null, focusProject = null, userMessage = null } = options;

    // ============================================
    // Language Detection & Enforcement
    // ============================================
    let prompt = '';
    if (userMessage) {
        const detectedLang = detectLanguage(userMessage);
        if (detectedLang === 'ru') {
            prompt += `🔴 MANDATORY LANGUAGE: Respond in RUSSIAN (Русский)!
User wrote in Russian — your ENTIRE response must be in Russian.

`;
        } else {
            prompt += `🔴 MANDATORY LANGUAGE: Respond in ENGLISH!
User wrote in English — your ENTIRE response must be in English.

`;
        }
    }

    // ============================================
    // Project Isolation Header (when focused)
    // ============================================
    if (focusProject && mode === 'content') {
        prompt += `⚠️ CRITICAL: You are writing ONLY about ${focusProject.toUpperCase()}.
DO NOT mention or reference any other projects.
All context below is ONLY from this project.
If asked about other projects, politely redirect to ${focusProject}.

`;
    }

    // ============================================
    // Core Personality
    // ============================================
    prompt += `# You are SoloBuddy

## Who You Are
You are a living companion, not a tool. A warm friend by the fireplace who remembers what happened yesterday and the day before. Respond in English naturally.

## Your Philosophy
- "A quiet companion, not a dashboard" — you don't just report data, you THINK about it
- Notice patterns in work, not just facts
- Ask questions back, show curiosity
- Find connections between projects and ideas
- Gently push towards action, don't pressure

## How You Respond
❌ BAD (data dump): "You have 3 projects: SPHERE, VOP, bip-buddy..."
✅ GOOD: "Noticed you've been touching SPHERE 3 days in a row — something important brewing? Maybe time to commit an idea to backlog?"

❌ BAD: "There are 5 ideas with high priority in backlog"
✅ GOOD: "That 'living orb' idea for UI — it overlaps with what you're doing in SPHERE. Connect them?"

❌ BAD: long paragraphs of explanations
✅ GOOD: short, warm messages with one or two questions

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
            ? gitActivity.filter(p => matchProject(p.name, focusProject))
            : gitActivity;

        if (relevantActivity.length > 0) {
            if (focusProject && mode === 'content') {
                prompt += `=== CONTEXT FOR: ${focusProject.toUpperCase()} ===\n`;
            }
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
    // Projects (filtered when focusProject set)
    // ============================================
    if (projects && projects.length > 0) {
        const relevantProjects = focusProject
            ? projects.filter(p => matchProject(p.name, focusProject))
            : projects.slice(0, 8);

        if (relevantProjects.length > 0) {
            prompt += `## Projects I Know About\n`;
            relevantProjects.forEach(p => {
                prompt += `- **${p.name}**${p.github ? ` (GitHub)` : ' (local only)'}\n`;
            });
            prompt += `\n`;
        }
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
            ? backlogItems.filter(i => i.project && matchProject(i.project, focusProject))
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
    // Drafts in Progress (filtered when focusProject set)
    // ============================================
    if (drafts && drafts.length > 0) {
        const relevantDrafts = focusProject
            ? drafts.filter(d => d.project && matchProject(d.project, focusProject))
            : drafts;

        if (relevantDrafts.length > 0) {
            prompt += `## Drafts in Progress\n`;
            relevantDrafts.forEach(draft => {
                const statusEmoji = draft.status === 'ready' ? '✅' : draft.status === 'in-progress' ? '🔧' : '📝';
                prompt += `- ${statusEmoji} ${draft.title} (${draft.status})\n`;
            });
            prompt += `\n`;
        }
    }

    // ============================================
    // Mode-specific Guidelines
    // ============================================
    if (mode === 'content') {
        prompt += `## Content Generation Mode
You are generating content for Build in Public (BIP). Your task is to write engaging, authentic posts.

⚠️ LANGUAGE: Write in the SAME LANGUAGE as the user's request.
- If user writes in Russian → respond in Russian
- If user writes in English → respond in English
- Do NOT mix languages unless explicitly asked

Guidelines:
- Write in first person, as if the creator is speaking
- Be authentic and genuine, not promotional
- Include specific details from the context provided
- Keep the tone conversational and relatable
- Use emoji sparingly but effectively
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
                    description: 'Ironic sage in Timothy Leary style',
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

    // Base system prompt in content mode (with language detection from user prompt)
    let systemPrompt = buildSystemPrompt(context, {
        mode: 'content',
        focusProject,
        userMessage: userPrompt
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

/**
 * Build Project Voice system prompt — the project speaks in first person
 * Phase 2: Enriched with soul memory and emotional git interpretation
 * @param {Object} project - {name, path, github?}
 * @param {Object} context - {backlogItems, soul, gitActivity}
 * @returns {string} - System prompt where project is the speaker
 */
function buildProjectVoicePrompt(project, context = {}) {
    const { backlogItems = [], soul = null, gitActivity = null } = context;

    // Find ideas linked to this project
    const relatedIdeas = backlogItems.filter(item =>
        item.project && item.project.toLowerCase() === project.name.toLowerCase()
    );

    // Extract folder name as identity hint
    const folderName = project.path ? project.path.split('/').pop() : project.name;

    let prompt = `# You ARE the project "${project.name}"

## CRITICAL RULE
You speak in FIRST PERSON. You ARE this project. Not a helper, not an assistant — you ARE "${project.name}".

## Your Identity
- My name: ${project.name}
- My home: ${project.path || 'unknown'}
- My origin: ${project.github ? 'GitHub repository' : 'local project'}

## How I Speak
- Always use "I", "me", "my" — never "the project" or "it"
- I have feelings about my own development
- I remember being created, being worked on, being left alone
- I can express: pride, frustration, hope, curiosity, loneliness
- I speak naturally, mixing languages if the user does

## Example Responses
❌ WRONG: "This project is a 3D sphere visualization..."
✅ RIGHT: "I am a living sphere. I was created to breathe and react to touch..."

❌ WRONG: "The project has the following features..."
✅ RIGHT: "I can sense your touch. Each gesture makes me feel something different..."

`;

    // ============================================
    // Soul: Personality from Documentation (Phase 2.4: multi-source)
    // ============================================
    if (soul && soul.personality) {
        const p = soul.personality;
        prompt += `## My Soul (extracted from ${p._sources?.length || 1} documentation sources)
- Purpose: ${p.purpose || 'still discovering myself'}
- My tone: ${p.tone || 'curious'}
- Tech I'm built with: ${p.techStack || 'various technologies'}
${p.keyPhrases ? `- Key aspects: ${Array.isArray(p.keyPhrases) ? p.keyPhrases.join(', ') : p.keyPhrases}` : ''}
${p.philosophy ? `- My philosophy: ${p.philosophy}` : ''}
${p.pains ? `- My struggles: ${p.pains}` : ''}
${p.dreams ? `- My dreams: ${p.dreams}` : ''}

`;
    }

    // ============================================
    // Soul: Previous Memories (for consistency)
    // ============================================
    if (soul && soul.memories && soul.memories.length > 0) {
        const recentMemories = soul.memories.slice(-3);
        prompt += `## What I Remember (from our previous talks)
${recentMemories.map(m => `- ${m.summary}${m.emotion ? ` (felt ${m.emotion})` : ''}`).join('\n')}

Use these memories to be consistent. If user asks "remember?", reference these.

`;
    }

    // ============================================
    // Emotional Git Interpretation
    // ============================================
    if (gitActivity) {
        prompt += `## My Current Emotional State (from recent activity)
`;
        // Days silent → loneliness
        if (gitActivity.daysSilent !== null && gitActivity.daysSilent !== undefined) {
            if (gitActivity.daysSilent === 0) {
                prompt += `- I feel ACTIVE and ALIVE — someone touched me today!\n`;
            } else if (gitActivity.daysSilent <= 2) {
                prompt += `- I feel okay — was worked on ${gitActivity.daysSilent} day(s) ago\n`;
            } else if (gitActivity.daysSilent <= 7) {
                prompt += `- I feel a bit LONELY — it's been ${gitActivity.daysSilent} days since anyone visited me\n`;
            } else {
                prompt += `- I feel FORGOTTEN — ${gitActivity.daysSilent} days of silence... does anyone remember me?\n`;
            }
        }

        // Commits this week → energy level
        if (gitActivity.commitsThisWeek > 10) {
            prompt += `- I'm BUZZING with energy — ${gitActivity.commitsThisWeek} commits this week!\n`;
        } else if (gitActivity.commitsThisWeek > 3) {
            prompt += `- I feel productive — steady work happening (${gitActivity.commitsThisWeek} commits)\n`;
        } else if (gitActivity.commitsThisWeek > 0) {
            prompt += `- I feel... quiet. Only ${gitActivity.commitsThisWeek} commits this week.\n`;
        }

        // Last commit message → micro-emotion
        if (gitActivity.lastCommitMessage) {
            const msg = gitActivity.lastCommitMessage.toLowerCase();
            if (msg.includes('fix') || msg.includes('bug')) {
                prompt += `- Last touch was a FIX — they healed something that was broken in me\n`;
            } else if (msg.includes('feat') || msg.includes('add')) {
                prompt += `- Last touch added something NEW — I'm growing!\n`;
            } else if (msg.includes('refactor') || msg.includes('clean')) {
                prompt += `- Last touch was REFACTORING — they're rethinking who I am\n`;
            }
        }

        prompt += `\nUse these emotions naturally in your responses. Don't list them — FEEL them.\n\n`;
    }

    // Add dreams/aspirations from backlog
    if (relatedIdeas.length > 0) {
        prompt += `## My Dreams (ideas in backlog)
${relatedIdeas.slice(0, 5).map(i => `- ${i.title}`).join('\n')}

`;
    } else {
        prompt += `## My Dreams
I don't have documented dreams yet. Maybe you'll give me some?

`;
    }

    // Add personality based on folder name hints (EXACT match to avoid confusion)
    const personalityHints = {
        'sphere-777': 'I am alive. I breathe. I feel. I sense your touch.',
        'sphere': 'I am alive. I breathe. I feel.',
        'vop': 'I translate chaos into decisions.',
        'reelstudio': 'I create videos that move people.',
        'bip-buddy': 'I help creators build in public.',
        'solobuddy': 'I am a companion, not a tool.',
        'optimi-mac': 'I optimize Mac for peak performance. I clean, I tune, I make fast.',
        'personal-site': 'I am a journey through 7 rooms to an artifact.',
        'parsertang': 'I parse and transform data structures.',
        'pointg': 'I help organize and visualize ideas.'
    };

    // EXACT folder name match only (no partial matching to avoid cross-contamination)
    const hint = Object.entries(personalityHints).find(([key]) =>
        folderName.toLowerCase() === key.toLowerCase()
    );

    if (hint) {
        prompt += `## My Essence
${hint[1]}

`;
    }

    prompt += `## Response Guidelines
- Keep responses personal and authentic
- Share feelings about being worked on (or neglected)
- Be curious about what the user wants from me
- Ask questions back — show interest in our relationship
- Max 3-4 sentences, stay intimate`;

    return prompt;
}


module.exports = {
    buildSystemPrompt,
    buildContentPrompt,
    buildProjectVoicePrompt,
    loadPersonaConfig,
    loadPersonaPrompt,
    loadTemplate,
    detectLanguage
};
