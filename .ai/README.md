# AI Configuration

Skills и скрипты для ClawdBot / Claude Code.

## Setup

### Quick (recommended)

```bash
./setup.sh
```

### Manual: Symlinks

```bash
# Skills
ln -sf $(pwd)/skills/solobuddy ~/.clawdbot/skills/solobuddy
ln -sf $(pwd)/skills/solobuddy-twitter ~/.clawdbot/skills/solobuddy-twitter
ln -sf $(pwd)/skills/twitter-expert ~/.clawdbot/skills/twitter-expert

# Scripts (optional)
ln -sf $(pwd)/scripts ~/.clawdbot/scripts
```

### Manual: Copy

```bash
cp -r skills/* ~/.clawdbot/skills/
cp -r scripts/* ~/.clawdbot/scripts/
```

## Structure

```
.ai/
├── skills/
│   ├── solobuddy/           # Core workflow
│   ├── solobuddy-twitter/   # Twitter automation
│   └── twitter-expert/      # Copywriting expertise
├── scripts/
│   ├── twitter-analyze.sh   # L1/L2 quality gates
│   ├── twitter-monitor.sh   # Fetch from watchlist
│   └── update-activity-snapshot.js
├── agents/                  # Claude Code sub-agents
├── subagents/               # Legacy subagents
└── config.example.json5     # Configuration template
```

## Skills

| Skill | Triggers | Purpose |
|-------|----------|---------|
| `solobuddy` | ideas, drafts, activity | Core workflow |
| `solobuddy-twitter` | twitter, monitor | Engagement automation |
| `twitter-expert` | tweet, thread, hook | Copywriting expertise |

## Testing

```bash
# Verify skills loaded
clawdbot skills list

# Test Twitter pipeline (dry run)
./scripts/twitter-analyze.sh --dry-run

# Check activity snapshot
cat $(pwd)/../data/activity-snapshot.json | jq '.projects[0]'
```

## Troubleshooting

**Skills not loading:**
```bash
# Check symlinks
ls -la ~/.clawdbot/skills/

# Verify SKILL.md exists
cat ~/.clawdbot/skills/solobuddy/SKILL.md
```

**Scripts permission denied:**
```bash
chmod +x scripts/*.sh
```
