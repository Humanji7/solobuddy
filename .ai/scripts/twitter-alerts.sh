#!/bin/bash
# Send Telegram alerts for significant Twitter activity
# Checks tweet growth and follower growth, sends alerts via Telegram API

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DATA_DIR="$PROJECT_ROOT/data"
DB_FILE="$DATA_DIR/bip.db"
CLAWDBOT_CONFIG="$HOME/.clawdbot/clawdbot.json"

TWITTER_HANDLE="Toporcalibur"

# Alert thresholds
TWEET_LIKES_THRESHOLD=50
TWEET_CHECK_HOURS=2
FOLLOWER_GROWTH_THRESHOLD=10

# Validate numeric thresholds
[[ "$TWEET_LIKES_THRESHOLD" =~ ^[0-9]+$ ]] || { echo "ERROR: TWEET_LIKES_THRESHOLD must be numeric"; exit 1; }
[[ "$TWEET_CHECK_HOURS" =~ ^[0-9]+$ ]] || { echo "ERROR: TWEET_CHECK_HOURS must be numeric"; exit 1; }
[[ "$FOLLOWER_GROWTH_THRESHOLD" =~ ^[0-9]+$ ]] || { echo "ERROR: FOLLOWER_GROWTH_THRESHOLD must be numeric"; exit 1; }

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

# Check dependencies
if ! command -v sqlite3 &> /dev/null; then
    log "ERROR: sqlite3 not found. Install with: brew install sqlite"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    log "ERROR: jq not found. Install with: brew install jq"
    exit 1
fi

if ! command -v curl &> /dev/null; then
    log "ERROR: curl not found"
    exit 1
fi

if [ ! -f "$DB_FILE" ]; then
    log "ERROR: Database not found at $DB_FILE"
    exit 1
fi

if [ ! -f "$CLAWDBOT_CONFIG" ]; then
    log "ERROR: ClawdBot config not found at $CLAWDBOT_CONFIG"
    exit 1
fi

# Extract Telegram bot token and chat ID
BOT_TOKEN=$(jq -r '.channels.telegram.botToken' "$CLAWDBOT_CONFIG")
CHAT_ID=$(jq -r '.channels.telegram.allowFrom[0]' "$CLAWDBOT_CONFIG")

if [ -z "$BOT_TOKEN" ] || [ "$BOT_TOKEN" = "null" ]; then
    log "ERROR: Bot token not found in ClawdBot config"
    exit 1
fi

if [ -z "$CHAT_ID" ] || [ "$CHAT_ID" = "null" ]; then
    log "ERROR: Chat ID not found in ClawdBot config"
    exit 1
fi

log "Starting Twitter alerts check"

# Function to send Telegram message
send_telegram() {
    local message="$1"
    local response
    local json_payload

    # Use jq with stdin (-Rsc) to properly escape newlines and output compact JSON
    json_payload=$(printf '%s' "$message" | jq -Rsc --arg chat_id "$CHAT_ID" \
        '{chat_id: $chat_id, text: ., parse_mode: "HTML"}')

    response=$(curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
        -H "Content-Type: application/json" \
        -d "$json_payload")

    if echo "$response" | jq -e '.ok' > /dev/null 2>&1; then
        log "  Telegram message sent successfully"
        return 0
    else
        log "  ERROR: Failed to send Telegram message"
        log "  Response: $response"
        return 1
    fi
}

# Function to check if alert was already sent
alert_sent() {
    local alert_type="$1"
    local ref_id="$2"
    local count

    # Escape single quotes for SQL injection protection
    alert_type="${alert_type//\'/\'\'}"
    ref_id="${ref_id//\'/\'\'}"

    count=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM alerts_sent WHERE alert_type='$alert_type' AND ref_id='$ref_id';")
    [ "$count" -gt 0 ]
}

# Function to mark alert as sent
mark_alert_sent() {
    local alert_type="$1"
    local ref_id="$2"

    # Escape single quotes for SQL injection protection
    alert_type="${alert_type//\'/\'\'}"
    ref_id="${ref_id//\'/\'\'}"

    sqlite3 "$DB_FILE" "INSERT INTO alerts_sent (alert_type, ref_id) VALUES ('$alert_type', '$ref_id');"
}

# 1. Check tweet growth alerts
log "Checking tweet growth..."

# Find tweets with significant likes that were created/updated recently
# Since we don't have historical snapshots per tweet, we check:
# 1. Tweet has >= threshold likes
# 2. Tweet was updated in last N hours (snapshot_at)
# 3. Tweet creation is recent (created_at within reasonable window)
GROWING_TWEETS=$(sqlite3 -separator '|' "$DB_FILE" << SQL
SELECT
  tweet_id,
  content,
  likes,
  created_at,
  snapshot_at
FROM tweets
WHERE likes >= ${TWEET_LIKES_THRESHOLD}
  AND snapshot_at >= datetime('now', '-${TWEET_CHECK_HOURS} hours')
  AND created_at >= datetime('now', '-7 days')
ORDER BY likes DESC
LIMIT 3;
SQL
)

if [ -n "$GROWING_TWEETS" ]; then
    ALERT_COUNT=0
    while IFS='|' read -r tweet_id content likes created_at snapshot_at; do
        # Check if alert already sent for this tweet
        if alert_sent "tweet_growth" "$tweet_id"; then
            log "  Tweet $tweet_id: already alerted ($likes likes)"
            continue
        fi

        # Truncate content to 100 chars
        content_truncated="${content:0:100}"
        if [ ${#content} -gt 100 ]; then
            content_truncated="${content_truncated}..."
        fi

        # Escape HTML special chars for Telegram
        content_truncated=$(echo "$content_truncated" | sed 's/&/\&amp;/g; s/</\&lt;/g; s/>/\&gt;/g')

        # Build alert message
        message="🚀 <b>Твой твит взлетает!</b>

\"${content_truncated}\"

${likes} лайков
→ https://x.com/${TWITTER_HANDLE}/status/${tweet_id}"

        log "  Sending alert for tweet $tweet_id ($likes likes)"

        if send_telegram "$message"; then
            mark_alert_sent "tweet_growth" "$tweet_id"
            ALERT_COUNT=$((ALERT_COUNT + 1))
        else
            # Mark as sent anyway to prevent infinite retry loops
            log "  WARNING: Failed to send alert, marking as sent to prevent retries"
            mark_alert_sent "tweet_growth" "$tweet_id"
        fi
    done <<< "$GROWING_TWEETS"

    log "  Sent $ALERT_COUNT tweet growth alerts"
else
    log "  No significant tweet growth detected"
fi

# 2. Check follower growth alerts
log "Checking follower growth..."

# Compare latest follower count with 24h ago
# Only alert if we have baseline data from 24+ hours ago (no COALESCE fallback)
FOLLOWER_GROWTH=$(sqlite3 -separator '|' "$DB_FILE" << SQL
WITH latest AS (
  SELECT followers, snapshot_at
  FROM profile_snapshots
  ORDER BY snapshot_at DESC
  LIMIT 1
),
yesterday AS (
  SELECT followers
  FROM profile_snapshots
  WHERE snapshot_at <= datetime('now', '-24 hours')
  ORDER BY snapshot_at DESC
  LIMIT 1
)
SELECT
  l.followers AS current_followers,
  y.followers AS yesterday_followers,
  (l.followers - y.followers) AS growth
FROM latest l
INNER JOIN yesterday y ON 1=1
WHERE y.followers IS NOT NULL
  AND (l.followers - y.followers) >= ${FOLLOWER_GROWTH_THRESHOLD};
SQL
)

if [ -n "$FOLLOWER_GROWTH" ]; then
    IFS='|' read -r current_followers yesterday_followers growth <<< "$FOLLOWER_GROWTH"

    # Use today's date as ref_id for daily follower alerts
    today_ref=$(date '+%Y-%m-%d')

    if alert_sent "follower_growth" "$today_ref"; then
        log "  Follower growth: already alerted today (growth: +$growth)"
    else
        message="📈 <b>Рост фолловеров</b>

+${growth} за сегодня (было ${yesterday_followers} → ${current_followers})"

        log "  Sending follower growth alert (growth: +$growth)"

        if send_telegram "$message"; then
            mark_alert_sent "follower_growth" "$today_ref"
            log "  Sent follower growth alert"
        else
            # Mark as sent anyway to prevent infinite retry loops
            log "  WARNING: Failed to send alert, marking as sent to prevent retries"
            mark_alert_sent "follower_growth" "$today_ref"
        fi
    fi
else
    log "  No significant follower growth detected"
fi

log "Twitter alerts check complete"
