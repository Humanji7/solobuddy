# Debug: GitHub Connect Repositories Error

## Задача

Найти и исправить причину ошибки "Failed to connect repositories" при подключении GitHub репозиториев.

---

## Контекст

- OAuth flow работает корректно (токен получен)
- Список репозиториев загружается
- Ошибка возникает при `POST /api/github/connect`

## Файлы для анализа

1. [server.js](file:///Users/admin/projects/bip-buddy/hub/server.js) — route `POST /api/github/connect` (~line 450)
2. [github-api.js](file:///Users/admin/projects/bip-buddy/hub/github-api.js) — функция `addProjectsToConfig`
3. [app.js](file:///Users/admin/projects/bip-buddy/hub/app.js) — функция `connectSelectedRepos`

---

## Порядок диагностики

1. Запустить сервер с дебаг-логами:
   ```bash
   cd /Users/admin/projects/bip-buddy/hub && npm start
   ```

2. Открыть http://localhost:3000 в браузере

3. Подключить GitHub, выбрать репозитории, нажать "Connect Selected"

4. Проверить:
   - Console в браузере (DevTools → Console)
   - Терминал с сервером (server logs)
   - Network tab (запрос и ответ `/api/github/connect`)

5. Возможные причины:
   - Неправильный формат `repos` в теле запроса
   - Ошибка записи в `data/projects.json`
   - Отсутствует директория `data/`
   - Проблема с `localPath` matching

---

## После исправления

- Проверить успешное добавление в `data/projects.json`
- Обновить HANDOFF_GITHUB_OAUTH.md со статусом ✅
