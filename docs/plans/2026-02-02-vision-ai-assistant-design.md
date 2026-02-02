# Vision AI Assistant — Design Document

> Персональный PR-директор и маркетолог для Build in Public creators

**Дата:** 2026-02-02
**Статус:** Approved for Implementation
**Авторы:** Human + Claude (сооснователи)

---

## Executive Summary

Vision — локальный AI-ассистент на macOS, работающий через Telegram. Заменяет ClawdBot, решает проблему 403 ошибок через auto-refresh OAuth. Позиционирование: "супергерой-маркетолог" с памятью, мультимодальным входом и feedback loops.

**Ключевые отличия от конкурентов:**
- Долгосрочная память стратегии и tone of voice
- Мультимодальный вход (голос, скриншоты, текст)
- Authenticity Guardian — проверка "звучит как ты?"
- Feedback loops — учится на результатах

---

## MVP Capabilities (9 способностей)

### Ядро:
1. **Память и контекст** — помнит стратегию, tone of voice, историю
2. **Генерация контента** — твиты, посты, треды
3. **Идея-банк** — накопление и поиск идей

### Мультимодальный вход:
4. **Голос → пост** — Whisper API, надиктовал — оформил
5. **Скриншот → пост** — Claude Vision, кинул скрин — сделал контент

### Feedback Loop:
6. **Post Performance Autopsy** — разбор "что зашло, что нет"
7. **Growth Dashboard** — метрики и прогресс

### Доверие:
8. **"Why this works"** — микро-объяснения при генерации
9. **Authenticity Guardian** — проверка соответствия стилю

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Telegram                           │
│                    (MCP — уже есть)                     │
└─────────────────┬───────────────────────────────────────┘
                  │ сообщения, голос, фото
                  ▼
┌─────────────────────────────────────────────────────────┐
│                   VISION CORE                           │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐           │
│  │  Router   │  │  Context  │  │    LLM    │           │
│  │ (intent)  │  │ (memory)  │  │ (Claude/  │           │
│  └───────────┘  └───────────┘  │  OpenAI)  │           │
│                                └───────────┘           │
│  ┌─────────────────────────────────────────┐           │
│  │              Skills Engine              │           │
│  │  • content_gen  • voice_to_post         │           │
│  │  • screenshot   • idea_bank             │           │
│  │  • autopsy      • authenticity          │           │
│  └─────────────────────────────────────────┘           │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│                    Data Layer                           │
│  SQLite (vision.db) + Migrations                       │
└─────────────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│                   Integrations                          │
│  • Bird CLI (Twitter + auto OAuth refresh)             │
│  • Whisper API (voice)                                 │
│  • Claude API (primary) + OpenAI (fallback)            │
└─────────────────────────────────────────────────────────┘
```

### Ключевые решения:
- **Telegram через MCP** — не переписываем, работает
- **Python async** — anthropic/openai SDK first-class
- **SQLite** — уже есть в проекте, STRICT mode
- **Multi-provider LLM** — Claude primary, OpenAI fallback с circuit breaker
- **Bird CLI + watchdog** — auto-refresh OAuth при 403

---

## Data Model

```sql
-- Версионирование схемы
CREATE TABLE schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    description TEXT
) STRICT;

-- Профиль ассистента (singleton)
CREATE TABLE assistant_profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    name TEXT,
    tone TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
) STRICT;

-- Память о пользователе
CREATE TABLE memory (
    id INTEGER PRIMARY KEY,
    type TEXT NOT NULL CHECK(type IN ('strategy', 'tone_of_voice', 'fact', 'preference')),
    content TEXT NOT NULL,
    importance INTEGER DEFAULT 5 CHECK(importance BETWEEN 1 AND 10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_accessed TIMESTAMP
) STRICT;

-- Банк идей
CREATE TABLE ideas (
    id INTEGER PRIMARY KEY,
    content TEXT NOT NULL,
    source TEXT CHECK(source IN ('voice', 'screenshot', 'manual', 'generated')),
    status TEXT DEFAULT 'new' CHECK(status IN ('new', 'used', 'archived')),
    tags TEXT CHECK(json_valid(tags) OR tags IS NULL),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
) STRICT;

-- Посты
CREATE TABLE posts (
    id INTEGER PRIMARY KEY,
    idea_id INTEGER REFERENCES ideas(id),
    platform TEXT NOT NULL CHECK(platform IN ('twitter', 'linkedin', 'threads', 'telegram')),
    content TEXT NOT NULL,
    external_id TEXT,
    published_at TIMESTAMP,
    status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'published', 'failed')),
    autopsy_asked INTEGER DEFAULT 0,
    autopsy_response TEXT,
    why_worked TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    deleted_at TIMESTAMP
) STRICT;

-- Метрики постов (снепшоты для autopsy)
CREATE TABLE post_metrics (
    id INTEGER PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES posts(id),
    likes INTEGER DEFAULT 0,
    retweets INTEGER DEFAULT 0,
    views INTEGER DEFAULT 0,
    replies INTEGER DEFAULT 0,
    captured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) STRICT;

-- Диалоги
CREATE TABLE conversations (
    id INTEGER PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    message_type TEXT CHECK(message_type IN ('text', 'voice', 'image')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) STRICT;

-- Проверки аутентичности
CREATE TABLE authenticity_checks (
    id INTEGER PRIMARY KEY,
    post_id INTEGER REFERENCES posts(id),
    idea_id INTEGER REFERENCES ideas(id),
    result TEXT CHECK(result IN ('pass', 'warning', 'fail')),
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) STRICT;

-- Индексы
CREATE INDEX idx_memory_importance ON memory(importance DESC);
CREATE INDEX idx_ideas_active ON ideas(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_posts_platform ON posts(platform, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_posts_idea ON posts(idea_id);
CREATE INDEX idx_post_metrics_post ON post_metrics(post_id, captured_at DESC);
CREATE INDEX idx_conversations_session ON conversations(session_id, created_at);

-- SQLite оптимизации
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = -64000;
PRAGMA temp_store = MEMORY;
```

---

## Agent Loop

```python
class VisionAgent:
    def __init__(self, telegram, llm, context, skills):
        self.telegram = telegram
        self.llm = llm
        self.context = context
        self.skills = skills
        self._shutdown = asyncio.Event()
        self._tasks = set()
        self.session_manager = SessionManager()

    async def run(self):
        """Main loop с graceful shutdown"""
        logger.info("agent_started")

        try:
            async for message in self.telegram.stream():
                if self._shutdown.is_set():
                    break

                task = asyncio.create_task(
                    self._handle_message_safe(message)
                )
                self._tasks.add(task)
                task.add_done_callback(self._tasks.discard)
        finally:
            await self._cleanup()

    async def _handle_message_safe(self, message):
        """Обработка с полной защитой от ошибок"""
        log = logger.bind(message_id=message.id, user_id=message.user_id)

        try:
            await asyncio.wait_for(
                self._handle_message(message),
                timeout=60.0
            )
        except asyncio.TimeoutError:
            log.error("message_timeout")
            await self.telegram.send("⏱ Таймаут, попробуй ещё раз")
        except Exception as e:
            log.exception("message_failed")
            await self.telegram.send("❌ Ошибка, попробуй ещё раз")

    async def _handle_message(self, message):
        """Core processing logic"""
        # 1. Preprocess (voice/image → text)
        text = await self._preprocess(message)

        # 2. Get context
        session_id = self.session_manager.get_session_id(message.user_id)
        context = await self.context.build(text, session_id)

        # 3. Route to skill
        intent = await self.router.classify(text, context)
        skill = self.skills.get(intent)

        # 4. Execute with idempotency
        result = await skill.execute(
            context,
            self.llm,
            request_id=message.id
        )

        # 5. Save & respond
        await self.context.save_conversation(text, result.response, session_id)
        await self.telegram.send(result.response, message_id=message.id)

    async def _cleanup(self):
        """Graceful shutdown"""
        logger.info("agent_shutting_down", pending=len(self._tasks))
        if self._tasks:
            await asyncio.wait(self._tasks, timeout=30.0)
        await self.llm.close()
        await self.telegram.close()
        logger.info("agent_stopped")

    def shutdown(self):
        self._shutdown.set()
```

### Ключевые паттерны:
- **Graceful shutdown** через asyncio.Event
- **Параллельная обработка** — не блокируем на медленных запросах
- **Timeout 60s** на каждое сообщение
- **Structured logging** через structlog
- **Idempotency** через request_id

---

## Onboarding Flow (Value-First)

```
ШАГ 1: Сразу к делу (30 сек до результата)
═══════════════════════════════════════════

🎤 "Привет! Я твой PR-директор.
    Расскажи голосом или напиши:
    чем занимаешься, что строишь, для кого?"

[🎤 Записать] [✍️ Написать] [📋 Пример]


ШАГ 2: Подтверждение (feedback loop)
═══════════════════════════════════════════

"Отлично! Вот что я понял:
 • Продукт: {X}
 • Аудитория: {Y}
 • Цель: {Z}

Правильно?"

[Да ✅] [Уточнить ✏️]


ШАГ 3: Немедленная демонстрация ценности
═══════════════════════════════════════════

"Смотри что я могу 👇"

[Генерирует пост прямо здесь]

"Нравится?"

[Да, класс! 🔥] [Другой стиль] [Для LinkedIn]


ШАГ 4: Персонализация (ПОСЛЕ value)
═══════════════════════════════════════════

"Кстати, как мне тебя называть?"

[Вижен] [Джарвис] [Своё] [Не важно]

"Хочешь настроить мой стиль под твой?"

[Вот пример 📎] [Подстройся сам] [Потом]


ШАГ 5: Готово
═══════════════════════════════════════════

"Готово! Теперь просто:
 • Кинь голосовое с идеей
 • Скинь скриншот для переупаковки
 • Напиши тему

💡 /settings — дополнительные настройки"
```

### Принципы (по результатам UX ревью):
- **Value-first** — результат за 60-90 сек
- **Feedback после каждого ввода** — подтверждение понимания
- **Персонализация после демонстрации** — сначала докажи competence
- **Voice primary, buttons fallback** — multimodal sync

---

## Skills Architecture

```python
from typing import Protocol, Literal
from dataclasses import dataclass

@dataclass
class SkillResult:
    response: str
    status: Literal["success", "partial", "error"]
    explanation: str | None = None
    memory_updates: list[tuple] | None = None
    actions: list | None = None

class Skill(Protocol):
    """Typed contract для всех skills"""

    async def execute(
        self,
        context: Context,
        llm: LLMClient,
        request_id: str
    ) -> SkillResult:
        ...

    def validate_input(self, context: Context) -> bool:
        ...

    def validate_output(self, result: SkillResult) -> SkillResult:
        ...
```

### Skills Map:

| Skill | Триггеры | Описание |
|-------|----------|----------|
| `content_gen` | "напиши", "создай", "пост про..." | Генерация контента |
| `idea_bank` | "сохрани", "запомни", "идеи про..." | CRUD для идей |
| `authenticity` | автоматически после content_gen | Проверка стиля |
| `autopsy` | "разбери", "что не так", авто через 24ч | Анализ перформанса |
| `dashboard` | "статистика", "как дела", "метрики" | Growth dashboard |
| `chat` | fallback | Обычный диалог |

### Ключевые паттерны (по FAANG ревью):
- **Typed contracts** — Protocol с явными типами
- **Idempotency keys** — защита от дубликатов при retry
- **LLM output validation** — проверка длины, формата
- **Error wrapper** — graceful degradation

---

## Project Structure

```
vision/
├── README.md
├── pyproject.toml
├── .env.example
│
├── vision/
│   ├── __init__.py
│   ├── main.py
│   │
│   ├── core/
│   │   ├── agent.py
│   │   ├── router.py
│   │   ├── context.py
│   │   ├── session.py
│   │   └── protocols.py
│   │
│   ├── skills/
│   │   ├── registry.py
│   │   ├── base.py
│   │   ├── content_gen.py
│   │   ├── idea_bank.py
│   │   ├── authenticity.py
│   │   ├── autopsy.py
│   │   ├── dashboard.py
│   │   └── chat.py
│   │
│   ├── llm/
│   │   ├── client.py
│   │   ├── providers/
│   │   │   ├── claude.py
│   │   │   └── openai.py
│   │   └── circuit_breaker.py
│   │
│   ├── integrations/
│   │   ├── telegram/
│   │   ├── twitter/
│   │   └── whisper/
│   │
│   ├── data/
│   │   ├── database.py
│   │   ├── migrations/
│   │   └── repositories/
│   │
│   ├── prompts/
│   │   ├── content_gen.md
│   │   ├── authenticity.md
│   │   ├── autopsy.md
│   │   └── router.md
│   │
│   └── utils/
│       ├── logging.py
│       └── metrics.py
│
├── tests/
│   ├── unit/
│   └── integration/
│
├── data/
│   └── vision.db
│
├── scripts/
│   ├── install.sh
│   └── migrate.sh
│
└── launchd/
    └── com.vision.agent.plist
```

---

## Deployment (macOS launchd)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "...">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.vision.agent</string>
    <key>ProgramArguments</key>
    <array>
        <string>/Users/admin/.local/bin/uv</string>
        <string>run</string>
        <string>python</string>
        <string>-m</string>
        <string>vision.main</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/Users/admin/projects/vision</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/Users/admin/Library/Logs/vision/stdout.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/admin/Library/Logs/vision/stderr.log</string>
</dict>
</plist>
```

---

## Review History

| Секция | Ревьюер | Оценка | Статус |
|--------|---------|--------|--------|
| Architecture | Architect Agent | 7/10 → fixed | ✅ |
| Data Model | DBA (15 лет опыта) | 6/10 → 8.5/10 | ✅ |
| Agent Loop | Senior Python Dev | 1/10 → fixed | ✅ |
| Onboarding | UX Panel (Nielsen, Walter, etc.) | 4.5/10 → redesigned | ✅ |
| Skills | FAANG Panel (Google, Meta, Stripe) | 4/10 → fixed | ✅ |

---

## Implementation Phases

### Phase 1: Core (Week 1-2)
- [ ] Project setup (uv, structure)
- [ ] SQLite + migrations
- [ ] Agent loop (graceful shutdown, error handling)
- [ ] Telegram MCP integration
- [ ] LLM client (Claude + OpenAI fallback)

### Phase 2: Skills (Week 3-4)
- [ ] content_gen skill
- [ ] idea_bank skill
- [ ] chat fallback
- [ ] Whisper integration (voice)
- [ ] Claude Vision integration (screenshots)

### Phase 3: Quality (Week 5)
- [ ] authenticity skill
- [ ] "why this works" explanations
- [ ] Router with pattern matching + LLM fallback

### Phase 4: Analytics (Week 6)
- [ ] autopsy skill
- [ ] dashboard skill
- [ ] post_metrics snapshots (cron)

### Phase 5: Polish (Week 7-8)
- [ ] Onboarding flow
- [ ] Bird CLI OAuth auto-refresh
- [ ] launchd deployment
- [ ] Tests

---

## Success Metrics

| Метрика | Target (Month 1) |
|---------|------------------|
| Uptime | >99% (no 403 errors) |
| Response time | <10s for content gen |
| Ideas captured | >50 via voice/screenshot |
| Posts generated | >30 |
| Time saved | >10 hours |

---

## Open Questions (для v2)

1. Кросс-платформа (LinkedIn, Threads) — как адаптировать контент?
2. Proactive mode — когда включать после earning permission?
3. Тренд-хантинг — какой источник данных?
4. Автопостинг — нужен ли scheduling?

---

*Document generated: 2026-02-02*
*Co-authored by Human + Claude Opus 4.5*
