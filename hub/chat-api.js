/* ============================================
   SoloBuddy Hub — Chat API (Claude Integration)
   ============================================ */

const axios = require('axios');
const { buildSystemPrompt, buildContentPrompt, loadPersonaConfig } = require('./prompt-builder');

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

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

/**
 * Generate content using Claude with persona and template
 * @param {Object} options - {prompt, template, persona, project}
 * @param {Object} context - Rich context object
 * @returns {Promise<Object>} - {content, metadata}
 */
async function generateContent(options, context) {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
        const error = new Error('ANTHROPIC_API_KEY not configured');
        error.status = 500;
        throw error;
    }

    const { prompt, template, persona, project } = options;

    // Load persona config to get settings
    const personaConfig = await loadPersonaConfig();
    const personaId = persona || personaConfig.activePersona || 'jester-sage';
    const personaSettings = personaConfig.personas[personaId] || {
        temperature: 0.8,
        maxTokens: 1500
    };

    // Build content-generation system prompt
    const systemPrompt = await buildContentPrompt(context, {
        template,
        persona: personaId,
        focusProject: project,
        userPrompt: prompt
    });

    // Track context sources for metadata
    const contextSources = [];
    if (context.gitActivity?.length > 0) contextSources.push(`git:${context.gitActivity.length} projects`);
    if (context.backlogItems?.length > 0) contextSources.push(`backlog:${context.backlogItems.length} items`);
    if (context.projects?.length > 0) contextSources.push(`projects:${context.projects.length}`);
    if (project) contextSources.push(`focus:${project}`);

    const startTime = Date.now();

    const response = await axios.post(
        CLAUDE_API_URL,
        {
            model: CLAUDE_MODEL,
            max_tokens: personaSettings.maxTokens,
            temperature: personaSettings.temperature,
            system: systemPrompt,
            messages: [
                { role: 'user', content: prompt }
            ]
        },
        {
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            }
        }
    );

    const content = response.data.content[0].text;
    const usage = response.data.usage || {};

    return {
        content,
        metadata: {
            persona: personaId,
            template: template || null,
            contextSources,
            tokensUsed: usage.output_tokens || 0,
            inputTokens: usage.input_tokens || 0,
            generationTimeMs: Date.now() - startTime
        }
    };
}

module.exports = { sendToClaude, generateContent };

