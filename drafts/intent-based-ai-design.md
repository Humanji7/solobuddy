# Intent-Based AI Design для SoloBuddy

**Status**: CONCEPT v1
**Date**: 2026-01-10
**Based on**: Jakob Nielsen — "AI: First New UI Paradigm in 60 Years"

---

## Executive Summary

Текущий SoloBuddy — гибрид chat + GUI, но **артикуляционный барьер** остаётся:
Пользователь вынужден формулировать `"Добавь идею X в backlog с приоритетом high"` вместо `"Та штука про орb"`.

**Цель**: Реализовать **Intent Recognition Layer** (IRL), который:
1. Распознаёт намерение из фрагментов речи
2. Генерирует интерактивные **Action Cards** прямо в chat
3. Позволяет уточнить параметры через GUI, а не промпты

**Инвестиции**: ~2-3 дня разработки
**Выгода**: 25x рост использования (по Нильсену) — из "иногда открою chat" в "всегда рядом"

---

## ⚠️ Critical UX Issues (Nielsen Review, 2026-01-10)

> **Review Score**: 7.2/10 — Proceed with Iteration
> **Full Review**: [nielsen-ux-review-intent-based-ai.md](./nielsen-ux-review-intent-based-ai.md)

### 🔴 Must Fix Before Phase 1

| Issue | Impact | Solution |
|-------|--------|----------|
| **No Error Recovery** | Users stuck when Buddy misunderstands | Undo toast after actions + retry button + [👍👎] feedback |
| **No AI Transparency** | Users don't understand WHY Buddy chose X | Confidence badges `[🟢 95%]` + expandable reasoning |
| **No Onboarding** | Users won't discover fuzzy matching | First-run tooltip + `/help` command |

### 🟡 Phase 1 Additions

```diff
Phase 1: Foundation (2-3 дня) — MVP
+ - [ ] Undo toast after every destructive action
+ - [ ] Error state for Action Cards with [Retry]
+ - [ ] Confidence badge (🟢🟡🔴) on Action Cards
+ - [ ] First-run tooltip: "💡 Говори как хочешь — Buddy найдёт"
+ - [ ] Duplicate detection before adding to backlog
+ - [ ] action-cards.css design system tokens
```

### 🏆 Review Highlights

**Best scores (9/10)**:
- Match between system and real world — язык Buddy human-centric
- Recognition rather than recall — fuzzy matching снижает cognitive load

**Lowest scores (4-5/10)**:
- Error recovery — нет flow для "Buddy ошибся"
- AI Transparency — непонятно ПОЧЕМУ Buddy так решил

---

## 🎯 Три желания Нильсена → SoloBuddy

| Желание Нильсена | Текущее состояние SoloBuddy | Проблема | Решение (Intent-Based) |
|------------------|----------------------------|----------|------------------------|
| **🥇 UX-зрелость для AI** | Chat API собирает контекст (projects, backlog, git activity), но не интерпретирует намерения | Buddy пересказывает данные: *"У тебя 5 идей в backlog"* | Intent parser определяет, что "та штука про орb" = backlog item #3 и предлагает Action Card |
| **🥈 Гибридный UI** | Chat (текст) + модалы (GUI) живут отдельно | Пользователь должен точно формулировать: *"Добавь идею X с форматом Thread"* | Buddy генерирует Action Card: `[Добавить идею?]` с GUI-контролами (приоритет, формат) |
| **🥉 Контекстная интеграция** | Buddy не знает связи между SPHERE (projects) и "живой orb" (backlog) | Пользователь сам замечает паттерны | IRL находит связи: *"Та идея про orb — она же для SPHERE, которую ты трогал вчера. Связать?"* |

---

## Current State vs Future State

### Сейчас (Prompt-Based + GUI)

**User:** Добавь идею "Live orb for UI" в backlog с форматом Thread
**Buddy:** *(вызывает API POST /api/backlog)*
Готово! Добавил в Medium Priority.

**User:** Нет, хотел High Priority
**Buddy:** *(исправляет)*
Окей, переместил.

➡️ **3 сообщения** для простой задачи
➡️ Пользователь должен **точно формулировать** параметры

---

### Будущее (Intent-Based Hybrid)

**User:** Та штука про живой orb
**Buddy:** Нашёл в backlog "Live orb for UI". Хочешь:

```
┌─────────────────────────────────────┐
│ 🔮 Live orb for UI                  │
│                                     │
│ [В session-log]  [В backlog]       │
│                                     │
│ Формат: [Thread ▼] Приоритет: [⚡] │
│                                     │
│ 💡 Связано: SPHERE (трогал вчера)  │
│    → Добавить ссылку?              │
│                                     │
│           [Добавить] [Отмена]       │
└─────────────────────────────────────┘
```

**User:** *(жмёт [Добавить])*
**Buddy:** Записал. SPHERE ждёт.

➡️ **1 сообщение + клик**
➡️ Система **поняла намерение** из фрагмента
➡️ GUI для **точных параметров**

---

## Architecture: Intent Recognition Layer (IRL)

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                             │
│                                                             │
│  Chat Input                                                 │
│      ↓                                                      │
│  Intent Detector (client-side)                             │
│      ↓                                                      │
│  [Fuzzy match в кэше] → [Action Card Preview]             │
│      ↓                                                      │
│  Server Intent Parser ← [Если неуверен]                    │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                        BACKEND                              │
│                                                             │
│  POST /api/intent/parse                                     │
│      ↓                                                      │
│  Intent Parser                                              │
│  ├── Entity Extractor (проекты, идеи, даты)               │
│  ├── Context Matcher (ссылки между backlog ↔ projects)    │
│  └── Action Resolver (что можно сделать?)                  │
│      ↓                                                      │
│  Response:                                                  │
│  {                                                          │
│    intent: "add_to_backlog",                               │
│    entities: { idea: "Live orb", project: "SPHERE" },     │
│    actionCard: { type: "AddIdeaCard", ... }               │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    ACTION CARD SYSTEM                       │
│                                                             │
│  Action Card Components (Frontend)                         │
│  ├── AddIdeaCard.js                                        │
│  ├── LinkProjectCard.js                                    │
│  ├── CommitReminderCard.js                                 │
│  └── ContextSuggestionCard.js                              │
│                                                             │
│  Render в chat как интерактивные элементы                  │
└─────────────────────────────────────────────────────────────┘
```

### Ключевые компоненты

#### 1. Intent Parser (Backend)

**Вход:** User message + Context (backlog, projects, session-log, git activity)
**Выход:** Intent Object + Action Card spec

```javascript
// hub/intent-parser.js (новый файл)
const INTENT_PATTERNS = {
  add_to_backlog: [
    /добав[ь|ить].*идею/i,
    /запис[ать|ь].*в.*backlog/i,
    /новая.*идея/i,
    /та.*штука.*про/i  // ← fuzzy match
  ],
  link_to_project: [
    /связ[ать|ь].*с.*проект/i,
    /это.*для.*\w+/i
  ],
  show_activity: [
    /что.*происходит/i,
    /как.*дела.*с/i,
    /последн[ее|ие].*commit/i
  ]
};

function parseIntent(message, context) {
  // 1. Detect intent type
  const intentType = detectIntentType(message);

  // 2. Extract entities (fuzzy matching)
  const entities = extractEntities(message, context);

  // 3. Find contextual links
  const links = findContextualLinks(entities, context);

  // 4. Build Action Card spec
  const actionCard = buildActionCard(intentType, entities, links);

  return { intentType, entities, links, actionCard };
}
```

#### 2. Entity Extractor

Находит упоминания из контекста:
- **Проекты**: "SPHERE", "тот сайт", "орб-проект"
- **Идеи**: "та штука про orb", "идея с потоком"
- **Даты**: "вчера", "3 дня назад", "сегодня"

```javascript
// Fuzzy matching для идей из backlog
function findBacklogIdea(fragment, backlogItems) {
  // "та штука про orb" → "Live orb for UI"
  const keywords = fragment.match(/про\s+(\w+)/i)?.[1];
  return backlogItems.find(item =>
    item.title.toLowerCase().includes(keywords?.toLowerCase())
  );
}
```

#### 3. Context Matcher

Находит связи:
- Если говорим про "orb" + вчера трогал SPHERE → предложить связать
- Если долго не было коммитов в VOP + есть идея про CLI → напомнить

```javascript
function findContextualLinks(entities, context) {
  const links = [];

  // Если идея упоминает проект, который недавно трогали
  if (entities.idea && context.gitActivity) {
    const recentProject = context.gitActivity.find(proj =>
      proj.daysSilent === 0 &&
      entities.idea.title.toLowerCase().includes(proj.name.toLowerCase())
    );

    if (recentProject) {
      links.push({
        type: 'recent_activity',
        project: recentProject.name,
        suggestion: `Связать с ${recentProject.name}? (трогал сегодня)`
      });
    }
  }

  return links;
}
```

#### 4. Action Cards (Frontend Components)

**AddIdeaCard** — Интерактивная карточка для добавления идеи

```javascript
// hub/action-cards/AddIdeaCard.js
function renderAddIdeaCard(data) {
  const { idea, suggestedPriority, links } = data;

  return `
    <div class="action-card add-idea">
      <div class="card-title">🔮 ${idea.title}</div>

      <div class="card-controls">
        <select name="format">
          <option value="thread">Thread</option>
          <option value="gif">GIF + Caption</option>
          <option value="post">Short Post</option>
        </select>

        <div class="priority-toggle">
          <button class="priority-btn" data-value="high">🔥</button>
          <button class="priority-btn active" data-value="medium">⚡</button>
          <button class="priority-btn" data-value="low">💭</button>
        </div>
      </div>

      ${links.length > 0 ? `
        <div class="card-suggestions">
          💡 Связано: ${links[0].suggestion}
          <button class="link-btn">→ Добавить ссылку</button>
        </div>
      ` : ''}

      <div class="card-actions">
        <button class="btn-primary" data-action="add">Добавить</button>
        <button class="btn-secondary" data-action="cancel">Отмена</button>
      </div>
    </div>
  `;
}
```

---

## UI/UX Patterns: Конкретные примеры

### Pattern 1: Fuzzy Intent → GUI Refinement

**Сценарий**: Пользователь хочет добавить идею, но формулирует расплывчато

```
User: "та штука про живой orb"

┌─────────────────────────────────────┐
│ 🔍 Нашёл 2 варианта:                │
│                                     │
│ ○ Live orb for UI (backlog)        │
│ ○ SPHERE: Interactive orb (project) │
│                                     │
│ Хочешь добавить новую идею?        │
│ [Да] [Нет, это про SPHERE]         │
└─────────────────────────────────────┘
```

Если **[Да]**:

```
┌─────────────────────────────────────┐
│ ✨ Новая идея                        │
│ ┌─────────────────────────────────┐ │
│ │ та штука про живой orb          │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Формат: [Thread ▼]  Приоритет: [⚡] │
│                                     │
│         [Добавить] [Отмена]         │
└─────────────────────────────────────┘
```

---

### Pattern 2: Context-Aware Suggestions

**Сценарий**: Buddy замечает паттерн работы

```
User: (открыл Hub)

Buddy:
SPHERE молчит 3 дня. Там живой кто?

┌─────────────────────────────────────┐
│ 🔮 SPHERE                            │
│ Последний коммит: 3 дня назад       │
│                                     │
│ Есть идеи в backlog:                │
│ • Live orb for UI                   │
│                                     │
│ [Открыть в VSCode] [Игнор]         │
└─────────────────────────────────────┘
```

---

### Pattern 3: Multi-Step Intent (Accordion Editing)

**Сценарий**: Пользователь хочет изменить приоритет идеи

```
User: "Та идея про orb — сделай high priority"

Buddy:
Окей, Live orb for UI → 🔥 High Priority

┌─────────────────────────────────────┐
│ Изменения:                          │
│ ✓ Приоритет: Medium → High         │
│                                     │
│ Ещё что-то?                         │
│ [Изменить формат] [Готово]         │
└─────────────────────────────────────┘
```

---

### Pattern 4: Apple Picking (Multi-Select)

**Сценарий**: Выбор лучших идей из нескольких вариантов Buddy

```
User: "Что стоит запостить про SPHERE?"

Buddy:
Вот 3 варианта из твоих captures:

┌─────────────────────────────────────┐
│ □ 🏆 Hold = Osmosis концепт         │
│   "Взаимодействие как обмен"       │
│                                     │
│ □ 👁️ Face-to-Face Recognition      │
│   "Sphere rotates to meet touch"   │
│                                     │
│ □ 🎵 Procedural soundscapes         │
│   "Звук как дыхание"               │
│                                     │
│     [Выбрать отмеченные] [Все]     │
└─────────────────────────────────────┘
```

---

## Implementation Roadmap

### Phase 1: Foundation (2-3 дня) — MVP

**Цель**: Proof of concept для одного intent

**Scope**:
- [ ] Создать `hub/intent-parser.js` с базовым парсером
- [ ] Добавить endpoint `POST /api/intent/parse`
- [ ] Реализовать **один** Action Card: `AddIdeaCard`
- [ ] Fuzzy matching для идей в backlog

**Критерий успеха**:
```
User: "та штука про orb"
Buddy: [Action Card для добавления идеи]
```

**Файлы**:
```
hub/
├── intent-parser.js          (NEW)
├── action-cards/             (NEW)
│   └── AddIdeaCard.js
├── server.js                 (ADD endpoint /api/intent/parse)
└── app.js                    (ADD renderActionCard())
```

---

### Phase 2: Context Awareness (1-2 дня)

**Цель**: Buddy находит связи между backlog ↔ projects

**Scope**:
- [ ] Context Matcher (связи проекты ↔ идеи)
- [ ] Action Card: `LinkProjectCard`
- [ ] Интеграция с git activity из watcher.js

**Критерий успеха**:
```
User: "та штука про orb"
Buddy: [Action Card] + "💡 Связано: SPHERE (трогал вчера)"
```

---

### Phase 3: Multi-Intent (2-3 дня)

**Цель**: Поддержка 5+ intent patterns

**Scope**:
- [ ] Intent: `show_activity` → проактивная карточка с git stats
- [ ] Intent: `link_to_project` → связать идею с проектом
- [ ] Intent: `commit_reminder` → "Давно не комитил X"
- [ ] Intent: `change_priority` → изменить параметры существующей идеи

**Action Cards**:
- [ ] `ActivityCard` — показать git activity
- [ ] `CommitReminderCard` — напоминалка про silent projects
- [ ] `EditIdeaCard` — изменить существующую идею

---

### Phase 4: Advanced UX (3-4 дня)

**Цель**: Nielsen's dream — полный гибридный UI

**Scope**:
- [ ] Multi-select (Apple Picking) для session-log captures
- [ ] Accordion Editing — изменение параметров без повторных промптов
- [ ] Voice input (опционально) — "Эй, buddy, та штука про orb"
- [ ] Predictive Action Cards — Buddy предлагает карточки ДО того, как ты спросил

**UX фичи**:
- [ ] Drag & drop идей между приоритетами
- [ ] Inline editing в Action Cards
- [ ] Keyboard shortcuts (Tab для выбора карточки)

---

## Metrics: Как измерить успех?

По Нильсену, **Usefulness = Utility × Usability**

### Before (Текущее)

| Metric | Value | Problem |
|--------|-------|---------|
| DAU/MAU | ~20% | Открываю Hub раз в неделю |
| Avg session | 2 мин | Быстро посмотрел и закрыл |
| Actions per session | 1-2 | Добавил идею, ушёл |
| Intent success rate | ~60% | Buddy часто не понимает |

### After (Intent-Based)

| Metric | Target | Why? |
|--------|--------|------|
| DAU/MAU | **60%+** | Открываю каждый день — Buddy сам предлагает действия |
| Avg session | **5-10 мин** | Диалог, а не quick check |
| Actions per session | **5-7** | Action Cards снижают трение |
| Intent success rate | **90%+** | Fuzzy matching + context |

### Key Success Indicators

1. **Time to Action** (сколько сообщений до действия)
   - Before: 3-4 сообщения ("Добавь идею X" → "Какой формат?" → "Thread" → "Готово")
   - After: **1 клик** (Action Card сразу с GUI-контролами)

2. **Context Hit Rate** (% случаев, когда Buddy нашёл правильную связь)
   - Target: 70%+ для Phase 2

3. **Abandonment Rate** (% сессий, где пользователь ушёл без действия)
   - Before: 40% (пришёл посмотреть, не понял что делать)
   - After: **<10%** (Action Cards дают чёткий next step)

---

## Architecture Principles (по Нильсену)

### 1. Visibility of System Status

**Bad**: Buddy молчит, пока Claude API думает
**Good**: Action Card показывает "🔄 Ищу связи в проектах..."

```javascript
// Loading state для Action Cards
<div class="action-card loading">
  <div class="spinner">🔄</div>
  <p>Ищу связи в проектах...</p>
</div>
```

### 2. User Control and Freedom

**Bad**: Action Card появилась — пользователь в ловушке
**Good**: Всегда есть [Отмена] / [Игнор] / [X]

```javascript
// Каждая карточка имеет escape hatch
<button class="card-dismiss" aria-label="Закрыть">×</button>
```

### 3. Error Prevention

**Bad**: Buddy добавил идею в High Priority без подтверждения
**Good**: Action Card показывает preview → [Подтвердить]

```javascript
// Preview перед действием
<div class="card-preview">
  Добавлю в High Priority backlog.
  Верно?
  [Да] [Нет, Medium]
</div>
```

### 4. Recognition Rather Than Recall

**Bad**: "Как называлась та идея про орб?"
**Good**: Action Card показывает все варианты → просто выбери

```javascript
// Fuzzy match результаты
<div class="fuzzy-results">
  <div class="result-item">
    ○ Live orb for UI
  </div>
  <div class="result-item">
    ○ SPHERE: Interactive orb
  </div>
</div>
```

---

## Technical Debt & Risks

### Risk 1: Over-Engineering

**Опасность**: Создать сложный Intent Parser, который угадывает 100% случаев
**Mitigation**:
- Phase 1: Только **очевидные** интенты (add_to_backlog)
- Fallback: Если не уверен → обычный текстовый ответ Buddy (как сейчас)

### Risk 2: Action Card Spam

**Опасность**: Buddy генерирует карточки на каждое сообщение → UI захламлен
**Mitigation**:
- Карточки только для **actionable intents**
- Если intent unclear (confidence <70%) → обычный текст
- Max 1 Action Card per Buddy response

### Risk 3: Context Overload

**Опасность**: Intent Parser собирает весь context (projects, backlog, git) → медленно
**Mitigation**:
- Кэш на клиенте (localStorage) для backlog/projects
- Server parser только для сложных интентов
- Client-side fuzzy matching для быстрых кейсов

---

## Next Steps

### Immediate (сегодня):
- [ ] **Review этого концепта** — фидбек на идеи
- [ ] **Приоритизировать** — начать с Phase 1 или Phase 2?

### Short-term (эта неделя):
- [ ] Создать прототип `intent-parser.js`
- [ ] Реализовать AddIdeaCard
- [ ] Тестировать на реальных сообщениях

### Long-term (месяц):
- [ ] Запустить все 4 фазы
- [ ] Измерить DAU/MAU, time-to-action
- [ ] Написать пост: *"Как я применил Nielsen's Intent-Based Design к личному AI companion"*

---

## References

- [Jakob Nielsen — AI: First New UI Paradigm in 60 Years](https://www.nngroup.com/articles/ai-paradigm/)
- [Nielsen Norman Group — 3 Wishes for AI UX](https://www.nngroup.com/articles/ai-ux-wishes/)
- SoloBuddy PROFILE.md — Jester-Sage voice principles
- SoloBuddy docs/STACK.md — Current architecture

---

**Вопросы для обсуждения**:

1. Стартуем с Phase 1 (MVP one intent) или сразу Phase 2 (context awareness)?
2. Action Cards — minimalistic (как macOS notifications) или rich (как Notion blocks)?
3. Нужен ли voice input для "Эй, buddy..."?
4. Какой первый intent реализовать: `add_to_backlog` или `show_activity`?
