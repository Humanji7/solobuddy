name: multi-platform-post
args:
  idea:
    default: ""
  platforms:
    default: "twitter,linkedin,telegram"
steps:
  - id: generate
    command: solobuddy generate --json
    stdin: $args.idea

  - id: humanize
    command: solobuddy humanize --json
    stdin: $generate.stdout

  - id: adapt-twitter
    command: twitter-expert adapt --json
    stdin: $humanize.stdout
    condition: $args.platforms contains "twitter"

  - id: adapt-linkedin
    command: linkedin-expert adapt --json
    stdin: $humanize.stdout
    condition: $args.platforms contains "linkedin"

  - id: adapt-telegram
    command: telegram-expert adapt --json
    stdin: $humanize.stdout
    condition: $args.platforms contains "telegram"

  - id: adapt-facebook
    command: facebook-expert adapt --json
    stdin: $humanize.stdout
    condition: $args.platforms contains "facebook"

  - id: adapt-threads
    command: threads-expert adapt --json
    stdin: $humanize.stdout
    condition: $args.platforms contains "threads"

  - id: review
    command: approve --preview-from-stdin
    approval: required

  - id: save-drafts
    command: solobuddy save-drafts --json
    condition: $review.approved

