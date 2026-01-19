# Technical Stack

## Overview

SoloBuddy Hub — Node.js web application with vanilla frontend and Claude API integration.

## Backend

| Component | Technology | Version |
|-----------|------------|---------|
| Runtime | Node.js | 22.x LTS |
| Framework | Express | 4.21 |
| HTTP Client | Axios | 1.13 |
| Session | express-session | 1.18 |
| Environment | dotenv | 17.2 |

### Architecture

```
server.js (entry point)
    ├── routes/
    │   ├── chat.js      → /api/chat, /api/intent/parse
    │   ├── content.js   → /api/session-log, /api/backlog, /api/drafts
    │   ├── projects.js  → /api/projects, /api/project-voice, /api/project-soul
    │   └── github.js    → /auth/github, /api/github/*
    └── modules/
        ├── config.js           — Paths, helpers
        ├── chat-api.js         — Claude API integration
        ├── prompt-builder.js   — System prompt construction
        ├── intent-parser.js    — Intent Recognition Layer
        ├── parsing.js          — Markdown parsers
        ├── watcher.js          — Git activity tracking
        ├── github-api.js       — GitHub OAuth
        ├── soul-manager.js     — Project soul persistence
        ├── soul-onboarding.js  — Soul creation wizard
        └── sensitivity-detector.js — Soul onboarding trigger
```

### API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/chat` | POST | Chat with Claude |
| `/api/intent/parse` | POST | Parse user intent |
| `/api/session-log` | GET | Session log entries |
| `/api/backlog` | GET/POST | Ideas backlog |
| `/api/drafts` | GET | Draft documents |
| `/api/projects` | GET | Registered projects |
| `/api/project-voice` | POST | Talk to project persona |
| `/api/project-soul/:name` | GET | Get project soul |
| `/auth/github` | GET | OAuth redirect |
| `/api/github/repos` | GET | User repositories |

---

## Frontend

| Component | Technology |
|-----------|------------|
| Markup | HTML5 |
| Styling | Vanilla CSS (CSS Variables) |
| Logic | Vanilla JavaScript |
| Font | Inter (Google Fonts) |

### Key Files

- `hub/index.html` — Main page (SPA shell)
- `hub/styles.css` — "Warm Hearth" theme
- `hub/app.js` — UI logic, API calls
- `hub/action-cards.js` — Action card components

### Design System

Theme: "Warm Hearth" — muted warm tones, minimal, breathing animations.

---

## Data

| File | Format | Purpose |
|------|--------|---------|
| `data/projects.json` | JSON | Registered projects |
| `data/project-souls/*.json` | JSON | Soul configs per project |
| `data/ai-drafts.json` | JSON | AI-generated drafts |
| `ideas/backlog.md` | Markdown | Content ideas queue |
| `ideas/session-log.md` | Markdown | Daily captured moments |
| `drafts/*.md` | Markdown | Work-in-progress content |

---

## External Services

| Service | Purpose | Config |
|---------|---------|--------|
| Claude API | Chat, content generation | `ANTHROPIC_API_KEY` |
| GitHub OAuth | Repo discovery | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` |

---

## See Also

- [PROJECT_INDEX.md](../PROJECT_INDEX.md) — Full codebase map with module details
