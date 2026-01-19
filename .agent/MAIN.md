# bip-buddy — AI Agent Context

> Single Source of Truth for all AI agents (Claude Code, Codex, Cursor, etc.)

---

## Project Purpose

**One-liner:** Twitter copilot for Build in Public creators — mirrors activity, tracks growth, sends alerts

**Tech Stack:** Bash, SQLite, Bird CLI, Telegram Bot API, launchd

---

## Current Architecture (Phase 1)

```
launchd (every 15min)
    ↓
twitter-mirror.sh
    ↓
Bird CLI → JSON → SQLite (bip.db)
    ↓
twitter-alerts.sh
    ↓
Telegram Bot API → User
```

### Quick Reference

| Component | Path |
|-----------|------|
| Data collection | `.ai/scripts/twitter-mirror.sh` |
| Alerts | `.ai/scripts/twitter-alerts.sh` |
| DB init | `.ai/scripts/init-db.sh` |
| Database | `data/bip.db` |
| Telegram config | `~/.clawdbot/clawdbot.json` |

---

## Database Schema (Quick)

| Table | Purpose |
|-------|---------|
| `tweets` | Tweet content + metrics (likes, views, etc.) |
| `profile_snapshots` | Follower/following history |
| `drafts` | Content calendar (Phase 2) |
| `alerts_sent` | Deduplication log |

---

## Key Structure

```
bip-buddy/
├── .agent/           # AI infrastructure
│   ├── MAIN.md       # This file
│   ├── docs/         # Architecture, conventions
│   ├── workflows/    # /command workflows
│   └── scripts/      # Automation
├── .ai/              # Scripts and skills
│   ├── scripts/      # Bash scripts
│   └── skills/       # ClawdBot skills
├── data/             # Runtime data (gitignored)
└── docs/             # Documentation
    └── plans/        # Design documents
```

---

## GUPP: Guaranteed Uninterrupted Progress

### FIRST ACTION — Always:
```bash
cat .agent/HOOK.md 2>/dev/null | head -30
```

| Status | Action |
|--------|--------|
| **ACTIVE** | Execute CURRENT molecule. No new work. |
| **IDLE** | Free to accept new tasks. |
| **Not found** | Work normally with rules below. |

---

## Thresholds

| Condition | Action |
|-----------|--------|
| Task > 3 files | `/decompose` first → create HOOK.md |
| 10+ tool calls | Consider `/handoff` |
| 5+ files changed | Commit immediately |

---

## /handoff Protocol

When approaching context limit:

1. **Commit**: `git commit -m "WIP: [molecule] - handoff"`
2. **Update HOOK.md**: Mark progress, add Handoff Note
3. **Report to user**: Done / Current / Pending

---

## Never

- Ignore existing HOOK.md
- Edit 5+ files without commit
- Skip handoff when limit approaching
- Delete HOOK.md without archiving

---

## Commands

| User says | Agent does |
|-----------|-----------|
| "Продолжи" / "Continue" | Read HOOK.md, execute CURRENT |
| "Статус" / "Status" | Show convoy progress |
| "/handoff" | Save and prepare transfer |
| "/decompose: X" | Create HOOK.md for task X |

---

## Extended Docs

- [Architecture](.agent/docs/architecture.md) — System design, data flow, DB schema
- [Conventions](.agent/docs/conventions.md) — Bash patterns, error handling
- [Tech Stack](.agent/docs/stack.md) — Technologies, installation, rationale

---

*Last updated: 2026-01-19*
