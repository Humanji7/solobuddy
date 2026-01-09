# Code Simplifier: server.js Batch 1

> **Роль**: code-simplifier subagent  
> **Цель**: Упростить код, сохраняя 100% функциональности

---

## Контекст

Прочитай детали реализации:
- [implementation_plan.md](file:///Users/admin/.gemini/antigravity/brain/464f0729-fd62-4ef5-8e33-6db3104e2807/implementation_plan.md)
- [Методология code-simplifier](file:///Users/admin/.gemini/antigravity/knowledge/agent_orchestration_patterns/artifacts/subagent_code_simplifier_workflow.md)

---

## Задачи

Примени 3 рефакторинга к `hub/server.js`:

### 1. Упростить `parseDraft` (строки 184-193)
Замени if-else цепочку на функцию с guard clauses:
```javascript
function detectStatus(text) {
    if (!text) return 'draft';
    const t = text.toLowerCase();
    if (t.includes('ready') || t.includes('done')) return 'ready';
    if (t.includes('progress') || t.includes('v1')) return 'in-progress';
    return 'draft';
}
```

### 2. Упростить `parseBacklog` priority detection (строки 102-116)
Используй объект-маппинг вместо if-continue.

### 3. Извлечь `asyncHandler` (строки 207-248)
Убери дублирование try/catch в 3 GET роутах.

---

## Верификация

После каждого изменения:
```bash
cd /Users/admin/projects/bip-buddy/hub
node server.js &
curl http://localhost:3000/api/session-log
curl http://localhost:3000/api/backlog
curl http://localhost:3000/api/drafts
```

Проверь что ответы идентичны.

---

## Ограничения

- **Инкрементальность**: Один рефакторинг за раз
- **Zero side-effects**: Поведение API неизменно
- **Не трогай**: `app.js`, `styles.css`, `index.html`
