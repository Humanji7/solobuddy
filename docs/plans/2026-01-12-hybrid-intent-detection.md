# Hybrid Intent Detection Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Гибридный подход к распознаванию интентов — regex для high-confidence (>=80%), LLM-fallback для edge cases (50-79%).

**Architecture:**
1. Regex-first detection в `intent-parser.js` (текущий код + фикс кириллицы)
2. Новый модуль `llm-intent-classifier.js` для LLM-based classification
3. Оркестрация в `routes/chat.js`: confidence >= 80 → карточка, 50-79 → LLM уточнение, <50 → обычный чат

**Tech Stack:** Node.js, Express, Anthropic Claude API (claude-sonnet-4)

---

### Task 1: Тесты для текущего intent-parser

**Files:**
- Create: `hub/tests/intent-parser.test.js`

**Step 1: Создать тестовый файл**

```javascript
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
```

**Step 2: Запустить тесты и зафиксировать baseline**

Run: `node hub/tests/intent-parser.test.js`

Expected: Тест "сгенерим пост новый" должен FAIL (это known bug, который мы фиксим в Task 2).

**Step 3: Commit baseline tests**

```bash
git add hub/tests/intent-parser.test.js
git commit -m "test: add baseline intent-parser tests

Known failing: cyrillic verb forms like 'сгенерим'

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 2: Фикс regex для кириллицы

**Files:**
- Modify: `hub/intent-parser.js:47`

**Step 1: Понять проблему**

Текущий паттерн:
```javascript
/(?:напи?[шс][иы]?|сделай|создай|сгенер\w+)\s*(?:пост|тред|thread|tip|совет)/i
```

Проблема: `\w` = `[a-zA-Z0-9_]` — не включает кириллицу. `сгенерим` не матчит.

**Step 2: Исправить паттерн в intent-parser.js:47**

```javascript
// Line 47 - BEFORE:
/(?:напи?[шс][иы]?|сделай|создай|сгенер\w+)\s*(?:пост|тред|thread|tip|совет)/i,

// Line 47 - AFTER:
/(?:напи?[шс][иы]?|сделай|создай|сгенер[а-яё]+)\s*(?:пост|тред|thread|tip|совет)/i,
```

**Step 3: Запустить тесты**

Run: `node hub/tests/intent-parser.test.js`

Expected: Все тесты PASS, включая "сгенерим пост новый".

**Step 4: Commit fix**

```bash
git add hub/intent-parser.js
git commit -m "fix: support cyrillic verb forms in generate_content pattern

Replace \\w+ with [а-яё]+ to match Russian verb endings.
Fixes: 'сгенерим пост' now triggers ContentGeneratorCard

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 3: Создать LLM Intent Classifier

**Files:**
- Create: `hub/llm-intent-classifier.js`
- Create: `hub/tests/llm-intent-classifier.test.js`

**Step 1: Написать тест для LLM classifier**

```javascript
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
```

**Step 2: Запустить тест — он должен fail (модуль не существует)**

Run: `node hub/tests/llm-intent-classifier.test.js`

Expected: Error: Cannot find module '../llm-intent-classifier'

**Step 3: Создать llm-intent-classifier.js**

```javascript
/**
 * LLM-based Intent Classifier
 *
 * Used as fallback when regex confidence is in the "gray zone" (50-79%).
 * Calls Claude to disambiguate user intent.
 */

const { callClaude, requireApiKey } = require('./chat-api-helpers');

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
        const axios = require('axios');

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
                }
            }
        );

        const text = response.data.content[0].text;
        const jsonMatch = text.match(/\{[\s\S]*\}/);

        if (!jsonMatch) {
            console.warn('[LLM Classifier] Could not parse JSON:', text);
            return { type: 'unknown', confidence: 0 };
        }

        const result = JSON.parse(jsonMatch[0]);

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
```

**Step 4: Запустить тест**

Run: `node hub/tests/llm-intent-classifier.test.js`

Expected: PASS (с API key в .env)

**Step 5: Commit**

```bash
git add hub/llm-intent-classifier.js hub/tests/llm-intent-classifier.test.js
git commit -m "feat: add LLM-based intent classifier for edge cases

Uses Claude Sonnet for intent classification when regex confidence
is in the gray zone (50-79%). Low temperature for consistency.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 4: Интеграция гибридного подхода в routes/chat.js

**Files:**
- Modify: `hub/routes/chat.js:17-48`
- Modify: `hub/intent-parser.js` (добавить экспорт buildActionCard)

**Step 1: Написать интеграционный тест**

Create: `hub/tests/hybrid-intent.test.js`

```javascript
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
            expectRegex: true, // After Task 2 fix
            expectType: 'generate_content'
        },
        {
            message: 'хочу контент про AI',
            expectRegex: false, // Gray zone, needs LLM
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
```

**Step 2: Модифицировать routes/chat.js для гибридного подхода**

```javascript
// hub/routes/chat.js - modified POST /api/intent/parse handler

const { classifyIntent } = require('../llm-intent-classifier');

// POST /api/intent/parse
router.post('/intent/parse', async (req, res) => {
    const { message } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'Message is required' });
    }

    try {
        const projects = await loadProjectsConfig();

        const backlogContent = await fs.readFile(PATHS.backlog, 'utf-8').catch(() => '');
        const backlogItems = parseBacklog(backlogContent);

        const { loadProjects, scanProject, getActivityStats } = require('../watcher');
        let gitActivity = [];
        try {
            const allProjects = await loadProjects();
            for (const project of allProjects.slice(0, 10)) {
                const scanResult = await scanProject(project.path);
                const stats = getActivityStats(project.name, scanResult);
                gitActivity.push(stats);
            }
        } catch (e) { /* watcher not available */ }

        const context = { backlogItems, projects, gitActivity };

        // Step 1: Try regex-based detection
        let result = parseIntent(message, context);

        // Step 2: Hybrid logic
        if (result.confidence >= 80) {
            // High confidence: use regex result as-is
            result.source = 'regex';
        } else if (result.confidence >= 50) {
            // Gray zone: ask LLM for clarification
            const llmResult = await classifyIntent(message, context);

            if (llmResult.confidence > result.confidence) {
                // LLM is more confident, rebuild action card
                const { buildActionCard, extractEntities, findContextualLinks } = require('../intent-parser');
                const entities = extractEntities(message, context);
                const links = findContextualLinks(entities, context);
                const actionCard = buildActionCard(llmResult.type, entities, links, llmResult.confidence);

                result = {
                    intentType: llmResult.type,
                    entities,
                    links,
                    actionCard,
                    confidence: llmResult.confidence,
                    source: 'llm'
                };
            } else {
                result.source = 'regex';
            }
        } else {
            // Low confidence: no action card
            result.source = 'none';
        }

        res.json(result);
    } catch (error) {
        console.error('Intent parse error:', error.message);
        res.status(500).json({ error: 'Failed to parse intent' });
    }
});
```

**Step 3: Экспортировать необходимые функции из intent-parser.js**

Add to `hub/intent-parser.js` exports (line 470-476):

```javascript
module.exports = {
    parseIntent,
    detectIntentType,
    extractEntities,
    findContextualLinks,
    buildActionCard  // Add this
};
```

**Step 4: Запустить интеграционный тест**

Run: `node hub/tests/hybrid-intent.test.js`

Expected: Все три кейса корректно обрабатываются.

**Step 5: Commit**

```bash
git add hub/routes/chat.js hub/intent-parser.js hub/tests/hybrid-intent.test.js
git commit -m "feat: implement hybrid intent detection

- confidence >= 80: use regex result
- confidence 50-79: ask LLM for clarification
- confidence < 50: regular chat (no action card)

Adds 'source' field to response: 'regex' | 'llm' | 'none'

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 5: Manual E2E Test

**Step 1: Запустить сервер**

```bash
cd hub && npm start
```

**Step 2: Тест через curl**

```bash
# Test 1: High confidence regex
curl -X POST http://localhost:3000/api/intent/parse \
  -H "Content-Type: application/json" \
  -d '{"message": "добавь идею про Claude"}'

# Expected: {"intentType":"add_to_backlog","confidence":8X,"source":"regex",...}

# Test 2: Fixed cyrillic
curl -X POST http://localhost:3000/api/intent/parse \
  -H "Content-Type: application/json" \
  -d '{"message": "сгенерим пост новый для солобади"}'

# Expected: {"intentType":"generate_content","confidence":7X,"source":"regex",...}

# Test 3: Gray zone → LLM
curl -X POST http://localhost:3000/api/intent/parse \
  -H "Content-Type: application/json" \
  -d '{"message": "хочу контент про AI"}'

# Expected: {"intentType":"generate_content","source":"llm",...}
```

**Step 3: Тест через UI**

1. Открыть http://localhost:3000
2. Ввести "сгенерим пост новый для солобади"
3. Должна появиться ContentGeneratorCard

---

## Summary

| Task | Цель | Файлы |
|------|------|-------|
| 1 | Baseline tests | `hub/tests/intent-parser.test.js` |
| 2 | Fix cyrillic regex | `hub/intent-parser.js:47` |
| 3 | LLM classifier | `hub/llm-intent-classifier.js` |
| 4 | Hybrid integration | `hub/routes/chat.js` |
| 5 | E2E validation | Manual testing |
