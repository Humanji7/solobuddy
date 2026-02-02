# Session: Claude OAuth + Phase 2 Skills

Продолжаем работу над Vision.

## Контекст
Phase 1 (Core) завершена. Vision запускается, но требует API ключи.

## Задачи сессии

### 1. Claude OAuth (приоритет)
Хотим использовать Claude через подписку вместо API для экономии.

Нужно:
- Исследовать как claude.ai авторизует (OAuth2 flow)
- Реализовать `vision/llm/providers/claude_oauth.py`
- Хранить токены в macOS Keychain (через `keyring`)
- Auto-refresh при истечении
- Интегрировать как primary provider в `LLMClient`

### 2. Phase 2: Skills (после OAuth)
- `vision/skills/content_gen.py` — генерация постов/твитов
- `vision/skills/idea_bank.py` — CRUD для идей

## Проверка текущего состояния

```bash
cat .agent/HOOK.md
uv run python -m vision.main
```

## Начни с:
1. Прочитай `.agent/HOOK.md` для полного контекста
2. Исследуй Claude OAuth (веб-поиск если нужно)
3. Предложи план реализации

НЕ начинай кодить пока не подтвержу план.
