# ClawdBot Session Handoff

**Дата**: 2026-01-14
**Статус**: ✅ Работает

---

## Что сделано

### 1. ClawdBot на подписке Claude Max
- OAuth токен через `claude setup-token`
- Работает через `anthropic:claude-cli` профиль
- Срок: 366 дней

### 2. Telegram бот работает
- Bot: @solobuddybot
- Токен: `[в ~/.clawdbot/clawdbot.json]`
- Status: running, polling

### 3. Персона настроена
- `~/clawd/SOUL.md` — Build in Public стратег-кореш
- `~/clawd/IDENTITY.md` — Солобади
- Тон: братишка в баре, без мотивашек

### 4. Skill solobuddy
- Путь: `~/.clawdbot/skills/solobuddy/`
- Data: `~/projects/bip-buddy/`

### 5. Безопасность
- Telegram токен отозван и обновлён
- Git история очищена через `git-filter-repo`

---

## Открытый вопрос

### hub/ — удалить или превратить в мини-апп?

**Текущее состояние:**
- ~50 файлов (Express + frontend)
- UI для контента (backlog, drafts, chat)
- Сейчас не используется — весь flow через Telegram

**Варианты:**

1. **Удалить** — всё через Telegram/ClawdBot
   - Pros: чище, KISS
   - Cons: теряем визуальный UI

2. **Telegram Mini App** — переделать hub в мини-апп внутри Telegram
   - Pros: визуальный UI + интеграция
   - Cons: работа по переделке

3. **Оставить как есть** — запускать когда нужен визуальный интерфейс
   - Pros: без работы
   - Cons: два интерфейса, путаница

**Решение:** _[следующая сессия]_

---

## Полезные команды

```bash
# Статус
clawdbot status

# Логи
clawdbot logs --follow

# Перезапуск
clawdbot daemon restart

# Персона
cat ~/clawd/SOUL.md

# Skill
cat ~/.clawdbot/skills/solobuddy/SKILL.md
```

---

## Файлы

| Что | Где |
|-----|-----|
| Персона | `~/clawd/SOUL.md`, `~/clawd/IDENTITY.md` |
| Skill | `~/.clawdbot/skills/solobuddy/` |
| Config | `~/.clawdbot/clawdbot.json` |
| Auth | `~/.clawdbot/agents/main/agent/auth-profiles.json` |
| Data | `~/projects/bip-buddy/` |
