# Project Index: SoloBuddy

> Generated: 2026-01-12 | Auto-generated project map for AI context efficiency

## Overview

SoloBuddy Hub — локальный web-интерфейс для управления контент-бэклогом, черновиками и интеграцией с Claude API. Основное назначение: помощник для build-in-public воркфлоу.

## Project Structure

```
bip-buddy/
├── hub/                    # Web-сервер и frontend
│   ├── server.js           # Entry point (Express)
│   ├── routes/             # API роутеры
│   ├── *.js                # Core modules
│   └── index.html          # Frontend SPA
├── docs/                   # Техническая документация
├── ideas/                  # Бэклог и session-log
├── drafts/                 # Черновики контента
├── data/                   # JSON данные, project-souls/
├── .subagents/             # Claude Code субагенты
└── archive/                # Устаревшие файлы
```

## Entry Points

| Entry | Path | Description |
|-------|------|-------------|
| Server | `hub/server.js` | Express сервер, http://localhost:3000 |
| Frontend | `hub/index.html` | SPA с vanilla JS |
| CLI | `npm start` | Запуск из `hub/` |

## Core Modules

### Backend (hub/*.js)

| Module | LOC | Purpose |
|--------|-----|---------|
| `server.js` | 65 | Entry point, middleware, route mounting |
| `config.js` | 80 | Paths, GitHub config, shared helpers |
| `chat-api.js` | 500 | Claude API integration, sendToClaude(), generateContent() |
| `prompt-builder.js` | 500 | System prompt construction, persona loading |
| `intent-parser.js` | 400 | Intent Recognition Layer (IRL), regex patterns |
| `parsing.js` | 200 | Markdown parsers (session-log, backlog, drafts) |
| `action-cards.js` | 700 | Frontend action card components |
| `watcher.js` | 300 | Git watcher, activity tracking |
| `github-api.js` | 350 | GitHub OAuth, repo discovery |
| `soul-manager.js` | 150 | Project soul persistence (JSON) |
| `soul-onboarding.js` | 700 | Wizard для создания SOUL проекта |
| `sensitivity-detector.js` | 200 | Определение нужен ли soul onboarding |
| `post-editor.js` | 150 | Редактор постов |

### Routes (hub/routes/*.js)

| Route | Endpoints | Purpose |
|-------|-----------|---------|
| `chat.js` | `/api/chat`, `/api/intent/parse` | Chat с Claude, intent parsing |
| `content.js` | `/api/session-log`, `/api/backlog`, `/api/drafts` | CRUD для контента |
| `projects.js` | `/api/projects`, `/api/project-voice`, `/api/project-soul` | Проекты и их души |
| `github.js` | `/auth/github`, `/api/github/*` | OAuth flow |

### Frontend (hub/)

| File | Purpose |
|------|---------|
| `index.html` | Main page, SPA shell |
| `styles.css` | "Warm Hearth" theme (CSS variables) |
| `app.js` | UI logic, API calls, rendering |

## Key Concepts

### Intent Recognition Layer (IRL)
Распознавание намерений пользователя через regex patterns:
- `add_to_backlog` — добавление идеи
- `generate_content` — генерация поста/треда
- `show_activity` — просмотр активности
- `link_to_project` — привязка к проекту

### Soul System
Персонализация AI-ответов для каждого проекта:
- `soul-manager.js` — CRUD для soul JSON файлов
- `soul-onboarding.js` — wizard для создания
- `sensitivity-detector.js` — авто-определение нужности

### Prompt Engineering
- `prompt-builder.js` — dynamic system prompt
- Загрузка PROFILE.md, SOUL.md, project context
- Language detection (ru/en)

## API Reference

### Chat
```
POST /api/chat
Body: { message, context?, projectName? }
Response: { reply, intent?, suggestions? }

POST /api/intent/parse
Body: { message }
Response: { intent, confidence, entities }
```

### Content
```
GET /api/session-log → [{ title, description, date }]
GET /api/backlog → [{ title, priority, status }]
GET /api/drafts → [{ name, path, preview }]
POST /api/backlog → { title, description }
```

### Projects
```
GET /api/projects → [{ name, path, soul?, activity }]
POST /api/project-voice → { projectName, question }
GET /api/project-soul/:name → { soul }
```

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| express | 4.21 | Web framework |
| axios | 1.13 | HTTP client (Claude API) |
| dotenv | 17.2 | Environment variables |
| express-session | 1.18 | Session management |

## Data Files

| File | Format | Purpose |
|------|--------|---------|
| `data/projects.json` | JSON | Registered projects |
| `data/project-souls/*.json` | JSON | Soul configs per project |
| `data/ai-drafts.json` | JSON | AI-generated drafts |
| `ideas/backlog.md` | Markdown | Content ideas |
| `ideas/session-log.md` | Markdown | Daily captures |

## Environment

Required `.env`:
```
ANTHROPIC_API_KEY=sk-...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
SESSION_SECRET=...
```

## Quick Start

```bash
cd hub
npm install
npm start
# → http://localhost:3000
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (SPA)                    │
│  index.html → app.js → action-cards.js              │
└─────────────────┬───────────────────────────────────┘
                  │ fetch(/api/*)
┌─────────────────▼───────────────────────────────────┐
│                  Express Server                      │
│  server.js → routes/*.js                            │
├─────────────────────────────────────────────────────┤
│  Intent Layer          │  Chat Layer                │
│  intent-parser.js      │  chat-api.js               │
│                        │  prompt-builder.js         │
├────────────────────────┼────────────────────────────┤
│  Soul System           │  Content System            │
│  soul-manager.js       │  parsing.js                │
│  soul-onboarding.js    │  watcher.js                │
│  sensitivity-detector  │                            │
└─────────────────────────────────────────────────────┘
                  │
        ┌────────┴────────┐
        ▼                 ▼
   Claude API        File System
   (Anthropic)       (ideas/, drafts/, data/)
```

## Test Coverage

- Unit tests: 0 files
- E2E tests: 0 files
- Coverage: Not configured

## Documentation Status

| Doc | Status |
|-----|--------|
| `docs/STACK.md` | Outdated (needs update after refactor) |
| `docs/COMMANDS.md` | Current |
| `docs/TESTS.md` | Placeholder |
| `CLAUDE.md` | Current (project entry point) |

---

*Token efficiency: ~3KB vs ~50KB full codebase read*
