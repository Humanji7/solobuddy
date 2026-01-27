# ТЗ: Установка и настройка Lobster для ClawdBot

> Самодостаточная спецификация. Выполнять в директории: `/Users/admin/projects/bip-buddy`
> Окружение: macOS, pnpm, Node LTS

---

## Контекст

**ClawdBot** — AI-ассистент, работает как Telegram-бот ("Солобади").
**Lobster** — workflow shell для ClawdBot. Typed pipelines с approval gates.
**Репо Lobster:** https://github.com/clawdbot/lobster

Сейчас:
- ClawdBot установлен и работает
- Конфиг: `~/.clawdbot/clawdbot.json`
- Lobster НЕ установлен, НЕ подключён
- В проекте уже есть 2 pipeline-файла:
  - `.ai/workflows/multi-platform-post.lobster`
  - `.ai/workflows/cross-platform-report.lobster`

---

## Задача

Установить Lobster CLI, подключить к ClawdBot, убедиться что пайплайны исполняемы.

---

## Шаг 1: Установить Lobster CLI

```bash
# Клонировать репо (рядом с bip-buddy, не внутрь)
cd /Users/admin/projects
git clone https://github.com/clawdbot/lobster.git
cd lobster
pnpm install
```

Проверить что бинарник работает:
```bash
node ./bin/lobster.js --help
```

### Сделать доступным глобально

Вариант A — symlink (предпочтительно):
```bash
ln -sf /Users/admin/projects/lobster/bin/lobster.js /usr/local/bin/lobster
```

Вариант B — если lobster предоставляет npm-пакет:
```bash
pnpm install -g @clawdbot/lobster
```

Проверка:
```bash
which lobster
lobster --help
```

Если `lobster` не найден после symlink — проверить что `/usr/local/bin` в PATH, или использовать абсолютный путь через `lobsterPath` в конфиге (Шаг 2).

---

## Шаг 2: Подключить Lobster к ClawdBot

Отредактировать `~/.clawdbot/clawdbot.json`.

**Текущий конфиг:**
```json
{
  "wizard": { ... },
  "browser": { "headless": true },
  "agents": {
    "list": [
      {
        "id": "main",
        "identity": {
          "name": "Солобади",
          "theme": "",
          "emoji": ""
        }
      }
    ]
  },
  "messages": { "ackReactionScope": "group-mentions" },
  "commands": { "native": "auto" },
  "channels": {
    "telegram": {
      "capabilities": ["inlineButtons"],
      "enabled": true,
      "dmPolicy": "allowlist",
      "botToken": "...",
      "allowFrom": ["6536979676"],
      "groupPolicy": "allowlist",
      "streamMode": "partial"
    }
  },
  "gateway": { "mode": "local" },
  "solobuddy": { "dataPath": "/Users/admin/projects/bip-buddy" },
  "twitter": { ... }
}
```

**Что добавить** — ключ `tools` на верхнем уровне:

```json
{
  "tools": {
    "alsoAllow": ["lobster"]
  }
}
```

Если `lobster` не в PATH, добавить абсолютный путь:

```json
{
  "tools": {
    "alsoAllow": ["lobster"]
  },
  "lobster": {
    "lobsterPath": "/Users/admin/projects/lobster/bin/lobster.js"
  }
}
```

**ВАЖНО:**
- Использовать `alsoAllow`, а НЕ `allow` — иначе отключатся core tools
- НЕ менять остальные поля конфига
- НЕ трогать botToken, allowFrom и прочие секреты

---

## Шаг 3: Проверить что Lobster видит пайплайны

```bash
lobster run /Users/admin/projects/bip-buddy/.ai/workflows/multi-platform-post.lobster --help
```

Или:
```bash
lobster doctor
```

---

## Шаг 4: Валидация пайплайнов

Текущие пайплайны используют команды вроде `solobuddy generate --json`, `twitter-expert adapt --json`. Это скиллы ClawdBot, а не bash-команды.

Проверить как Lobster вызывает скиллы ClawdBot. Согласно документации, Lobster — subprocess-based. Если скиллы вызываются через `clawd invoke`:

```bash
# Примерный формат (уточнить по доке)
clawd invoke --tool solobuddy --action generate --args-json '{"idea":"test"}'
```

Если команды в `.lobster` файлах не совпадают с реальным API вызова скиллов — **поправить команды в обоих файлах**:
- `.ai/workflows/multi-platform-post.lobster`
- `.ai/workflows/cross-platform-report.lobster`

### Что проверить в multi-platform-post.lobster:

1. `command: solobuddy generate --json` — как на самом деле вызвать скилл solobuddy из CLI?
2. `command: twitter-expert adapt --json` — как вызвать модуль скилла?
3. `command: approve --preview-from-stdin` — это встроенная команда Lobster, должна работать as-is
4. `condition: $args.platforms contains "twitter"` — проверить что этот синтаксис поддерживается

### Что проверить в cross-platform-report.lobster:

1. `command: twitter-mirror report --json` — это bash-скрипт `.ai/scripts/twitter-mirror.sh` или команда ClawdBot?
2. `command: analytics aggregate --json` — этой команды НЕ существует, нужно либо создать, либо убрать шаг
3. `command: clawdbot message send` — проверить точный синтаксис CLI

---

## Шаг 5: Тестовый прогон

После настройки — запустить тестовый пайплайн:

```bash
lobster run /Users/admin/projects/bip-buddy/.ai/workflows/multi-platform-post.lobster \
  --args-json '{"idea":"тестовый пост для проверки пайплайна","platforms":"twitter"}'
```

Ожидаемый результат:
- Pipeline стартует
- Шаг `generate` отрабатывает
- Шаг `humanize` отрабатывает
- Шаг `adapt-twitter` отрабатывает (condition match)
- Шаг `review` паузит pipeline → `needs_approval` + `resumeToken`
- Остальные adapt-шаги скипнуты (condition не match)

---

## Шаг 6: Рестарт ClawdBot Gateway

После изменения `clawdbot.json`:

```bash
# Узнать как рестартить gateway
clawdbot gateway restart
# или
launchctl kickstart -k gui/$(id -u)/com.clawdbot.gateway
# или просто перезапустить процесс
```

---

## Порядок выполнения

1. Клонировать и установить Lobster CLI
2. Проверить `lobster --help`
3. Добавить `tools.alsoAllow` в `~/.clawdbot/clawdbot.json`
4. Проверить/поправить команды в `.lobster` файлах под реальный API
5. Рестартнуть ClawdBot Gateway
6. Тестовый прогон пайплайна
7. Коммит изменений: `feat: integrate lobster workflow engine`

---

## Чего НЕ делать

- НЕ менять `.ai/skills/` — эксперты уже готовы
- НЕ менять botToken и другие секреты в clawdbot.json
- НЕ использовать `tools.allow` вместо `tools.alsoAllow`
- НЕ устанавливать Lobster внутрь bip-buddy — это отдельный проект
- НЕ создавать новые скрипты — задача только про интеграцию Lobster

---

## Файлы которые будут изменены

```
~/.clawdbot/clawdbot.json                              # EDIT — добавить tools.alsoAllow
.ai/workflows/multi-platform-post.lobster              # ВОЗМОЖНО EDIT — если команды не совпадают с API
.ai/workflows/cross-platform-report.lobster            # ВОЗМОЖНО EDIT — если команды не совпадают с API
```
