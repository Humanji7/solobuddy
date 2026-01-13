/**
 * Groq-based Content Intent Detector
 *
 * Fast semantic gate for detecting content generation requests.
 * Uses Llama 3.1 8B via Groq API (~100-300ms latency).
 */

const axios = require('axios');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.1-8b-instant';
const GROQ_TIMEOUT = 5000; // 5 seconds (fast fail)

const SYSTEM_PROMPT = `You detect if the user wants to generate, create, or write content (posts, threads, tips, articles).

Content requests include phrases like:
- "write a post about X"
- "let's generate content"
- "create a thread"
- "what can we post about X?"
- "make a tip about Y"
- "draft something for social media"

NOT content requests:
- Questions about features
- Bug reports
- General conversation
- Asking for help

Reply with ONLY valid JSON:
{"is_content_request": true, "confidence": 85}
or
{"is_content_request": false, "confidence": 90}`;

/**
 * Detect if message is a content generation request
 * @param {string} message - User message
 * @returns {Promise<{isContentRequest: boolean, confidence: number}>}
 */
async function isContentRequest(message) {
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
        console.warn('[Groq Gate] No API key, skipping');
        return { isContentRequest: false, confidence: 0 };
    }

    try {
        const response = await axios.post(
            GROQ_API_URL,
            {
                model: GROQ_MODEL,
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: message }
                ],
                temperature: 0.1,
                max_tokens: 50
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                timeout: GROQ_TIMEOUT
            }
        );

        const text = response.data.choices[0]?.message?.content || '';
        const jsonMatch = text.match(/\{[\s\S]*\}/);

        if (!jsonMatch) {
            console.warn('[Groq Gate] Could not parse JSON:', text);
            return { isContentRequest: false, confidence: 0 };
        }

        let result;
        try {
            result = JSON.parse(jsonMatch[0]);
        } catch (parseError) {
            console.warn('[Groq Gate] JSON parse error:', parseError.message);
            return { isContentRequest: false, confidence: 0 };
        }

        return {
            isContentRequest: Boolean(result.is_content_request),
            confidence: Math.min(100, Math.max(0, result.confidence || 0))
        };

    } catch (error) {
        if (error.code === 'ECONNABORTED') {
            console.warn('[Groq Gate] Timeout after', GROQ_TIMEOUT, 'ms');
        } else {
            console.error('[Groq Gate] Error:', error.message);
        }
        return { isContentRequest: false, confidence: 0 };
    }
}

module.exports = { isContentRequest };
