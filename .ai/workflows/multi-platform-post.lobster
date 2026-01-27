name: multi-platform-post
args:
  idea:
    default: ""
  platforms:
    default: "twitter,linkedin,telegram"
env:
  PLATFORMS: ${platforms}
steps:
  - id: generate
    command: |
      set -euo pipefail
      idea="$(cat)"
      prompt="$(printf '%s\n' \
        'You are SoloBuddy (build-in-public content assistant).' \
        '' \
        'MODE: IDEA → DRAFT' \
        'Generate a base draft that can be adapted for multiple platforms later.' \
        '' \
        'Rules:' \
        '- First person ("I")' \
        '- Same language as the idea' \
        '- 2–4 sentences max' \
        '- One idea only, specific details' \
        '- No hashtags unless explicitly requested' \
        '- Output ONLY the draft text (no analysis, no headings, no code fences)' \
        '' \
        'Idea:' \
        "$idea" \
      )"

      clawdbot agent \
        --session-id lobster:multi-platform-post:generate \
        --thinking minimal \
        --message "$prompt" \
        --json \
      | jq -r '.result.payloads[0].text'

    stdin: ${idea}

  - id: humanize
    command: |
      set -euo pipefail
      draft="$(cat)"
      prompt="$(printf '%s\n' \
        'You are SoloBuddy.' \
        '' \
        'Task: Humanize this draft. Remove AI-writing patterns, keep meaning, keep voice.' \
        '' \
        'Rules:' \
        '- Keep it short (2–4 sentences)' \
        '- Keep first-person voice' \
        '- Output ONLY the final humanized text (no analysis, no headings, no code fences)' \
        '' \
        'Draft:' \
        "$draft" \
      )"

      clawdbot agent \
        --session-id lobster:multi-platform-post:humanize \
        --thinking minimal \
        --message "$prompt" \
        --json \
      | jq -r '.result.payloads[0].text'

    stdin: $generate.stdout

  - id: adapt-twitter
    command: |
      set -euo pipefail
      draft="$(cat)"
      case ",$PLATFORMS," in
        *,twitter,*) ;;
        *) exit 0 ;;
      esac

      prompt="$(printf '%s\n' \
        'You are a Twitter/X content expert for indie hackers.' \
        '' \
        'MODE: DRAFT → REVIEW' \
        'Adapt the draft for X/Twitter.' \
        '' \
        'Rules:' \
        '- Keep it within 280 chars (single tweet), unless a thread opener is clearly better' \
        '- No external links in the main tweet' \
        '- No hashtags unless explicitly requested' \
        '- Output ONLY the final tweet text (no analysis, no headings, no code fences)' \
        '' \
        'Draft:' \
        "$draft" \
      )"

      clawdbot agent \
        --session-id lobster:multi-platform-post:adapt-twitter \
        --thinking minimal \
        --message "$prompt" \
        --json \
      | jq -r '.result.payloads[0].text'

    stdin: $humanize.stdout

  - id: adapt-linkedin
    command: |
      set -euo pipefail
      draft="$(cat)"
      case ",$PLATFORMS," in
        *,linkedin,*) ;;
        *) exit 0 ;;
      esac

      prompt="$(printf '%s\n' \
        'You are a LinkedIn content expert for founders.' \
        '' \
        'MODE: DRAFT → REVIEW' \
        'Adapt the draft for LinkedIn.' \
        '' \
        'Rules:' \
        '- Hook in first 2 lines (before "see more")' \
        '- Skimmable: short paragraphs, whitespace' \
        '- No outbound links in the post body' \
        '- End with a thoughtful question' \
        '- Output ONLY the final LinkedIn post text (no analysis, no headings, no code fences)' \
        '' \
        'Draft:' \
        "$draft" \
      )"

      clawdbot agent \
        --session-id lobster:multi-platform-post:adapt-linkedin \
        --thinking minimal \
        --message "$prompt" \
        --json \
      | jq -r '.result.payloads[0].text'

    stdin: $humanize.stdout

  - id: adapt-telegram
    command: |
      set -euo pipefail
      draft="$(cat)"
      case ",$PLATFORMS," in
        *,telegram,*) ;;
        *) exit 0 ;;
      esac

      prompt="$(printf '%s\n' \
        'You are a Telegram channel content expert for build-in-public creators.' \
        '' \
        'MODE: DRAFT → REVIEW' \
        'Adapt the draft for a Telegram channel post.' \
        '' \
        'Rules:' \
        '- 200–500 chars when possible' \
        '- Quick update style, raw/human tone' \
        '- Add line breaks for scannability' \
        '- Output ONLY the final Telegram post text (no analysis, no headings, no code fences)' \
        '' \
        'Draft:' \
        "$draft" \
      )"

      clawdbot agent \
        --session-id lobster:multi-platform-post:adapt-telegram \
        --thinking minimal \
        --message "$prompt" \
        --json \
      | jq -r '.result.payloads[0].text'

    stdin: $humanize.stdout

  - id: adapt-facebook
    command: |
      set -euo pipefail
      draft="$(cat)"
      case ",$PLATFORMS," in
        *,facebook,*) ;;
        *) exit 0 ;;
      esac

      prompt="$(printf '%s\n' \
        'You are a Facebook content expert for groups/pages.' \
        '' \
        'MODE: DRAFT → REVIEW' \
        'Adapt the draft for Facebook.' \
        '' \
        'Rules:' \
        '- Plain language, 3–5 sentences' \
        '- No external links in the post body' \
        '- End with a question that invites real replies' \
        '- Output ONLY the final Facebook post text (no analysis, no headings, no code fences)' \
        '' \
        'Draft:' \
        "$draft" \
      )"

      clawdbot agent \
        --session-id lobster:multi-platform-post:adapt-facebook \
        --thinking minimal \
        --message "$prompt" \
        --json \
      | jq -r '.result.payloads[0].text'

    stdin: $humanize.stdout

  - id: adapt-threads
    command: |
      set -euo pipefail
      draft="$(cat)"
      case ",$PLATFORMS," in
        *,threads,*) ;;
        *) exit 0 ;;
      esac

      prompt="$(printf '%s\n' \
        'You are a Threads content expert for founders/creators.' \
        '' \
        'MODE: DRAFT → REVIEW' \
        'Adapt the draft for Threads.' \
        '' \
        'Rules:' \
        '- Casual tone, short and readable (≈500 chars max)' \
        '- End with an inviting question' \
        '- Avoid LinkedIn-formal tone' \
        '- Output ONLY the final Threads post text (no analysis, no headings, no code fences)' \
        '' \
        'Draft:' \
        "$draft" \
      )"

      clawdbot agent \
        --session-id lobster:multi-platform-post:adapt-threads \
        --thinking minimal \
        --message "$prompt" \
        --json \
      | jq -r '.result.payloads[0].text'

    stdin: $humanize.stdout

  - id: review
    command: cat
    stdin: |
      === Base draft (generated) ===
      $generate.stdout

      === Humanized base draft ===
      $humanize.stdout

      === Twitter/X ===
      $adapt-twitter.stdout

      === LinkedIn ===
      $adapt-linkedin.stdout

      === Telegram ===
      $adapt-telegram.stdout

      === Facebook ===
      $adapt-facebook.stdout

      === Threads ===
      $adapt-threads.stdout
    approval: required

  - id: save-drafts
    command: |
      set -euo pipefail
      ts="$(date +%Y%m%d-%H%M%S)"
      dir="drafts/lobster"
      mkdir -p "$dir"
      out="$dir/${ts}-multi-platform.md"
      cat > "$out"
      echo "saved: $out"
    stdin: |
      === Base draft (generated) ===
      $generate.stdout

      === Humanized base draft ===
      $humanize.stdout

      === Twitter/X ===
      $adapt-twitter.stdout

      === LinkedIn ===
      $adapt-linkedin.stdout

      === Telegram ===
      $adapt-telegram.stdout

      === Facebook ===
      $adapt-facebook.stdout

      === Threads ===
      $adapt-threads.stdout
    condition: $review.approved
