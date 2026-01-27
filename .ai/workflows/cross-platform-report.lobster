name: cross-platform-report
args:
  period:
    default: "7d"
steps:
  - id: twitter-metrics
    command: twitter-mirror report --json --period $args.period

  - id: aggregate
    command: analytics aggregate --json
    stdin: $twitter-metrics.stdout

  - id: insights
    command: solobuddy analyze-metrics --json
    stdin: $aggregate.stdout

  - id: deliver
    command: clawdbot message send --channel telegram --message "$insights.stdout"

