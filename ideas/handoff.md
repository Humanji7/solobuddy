# Handoff

> Контекст для следующей сессии. Читай перед началом работы.

---

## Текущее состояние

**Последний коммит:** `2a62275` fix(settings): compact tabs to fit 6 in one row

**Сервер:** http://localhost:3000

**Что готово:**
- Settings Modal с 6 табами (Profile, Platforms, Projects, Prompts, Voice, Soul)
- API `/api/settings` (GET/PUT) — основные настройки
- API `/api/prompts` — редактирование промптов (chat, voice, soul)
- Reset to Default для Prompts и Voice
- Defaults автосохраняются в `hub/prompts/defaults/`
- ✅ UI табов Settings исправлен (компактные, 6 в ряд)

---

## Следующая задача: Настройка LLM в хабе

**Проблема:** Хаб не вызывает draft карточку при запросе генерации поста.

**Контекст:** Пользователь кинул промпт:
> "Напиши черновик поста для IndieHackers. Формат IH: длиннее чем твит, история + что сделал + что понял. Без заголовков, без списков. Пиши в моём голосе из примеров. С юмором, без пафоса. Фокус: {{first post about Solobuddy}}"

**Ожидалось:** Хаб создаёт draft карточку с постом.

**Факт:** Хаб ответил текстом поста прямо в чат, не вызвав карточку.

**Нужно исследовать:**
1. Как хаб определяет когда создавать draft карточку?
2. Где логика триггера для draft creation?
3. Как system prompt влияет на это поведение?

---

## Архитектура LLM Settings (реализовано)

| Слой | Файл | Назначение |
|------|------|------------|
| Hub Chat | `system-prompt-v2.md` | System prompt для главного чата |
| Voice | `hub/prompts/jester-sage.md` | Стиль написания постов |
| Soul | `data/project-souls/{project}.json` → `soulMdContent` | Результат онбординга проекта |

**Исключено из scope (legacy):**
- Temperature — устарело в 2026
- Max tokens — не нужно
- Model selection — не нужно

---

## Также в очереди:

- **Тесты:** Пока 0 файлов (норм для текущей стадии)
- **docs/STACK.md:** Outdated после рефакторинга

---

*Updated: 2026-01-13*
