#!/bin/bash
# Collect own tweets and profile metrics for BIP Buddy
# Runs periodic snapshots of profile stats and tweet metrics

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DATA_DIR="$PROJECT_ROOT/data"
DB_FILE="$DATA_DIR/bip.db"

# Load credentials from macOS Keychain (secure storage)
source "$SCRIPT_DIR/lib/credentials.sh"
source "$SCRIPT_DIR/lib/sql-safe.sh"
export_bird_credentials || {
    echo "ERROR: Failed to load credentials. Run: .ai/scripts/setup-credentials.sh" >&2
    exit 1
}

TWITTER_HANDLE="Toporcalibur"
MAX_TWEETS=20

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

# Temp files (initialized empty for cleanup trap)
TWEETS_JSON=""
TEMP_LOG=""

# Cleanup on exit
cleanup() {
    [ -n "$TWEETS_JSON" ] && rm -f "$TWEETS_JSON" 2>/dev/null || true
    [ -n "$TEMP_LOG" ] && rm -f "$TEMP_LOG" 2>/dev/null || true
}
trap cleanup EXIT

# Check dependencies
if ! command -v bird &> /dev/null; then
    log "ERROR: bird CLI not found. Install with: npm i -g @steipete/bird"
    exit 1
fi

if ! command -v sqlite3 &> /dev/null; then
    log "ERROR: sqlite3 not found. Install with: brew install sqlite"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    log "ERROR: jq not found. Install with: brew install jq"
    exit 1
fi

if [ ! -f "$DB_FILE" ]; then
    log "ERROR: Database not found at $DB_FILE"
    log "  Run: .ai/scripts/init-db.sh"
    exit 1
fi

log "Starting Twitter mirror for @$TWITTER_HANDLE"

# Collect own tweets with metrics (using --json-full to also extract profile data)
log "Fetching tweets (max $MAX_TWEETS)..."

# Save to temp file to avoid issues with control characters in bash variables
TWEETS_JSON=$(mktemp)
bird user-tweets "$TWITTER_HANDLE" -n "$MAX_TWEETS" --json-full --plain 2>/dev/null > "$TWEETS_JSON"

if [ $? -ne 0 ] || [ ! -s "$TWEETS_JSON" ]; then
    log "WARNING: No tweets fetched or error occurred"
    exit 0
fi

TWEET_COUNT=$(jq 'length' < "$TWEETS_JSON")
log "  Fetched $TWEET_COUNT tweets"

# 1. Extract and save profile snapshot from first tweet's _raw data
FOLLOWERS=$(jq -r '.[0]._raw.core.user_results.result.legacy.followers_count // 0' < "$TWEETS_JSON")
FOLLOWING=$(jq -r '.[0]._raw.core.user_results.result.legacy.friends_count // 0' < "$TWEETS_JSON")

log "Profile snapshot:"
log "  Followers: $FOLLOWERS, Following: $FOLLOWING"

sqlite3 "$DB_FILE" << SQL
INSERT INTO profile_snapshots (followers, following)
VALUES ($FOLLOWERS, $FOLLOWING);
SQL

if [ $? -eq 0 ]; then
    log "  Profile snapshot saved"
else
    log "ERROR: Failed to save profile snapshot"
    exit 1
fi

# 2. Process tweets
log "Processing tweets..."

# Process each tweet (using temporary file to avoid subshell variable issues)
TEMP_LOG=$(mktemp)

# Temporarily disable errexit for tweet processing (some tweets may have parsing issues)
set +e

for i in $(seq 0 $((TWEET_COUNT - 1))); do
    # Extract fields directly from file to avoid bash variable issues with control chars
    TWEET_ID=$(jq -r ".[$i].id" < "$TWEETS_JSON" 2>/dev/null || echo "unknown")
    if [ "$TWEET_ID" = "unknown" ]; then
        log "  WARNING: Failed to parse tweet $i"
        echo "ERROR" >> "$TEMP_LOG"
        continue
    fi

    TEXT=$(jq -r ".[$i].text" < "$TWEETS_JSON" 2>/dev/null)
    CREATED_AT=$(jq -r ".[$i].createdAt" < "$TWEETS_JSON" 2>/dev/null)
    LIKES=$(jq -r ".[$i].likeCount // 0" < "$TWEETS_JSON" 2>/dev/null)
    REPLIES=$(jq -r ".[$i].replyCount // 0" < "$TWEETS_JSON" 2>/dev/null)
    RETWEETS=$(jq -r ".[$i].retweetCount // 0" < "$TWEETS_JSON" 2>/dev/null)
    VIEWS=$(jq -r ".[$i]._raw.views.count // 0" < "$TWEETS_JSON" 2>/dev/null)

    # Validate numeric fields (defaults to 0 if invalid)
    [[ "$LIKES" =~ ^[0-9]+$ ]] || LIKES=0
    [[ "$REPLIES" =~ ^[0-9]+$ ]] || REPLIES=0
    [[ "$RETWEETS" =~ ^[0-9]+$ ]] || RETWEETS=0
    [[ "$VIEWS" =~ ^[0-9]+$ ]] || VIEWS=0

    # Validate tweet_id format (must be numeric)
    if ! sql_validate_tweet_id "$TWEET_ID" 2>/dev/null; then
        log "  WARNING: Invalid tweet_id format: $TWEET_ID, skipping"
        echo "ERROR" >> "$TEMP_LOG"
        continue
    fi

    # Convert Twitter date format to SQLite datetime
    # Example: "Sat Jan 17 23:25:16 +0000 2026" -> "2026-01-17 23:25:16"
    CREATED_AT_SQL=$(date -j -f "%a %b %d %H:%M:%S %z %Y" "$CREATED_AT" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || echo "")

    if [ -z "$CREATED_AT_SQL" ]; then
        log "  WARNING: Failed to parse date for tweet $TWEET_ID, skipping"
        echo "ERROR" >> "$TEMP_LOG"
        continue
    fi

    # Check if tweet exists (using safe function)
    if sql_tweet_exists "$DB_FILE" "$TWEET_ID"; then
        # Update metrics for existing tweet (using safe function)
        if sql_update_tweet_metrics "$DB_FILE" "$TWEET_ID" "$LIKES" "$REPLIES" "$RETWEETS" "$VIEWS"; then
            echo "UPDATED" >> "$TEMP_LOG"
        else
            log "  ERROR: Failed to update tweet $TWEET_ID"
            echo "ERROR" >> "$TEMP_LOG"
        fi
    else
        # Insert new tweet (using safe function with proper escaping)
        if sql_insert_tweet "$DB_FILE" "$TWEET_ID" "$TEXT" "$CREATED_AT_SQL" "$LIKES" "$REPLIES" "$RETWEETS" "$VIEWS"; then
            echo "INSERTED" >> "$TEMP_LOG"
        else
            log "  ERROR: Failed to insert tweet $TWEET_ID"
            echo "ERROR" >> "$TEMP_LOG"
        fi
    fi
done

# Count results (keep errexit disabled for grep which returns 1 on no match)
if [ -f "$TEMP_LOG" ]; then
    INSERTED=$(grep -c "INSERTED" "$TEMP_LOG" 2>/dev/null); RC=$?
    if [ $RC -eq 1 ]; then INSERTED=0; fi

    UPDATED=$(grep -c "UPDATED" "$TEMP_LOG" 2>/dev/null); RC=$?
    if [ $RC -eq 1 ]; then UPDATED=0; fi

    ERRORS=$(grep -c "ERROR" "$TEMP_LOG" 2>/dev/null); RC=$?
    if [ $RC -eq 1 ]; then ERRORS=0; fi
else
    INSERTED=0
    UPDATED=0
    ERRORS=0
fi

# Re-enable errexit
set -e

log "Mirror complete:"
log "  Inserted: ${INSERTED} new tweets"
log "  Updated: ${UPDATED} existing tweets"
if [ "${ERRORS}" -gt 0 ]; then
    log "  Errors: ${ERRORS} tweets skipped"
fi

# 3. Calculate deltas for future alerts (just log for now)
log "Calculating metric deltas..."

# Get top growth tweets since last run
GROWTH=$(sqlite3 "$DB_FILE" << 'SQL'
SELECT tweet_id, likes, views
FROM tweets
WHERE snapshot_at >= datetime('now', '-1 day')
ORDER BY likes DESC
LIMIT 5;
SQL
)

if [ -n "$GROWTH" ]; then
    log "  Top performing tweets (last 24h):"
    echo "$GROWTH" | while IFS='|' read -r id likes views; do
        log "    Tweet $id: $likes likes, $views views"
    done
else
    log "  No significant changes detected"
fi

log "Twitter mirror finished successfully"

# Run alerts check
log "Running alerts check..."
"$SCRIPT_DIR/twitter-alerts.sh"
