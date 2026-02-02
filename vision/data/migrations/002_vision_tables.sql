-- Migration 002: Vision AI Assistant Tables
-- Created: 2026-02-02
-- Description: Adds tables for Vision AI assistant (memory, ideas, posts, conversations)
-- Note: STRICT mode requires TEXT for timestamps (stored as ISO8601 strings)

-- Schema versioning (if not exists)
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT DEFAULT (datetime('now')),
    description TEXT
) STRICT;

-- Record this migration
INSERT OR IGNORE INTO schema_migrations (version, description)
VALUES (2, 'Vision AI Assistant Tables');

-- Assistant profile (singleton)
CREATE TABLE IF NOT EXISTS assistant_profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    name TEXT,
    tone TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT
) STRICT;

-- Memory about user (strategy, tone of voice, facts, preferences)
CREATE TABLE IF NOT EXISTS memory (
    id INTEGER PRIMARY KEY,
    type TEXT NOT NULL CHECK(type IN ('strategy', 'tone_of_voice', 'fact', 'preference')),
    content TEXT NOT NULL,
    importance INTEGER DEFAULT 5 CHECK(importance BETWEEN 1 AND 10),
    created_at TEXT DEFAULT (datetime('now')),
    last_accessed TEXT
) STRICT;

-- Idea bank
CREATE TABLE IF NOT EXISTS ideas (
    id INTEGER PRIMARY KEY,
    content TEXT NOT NULL,
    source TEXT CHECK(source IN ('voice', 'screenshot', 'manual', 'generated')),
    status TEXT DEFAULT 'new' CHECK(status IN ('new', 'used', 'archived')),
    tags TEXT CHECK(json_valid(tags) OR tags IS NULL),
    created_at TEXT DEFAULT (datetime('now')),
    deleted_at TEXT
) STRICT;

-- Posts (generated content)
CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY,
    idea_id INTEGER REFERENCES ideas(id),
    platform TEXT NOT NULL CHECK(platform IN ('twitter', 'linkedin', 'threads', 'telegram')),
    content TEXT NOT NULL,
    external_id TEXT,
    published_at TEXT,
    status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'published', 'failed')),
    autopsy_asked INTEGER DEFAULT 0,
    autopsy_response TEXT,
    why_worked TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT,
    deleted_at TEXT
) STRICT;

-- Post metrics (snapshots for autopsy)
CREATE TABLE IF NOT EXISTS post_metrics (
    id INTEGER PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES posts(id),
    likes INTEGER DEFAULT 0,
    retweets INTEGER DEFAULT 0,
    views INTEGER DEFAULT 0,
    replies INTEGER DEFAULT 0,
    captured_at TEXT DEFAULT (datetime('now'))
) STRICT;

-- Conversations (dialogue history)
CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    message_type TEXT CHECK(message_type IN ('text', 'voice', 'image')),
    created_at TEXT DEFAULT (datetime('now'))
) STRICT;

-- Authenticity checks
CREATE TABLE IF NOT EXISTS authenticity_checks (
    id INTEGER PRIMARY KEY,
    post_id INTEGER REFERENCES posts(id),
    idea_id INTEGER REFERENCES ideas(id),
    result TEXT CHECK(result IN ('pass', 'warning', 'fail')),
    details TEXT,
    created_at TEXT DEFAULT (datetime('now'))
) STRICT;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_memory_importance ON memory(importance DESC);
CREATE INDEX IF NOT EXISTS idx_memory_type ON memory(type);
CREATE INDEX IF NOT EXISTS idx_ideas_active ON ideas(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_posts_platform ON posts(platform, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_posts_idea ON posts(idea_id);
CREATE INDEX IF NOT EXISTS idx_post_metrics_post ON post_metrics(post_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_session ON conversations(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_authenticity_post ON authenticity_checks(post_id);
