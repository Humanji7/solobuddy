/* ============================================
   Soul Manager — Project Memory Persistence
   Manages soul files in data/project-souls/
   ============================================ */

const fs = require('fs').promises;
const path = require('path');

const SOULS_DIR = path.join(__dirname, '..', 'data', 'project-souls');

/**
 * Default soul structure for new projects
 */
function createDefaultSoul(projectName, projectPath) {
    return {
        projectName,
        projectPath: projectPath || null,
        personality: null, // Will be extracted from README
        memories: [],
        createdAt: new Date().toISOString(),
        lastInteraction: null
    };
}

/**
 * Get safe filename from project name
 */
function getSoulFilename(projectName) {
    return projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-') + '.json';
}

/**
 * Load soul file for a project
 * Creates default soul if doesn't exist
 * @param {string} projectName 
 * @param {string} projectPath - optional, used for new souls
 * @returns {Object} soul data
 */
async function loadSoul(projectName, projectPath = null) {
    const filename = getSoulFilename(projectName);
    const filepath = path.join(SOULS_DIR, filename);

    try {
        const data = await fs.readFile(filepath, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        // Create new soul if file doesn't exist
        const soul = createDefaultSoul(projectName, projectPath);
        await saveSoul(projectName, soul);
        return soul;
    }
}

/**
 * Save soul file
 * @param {string} projectName 
 * @param {Object} soul 
 */
async function saveSoul(projectName, soul) {
    const filename = getSoulFilename(projectName);
    const filepath = path.join(SOULS_DIR, filename);

    // Ensure directory exists
    await fs.mkdir(SOULS_DIR, { recursive: true });
    await fs.writeFile(filepath, JSON.stringify(soul, null, 2), 'utf-8');
}

/**
 * Add a memory to project's soul
 * Keeps only last 10 memories
 * @param {string} projectName 
 * @param {Object} memory - { summary, emotion? }
 */
async function addMemory(projectName, memory) {
    const soul = await loadSoul(projectName);

    const newMemory = {
        ...memory,
        timestamp: new Date().toISOString()
    };

    soul.memories.push(newMemory);

    // Keep only last 10 memories
    if (soul.memories.length > 10) {
        soul.memories = soul.memories.slice(-10);
    }

    soul.lastInteraction = new Date().toISOString();
    await saveSoul(projectName, soul);

    return soul;
}

/**
 * Update personality from README extraction
 * @param {string} projectName 
 * @param {Object} personality - { purpose, tone, techStack, keyPhrases }
 */
async function updatePersonality(projectName, personality) {
    const soul = await loadSoul(projectName);

    soul.personality = {
        ...personality,
        extractedAt: new Date().toISOString()
    };

    await saveSoul(projectName, soul);
    return soul;
}

/**
 * Calculate days since last interaction
 * @param {Object} soul 
 * @returns {number|null}
 */
function getDaysSilent(soul) {
    if (!soul.lastInteraction) return null;

    const last = new Date(soul.lastInteraction);
    const now = new Date();
    const diffMs = now - last;
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Get all souls (for debugging/admin)
 */
async function listSouls() {
    try {
        const files = await fs.readdir(SOULS_DIR);
        const souls = [];

        for (const file of files) {
            if (file.endsWith('.json')) {
                const data = await fs.readFile(path.join(SOULS_DIR, file), 'utf-8');
                souls.push(JSON.parse(data));
            }
        }

        return souls;
    } catch (e) {
        return [];
    }
}

module.exports = {
    loadSoul,
    saveSoul,
    addMemory,
    updatePersonality,
    getDaysSilent,
    listSouls,
    SOULS_DIR
};
