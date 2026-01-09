# Technical Stack

## Overview

SoloBuddy is a Node.js web application with vanilla frontend.

## Backend

| Component | Technology | Version |
|-----------|------------|---------|
| Runtime | Node.js | 25.x |
| Framework | Express | 4.21 |
| HTTP Client | Axios | 1.6 |
| Session | express-session | 1.17 |
| Environment | dotenv | 16.3 |

### Key Files

- `hub/server.js` — Main server, API routes
- `hub/watcher.js` — Git watcher for buddy messages  
- `hub/github-api.js` — GitHub OAuth & repo matching

### API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/session-log` | GET | Session log entries |
| `/api/backlog` | GET/POST | Ideas backlog |
| `/api/drafts` | GET | Draft documents |
| `/api/buddy-message` | GET | Proactive buddy message |
| `/auth/github` | GET | OAuth redirect |
| `/api/github/repos` | GET | User repositories |
| `/api/github/connect` | POST | Connect repos to monitoring |

---

## Frontend

| Component | Technology |
|-----------|------------|
| Markup | HTML5 |
| Styling | Vanilla CSS (CSS Variables) |
| Logic | Vanilla JavaScript |
| Font | Inter (Google Fonts) |

### Key Files

- `hub/index.html` — Main page
- `hub/styles.css` — "Warm Hearth" theme
- `hub/app.js` — UI logic, API calls

### Design System

Theme: "Warm Hearth" — muted warm tones, minimal, breathing animations.

---

## Data

| File | Format | Purpose |
|------|--------|---------|
| `data/projects.json` | JSON | Monitored Git projects |
| `ideas/backlog.md` | Markdown | Content ideas queue |
| `ideas/session-log.md` | Markdown | Daily captured moments |
| `drafts/*.md` | Markdown | Work-in-progress content |

---

## External Services

| Service | Purpose | Config |
|---------|---------|--------|
| GitHub OAuth | Repo discovery | `hub/.env` |
