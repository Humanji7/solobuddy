/**
 * Content routes - session-log, backlog, drafts, ai-drafts, content generation
 */

const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();

const { PATHS, ensureDataDir, asyncHandler, loadProjectsConfig } = require('../config');
const { parseSessionLog, parseBacklog, parseDraft } = require('../parsing');
const { getBuddyMessage } = require('../watcher');
const { generateContent } = require('../chat-api');

// GET /api/session-log
router.get('/session-log', asyncHandler(
    async () => {
        const content = await fs.readFile(PATHS.sessionLog, 'utf-8');
        return parseSessionLog(content);
    },
    'Failed to read session log'
));

// GET /api/backlog
router.get('/backlog', asyncHandler(
    async () => {
        const content = await fs.readFile(PATHS.backlog, 'utf-8');
        return parseBacklog(content);
    },
    'Failed to read backlog'
));

// GET /api/drafts
router.get('/drafts', async (req, res) => {
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
router.post('/backlog', async (req, res) => {
    try {
        const { title, format, priority, project } = req.body;

        if (!title) {
            return res.status(400).json({ error: 'Title is required' });
        }

        let content = await fs.readFile(PATHS.backlog, 'utf-8');

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

        const afterSection = content.indexOf('\n\n', sectionIndex);
        const insertPoint = afterSection !== -1 ? afterSection + 2 : sectionIndex + targetSection.length + 1;

        const formatLabels = {
            'thread': 'Thread',
            'gif': 'GIF + Caption',
            'video': 'Demo Video',
            'post': 'Short Post'
        };

        let newEntry = `- [ ] **${title}**\n  - Format: ${formatLabels[format] || format}\n`;
        if (project) {
            newEntry += `  - Project: ${project}\n`;
        }
        newEntry += '\n';

        content = content.slice(0, insertPoint) + newEntry + content.slice(insertPoint);
        await fs.writeFile(PATHS.backlog, content, 'utf-8');

        res.json({ success: true, message: 'Idea added to backlog', project });
    } catch (error) {
        console.error('Error adding to backlog:', error);
        res.status(500).json({ error: 'Failed to add idea to backlog' });
    }
});

// POST /api/ideas/:id/link — Link idea to project
router.post('/ideas/:id/link', async (req, res) => {
    try {
        const ideaId = parseInt(req.params.id);
        const { project } = req.body;

        if (!project) {
            return res.status(400).json({ error: 'Project name is required' });
        }

        let content = await fs.readFile(PATHS.backlog, 'utf-8');
        const backlogItems = parseBacklog(content);

        const idea = backlogItems.find(item => item.id === ideaId);
        if (!idea) {
            return res.status(404).json({ error: 'Idea not found' });
        }

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

        let insertIndex = ideaLineIndex + 1;
        let existingProjectIndex = -1;

        for (let j = ideaLineIndex + 1; j < lines.length; j++) {
            if (lines[j].match(/^-\s*\[/)) break;
            if (lines[j].match(/^##/)) break;
            if (lines[j].match(/^\s*$/)) break;
            if (lines[j].match(/Project:\s*/i)) {
                existingProjectIndex = j;
            }
            insertIndex = j + 1;
        }

        if (existingProjectIndex !== -1) {
            lines[existingProjectIndex] = `  - Project: ${project}`;
        } else {
            lines.splice(insertIndex, 0, `  - Project: ${project}`);
        }

        await fs.writeFile(PATHS.backlog, lines.join('\n'), 'utf-8');
        res.json({ success: true, ideaId, project });
    } catch (error) {
        console.error('Error linking idea to project:', error);
        res.status(500).json({ error: 'Failed to link idea to project' });
    }
});

// POST /api/feedback — Store learning feedback
router.post('/feedback', async (req, res) => {
    try {
        const { cardType, intent, feedback, timestamp } = req.body;

        if (!feedback) {
            return res.status(400).json({ error: 'Feedback is required' });
        }

        const feedbackPath = path.join(__dirname, '..', 'data', 'feedback.json');
        await ensureDataDir();

        let data = [];
        try {
            const existing = await fs.readFile(feedbackPath, 'utf-8');
            data = JSON.parse(existing);
        } catch (e) { /* No file yet */ }

        data.push({
            cardType: cardType || 'unknown',
            intent: intent || '',
            feedback,
            timestamp: timestamp || Date.now()
        });

        await fs.writeFile(feedbackPath, JSON.stringify(data, null, 2));
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving feedback:', error);
        res.status(500).json({ error: 'Failed to save feedback' });
    }
});

// GET /api/ai-drafts
router.get('/ai-drafts', async (req, res) => {
    try {
        await ensureDataDir();

        let drafts = [];
        try {
            const data = await fs.readFile(PATHS.aiDrafts, 'utf-8');
            drafts = JSON.parse(data);
        } catch (e) { /* No file yet */ }

        drafts.sort((a, b) => b.timestamp - a.timestamp);
        res.json(drafts);
    } catch (error) {
        console.error('Error loading AI drafts:', error);
        res.status(500).json({ error: 'Failed to load drafts' });
    }
});

// POST /api/ai-drafts
router.post('/ai-drafts', async (req, res) => {
    try {
        const { content, prompt, template, project, persona, tokensUsed } = req.body;

        if (!content) {
            return res.status(400).json({ error: 'Content is required' });
        }

        await ensureDataDir();

        let drafts = [];
        try {
            const data = await fs.readFile(PATHS.aiDrafts, 'utf-8');
            drafts = JSON.parse(data);
        } catch (e) { /* No file yet */ }

        const newDraft = {
            id: Date.now(),
            content,
            prompt: prompt || '',
            template: template || 'thread',
            project: project || null,
            persona: persona || 'jester-sage',
            tokensUsed: tokensUsed || 0,
            timestamp: Date.now(),
            status: 'draft'
        };

        drafts.push(newDraft);
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

// DELETE /api/ai-drafts/:id
router.delete('/ai-drafts/:id', async (req, res) => {
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

// GET /api/buddy-message
router.get('/buddy-message', async (req, res) => {
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

// POST /api/content/generate
router.post('/content/generate', async (req, res) => {
    const { prompt, template, persona, project } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    try {
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

        const { loadProjects, scanProject, getActivityStats } = require('../watcher');
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

        // Load voice examples (my posts) for style training
        let voiceExamples = [];
        try {
            const postsData = await fs.readFile(PATHS.myPosts, 'utf-8');
            const parsed = JSON.parse(postsData);
            const allPosts = parsed.posts || [];

            // Filter by project if specified, otherwise use all
            const filtered = project
                ? allPosts.filter(p => p.project && p.project.toLowerCase() === project.toLowerCase())
                : allPosts;

            // Shuffle and take up to 5 examples
            voiceExamples = filtered
                .sort(() => Math.random() - 0.5)
                .slice(0, 5);
        } catch (e) { /* No posts yet */ }

        const context = {
            projects,
            backlogItems,
            sessionLog,
            drafts,
            gitActivity,
            buddyMessage,
            voiceExamples
        };

        const result = await generateContent(
            { prompt, template, persona, project },
            context
        );

        // Auto-save draft
        try {
            const draftsData = await fs.readFile(PATHS.aiDrafts, 'utf-8').catch(() => '[]');
            const allDrafts = JSON.parse(draftsData);
            allDrafts.push({
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
            const trimmed = allDrafts.slice(-100);
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

        if (error.response?.status === 429) {
            return res.status(429).json({ success: false, error: 'Rate limit. Wait a minute.' });
        }
        if (error.status === 500 || error.response?.status === 500) {
            return res.status(500).json({ success: false, error: 'Claude is not responding. Try again.' });
        }

        res.status(500).json({ success: false, error: error.message || 'Something went wrong.' });
    }
});

module.exports = router;
