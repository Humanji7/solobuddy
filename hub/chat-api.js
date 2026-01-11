/* ============================================
   SoloBuddy Hub — Chat API (Claude Integration)
   ============================================ */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { buildSystemPrompt, buildContentPrompt, loadPersonaConfig, buildProjectVoicePrompt } = require('./prompt-builder');

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

// ============================================
// README Personality Extraction (Phase 2.2)
// ============================================

// In-memory rate-limiting to prevent duplicate extractions
const extractingProjects = new Set();

/**
 * Extract personality from project README using Claude
 * @param {string} projectPath - Absolute path to project
 * @param {string} projectName - Project name (for rate-limiting)
 * @returns {Promise<Object|null>} - { purpose, tone, techStack, keyPhrases } or null
 */
async function extractPersonalityFromReadme(projectPath, projectName) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        console.error('[Soul] ANTHROPIC_API_KEY not configured');
        return null;
    }

    // Rate-limiting check
    if (extractingProjects.has(projectName)) {
        console.log(`[Soul] Already extracting personality for ${projectName}, skipping`);
        return null;
    }
    extractingProjects.add(projectName);

    try {
        // Find README (try multiple filenames)
        const readmeNames = ['README.md', 'readme.md', 'README', 'README.txt', 'Readme.md'];
        let readmeContent = null;
        let foundReadme = null;

        for (const name of readmeNames) {
            try {
                const filePath = path.join(projectPath, name);
                readmeContent = await fs.readFile(filePath, 'utf-8');
                foundReadme = name;
                break;
            } catch (e) { /* try next */ }
        }

        if (!readmeContent) {
            console.log(`[Soul] No README found for ${projectName} in ${projectPath}`);
            return null;
        }

        if (readmeContent.length < 100) {
            console.log(`[Soul] README too short for ${projectName} (${readmeContent.length} chars)`);
            return null;
        }

        console.log(`[Soul] Found ${foundReadme} for ${projectName} (${readmeContent.length} chars)`);

        // Truncate to save tokens (first 4000 chars is usually enough)
        const truncated = readmeContent.slice(0, 4000);

        // Call Claude with structured extraction prompt
        const response = await axios.post(
            CLAUDE_API_URL,
            {
                model: CLAUDE_MODEL,
                max_tokens: 500,
                temperature: 0.3, // Low for structured extraction
                system: `You extract project personality from README files.
Analyze the README and return ONLY valid JSON (no markdown code blocks, no explanation, just raw JSON):
{
  "purpose": "1-2 sentences about what this project does and why it exists",
  "tone": "one of: friendly, technical, playful, professional, artistic, experimental",
  "techStack": "comma-separated list of main technologies mentioned",
  "keyPhrases": "3-5 distinctive phrases from the README that capture the project's unique essence"
}

Be specific and extract actual content from the README, not generic descriptions.`,
                messages: [{ role: 'user', content: `Extract personality from this README:\n\n${truncated}` }]
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01'
                }
            }
        );

        // Parse JSON (robust handling for potential markdown wrapping)
        const text = response.data.content[0].text;
        const jsonMatch = text.match(/\{[\s\S]*\}/);

        if (!jsonMatch) {
            console.error(`[Soul] Could not parse JSON from response for ${projectName}:`, text);
            return null;
        }

        const personality = JSON.parse(jsonMatch[0]);
        console.log(`[Soul] Successfully extracted personality for ${projectName}:`, personality.purpose?.slice(0, 50) + '...');

        return personality;

    } catch (error) {
        console.error(`[Soul] Extraction failed for ${projectName}:`, error.message);
        return null;
    } finally {
        extractingProjects.delete(projectName);
    }
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

/**
 * Send message to Claude as Project Voice — project speaks in first person
 * @param {Object} project - {name, path, github?}
 * @param {Array} messages - Chat history
 * @param {Object} context - {backlogItems}
 * @returns {Promise<string>} - Response from project persona
 */
async function sendProjectVoice(project, messages, context = {}) {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY not configured');
    }

    const systemPrompt = buildProjectVoicePrompt(project, context);

    const response = await axios.post(
        CLAUDE_API_URL,
        {
            model: CLAUDE_MODEL,
            max_tokens: 512,
            temperature: 0.9,  // Higher for more personality
            system: systemPrompt,
            messages: messages.map(m => ({
                role: m.role === 'project' ? 'assistant' : m.role,
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

module.exports = { sendToClaude, generateContent, sendProjectVoice, extractPersonalityFromReadme };
