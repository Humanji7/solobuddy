/* ============================================
   SoloBuddy Hub — Express Server
   ============================================ */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const session = require('express-session');

const app = express();
const PORT = 3000;

// ============================================
// Middleware
// ============================================

app.use(express.json());
app.use(express.static(__dirname));

app.use(session({
    secret: process.env.SESSION_SECRET || 'solobuddy-dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000
    }
}));

// ============================================
// Routes
// ============================================

const contentRoutes = require('./routes/content');
const chatRoutes = require('./routes/chat');
const projectRoutes = require('./routes/projects');
const githubRoutes = require('./routes/github');
const postsRoutes = require('./routes/posts');
const userRoutes = require('./routes/user');
const settingsRoutes = require('./routes/settings');

// Content: /api/session-log, /api/backlog, /api/drafts, /api/ai-drafts, etc.
app.use('/api', contentRoutes);

// Chat: /api/chat, /api/intent/parse
app.use('/api', chatRoutes);

// Projects: /api/projects, /api/project-voice, /api/project-soul, /api/local
app.use('/api', projectRoutes);

// GitHub OAuth: /auth/github, /api/github/*
app.use('/', githubRoutes);
app.use('/api/github', githubRoutes);

// Posts: /api/posts (voice training dataset)
app.use('/api/posts', postsRoutes);

// User: /api/user-context (onboarding and settings)
app.use('/api', userRoutes);

// Settings: /api/settings
app.use('/api/settings', settingsRoutes);

// ============================================
// Start Server
// ============================================

app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════╗
║  🧬 SoloBuddy Hub Server                  ║
║  Running at http://localhost:${PORT}         ║
╚═══════════════════════════════════════════╝
    `);
});
