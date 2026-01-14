# ClawdBot Session Handoff

**Дата**: 2026-01-14
**Статус**: Blocked — нужен Anthropic API key

---

## Что сделано

### 1. ClawdBot установлен
```bash
clawdbot --version  # 2026.1.13
```

### 2. Skill solobuddy создан
```
~/.clawdbot/skills/solobuddy/
├── SKILL.md           # Команды + inline buttons
├── prompts/
│   ├── profile.md     # Jester-Sage voice
│   ├── content.md     # Content generation
│   └── system.md      # System prompt
└── references/
    └── soul-wizard.md # 5-step soul creation wizard
```

### 3. Telegram бот настроен
- Token: `***REVOKED***`
- Bot: @solobuddybot
- Config: `~/.clawdbot/clawdbot.json`
- Gateway: running (daemon)
- Status: Telegram ON, OK

### 4. Конфигурация
```json
{
  "gateway": { "mode": "local" },
  "channels": {
    "telegram": {
      "enabled": true,
      "botToken": "8406923708:...",
      "capabilities": ["inlineButtons"],
      "dmPolicy": "open",
      "allowFrom": ["*"]
    }
  }
}
```

---

## Текущая проблема

При отправке сообщения боту:
```
⚠️ Agent failed before reply: No API key found for provider "anthropic"
```

**Причина**: ClawdBot использует Claude API для ответов, но API ключ не настроен.

---

## Что нужно сделать

### Вариант 1: Добавить Anthropic API key

```bash
# Через переменную окружения
export ANTHROPIC_API_KEY="sk-ant-..."

# Или в конфиг ~/.clawdbot/clawdbot.json
{
  "providers": {
    "anthropic": {
      "apiKey": "sk-ant-..."
    }
  }
}
```

Затем перезапустить:
```bash
clawdbot daemon restart
```

### Вариант 2: Использовать другую модель

ClawdBot поддерживает разные провайдеры (OpenAI, Gemini, etc.). Можно настроить другой.

```bash
clawdbot models list
clawdbot configure  # интерактивный wizard
```

---

## Полезные команды

```bash
# Статус
clawdbot status

# Логи
clawdbot logs --follow

# Проверить каналы
clawdbot channels status

# Dashboard
open http://127.0.0.1:18789/

# Перезапуск
clawdbot daemon restart
```

---

## Файлы проекта

| Что | Где |
|-----|-----|
| Skill | `~/.clawdbot/skills/solobuddy/` |
| Config | `~/.clawdbot/clawdbot.json` |
| Logs | `~/.clawdbot/logs/gateway.log` |
| Design doc | `docs/plans/2026-01-14-clawdbot-migration-design.md` |

---

## После fix API key

1. Написать боту "меню" — должны появиться кнопки
2. Проверить что skill solobuddy активируется
3. Протестировать backlog/drafts/generation flow
