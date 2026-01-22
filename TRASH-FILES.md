# TRASH Files Log

## 2026-01-22 — Major Cleanup

Moved to `TRASH/2026-01-22-cleanup/`:

| Item | Reason |
|------|--------|
| `archive/` | 26 old handoffs and prompts |
| `legacy/` | Old web hub interface — replaced by ClawdBot |
| `ideas/` | Future ideas — clearing for focus |
| `drafts/` | Draft posts — clearing backlog |
| `plans/` | Old design documents |
| `research/` | Twitter research — archived |
| `project-souls/` | Old project JSON configs |
| `SOUL.md` | Old soul config |
| `skills-duplicate/` | Duplicate of `.ai/skills/solobuddy/` |
| `ai-skills-trash/` | Old skill drafts |
| `ai-prompts/` | Outdated prompts (roadmap_review) |
| `ai-workflows/` | Outdated workflows (bip.md) |
| `ai-subagents/` | Unused subagents (code-simplifier) |
| `.playwright-mcp/` | ~70 screenshots from old web UI |
| `activity-snapshot.*` | Old data files |
| `projects*.json` | Old project configs |
| `sqlite_mcp_server.db` | MCP server database |
| `.cursorrules` | Cursor IDE rules |
| `hooks/` | Git hooks |
| `CLAUDE_MIGRATED.md` | Outdated CLAUDE.md content |
| `update-activity-snapshot.js` | Depended on deleted legacy/ |

---

## What Remains (Clean Core)

```
bip-buddy/
├── .agent/              # AI context (MAIN.md, HOOK.md, docs/)
├── .ai/scripts/         # 5 working bash scripts
├── .ai/skills/solobuddy # ClawdBot skill
├── data/bip.db          # SQLite database
├── data/twitter/        # Twitter runtime data
├── docs/                # Philosophy (BUILD_IN_PUBLIC, TWITTER)
├── AGENTS.md
├── CLAUDE.md
├── PROFILE.md
└── README.md
```
