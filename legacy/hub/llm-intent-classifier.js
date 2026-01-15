/**
 * LLM-based Intent Classifier
 *
 * Used as fallback when regex confidence is in the "gray zone" (50-79%).
 * Calls Claude to disambiguate user intent.
 */

const axios = require('axios');

const INTENT_TYPES = [
    'add_to_backlog',
    'find_idea',
    'show_activity',
    'link_to_project',
    'change_priority',
    'generate_content',
    'unknown'
];

const CLASSIFICATION_SYSTEM = `You are an intent classifier for SoloBuddy, a personal productivity assistant.

Classify the user message into ONE of these intents:
- add_to_backlog: User wants to add/save an idea to their backlog
- find_idea: User wants to find/search for an existing idea
- show_activity: User wants to see recent activity or status
- link_to_project: User wants to link something to a project
- change_priority: User wants to change priority of an idea
- generate_content: User wants to create/write content (post, thread, tip)
- unknown: Message doesn't match any intent

Respond with ONLY valid JSON:
{"type": "<intent>", "confidence": <0-100>}

Be generous with generate_content - if user mentions writing, creating, or wants content, it's likely generate_content.`;

/**
 * Classify intent using LLM
 * @param {string} message - User message
 * @param {Object} context - Optional context (not used in classification, but available for future)
 * @returns {Promise<{type: string, confidence: number}>}
 */
async function classifyIntent(message, context = {}) {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
        console.warn('[LLM Classifier] No API key, returning unknown');
        return { type: 'unknown', confidence: 0 };
    }

    try {
        const response = await axios.post(
            'https://api.anthropic.com/v1/messages',
            {
                model: 'claude-sonnet-4-20250514',
                max_tokens: 100,
                temperature: 0.1, // Low temp for consistent classification
                system: CLASSIFICATION_SYSTEM,
                messages: [{ role: 'user', content: message }]
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01'
                },
                timeout: 30000
            }
        );

        const text = response.data.content[0].text;
        const jsonMatch = text.match(/\{[\s\S]*\}/);

        if (!jsonMatch) {
            console.warn('[LLM Classifier] Could not parse JSON:', text);
            return { type: 'unknown', confidence: 0 };
        }

        let result;
        try {
            result = JSON.parse(jsonMatch[0]);
        } catch (parseError) {
            console.warn('[LLM Classifier] JSON parse error:', parseError.message);
            return { type: 'unknown', confidence: 0 };
        }

        // Validate type
        if (!INTENT_TYPES.includes(result.type)) {
            console.warn('[LLM Classifier] Invalid type:', result.type);
            return { type: 'unknown', confidence: 0 };
        }

        return {
            type: result.type,
            confidence: Math.min(100, Math.max(0, result.confidence))
        };

    } catch (error) {
        console.error('[LLM Classifier] Error:', error.message);
        return { type: 'unknown', confidence: 0 };
    }
}

module.exports = {
    classifyIntent,
    INTENT_TYPES
};
