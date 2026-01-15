/**
 * Tests for llm-intent-classifier.js
 * Run: node hub/tests/llm-intent-classifier.test.js
 *
 * Note: Requires ANTHROPIC_API_KEY for live tests
 */

const { classifyIntent, INTENT_TYPES } = require('../llm-intent-classifier');

async function runTests() {
    console.log('\n🧪 LLM Intent Classifier Tests\n');

    let passed = 0;
    let failed = 0;

    // Test 1: Format check
    try {
        console.log('Testing: classifyIntent returns correct structure...');
        const result = await classifyIntent('напиши что-нибудь интересное', {});

        if (!result || typeof result.type !== 'string') {
            throw new Error('Missing type field');
        }
        if (typeof result.confidence !== 'number') {
            throw new Error('Missing confidence field');
        }
        if (!Array.isArray(INTENT_TYPES) || !INTENT_TYPES.includes(result.type)) {
            throw new Error(`Invalid type: ${result.type}`);
        }

        console.log(`✅ Structure valid: { type: "${result.type}", confidence: ${result.confidence} }`);
        passed++;
    } catch (e) {
        console.log(`❌ Structure test failed: ${e.message}`);
        failed++;
    }

    // Test 2: Edge case that regex misses
    try {
        console.log('\nTesting: edge case "хочу контент про AI"...');
        const result = await classifyIntent('хочу контент про AI', {});

        if (result.type !== 'generate_content') {
            throw new Error(`Expected generate_content, got ${result.type}`);
        }

        console.log(`✅ Correctly identified as generate_content (confidence: ${result.confidence})`);
        passed++;
    } catch (e) {
        console.log(`❌ Edge case failed: ${e.message}`);
        failed++;
    }

    console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);
}

runTests().catch(console.error);
