/**
 * User context routes - onboarding and settings
 */

const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();

const USER_CONTEXT_PATH = path.join(__dirname, '..', 'data', 'user-context.json');

// Default user context
const DEFAULT_CONTEXT = {
    onboarded: false,
    phase: 'shotgun',
    projects: [],
    platforms: [],
    skills: [],
    timePerDay: 30,
    goals: [],
    language: 'ru'
};

/**
 * Load user context from file
 */
async function loadUserContext() {
    try {
        const data = await fs.readFile(USER_CONTEXT_PATH, 'utf-8');
        return { ...DEFAULT_CONTEXT, ...JSON.parse(data) };
    } catch (error) {
        // File doesn't exist or is invalid — return defaults
        return { ...DEFAULT_CONTEXT };
    }
}

/**
 * Save user context to file
 */
async function saveUserContext(context) {
    const dataDir = path.dirname(USER_CONTEXT_PATH);
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(USER_CONTEXT_PATH, JSON.stringify(context, null, 4), 'utf-8');
}

// GET /api/user-context
router.get('/user-context', async (req, res) => {
    try {
        const context = await loadUserContext();
        res.json(context);
    } catch (error) {
        console.error('[UserContext] Error loading:', error.message);
        res.status(500).json({ error: 'Failed to load user context' });
    }
});

// POST /api/user-context
router.post('/user-context', async (req, res) => {
    try {
        const currentContext = await loadUserContext();
        const updatedContext = {
            ...currentContext,
            ...req.body,
            onboarded: true,
            updatedAt: new Date().toISOString()
        };

        await saveUserContext(updatedContext);
        console.log('[UserContext] ✅ Context saved:', {
            phase: updatedContext.phase,
            platforms: updatedContext.platforms.length,
            projects: updatedContext.projects.length
        });

        res.json({ success: true, context: updatedContext });
    } catch (error) {
        console.error('[UserContext] Error saving:', error.message);
        res.status(500).json({ error: 'Failed to save user context' });
    }
});

module.exports = router;
