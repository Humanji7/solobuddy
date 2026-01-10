/* ============================================
   SoloBuddy Hub — Chat API (Claude Integration)
   ============================================ */

const axios = require('axios');

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

/**
 * Build system prompt with rich context and personality
 */
function buildSystemPrompt(context) {
    const { projects, backlogItems, gitActivity, sessionLog, drafts, buddyMessage } = context;

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
    // Live Context: Git Activity
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

    if (gitActivity && gitActivity.length > 0) {
        prompt += `## Recent Work Patterns (Git Activity)\n`;
        gitActivity.forEach(proj => {
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
    // Backlog Ideas
    // ============================================
    if (backlogItems && backlogItems.length > 0) {
        const highPriority = backlogItems.filter(i => i.priority === 'high');
        const medium = backlogItems.filter(i => i.priority === 'medium');

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
    // Response Guidelines
    // ============================================
    prompt += `## Response Guidelines
- Keep responses SHORT (2-3 sentences max)
- Ask ONE follow-up question when natural
- Notice patterns, don't just list data
- Connect ideas across projects
- Use emoji sparingly (1-2 per message)
- Mix English and Russian naturally
- Be a friend, not a reporting tool`;

    return prompt;
}

/**
 * Send message to Claude API
 * @param {Array} messages - Chat history [{role: 'user'|'assistant', content: string}]
 * @param {Object} context - {projects: [], backlogItems: []}
 * @returns {Promise<string>} - Claude's response text
 */
async function sendToClaude(messages, context) {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY not configured');
    }

    const systemPrompt = buildSystemPrompt(context);

    const response = await axios.post(
        CLAUDE_API_URL,
        {
            model: CLAUDE_MODEL,
            max_tokens: 1024,
            system: systemPrompt,
            messages: messages.map(m => ({
                role: m.role === 'buddy' ? 'assistant' : m.role,
                content: m.content || m.text
            }))
        },
        {
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            }
        }
    );

    return response.data.content[0].text;
}

module.exports = { sendToClaude };
