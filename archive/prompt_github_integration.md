# 🔌 GitHub Integration — "Розетка проектов"

## Задача

Реализовать GitHub OAuth для автоматического обнаружения и подключения проектов к SoloBuddy.

---

## Конечный результат

1. Кнопка "Connect GitHub" в Hub
2. После OAuth — список всех репозиториев пользователя
3. Пользователь выбирает → проекты добавляются в `projects.json`
4. Buddy показывает расширенные инсайты (PRs, push/pull статус)

---

## Контекст

| Файл | Что там |
|------|---------|
| [implementation_plan.md](file:///Users/admin/.gemini/antigravity/brain/8192ee64-7d33-4ea0-9b96-a1bbaad0066d/implementation_plan.md) | Детальный план реализации |
| [living-buddy-concept.md](file:///Users/admin/projects/bip-buddy/ideas/living-buddy-concept.md) | Философия "живого компаньона" |
| [server.js](file:///Users/admin/projects/bip-buddy/hub/server.js) | Express сервер (добавить OAuth routes) |
| [watcher.js](file:///Users/admin/projects/bip-buddy/hub/watcher.js) | Git Watcher (расширить инсайтами) |
| [projects.json](file:///Users/admin/projects/bip-buddy/data/projects.json) | Текущий конфиг проектов |

---

## Порядок выполнения

### Phase 1: Подготовка
1. [ ] Установить зависимости: `dotenv`, `express-session`, `axios`
2. [ ] Создать `.env` с `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`

### Phase 2: OAuth Flow
3. [ ] Добавить `express-session` middleware в `server.js`
4. [ ] Реализовать `GET /auth/github` — редирект на GitHub
5. [ ] Реализовать `GET /auth/github/callback` — получение токена

### Phase 3: GitHub API
6. [ ] Создать `hub/github-api.js`:
   - `getUserRepos(token)` — список репозиториев
   - `matchLocalRepos(repos)` — поиск локальных путей
7. [ ] Добавить `GET /api/github/repos` endpoint

### Phase 4: UI
8. [ ] Добавить кнопку "Connect GitHub" в `index.html`
9. [ ] Создать модальное окно выбора репозиториев
10. [ ] Добавить стили в `styles.css`
11. [ ] Добавить логику в `app.js`

### Phase 5: Интеграция
12. [ ] Подключить выбранные репо к `projects.json`
13. [ ] Расширить `watcher.js` GitHub-инсайтами

---

## Ограничения

- **Не использовать webhooks** (пока) — только polling
- **Хранить токен в session** — не файлы
- **Rate limit**: 5000 req/hour с токеном
- **localhost:3000** — callback URL для dev

---

## GitHub OAuth App

Нужно создать на https://github.com/settings/developers:
- Application name: `SoloBuddy`
- Homepage URL: `http://localhost:3000`
- Callback URL: `http://localhost:3000/auth/github/callback`

---

## Запуск

```bash
cd /Users/admin/projects/bip-buddy/hub
npm install dotenv express-session axios
npm start
```

---

## Критерий успеха

После OAuth пользователь видит свои GitHub репозитории и может подключить их одним кликом.
