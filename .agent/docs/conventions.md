# Conventions

> Coding standards for BIP Buddy Bash scripts

---

## Bash Script Template

```bash
#!/bin/bash
# Short description of what the script does
# Example: Collect own tweets and profile metrics for BIP Buddy

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DATA_DIR="$PROJECT_ROOT/data"
DB_FILE="$DATA_DIR/bip.db"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

# Check dependencies
if ! command -v sqlite3 &> /dev/null; then
    log "ERROR: sqlite3 not found. Install with: brew install sqlite"
    exit 1
fi

# Cleanup on exit
cleanup() {
    [ -n "${TEMP_FILE:-}" ] && rm -f "$TEMP_FILE" 2>/dev/null || true
}
trap cleanup EXIT

# Main logic here
log "Starting..."
```

---

## Error Handling

### Required: Fail Fast

```bash
set -euo pipefail
```

| Flag | Meaning |
|------|---------|
| `-e` | Exit on any command failure |
| `-u` | Exit on undefined variable |
| `-o pipefail` | Exit if any command in pipe fails |

### Dependency Checks

```bash
# ALWAYS check before use
if ! command -v bird &> /dev/null; then
    log "ERROR: bird CLI not found. Install with: npm i -g @steipete/bird"
    exit 1
fi
```

### Temporary File Cleanup

```bash
# Initialize empty for cleanup trap
TEMP_FILE=""

cleanup() {
    [ -n "$TEMP_FILE" ] && rm -f "$TEMP_FILE" 2>/dev/null || true
}
trap cleanup EXIT

# Later in script
TEMP_FILE=$(mktemp)
```

### Selective Error Handling

```bash
# When some commands are expected to fail (e.g., grep returning 1 on no match)
set +e
RESULT=$(grep -c "PATTERN" "$FILE" 2>/dev/null); RC=$?
if [ $RC -eq 1 ]; then RESULT=0; fi  # No match is not an error
set -e
```

---

## SQL Injection Protection

### Numeric Validation

```bash
# ALWAYS validate user input or external data
LIKES=$(jq -r '.likeCount // 0' < "$JSON_FILE")

# Validate before SQL
[[ "$LIKES" =~ ^[0-9]+$ ]] || LIKES=0
```

### String Escaping

```bash
# Escape single quotes for SQL
TEXT=$(jq -r '.text' < "$JSON_FILE" | sed "s/'/''/g")

# Use in parameterized-like fashion
sqlite3 "$DB_FILE" "INSERT INTO tweets (content) VALUES ('$TEXT');"
```

### Threshold Validation

```bash
# At script start, validate constants
TWEET_LIKES_THRESHOLD=50
[[ "$TWEET_LIKES_THRESHOLD" =~ ^[0-9]+$ ]] || {
    echo "ERROR: TWEET_LIKES_THRESHOLD must be numeric"
    exit 1
}
```

---

## JSON Handling with jq

### Safe Field Extraction

```bash
# Use // for defaults, prevent null
FOLLOWERS=$(jq -r '.[0].followers // 0' < "$JSON_FILE")

# Deep nested access
VIEWS=$(jq -r '.[0]._raw.views.count // 0' < "$JSON_FILE")
```

### Array Iteration

```bash
COUNT=$(jq 'length' < "$JSON_FILE")

for i in $(seq 0 $((COUNT - 1))); do
    ID=$(jq -r ".[$i].id" < "$JSON_FILE" 2>/dev/null || echo "unknown")
    if [ "$ID" = "unknown" ]; then
        log "WARNING: Failed to parse item $i"
        continue
    fi
    # Process item
done
```

### JSON for HTTP Requests

```bash
# Use jq to build valid JSON (handles escaping)
json_payload=$(printf '%s' "$message" | jq -Rsc --arg chat_id "$CHAT_ID" \
    '{chat_id: $chat_id, text: ., parse_mode: "HTML"}')

curl -s -X POST "$URL" \
    -H "Content-Type: application/json" \
    -d "$json_payload"
```

---

## Logging

### Standard Format

```bash
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

# Usage
log "Starting Twitter mirror for @$HANDLE"
log "  Fetched $COUNT tweets"
log "ERROR: Database not found"
log "WARNING: Failed to parse date"
```

### Log Levels

| Prefix | When to Use |
|--------|-------------|
| (none) | Normal progress |
| `ERROR:` | Fatal, script will exit |
| `WARNING:` | Non-fatal, continues |

---

## File Naming

| Type | Convention | Example |
|------|------------|---------|
| Scripts | `kebab-case.sh` | `twitter-mirror.sh` |
| Database | `lowercase.db` | `bip.db` |
| Config | `lowercase.json` | `clawdbot.json` |
| Docs | `UPPERCASE.md` | `MAIN.md`, `README.md` |
| Plans | `YYYY-MM-DD-name.md` | `2026-01-18-design.md` |

---

## Directory Structure

```
.ai/
├── scripts/          # Executable scripts
│   ├── init-db.sh
│   ├── twitter-mirror.sh
│   └── twitter-alerts.sh
├── skills/           # ClawdBot skills
└── setup.sh          # Installation script

data/                 # Runtime data (gitignored)
└── bip.db
```

---

## SQLite Conventions

### HEREDOC for Multi-line SQL

```bash
sqlite3 "$DB_FILE" << 'SQL'
CREATE TABLE IF NOT EXISTS tweets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tweet_id TEXT UNIQUE NOT NULL
);
SQL
```

### Single Line for Simple Queries

```bash
EXISTS=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM tweets WHERE tweet_id='$ID';")
```

### Date/Time

- Always use SQLite's `datetime()` functions
- Store in ISO format: `YYYY-MM-DD HH:MM:SS`
- Use `CURRENT_TIMESTAMP` for defaults

---

## Environment Variables

### Credential Pattern

```bash
# Use environment with fallback (only for dev/testing)
export AUTH_TOKEN="${AUTH_TOKEN:-default_token}"

# Or require explicitly
if [ -z "${BOT_TOKEN:-}" ]; then
    log "ERROR: BOT_TOKEN not set"
    exit 1
fi
```

### Config File Pattern

```bash
CLAWDBOT_CONFIG="$HOME/.clawdbot/clawdbot.json"

if [ ! -f "$CLAWDBOT_CONFIG" ]; then
    log "ERROR: Config not found at $CLAWDBOT_CONFIG"
    exit 1
fi

BOT_TOKEN=$(jq -r '.channels.telegram.botToken' "$CLAWDBOT_CONFIG")
```

---

## Commit Messages

```
<type>: <description>

Types:
- feat: New feature
- fix: Bug fix
- docs: Documentation
- refactor: Code restructure
- chore: Maintenance
```

---

*Last updated: 2026-01-19*
