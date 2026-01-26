#!/bin/bash
# Setup Twitter credentials in macOS Keychain
# Run this once to securely store Bird CLI tokens

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/credentials.sh"

echo "=== BIP Buddy Credentials Setup ==="
echo ""
echo "This will store your Twitter (Bird CLI) credentials in macOS Keychain."
echo "Credentials are stored securely and never written to disk."
echo ""

# Check for existing credentials
if has_credential "twitter-auth-token" && has_credential "twitter-ct0"; then
    echo "Existing credentials found in Keychain."
    read -p "Overwrite? [y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 0
    fi
fi

echo ""
echo "Enter your Bird CLI credentials."
echo "(Get them from browser DevTools: Application > Cookies > twitter.com)"
echo ""

# Read AUTH_TOKEN
read -p "AUTH_TOKEN (auth_token cookie): " auth_token
if [ -z "$auth_token" ]; then
    echo "ERROR: AUTH_TOKEN cannot be empty"
    exit 1
fi

# Read CT0
read -p "CT0 (ct0 cookie): " ct0
if [ -z "$ct0" ]; then
    echo "ERROR: CT0 cannot be empty"
    exit 1
fi

echo ""
echo "Saving to Keychain..."

set_credential "twitter-auth-token" "$auth_token"
set_credential "twitter-ct0" "$ct0"

echo ""
echo "Done! Credentials stored securely in macOS Keychain."
echo ""
echo "Test with:"
echo "  source .ai/scripts/lib/credentials.sh && export_bird_credentials && bird me"
