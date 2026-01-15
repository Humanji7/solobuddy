/* ============================================
   Sensitivity Detector — Project SOUL Onboarding Trigger
   Determines if a project needs SOUL onboarding based on signals
   ============================================ */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

// Signal weights for sensitivity scoring
const SIGNAL_WEIGHTS = {
    philosophy_doc: 3,
    vision_doc: 2,
    emotional_readme: 2,
    mature_project: 1,
    active_project: 1,
    agent_prompts: 1
};

// Emotional language patterns (English + Russian)
const EMOTIONAL_PATTERNS = [
    /живой|живое|живая/i,
    /чувств|ощущен/i,
    /душ[ауе]/i,
    /дыш|вдох|выдох/i,
    /journey|experience/i,
    /soul|spirit|alive/i,
    /breathing|organic|living/i,
    /labyrinth|путешеств/i,
    /философ|meaning|purpose/i
];

/**
 * Check if a file/directory exists
 * @param {string} filepath 
 * @returns {Promise<boolean>}
 */
async function fileExists(filepath) {
    try {
        await fs.access(filepath);
        return true;
    } catch {
        return false;
    }
}

/**
 * Get git commit count for a project
 * @param {string} projectPath 
 * @returns {number}
 */
function getCommitCount(projectPath) {
    try {
        const result = execSync('git rev-list --count HEAD', {
            cwd: projectPath,
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe']
        });
        return parseInt(result.trim()) || 0;
    } catch {
        return 0;
    }
}

/**
 * Get commits in the last week
 * @param {string} projectPath 
 * @returns {number}
 */
function getRecentCommits(projectPath) {
    try {
        const result = execSync('git rev-list --count --since="7 days ago" HEAD', {
            cwd: projectPath,
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe']
        });
        return parseInt(result.trim()) || 0;
    } catch {
        return 0;
    }
}

/**
 * Check for emotional language in README
 * @param {string} projectPath 
 * @returns {Promise<boolean>}
 */
async function hasEmotionalReadme(projectPath) {
    try {
        const readmePath = path.join(projectPath, 'README.md');
        const content = await fs.readFile(readmePath, 'utf-8');
        return EMOTIONAL_PATTERNS.some(pattern => pattern.test(content));
    } catch {
        return false;
    }
}

/**
 * Check if project has SOUL.md already
 * @param {string} projectPath 
 * @returns {Promise<boolean>}
 */
async function hasSoulFile(projectPath) {
    return await fileExists(path.join(projectPath, 'SOUL.md'));
}

/**
 * Calculate sensitivity score and collect signals
 * @param {string} projectPath - Absolute path to project
 * @returns {Promise<{score: number, signals: Array<{type: string, weight: number}>}>}
 */
async function collectSignals(projectPath) {
    const signals = [];

    // Check for philosophy/vision docs
    const docsPath = path.join(projectPath, 'docs');
    if (await fileExists(path.join(docsPath, 'PHILOSOPHY.md'))) {
        signals.push({ type: 'philosophy_doc', weight: SIGNAL_WEIGHTS.philosophy_doc });
    }
    if (await fileExists(path.join(docsPath, 'VISION.md'))) {
        signals.push({ type: 'vision_doc', weight: SIGNAL_WEIGHTS.vision_doc });
    }

    // Check for emotional language in README
    if (await hasEmotionalReadme(projectPath)) {
        signals.push({ type: 'emotional_readme', weight: SIGNAL_WEIGHTS.emotional_readme });
    }

    // Check project maturity (100+ commits)
    const commitCount = getCommitCount(projectPath);
    if (commitCount >= 100) {
        signals.push({ type: 'mature_project', weight: SIGNAL_WEIGHTS.mature_project, commits: commitCount });
    }

    // Check recent activity (10+ commits this week)
    const recentCommits = getRecentCommits(projectPath);
    if (recentCommits >= 10) {
        signals.push({ type: 'active_project', weight: SIGNAL_WEIGHTS.active_project, recentCommits });
    }

    // Check for .agent/prompts/
    if (await fileExists(path.join(projectPath, '.agent', 'prompts'))) {
        signals.push({ type: 'agent_prompts', weight: SIGNAL_WEIGHTS.agent_prompts });
    }

    const score = signals.reduce((sum, s) => sum + s.weight, 0);

    return { score, signals };
}

/**
 * Determine sensitivity level from score
 * @param {number} score 
 * @returns {'high' | 'medium' | 'low'}
 */
function getSensitivityLevel(score) {
    if (score >= 4) return 'high';
    if (score >= 2) return 'medium';
    return 'low';
}

/**
 * Get sensitivity analysis for a project
 * @param {string} projectName 
 * @param {string} projectPath - Absolute path to project
 * @returns {Promise<Object>} - Full sensitivity analysis
 */
async function getSensitivity(projectName, projectPath) {
    const hasSoul = await hasSoulFile(projectPath);

    // If already has SOUL.md, no need for onboarding
    if (hasSoul) {
        return {
            project: projectName,
            sensitivity: 'has_soul',
            score: 0,
            signals: [],
            hasSoul: true,
            recommendation: 'use_existing'
        };
    }

    const { score, signals } = await collectSignals(projectPath);
    const sensitivity = getSensitivityLevel(score);

    let recommendation;
    if (sensitivity === 'high') {
        recommendation = 'onboarding';          // Force onboarding wizard
    } else if (sensitivity === 'medium') {
        recommendation = 'suggest_onboarding';  // Show toast, don't force
    } else {
        recommendation = 'auto_extract';        // Just use README extraction
    }

    return {
        project: projectName,
        sensitivity,
        score,
        signals,
        hasSoul: false,
        recommendation
    };
}

module.exports = {
    getSensitivity,
    hasSoulFile,
    collectSignals,
    getSensitivityLevel,
    SIGNAL_WEIGHTS
};
