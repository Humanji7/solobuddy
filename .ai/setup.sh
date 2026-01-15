#!/bin/bash
# SoloBuddy AI setup script

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAWDBOT_DIR="$HOME/.clawdbot"

echo "Setting up SoloBuddy AI configuration..."

# Create ClawdBot directories if needed
mkdir -p "$CLAWDBOT_DIR/skills"
mkdir -p "$CLAWDBOT_DIR/scripts"

# Symlink skills
for skill in solobuddy solobuddy-twitter twitter-expert; do
  if [ -d "$SCRIPT_DIR/skills/$skill" ]; then
    ln -sf "$SCRIPT_DIR/skills/$skill" "$CLAWDBOT_DIR/skills/$skill"
    echo "Linked skill: $skill"
  fi
done

# Symlink scripts
for script in "$SCRIPT_DIR/scripts"/*; do
  if [ -f "$script" ]; then
    ln -sf "$script" "$CLAWDBOT_DIR/scripts/$(basename "$script")"
    echo "Linked script: $(basename "$script")"
  fi
done

# Config template
if [ ! -f "$CLAWDBOT_DIR/config.json" ]; then
  echo ""
  echo "Config template available at:"
  echo "  $SCRIPT_DIR/config.example.json5"
  echo ""
  echo "Copy and edit:"
  echo "  cp $SCRIPT_DIR/config.example.json5 $CLAWDBOT_DIR/config.json"
fi

echo ""
echo "Setup complete!"
echo ""
echo "Verify with: clawdbot skills list"
