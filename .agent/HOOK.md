# HOOK — Session Handoff

**Status:** IDLE ⚪
**Last updated:** 2026-01-22 14:15

---

## System Health (verified 2026-01-22)

### launchd Services ✅

| Service | Status | Interval |
|---------|--------|----------|
| `com.clawdbot.gateway` | ✅ Running (PID active) | постоянно |
| `com.bipbuddy.twitter-mirror` | ✅ Works | каждые 2ч |
| `com.clawdbot.twitter-monitor` | ✅ Works | по расписанию |

### ClawdBot (@solobuddybot) ✅

- Telegram bot active
- OAuth refreshed 2026-01-22 (expires ~7 days)
- Config: `~/.clawdbot/agents/main/agent/auth-profiles.json`

### Scripts ✅

| Script | Purpose | Last run |
|--------|---------|----------|
| `twitter-mirror.sh` | Мои твиты → DB | 2026-01-22 13:49 |
| `twitter-monitor.sh` | Watchlist → DB | 2026-01-22 13:31 |
| `twitter-alerts.sh` | Alerts → Telegram | after mirror |

---

## Known Issues

- В БД есть тестовые данные: `TEST_TWEET_001`
- Удалён `docs/plans/2026-01-18-bip-buddy-upgrade-design.md` (был в git)

---

## Quick Commands

```bash
# Проверка сервисов
launchctl list | grep -E "bip|clawdbot"

# Логи
tail -20 /tmp/twitter-mirror.log
tail -20 /tmp/twitter-monitor.log

# Ручной запуск
.ai/scripts/twitter-mirror.sh
.ai/scripts/twitter-alerts.sh

# ClawdBot
clawdbot doctor
clawdbot message send --channel telegram --to 6536979676 --message "Test"
```

---

## Session Notes

### 2026-01-22: Documentation Audit

1. **ClawdBot OAuth renewed** — токен истёк, обновили через `claude setup-token`
2. **MAIN.md updated** — актуальная архитектура с ClawdBot
3. **stack.md updated** — добавлена инструкция по перелогиниванию
4. **WORKFLOW.md → archive/** — ссылался на несуществующие файлы
5. **Папки clarified**: `.agent/` = AI context, `.ai/` = ClawdBot runtime
