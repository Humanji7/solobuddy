/* ============================================
   SoloBuddy Hub — Chat API (Claude Integration)
   ============================================ */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { buildSystemPrompt, buildContentPrompt, loadPersonaConfig, buildProjectVoicePrompt } = require('./prompt-builder');

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
const ANTHROPIC_VERSION = '2023-06-01';

// ============================================
// Shared Helpers
// ============================================

/**
 * Read file safely, returning null if not found or too short
 */
async function readFileSafe(filePath, minLength = 50) {
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        return content.length >= minLength ? content : null;
    } catch {
        return null;
    }
}

/**
 * Call Claude API with standard headers
 */
async function callClaude(apiKey, { system, messages, maxTokens = 1024, temperature = 0.7 }) {
    const response = await axios.post(
        CLAUDE_API_URL,
        {
            model: CLAUDE_MODEL,
            max_tokens: maxTokens,
            temperature,
            system,
            messages
        },
        {
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': ANTHROPIC_VERSION
            }
        }
    );
    return response.data;
}

/**
 * Get API key or throw
 */
function requireApiKey() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        const error = new Error('ANTHROPIC_API_KEY not configured');
        error.status = 500;
        throw error;
    }
    return apiKey;
}

// ============================================
// Deep Knowledge Extraction (Phase 2.4)
// ============================================

// In-memory rate-limiting to prevent duplicate extractions
const extractingProjects = new Set();

/**
 * Collect documentation from multiple sources for richer personality extraction
 * Priority: docs/ → .agent/prompts/ → context files → README.md
 * @param {string} projectPath - Absolute path to project
 * @returns {Promise<{content: string, sources: string[]}>}
 */
async function collectProjectDocumentation(projectPath) {
    const sources = [];
    const chunks = [];

    // Helper to add file content with truncation
    async function addFile(filePath, sourceName, maxChars) {
        const content = await readFileSafe(filePath);
        if (content) {
            chunks.push(`=== ${sourceName} ===\n${content.slice(0, maxChars)}`);
            sources.push(sourceName);
            return true;
        }
        return false;
    }

    // Priority 1: docs/ folder
    const docsFolder = path.join(projectPath, 'docs');
    const docFiles = ['PHILOSOPHY.md', 'PRD.md', 'TRD.md', 'VISION.md',
        'ARCHITECTURE.md', 'PROJECT_BASE.md', 'DESIGN.md'];
    for (const file of docFiles) {
        await addFile(path.join(docsFolder, file), `docs/${file}`, 2000);
    }

    // Priority 2: .agent/prompts/ folder (max 3 files)
    const agentPrompts = path.join(projectPath, '.agent', 'prompts');
    try {
        const files = await fs.readdir(agentPrompts);
        const mdFiles = files.filter(f => f.endsWith('.md')).slice(0, 3);
        for (const file of mdFiles) {
            await addFile(path.join(agentPrompts, file), `.agent/prompts/${file}`, 1000);
        }
    } catch { /* no .agent/prompts/ folder */ }

    // Priority 3: Root context files
    const contextFiles = ['CLAUDE.md', 'PROJECT.md', 'SOUL.md', 'HOOK.md'];
    for (const file of contextFiles) {
        await addFile(path.join(projectPath, file), file, 1500);
    }

    // Priority 4: README.md (first found wins)
    const readmeNames = ['README.md', 'readme.md', 'Readme.md'];
    for (const name of readmeNames) {
        if (await addFile(path.join(projectPath, name), name, 2000)) break;
    }

    return {
        content: chunks.join('\n\n---\n\n'),
        sources
    };
}

const PERSONALITY_EXTRACTION_SYSTEM = `You extract project personality from documentation.
Analyze all provided docs and return ONLY valid JSON (no markdown, no explanation):
{
  "purpose": "1-2 sentences: what this project does and why it exists",
  "tone": "one of: friendly, technical, playful, professional, artistic, experimental",
  "techStack": "comma-separated list of main technologies",
  "keyPhrases": ["3-5 distinctive phrases that capture the project's unique essence"],
  "philosophy": "core beliefs/values (if found in docs, else null)",
  "pains": "known challenges or frustrations mentioned (if found, else null)",
  "dreams": "future aspirations or roadmap goals (if found, else null)"
}

Extract ACTUAL content from docs, not generic descriptions. Be specific.`;

/**
 * Extract personality from project documentation using Claude (Phase 2.4: multi-source)
 * @param {string} projectPath - Absolute path to project
 * @param {string} projectName - Project name (for rate-limiting)
 * @returns {Promise<Object|null>} - { purpose, tone, techStack, keyPhrases, philosophy?, pains?, dreams? }
 */
async function extractPersonalityFromDocs(projectPath, projectName) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        console.error('[Soul] ANTHROPIC_API_KEY not configured');
        return null;
    }

    // Rate-limiting: prevent duplicate extractions
    if (extractingProjects.has(projectName)) {
        console.log(`[Soul] Already extracting personality for ${projectName}, skipping`);
        return null;
    }
    extractingProjects.add(projectName);

    try {
        const { content, sources } = await collectProjectDocumentation(projectPath);

        if (!content || content.length < 100) {
            console.log(`[Soul] No documentation found for ${projectName} in ${projectPath}`);
            return null;
        }

        console.log(`[Soul] Collected docs for ${projectName}: ${sources.join(', ')} (${content.length} chars)`);

        const response = await callClaude(apiKey, {
            system: PERSONALITY_EXTRACTION_SYSTEM,
            messages: [{ role: 'user', content: `Extract personality from this project documentation:\n\n${content.slice(0, 8000)}` }],
            maxTokens: 700,
            temperature: 0.3
        });

        const text = response.content[0].text;
        const jsonMatch = text.match(/\{[\s\S]*\}/);

        if (!jsonMatch) {
            console.error(`[Soul] Could not parse JSON from response for ${projectName}:`, text);
            return null;
        }

        const personality = JSON.parse(jsonMatch[0]);
        personality._sources = sources;

        console.log(`[Soul] ✅ Extracted personality for ${projectName} from ${sources.length} sources:`,
            personality.purpose?.slice(0, 50) + '...');

        return personality;

    } catch (error) {
        console.error(`[Soul] Extraction failed for ${projectName}:`, error.message);
        return null;
    } finally {
        extractingProjects.delete(projectName);
    }
}

// Backward compatibility alias
const extractPersonalityFromReadme = extractPersonalityFromDocs;

/**
 * Normalize message format for Claude API
 */
function normalizeMessages(messages, assistantRole = 'buddy') {
    return messages.map(m => ({
        role: m.role === assistantRole ? 'assistant' : m.role,
        content: m.content || m.text
    }));
}

/**
 * Send message to Claude API
 * @param {Array} messages - Chat history [{role: 'user'|'assistant', content: string}]
 * @param {Object} context - {projects: [], backlogItems: []}
 * @returns {Promise<string>} - Claude's response text
 */
async function sendToClaude(messages, context) {
    const apiKey = requireApiKey();

    // Get last user message for language detection
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    const userMessage = lastUserMessage ? (lastUserMessage.content || lastUserMessage.text) : null;

    const response = await callClaude(apiKey, {
        system: buildSystemPrompt(context, { userMessage }),
        messages: normalizeMessages(messages)
    });

    return response.content[0].text;
}

/**
 * Generate content using Claude with persona and template
 * @param {Object} options - {prompt, template, persona, project}
 * @param {Object} context - Rich context object
 * @returns {Promise<Object>} - {content, metadata}
 */
async function generateContent(options, context) {
    const apiKey = requireApiKey();
    const { prompt, template, persona, project } = options;

    // Load persona config to get settings
    const personaConfig = await loadPersonaConfig();
    const personaId = persona || personaConfig.activePersona || 'jester-sage';
    const personaSettings = personaConfig.personas[personaId] || {
        temperature: 0.8,
        maxTokens: 1500
    };

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

    const response = await callClaude(apiKey, {
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
        maxTokens: personaSettings.maxTokens,
        temperature: personaSettings.temperature
    });

    const usage = response.usage || {};

    return {
        content: response.content[0].text,
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
    const apiKey = requireApiKey();

    const response = await callClaude(apiKey, {
        system: buildProjectVoicePrompt(project, context),
        messages: normalizeMessages(messages, 'project'),
        maxTokens: 512,
        temperature: 0.9  // Higher for more personality
    });

    return response.content[0].text;
}

// SOUL Knobs configuration (used for both frontend and generation prompts)
const SOUL_KNOBS = {
    archetype: {
        creature: { label: 'Living Creature', description: 'Breathes, feels, reacts to touch' },
        tool: { label: 'Tool / Utility', description: 'Functional, reliable, gets the job done' },
        guide: { label: 'Guide / Companion', description: 'Leads through experience, shows the way' },
        artist: { label: 'Artist / Creator', description: 'Creates, experiments, expresses' }
    },
    tone: {
        playful: 'Playful (fun, with humor)',
        technical: 'Technical (precise, specific)',
        poetic: 'Poetic (metaphors, imagery)',
        calm: 'Calm (peaceful, measured)',
        intense: 'Intense (passionate, emotional)'
    },
    emotionalBaseline: {
        whenAbandoned: {
            sad: 'Gets lonely and misses interaction',
            waiting: 'Waits calmly, sleeps',
            intensify: 'Becomes more intense, calls for attention'
        },
        whenActive: {
            joyful: 'Joyful and energized',
            focused: 'Focused and serious',
            excited: 'Excited and energic'
        }
    },
    forbidden: {
        just_program: '"I am just a program / code"',
        cant_feel: '"I cannot feel / have emotions"',
        impossible: '"This is impossible"',
        dont_know: '"I don\'t know" (without trying to help)',
        corporate: 'Formal/corporate phrases'
    }
};

const SOUL_GENERATION_SYSTEM = 'You are a creative writer who gives projects unique, memorable personalities. Your SOUL.md files are poetic yet specific.';

const SOUL_MD_TEMPLATE = `# SOUL.md

## Identity
- Name: (project name)
- Archetype: (selected archetype with creative description)
- Pronoun: (appropriate pronoun based on archetype)

## Purpose
(extract from docs or infer from archetype - why this project exists)

## Tone
(expand on selected tones with specific examples of how it speaks)

## Philosophy
(core beliefs - extract from docs if available, or create based on archetype)

## Key Phrases
(3-5 distinctive phrases this project would use)

## Emotional Baseline
- Default: (general mood)
- When abandoned: (selected behavior, expanded)
- When active: (selected behavior, expanded)

## Forbidden
(list what this project would never say, expanded from selections)

## Dreams
(future aspirations - extract from docs or infer)

## Pains
(challenges or frustrations - extract from docs or infer)`;

/**
 * Extract section content from markdown
 */
function extractSection(md, sectionName) {
    const match = md.match(new RegExp(`## ${sectionName}\\n+([\\s\\S]*?)(?=\\n## |$)`));
    return match ? match[1].trim() : null;
}

/**
 * Generate SOUL.md content from onboarding wizard selections (Phase 2.7)
 * @param {string} projectName - Project name
 * @param {Object} selections - User's wizard selections
 * @param {string} projectPath - Absolute path to project (for docs context)
 * @returns {Promise<{success: boolean, soulMd?: string, personality?: Object, error?: string}>}
 */
async function generateSoulFromSelections(projectName, selections, projectPath) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        return { success: false, error: 'ANTHROPIC_API_KEY not configured' };
    }

    try {
        // Collect project docs for context
        let docsContext = '';
        if (projectPath) {
            const { content } = await collectProjectDocumentation(projectPath);
            docsContext = content.slice(0, 4000);
        }

        // Resolve selections to labels
        const archetypeInfo = SOUL_KNOBS.archetype[selections.archetype] || { label: selections.archetype, description: '' };
        const toneList = (selections.tone || []).map(t => SOUL_KNOBS.tone[t] || t).join(', ');
        const whenAbandoned = SOUL_KNOBS.emotionalBaseline.whenAbandoned[selections.emotionalBaseline?.whenAbandoned]
            || selections.emotionalBaseline?.whenAbandoned || 'waits patiently';
        const whenActive = SOUL_KNOBS.emotionalBaseline.whenActive[selections.emotionalBaseline?.whenActive]
            || selections.emotionalBaseline?.whenActive || 'focused';
        const forbiddenList = [
            ...(selections.forbidden || []).map(f => SOUL_KNOBS.forbidden[f] || f),
            ...(selections.customForbidden || [])
        ].filter(Boolean);

        const prompt = `Create a SOUL.md file for the project "${projectName}".

USER SELECTED THESE ATTRIBUTES:
- Archetype: ${archetypeInfo.label} (${archetypeInfo.description})
- Tone: ${toneList || 'not specified'}
- When abandoned: ${whenAbandoned}
- When active: ${whenActive}
- Forbidden phrases: ${forbiddenList.length > 0 ? forbiddenList.join(', ') : 'none specified'}

PROJECT DOCUMENTATION CONTEXT:
${docsContext || 'No documentation available'}

GENERATE A COMPLETE SOUL.md FILE with these sections:

${SOUL_MD_TEMPLATE}

Be CREATIVE and give this project a UNIQUE voice. Write in a style that matches the selected archetype and tone.
If docs are in Russian, write the SOUL.md in Russian.
Return ONLY the markdown content, no explanations.`;

        const response = await callClaude(apiKey, {
            system: SOUL_GENERATION_SYSTEM,
            messages: [{ role: 'user', content: prompt }],
            maxTokens: 1500,
            temperature: 0.8
        });

        const soulMd = response.content[0].text;

        // Build personality object
        const personality = {
            archetype: selections.archetype,
            tone: selections.tone || [],
            emotionalBaseline: selections.emotionalBaseline || {},
            forbidden: forbiddenList,
            _source: 'onboarding',
            _generatedAt: new Date().toISOString()
        };

        // Extract purpose from generated content
        const purpose = extractSection(soulMd, 'Purpose');
        if (purpose) personality.purpose = purpose.slice(0, 500);

        // Extract key phrases
        const phrasesSection = extractSection(soulMd, 'Key Phrases');
        if (phrasesSection) {
            const phrases = phrasesSection.match(/[-•]\s*(.+)/g);
            if (phrases) {
                personality.keyPhrases = phrases.map(p => p.replace(/^[-•]\s*/, '').trim());
            }
        }

        console.log(`[Soul] ✅ Generated SOUL.md for ${projectName} (${soulMd.length} chars)`);

        return { success: true, soulMd, personality };

    } catch (error) {
        console.error(`[Soul] Generation failed for ${projectName}:`, error.message);
        return { success: false, error: error.message };
    }
}

module.exports = {
    sendToClaude,
    generateContent,
    sendProjectVoice,
    extractPersonalityFromReadme,
    generateSoulFromSelections,
    SOUL_KNOBS
};

