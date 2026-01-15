/**
 * Tests for intent-parser.js
 * Run: node hub/tests/intent-parser.test.js
 */

const { parseIntent, detectIntentType } = require('../intent-parser');

const tests = [];
let passed = 0;
let failed = 0;

function test(name, fn) {
    tests.push({ name, fn });
}

function assertEqual(actual, expected, msg) {
    if (actual !== expected) {
        throw new Error(`${msg}: expected "${expected}", got "${actual}"`);
    }
}

function assertGreater(actual, threshold, msg) {
    if (actual <= threshold) {
        throw new Error(`${msg}: expected > ${threshold}, got ${actual}`);
    }
}

// === Tests ===

test('detectIntentType: "добавь идею X" → add_to_backlog', () => {
    const { type, confidence } = detectIntentType('добавь идею про Claude');
    assertEqual(type, 'add_to_backlog', 'intent type');
    assertGreater(confidence, 50, 'confidence');
});

test('detectIntentType: "add idea X" → add_to_backlog', () => {
    const { type } = detectIntentType('add idea about testing');
    assertEqual(type, 'add_to_backlog', 'intent type');
});

test('detectIntentType: "напиши пост про X" → generate_content', () => {
    const { type, confidence } = detectIntentType('напиши пост про AI');
    assertEqual(type, 'generate_content', 'intent type');
    assertGreater(confidence, 50, 'confidence');
});

test('detectIntentType: "сгенерим пост новый" → generate_content (FAILING - known bug)', () => {
    const { type, confidence } = detectIntentType('сгенерим пост новый для солобади');
    assertEqual(type, 'generate_content', 'intent type');
    assertGreater(confidence, 50, 'confidence');
});

test('detectIntentType: "create thread about X" → generate_content', () => {
    const { type } = detectIntentType('create thread about productivity');
    assertEqual(type, 'generate_content', 'intent type');
});

test('detectIntentType: random text → unknown', () => {
    const { type, confidence } = detectIntentType('привет как дела');
    assertEqual(type, 'unknown', 'intent type');
    assertEqual(confidence, 0, 'confidence');
});

// === Runner ===

console.log('\n🧪 Intent Parser Tests\n');

for (const { name, fn } of tests) {
    try {
        fn();
        console.log(`✅ ${name}`);
        passed++;
    } catch (e) {
        console.log(`❌ ${name}`);
        console.log(`   ${e.message}`);
        failed++;
    }
}

console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
