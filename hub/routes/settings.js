/**
 * Settings API Routes
 * GET /api/settings — get all settings
 * PUT /api/settings — update settings (partial update)
 */

const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const SETTINGS_PATH = path.join(__dirname, '../data/settings.json');

/**
 * Load settings from file
 */
function loadSettings() {
    try {
        const data = fs.readFileSync(SETTINGS_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        // Return default if file doesn't exist
        return {
            profile: {
                bipStartDate: null,
                currentPhase: 'early',
                goals: [],
                timezone: 'UTC'
            },
            platforms: {
                twitter: { handle: '', followers: 0 },
                telegram: { handle: '', followers: 0 },
                linkedin: { handle: '', followers: 0 }
            }
        };
    }
}

/**
 * Save settings to file
 */
function saveSettings(settings) {
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
}

/**
 * GET /api/settings
 * Returns all settings
 */
router.get('/', (req, res) => {
    try {
        const settings = loadSettings();
        res.json(settings);
    } catch (error) {
        console.error('Error loading settings:', error);
        res.status(500).json({ error: 'Failed to load settings' });
    }
});

/**
 * PUT /api/settings
 * Partial update — merges with existing settings
 * Body: { profile?: {...}, platforms?: {...} }
 */
router.put('/', (req, res) => {
    try {
        const current = loadSettings();
        const updates = req.body;

        // Deep merge for profile
        if (updates.profile) {
            current.profile = { ...current.profile, ...updates.profile };
        }

        // Deep merge for platforms
        if (updates.platforms) {
            for (const platform of Object.keys(updates.platforms)) {
                if (current.platforms[platform]) {
                    current.platforms[platform] = {
                        ...current.platforms[platform],
                        ...updates.platforms[platform]
                    };
                } else {
                    current.platforms[platform] = updates.platforms[platform];
                }
            }
        }

        saveSettings(current);
        res.json({ success: true, settings: current });
    } catch (error) {
        console.error('Error saving settings:', error);
        res.status(500).json({ error: 'Failed to save settings' });
    }
});

module.exports = router;
