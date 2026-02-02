# Prompt 2: Start Integration

> Используй ПОСЛЕ warmup-context, когда готов начать работу

---

## Промпт:

```
Отлично, контекст загружен. Начинаем интеграцию Vision.

Выполни Pre-flight Checklist из HOOK.md:

1. Создай структуру `vision/` со всеми папками
2. Инициализируй `pyproject.toml` через uv
3. Добавь зависимости: anthropic, openai, structlog, aiosqlite
4. Скопируй промпты из solobuddy в vision/prompts/
5. Создай миграцию `002_vision_tables.sql`
6. Начни с `vision/core/protocols.py` — typed contracts

После каждого шага показывай что сделал.
Используй TodoWrite для трекинга прогресса.

Погнали!
```

---

## Ожидаемые действия:

### Шаг 1: Структура
```bash
mkdir -p vision/{core,skills,llm/providers,integrations/{telegram,twitter,whisper},data/{migrations,repositories},prompts,utils}
touch vision/__init__.py
```

### Шаг 2: Python проект
```bash
uv init --name bip-buddy
uv add anthropic openai structlog aiosqlite
```

### Шаг 3: Промпты
```bash
cp .ai/skills/solobuddy/prompts/system.md vision/prompts/
cp .ai/skills/solobuddy/prompts/content.md vision/prompts/
cp .ai/skills/solobuddy/modules/twitter-expert.md vision/prompts/twitter.md
cp .ai/skills/solobuddy/references/humanizer.md vision/prompts/
```

### Шаг 4: Миграция
Создаёт `vision/data/migrations/002_vision_tables.sql` с таблицами:
- assistant_profile
- memory
- ideas
- conversations
- authenticity_checks
- post_metrics

### Шаг 5: Protocols
Создаёт `vision/core/protocols.py`:
```python
from typing import Protocol, Literal
from dataclasses import dataclass

@dataclass
class SkillResult:
    response: str
    status: Literal["success", "partial", "error"]
    ...

class Skill(Protocol):
    async def execute(self, context, llm, request_id) -> SkillResult:
        ...
```

---

## Контрольные точки:

После выполнения должно быть:

```
bip-buddy/
├── vision/
│   ├── __init__.py
│   ├── core/
│   │   └── protocols.py ✅
│   ├── data/
│   │   └── migrations/
│   │       └── 002_vision_tables.sql ✅
│   ├── prompts/
│   │   ├── system.md ✅
│   │   ├── content.md ✅
│   │   ├── twitter.md ✅
│   │   └── humanizer.md ✅
│   └── ...
├── pyproject.toml ✅
└── uv.lock ✅
```

---

## Если что-то пойдёт не так:

- uv не установлен → `curl -LsSf https://astral.sh/uv/install.sh | sh`
- Промпты не найдены → проверь `.ai/skills/solobuddy/`
- Миграция не применяется → сначала создать, потом применить отдельно
