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
const { sendToClaude, generateContent, sendProjectVoice, extractPersonalityFromReadme } = require('./chat-api');
const { parseIntent } = require('./intent-parser');
const soulManager = require('./soul-manager');
const { parseSessionLog, parseBacklog, parseDraft } = require('./parsing');

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
    backlog: path.join(__dirname, '..', 'ideas', 'backlog.md'),
    projects: path.join(__dirname, '..', 'data', 'projects.json'),
    aiDrafts: path.join(__dirname, 'data', 'ai-drafts.json'),
    dataDir: path.join(__dirname, 'data')
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
        await ensureDataDir();

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

// GET /api/ai-drafts — List all saved AI drafts
app.get('/api/ai-drafts', async (req, res) => {
    try {
        await ensureDataDir();

        let drafts = [];
        try {
            const data = await fs.readFile(PATHS.aiDrafts, 'utf-8');
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

        await ensureDataDir();

        // Read existing drafts
        let drafts = [];
        try {
            const data = await fs.readFile(PATHS.aiDrafts, 'utf-8');
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

        await fs.writeFile(PATHS.aiDrafts, JSON.stringify(drafts, null, 2));

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
            const data = await fs.readFile(PATHS.aiDrafts, 'utf-8');
            drafts = JSON.parse(data);
        } catch (e) {
            return res.status(404).json({ error: 'No drafts found' });
        }

        drafts = drafts.filter(d => d.id !== draftId);
        await fs.writeFile(PATHS.aiDrafts, JSON.stringify(drafts, null, 2));

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
                message: 'Hey! Projects are breathing steady.',
                type: 'calm',
                colorScheme: { name: 'sage', accent: '#2D6A4F' }
            },
            right: {
                message: 'Scanning will finish soon.',
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
        const projects = await loadProjectsConfig();

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

        const projects = await loadProjectsConfig();

        const backlogContent = await fs.readFile(PATHS.backlog, 'utf-8').catch(() => '');
        const backlogItems = parseBacklog(backlogContent);

        const sessionContent = await fs.readFile(PATHS.sessionLog, 'utf-8').catch(() => '');
        const sessionLog = sessionContent ? parseSessionLog(sessionContent) : [];

        let drafts = [];
        try {
            const files = await fs.readdir(PATHS.drafts);
            const mdFiles = files.filter(f => f.endsWith('.md') && f !== 'README.md');
            drafts = await Promise.all(
                mdFiles.map(filename => parseDraft(path.join(PATHS.drafts, filename)))
            );
        } catch (e) { /* No drafts */ }

        const { loadProjects, scanProject, getActivityStats } = require('./watcher');
        let gitActivity = [];
        try {
            const allProjects = await loadProjects();
            for (const project of allProjects) {
                const scanResult = await scanProject(project.path);
                const stats = getActivityStats(project.name, scanResult);
                gitActivity.push(stats);
            }
        } catch (e) { /* Watcher not available */ }

        const buddyMessage = await getBuddyMessage().catch(() => null);

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
        const project = await findProjectByName(projectName);
        if (!project) {
            return res.status(404).json({ error: `Project "${projectName}" not found` });
        }

        let soul = await soulManager.loadSoul(project.name, project.path);

        // Auto-extract personality from README if not yet extracted
        let extractionStatus = 'cached';
        if (!soul.personality && project.path) {
            console.log(`[Soul] First contact with ${project.name} — extracting personality from README...`);
            extractionStatus = 'extracting';

            try {
                const personality = await extractPersonalityFromReadme(project.path, project.name);
                if (personality) {
                    await soulManager.updatePersonality(project.name, personality);
                    soul.personality = personality;
                    extractionStatus = 'extracted';
                    console.log(`[Soul] ✅ Personality extracted for ${project.name}`);
                } else {
                    extractionStatus = 'no_readme';
                    console.log(`[Soul] No README found for ${project.name}, using default personality`);
                }
            } catch (e) {
                console.error(`[Soul] ❌ Extraction failed for ${project.name}:`, e.message);
                extractionStatus = 'failed';
            }
        }

        const backlogContent = await fs.readFile(PATHS.backlog, 'utf-8').catch(() => '');
        const backlogItems = parseBacklog(backlogContent);

        const { scanProject, getActivityStats } = require('./watcher');
        const gitActivity = await scanProject(project.path)
            .then(result => getActivityStats(project.name, result))
            .catch(() => null);

        const messages = [
            ...history,
            { role: 'user', content: message }
        ];

        const response = await sendProjectVoice(project, messages, {
            backlogItems,
            soul,
            gitActivity
        });

        res.json({
            response,
            project: project.name,
            hasSoul: !!soul.personality,
            extractionStatus  // 'cached' | 'extracted' | 'no_readme' | 'failed' | 'extracting'
        });
    } catch (error) {
        console.error('Project Voice error:', error.message);
        res.status(500).json({ error: error.message || 'Failed to get response' });
    }
});

// POST /api/project-soul/:name/memory — Save conversation memory
app.post('/api/project-soul/:name/memory', async (req, res) => {
    const { name } = req.params;
    const { summary, emotion } = req.body;

    if (!summary) {
        return res.status(400).json({ error: 'Summary is required' });
    }

    try {
        const soul = await soulManager.addMemory(name, {
            type: 'conversation',
            summary,
            emotion: emotion || null
        });

        res.json({
            success: true,
            memoriesCount: soul.memories.length
        });
    } catch (error) {
        console.error('Error saving memory:', error.message);
        res.status(500).json({ error: 'Failed to save memory' });
    }
});

// GET /api/project-soul/:name — Get project soul
app.get('/api/project-soul/:name', async (req, res) => {
    const { name } = req.params;

    try {
        const soul = await soulManager.loadSoul(name);
        soul.daysSilent = soulManager.getDaysSilent(soul);
        res.json(soul);
    } catch (error) {
        console.error('Error loading soul:', error.message);
        res.status(500).json({ error: 'Failed to load soul' });
    }
});

// POST /api/project-soul/:name/extract — Force re-extraction of personality from README
app.post('/api/project-soul/:name/extract', async (req, res) => {
    const { name } = req.params;

    try {
        const project = await findProjectByName(name);
        if (!project) {
            return res.status(404).json({ error: `Project "${name}" not found` });
        }
        if (!project.path) {
            return res.status(400).json({ error: `Project "${name}" has no path configured` });
        }

        console.log(`[Soul] Manual extraction requested for ${project.name}...`);

        const personality = await extractPersonalityFromReadme(project.path, project.name);

        if (personality) {
            await soulManager.updatePersonality(project.name, personality);
            console.log(`[Soul] ✅ Manual extraction complete for ${project.name}`);
            res.json({
                success: true,
                personality,
                message: `Personality extracted from README for ${project.name}`
            });
        } else {
            res.status(404).json({
                error: 'No README found or too short',
                hint: 'Ensure project has README.md with at least 100 characters'
            });
        }
    } catch (error) {
        console.error('Error extracting personality:', error.message);
        res.status(500).json({ error: error.message || 'Failed to extract personality' });
    }
});

// GET /api/project-sensitivity/:name — Check if project needs SOUL onboarding
app.get('/api/project-sensitivity/:name', async (req, res) => {
    const { name } = req.params;
    const { getSensitivity } = require('./sensitivity-detector');

    try {
        const project = await findProjectByName(name);
        if (!project) {
            return res.status(404).json({ error: `Project "${name}" not found` });
        }
        if (!project.path) {
            return res.status(400).json({ error: `Project "${name}" has no path configured` });
        }

        // Also check if soul already has onboarding completed
        const hasOnboarding = await soulManager.hasCompletedOnboarding(project.name);

        const sensitivity = await getSensitivity(project.name, project.path);

        // Override recommendation if onboarding already completed
        if (hasOnboarding) {
            sensitivity.recommendation = 'use_existing';
            sensitivity.onboardingCompleted = true;
        }

        res.json(sensitivity);
    } catch (error) {
        console.error('Error checking sensitivity:', error.message);
        res.status(500).json({ error: 'Failed to check sensitivity' });
    }
});

// POST /api/project-soul/:name/generate — Generate SOUL from onboarding wizard selections
app.post('/api/project-soul/:name/generate', async (req, res) => {
    const { name } = req.params;
    const { selections, saveToRepo } = req.body;

    if (!selections) {
        return res.status(400).json({ error: 'Selections are required' });
    }

    try {
        const project = await findProjectByName(name);
        if (!project) {
            return res.status(404).json({ error: `Project "${name}" not found` });
        }

        // Import chat-api for generateSoulFromSelections
        const { generateSoulFromSelections } = require('./chat-api');

        console.log(`[Soul] Generating SOUL for ${project.name} from onboarding selections...`);

        // Generate SOUL.md content using LLM
        const result = await generateSoulFromSelections(project.name, selections, project.path);

        if (!result.success) {
            return res.status(500).json({ error: result.error || 'Failed to generate SOUL' });
        }

        // Save to soul-manager
        await soulManager.saveSoulFromOnboarding(
            project.name,
            selections,
            result.soulMd,
            result.personality
        );

        console.log(`[Soul] ✅ SOUL generated and saved for ${project.name}`);

        // Optionally save SOUL.md to project repo
        if (saveToRepo && project.path) {
            try {
                const soulPath = path.join(project.path, 'SOUL.md');
                await fs.writeFile(soulPath, result.soulMd, 'utf-8');
                console.log(`[Soul] ✅ SOUL.md written to ${project.path}`);
                result.savedToRepo = true;
            } catch (e) {
                console.error(`[Soul] Could not write SOUL.md to repo:`, e.message);
                result.savedToRepo = false;
            }
        }

        res.json({
            success: true,
            soulMd: result.soulMd,
            personality: result.personality,
            savedToRepo: result.savedToRepo || false
        });
    } catch (error) {
        console.error('Error generating SOUL:', error.message);
        res.status(500).json({ error: error.message || 'Failed to generate SOUL' });
    }
});

// POST /api/content/generate — Generate BIP content with personas and templates
app.post('/api/content/generate', async (req, res) => {
    const { prompt, template, persona, project } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    try {
        // Gather context (same structure as /api/chat)
        const projects = await loadProjectsConfig();

        const backlogContent = await fs.readFile(PATHS.backlog, 'utf-8').catch(() => '');
        const backlogItems = parseBacklog(backlogContent);

        const sessionContent = await fs.readFile(PATHS.sessionLog, 'utf-8').catch(() => '');
        const sessionLog = sessionContent ? parseSessionLog(sessionContent) : [];

        let drafts = [];
        try {
            const files = await fs.readdir(PATHS.drafts);
            const mdFiles = files.filter(f => f.endsWith('.md') && f !== 'README.md');
            drafts = await Promise.all(
                mdFiles.map(filename => parseDraft(path.join(PATHS.drafts, filename)))
            );
        } catch (e) { /* No drafts */ }

        const { loadProjects, scanProject, getActivityStats } = require('./watcher');
        let gitActivity = [];
        try {
            const allProjects = await loadProjects();
            for (const proj of allProjects) {
                const scanResult = await scanProject(proj.path);
                const stats = getActivityStats(proj.name, scanResult);
                gitActivity.push(stats);
            }
        } catch (e) { /* Watcher not available */ }

        const buddyMessage = await getBuddyMessage().catch(() => null);

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
            const draftsData = await fs.readFile(PATHS.aiDrafts, 'utf-8').catch(() => '[]');
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
            await fs.writeFile(PATHS.aiDrafts, JSON.stringify(trimmed, null, 2));
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
                error: 'Rate limit. Wait a minute.'
            });
        }

        if (error.status === 500 || error.response?.status === 500) {
            return res.status(500).json({
                success: false,
                error: 'Claude is not responding. Try again.'
            });
        }

        res.status(500).json({
            success: false,
            error: error.message || 'Something went wrong.'
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

        // Mark already connected repos
        const existingProjects = await loadProjectsConfig();
        const connectedUrls = new Set(
            existingProjects.filter(p => p.github).map(p => normalizeGitUrl(p.github))
        );

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

// GET /api/projects — Get all connected projects (validates path existence)
app.get('/api/projects', async (req, res) => {
    try {
        const allProjects = await loadProjectsConfig();

        // Validate each project's path exists
        const validatedProjects = [];
        const staleProjects = [];

        for (const project of allProjects) {
            try {
                await fs.access(project.path);
                validatedProjects.push({ ...project, exists: true });
            } catch (e) {
                // Path doesn't exist
                staleProjects.push(project);
                console.log(`[Projects] Stale project detected: ${project.name} (${project.path})`);
            }
        }

        // Auto-cleanup if ?cleanup=true or if there are stale projects
        if (staleProjects.length > 0 && req.query.cleanup === 'true') {
            // Update projects.json without stale entries
            const cleanedData = {
                projects: validatedProjects.map(p => {
                    const { exists, ...rest } = p;
                    return rest;
                })
            };
            await fs.writeFile(projectsPath, JSON.stringify(cleanedData, null, 4));
            console.log(`[Projects] Cleaned up ${staleProjects.length} stale project(s)`);
        }

        res.json(validatedProjects);
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
