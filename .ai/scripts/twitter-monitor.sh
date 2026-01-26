#!/bin/bash
# Twitter watchlist monitor for SoloBuddy
# Fetches recent tweets from watchlist and outputs JSON for analysis

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load credentials from macOS Keychain (secure storage)
source "$SCRIPT_DIR/lib/credentials.sh"
export_bird_credentials || {
    echo "ERROR: Failed to load credentials. Run: .ai/scripts/setup-credentials.sh" >&2
    exit 1
}

CONFIG="$HOME/.clawdbot/clawdbot.json"
DATA_DIR="$HOME/projects/bip-buddy/data/twitter"
SEEN_FILE="$DATA_DIR/seen-tweets.json"
LOG_FILE="/tmp/twitter-monitor.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

# Ensure data dir and files exist
mkdir -p "$DATA_DIR"
[ -f "$SEEN_FILE" ] || echo '[]' > "$SEEN_FILE"

# Check if bird is available
if ! command -v bird &> /dev/null; then
    log "ERROR: bird CLI not found. Install with: npm i -g @steipete/bird"
    exit 1
fi

# Extract watchlist from config
if [ ! -f "$CONFIG" ]; then
    log "ERROR: Config not found at $CONFIG"
    exit 1
fi

MAX_TWEETS=$(jq -r '.twitter.maxTweetsPerUser // 5' "$CONFIG" 2>/dev/null)

# Validate MAX_TWEETS is numeric
[[ "$MAX_TWEETS" =~ ^[0-9]+$ ]] || MAX_TWEETS=5

# Check watchlist exists
WATCHLIST_COUNT=$(jq -r '.twitter.watchlist | length' "$CONFIG" 2>/dev/null)
if [ "$WATCHLIST_COUNT" = "0" ] || [ -z "$WATCHLIST_COUNT" ]; then
    log "ERROR: Watchlist is empty in config"
    exit 1
fi

# Validate Twitter handle format (alphanumeric + underscore, max 15 chars)
validate_handle() {
    local handle="$1"
    if [[ "$handle" =~ ^[a-zA-Z0-9_]{1,15}$ ]]; then
        return 0
    else
        log "  WARNING: Invalid handle format, skipping: $handle"
        return 1
    fi
}

log "Starting Twitter monitor..."
log "Watchlist: $(jq -r '.twitter.watchlist | join(" ")' "$CONFIG")"

# Output file for this run
OUTPUT_FILE="$DATA_DIR/latest-fetch.json"
printf '{"fetchedAt":"%s","tweets":[]}' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$OUTPUT_FILE"

# Fetch tweets for each handle (safe iteration with read)
while IFS= read -r handle; do
    # Skip empty lines
    [ -z "$handle" ] && continue

    # Validate handle format (prevent command injection)
    validate_handle "$handle" || continue

    log "Fetching tweets from @$handle..."

    TWEETS=$(bird user-tweets "$handle" -n "$MAX_TWEETS" --json --plain 2>/dev/null || echo '[]')

    if [ "$TWEETS" != "[]" ]; then
        # Append to output
        jq --argjson new "$TWEETS" '.tweets += $new' "$OUTPUT_FILE" > "$OUTPUT_FILE.tmp" && mv "$OUTPUT_FILE.tmp" "$OUTPUT_FILE"
        log "  Found $(echo "$TWEETS" | jq length) tweets from @$handle"
    else
        log "  No tweets or error for @$handle"
    fi

    # Rate limit protection
    sleep 2
done < <(jq -r '.twitter.watchlist[]' "$CONFIG" 2>/dev/null)

TOTAL=$(jq '.tweets | length' "$OUTPUT_FILE")
log "Monitor complete. Total tweets fetched: $TOTAL"
log "Output saved to: $OUTPUT_FILE"

# Run analysis and send to ClawdBot
log "Triggering analysis..."
"$HOME/.clawdbot/scripts/twitter-analyze.sh" || log "Analysis failed"

log "Pipeline complete"
