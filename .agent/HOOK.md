# HOOK — Vision v1

**Status:** ACTIVE
**Updated:** 2026-02-02
**Version:** 1.0

---

## Что есть

**Архитектура (финальная):**
```
Telegram ←→ Claude Code (подписка Max) ←→ Vision Skills
```

Claude Code = Vision. Не нужен отдельный daemon, ngrok, или сложные решения. Просто открытый терминал с Claude Code.

**Готово:**
- `vision/skills/idea_bank.py` — CLI для CRUD идей ✅
- Промпты: system.md, content.md, twitter.md, humanizer.md ✅
- Database с миграциями ✅
- Telegram MCP работает ✅

---

## Использование

```bash
# Добавить идею
uv run python -m vision.skills.idea_bank add "Моя идея"

# Список идей
uv run python -m vision.skills.idea_bank list

# Поиск
uv run python -m vision.skills.idea_bank search "ключевое слово"
```

---

## Next: Phase 2 Skills

- [ ] `vision/skills/content_gen.py` — генерация контента по промптам
- [ ] Whisper интеграция (голос → идея)
- [ ] Claude Vision (скриншот → идея)

---

## Решения сессии 2026-02-02

1. **OAuth заблокирован** — Anthropic закрыла лазейку в январе 2026
2. **Claude-Code-Remote не нужен** — текущая архитектура проще и работает
3. **Claude Code в фоне — ок** — не тратит ресурсы пока ждёт

---

*Last updated: 2026-02-02*
