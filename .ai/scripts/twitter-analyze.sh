#!/bin/bash
# Twitter analyzer with quality gates
# Level 1: Pre-filter (jq heuristics)
# Level 2: AI gate (ClawdBot verdict)
# Triggered after twitter-monitor.sh collects fresh tweets

set -euo pipefail

# ============================================
# CONFIG
# ============================================

CHAT_ID="6536979676"
DATA_DIR="$HOME/projects/bip-buddy/data/twitter"
LATEST_FILE="$DATA_DIR/latest-fetch.json"
SEEN_FILE="$DATA_DIR/seen-tweets.json"
LOG_FILE="$DATA_DIR/gate.log"
LOCK_FILE="/tmp/twitter-analyze.lock"
CLAWDBOT_CONFIG="$HOME/.clawdbot/clawdbot.json"

# L1 Pre-filter thresholds
L1_MIN_LIKES=100
L1_MAX_AGE_SEC=7200      # 2 hours
L1_MAX_REPLIES=20

# ============================================
# LOCK (shlock for macOS, flock fallback)
# ============================================

acquire_lock() {
    if command -v shlock >/dev/null 2>&1; then
        shlock -f "$LOCK_FILE" -p $$ || return 1
        trap 'rm -f "$LOCK_FILE"' EXIT INT TERM
    elif command -v flock >/dev/null 2>&1; then
        exec 200>"$LOCK_FILE"
        flock -n 200 || return 1
        trap 'flock -u 200; rm -f "$LOCK_FILE"' EXIT INT TERM
    else
        mkdir "$LOCK_FILE.d" 2>/dev/null || return 1
        trap 'rmdir "$LOCK_FILE.d" 2>/dev/null' EXIT INT TERM
    fi
}

acquire_lock || { echo "Already running, skipping" >&2; exit 0; }

# ============================================
# TELEGRAM TOKEN
# ============================================

TELEGRAM_TOKEN=$(jq -r '.channels.telegram.botToken // empty' "$CLAWDBOT_CONFIG")
if [ -z "$TELEGRAM_TOKEN" ]; then
    echo "ERROR: TELEGRAM_TOKEN not found in $CLAWDBOT_CONFIG" >&2
    exit 1
fi

# ============================================
# LOGGING (Structured JSON)
# ============================================

sanitize() {
    echo "$1" | sed -E \
        -e 's/(token|key|secret|AUTH_TOKEN|CT0|botToken)=[^&[:space:]]*/\1=***REDACTED***/gi' \
        -e 's/bot[0-9]+:[A-Za-z0-9_-]+/bot***:***REDACTED***/g'
}

log() {
    local level="$1"
    local message="$2"
    local data="$3"

    # Default to empty object if not provided
    [ -z "$data" ] && data='{}'

    # Sanitize data before logging
    data=$(sanitize "$data")

    jq -n \
        --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        --arg lvl "$level" \
        --arg msg "$message" \
        --argjson data "$data" \
        '{timestamp: $ts, level: $lvl, message: $msg, data: $data}' \
        >> "$LOG_FILE"
}

# ============================================
# LOG ROTATION
# ============================================

rotate_log() {
    if [ -f "$LOG_FILE" ] && [ "$(wc -l < "$LOG_FILE" 2>/dev/null || echo 0)" -gt 10000 ]; then
        tail -5000 "$LOG_FILE" > "$LOG_FILE.tmp"
        mv "$LOG_FILE.tmp" "$LOG_FILE"
        log INFO "Log rotated" '{}'
    fi
}

# ============================================
# TELEGRAM DELIVERY
# ============================================

deliver() {
    local text="$1"
    local max_attempts=3
    local attempt=1
    local payload

    payload=$(jq -n --arg text "$text" --arg chat "$CHAT_ID" '{
        chat_id: $chat,
        text: $text,
        parse_mode: "Markdown"
    }')

    while [ $attempt -le $max_attempts ]; do
        if curl -sf -X POST "https://api.telegram.org/bot$TELEGRAM_TOKEN/sendMessage" \
            -H "Content-Type: application/json" \
            -d "$payload" > /dev/null 2>&1; then
            log INFO "Delivered to Telegram" '{"attempt": '"$attempt"'}'
            return 0
        fi

        log WARN "Delivery attempt failed" '{"attempt": '"$attempt"'}'
        sleep $((2 ** attempt))
        ((attempt++))
    done

    log ERROR "Delivery failed after all retries" '{"max_attempts": '"$max_attempts"'}'
    return 1
}

# ============================================
# MAIN
# ============================================

rotate_log

log INFO "Pipeline started" '{}'

# Check if latest fetch exists
if [ ! -f "$LATEST_FILE" ]; then
    log INFO "No latest fetch file found" '{"file": "'"$LATEST_FILE"'"}'
    exit 0
fi

# Load seen tweets
[ -f "$SEEN_FILE" ] || echo '[]' > "$SEEN_FILE"
SEEN_IDS=$(cat "$SEEN_FILE")

# Get new tweets (not in seen)
NEW_TWEETS=$(jq --argjson seen "$SEEN_IDS" '
    .tweets | map(select(.id as $id | $seen | index($id) | not))
' "$LATEST_FILE")

NEW_COUNT=$(echo "$NEW_TWEETS" | jq 'length')

if [ "$NEW_COUNT" -eq 0 ]; then
    log INFO "No new tweets to analyze" '{"total": 0}'
    exit 0
fi

log INFO "Found new tweets" '{"count": '"$NEW_COUNT"'}'

# ============================================
# LEVEL 1: PRE-FILTER (jq heuristics)
# ============================================

FILTERED_TWEETS=$(echo "$NEW_TWEETS" | jq --argjson minLikes "$L1_MIN_LIKES" \
    --argjson maxAge "$L1_MAX_AGE_SEC" \
    --argjson maxReplies "$L1_MAX_REPLIES" '
    map(select(
        .likeCount >= $minLikes and
        ((now - (.createdAt | fromdateiso8601)) <= $maxAge) and
        .replyCount <= $maxReplies and
        (.author.username | test("(Inc|HQ|Official|_io)$"; "i") | not) and
        (.text | test("hiring|join us|we.re (hiring|looking)|присоединяйся|вакансия"; "i") | not)
    ))
')

FILTERED_COUNT=$(echo "$FILTERED_TWEETS" | jq 'length')

log INFO "L1 pre-filter complete" '{"input": '"$NEW_COUNT"', "passed": '"$FILTERED_COUNT"', "thresholds": {"minLikes": '"$L1_MIN_LIKES"', "maxAgeSec": '"$L1_MAX_AGE_SEC"', "maxReplies": '"$L1_MAX_REPLIES"'}}'

# Prepare tweet IDs for marking as seen later
TWEET_IDS=$(echo "$NEW_TWEETS" | jq '[.[].id]')

# Helper to mark tweets as seen
mark_seen() {
    local updated
    updated=$(echo "$SEEN_IDS" | jq --argjson new "$TWEET_IDS" '. + $new | unique')
    echo "$updated" > "$SEEN_FILE"
}

if [ "$FILTERED_COUNT" -eq 0 ]; then
    mark_seen  # Safe to mark - L1 made the decision
    log INFO "L1: All tweets filtered out" '{"reason": "no_quality_tweets"}'
    exit 0
fi

# ============================================
# FORMAT TWEETS FOR CLAWDBOT
# ============================================

# Take top 5 most engaging (by likes + replies)
TOP_TWEETS=$(echo "$FILTERED_TWEETS" | jq -r '
    sort_by(-(.likeCount + .replyCount)) | .[0:5] |
    to_entries | map(
        "[\(.key + 1)] @\(.value.author.username): \(.value.text | .[0:200] | gsub("\n"; " "))... | https://x.com/\(.value.author.username)/status/\(.value.id) | likes: \(.value.likeCount) replies: \(.value.replyCount)"
    ) | join("\n\n")
')

# ============================================
# LEVEL 2: AI GATE (ClawdBot verdict)
# ============================================

MESSAGE="ВАЖНО: Начни ответ с вердикта в первой строке:
- SEND: [краткая причина] — если есть хотя бы 1 качественная возможность
- SKIP: [краткая причина] — если ничего не стоит внимания

Критерии качества:
- Тема резонирует с Jester-Sage (код, философия, инди-хакинг)
- Есть уникальный угол для комментария
- Автор — человек, не корпорация
- Не реклама, не рекрутинг

После вердикта — анализ как обычно.

---

Новые твиты из watchlist:

$TOP_TWEETS

---
Проанализируй эти твиты для engagement. Мой голос: Jester-Sage (ироничный, сырой, философский).

Для лучших:
1. ОБЯЗАТЕЛЬНО дай прямую ссылку на твит (https://x.com/...)
2. Предложи драфт комментария
3. Объясни ПОЧЕМУ это хорошая возможность

Формат ответа:
🎯 @username — краткая суть
🔗 ссылка
💬 драфт комментария
💡 почему стоит"

log INFO "Calling ClawdBot L2" '{"tweets_count": '"$FILTERED_COUNT"'}'

# Call ClawdBot with --json (WITHOUT --deliver)
response=$(clawdbot agent \
    --channel telegram \
    --to "$CHAT_ID" \
    --message "$MESSAGE" \
    --json \
    --timeout 180 2>&1) || {
    log ERROR "ClawdBot call failed" '{"error": "command_failed"}'
    exit 1
}

# Validate response
status=$(echo "$response" | jq -r '.status // "unknown"')
if [ "$status" != "ok" ]; then
    log ERROR "ClawdBot returned non-ok status" '{"status": "'"$status"'"}'
    exit 1
fi

# Extract analysis text
analysis=$(echo "$response" | jq -r '.result.payloads[0].text // empty')
if [ -z "$analysis" ]; then
    # Empty analysis is unusual but not critical - treat as SKIP
    mark_seen
    log WARN "ClawdBot returned empty analysis, treating as SKIP" '{"filtered_count": '"$FILTERED_COUNT"'}'
    exit 0
fi

# ============================================
# VERDICT PARSING (Robust)
# ============================================

# Get first line and strip markdown formatting (**, *, etc.)
first_line=$(echo "$analysis" | head -1 | tr -d '\r' | sed 's/^[[:space:]]*//; s/^[\*]*//; s/[\*]*$//')

# Check for SEND: or SKIP: anywhere in first line
if echo "$first_line" | grep -q "^SEND:"; then
    reason=$(echo "$first_line" | sed 's/^SEND:[[:space:]]*//' | head -c 100)
    log INFO "L2 verdict: SEND" '{"reason": "'"$(echo "$reason" | tr -d '"')"'"}'
    deliver "$analysis"
    mark_seen  # Mark after successful delivery
elif echo "$first_line" | grep -q "^SKIP:"; then
    reason=$(echo "$first_line" | sed 's/^SKIP:[[:space:]]*//' | head -c 100)
    log INFO "L2 verdict: SKIP" '{"reason": "'"$(echo "$reason" | tr -d '"')"'"}'
    mark_seen  # Mark after L2 decision
else
    # Fallback: log error and dump analysis for debugging
    # Do NOT mark_seen - tweets will be retried next run
    safe_verdict=$(echo "$first_line" | head -c 100 | tr -d '"' | tr -d "'")
    log ERROR "Invalid verdict format" '{"verdict_start": "'"$safe_verdict"'"}'
    echo "$analysis" > "/tmp/twitter-analyze-error-$(date +%s).txt"
    exit 1
fi

log INFO "Pipeline completed" '{}'
