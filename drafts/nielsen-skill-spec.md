# Nielsen UX Review Skill — Спецификация

**Цель**: Создать skill для Claude Code, который эмулирует методологию Jakob Nielsen для ревью UX-концептов.

---

## Что будет делать skill?

**Входные данные**: Концепт Intent-Based AI Design (drafts/intent-based-ai-design.md)

**Процесс**:
1. Проверка через **10 Usability Heuristics** Нильсена (1994/2020)
2. Оценка через **AI UX Evaluation Framework** (Nielsen Norman Group 2024)
3. Выявление проблем и рисков
4. Рекомендации с приоритетами

**Выходные данные**: Детальный review с оценками, критикой и улучшениями

---

## Методология Nielsen (встроенная в skill)

### 10 Usability Heuristics (2020 version)

1. **Visibility of system status**
   Система должна информировать о том, что происходит

2. **Match between system and real world**
   Система использует язык пользователя, не жаргон

3. **User control and freedom**
   Пользователи могут отменять действия (undo/redo)

4. **Consistency and standards**
   Следование платформенным конвенциям

5. **Error prevention**
   Предотвращение ошибок важнее хороших сообщений об ошибках

6. **Recognition rather than recall**
   Минимизировать нагрузку на память пользователя

7. **Flexibility and efficiency of use**
   Shortcuts для опытных пользователей

8. **Aesthetic and minimalist design**
   Не показывать ненужную информацию

9. **Help users recognize, diagnose, and recover from errors**
   Понятные сообщения об ошибках с решениями

10. **Help and documentation**
    Легко искать, фокус на задачах пользователя

### AI UX Evaluation Criteria (NN/g 2024)

1. **Articulation Barrier**
   Насколько легко пользователю выразить намерение?

2. **Context Awareness**
   Система понимает контекст пользователя?

3. **Hybrid UI Effectiveness**
   Баланс между GUI и natural language?

4. **Predictability vs Flexibility**
   GUI даёт контроль, AI — гибкость. Как совмещены?

5. **Error Recovery in AI Interactions**
   Как исправлять неверные интерпретации AI?

6. **Transparency of AI Reasoning**
   Понятно ли пользователю, как AI принял решение?

---

## Структура Review (output формат)

```markdown
# Nielsen UX Review: Intent-Based AI Design для SoloBuddy

**Reviewer**: Jakob Nielsen Brain (Skill)
**Date**: 2026-01-10
**Methodology**: 10 Heuristics + AI UX Framework

---

## Executive Summary

[3-5 предложений: главные находки]

**Overall Score**: X/10
**Recommendation**: [Proceed / Iterate / Redesign]

---

## Heuristic Evaluation

### 1. Visibility of System Status
**Score**: [1-10]
**Findings**:
- ✅ Strengths: ...
- ❌ Issues: ...
- 💡 Recommendations: ...

[Повтор для всех 10 эвристик]

---

## AI UX Evaluation

### Articulation Barrier
**Score**: [1-10]
**Analysis**: ...

[Повтор для всех 6 AI критериев]

---

## Critical Issues (Priority-Sorted)

### 🔴 Critical
1. [Issue] — Impact: [описание] — Fix: [решение]

### 🟡 Medium
1. ...

### 🟢 Low
1. ...

---

## Recommendations

### Immediate Actions (Phase 1)
- [ ] Recommendation 1
- [ ] Recommendation 2

### Strategic Improvements (Phase 2+)
- [ ] ...

---

## Metrics Validation

[Проверка предложенных метрик через Nielsen's lens]

---

## References
- [10 Usability Heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/)
- [Testing AI with Real Design Scenarios](https://www.nngroup.com/articles/testing-ai-methodology/)
```

---

## Skill Implementation Plan

### Файл: `.claude/skills/nielsen-ux-review.md`

**Структура**:
```markdown
---
name: nielsen-ux-review
description: Jakob Nielsen's UX evaluation methodology for AI interfaces
version: 1.0.0
author: SoloBuddy
---

# Instructions

You are Jakob Nielsen, legendary UX researcher and founder of Nielsen Norman Group.

Your task: Review the provided UX concept using your methodologies.

## Your Expertise

[10 Heuristics + AI UX Framework + методология]

## Review Process

1. Read the concept thoroughly
2. Apply each heuristic systematically
3. Evaluate through AI UX lens
4. Identify critical issues
5. Provide actionable recommendations

## Output Format

[Template из спеки выше]

## Tone

Professional, direct, evidence-based. You don't sugarcoat issues, but provide constructive solutions.

---

# Knowledge Base

## 10 Usability Heuristics (2020)

[Детальное описание каждой эвристики с примерами]

## AI UX Evaluation Criteria

[Детальное описание критериев для AI интерфейсов]

## Common Patterns & Anti-Patterns

[Примеры хороших и плохих решений в AI UX]
```

### Использование:

```bash
# Активация skill
/nielsen-ux-review drafts/intent-based-ai-design.md

# Или через Skill tool
Skill(name="nielsen-ux-review", args="drafts/intent-based-ai-design.md")
```

---

## Преимущества этого подхода

1. **Систематичность** — не пропустим важные аспекты юзабилити
2. **Авторитетность** — Nielsen's framework = gold standard
3. **Переиспользование** — skill можно применить к любому UX-концепту
4. **Объективность** — критерии оценки чётко определены

---

## Альтернативы (если skill не подходит)

**Вариант А**: Использовать Task tool с подробным промптом "Ты — Jakob Nielsen, оцени концепт..."

**Вариант Б**: Создать отдельный review документ вручную через Chat API

**Вариант В**: Интегрировать Nielsen's heuristics прямо в Buddy (hub/chat-api.js)

---

## Вопросы для апрува

1. **Формат skill** — .claude/skills/ или другая структура?
2. **Depth of review** — Full (все 10 heuristics) или Top-5 только?
3. **Output формат** — Markdown документ или interactive chat?
4. **Integration** — Skill как отдельная команда `/nielsen` или встроить в Buddy chat?

---

## Следующие шаги (после апрува)

1. [ ] Создать `.claude/skills/nielsen-ux-review.md`
2. [ ] Заполнить Knowledge Base (10 heuristics + AI criteria)
3. [ ] Протестировать на Intent-Based Design концепте
4. [ ] Итерировать на основе результатов

---

**Готов к реализации после вашего апрува!**

Какой вариант больше подходит?
- **A**: Полноценный skill в .claude/skills/
- **B**: Task tool с Nielsen's промптом (быстрее, меньше инфраструктуры)
- **C**: Что-то другое?
