# BIP Buddy Phase 1 — Verification Prompt

> Используй этот промпт в новой сессии для проверки реализации Фазы 1

## Промпт для верификации

```
Проверь реализацию Фазы 1 BIP Buddy (Twitter MIRROR).

Дизайн: docs/plans/2026-01-18-bip-buddy-upgrade-design.md

## Что должно быть реализовано

### 1. SQLite схема
- Файл: .ai/scripts/init-db.sh
- База: data/bip.db
- Таблицы: tweets, profile_snapshots, drafts, alerts_sent
- Проверь: запусти `sqlite3 data/bip.db ".tables"` и `.schema`

### 2. Twitter Mirror скрипт
- Файл: .ai/scripts/twitter-mirror.sh
- Функции:
  - Сбор профиля (followers/following) → profile_snapshots
  - Сбор твитов с метриками → tweets (INSERT/UPDATE)
  - Логирование дельт
- Проверь: запусти скрипт, посмотри логи и данные в БД

### 3. Launchd cron
- Файл: ~/Library/LaunchAgents/com.bipbuddy.twitter-mirror.plist
- Интервал: каждые 2 часа (7200 секунд)
- Проверь: `launchctl list | grep bipbuddy`

### 4. Telegram алерты
- Файл: .ai/scripts/twitter-alerts.sh
- Триггеры:
  - Твит +50 лайков за 2 часа → push
  - Фолловеры +10 за день → push
- Дедупликация через alerts_sent
- Проверь: запусти скрипт, посмотри логи

## Команды для проверки

```bash
# 1. Проверка таблиц
sqlite3 data/bip.db ".tables"
sqlite3 data/bip.db ".schema tweets"

# 2. Проверка данных
sqlite3 data/bip.db "SELECT COUNT(*) FROM tweets;"
sqlite3 data/bip.db "SELECT COUNT(*) FROM profile_snapshots;"
sqlite3 data/bip.db "SELECT * FROM profile_snapshots ORDER BY id DESC LIMIT 3;"

# 3. Тест mirror скрипта
.ai/scripts/twitter-mirror.sh

# 4. Тест alerts скрипта
.ai/scripts/twitter-alerts.sh

# 5. Проверка launchd
launchctl list | grep bipbuddy

# 6. Логи
cat /tmp/twitter-mirror.log | tail -20
```

## Критерии успеха

- [ ] Все 4 таблицы существуют с правильной схемой
- [ ] twitter-mirror.sh успешно собирает данные
- [ ] Данные появляются в tweets и profile_snapshots
- [ ] twitter-alerts.sh запускается без ошибок
- [ ] Launchd job загружен и активен
- [ ] Алерты используют дедупликацию (alerts_sent)

## Коммиты Фазы 1

```
71c51a2 fix: security and error handling in twitter-alerts.sh
3a12c9e feat: add Telegram alerts for Twitter activity
2056e19 fix: add numeric validation and cleanup trap to twitter-mirror.sh
abefbcf feat: add twitter-mirror.sh for tracking own tweets and profile metrics
5142a99 fix(db): apply code review fixes to init-db.sh
475135e feat: add SQLite schema initialization for BIP Buddy
bd0a79d docs: BIP Buddy upgrade design — Twitter Copilot
```
```

## Ожидаемые результаты

После проверки должен быть вывод:
- Таблицы: tweets, profile_snapshots, drafts, alerts_sent
- Данные в tweets: твиты с метриками (likes, replies, retweets, views)
- Данные в profile_snapshots: история followers/following
- Mirror скрипт: "Twitter mirror finished successfully"
- Alerts скрипт: "Twitter alerts check complete"
