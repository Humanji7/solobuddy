# Handoff

> Контекст для следующей сессии. Читай перед началом работы.

---

## Текущее состояние

**Последний коммит:** `docs: add GROQ_API_KEY to .env.example`

**Сервер:** http://localhost:3000

**Что готово:**
- Settings Modal с 6 табами (Profile, Platforms, Projects, Prompts, Voice, Soul)
- API `/api/settings` (GET/PUT) — основные настройки
- API `/api/prompts` — редактирование промптов (chat, voice, soul)
- Reset to Default для Prompts и Voice
- ✅ ContentGeneratorCard работает (Groq Gate настроен)

---

## Решено: Draft карточка не появлялась

**Root cause:** `GROQ_API_KEY` отсутствовал в `hub/.env`

**Как работает:**
1. Пользователь пишет "Напиши черновик поста..."
2. `/api/intent/parse` → regex (не матчит) → Groq Gate (fallback)
3. Groq определяет `generate_content` с confidence 92%
4. Фронтенд показывает `ContentGeneratorCard`
5. Клик "Generate" → `/api/content/generate` → Post Editor

**Fix:** Скопирован `.env` в `hub/` с `GROQ_API_KEY`

---

## Следующие задачи (приоритет)

### 1. Regex backup для content detection
Groq Gate работает, но добавить regex для "черновик":
```javascript
// intent-parser.js, строка 48
/(?:напи?[шс][иы]?|сделай|создай)\s+(?:черновик\s+)?(?:пост|тред)/i
```
Это даст мгновенный ответ без сетевого запроса.

### 2. Улучшить ContentGeneratorCard UX
- Добавить выбор платформы (Twitter, IH, Telegram)
- Показывать примеры постов пользователя для контекста
- Сохранять draft автоматически в `ai-drafts.json`

### 3. Per-project phases
- SPHERE = sniper, VOP = shotgun
- Сейчас одна фаза на всё

### 4. Тесты
- Покрыть Groq Gate (mock API)
- Покрыть intent-parser regex patterns

---

## Архитектура Intent Detection

```
User message
    ↓
/api/intent/parse
    ↓
┌─────────────────────┐
│ 1. Regex detection  │ ← быстро, но ограничено паттернами
│    (intent-parser)  │
└─────────────────────┘
    ↓ (if no match)
┌─────────────────────┐
│ 2. Groq Gate        │ ← семантический fallback (~200ms)
│    (groq-classifier)│
└─────────────────────┘
    ↓
actionCard → Frontend → ContentGeneratorCard
```

---

## Файлы для контекста

| Файл | Назначение |
|------|------------|
| `hub/intent-parser.js` | Regex паттерны для интентов |
| `hub/groq-classifier.js` | Groq API для семантической детекции |
| `hub/action-cards.js` | Рендер карточек (ContentGeneratorCard) |
| `hub/routes/chat.js` | API endpoints `/api/chat`, `/api/intent/parse` |

---

*Updated: 2026-01-13*
