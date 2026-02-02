# HOOK — Vision Integration

**Status:** ACTIVE
**Created:** 2026-02-02
**Next Session:** Claude OAuth + Phase 2 Skills

---

## Context

Vision — AI-ассистент (персональный PR-директор) для Build in Public creators. Встроен в bip-buddy. Phase 1 (Core) завершена.

**Дизайн-документ:** `docs/plans/2026-02-02-vision-ai-assistant-design.md`

---

## Current Molecule: Claude OAuth + Phase 2

### Приоритет 1: Claude OAuth (экономия на API)

Настроить OAuth для использования Claude через подписку вместо API:
- [ ] Исследовать claude.ai OAuth flow
- [ ] Реализовать `vision/llm/providers/claude_oauth.py`
- [ ] Интегрировать в LLMClient как primary provider
- [ ] Хранить токены в macOS Keychain

### Приоритет 2: Phase 2 Skills

- [ ] `vision/skills/content_gen.py` — генерация контента
- [ ] `vision/skills/idea_bank.py` — банк идей
- [ ] Whisper интеграция (voice → text)
- [ ] Claude Vision интеграция (screenshot → text)

---

## Done (Phase 1: Core) ✅

```
vision/
├── __init__.py
├── main.py                    ✅ Entry point + StubTelegram
├── core/
│   ├── protocols.py          ✅ Contracts (Skill, LLM, Context)
│   └── agent.py              ✅ Main loop + graceful shutdown
├── skills/
│   ├── base.py               ✅ BaseSkill abstract class
│   └── chat.py               ✅ Fallback chat skill
├── llm/
│   ├── client.py             ✅ Multi-provider с failover
│   ├── circuit_breaker.py    ✅ Circuit breaker pattern
│   └── providers/
│       ├── claude.py         ✅ Anthropic API provider
│       └── openai.py         ✅ OpenAI API provider
├── data/
│   ├── database.py           ✅ Async SQLite + WAL + migrations
│   └── migrations/
│       └── 002_vision_tables.sql  ✅ 8 таблиц STRICT
├── prompts/
│   ├── system.md             ✅
│   ├── content.md            ✅
│   ├── twitter.md            ✅
│   └── humanizer.md          ✅
└── utils/
    └── logging.py            ✅ structlog config
```

### Проверка запуска
```bash
uv run python -m vision.main
# Output:
# ✅ vision_starting              version=0.1.0
# ✅ database_connected           path=.../bip.db
# ⚠️ no_llm_providers            (ожидаемо без API keys)
# ✅ agent_started                skills=['chat']
# ✅ agent_stopped                (graceful shutdown)
```

---

## Commands for Next Session

```bash
# 1. Проверить состояние
cat .agent/HOOK.md

# 2. Проверить что Vision запускается
uv run python -m vision.main

# 3. Исследовать Claude OAuth
# - claude.ai использует OAuth2
# - Нужен browser auth flow → токены
# - Токены хранить в Keychain

# 4. После OAuth — Phase 2 Skills
# - content_gen.py
# - idea_bank.py
```

---

## Implementation Phases

### ✅ Phase 1: Core (DONE)
- [x] vision/core/protocols.py
- [x] vision/data/database.py + migrations
- [x] vision/core/agent.py
- [x] vision/llm/client.py + providers
- [x] vision/skills/base.py + chat.py
- [x] vision/utils/logging.py

### 🔄 Phase 1.5: Claude OAuth (NEXT)
- [ ] Исследовать OAuth flow claude.ai
- [ ] vision/llm/providers/claude_oauth.py
- [ ] Keychain storage для токенов
- [ ] Auto-refresh при истечении

### ⏳ Phase 2: Skills
- [ ] vision/skills/content_gen.py
- [ ] vision/skills/idea_bank.py
- [ ] vision/integrations/whisper/adapter.py
- [ ] Claude Vision для скриншотов

### ⏳ Phase 3: Integrations
- [ ] vision/integrations/telegram/client.py (MCP wrapper)
- [ ] vision/integrations/twitter/adapter.py (Bird CLI)

---

## Technical Notes

### Database
- SQLite с WAL mode
- STRICT tables (TEXT для timestamps)
- 8 новых таблиц: memory, ideas, posts, conversations, etc.
- Миграция: `vision/data/migrations/002_vision_tables.sql`

### LLM Client
- Multi-provider с circuit breaker
- Claude API (primary) + OpenAI (fallback)
- Провайдеры опциональны — инициализируются только с API key
- **TODO:** добавить Claude OAuth provider

### Agent Loop
- Async message stream
- Parallel message handling
- 60s timeout per message
- Graceful shutdown на SIGTERM/SIGINT

---

## Handoff Note

**Сессия 2026-02-02 (вечер):**

Завершили Phase 1: Core — полностью рабочий скелет Vision:
- Database с миграциями и STRICT tables
- LLM client с failover между Claude/OpenAI
- Agent loop с graceful shutdown
- Chat skill как fallback
- Structured logging через structlog

**Следующая сессия:**
1. **Claude OAuth** — использовать подписку вместо API (экономия)
2. **Phase 2: Skills** — content_gen, idea_bank

**Запуск для проверки:**
```bash
cd /Users/admin/projects/bip-buddy
uv run python -m vision.main
```

---

*Last updated: 2026-02-02*
