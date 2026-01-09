# HANDOFF: Local Projects Connector

## ✅ Завершено (2026-01-09)

### Backend (`hub/github-api.js`)
- `scanLocalProjects()` — сканирует `~/projects`, `~/dev`, `~/code`, `~/Sites`
- `addLocalProjectsToConfig()` — добавляет проекты в `projects.json`
- Фильтрует уже отслеживаемые, сортирует (remote first)

### API (`hub/server.js`)
- `GET /api/local/scan` — возвращает список локальных Git-проектов
- `POST /api/local/connect` — добавляет выбранные в мониторинг

### Frontend
- Кнопка "📁 Add Local" в `index.html`
- Модальное окно с чекбоксами
- JS-логика в `app.js` (аналогично GitHub Connect)
- CSS для `.btn-local`, `.github-badge`, `.local-only-badge`

## ⚠️ Известные ограничения

**GitHub поле не обновляется автоматически:**
- Если добавить локальный проект без remote, `github: null`
- После пуша на GitHub поле остаётся `null`
- Нужна следующая фича: автообновление при сканировании

## Следующий шаг

→ [prompt_github_field_autoupdate.md](file:///Users/admin/projects/bip-buddy/prompt_github_field_autoupdate.md)
