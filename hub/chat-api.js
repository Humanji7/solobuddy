/* ============================================
   SoloBuddy Hub — Chat API (Claude Integration)
   ============================================ */

const axios = require('axios');

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

/**
 * Build system prompt with project context
 */
function buildSystemPrompt(context) {
    const { projects, backlogItems } = context;

    let prompt = `You are SoloBuddy, a warm and helpful coding companion. You have a calm, friendly personality — like a wise friend by the fireplace. You speak in a mix of English and Russian naturally.

You know about these projects the user is working on:
`;

    if (projects && projects.length > 0) {
        projects.forEach(p => {
            prompt += `- **${p.name}**: ${p.path}${p.github ? ` (GitHub: ${p.github})` : ''}\n`;
        });
    } else {
        prompt += '- No projects configured yet\n';
    }

    if (backlogItems && backlogItems.length > 0) {
        prompt += `\nRecent ideas in backlog:\n`;
        backlogItems.slice(0, 5).forEach(item => {
            prompt += `- ${item.title} (${item.priority})\n`;
        });
    }

    prompt += `\nKeep responses concise but warm. Use emoji sparingly. Help the user stay focused and motivated.`;

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
