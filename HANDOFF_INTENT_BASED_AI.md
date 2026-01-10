# HANDOFF: Intent-Based AI + UX Redesign

**Session**: 2026-01-10
**Status**: Phase 1 Complete, UX Issues Identified

---

## ✅ Что сделано

### Nielsen UX Review
- Провели review `drafts/intent-based-ai-design.md` по методологии Nielsen
- Score: **7.2/10** — Proceed with Iteration
- Полный review: `drafts/nielsen-ux-review-intent-based-ai.md`

### Phase 1 — Intent Recognition Layer
- `hub/intent-parser.js` — fuzzy matching, confidence scores
- `hub/action-cards.css` — design system
- `hub/action-cards.js` — Action Card components
- `hub/server.js` — endpoint `/api/intent/parse`
- `hub/app.js` — integration into chat

### Коммит
```
5747d41 feat(ux): Phase 1 Intent-Based AI Design — Nielsen-approved implementation
```

---

## 🔴 TODO: UX Issues (User Feedback)

### 1. Help Button с мини-инструкцией
**Проблема**: Юзер не понимает как пользоваться Action Cards, нет onboarding.

**Решение**:
- Добавить кнопку `[?]` рядом с полем ввода чата
- При клике — tooltip/modal с кратким гайдом
- "Дышащая" кнопка (subtle pulse animation)

**Wireframe**:
```
┌────────────────────────────────────┐
│ Ask me anything...          [?] → │
└────────────────────────────────────┘
                               ↑
                     Help button (pulsing)
```

**Content**:
```
💡 Быстрые команды:
• "добавь идею..." — создать идею
• "та штука про..." — найти идею  
• "новая идея" — пустая форма
```

### 2. Редизайн нижней части страницы
**Проблема**: Session Log, Ideas Backlog, Drafts — "не нужны" юзеру в текущем виде.

**Что важно юзеру**:
- Connect GitHub ✓
- Add Local ✓  
- Chat + Action Cards ✓

**Варианты решения**:
- **A**: Скрыть нижнюю часть за toggle/accordion
- **B**: Переместить в отдельную вкладку/страницу
- **C**: Сделать compact view (только заголовки, раскрываются по клику)
- **D**: Убрать нижнюю часть полностью, оставить только Chat

**Нужно**: Решение от юзера какой вариант предпочтительнее.

---

## 📁 Файлы Phase 1

| Файл | Описание |
|------|----------|
| `hub/intent-parser.js` | Intent Recognition Layer |
| `hub/action-cards.css` | CSS Design System |
| `hub/action-cards.js` | Action Card Components |
| `drafts/intent-based-ai-design.md` | Концепт (updated) |
| `drafts/nielsen-ux-review-intent-based-ai.md` | Nielsen Review |
| `drafts/nielsen-skill-spec.md` | Nielsen Skill Spec |

---

## 🧪 Как протестировать

```bash
cd hub && npm start
# http://localhost:3000
```

Триггеры для Action Cards:
- `"добавь идею про X"`
- `"новая идея"`
- `"та штука про X"`
- `"запиши в backlog"`

---

## Next Session

1. [ ] Добавить Help button `[?]` с pulse animation
2. [ ] Решить судьбу нижней части страницы (Session Log / Backlog / Drafts)
3. [ ] Phase 2: Context Awareness (связи проекты ↔ идеи)
