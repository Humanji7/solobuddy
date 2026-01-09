# 🔌 Реализация GitHub Integration

## Задача

Реализовать GitHub OAuth для автоматического обнаружения репозиториев в SoloBuddy Hub.

---

## Контекст

| Файл | Описание |
|------|----------|
| [implementation_plan.md](file:///Users/admin/.gemini/antigravity/brain/850ff434-5a09-4fb5-8475-547302e1fbc2/implementation_plan.md) | Полный план реализации |
| [server.js](file:///Users/admin/projects/bip-buddy/hub/server.js) | Express сервер — добавить OAuth routes |
| [index.html](file:///Users/admin/projects/bip-buddy/hub/index.html) | UI — добавить кнопку и модал |
| [app.js](file:///Users/admin/projects/bip-buddy/hub/app.js) | Frontend логика |
| [styles.css](file:///Users/admin/projects/bip-buddy/hub/styles.css) | Стили |
| [projects.json](file:///Users/admin/projects/bip-buddy/data/projects.json) | Конфиг проектов |

---

## Порядок выполнения

### 1. Подготовка

```bash
cd /Users/admin/projects/bip-buddy/hub
npm install dotenv express-session axios
```

Создать `.env.example`:
```env
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
SESSION_SECRET=
```

### 2. Backend: OAuth Flow (server.js)

Добавить в начало файла:
- `require('dotenv').config()`
- `express-session` middleware
- Загрузку `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`

Добавить routes:
- `GET /auth/github` → редирект на GitHub OAuth
- `GET /auth/github/callback` → обмен code на token, сохранение в session
- `GET /api/github/status` → проверка авторизации

### 3. Backend: GitHub API (новый файл)

Создать `hub/github-api.js`:

```javascript
// getUserRepos(token) — получить все репо пользователя
// matchLocalRepos(repos) — найти локальные пути
// addProjectsToConfig(projects) — добавить в projects.json
```

Добавить в `server.js`:
- `GET /api/github/repos` — список репо
- `POST /api/github/connect` — добавить выбранные в `projects.json`

### 4. Frontend: UI

В `index.html` header добавить:
```html
<button id="github-connect-btn" class="btn-github">🐙 Connect GitHub</button>
```

Добавить модал для выбора репозиториев.

В `app.js` добавить:
- `checkGitHubStatus()` — обновить кнопку
- `loadReposList()` — загрузить список репо
- `connectSelectedRepos()` — подключить выбранные

### 5. Стили (styles.css)

Добавить стили для `.btn-github`, `.repo-item`, `.modal-large`.

---

## Ограничения

- Token хранить только в session (не в файлах)
- Polling вместо webhooks
- Rate limit: 5000 req/hour

---

## Верификация

1. Запустить сервер: `npm start`
2. Открыть http://localhost:3000
3. Нажать "Connect GitHub"
4. Авторизоваться на GitHub
5. Выбрать репозитории
6. Проверить `projects.json`

---

## Критерий успеха

После OAuth пользователь видит свои GitHub репозитории и может подключить их одним кликом.
