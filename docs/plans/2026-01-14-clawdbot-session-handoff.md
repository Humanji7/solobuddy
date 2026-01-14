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

### 6. Activity Snapshot (NEW)
- `hub/watcher.js` — добавлен `exportActivitySnapshot()`
- `hub/scripts/update-activity-snapshot.js` — cron скрипт
- `data/activity-snapshot.json` — обновляется каждый час
- Launchd agent: `com.solobuddy.activity-snapshot`
- Skill обновлён — команда "активность", кнопка 📊

**ClawdBot теперь знает:**
- Сколько дней проект молчит (`daysSilent`)
- Коммиты сегодня/вчера/неделя
- Фаза проекта: active/momentum/cooling/silent/dormant

---

## Решённые вопросы

### hub/ — удалить или Mini App?

**Решение: Ни то, ни другое.**

Hub остаётся как **data layer**:
- `watcher.js` генерирует контекст активности
- ClawdBot читает `activity-snapshot.json`
- UI не нужен — всё через Telegram

Можно в будущем:
- Удалить frontend файлы (`index.html`, `styles.css`)
- Оставить только `watcher.js`, `config.js`, `scripts/`

---

## Полезные команды

```bash
# Статус ClawdBot
clawdbot status

# Логи
clawdbot logs --follow

# Перезапуск
clawdbot daemon restart

# Персона
cat ~/clawd/SOUL.md

# Skill
cat ~/.clawdbot/skills/solobuddy/SKILL.md

# Activity snapshot (ручной запуск)
node ~/projects/bip-buddy/hub/scripts/update-activity-snapshot.js

# Launchd agent
launchctl list | grep solobuddy
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
| Activity | `~/projects/bip-buddy/data/activity-snapshot.json` |
| Launchd | `~/Library/LaunchAgents/com.solobuddy.activity-snapshot.plist` |

---

## Следующие шаги (backlog)

- [ ] Twitter extension (`solobuddy-twitter`) — мониторинг watchlist
- [ ] Soul wizard через Telegram кнопки
- [ ] Two-agent consultation ("спроси у sphere")
- [ ] Cleanup hub/ frontend файлов (опционально)
