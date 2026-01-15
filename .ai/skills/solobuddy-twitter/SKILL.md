---
name: solobuddy-twitter
description: Twitter engagement assistant — monitors watchlist, analyzes resonance with your voice, suggests comments with explanations. Proactive opportunities, not spam.
homepage: https://github.com/gHashTag/bip-buddy
metadata: {"clawdbot":{"emoji":"🐦","requires":{"bins":["bird"]},"config":["twitter.watchlist","solobuddy.dataPath"]}}
---

# SoloBuddy Twitter Extension

Proactive Twitter engagement assistant. Claude monitors your watchlist and suggests commenting opportunities with ready-made drafts.

**Philosophy:** Remove cognitive load (what to comment? where? is it worth it?) while keeping YOU in control.

## Status: Working

- bird CLI: installed
- LaunchAgent: running (every 30 min)
- Watchlist: levelsio, marclou, naval, shl, adamwathan

## How It Works

```
LaunchAgent (every 30 min)
       ↓
twitter-monitor.sh
  → bird user-tweets for each handle
  → saves to latest-fetch.json
       ↓
twitter-analyze.sh
  → filters new tweets (not in seen-tweets.json)
  → picks top 5 by engagement
  → sends to clawdbot agent --deliver
       ↓
ClawdBot analyzes:
  • Resonance with PROFILE.md (Jester-Sage voice)
  • Tweet freshness
  • Engagement potential
  • Your unique angle
       ↓
Telegram notification with:
  🎯 @username — topic
  🔗 direct link to tweet
  💬 draft comment
  💡 why it's worth it
```

## Configuration

`~/.clawdbot/clawdbot.json`:

```json
{
  "twitter": {
    "watchlist": ["levelsio", "marclou", "naval", "shl", "adamwathan"],
    "checkInterval": "30m",
    "maxTweetsPerUser": 5,
    "maxAgeHours": 6
  },
  "solobuddy": {
    "dataPath": "/Users/admin/projects/bip-buddy"
  }
}
```

## Files

```
~/.clawdbot/scripts/
├── twitter-monitor.sh     # Fetches tweets via bird CLI
└── twitter-analyze.sh     # Sends to ClawdBot for analysis

~/Library/LaunchAgents/
└── com.clawdbot.twitter-monitor.plist  # Runs every 30 min

~/projects/bip-buddy/data/twitter/
├── latest-fetch.json      # Last fetched tweets
├── seen-tweets.json       # Already processed IDs (dedupe)
└── history.json           # Stats
```

## Manual Commands

```bash
# Run manually
~/.clawdbot/scripts/twitter-monitor.sh

# Check logs
tail -f /tmp/twitter-monitor.log

# Stop auto-monitoring
launchctl unload ~/Library/LaunchAgents/com.clawdbot.twitter-monitor.plist

# Start auto-monitoring
launchctl load ~/Library/LaunchAgents/com.clawdbot.twitter-monitor.plist

# Add to watchlist (edit config)
jq '.twitter.watchlist += ["newhandle"]' ~/.clawdbot/clawdbot.json > tmp && mv tmp ~/.clawdbot/clawdbot.json
```

## Telegram Triggers

In chat with ClawdBot:
- "проверь твиттер" / "check twitter" — manual scan
- "watchlist" — show current watchlist

## Output Format

```
🎯 @shl — "Easy is boring. Hard is fun"
🔗 https://x.com/shl/status/2010924519641227351
💬 Hard is fun until it's Tuesday and you're debugging
   the same thing for 6 hours. Then it's just hard.
💡 Sahil = твоя аудитория, философский твит, 973 лайка
```

## Voice Analysis

From `PROFILE.md`:
- **Tone**: Ironic, Raw, Philosophical
- **Style**: Honest process sharing
- **Humor**: Self-deprecating, observational

Good opportunity:
- Topic overlaps with your projects/philosophy
- Fresh tweet (< 2 hours ideal)
- Author engages with thoughtful replies
- You can add unique perspective

Skip:
- Generic motivational content
- Promotional tweets
- 100+ comments (too late)

## Bird CLI

```bash
bird whoami                          # Check auth
bird user-tweets <handle> -n 5       # Get tweets
bird search "from:handle" -n 10      # Search
```

Credentials in `~/.zshrc`:
```bash
export AUTH_TOKEN="..."
export CT0="..."
```

## Troubleshooting

**No notifications:**
→ Check `clawdbot daemon status`
→ Restart: `clawdbot daemon restart`

**bird: credentials not found:**
→ Re-login to x.com in Chrome
→ Update AUTH_TOKEN/CT0 in ~/.zshrc and scripts

**Logs:**
→ `/tmp/twitter-monitor.log`
→ `/tmp/clawdbot/clawdbot-*.log`
