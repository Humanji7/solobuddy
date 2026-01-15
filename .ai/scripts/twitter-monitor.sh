#!/bin/bash
# Twitter watchlist monitor for SoloBuddy
# Fetches recent tweets from watchlist and outputs JSON for analysis

set -euo pipefail

# Bird CLI credentials
export AUTH_TOKEN="${AUTH_TOKEN:-c1c6f92385d6e2e34092fec5b5b1e7759491dd5c}"
export CT0="${CT0:-845c0fad8f425572d6faeb5b234c1a012e05b6f4de5512695937f2ad29a53f65252bb99a154925c0a09262798ffcd9ee1a2d8287f03ba71ab32f2629dced4a59665694dac150a6f642c319e90c267e79}"

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

WATCHLIST=$(jq -r '.twitter.watchlist[]' "$CONFIG" 2>/dev/null)
MAX_TWEETS=$(jq -r '.twitter.maxTweetsPerUser // 5' "$CONFIG" 2>/dev/null)

if [ -z "$WATCHLIST" ]; then
    log "ERROR: Watchlist is empty in config"
    exit 1
fi

log "Starting Twitter monitor..."
log "Watchlist: $(echo $WATCHLIST | tr '\n' ' ')"

# Output file for this run
OUTPUT_FILE="$DATA_DIR/latest-fetch.json"
echo '{"fetchedAt":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","tweets":[]}' > "$OUTPUT_FILE"

# Fetch tweets for each handle
for handle in $WATCHLIST; do
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
done

TOTAL=$(jq '.tweets | length' "$OUTPUT_FILE")
log "Monitor complete. Total tweets fetched: $TOTAL"
log "Output saved to: $OUTPUT_FILE"

# Run analysis and send to ClawdBot
log "Triggering analysis..."
"$HOME/.clawdbot/scripts/twitter-analyze.sh" || log "Analysis failed"

log "Pipeline complete"
