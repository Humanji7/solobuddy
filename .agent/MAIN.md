# bip-buddy — AI Agent Context

> Single Source of Truth for all AI agents (Claude Code, Codex, Cursor, etc.)

---

## Project Purpose

**One-liner:** Twitter copilot for Build in Public creators — mirrors activity, tracks growth, sends alerts

**Tech Stack:** Bash, SQLite, Bird CLI, ClawdBot (@solobuddybot), launchd

---

## Current Architecture (Phase 1)

```
┌─────────────────────────────────────────────────────────┐
│  launchd                                                │
│  ├── com.bipbuddy.twitter-mirror (every 2h)             │
│  ├── com.clawdbot.twitter-monitor (watchlist)           │
│  └── com.clawdbot.gateway (постоянно)                   │
└─────────────────────────────────────────────────────────┘
           │                    │
           ▼                    ▼
┌──────────────────┐   ┌──────────────────┐
│ twitter-mirror.sh│   │ twitter-monitor.sh│
│ (мои твиты)      │   │ (watchlist)       │
└────────┬─────────┘   └────────┬─────────┘
         │                      │
         ▼                      ▼
    Bird CLI              Bird CLI
         │                      │
         ▼                      ▼
┌──────────────────────────────────────────┐
│              SQLite (bip.db)             │
└──────────────────────────────────────────┘
         │
         ▼
┌──────────────────┐
│ twitter-alerts.sh│ → ClawdBot (@solobuddybot) → Telegram
└──────────────────┘
```

### Quick Reference

| Component | Path | Schedule |
|-----------|------|----------|
| My tweets mirror | `.ai/scripts/twitter-mirror.sh` | каждые 2ч |
| Watchlist monitor | `.ai/scripts/twitter-monitor.sh` | по расписанию |
| Alerts | `.ai/scripts/twitter-alerts.sh` | после mirror |
| DB init | `.ai/scripts/init-db.sh` | — |
| Database | `data/bip.db` | — |
| ClawdBot config | `~/.clawdbot/clawdbot.json` | — |
| ClawdBot OAuth | `~/.clawdbot/agents/main/agent/auth-profiles.json` | ~7 дней |

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
├── .agent/           # AI agent context (Claude Code, Cursor, etc.)
│   ├── MAIN.md       # This file — single source of truth
│   ├── HOOK.md       # Current task / handoff state
│   └── docs/         # Architecture, conventions, stack
│
├── .ai/              # ClawdBot runtime
│   ├── scripts/      # Bash: twitter-mirror, alerts, monitor
│   ├── skills/       # ClawdBot skills (solobuddy)
│   └── agents/       # Workflows, prompts
│
├── data/             # Runtime data (gitignored)
│   └── bip.db        # SQLite database
│
├── docs/             # Philosophy & strategy
│   ├── BUILD_IN_PUBLIC.md
│   └── TWITTER.md
│
├── ideas/            # Content ideas, concepts
├── drafts/           # Work-in-progress posts
└── archive/          # Old handoffs, prompts
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

*Last updated: 2026-01-22*
