# Intelligence Tiering: Design Document

> SoloBuddy v2 — оптимизация модельной архитектуры

**Статус**: Draft
**Дата**: 2026-01-18
**Автор**: Human + Claude

---

## Проблема

SoloBuddy использует Opus для всех задач — от простой классификации SEND/SKIP до генерации контента. Это неэффективно:

- **L2 Gate**: Opus анализирует 5 твитов каждые 30 мин → ~48 вызовов/день
- **Диалог**: Каждое сообщение → Opus
- **Стоимость**: Opus ~15x дороже Haiku, ~5x дороже Sonnet

## Цель

Снизить расходы на 70-80% без потери качества через маршрутизацию задач на подходящие модели.

---

## Текущая архитектура

```
┌─────────────────────────────────────────────────────────────┐
│  TWITTER PIPELINE                                           │
├─────────────────────────────────────────────────────────────┤
│  Cron (30 min)                                              │
│       ↓                                                     │
│  bird CLI → fetch 25 tweets from watchlist                  │
│       ↓                                                     │
│  L1 Gate (jq)                                    [FREE]     │
│  - likes >= 100                                             │
│  - age <= 2h                                                │
│  - replies <= 20                                            │
│  - no corporate accounts                                    │
│  - no hiring posts                                          │
│       ↓                                                     │
│  L2 Gate (ClawdBot agent)                        [OPUS]     │
│  - SEND/SKIP verdict                                        │
│  - если SEND → анализ + драфты комментов                    │
│       ↓                                                     │
│  Telegram delivery                                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  DIALOG (Telegram)                                          │
├─────────────────────────────────────────────────────────────┤
│  User message → ClawdBot agent                   [OPUS]     │
│       ↓                                                     │
│  Jester-Sage response                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Целевая архитектура

### Принцип: Right Model for Right Task

| Уровень | Модель | Когда использовать |
|---------|--------|-------------------|
| **Tier 0** | jq/regex | Детерминированные правила |
| **Tier 1** | Haiku | Классификация, простые решения |
| **Tier 2** | Sonnet | Анализ, генерация, большинство диалогов |
| **Tier 3** | Opus | Сложные рассуждения, стратегия, креатив высшего уровня |

### Twitter Pipeline v2

```
┌─────────────────────────────────────────────────────────────┐
│  TWITTER PIPELINE v2                                        │
├─────────────────────────────────────────────────────────────┤
│  Cron (30 min)                                              │
│       ↓                                                     │
│  bird CLI → fetch tweets                                    │
│       ↓                                                     │
│  L1 Gate (jq)                                    [TIER 0]   │
│  - без изменений                                            │
│       ↓                                                     │
│  L2 Gate: Classification                         [TIER 1]   │  ← NEW
│  - Haiku: SEND/SKIP verdict only                            │
│  - Structured output (JSON)                                 │
│  - Если SKIP → done                                         │
│       ↓                                                     │
│  L3 Gate: Analysis                               [TIER 2]   │  ← NEW
│  - Sonnet: глубокий анализ твитов                           │
│  - Генерация драфтов комментов                              │
│  - Jester-Sage voice                                        │
│       ↓                                                     │
│  Telegram delivery                                          │
└─────────────────────────────────────────────────────────────┘
```

### Dialog v2

```
┌─────────────────────────────────────────────────────────────┐
│  DIALOG v2                                                  │
├─────────────────────────────────────────────────────────────┤
│  User message                                               │
│       ↓                                                     │
│  Router (Haiku)                                  [TIER 1]   │  ← NEW
│  - Классификация: simple/complex/creative                   │
│       ↓                                                     │
│  ┌─────────────┬─────────────┬─────────────┐               │
│  │   SIMPLE    │   COMPLEX   │  CREATIVE   │               │
│  │   Sonnet    │   Sonnet    │    Opus     │               │
│  │  [TIER 2]   │  [TIER 2]   │  [TIER 3]   │               │
│  └─────────────┴─────────────┴─────────────┘               │
│       ↓                                                     │
│  Response                                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Реализация

### Фаза 1: Twitter Pipeline (приоритет)

**1.1 Разделить L2 на Classification + Analysis**

Текущий `twitter-analyze.sh` вызывает ClawdBot один раз для всего.
Нужно:
- Первый вызов (Haiku): только SEND/SKIP
- Второй вызов (Sonnet): анализ если SEND

**1.2 Конфигурация моделей в ClawdBot**

```bash
# Вариант A: через clawdbot CLI
clawdbot models set haiku --alias classifier
clawdbot models set sonnet --alias analyst

# Вариант B: через конфиг
# ~/.clawdbot/clawdbot.json
{
  "models": {
    "aliases": {
      "classifier": "anthropic/claude-3-5-haiku",
      "analyst": "anthropic/claude-sonnet-4"
    }
  }
}
```

**1.3 Обновить twitter-analyze.sh**

```bash
# L2: Classification (Haiku)
verdict=$(clawdbot agent \
    --model classifier \
    --message "SEND or SKIP? Tweets: $TOP_TWEETS" \
    --json)

if verdict == "SEND"; then
    # L3: Analysis (Sonnet)
    analysis=$(clawdbot agent \
        --model analyst \
        --message "Analyze for engagement: $TOP_TWEETS")
fi
```

### Фаза 2: Dialog Router

**2.1 Intent Classification Prompt (Haiku)**

```
Classify user intent:
- SIMPLE: greetings, status checks, simple questions
- COMPLEX: analysis, debugging, multi-step tasks
- CREATIVE: content creation, voice work, strategy

Output JSON: {"intent": "SIMPLE|COMPLEX|CREATIVE"}
```

**2.2 Model Routing Logic**

| Intent | Model | Rationale |
|--------|-------|-----------|
| SIMPLE | Sonnet | Достаточно для простых ответов |
| COMPLEX | Sonnet | Sonnet справляется с анализом |
| CREATIVE | Opus | Jester-Sage voice требует глубины |

### Фаза 3: Metrics & Tuning

- Логировать: задача → модель → latency → качество
- A/B тесты: Sonnet vs Opus для CREATIVE
- Tune thresholds на основе данных

---

## Оценка экономии

| Компонент | Вызовов/день | Сейчас | После | Экономия |
|-----------|--------------|--------|-------|----------|
| L2 Classification | ~48 | Opus | Haiku | ~95% |
| L3 Analysis | ~10 (если SEND) | Opus | Sonnet | ~80% |
| Dialog (simple) | ~20 | Opus | Sonnet | ~80% |
| Dialog (creative) | ~5 | Opus | Opus | 0% |

**Общая экономия**: ~75-80%

---

## Риски и митигация

| Риск | Митигация |
|------|-----------|
| Haiku пропускает хорошие твиты | Консервативный threshold, логирование для анализа |
| Sonnet теряет Jester-Sage voice | Explicit voice prompt, примеры в контексте |
| Router overhead | Кешировать intent для сессии |
| ClawdBot не поддерживает multi-model | Fallback: два отдельных вызова через CLI |

---

## Открытые вопросы (RESOLVED)

1. **ClawdBot multi-model**: ✅ Поддерживает через `models aliases`
2. **Haiku доступность**: ✅ Все модели доступны через Anthropic OAuth:
   - `anthropic/claude-haiku-4-5` (Tier 1)
   - `anthropic/claude-sonnet-4-5` (Tier 2)
   - `anthropic/claude-opus-4-5` (Tier 3, current default)
3. **Session context**: Передавать через prompt (stateless между tier'ами)
4. **Fallback strategy**: `clawdbot models fallbacks` для автоматического fallback

---

## Следующие шаги

- [ ] Проверить ClawdBot multi-model support
- [ ] Настроить доступ к Haiku/Sonnet
- [ ] Реализовать Фазу 1 (Twitter Pipeline)
- [ ] Тестировать на реальных данных
- [ ] Реализовать Фазу 2 (Dialog Router)
- [ ] Настроить метрики

---

## Appendix: ClawdBot Model Commands

```bash
# Список моделей
clawdbot models list --all | grep anthropic

# Установить default
clawdbot models set anthropic/claude-sonnet-4-5

# Алиасы для Intelligence Tiering
clawdbot models aliases add classifier anthropic/claude-haiku-4-5
clawdbot models aliases add analyst anthropic/claude-sonnet-4-5
clawdbot models aliases add creative anthropic/claude-opus-4-5

# Fallbacks
clawdbot models fallbacks add anthropic/claude-sonnet-4-5
clawdbot models fallbacks add anthropic/claude-haiku-4-5
```

## Appendix: Model Pricing Reference (2026)

| Model | Input (1M tokens) | Output (1M tokens) | Relative Cost |
|-------|-------------------|--------------------| --------------|
| Haiku 4.5 | $1 | $5 | 1x (baseline) |
| Sonnet 4.5 | $3 | $15 | ~3x |
| Opus 4.5 | $15 | $75 | ~15x |
