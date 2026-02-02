#!/bin/bash
# Start Vision (Claude Code + Telegram) in tmux session
#
# Usage:
#   ./scripts/start-vision.sh        # Start new session
#   ./scripts/start-vision.sh attach # Attach to existing session
#   ./scripts/start-vision.sh stop   # Stop session

set -e

SESSION_NAME="vision"
PROJECT_DIR="/Users/admin/projects/bip-buddy"
CLAUDE_BIN="/opt/homebrew/bin/claude"

cd "$PROJECT_DIR"

case "${1:-start}" in
    start)
        # Check if session exists
        if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
            echo "Session '$SESSION_NAME' already running"
            echo "Use: $0 attach"
            exit 0
        fi

        # Create new detached tmux session
        tmux new-session -d -s "$SESSION_NAME" -c "$PROJECT_DIR"

        # Start Claude Code with initial prompt
        tmux send-keys -t "$SESSION_NAME" "$CLAUDE_BIN --dangerously-skip-permissions" Enter

        # Wait for Claude to start
        sleep 3

        # Send initial context
        tmux send-keys -t "$SESSION_NAME" "Ты Vision — AI-ассистент для Build in Public. Слушай Telegram и помогай с контентом. Используй idea_bank: uv run python -m vision.skills.idea_bank <command>" Enter

        echo "Vision started in tmux session '$SESSION_NAME'"
        echo "Attach: tmux attach -t $SESSION_NAME"
        ;;

    attach)
        if ! tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
            echo "Session '$SESSION_NAME' not found. Starting..."
            exec "$0" start
        fi
        tmux attach -t "$SESSION_NAME"
        ;;

    stop)
        if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
            tmux kill-session -t "$SESSION_NAME"
            echo "Session '$SESSION_NAME' stopped"
        else
            echo "Session '$SESSION_NAME' not running"
        fi
        ;;

    status)
        if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
            echo "Vision is running"
            tmux list-windows -t "$SESSION_NAME"
        else
            echo "Vision is not running"
            exit 1
        fi
        ;;

    *)
        echo "Usage: $0 {start|attach|stop|status}"
        exit 1
        ;;
esac
