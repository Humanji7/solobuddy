# Legacy

Deprecated code. Kept for archaeology.

## Contents

| Directory | Was | Replaced by |
|-----------|-----|-------------|
| `hub/` | Express web server (localhost:3000) | ClawdBot skills |
| `handoffs/` | Old session handoffs | `docs/SESSION_HANDOFF.md` |

## Why Deprecated

### hub/ (January 2026)

**Problem:** Localhost dashboard distracted from content. Maintaining infrastructure instead of creating.

**Solution:** Migration to ClawdBot skills:
- Telegram UI instead of web UI
- Skills instead of Express endpoints
- Cron scripts instead of watcher polling

**Design doc:** `docs/plans/2026-01-14-clawdbot-migration-design.md`

### handoffs/

Old HANDOFF_*.md files from different sessions. Replaced by single `docs/SESSION_HANDOFF.md` with rolling updates.

## Resurrection

If you need the web UI back:

```bash
cd legacy/hub
npm install

# Create .env
cp .env.example .env
# Add ANTHROPIC_API_KEY

npm start
# http://localhost:3000
```

## Files of Interest

| File | Purpose |
|------|---------|
| `hub/prompt-builder.js` | System prompts (870 LOC) |
| `hub/soul-manager.js` | SOUL.md integration |
| `hub/watcher.js` | Git activity tracking |
| `handoffs/HANDOFF_PROJECT_VOICE.md` | Voice development session (28KB) |
