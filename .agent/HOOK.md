# HOOK — Session Handoff

**Status:** IDLE
**Last updated:** 2026-01-29 21:30

---

## System Health (verified 2026-01-29)

### launchd Services

| Service | Status | Interval |
|---------|--------|----------|
| `com.clawdbot.gateway` | Running | постоянно |
| `com.bipbuddy.twitter-mirror` | Works | каждые 2ч |
| `com.clawdbot.twitter-monitor` | Works | по расписанию |

### ClawdBot (@solobuddybot)

- Telegram bot active (`clawdbot health` = ok)
- OAuth refreshed 2026-01-29 (token valid 1 year)
- Config: `~/.clawdbot/agents/main/agent/auth-profiles.json`
- Telegram token rotated 2026-01-29

---

## Session Notes

### 2026-01-29: Security Audit & Fixes

**Проблема:** OAuth токен Anthropic истёк, бот не работал.

**Root cause:** `clawdbot models auth add` создал `mode: "token"` который ищет ANTHROPIC_API_KEY в ENV, но launchd plist не содержал эту переменную.

**Исправлено:**
1. Добавлен ANTHROPIC_API_KEY в `~/Library/LaunchAgents/com.clawdbot.gateway.plist`
2. Gateway перезапущен — бот заработал

**Security Audit выполнен:**

| Категория | Статус |
|-----------|--------|
| macOS Firewall | Включён + stealth mode |
| SMB Guest Access | Отключён |
| Screen Lock | Настроен (пароль сразу) |
| plist permissions | Исправлены (600) |
| .env с секретами | Удалён |
| TRASH/ со старыми секретами | Удалён |

**Ротация токенов:**

| Токен | Статус | Хранение |
|-------|--------|----------|
| GROQ API Key | Ротирован | macOS Keychain (`bip-buddy/groq-api-key`) |
| GitHub OAuth | Ротирован | macOS Keychain (`bip-buddy/github-client-*`) |
| Telegram Bot | Ротирован | `~/.clawdbot/clawdbot.json` |
| Anthropic OAuth | Был обновлён ранее | `auth-profiles.json` + launchd plist |

**Осталось:**
- [x] Удалить временный `.env` — удалён 2026-01-29
- [ ] Очистить git историю от старых токенов (опционально, если репо публичное)

---

## Quick Commands

```bash
# Проверка безопасности
/usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate
ls -la ~/Library/LaunchAgents/com.clawdbot.gateway.plist

# ClawdBot
clawdbot health
clawdbot models status

# Keychain credentials
security find-generic-password -s "bip-buddy" -a "groq-api-key" -w
security find-generic-password -s "bip-buddy" -a "github-client-secret" -w

# Логи
tail -20 ~/.clawdbot/logs/gateway.log
tail -20 ~/.clawdbot/logs/gateway.err.log
```

---

## Known Issues

- В БД есть тестовые данные: `TEST_TWEET_001`
- Git история содержит старые токены (коммиты `5f17505`, `7cc4942`, `b141ff8`) — требует очистки если репо публичное
