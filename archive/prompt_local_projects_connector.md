# Implement Local Projects Connector

## Цель

Добавить кнопку **"📁 Add Local"** для обнаружения и подключения локальных Git-проектов.

---

## План реализации

Полный план: [implementation_plan.md](file:///Users/admin/.gemini/antigravity/brain/be01bdcc-8e1c-4a19-9731-e7c607255050/implementation_plan.md)

---

## Шаг 1: Backend — github-api.js

**Файл**: [github-api.js](file:///Users/admin/projects/bip-buddy/hub/github-api.js)

Добавь функцию `scanLocalProjects()`:
- Сканирует: `~/projects`, `~/dev`, `~/code`, `~/Sites`
- Для каждой папки с `.git` возвращает: `{ name, path, hasGit, remoteUrl }`
- Исключает проекты, уже существующие в `projects.json`
- Сортировка: сначала с remote, затем по имени

Экспортируй функцию в `module.exports`.

---

## Шаг 2: Backend — server.js

**Файл**: [server.js](file:///Users/admin/projects/bip-buddy/hub/server.js)

Добавь 2 endpoint'а после существующих GitHub routes (~line 490):

```javascript
// GET /api/local/scan
app.get('/api/local/scan', async (req, res) => { ... });

// POST /api/local/connect
app.post('/api/local/connect', async (req, res) => { ... });
```

---

## Шаг 3: Frontend — index.html

**Файл**: [index.html](file:///Users/admin/projects/bip-buddy/hub/index.html)

1. Добавь кнопку в `header-actions` (line 25):
```html
<button id="local-connect-btn" class="btn-local">📁 Add Local</button>
```

2. Добавь модальное окно после `github-repos-modal` (line 121):
```html
<div class="modal" id="local-repos-modal">...</div>
```

Используй структуру `github-repos-modal` как шаблон.

---

## Шаг 4: Frontend — app.js

**Файл**: [app.js](file:///Users/admin/projects/bip-buddy/hub/app.js)

Добавь секцию "Local Projects" после GitHub секции (после line 510):

```javascript
// ============================================
// Local Projects Functions
// ============================================

const localConnectBtn = document.getElementById('local-connect-btn');
// ... остальные DOM элементы

async function loadLocalProjects() { ... }
function renderLocalProjects(projects) { ... }
async function connectLocalProjects() { ... }
// ... event listeners
```

Используй GitHub-функции как образец (lines 302-492).

---

## Проверка

```bash
cd /Users/admin/projects/bip-buddy/hub && npm start
# Открыть http://localhost:3000
# Нажать "📁 Add Local" → выбрать проекты → Connect
# Проверить data/projects.json
```

---

## Контекст

- **Существующий projects.json**: [projects.json](file:///Users/admin/projects/bip-buddy/data/projects.json)
- **GitHub Connect паттерн**: изучи lines 302-492 в app.js
- **Функция matchLocalRepos()**: уже сканирует директории — переиспользуй логику
