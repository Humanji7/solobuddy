# Nielsen UX Review: Intent-Based AI Design для SoloBuddy

**Reviewer**: Jakob Nielsen Brain (Skill)
**Date**: 2026-01-10
**Methodology**: 10 Usability Heuristics + AI UX Evaluation Framework

---

## Executive Summary

Концепт Intent-Based AI Design демонстрирует **продуманное понимание** проблемы артикуляционного барьера и предлагает элегантное решение через Action Cards. Архитектура Intent Recognition Layer (IRL) следует лучшим практикам гибридного UI. Однако есть **критические пробелы** в области error recovery, transparency AI-решений, и accessibility.

**Overall Score**: 7.2/10
**Recommendation**: ✅ **Proceed with Iteration** — концепт готов к Phase 1, но требует доработки error handling и transparency

---

## Heuristic Evaluation

### 1. Visibility of System Status
**Score**: 8/10

**✅ Strengths**:
- Явно описан loading state для Action Cards (`🔄 Ищу связи в проектах...`)
- Preview изменений перед действием (Architecture Principles §1)
- Action Cards показывают что система "поняла"

**❌ Issues**:
- Нет индикации **confidence level** при fuzzy matching
- Отсутствует feedback при провале Intent parsing
- Нет visual cue когда Buddy "думает" vs "ищет в контексте"

**💡 Recommendations**:
- Добавить `confidence badge` на Action Cards: `[🟢 95% уверен]` / `[🟡 70% — уточни?]`
- Показывать progression steps: `Понял намерение → Ищу связи → Готовлю карточку`

---

### 2. Match Between System and Real World
**Score**: 9/10

**✅ Strengths**:
- Язык Buddy уже human-centric ("SPHERE молчит 3 дня. Там живой кто?")
- Fuzzy matching по ключевым словам ("та штука про orb") — как люди реально говорят
- Иконки приоритетов интуитивны: 🔥 High, ⚡ Medium, 💭 Low

**❌ Issues**:
- Термин "Action Card" — внутренний жаргон, пользователь не должен его знать
- "Intent Parser" упоминается в документе — это dev speak

**💡 Recommendations**:
- Для пользователя Action Cards = просто "карточки" или "предложения Buddy"
- Убедиться, что UI не показывает technical internals

---

### 3. User Control and Freedom
**Score**: 8/10

**✅ Strengths**:
- Каждая карточка имеет [Отмена] / [Игнор] / [×]
- Описан escape hatch: "Всегда есть escape"
- Preview перед действием ([Да] [Нет, Medium])

**❌ Issues**:
- Нет **Undo** после подтверждения действия
- Что если пользователь случайно нажал [Добавить]?
- Нет истории Action Cards для повторного использования

**💡 Recommendations**:
- Обязательно: Toast с [Отменить] после каждого action (`Добавлено в backlog. [Отменить]`)
- Опционально: Action history sidebar для повторения частых действий

---

### 4. Consistency and Standards
**Score**: 7/10

**✅ Strengths**:
- Все Action Cards следуют единой структуре (title, controls, suggestions, actions)
- Priority toggle визуально консистентен (🔥⚡💭)

**❌ Issues**:
- Разные Action Cards (AddIdeaCard, LinkProjectCard) могут иметь разный layout
- Документ не описывает Design System для карточек
- Нет спеки на цвета, spacing, typography для Action Cards

**💡 Recommendations**:
- Создать `action-cards.css` с базовыми токенами до Phase 1
- Определить grid система для карточек (single-column vs multi-column)

---

### 5. Error Prevention
**Score**: 6/10

**✅ Strengths**:
- Preview перед действием предотвращает ошибки
- Fuzzy matching с несколькими вариантами — user выбирает correct one
- Risk §2 описывает "Action Card Spam" mitigation

**❌ Issues**:
- **Нет защиты от duplicate entries** — что если "та штука про orb" добавится дважды?
- Нет validation при создании new idea (пустой title? слишком длинный?)
- Что если Intent Parser неправильно понял и предложил wrong action?

**💡 Recommendations**:
- Добавить duplicate detection: `💡 Похожая идея уже есть: [Live orb for UI]`
- Title validation с instant feedback
- **"Не то? Скажи, что имел в виду"** — fallback link на каждой карточке

---

### 6. Recognition Rather Than Recall
**Score**: 9/10

**✅ Strengths**:
- Fuzzy matching показывает все варианты — не надо вспоминать exact title
- Context suggestions ("💡 Связано: SPHERE") снижают cognitive load
- Multi-select для Apple Picking pattern хорошо описан

**❌ Issues**:
- При большом backlog (50+ items) fuzzy results могут overwhelm
- Нет search внутри Action Card для длинных списков

**💡 Recommendations**:
- Limit fuzzy results to 3-5 items + [Показать ещё...]
- Добавить inline search если список > 5 items

---

### 7. Flexibility and Efficiency of Use
**Score**: 6/10

**✅ Strengths**:
- Keyboard shortcuts упомянуты в Phase 4 (Tab для выбора)
- Drag & drop для приоритетов (Phase 4)

**❌ Issues**:
- **Shortcuts only in Phase 4** — это слишком поздно
- Нет quick-add без Action Card для power users
- Voice input = Phase 4, но это низкий приоритет?

**💡 Recommendations**:
- Phase 1: Добавить `/add` команду для power users (bypass Action Cards)
- Phase 2: Keyboard nav (Enter = confirm, Esc = cancel)
- Phase 4 voice — оставить как optional

---

### 8. Aesthetic and Minimalist Design
**Score**: 7/10

**✅ Strengths**:
- Action Cards compact — показывают только essential info
- Suggestion links (💡 Связано) contextual, не навязчивые

**❌ Issues**:
- Потенциальный visual noise при multiple suggestions
- Card с 5+ links станет cluttered
- Нет описания collapsed state для cards

**💡 Recommendations**:
- Max 2 suggestions visible, остальные под [+3 ещё]
- Collapsible sections: `[∨ Показать связи]`

---

### 9. Help Users Recognize, Diagnose, and Recover from Errors
**Score**: 5/10 ⚠️

**✅ Strengths**:
- Basic fallback описан: "Если не уверен → обычный текстовый ответ"

**❌ Issues**:
- **Критический пробел**: Что если Action Card выполнила wrong action?
- Нет описания error messages
- Нет flow для "Buddy всё напутал, исправь"
- Что если API fails во время добавления?

**💡 Recommendations**:
- Обязательно: Error state для Action Cards (`⚠️ Не удалось добавить. [Повторить]`)
- Обязательно: Toast with Undo (см. Heuristic 3)
- Добавить в Phase 1: `handleActionError()` с retry logic

---

### 10. Help and Documentation
**Score**: 5/10 ⚠️

**✅ Strengths**:
- References на Nielsen articles хорошие

**❌ Issues**:
- **Нет onboarding flow** для новых пользователей
- Как user узнает о fuzzy matching capability? ("та штука про...")
- Нет tooltips на Action Card elements
- Нет "What can Buddy do?" quick guide

**💡 Recommendations**:
- Phase 1: First-run tooltip: `💡 Tip: Говори как хочешь — Buddy найдёт нужное`
- Add help icon [?] на каждой Action Card с contextual info
- `/help` command для full capabilities list

---

## AI UX Evaluation

### Articulation Barrier
**Score**: 9/10

**Analysis**:
Концепт **прямо атакует** главную проблему AI UX — артикуляционный барьер. Fuzzy matching + Action Cards позволяют пользователю говорить natural language ("та штука про orb") вместо structured commands. Это Nielsen's dream.

**Remaining gap**: Как быстро система обучится конкретным фразам юзера? Нужен learning component.

---

### Context Awareness
**Score**: 8/10

**Analysis**:
Context Matcher хорошо спроектирован — связи backlog ↔ projects ↔ git activity. "SPHERE трогал вчера" — excellent contextual insight.

**Gap**: Нет temporal decay — старые connections должны быть менее relevant. 
"Трогал 6 месяцев назад" ≠ "трогал вчера"

---

### Hybrid UI Effectiveness
**Score**: 9/10

**Analysis**:
Best-in-class hybrid design: Chat для intent expression, Action Cards для precise parameters. Пользователь не выбирает между chat и GUI — система сама предлагает нужный mode.

**Minor issue**: Документ не описывает как Action Cards работают на mobile (touch targets, gestures).

---

### Predictability vs Flexibility
**Score**: 7/10

**Analysis**:
GUI elements (priority buttons, format dropdown) дают predictability. Fuzzy matching даёт flexibility. Баланс хороший.

**Issue**: При low confidence (< 70%) — fallback to text — это теряет predictability. User не знает когда ждать Action Card vs когда текст.

**Recommendation**: Всегда показывать mini-card с preview, даже при low confidence.

---

### Error Recovery in AI Interactions
**Score**: 5/10 ⚠️

**Analysis**:
**Критический пробел**. Документ фокусируется на happy path. Нет описания:
- Как исправить неверно интерпретированный intent?
- Как откатить неправильное действие?
- Как научить Buddy "это не то, что я имел в виду"?

**Recommendation**: Добавить learning feedback loop: `[👍 Правильно] [👎 Не то]` на каждый Action Card result.

---

### Transparency of AI Reasoning
**Score**: 4/10 ⚠️

**Analysis**:
**Вторая критическая проблема**. Документ не описывает:
- Почему Buddy выбрал именно эту интерпретацию?
- Как user видит "reasoning" за связью SPHERE ↔ идея?
- Почему предложен Medium priority, а не High?

User должен понимать WHY, не только WHAT.

**Recommendation**: 
- Добавить expandable reasoning: `[Почему это?] → "Нашёл 'orb' в названии идеи"`
- Показывать confidence source: `🟡 70% — based on keyword match`

---

## Critical Issues (Priority-Sorted)

### 🔴 Critical

1. **No Error Recovery Flow**
   - Impact: Users stuck when Buddy misunderstands, lose trust in system
   - Fix: Add Undo toast + `handleActionError()` + learning feedback [👍👎]

2. **No AI Transparency**
   - Impact: Users don't understand why Buddy suggests what it suggests
   - Fix: Expandable reasoning on Action Cards + confidence badges

3. **No Onboarding**
   - Impact: New users won't discover fuzzy matching capability
   - Fix: First-run tooltip + `/help` command

### 🟡 Medium

1. **Shortcuts only in Phase 4**
   - Impact: Power users frustrated with click-heavy flow
   - Fix: Move basic keyboard nav to Phase 2

2. **No Design System for Action Cards**
   - Impact: Inconsistent UI as more cards are added
   - Fix: Create `action-cards.css` with tokens before Phase 1

3. **No Duplicate Detection**
   - Impact: Accidental duplicate backlog entries
   - Fix: Check for similar titles before adding

### 🟢 Low

1. **No Mobile Considerations**
   - Impact: Touch targets may be too small on phone
   - Fix: Phase 2: Test on mobile, adjust card layout

2. **No Action History**
   - Impact: Can't repeat frequent actions quickly
   - Fix: Phase 3: Add action history sidebar

3. **Voice Input Deprioritized**
   - Impact: Mobile users would benefit from voice
   - Fix: Keep in Phase 4, monitor demand

---

## Recommendations

### Immediate Actions (Phase 1)

- [ ] Add **Undo toast** after every destructive action
- [ ] Add **error state** for Action Cards with retry
- [ ] Add **confidence badge** (🟢🟡) on Action Cards
- [ ] Create **action-cards.css** design system
- [ ] Add **first-run tooltip** about fuzzy matching
- [ ] Add **duplicate detection** before adding to backlog

### Strategic Improvements (Phase 2+)

- [ ] Keyboard navigation (Enter, Esc, Tab)
- [ ] Expandable AI reasoning on each card
- [ ] Learning feedback loop [👍👎]
- [ ] Mobile-optimized card layout
- [ ] Action history for power users
- [ ] `/help` command for capability discovery

---

## Metrics Validation

Предложенные метрики в концепте хорошие, но требуют уточнения:

| Metric | Концепт | Nielsen's View |
|--------|---------|----------------|
| DAU/MAU 60%+ | ✅ Good target | Confirm baseline first |
| Time to Action: 1 click | ⚠️ Optimistic | More like 1-2 clicks (select + confirm) |
| Intent success 90%+ | ⚠️ Very ambitious | Start with 75% target for Phase 1 |
| Abandonment < 10% | ✅ Good target | Add funnel tracking to validate |

**Missing Metrics**:
- **Error rate**: % of actions that user Undoes
- **Learning velocity**: How fast system improves per user
- **Trust score**: User-reported confidence in Buddy

---

## Final Verdict

**Intent-Based AI Design** — это **правильное направление** для SoloBuddy. Концепт демонстрирует глубокое понимание Nielsen's principles и AI UX best practices.

Главные победы:
- 🏆 Fuzzy matching снижает артикуляционный барьер
- 🏆 Hybrid UI (chat + Action Cards) — gold standard
- 🏆 Context awareness across projects/backlog/git

Критические пробелы для Phase 1:
- ⚠️ Error recovery flow
- ⚠️ AI transparency/explainability
- ⚠️ Onboarding experience

**Рекомендация**: Proceed to Phase 1, но включить **Immediate Actions** из этого review в scope.

---

## References

- [10 Usability Heuristics (NN/g 2020)](https://www.nngroup.com/articles/ten-usability-heuristics/)
- [AI: First New UI Paradigm in 60 Years](https://www.nngroup.com/articles/ai-paradigm/)
- [Testing AI with Real Design Scenarios](https://www.nngroup.com/articles/testing-ai-methodology/)
- [3 Wishes for AI UX](https://www.nngroup.com/articles/ai-ux-wishes/)
