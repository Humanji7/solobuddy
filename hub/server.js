/* ============================================
   SoloBuddy Hub — Express Server
   ============================================ */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const session = require('express-session');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { getBuddyMessage } = require('./watcher');
const { getUserRepos, matchLocalRepos, addProjectsToConfig, scanLocalProjects, addLocalProjectsToConfig, updateProjectRemotes, normalizeGitUrl } = require('./github-api');
const { sendToClaude, generateContent, sendProjectVoice } = require('./chat-api');
const { parseIntent } = require('./intent-parser');

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

            // Look ahead for format, hook, and project (Phase 2)
            let format = 'Post';
            let hook = null;
            let project = null;

            for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
                const nextLine = lines[j];
                if (nextLine.match(/^-\s*\[/)) break; // Next item
                if (nextLine.match(/^##/)) break; // Next section

                const formatMatch = nextLine.match(/Format:\s*(.+)/i);
                const hookMatch = nextLine.match(/Hook:\s*["«]?([^"»\n]+)["»]?/i);
                const projectMatch = nextLine.match(/Project:\s*(.+)/i);

                if (formatMatch) format = formatMatch[1].trim();
                if (hookMatch) hook = hookMatch[1].trim();
                if (projectMatch) project = projectMatch[1].trim();
            }

            items.push({
                id,
                title: subtitle ? `${title}: ${subtitle}` : title,
                format,
                hook,
                priority: currentPriority,
                project
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
                priority: currentPriority,
                project: null
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

// POST /api/backlog — Add new idea (with optional project link)
app.post('/api/backlog', async (req, res) => {
    try {
        const { title, format, priority, project } = req.body;  // Phase 2: project param

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

        // Phase 2: Include project link if provided
        let newEntry = `- [ ] **${title}**\n  - Format: ${formatLabels[format] || format}\n`;
        if (project) {
            newEntry += `  - Project: ${project}\n`;
        }
        newEntry += '\n';

        // Insert the new entry
        content = content.slice(0, insertPoint) + newEntry + content.slice(insertPoint);

        // Write back
        await fs.writeFile(PATHS.backlog, content, 'utf-8');

        res.json({ success: true, message: 'Idea added to backlog', project });
    } catch (error) {
        console.error('Error adding to backlog:', error);
        res.status(500).json({ error: 'Failed to add idea to backlog' });
    }
});

// POST /api/ideas/:id/link — Link idea to project (Phase 2: Context Awareness)
app.post('/api/ideas/:id/link', async (req, res) => {
    try {
        const ideaId = parseInt(req.params.id);
        const { project } = req.body;

        if (!project) {
            return res.status(400).json({ error: 'Project name is required' });
        }

        // Read backlog
        let content = await fs.readFile(PATHS.backlog, 'utf-8');
        const backlogItems = parseBacklog(content);

        // Find the idea
        const idea = backlogItems.find(item => item.id === ideaId);
        if (!idea) {
            return res.status(404).json({ error: 'Idea not found' });
        }

        // Find the idea in content and add/update project line
        const lines = content.split('\n');
        let currentId = 0;
        let ideaLineIndex = -1;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.match(/^-\s*\[[ x]\]\s*\*\*/) || (line.match(/^-\s*\[[ x]\]\s*/) && !line.match(/^\s+-/))) {
                currentId++;
                if (currentId === ideaId) {
                    ideaLineIndex = i;
                    break;
                }
            }
        }

        if (ideaLineIndex === -1) {
            return res.status(404).json({ error: 'Could not locate idea in backlog' });
        }

        // Find where to insert Project line (after Format/Hook lines or right after idea)
        let insertIndex = ideaLineIndex + 1;
        let existingProjectIndex = -1;

        for (let j = ideaLineIndex + 1; j < lines.length; j++) {
            if (lines[j].match(/^-\s*\[/)) break; // Next item
            if (lines[j].match(/^##/)) break; // Next section
            if (lines[j].match(/^\s*$/)) break; // Empty line
            if (lines[j].match(/Project:\s*/i)) {
                existingProjectIndex = j;
            }
            insertIndex = j + 1;
        }

        // Update or insert project line
        if (existingProjectIndex !== -1) {
            lines[existingProjectIndex] = `  - Project: ${project}`;
        } else {
            lines.splice(insertIndex, 0, `  - Project: ${project}`);
        }

        // Write back
        await fs.writeFile(PATHS.backlog, lines.join('\n'), 'utf-8');

        res.json({ success: true, ideaId, project });
    } catch (error) {
        console.error('Error linking idea to project:', error);
        res.status(500).json({ error: 'Failed to link idea to project' });
    }
});

// POST /api/feedback — Store learning feedback (Phase 3: Learning Feedback Loop)
app.post('/api/feedback', async (req, res) => {
    try {
        const { cardType, intent, feedback, timestamp } = req.body;

        if (!feedback) {
            return res.status(400).json({ error: 'Feedback is required' });
        }

        const feedbackPath = path.join(__dirname, 'data', 'feedback.json');

        // Ensure data directory exists
        await fs.mkdir(path.join(__dirname, 'data'), { recursive: true });

        // Read existing feedback
        let data = [];
        try {
            const existing = await fs.readFile(feedbackPath, 'utf-8');
            data = JSON.parse(existing);
        } catch (e) { /* No file yet */ }

        // Add new feedback entry
        data.push({
            cardType: cardType || 'unknown',
            intent: intent || '',
            feedback,
            timestamp: timestamp || Date.now()
        });

        // Write back
        await fs.writeFile(feedbackPath, JSON.stringify(data, null, 2));

        res.json({ success: true });
    } catch (error) {
        console.error('Error saving feedback:', error);
        res.status(500).json({ error: 'Failed to save feedback' });
    }
});

// ============================================
// AI Drafts API — Auto-saved generated content
// ============================================

const AI_DRAFTS_PATH = path.join(__dirname, 'data', 'ai-drafts.json');

// GET /api/ai-drafts — List all saved AI drafts
app.get('/api/ai-drafts', async (req, res) => {
    try {
        await fs.mkdir(path.join(__dirname, 'data'), { recursive: true });

        let drafts = [];
        try {
            const data = await fs.readFile(AI_DRAFTS_PATH, 'utf-8');
            drafts = JSON.parse(data);
        } catch (e) { /* No file yet */ }

        // Sort by timestamp descending (newest first)
        drafts.sort((a, b) => b.timestamp - a.timestamp);

        res.json(drafts);
    } catch (error) {
        console.error('Error loading AI drafts:', error);
        res.status(500).json({ error: 'Failed to load drafts' });
    }
});

// POST /api/ai-drafts — Save a new AI draft (called automatically on generation)
app.post('/api/ai-drafts', async (req, res) => {
    try {
        const { content, prompt, template, project, persona, tokensUsed } = req.body;

        if (!content) {
            return res.status(400).json({ error: 'Content is required' });
        }

        await fs.mkdir(path.join(__dirname, 'data'), { recursive: true });

        // Read existing drafts
        let drafts = [];
        try {
            const data = await fs.readFile(AI_DRAFTS_PATH, 'utf-8');
            drafts = JSON.parse(data);
        } catch (e) { /* No file yet */ }

        // Add new draft
        const newDraft = {
            id: Date.now(),
            content,
            prompt: prompt || '',
            template: template || 'thread',
            project: project || null,
            persona: persona || 'jester-sage',
            tokensUsed: tokensUsed || 0,
            timestamp: Date.now(),
            status: 'draft'  // draft, copied, published
        };

        drafts.push(newDraft);

        // Keep only last 100 drafts
        if (drafts.length > 100) {
            drafts = drafts.slice(-100);
        }

        await fs.writeFile(AI_DRAFTS_PATH, JSON.stringify(drafts, null, 2));

        res.json({ success: true, draft: newDraft, total: drafts.length });
    } catch (error) {
        console.error('Error saving AI draft:', error);
        res.status(500).json({ error: 'Failed to save draft' });
    }
});

// DELETE /api/ai-drafts/:id — Delete a draft
app.delete('/api/ai-drafts/:id', async (req, res) => {
    try {
        const draftId = parseInt(req.params.id);

        let drafts = [];
        try {
            const data = await fs.readFile(AI_DRAFTS_PATH, 'utf-8');
            drafts = JSON.parse(data);
        } catch (e) {
            return res.status(404).json({ error: 'No drafts found' });
        }

        drafts = drafts.filter(d => d.id !== draftId);
        await fs.writeFile(AI_DRAFTS_PATH, JSON.stringify(drafts, null, 2));

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting draft:', error);
        res.status(500).json({ error: 'Failed to delete draft' });
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
            left: {
                message: 'Привет! Проекты дышат ровно.',
                type: 'calm',
                colorScheme: { name: 'sage', accent: '#2D6A4F' }
            },
            right: {
                message: 'Сканирование завершится скоро.',
                type: 'calm',
                colorScheme: { name: 'ocean', accent: '#0077B6' }
            },
            timestamp: new Date().toISOString(),
            projectsCount: 0
        });
    }
});

// POST /api/intent/parse — Parse user message for intents
app.post('/api/intent/parse', async (req, res) => {
    const { message } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'Message is required' });
    }

    try {
        // Gather context for intent parsing
        const projectsPath = path.join(__dirname, '..', 'data', 'projects.json');
        let projects = [];
        try {
            const projectsData = await fs.readFile(projectsPath, 'utf-8');
            const parsed = JSON.parse(projectsData);
            projects = parsed.projects || parsed;
        } catch (e) { /* no projects */ }

        // Backlog items
        const backlogContent = await fs.readFile(PATHS.backlog, 'utf-8').catch(() => '');
        const backlogItems = parseBacklog(backlogContent);

        // Git activity
        const { loadProjects, scanProject, getActivityStats } = require('./watcher');
        let gitActivity = [];
        try {
            const allProjects = await loadProjects();
            for (const project of allProjects.slice(0, 10)) { // Limit for performance
                const scanResult = await scanProject(project.path);
                const stats = getActivityStats(project.name, scanResult);
                gitActivity.push(stats);
            }
        } catch (e) { /* watcher not available */ }

        // Parse intent
        const context = { backlogItems, projects, gitActivity };
        const result = parseIntent(message, context);

        res.json(result);
    } catch (error) {
        console.error('Intent parse error:', error.message);
        res.status(500).json({ error: 'Failed to parse intent' });
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

        // ============================================
        // Intent Detection (Phase 1: IRL)
        // ============================================
        const { intentType, actionCard, confidence } = parseIntent(message, context);

        // Build messages array with history + new message
        const messages = [
            ...history,
            { role: 'user', content: message }
        ];

        const response = await sendToClaude(messages, context);

        res.json({
            response,
            actionCard,        // Include action card if detected
            intent: intentType,
            confidence
        });
    } catch (error) {
        console.error('Chat error:', error.message);
        res.status(500).json({ error: error.message || 'Failed to get response' });
    }
});

// POST /api/project-voice — Chat with project as first-person persona
app.post('/api/project-voice', async (req, res) => {
    const { projectName, message, history = [] } = req.body;

    if (!projectName || !message) {
        return res.status(400).json({ error: 'projectName and message are required' });
    }

    try {
        // 1. Find project
        const projectsPath = path.join(__dirname, '..', 'data', 'projects.json');
        let projects = [];
        try {
            const data = await fs.readFile(projectsPath, 'utf-8');
            const parsed = JSON.parse(data);
            projects = parsed.projects || parsed;
        } catch (e) {
            return res.status(404).json({ error: 'No projects configured' });
        }

        const project = projects.find(p =>
            p.name.toLowerCase() === projectName.toLowerCase()
        );

        if (!project) {
            return res.status(404).json({ error: `Project "${projectName}" not found` });
        }

        // 2. Get backlog for context
        const backlogContent = await fs.readFile(PATHS.backlog, 'utf-8').catch(() => '');
        const backlogItems = parseBacklog(backlogContent);

        // 3. Build messages array
        const messages = [
            ...history,
            { role: 'user', content: message }
        ];

        // 4. Call Claude with project voice
        const response = await sendProjectVoice(project, messages, { backlogItems });

        res.json({
            response,
            project: project.name
        });
    } catch (error) {
        console.error('Project Voice error:', error.message);
        res.status(500).json({ error: error.message || 'Failed to get response' });
    }
});

// POST /api/content/generate — Generate BIP content with personas and templates (Phase 4.1)
app.post('/api/content/generate', async (req, res) => {
    const { prompt, template, persona, project } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    try {
        // ============================================
        // Gather Rich Context (same as chat)
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
        const { loadProjects, scanProject, getActivityStats } = require('./watcher');
        let gitActivity = [];
        try {
            const allProjects = await loadProjects();
            for (const proj of allProjects) {
                const scanResult = await scanProject(proj.path);
                const stats = getActivityStats(proj.name, scanResult);
                gitActivity.push(stats);
            }
        } catch (e) {
            // Watcher not available
        }

        // 6. Buddy Message
        let buddyMessage = null;
        try {
            buddyMessage = await getBuddyMessage();
        } catch (e) {
            // No buddy message
        }

        // ============================================
        // Build Context and Generate Content
        // ============================================
        const context = {
            projects,
            backlogItems,
            sessionLog,
            drafts,
            gitActivity,
            buddyMessage
        };

        const result = await generateContent(
            { prompt, template, persona, project },
            context
        );

        // Auto-save draft for history/learning
        try {
            const draftsData = await fs.readFile(AI_DRAFTS_PATH, 'utf-8').catch(() => '[]');
            const drafts = JSON.parse(draftsData);
            drafts.push({
                id: Date.now(),
                content: result.content,
                prompt,
                template: template || 'thread',
                project: project || null,
                persona: persona || 'jester-sage',
                tokensUsed: result.metadata?.tokensUsed || 0,
                timestamp: Date.now(),
                status: 'draft'
            });
            // Keep last 100
            const trimmed = drafts.slice(-100);
            await fs.writeFile(AI_DRAFTS_PATH, JSON.stringify(trimmed, null, 2));
        } catch (e) {
            console.error('Failed to auto-save draft:', e);
        }

        res.json({
            success: true,
            content: result.content,
            metadata: result.metadata
        });

    } catch (error) {
        console.error('Content generation error:', error.message);

        // Handle specific error types
        if (error.response?.status === 429) {
            return res.status(429).json({
                success: false,
                error: 'Rate limit. Подожди минуту.'
            });
        }

        if (error.status === 500 || error.response?.status === 500) {
            return res.status(500).json({
                success: false,
                error: 'Claude не отвечает. Try again.'
            });
        }

        res.status(500).json({
            success: false,
            error: error.message || 'Что-то пошло не так.'
        });
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

        // Read projects.json to mark already connected repos
        let connectedUrls = new Set();
        try {
            const projectsData = await fs.readFile(
                path.join(__dirname, '..', 'data', 'projects.json'), 'utf-8'
            );
            const { projects = [] } = JSON.parse(projectsData);
            projects.forEach(p => {
                if (p.github) connectedUrls.add(normalizeGitUrl(p.github));
            });
        } catch (e) { /* no projects.json yet */ }

        // Add alreadyConnected flag
        reposWithLocal.forEach(repo => {
            repo.alreadyConnected = connectedUrls.has(normalizeGitUrl(repo.clone_url));
        });

        // Sort: connected last, then local matches first, then by pushed_at
        reposWithLocal.sort((a, b) => {
            if (a.alreadyConnected !== b.alreadyConnected) return a.alreadyConnected - b.alreadyConnected;
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

// GET /api/projects — Get all connected projects
app.get('/api/projects', async (req, res) => {
    try {
        const projectsPath = path.join(__dirname, '..', 'data', 'projects.json');
        const data = await fs.readFile(projectsPath, 'utf-8');
        const parsed = JSON.parse(data);
        const projects = parsed.projects || parsed;
        res.json(projects);
    } catch (error) {
        console.error('Error loading projects:', error.message);
        res.json([]); // Return empty array if no projects
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
