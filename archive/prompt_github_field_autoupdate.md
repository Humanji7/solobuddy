# Auto-Update GitHub Field for Local Projects

## Цель

Автоматически обновлять поле `github` в `projects.json` для проектов, у которых оно `null`, но появился remote URL.

---

## Контекст

При добавлении чисто локального проекта через "📁 Add Local":
```json
{ "name": "my-project", "path": "/path/to/project", "github": null }
```

После `git remote add origin` и push — поле остаётся `null`.

---

## План реализации

### Шаг 1: Функция проверки remote

**Файл**: [github-api.js](file:///Users/admin/projects/bip-buddy/hub/github-api.js)

Добавь функцию `updateProjectRemotes()`:
- Читает `projects.json`
- Для проектов с `github: null` проверяет `git remote get-url origin`
- Если remote появился — обновляет поле
- Записывает обратно

```javascript
async function updateProjectRemotes() {
    // 1. Прочитать projects.json
    // 2. Фильтровать проекты с github: null
    // 3. Для каждого вызвать getGitRemoteUrl(path)
    // 4. Если есть remote — обновить объект
    // 5. Записать если были изменения
    // Вернуть количество обновлённых
}
```

### Шаг 2: Интеграция в watcher

**Файл**: [watcher.js](file:///Users/admin/projects/bip-buddy/hub/watcher.js)

В функции `getBuddyMessage()` вызывать `updateProjectRemotes()` при каждом запросе buddy-сообщения.

### Шаг 3: (Опционально) API endpoint

```javascript
app.post('/api/projects/refresh-remotes', ...)
```

---

## Проверка

```bash
# 1. Добавить локальный проект без remote
# 2. Проверить projects.json — github: null
# 3. Сделать git remote add origin ... && git push
# 4. Обновить страницу Hub
# 5. Проверить projects.json — github: "https://..."
```
