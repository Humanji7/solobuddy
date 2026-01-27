name: cross-platform-report
args:
  period:
    default: "7d"
  dryRun:
    default: false
steps:
  - id: twitter-metrics
    command: |
      set -euo pipefail
      period="${period}"
      db="/Users/admin/projects/bip-buddy/data/bip.db"

      if [ ! -f "$db" ]; then
        echo '{"kind":"cross-platform-report","ok":false,"error":"missing_db","db":"'"$db"'"}'
        exit 0
      fi

      n="${period%?}"
      u="${period#"$n"}"
      case "$u" in
        d) mod="-$n days" ;;
        h) mod="-$n hours" ;;
        w) mod="-$((n * 7)) days" ;;
        *) mod="-7 days" ;;
      esac

      sqlite3 -json "$db" "
        SELECT
          'cross-platform-report' AS kind,
          '$period' AS period,
          (
            SELECT json_object(
              'tweets', COUNT(*),
              'likes', COALESCE(SUM(likes),0),
              'retweets', COALESCE(SUM(retweets),0),
              'replies', COALESCE(SUM(replies),0),
              'views', COALESCE(SUM(views),0),
              'top', (
                SELECT COALESCE(json_group_array(json_object(
                  'tweet_id', tweet_id,
                  'created_at', created_at,
                  'likes', likes,
                  'retweets', retweets,
                  'replies', replies,
                  'views', views,
                  'content', substr(content, 1, 240)
                )), '[]')
                FROM (
                  SELECT tweet_id, created_at, likes, retweets, replies, views, content
                  FROM tweets
                  WHERE created_at >= datetime('now', '$mod')
                  ORDER BY views DESC
                  LIMIT 5
                )
              )
            )
            FROM tweets
            WHERE created_at >= datetime('now', '$mod')
          ) AS twitter,
          (
            SELECT json_object(
              'followers_start', COALESCE((SELECT followers FROM profile_snapshots WHERE snapshot_at >= datetime('now', '$mod') ORDER BY snapshot_at ASC LIMIT 1), 0),
              'followers_end', COALESCE((SELECT followers FROM profile_snapshots ORDER BY snapshot_at DESC LIMIT 1), 0),
              'following_start', COALESCE((SELECT following FROM profile_snapshots WHERE snapshot_at >= datetime('now', '$mod') ORDER BY snapshot_at ASC LIMIT 1), 0),
              'following_end', COALESCE((SELECT following FROM profile_snapshots ORDER BY snapshot_at DESC LIMIT 1), 0)
            )
          ) AS profile
        ;
      "

  - id: insights
    command: |
      set -euo pipefail
      metrics="$(cat)"
      prompt="$(printf '%s\n' \
        'You are a build-in-public marketing analyst.' \
        '' \
        'Write a concise weekly report for the creator based on these metrics.' \
        '' \
        'Rules:' \
        '- Same language as the metrics content (if mixed, use English)' \
        '- Bullet points only' \
        '- Highlight: what worked, what didn''t, 1–3 next actions, and best tweet(s)' \
        '- Output ONLY the report text (no analysis, no code fences)' \
        '' \
        'Metrics JSON:' \
        "$metrics" \
      )"

      clawdbot agent \
        --session-id lobster:cross-platform-report:insights \
        --thinking minimal \
        --message "$prompt" \
        --json \
      | jq -r '.result.payloads[0].text'

    stdin: $twitter-metrics.stdout

  - id: deliver
    command: |
      set -euo pipefail
      dry="${dryRun}"
      msg="$(cat)"
      if [ "$dry" = "true" ]; then
        clawdbot message send --channel telegram --to 6536979676 --message "$msg" --dry-run --json
      else
        clawdbot message send --channel telegram --to 6536979676 --message "$msg" --json
      fi
    stdin: $insights.stdout
