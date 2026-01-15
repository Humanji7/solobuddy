/**
 * Shared configuration and helpers for SoloBuddy Hub
 */

const fs = require('fs').promises;
const path = require('path');

// Paths
const PATHS = {
    ideas: path.join(__dirname, '..', 'ideas'),
    drafts: path.join(__dirname, '..', 'drafts'),
    sessionLog: path.join(__dirname, '..', 'ideas', 'session-log.md'),
    backlog: path.join(__dirname, '..', 'ideas', 'backlog.md'),
    projects: path.join(__dirname, '..', 'data', 'projects.json'),
    aiDrafts: path.join(__dirname, 'data', 'ai-drafts.json'),
    myPosts: path.join(__dirname, '..', 'data', 'my-posts.json'),
    dataDir: path.join(__dirname, 'data')
};

// GitHub OAuth Config
const GITHUB_CONFIG = {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    redirectUri: 'http://localhost:3000/auth/github/callback',
    scopes: ['read:user', 'repo']
};

// ============================================
// Helper Functions
// ============================================

async function loadProjectsConfig() {
    try {
        const data = await fs.readFile(PATHS.projects, 'utf-8');
        const parsed = JSON.parse(data);
        return parsed.projects || parsed;
    } catch (e) {
        return [];
    }
}

async function findProjectByName(name) {
    const projects = await loadProjectsConfig();
    return projects.find(p => p.name.toLowerCase() === name.toLowerCase());
}

async function ensureDataDir() {
    await fs.mkdir(PATHS.dataDir, { recursive: true });
}

async function loadJsonFile(filePath, defaultValue = []) {
    try {
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        return defaultValue;
    }
}

function asyncHandler(handler, errorMsg) {
    return async (req, res) => {
        try {
            const result = await handler(req);
            res.json(result);
        } catch (error) {
            console.error(errorMsg, error);
            res.status(500).json({ error: errorMsg });
        }
    };
}

module.exports = {
    PATHS,
    GITHUB_CONFIG,
    loadProjectsConfig,
    findProjectByName,
    ensureDataDir,
    loadJsonFile,
    asyncHandler
};
