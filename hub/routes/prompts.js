/**
 * Prompts API Routes
 * Manage system prompts: Hub Chat, Voice, Soul
 *
 * GET  /api/prompts/chat       — get hub chat prompt
 * PUT  /api/prompts/chat       — update hub chat prompt
 * POST /api/prompts/chat/reset — reset to default
 *
 * GET  /api/prompts/voice      — get voice prompt
 * PUT  /api/prompts/voice      — update voice prompt
 * POST /api/prompts/voice/reset — reset to default
 *
 * GET  /api/prompts/soul       — get soul content (requires projectName query)
 * PUT  /api/prompts/soul       — update soul content
 */

const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const router = express.Router();

// File paths
const CHAT_PROMPT_PATH = path.join(__dirname, '../../system-prompt-v2.md');
const VOICE_PROMPT_PATH = path.join(__dirname, '../prompts/jester-sage.md');

// Default prompts directory
const DEFAULTS_DIR = path.join(__dirname, '../prompts/defaults');

/**
 * Ensure defaults directory exists and save original prompts as defaults
 */
async function ensureDefaults() {
    try {
        await fs.mkdir(DEFAULTS_DIR, { recursive: true });

        // Save chat default if not exists
        const chatDefaultPath = path.join(DEFAULTS_DIR, 'chat.md');
        try {
            await fs.access(chatDefaultPath);
        } catch {
            const chatContent = await fs.readFile(CHAT_PROMPT_PATH, 'utf-8');
            await fs.writeFile(chatDefaultPath, chatContent);
        }

        // Save voice default if not exists
        const voiceDefaultPath = path.join(DEFAULTS_DIR, 'voice.md');
        try {
            await fs.access(voiceDefaultPath);
        } catch {
            const voiceContent = await fs.readFile(VOICE_PROMPT_PATH, 'utf-8');
            await fs.writeFile(voiceDefaultPath, voiceContent);
        }
    } catch (error) {
        console.error('Error ensuring defaults:', error);
    }
}

// Initialize defaults on module load
ensureDefaults();

// ============================================
// Hub Chat Prompt
// ============================================

router.get('/chat', async (req, res) => {
    try {
        const content = await fs.readFile(CHAT_PROMPT_PATH, 'utf-8');
        res.json({ content, path: 'system-prompt-v2.md' });
    } catch (error) {
        console.error('Error reading chat prompt:', error);
        res.status(500).json({ error: 'Failed to read chat prompt' });
    }
});

router.put('/chat', async (req, res) => {
    try {
        const { content } = req.body;
        if (!content || typeof content !== 'string') {
            return res.status(400).json({ error: 'Content is required' });
        }

        await fs.writeFile(CHAT_PROMPT_PATH, content, 'utf-8');
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving chat prompt:', error);
        res.status(500).json({ error: 'Failed to save chat prompt' });
    }
});

router.post('/chat/reset', async (req, res) => {
    try {
        const defaultPath = path.join(DEFAULTS_DIR, 'chat.md');
        const defaultContent = await fs.readFile(defaultPath, 'utf-8');
        await fs.writeFile(CHAT_PROMPT_PATH, defaultContent, 'utf-8');
        res.json({ success: true, content: defaultContent });
    } catch (error) {
        console.error('Error resetting chat prompt:', error);
        res.status(500).json({ error: 'Failed to reset chat prompt' });
    }
});

// ============================================
// Voice Prompt
// ============================================

router.get('/voice', async (req, res) => {
    try {
        const content = await fs.readFile(VOICE_PROMPT_PATH, 'utf-8');
        res.json({ content, path: 'prompts/jester-sage.md' });
    } catch (error) {
        console.error('Error reading voice prompt:', error);
        res.status(500).json({ error: 'Failed to read voice prompt' });
    }
});

router.put('/voice', async (req, res) => {
    try {
        const { content } = req.body;
        if (!content || typeof content !== 'string') {
            return res.status(400).json({ error: 'Content is required' });
        }

        await fs.writeFile(VOICE_PROMPT_PATH, content, 'utf-8');
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving voice prompt:', error);
        res.status(500).json({ error: 'Failed to save voice prompt' });
    }
});

router.post('/voice/reset', async (req, res) => {
    try {
        const defaultPath = path.join(DEFAULTS_DIR, 'voice.md');
        const defaultContent = await fs.readFile(defaultPath, 'utf-8');
        await fs.writeFile(VOICE_PROMPT_PATH, defaultContent, 'utf-8');
        res.json({ success: true, content: defaultContent });
    } catch (error) {
        console.error('Error resetting voice prompt:', error);
        res.status(500).json({ error: 'Failed to reset voice prompt' });
    }
});

// ============================================
// Soul Content
// ============================================

const SOULS_DIR = path.join(__dirname, '../data/project-souls');

router.get('/soul', async (req, res) => {
    try {
        const { projectName } = req.query;
        if (!projectName) {
            return res.status(400).json({ error: 'projectName query parameter is required' });
        }

        const filename = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-') + '.json';
        const filepath = path.join(SOULS_DIR, filename);

        const data = await fs.readFile(filepath, 'utf-8');
        const soul = JSON.parse(data);

        res.json({
            projectName: soul.projectName,
            content: soul.soulMdContent || '',
            hasOnboarding: soul.onboardingCompleted || false
        });
    } catch (error) {
        if (error.code === 'ENOENT') {
            return res.status(404).json({ error: 'Soul not found for this project' });
        }
        console.error('Error reading soul:', error);
        res.status(500).json({ error: 'Failed to read soul' });
    }
});

router.put('/soul', async (req, res) => {
    try {
        const { projectName, content } = req.body;
        if (!projectName) {
            return res.status(400).json({ error: 'projectName is required' });
        }
        if (typeof content !== 'string') {
            return res.status(400).json({ error: 'content is required' });
        }

        const filename = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-') + '.json';
        const filepath = path.join(SOULS_DIR, filename);

        // Read existing soul
        let soul;
        try {
            const data = await fs.readFile(filepath, 'utf-8');
            soul = JSON.parse(data);
        } catch {
            return res.status(404).json({ error: 'Soul not found for this project' });
        }

        // Update soulMdContent
        soul.soulMdContent = content;
        soul.lastInteraction = new Date().toISOString();

        await fs.writeFile(filepath, JSON.stringify(soul, null, 2), 'utf-8');
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving soul:', error);
        res.status(500).json({ error: 'Failed to save soul' });
    }
});

/**
 * List all projects with souls (for dropdown in UI)
 */
router.get('/soul/list', async (req, res) => {
    try {
        const files = await fs.readdir(SOULS_DIR);
        const projects = [];

        for (const file of files) {
            if (file.endsWith('.json')) {
                try {
                    const data = await fs.readFile(path.join(SOULS_DIR, file), 'utf-8');
                    const soul = JSON.parse(data);
                    projects.push({
                        name: soul.projectName,
                        hasOnboarding: soul.onboardingCompleted || false,
                        hasSoulContent: !!soul.soulMdContent
                    });
                } catch {
                    // Skip invalid files
                }
            }
        }

        res.json(projects);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return res.json([]);
        }
        console.error('Error listing souls:', error);
        res.status(500).json({ error: 'Failed to list souls' });
    }
});

module.exports = router;
