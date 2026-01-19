# Tech Stack

> BIP Buddy Phase 1 technologies and rationale

---

## Core Technologies

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Scheduler** | launchd | macOS native cron alternative |
| **Runtime** | Bash | Script execution |
| **Database** | SQLite | Local data storage |
| **Data Collection** | Bird CLI | Twitter scraping without API |
| **JSON Processing** | jq | Parse and build JSON |
| **HTTP Client** | curl | Telegram API requests |
| **Messaging** | Telegram Bot API | Alert delivery |

---

## Installation Commands

```bash
# Bird CLI (Twitter scraper)
npm install -g @steipete/bird

# JSON processor
brew install jq

# SQLite (usually pre-installed on macOS)
brew install sqlite

# curl is built-in on macOS
```

---

## Bird CLI

Unofficial Twitter client that scrapes data without official API.

### Why Bird CLI?

- Twitter API v2 requires paid subscription ($100/month)
- Bird CLI uses web scraping, free for personal use
- Provides JSON output with full tweet metadata

### Usage

```bash
# Set credentials (from browser cookies)
export AUTH_TOKEN="..."
export CT0="..."

# Fetch user tweets
bird user-tweets Toporcalibur -n 20 --json-full --plain

# Output: JSON array with tweet data and _raw metadata
```

### Data Structure

```json
[{
  "id": "1234567890",
  "text": "Tweet content",
  "createdAt": "Sat Jan 17 23:25:16 +0000 2026",
  "likeCount": 42,
  "replyCount": 5,
  "retweetCount": 3,
  "_raw": {
    "views": { "count": "1500" },
    "core": {
      "user_results": {
        "result": {
          "legacy": {
            "followers_count": 1200,
            "friends_count": 500
          }
        }
      }
    }
  }
}]
```

---

## SQLite

Serverless SQL database stored as single file.

### Why SQLite?

- Zero configuration
- Single file (`data/bip.db`)
- ACID compliant
- Perfect for single-user local apps

### Common Queries

```bash
# Connect to database
sqlite3 data/bip.db

# View tables
.tables

# View schema
.schema tweets

# Query data
SELECT tweet_id, likes FROM tweets ORDER BY likes DESC LIMIT 5;
```

---

## Telegram Bot API

### Configuration

Credentials stored in ClawdBot config:

```bash
~/.clawdbot/clawdbot.json
```

```json
{
  "channels": {
    "telegram": {
      "botToken": "123456:ABC-DEF...",
      "allowFrom": [123456789]
    }
  }
}
```

### API Usage

```bash
# Send message
curl -s -X POST "https://api.telegram.org/bot${TOKEN}/sendMessage" \
  -H "Content-Type: application/json" \
  -d '{"chat_id": 123456789, "text": "Hello", "parse_mode": "HTML"}'
```

### Supported HTML Tags

- `<b>bold</b>`
- `<i>italic</i>`
- `<a href="url">link</a>`
- `<code>inline code</code>`

---

## launchd

macOS native scheduler (replacement for cron).

### Plist Location

```
~/Library/LaunchAgents/com.bip-buddy.twitter-mirror.plist
```

### Example Plist

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "...">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.bip-buddy.twitter-mirror</string>
    <key>ProgramArguments</key>
    <array>
        <string>/path/to/bip-buddy/.ai/scripts/twitter-mirror.sh</string>
    </array>
    <key>StartInterval</key>
    <integer>900</integer>
    <key>StandardOutPath</key>
    <string>/tmp/bip-buddy-mirror.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/bip-buddy-mirror.log</string>
</dict>
</plist>
```

### Commands

```bash
# Load (start)
launchctl load ~/Library/LaunchAgents/com.bip-buddy.twitter-mirror.plist

# Unload (stop)
launchctl unload ~/Library/LaunchAgents/com.bip-buddy.twitter-mirror.plist

# Check status
launchctl list | grep bip-buddy
```

---

## What We DON'T Use

| Technology | Reason |
|------------|--------|
| **Node.js server** | Overkill for Phase 1; scripts are sufficient |
| **Docker** | Local macOS app, not containerized |
| **Twitter API v2** | Paid ($100/month); Bird CLI is free |
| **PostgreSQL** | SQLite is simpler for single-user |
| **React/Vue** | No web UI in Phase 1 |
| **AI/LLM** | Phase 2 feature (content analysis) |

---

## Version Requirements

| Tool | Minimum Version | Check Command |
|------|-----------------|---------------|
| Bash | 3.2+ | `bash --version` |
| sqlite3 | 3.x | `sqlite3 --version` |
| jq | 1.6+ | `jq --version` |
| Node.js | 18+ (for Bird) | `node --version` |
| macOS | 12+ (Monterey) | `sw_vers` |

---

## Environment Variables

| Variable | Source | Purpose |
|----------|--------|---------|
| `AUTH_TOKEN` | Browser cookie | Twitter auth |
| `CT0` | Browser cookie | Twitter CSRF |

### Getting Twitter Credentials

1. Open Twitter/X in browser
2. Open DevTools → Application → Cookies
3. Copy `auth_token` and `ct0` values
4. Set in script or environment

---

*Last updated: 2026-01-19*
