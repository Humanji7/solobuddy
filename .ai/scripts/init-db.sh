#!/bin/bash
# Initialize SQLite database for BIP Buddy
# Creates schema with 4 tables: tweets, profile_snapshots, drafts, alerts_sent

set -euo pipefail

PROJECT_ROOT="$HOME/projects/bip-buddy"
DATA_DIR="$PROJECT_ROOT/data"
DB_FILE="$DATA_DIR/bip.db"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

# Ensure data directory exists
mkdir -p "$DATA_DIR"

log "Initializing BIP Buddy database at $DB_FILE"

# Check if sqlite3 is available
if ! command -v sqlite3 &> /dev/null; then
    log "ERROR: sqlite3 not found. Install with: brew install sqlite"
    exit 1
fi

# Create tables (idempotent)
sqlite3 "$DB_FILE" << 'SQL'
-- Снимки твитов с метриками
CREATE TABLE IF NOT EXISTS tweets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tweet_id TEXT UNIQUE NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME NOT NULL,
  snapshot_at DATETIME NOT NULL,
  likes INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  retweets INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0
);

-- История профиля
CREATE TABLE IF NOT EXISTS profile_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_at DATETIME NOT NULL,
  followers INTEGER DEFAULT 0,
  following INTEGER DEFAULT 0
);

-- Драфты и контент-календарь
CREATE TABLE IF NOT EXISTS drafts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  source TEXT NOT NULL,            -- 'session', 'watchlist', 'manual'
  source_ref TEXT,
  status TEXT NOT NULL DEFAULT 'idea',  -- 'idea', 'draft', 'reminded', 'posted', 'dropped'
  remind_at DATETIME,
  created_at DATETIME NOT NULL,
  posted_at DATETIME,
  posted_tweet_id TEXT
);

-- Дедупликация алертов
CREATE TABLE IF NOT EXISTS alerts_sent (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alert_type TEXT NOT NULL,
  ref_id TEXT NOT NULL,
  sent_at DATETIME NOT NULL
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tweets_snapshot_at ON tweets(snapshot_at);
CREATE INDEX IF NOT EXISTS idx_tweets_created_at ON tweets(created_at);
CREATE INDEX IF NOT EXISTS idx_profile_snapshots_at ON profile_snapshots(snapshot_at);
CREATE INDEX IF NOT EXISTS idx_drafts_status ON drafts(status);
CREATE INDEX IF NOT EXISTS idx_drafts_remind_at ON drafts(remind_at);
CREATE INDEX IF NOT EXISTS idx_alerts_type_ref ON alerts_sent(alert_type, ref_id);
SQL

if [ $? -eq 0 ]; then
    log "✓ Database initialized successfully"
    log "  Location: $DB_FILE"

    # Verify tables
    TABLES=$(sqlite3 "$DB_FILE" "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
    log "  Tables created:"
    echo "$TABLES" | while read table; do
        log "    - $table"
    done
else
    log "✗ Database initialization failed"
    exit 1
fi
