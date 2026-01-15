# Twitter Pipeline Quality Gates — Design Doc

> Status: APPROVED | Date: 2026-01-15

## Problem

Twitter monitor sends ALL analysis results to Telegram, even when ClawdBot concludes "nothing worth sending". User receives noise like "Оба мимо", "Пусто, братишка".

## Solution

Two-level quality gate: pre-filter (heuristic) + AI gate (ClawdBot verdict).

## Architecture

```
LaunchAgent (30 min cron)
    ↓
[LOCK] flock -n /tmp/twitter-analyze.lock || exit 0
    ↓
twitter-monitor.sh → latest-fetch.json
    ↓
twitter-analyze.sh
    ├── [L1] Pre-filter (jq, config-driven thresholds)
    ├── [GATE] if empty → log JSON + exit 0
    ├── [L2] clawdbot --json --timeout 180 (WITHOUT --deliver)
    ├── [VALIDATE] .status == "ok" || exit 1
    ├── [PARSE] case SEND:|SKIP:|* with fallback
    ├── [DELIVER] curl to Telegram + 3 retries
    └── [LOG] structured JSON to gate.log
    ↓
[UNLOCK] trap cleanup
```

## Level 1: Pre-filter (jq)

Config-driven thresholds at script top:

```bash
L1_MIN_LIKES=100
L1_MAX_AGE_SEC=7200      # 2 hours
L1_MAX_REPLIES=20
```

Filter logic:

```jq
.tweets | map(select(
    .likeCount >= $minLikes and
    ((now - (.createdAt | fromdateiso8601)) <= $maxAge) and
    .replyCount <= $maxReplies and
    (.author.username | test("(Inc|HQ|Official|_io)$"; "i") | not) and
    (.text | test("hiring|join us|we.re (hiring|looking)|присоединяйся|вакансия"; "i") | not)
))
```

## Level 2: AI Gate (ClawdBot)

### Prompt Addition

Add to MESSAGE before sending to ClawdBot:

```
ВАЖНО: Начни ответ с вердикта в первой строке:
- SEND: [краткая причина] — если есть хотя бы 1 качественная возможность
- SKIP: [краткая причина] — если ничего не стоит внимания

Критерии качества:
- Тема резонирует с Jester-Sage (код, философия, инди-хакинг)
- Есть уникальный угол для комментария
- Автор — человек, не корпорация
- Не реклама, не рекрутинг

После вердикта — анализ как обычно.
```

### ClawdBot Call

```bash
response=$(clawdbot agent --to "$CHAT_ID" --message "$MSG" --json --timeout 180)

status=$(echo "$response" | jq -r '.status')
if [ "$status" != "ok" ]; then
    log ERROR "ClawdBot failed" '{"status": "'"$status"'"}'
    exit 1
fi

analysis=$(echo "$response" | jq -r '.result.payloads[0].text')
```

### Verdict Parsing (Robust)

```bash
verdict=$(echo "$analysis" | head -c 500 | tr -d '\r' | sed 's/^[[:space:]]*//')

case "$verdict" in
    SEND:*)
        reason=$(echo "$verdict" | sed 's/^SEND:[[:space:]]*//')
        log INFO "L2 verdict: SEND" '{"reason": "'"$reason"'"}'
        deliver "$analysis"
        ;;
    SKIP:*)
        reason=$(echo "$verdict" | sed 's/^SKIP:[[:space:]]*//')
        log INFO "L2 verdict: SKIP" '{"reason": "'"$reason"'"}'
        ;;
    *)
        log ERROR "Invalid verdict format" '{"verdict": "'"${verdict:0:100}"'"}'
        echo "$analysis" > "/tmp/twitter-analyze-error-$(date +%s).txt"
        exit 1
        ;;
esac
```

## Delivery (Telegram)

```bash
deliver() {
    local text="$1"
    local max_attempts=3
    local attempt=1

    payload=$(jq -n --arg text "$text" --arg chat "$CHAT_ID" '{
        chat_id: $chat,
        text: $text,
        parse_mode: "Markdown"
    }')

    while [ $attempt -le $max_attempts ]; do
        if curl -sf -X POST "https://api.telegram.org/bot$TELEGRAM_TOKEN/sendMessage" \
            -H "Content-Type: application/json" \
            -d "$payload"; then
            log INFO "Delivered" '{"attempt": '$attempt'}'
            return 0
        fi

        log WARN "Delivery failed" '{"attempt": '$attempt'}'
        sleep $((2 ** attempt))
        ((attempt++))
    done

    log ERROR "Delivery failed after retries" '{}'
    return 1
}
```

## Observability

### Log File

`~/projects/bip-buddy/data/twitter/gate.log`

### Log Function (Structured JSON)

```bash
log() {
    local level="$1"
    local message="$2"
    local data="${3:-{}}"

    jq -n \
        --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        --arg lvl "$level" \
        --arg msg "$message" \
        --argjson data "$data" \
        '{timestamp: $ts, level: $lvl, message: $msg, data: $data}' \
        >> "$LOG_FILE"
}
```

### Log Rotation

```bash
if [ $(wc -l < "$LOG_FILE" 2>/dev/null || echo 0) -gt 10000 ]; then
    tail -5000 "$LOG_FILE" > "$LOG_FILE.tmp"
    mv "$LOG_FILE.tmp" "$LOG_FILE"
    log INFO "Log rotated" '{}'
fi
```

## Safety Mechanisms

### Lock (flock)

```bash
LOCK_FILE="/tmp/twitter-analyze.lock"
exec 200>"$LOCK_FILE"
flock -n 200 || {
    echo "Already running, skipping" >&2
    exit 0
}
trap 'flock -u 200; rm -f "$LOCK_FILE"' EXIT INT TERM
```

### Sanitize Before Logging

```bash
sanitize() {
    echo "$1" | sed -E 's/(token|key|secret|AUTH_TOKEN|CT0)=[^&[:space:]]*/\1=***REDACTED***/gi'
}
```

## Files to Modify

| File | Action |
|------|--------|
| `~/.clawdbot/scripts/twitter-analyze.sh` | Rewrite with quality gates |
| `~/projects/bip-buddy/data/twitter/gate.log` | New file (created automatically) |

## Config Requirements

Environment variables or from `~/.clawdbot/clawdbot.json`:
- `TELEGRAM_TOKEN` — Bot token for delivery
- `CHAT_ID` — Target chat (currently: 6536979676)

## Testing Checklist

```bash
# 1. Test L1 filter with empty result
echo '{"tweets":[]}' > /tmp/test-empty.json
# Should: exit 0, log "L1: 0 passed"

# 2. Test L1 filter with corporate account
echo '{"tweets":[{"likeCount":500,"replyCount":5,"createdAt":"2026-01-15T12:00:00Z","author":{"username":"RedisInc"},"text":"Fast!"}]}' > /tmp/test-corp.json
# Should: exit 0, filtered out

# 3. Test L2 with malformed verdict
# Manually send to ClawdBot, check error handling

# 4. Test concurrent runs
./twitter-analyze.sh & ./twitter-analyze.sh &
# Should: second exits immediately with "Already running"

# 5. Test Telegram delivery failure
# Set invalid TELEGRAM_TOKEN, check retry + error log
```

## Success Criteria

- No notifications when nothing worth sending
- All decisions logged with reasons
- No silent failures
- Concurrent runs handled gracefully
