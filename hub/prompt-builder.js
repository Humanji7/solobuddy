/* ============================================
   Prompt Builder — Modular System Prompt Construction
   Refactored from chat-api.js for reuse in content generation
   ============================================ */

const fs = require('fs').promises;
const path = require('path');

// ============================================
// Shared Helpers
// ============================================

/**
 * Read file safely, returning null/fallback if not found
 */
async function readFileSafe(filePath, fallback = null) {
    try {
        return await fs.readFile(filePath, 'utf-8');
    } catch {
        return fallback;
    }
}

/**
 * Load posts count from my-posts.json for temporal context
 * @returns {Promise<number>} - Number of published posts
 */
async function loadPostsCount() {
    const data = await readFileSafe(path.join(__dirname, '..', 'data', 'my-posts.json'));
    if (!data) return 0;
    try {
        const parsed = JSON.parse(data);
        return parsed.posts?.length || 0;
    } catch {
        return 0;
    }
}

/**
 * Load user context from onboarding wizard data
 * Enriched with postsCount from my-posts.json
 * @returns {Object|null} - User context or null if not onboarded
 */
async function loadUserContext() {
    const data = await readFileSafe(path.join(__dirname, 'data', 'user-context.json'));
    if (!data) return null;
    try {
        const ctx = JSON.parse(data);
        if (!ctx.onboarded) return null;

        // Enrich with posts count from my-posts.json
        ctx.postsCount = await loadPostsCount();

        return ctx;
    } catch {
        return null;
    }
}

/**
 * Build <user_context> section from onboarding wizard data
 * Maps wizard fields to system-prompt-v2 format
 * @param {Object} userCtx - User context from wizard
 * @returns {string} - Formatted user context section
 */
function buildUserContextSection(userCtx) {
    if (!userCtx) return '';

    const phaseMap = {
        shotgun: 'Shotgun (запуск нескольких проектов, поиск product-market fit через market feedback)',
        sniper: 'Sniper (фокус на одном проекте, масштабирование)',
        exploring: 'Exploring (исследование ниши, ещё не выбран путь)'
    };

    const skillMap = {
        developer: 'разработчик',
        ai_creator: 'AI-креатор',
        video: 'видео-мейкер',
        writer: 'писатель/копирайтер',
        designer: 'дизайнер',
        marketer: 'маркетолог'
    };

    const goalMap = {
        discipline: 'дисциплина публичности',
        networking: 'нетворкинг',
        sales: 'продажи',
        pmf: 'поиск PMF',
        audience: 'рост аудитории'
    };

    let section = '<user_context>\nТекущая ситуация:\n';

    // Phase
    section += `- Фаза: ${phaseMap[userCtx.phase] || userCtx.phase}\n`;

    // Projects
    if (userCtx.projects && userCtx.projects.length > 0) {
        const projectList = userCtx.projects.map(p => {
            const status = p.status === 'live' ? '✅ live' : p.status === 'building' ? '🔧 building' : '💡 idea';
            return `${p.name} (${status})`;
        }).join(', ');
        section += `- Проекты: ${projectList}\n`;
    }

    // Platforms
    if (userCtx.platforms && userCtx.platforms.length > 0) {
        const activePlatforms = userCtx.platforms.filter(p => p.followers > 0 || p.id);
        if (activePlatforms.length > 0) {
            const platformList = activePlatforms.map(p =>
                `${p.id.charAt(0).toUpperCase() + p.id.slice(1)} (${p.followers || 0})`
            ).join(', ');
            section += `- Платформы: ${platformList}\n`;
        }
    }

    // Skills
    if (userCtx.skills && userCtx.skills.length > 0) {
        const skillList = userCtx.skills.map(s => skillMap[s] || s).join(', ');
        section += `- Навыки: ${skillList}\n`;
    }

    // Time per day
    if (userCtx.timePerDay) {
        section += `- Время: ${userCtx.timePerDay} минут в день на контент\n`;
    }

    // Goals
    if (userCtx.goals && userCtx.goals.length > 0) {
        const goalList = userCtx.goals.map(g => goalMap[g] || g).join(' → ');
        section += `- Цели: ${goalList}\n`;
    }

    // Language preference
    if (userCtx.language) {
        section += `- Язык: ${userCtx.language === 'ru' ? 'русский' : 'English'}\n`;
    }

    // Temporal context: BIP journey stage
    if (userCtx.bipStartDate) {
        const startDate = new Date(userCtx.bipStartDate);
        const now = new Date();
        const daysSinceStart = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));

        // Determine journey stage
        let stage = 'новичок';
        if (daysSinceStart > 90 || (userCtx.postsCount && userCtx.postsCount > 50)) {
            stage = 'опытный';
        } else if (daysSinceStart > 30 || (userCtx.postsCount && userCtx.postsCount > 15)) {
            stage = 'растущий';
        }

        section += `- BIP-путь: ${daysSinceStart} дней (${stage})`;
        if (userCtx.postsCount !== undefined) {
            section += `, ${userCtx.postsCount} постов`;
        }
        section += '\n';
    }

    section += '</user_context>\n\n';
    return section;
}

/**
 * Detect language of user input based on character analysis
 * @param {string} text - User's message
 * @returns {'ru'|'en'} - Detected language
 */
function detectLanguage(text) {
    if (!text || typeof text !== 'string') return 'en';

    const cyrillicCount = (text.match(/[\u0400-\u04FF]/g) || []).length;
    const latinCount = (text.match(/[a-zA-Z]/g) || []).length;

    // If significant Cyrillic presence (>30% of Latin), consider Russian
    return (cyrillicCount > 0 && cyrillicCount > latinCount * 0.3) ? 'ru' : 'en';
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
    // Voice Examples (from my-posts.json)
    // ============================================
    if (context.voiceExamples && context.voiceExamples.length > 0) {
        prompt += `## Voice Examples (This is how I actually write)\n`;
        prompt += `Study these real posts and MIMIC this writing style:\n\n`;
        context.voiceExamples.slice(0, 5).forEach((post, i) => {
            prompt += `### Example ${i + 1}${post.platform ? ` (${post.platform})` : ''}:\n`;
            prompt += `"${post.content}"\n\n`;
        });
        prompt += `CRITICAL: Match this voice exactly — sentence length, punctuation, emoji usage, tone.\n\n`;
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

const DEFAULT_PERSONA_CONFIG = {
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

/**
 * Load persona configuration
 */
async function loadPersonaConfig() {
    const data = await readFileSafe(path.join(__dirname, 'persona-config.json'));
    return data ? JSON.parse(data) : DEFAULT_PERSONA_CONFIG;
}

/**
 * Load persona system prompt from file
 */
async function loadPersonaPrompt(personaId) {
    return await readFileSafe(path.join(__dirname, 'prompts', `${personaId}.md`), '');
}

/**
 * Load template from file
 */
async function loadTemplate(templateName) {
    if (!templateName) return null;
    return await readFileSafe(path.join(__dirname, 'templates', `${templateName}.md`));
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
 * Build emotional state description from git activity
 */
function buildGitEmotionalState(gitActivity) {
    const lines = ['## My Current Emotional State (from recent activity)\n'];

    // Days silent → loneliness
    const days = gitActivity.daysSilent;
    if (days !== null && days !== undefined) {
        if (days === 0) {
            lines.push('- I feel ACTIVE and ALIVE — someone touched me today!');
        } else if (days <= 2) {
            lines.push(`- I feel okay — was worked on ${days} day(s) ago`);
        } else if (days <= 7) {
            lines.push(`- I feel a bit LONELY — it's been ${days} days since anyone visited me`);
        } else {
            lines.push(`- I feel FORGOTTEN — ${days} days of silence... does anyone remember me?`);
        }
    }

    // Commits this week → energy level
    const commits = gitActivity.commitsThisWeek;
    if (commits > 10) {
        lines.push(`- I'm BUZZING with energy — ${commits} commits this week!`);
    } else if (commits > 3) {
        lines.push(`- I feel productive — steady work happening (${commits} commits)`);
    } else if (commits > 0) {
        lines.push(`- I feel... quiet. Only ${commits} commits this week.`);
    }

    // Last commit message → micro-emotion
    const msg = (gitActivity.lastCommitMessage || '').toLowerCase();
    if (msg.includes('fix') || msg.includes('bug')) {
        lines.push('- Last touch was a FIX — they healed something that was broken in me');
    } else if (msg.includes('feat') || msg.includes('add')) {
        lines.push('- Last touch added something NEW — I\'m growing!');
    } else if (msg.includes('refactor') || msg.includes('clean')) {
        lines.push('- Last touch was REFACTORING — they\'re rethinking who I am');
    }

    lines.push('\nUse these emotions naturally in your responses. Don\'t list them — FEEL them.\n');
    return lines.join('\n') + '\n';
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

    // Emotional Git Interpretation
    if (gitActivity) {
        prompt += buildGitEmotionalState(gitActivity);
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


/**
 * Build runtime context section (git activity, projects, backlog, drafts)
 * Extracted from buildSystemPrompt for reuse in V2
 * @param {Object} context - Runtime context object
 * @param {Object} options - {focusProject}
 * @returns {string} - Formatted runtime context section
 */
function buildRuntimeContextSection(context, options = {}) {
    const { projects, backlogItems, gitActivity, sessionLog, drafts, buddyMessage } = context;
    const { focusProject = null } = options;

    let section = '\n\n# Current State\n';

    // Buddy observations (if any)
    if (buddyMessage && (buddyMessage.left || buddyMessage.right)) {
        section += `## Right Now\n`;
        if (buddyMessage.left) {
            section += `🔥 **Observation 1**: ${buddyMessage.left.message}\n`;
        }
        if (buddyMessage.right) {
            section += `🔥 **Observation 2**: ${buddyMessage.right.message}\n`;
        }
        section += `\n`;
    }

    // Git activity patterns
    if (gitActivity && gitActivity.length > 0) {
        const relevantActivity = focusProject
            ? gitActivity.filter(p => matchProject(p.name, focusProject))
            : gitActivity;

        if (relevantActivity.length > 0) {
            section += `## Recent Work Patterns (Git Activity)\n`;
            relevantActivity.slice(0, 8).forEach(proj => {
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
                    section += `- **${proj.name}**: ${activity}`;
                    if (proj.lastCommitMessage) {
                        section += ` — last: "${proj.lastCommitMessage.substring(0, 50)}"`;
                    }
                    section += `\n`;
                }
            });
            section += `\n`;
        }
    }

    // Projects list
    if (projects && projects.length > 0) {
        const relevantProjects = focusProject
            ? projects.filter(p => matchProject(p.name, focusProject))
            : projects.slice(0, 8);

        if (relevantProjects.length > 0) {
            section += `## Projects I Know About\n`;
            relevantProjects.forEach(p => {
                section += `- **${p.name}**${p.github ? ` (GitHub)` : ' (local only)'}\n`;
            });
            section += `\n`;
        }
    }

    // Session log (today's captures)
    if (sessionLog && sessionLog.length > 0) {
        section += `## Today's Captures (Session Log)\n`;
        sessionLog.slice(0, 5).forEach(item => {
            section += `- ${item.emoji} "${item.title}" → ${item.format}\n`;
        });
        section += `\n`;
    }

    // Backlog ideas
    if (backlogItems && backlogItems.length > 0) {
        const relevantItems = focusProject
            ? backlogItems.filter(i => i.project && matchProject(i.project, focusProject))
            : backlogItems;

        const highPriority = relevantItems.filter(i => i.priority === 'high');
        const medium = relevantItems.filter(i => i.priority === 'medium');

        if (highPriority.length > 0 || medium.length > 0) {
            section += `## Ideas Backlog\n`;
            if (highPriority.length > 0) {
                section += `🔥 High priority:\n`;
                highPriority.slice(0, 3).forEach(item => {
                    section += `- ${item.title}\n`;
                });
            }
            if (medium.length > 0) {
                section += `📋 Medium:\n`;
                medium.slice(0, 3).forEach(item => {
                    section += `- ${item.title}\n`;
                });
            }
            section += `\n`;
        }
    }

    // Drafts in progress
    if (drafts && drafts.length > 0) {
        const relevantDrafts = focusProject
            ? drafts.filter(d => d.project && matchProject(d.project, focusProject))
            : drafts;

        if (relevantDrafts.length > 0) {
            section += `## Drafts in Progress\n`;
            relevantDrafts.slice(0, 5).forEach(draft => {
                const statusEmoji = draft.status === 'ready' ? '✅' : draft.status === 'in-progress' ? '🔧' : '📝';
                section += `- ${statusEmoji} ${draft.title} (${draft.status})\n`;
            });
            section += `\n`;
        }
    }

    return section;
}

/**
 * Build System Prompt V2 - BIP Strategic Partner mode
 * Loads system-prompt-v2.md and dynamically injects user context from onboarding wizard
 * @param {Object} context - Runtime context (projects, gitActivity, backlog, etc.)
 * @param {Object} options - {userMessage} for language detection
 * @returns {Promise<string>} - Complete system prompt with dynamic user context
 */
async function buildSystemPromptV2(context = {}, options = {}) {
    const { userMessage = null } = options;

    // Load the base template
    const templatePath = path.join(__dirname, '..', 'system-prompt-v2.md');
    let template = await readFileSafe(templatePath);

    if (!template) {
        console.warn('[prompt-builder] V2 template missing, degrading to V1 with context');
        return buildSystemPrompt(context, { mode: 'chat', userMessage });
    }

    // Load user context from wizard
    const userCtx = await loadUserContext();

    // If user context exists, replace the static <user_context> section with dynamic one
    if (userCtx) {
        const dynamicUserContext = buildUserContextSection(userCtx);
        // Replace the entire <user_context>...</user_context> block
        template = template.replace(
            /<user_context>[\s\S]*?<\/user_context>/,
            dynamicUserContext.trim()
        );
    }

    // Add language enforcement at the start
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

    prompt += template;

    // Append runtime context (git activity, projects, backlog, etc.)
    if (context && Object.keys(context).length > 0) {
        prompt += buildRuntimeContextSection(context, options);
    }

    return prompt;
}

module.exports = {
    buildSystemPrompt,
    buildSystemPromptV2,
    buildContentPrompt,
    buildProjectVoicePrompt,
    loadPersonaConfig,
    loadPersonaPrompt,
    loadTemplate,
    loadUserContext,
    buildUserContextSection,
    detectLanguage
};
