/* ============================================
   SoloBuddy Hub — Express Server
   ============================================ */

require('dotenv').config();

const express = require('express');
const session = require('express-session');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { getBuddyMessage } = require('./watcher');
const { getUserRepos, matchLocalRepos, addProjectsToConfig, scanLocalProjects, addLocalProjectsToConfig, updateProjectRemotes } = require('./github-api');
const { sendToClaude } = require('./chat-api');

const app = express();
const PORT = 3000;

// GitHub OAuth Config
const GITHUB_CONFIG = {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    redirectUri: 'http://localhost:3000/auth/github/callback',
    scopes: ['read:user', 'repo']
};

// Paths
const PATHS = {
    ideas: path.join(__dirname, '..', 'ideas'),
    drafts: path.join(__dirname, '..', 'drafts'),
    sessionLog: path.join(__dirname, '..', 'ideas', 'session-log.md'),
    backlog: path.join(__dirname, '..', 'ideas', 'backlog.md')
};

// Middleware
app.use(express.json());
app.use(express.static(__dirname));

// Session middleware for OAuth token storage
app.use(session({
    secret: process.env.SESSION_SECRET || 'solobuddy-dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true in production with HTTPS
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    }
}));

// ============================================
// Parsing Functions
// ============================================

/**
 * Parse session-log.md
 * Format:
 * ### 2026-01-08
 * 1. **🏆 "Title"** — description
 *    - Формат: Thread
 *    - Цитата: "hook"
 */
function parseSessionLog(content) {
    const items = [];
    const entryRegex = /(\d+)\.\s+\*\*([^*]+)\*\*\s*[—–-]\s*(.+?)(?=\n\s+-|\n\s*\n|\n\d+\.|\n###|$)/gs;
    const dateRegex = /###\s+(\d{4}-\d{2}-\d{2})/;

    // Find the date
    const dateMatch = content.match(dateRegex);
    const date = dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0];

    let match;
    while ((match = entryRegex.exec(content)) !== null) {
        const num = match[1];
        const titlePart = match[2].trim();
        const description = match[3].trim();

        // Extract emoji and title from titlePart like: 🏆 "Hold = Osmosis" концепт
        const emojiMatch = titlePart.match(/^([^\w\s]*)\s*["«]?([^"»]+)["»]?\s*(.*)$/);
        let emoji = '📝';
        let title = titlePart;

        if (emojiMatch) {
            emoji = emojiMatch[1] || '📝';
            title = emojiMatch[2] + (emojiMatch[3] ? ' ' + emojiMatch[3] : '');
        }

        // Find format and hook in following lines
        const blockEnd = content.indexOf('\n' + (parseInt(num) + 1) + '.', match.index);
        const block = blockEnd > 0
            ? content.substring(match.index, blockEnd)
            : content.substring(match.index, match.index + 500);

        const formatMatch = block.match(/Формат:\s*(.+)/i);
        const hookMatch = block.match(/(?:Цитата|Hook):\s*["«]?([^"»\n]+)["»]?/i);

        items.push({
            id: parseInt(num),
            emoji: emoji.trim(),
            title: title.trim(),
            format: formatMatch ? formatMatch[1].trim() : 'Post',
            hook: hookMatch ? hookMatch[1].trim() : description,
            date: date
        });
    }

    return items;
}

/**
 * Parse backlog.md
 * Format:
 * ## High Priority
 * - [ ] **Title**: subtitle
 *   - Format: type
 *   - Hook: "hook"
 */

// Priority detection from section headers
const PRIORITY_PATTERNS = [
    { regex: /##.*High/i, priority: 'high' },
    { regex: /##.*Medium/i, priority: 'medium' },
    { regex: /##.*(Ideas Pool|Low|Raw)/i, priority: 'low' }
];

function detectPriority(line) {
    for (const { regex, priority } of PRIORITY_PATTERNS) {
        if (regex.test(line)) return priority;
    }
    return null;
}

function parseBacklog(content) {
    const items = [];
    let currentPriority = 'medium';
    let id = 0;

    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Stop at tracker table
        if (line.match(/##.*Tracker/i)) break;

        // Detect priority sections
        const newPriority = detectPriority(line);
        if (newPriority) {
            currentPriority = newPriority;
            continue;
        }

        // Parse item: - [ ] **Title**: description
        const itemMatch = line.match(/^-\s*\[[ x]\]\s*\*\*([^*]+)\*\*[:\s]*(.*)$/);
        if (itemMatch) {
            id++;
            const title = itemMatch[1].trim();
            const subtitle = itemMatch[2].trim();

            // Look ahead for format and hook
            let format = 'Post';
            let hook = null;

            for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
                const nextLine = lines[j];
                if (nextLine.match(/^-\s*\[/)) break; // Next item
                if (nextLine.match(/^##/)) break; // Next section

                const formatMatch = nextLine.match(/Format:\s*(.+)/i);
                const hookMatch = nextLine.match(/Hook:\s*["«]?([^"»\n]+)["»]?/i);

                if (formatMatch) format = formatMatch[1].trim();
                if (hookMatch) hook = hookMatch[1].trim();
            }

            items.push({
                id,
                title: subtitle ? `${title}: ${subtitle}` : title,
                format,
                hook,
                priority: currentPriority
            });
            continue;
        }

        // Parse simple item: - [ ] Text
        const simpleMatch = line.match(/^-\s*\[[ x]\]\s*(.+)$/);
        if (simpleMatch && !simpleMatch[1].startsWith('**')) {
            id++;
            items.push({
                id,
                title: simpleMatch[1].trim(),
                format: 'Post',
                hook: null,
                priority: currentPriority
            });
        }
    }

    return items;
}

/**
 * Detect draft status from status text using guard clauses
 */
function detectStatus(text) {
    if (!text) return 'draft';
    const t = text.toLowerCase();
    if (t.includes('ready') || t.includes('done')) return 'ready';
    if (t.includes('progress') || t.includes('v1')) return 'in-progress';
    return 'draft';
}

/**
 * Parse a draft file
 * Format:
 * # Title
 * **Status**: DRAFT v1
 * **Format**: Thread
 */
async function parseDraft(filepath) {
    const content = await fs.readFile(filepath, 'utf-8');
    const filename = path.basename(filepath);

    const titleMatch = content.match(/^#\s+(.+)/m);
    const title = titleMatch ? titleMatch[1].trim() : filename.replace('.md', '');

    const statusMatch = content.match(/\*\*Status\*\*:\s*(.+)/i);
    const status = detectStatus(statusMatch?.[1]);

    return { filename, title, status };
}

// ============================================
// API Routes
// ============================================

// Async handler wrapper to reduce try/catch duplication
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

// GET /api/session-log
app.get('/api/session-log', asyncHandler(
    async () => {
        const content = await fs.readFile(PATHS.sessionLog, 'utf-8');
        return parseSessionLog(content);
    },
    'Failed to read session log'
));

// GET /api/backlog
app.get('/api/backlog', asyncHandler(
    async () => {
        const content = await fs.readFile(PATHS.backlog, 'utf-8');
        return parseBacklog(content);
    },
    'Failed to read backlog'
));

// GET /api/drafts
app.get('/api/drafts', async (req, res) => {
    try {
        const files = await fs.readdir(PATHS.drafts);
        const mdFiles = files.filter(f => f.endsWith('.md') && f !== 'README.md');

        const drafts = await Promise.all(
            mdFiles.map(async (filename, index) => {
                const draft = await parseDraft(path.join(PATHS.drafts, filename));
                return { id: index + 1, ...draft };
            })
        );

        res.json(drafts);
    } catch (error) {
        console.error('Error reading drafts:', error);
        res.status(500).json({ error: 'Failed to read drafts' });
    }
});

// POST /api/backlog — Add new idea
app.post('/api/backlog', async (req, res) => {
    try {
        const { title, format, priority } = req.body;

        if (!title) {
            return res.status(400).json({ error: 'Title is required' });
        }

        // Read current backlog
        let content = await fs.readFile(PATHS.backlog, 'utf-8');

        // Find the right section to insert into
        const prioritySections = {
            'high': '## High Priority',
            'medium': '## Medium Priority',
            'low': '## Ideas Pool'
        };

        const targetSection = prioritySections[priority] || prioritySections['medium'];
        const sectionIndex = content.indexOf(targetSection);

        if (sectionIndex === -1) {
            return res.status(500).json({ error: 'Could not find target section in backlog' });
        }

        // Find the end of the section header (after ----)
        const afterSection = content.indexOf('\n\n', sectionIndex);
        const insertPoint = afterSection !== -1 ? afterSection + 2 : sectionIndex + targetSection.length + 1;

        // Create new entry
        const formatLabels = {
            'thread': 'Thread',
            'gif': 'GIF + Caption',
            'video': 'Demo Video',
            'post': 'Short Post'
        };

        const newEntry = `- [ ] **${title}**\n  - Format: ${formatLabels[format] || format}\n\n`;

        // Insert the new entry
        content = content.slice(0, insertPoint) + newEntry + content.slice(insertPoint);

        // Write back
        await fs.writeFile(PATHS.backlog, content, 'utf-8');

        res.json({ success: true, message: 'Idea added to backlog' });
    } catch (error) {
        console.error('Error adding to backlog:', error);
        res.status(500).json({ error: 'Failed to add idea to backlog' });
    }
});

// GET /api/buddy-message — Proactive buddy observation
app.get('/api/buddy-message', async (req, res) => {
    try {
        const message = await getBuddyMessage();
        res.json(message);
    } catch (error) {
        console.error('Error getting buddy message:', error);
        res.json({
            message: 'Привет! Проекты дышат ровно.',
            type: 'calm',
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/chat — Chat with Claude using rich project context
app.post('/api/chat', async (req, res) => {
    const { message, history = [] } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'Message is required' });
    }

    try {
        // ============================================
        // Gather Rich Context
        // ============================================

        // 1. Projects
        const projectsPath = path.join(__dirname, '..', 'data', 'projects.json');
        let projects = [];
        try {
            const projectsData = await fs.readFile(projectsPath, 'utf-8');
            const parsed = JSON.parse(projectsData);
            projects = parsed.projects || parsed;
        } catch (e) {
            // No projects file yet
        }

        // 2. Backlog
        const backlogContent = await fs.readFile(PATHS.backlog, 'utf-8').catch(() => '');
        const backlogItems = parseBacklog(backlogContent);

        // 3. Session Log
        let sessionLog = [];
        try {
            const sessionContent = await fs.readFile(PATHS.sessionLog, 'utf-8');
            sessionLog = parseSessionLog(sessionContent);
        } catch (e) {
            // No session log
        }

        // 4. Drafts
        let drafts = [];
        try {
            const files = await fs.readdir(PATHS.drafts);
            const mdFiles = files.filter(f => f.endsWith('.md') && f !== 'README.md');
            drafts = await Promise.all(
                mdFiles.map(filename => parseDraft(path.join(PATHS.drafts, filename)))
            );
        } catch (e) {
            // No drafts
        }

        // 5. Git Activity (from watcher)
        const { scanAllProjects, loadProjects, scanProject, getActivityStats } = require('./watcher');
        let gitActivity = [];
        try {
            const allProjects = await loadProjects();
            for (const project of allProjects) {
                const scanResult = await scanProject(project.path);
                const stats = getActivityStats(project.name, scanResult);
                gitActivity.push(stats);
            }
        } catch (e) {
            // Watcher not available
        }

        // 6. Buddy Message (current observation)
        let buddyMessage = null;
        try {
            buddyMessage = await getBuddyMessage();
        } catch (e) {
            // No buddy message
        }

        // ============================================
        // Build Full Context
        // ============================================
        const context = {
            projects,
            backlogItems,
            sessionLog,
            drafts,
            gitActivity,
            buddyMessage
        };

        // Build messages array with history + new message
        const messages = [
            ...history,
            { role: 'user', content: message }
        ];

        const response = await sendToClaude(messages, context);

        res.json({ response });
    } catch (error) {
        console.error('Chat error:', error.message);
        res.status(500).json({ error: error.message || 'Failed to get response' });
    }
});

// ============================================
// GitHub OAuth Routes
// ============================================

// GET /auth/github — Redirect to GitHub OAuth
app.get('/auth/github', (req, res) => {
    const authUrl = new URL('https://github.com/login/oauth/authorize');
    authUrl.searchParams.set('client_id', GITHUB_CONFIG.clientId);
    authUrl.searchParams.set('redirect_uri', GITHUB_CONFIG.redirectUri);
    authUrl.searchParams.set('scope', GITHUB_CONFIG.scopes.join(' '));
    authUrl.searchParams.set('state', req.sessionID);

    res.redirect(authUrl.toString());
});

// GET /auth/github/callback — Handle OAuth callback
app.get('/auth/github/callback', async (req, res) => {
    const { code, error } = req.query;

    if (error) {
        console.error('GitHub OAuth error:', error);
        return res.redirect('/?github_error=' + encodeURIComponent(error));
    }

    if (!code) {
        return res.redirect('/?github_error=no_code');
    }

    try {
        // Exchange code for token
        const tokenResponse = await axios.post(
            'https://github.com/login/oauth/access_token',
            {
                client_id: GITHUB_CONFIG.clientId,
                client_secret: GITHUB_CONFIG.clientSecret,
                code: code,
                redirect_uri: GITHUB_CONFIG.redirectUri
            },
            {
                headers: {
                    'Accept': 'application/json'
                }
            }
        );

        const { access_token, error: tokenError } = tokenResponse.data;

        if (tokenError || !access_token) {
            console.error('Token exchange error:', tokenError);
            return res.redirect('/?github_error=token_exchange_failed');
        }

        // Store token in session (secure, not in files)
        req.session.githubToken = access_token;

        // Redirect back to app with success flag
        res.redirect('/?github_connected=true');
    } catch (err) {
        console.error('GitHub callback error:', err.message);
        res.redirect('/?github_error=callback_failed');
    }
});

// GET /api/github/status — Check connection status
app.get('/api/github/status', (req, res) => {
    const connected = !!req.session.githubToken;
    res.json({ connected });
});

// GET /api/github/logout — Clear GitHub session
app.get('/api/github/logout', (req, res) => {
    delete req.session.githubToken;
    res.json({ success: true });
});

// GET /api/github/repos — Get user repositories with local matches
app.get('/api/github/repos', async (req, res) => {
    const token = req.session.githubToken;

    if (!token) {
        return res.status(401).json({ error: 'Not authenticated with GitHub' });
    }

    try {
        const repos = await getUserRepos(token);
        const reposWithLocal = await matchLocalRepos(repos);

        // Sort: local matches first, then by pushed_at
        reposWithLocal.sort((a, b) => {
            if (a.hasLocal !== b.hasLocal) return b.hasLocal - a.hasLocal;
            return new Date(b.pushed_at) - new Date(a.pushed_at);
        });

        res.json(reposWithLocal);
    } catch (error) {
        console.error('Error fetching repos:', error.message);
        res.status(500).json({ error: 'Failed to fetch repositories' });
    }
});

// POST /api/github/connect — Add selected repos to projects.json
app.post('/api/github/connect', async (req, res) => {
    const token = req.session.githubToken;
    const { repos } = req.body;

    if (!token) {
        return res.status(401).json({ error: 'Not authenticated with GitHub' });
    }

    if (!repos || !Array.isArray(repos) || repos.length === 0) {
        return res.status(400).json({ error: 'No repositories selected' });
    }

    try {
        const count = await addProjectsToConfig(repos);
        res.json({
            success: true,
            added: count,
            message: `Added ${count} project(s) to monitoring`
        });
    } catch (error) {
        console.error('Error connecting repos:', error.message);
        res.status(500).json({ error: 'Failed to connect repositories' });
    }
});

// ============================================
// Local Projects Routes
// ============================================

// GET /api/local/scan — Scan for local Git projects
app.get('/api/local/scan', async (req, res) => {
    try {
        const projects = await scanLocalProjects();
        res.json(projects);
    } catch (error) {
        console.error('Error scanning local projects:', error.message);
        res.status(500).json({ error: 'Failed to scan local projects' });
    }
});

// POST /api/local/connect — Add selected local projects to monitoring
app.post('/api/local/connect', async (req, res) => {
    const { projects } = req.body;

    if (!projects || !Array.isArray(projects) || projects.length === 0) {
        return res.status(400).json({ error: 'No projects selected' });
    }

    try {
        const count = await addLocalProjectsToConfig(projects);
        res.json({
            success: true,
            added: count,
            message: `Added ${count} project(s) to monitoring`
        });
    } catch (error) {
        console.error('Error connecting local projects:', error.message);
        res.status(500).json({ error: 'Failed to connect projects' });
    }
});

// POST /api/projects/refresh-remotes — Manually trigger remote URL updates
app.post('/api/projects/refresh-remotes', async (req, res) => {
    try {
        const count = await updateProjectRemotes();
        res.json({
            success: true,
            updated: count,
            message: count > 0
                ? `Updated ${count} project(s) with new remote URLs`
                : 'All projects already have URLs or no remotes found'
        });
    } catch (error) {
        console.error('Error refreshing remotes:', error.message);
        res.status(500).json({ error: 'Failed to refresh project remotes' });
    }
});

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
