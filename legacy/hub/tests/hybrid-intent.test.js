/**
 * Integration test for hybrid intent detection
 * Run: node hub/tests/hybrid-intent.test.js
 */

const { parseIntent, buildActionCard } = require('../intent-parser');
const { classifyIntent } = require('../llm-intent-classifier');

async function testHybridFlow() {
    console.log('\n🧪 Hybrid Intent Detection Tests\n');

    const testCases = [
        {
            message: 'добавь идею про Claude',
            expectRegex: true,
            expectType: 'add_to_backlog'
        },
        {
            message: 'сгенерим пост новый для солобади',
            expectRegex: true,
            expectType: 'generate_content'
        },
        {
            message: 'хочу контент про AI',
            expectRegex: false,
            expectType: 'generate_content'
        }
    ];

    for (const tc of testCases) {
        console.log(`\nTesting: "${tc.message}"`);

        const regexResult = parseIntent(tc.message, { backlogItems: [], projects: [] });
        console.log(`  Regex: type=${regexResult.intentType}, confidence=${regexResult.confidence}`);

        if (regexResult.confidence >= 80) {
            console.log(`  → High confidence, using regex result`);
        } else if (regexResult.confidence >= 50) {
            console.log(`  → Gray zone, would call LLM...`);
            const llmResult = await classifyIntent(tc.message, {});
            console.log(`  LLM: type=${llmResult.type}, confidence=${llmResult.confidence}`);
        } else {
            console.log(`  → Low confidence, regular chat`);
        }
    }

    console.log('\n✅ Hybrid flow test complete\n');
}

testHybridFlow().catch(console.error);
