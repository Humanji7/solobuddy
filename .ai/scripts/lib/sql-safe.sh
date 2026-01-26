#!/bin/bash
# Safe SQL operations for SQLite
# Prevents SQL injection through proper escaping

# Escape string for SQLite (handles quotes, newlines, etc.)
# Usage: escaped=$(sql_escape "$value")
sql_escape() {
    local value="$1"
    # Replace single quotes with two single quotes (SQL standard)
    # Also handle backslashes and newlines
    printf '%s' "$value" | sed "s/'/''/g"
}

# Validate that value is numeric (integer)
# Usage: sql_validate_int "$value" || exit 1
sql_validate_int() {
    local value="$1"
    if [[ "$value" =~ ^-?[0-9]+$ ]]; then
        return 0
    else
        echo "ERROR: Expected integer, got: $value" >&2
        return 1
    fi
}

# Validate that value looks like a tweet ID (numeric string)
# Usage: sql_validate_tweet_id "$value" || exit 1
sql_validate_tweet_id() {
    local value="$1"
    if [[ "$value" =~ ^[0-9]+$ ]]; then
        return 0
    else
        echo "ERROR: Invalid tweet_id format: $value" >&2
        return 1
    fi
}

# Validate alphanumeric + underscore (for identifiers)
# Usage: sql_validate_identifier "$value" || exit 1
sql_validate_identifier() {
    local value="$1"
    if [[ "$value" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]]; then
        return 0
    else
        echo "ERROR: Invalid identifier: $value" >&2
        return 1
    fi
}

# Safe INSERT for tweets table
# Usage: sql_insert_tweet "$db" "$tweet_id" "$text" "$created_at" "$likes" "$replies" "$retweets" "$views"
sql_insert_tweet() {
    local db="$1"
    local tweet_id="$2"
    local text="$3"
    local created_at="$4"
    local likes="$5"
    local replies="$6"
    local retweets="$7"
    local views="$8"

    # Validate inputs
    sql_validate_tweet_id "$tweet_id" || return 1
    sql_validate_int "$likes" || return 1
    sql_validate_int "$replies" || return 1
    sql_validate_int "$retweets" || return 1
    sql_validate_int "$views" || return 1

    # Escape text content
    local escaped_text
    escaped_text=$(sql_escape "$text")

    sqlite3 "$db" "INSERT INTO tweets (tweet_id, content, created_at, likes, replies, retweets, views) VALUES ('$tweet_id', '$escaped_text', '$created_at', $likes, $replies, $retweets, $views);"
}

# Safe UPDATE for tweets table metrics
# Usage: sql_update_tweet_metrics "$db" "$tweet_id" "$likes" "$replies" "$retweets" "$views"
sql_update_tweet_metrics() {
    local db="$1"
    local tweet_id="$2"
    local likes="$3"
    local replies="$4"
    local retweets="$5"
    local views="$6"

    # Validate inputs
    sql_validate_tweet_id "$tweet_id" || return 1
    sql_validate_int "$likes" || return 1
    sql_validate_int "$replies" || return 1
    sql_validate_int "$retweets" || return 1
    sql_validate_int "$views" || return 1

    sqlite3 "$db" "UPDATE tweets SET likes = $likes, replies = $replies, retweets = $retweets, views = $views, snapshot_at = CURRENT_TIMESTAMP WHERE tweet_id = '$tweet_id';"
}

# Safe check if tweet exists
# Usage: if sql_tweet_exists "$db" "$tweet_id"; then ...
sql_tweet_exists() {
    local db="$1"
    local tweet_id="$2"

    sql_validate_tweet_id "$tweet_id" || return 1

    local count
    count=$(sqlite3 "$db" "SELECT COUNT(*) FROM tweets WHERE tweet_id='$tweet_id';")
    [ "$count" -gt 0 ]
}

# Safe check if alert was sent
# Usage: if sql_alert_exists "$db" "$alert_type" "$ref_id"; then ...
sql_alert_exists() {
    local db="$1"
    local alert_type="$2"
    local ref_id="$3"

    # Escape strings
    local escaped_type escaped_ref
    escaped_type=$(sql_escape "$alert_type")
    escaped_ref=$(sql_escape "$ref_id")

    local count
    count=$(sqlite3 "$db" "SELECT COUNT(*) FROM alerts_sent WHERE alert_type='$escaped_type' AND ref_id='$escaped_ref';")
    [ "$count" -gt 0 ]
}

# Safe INSERT for alerts_sent
# Usage: sql_insert_alert "$db" "$alert_type" "$ref_id"
sql_insert_alert() {
    local db="$1"
    local alert_type="$2"
    local ref_id="$3"

    # Escape strings
    local escaped_type escaped_ref
    escaped_type=$(sql_escape "$alert_type")
    escaped_ref=$(sql_escape "$ref_id")

    sqlite3 "$db" "INSERT INTO alerts_sent (alert_type, ref_id) VALUES ('$escaped_type', '$escaped_ref');"
}
