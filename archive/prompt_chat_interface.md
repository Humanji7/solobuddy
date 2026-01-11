# Chat Interface Implementation

Implement a chat interface for SoloBuddy Hub that allows direct conversation with Claude API, with project context injection.

---

## Context

Read these files first:

1. **Implementation Plan**: [implementation_plan.md](file:///Users/admin/.gemini/antigravity/brain/199faf2a-f9d9-4179-b8ab-ecb68b7bff80/implementation_plan.md) — design decisions, CSS patterns, component structure
2. **Current Server**: [hub/server.js](file:///Users/admin/projects/bip-buddy/hub/server.js) — existing Express routes pattern
3. **Current Frontend**: [hub/app.js](file:///Users/admin/projects/bip-buddy/hub/app.js) — existing fetch/render patterns
4. **UI Template**: [hub/index.html](file:///Users/admin/projects/bip-buddy/hub/index.html) — existing HTML structure
5. **Design System**: [hub/styles.css](file:///Users/admin/projects/bip-buddy/hub/styles.css) — "Warm Hearth" CSS variables

---

## Tasks

### 1. Backend — Chat API

**Create** `hub/chat-api.js`:
```javascript
// Use axios (already installed) to call Claude API
// ANTHROPIC_API_KEY is in .env

async function sendToClaude(messages, context) {
  // Build system prompt with context (projects, backlog)
  // POST to https://api.anthropic.com/v1/messages
  // Return response text
}
```

**Modify** `hub/server.js`:
- Add `POST /api/chat` endpoint
- Accept `{ message, history }` 
- Call `sendToClaude()` with context from `projects.json` and `backlog.md`
- Return `{ response }`

---

### 2. Frontend — UI

**Modify** `hub/index.html`:
- Add chat section between `#buddy-message` and `.main`
- Structure: `.chat-container > .chat-messages + .chat-form`

**Modify** `hub/styles.css`:
- Follow design from implementation_plan.md
- Use existing CSS variables (`--accent-primary`, `--radius-lg`, etc.)
- ~60 lines total

**Modify** `hub/app.js`:
- `chatHistory` array (load/save to localStorage key: `solobuddy_chat_history`)
- `sendChatMessage(text)` — POST to `/api/chat`
- `renderChatMessage(role, text)` — create bubble element
- Typing indicator animation
- Auto-scroll on new message
- ~80 lines total

---

## Environment

- `.env` already has `ANTHROPIC_API_KEY`
- Dependencies installed: `axios`, `express`, `dotenv`

---

## Verification

1. `cd hub && node server.js`
2. Open `http://localhost:3000`
3. Send message: "What am I working on?"
4. Verify context-aware response
5. Refresh page → history should persist
6. Test dark mode
