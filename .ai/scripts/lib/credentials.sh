#!/bin/bash
# Secure credentials management via macOS Keychain
# Usage: source this file, then call get_credential/set_credential

# Service name for all bip-buddy credentials
KEYCHAIN_SERVICE="bip-buddy"

# Get credential from Keychain
# Usage: get_credential "auth-token"
# Returns: credential value or exits with error
get_credential() {
    local key="$1"
    local value

    if [ -z "$key" ]; then
        echo "ERROR: get_credential requires key argument" >&2
        return 1
    fi

    value=$(security find-generic-password -s "$KEYCHAIN_SERVICE" -a "$key" -w 2>/dev/null)

    if [ $? -ne 0 ] || [ -z "$value" ]; then
        echo "ERROR: Credential '$key' not found in Keychain" >&2
        echo "  Run: .ai/scripts/setup-credentials.sh" >&2
        return 1
    fi

    echo "$value"
}

# Set credential in Keychain
# Usage: set_credential "auth-token" "value"
set_credential() {
    local key="$1"
    local value="$2"

    if [ -z "$key" ] || [ -z "$value" ]; then
        echo "ERROR: set_credential requires key and value arguments" >&2
        return 1
    fi

    # Delete existing if present (security won't update in place)
    security delete-generic-password -s "$KEYCHAIN_SERVICE" -a "$key" 2>/dev/null || true

    # Add new credential
    security add-generic-password -s "$KEYCHAIN_SERVICE" -a "$key" -w "$value"

    if [ $? -eq 0 ]; then
        echo "Credential '$key' saved to Keychain"
        return 0
    else
        echo "ERROR: Failed to save credential '$key' to Keychain" >&2
        return 1
    fi
}

# Check if credential exists
# Usage: has_credential "auth-token" && echo "exists"
has_credential() {
    local key="$1"
    security find-generic-password -s "$KEYCHAIN_SERVICE" -a "$key" >/dev/null 2>&1
}

# List all bip-buddy credentials (keys only, not values)
list_credentials() {
    security dump-keychain 2>/dev/null | grep -A3 "\"$KEYCHAIN_SERVICE\"" | grep "acct" | sed 's/.*="//;s/"//'
}

# Export credentials to environment (for Bird CLI)
# Usage: export_bird_credentials
export_bird_credentials() {
    local auth_token ct0

    auth_token=$(get_credential "twitter-auth-token") || return 1
    ct0=$(get_credential "twitter-ct0") || return 1

    export AUTH_TOKEN="$auth_token"
    export CT0="$ct0"
}
