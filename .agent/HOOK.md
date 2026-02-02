# HOOK — Vision Integration

**Status:** ACTIVE
**Created:** 2026-02-02
**Next Session:** Встраивание Vision в bip-buddy

---

## Context

Спроектировали Vision — AI-ассистент (персональный PR-директор). Решили встраивать в существующий bip-buddy, а не отдельный репо.

**Дизайн-документ:** `docs/plans/2026-02-02-vision-ai-assistant-design.md`

---

## Current Molecule: Подготовка к интеграции

### Pre-flight Checklist:

- [ ] Создать структуру `vision/` в bip-buddy
- [ ] Инициализировать `pyproject.toml` с uv
- [ ] Расширить схему `bip.db` (миграция 002)
- [ ] Портировать `lib/sql-safe.sh` → Python
- [ ] Портировать `lib/credentials.sh` → Python keyring
- [ ] Мигрировать промпты из `solobuddy/` → `vision/prompts/`

---

## Assets to Reuse

### Промпты (копировать):
```
.ai/skills/solobuddy/prompts/system.md       → vision/prompts/system.md
.ai/skills/solobuddy/prompts/content.md      → vision/prompts/content.md
.ai/skills/solobuddy/modules/twitter-expert.md → vision/prompts/twitter.md
.ai/skills/solobuddy/references/humanizer.md → vision/prompts/humanizer.md
```

### Bash → Python:
```
.ai/scripts/lib/sql-safe.sh    → vision/data/utils.py
.ai/scripts/lib/credentials.sh → vision/utils/keychain.py
```

### SQLite (расширить bip.db):
```
Добавить таблицы:
- assistant_profile
- memory
- ideas
- conversations
- authenticity_checks
- post_metrics
```

---

## Target Structure

```
bip-buddy/
├── vision/                    # 🆕
│   ├── __init__.py
│   ├── main.py
│   ├── core/
│   │   ├── agent.py
│   │   ├── router.py
│   │   ├── context.py
│   │   └── protocols.py
│   ├── skills/
│   ├── llm/
│   ├── integrations/
│   ├── data/
│   │   ├── database.py
│   │   ├── migrations/
│   │   └── repositories/
│   ├── prompts/
│   └── utils/
│
├── .ai/                       # Оставить (Bird CLI)
├── data/bip.db               # Расширить
└── pyproject.toml            # 🆕
```

---

## Commands for Next Session

```bash
# 1. Проверить состояние
cat .agent/HOOK.md

# 2. Создать структуру
mkdir -p vision/{core,skills,llm/providers,integrations/{telegram,twitter,whisper},data/{migrations,repositories},prompts,utils}
touch vision/__init__.py vision/main.py

# 3. Инициализировать Python
uv init --name bip-buddy
uv add anthropic openai structlog aiosqlite

# 4. Скопировать промпты
cp .ai/skills/solobuddy/prompts/system.md vision/prompts/
cp .ai/skills/solobuddy/prompts/content.md vision/prompts/
cp .ai/skills/solobuddy/modules/twitter-expert.md vision/prompts/twitter.md
cp .ai/skills/solobuddy/references/humanizer.md vision/prompts/

# 5. Создать миграцию
# → vision/data/migrations/002_vision_tables.sql

# 6. Начать с контрактов
# → vision/core/protocols.py
```

---

## Done / Current / Pending

| Status | Item |
|--------|------|
| ✅ Done | Дизайн Vision (9 capabilities) |
| ✅ Done | Ревью: архитектура, БД, agent loop, UX, skills |
| ✅ Done | Дизайн-документ в docs/plans/ |
| ✅ Done | Решение: встраиваемся в bip-buddy |
| 🔄 Current | Подготовка к интеграции |
| ⏳ Pending | Создание структуры vision/ |
| ⏳ Pending | pyproject.toml + dependencies |
| ⏳ Pending | Миграция БД (002_vision_tables.sql) |
| ⏳ Pending | Портирование промптов |
| ⏳ Pending | Phase 1: Core (protocols, agent, router) |

---

## Implementation Phases

### Phase 1: Core (первый приоритет)
- [ ] vision/core/protocols.py (Skill, LLMProvider contracts)
- [ ] vision/data/database.py (SQLite + pragmas)
- [ ] vision/data/migrations/002_vision_tables.sql
- [ ] vision/core/agent.py (main loop, graceful shutdown)
- [ ] vision/llm/client.py (Claude + OpenAI fallback)

### Phase 2: Skills
- [ ] vision/skills/base.py
- [ ] vision/skills/content_gen.py
- [ ] vision/skills/idea_bank.py
- [ ] vision/skills/chat.py (fallback)

### Phase 3: Integrations
- [ ] vision/integrations/telegram/client.py (MCP wrapper)
- [ ] vision/integrations/whisper/adapter.py
- [ ] vision/integrations/twitter/adapter.py (Bird CLI)

---

## System Health (from previous session)

### launchd Services
| Service | Status |
|---------|--------|
| `com.clawdbot.gateway` | Running (будет заменён Vision) |
| `com.bipbuddy.twitter-mirror` | Works |

### Security
- macOS Firewall: включён
- Keychain credentials: настроены
- plist permissions: 600

---

## Handoff Note

**Сессия 2026-02-02:**
Полный дизайн Vision с 5 экспертными ревью (архитектор, DBA, Python dev, UX panel, FAANG panel). Решили встраивать в bip-buddy — переиспользуем ~40% (промпты, SQLite, Bird CLI).

Следующая сессия: создать структуру и начать Phase 1 (Core).

---

*Last updated: 2026-02-02*
