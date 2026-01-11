/* ============================================
   SoloBuddy Git Watcher
   Monitors project activity and generates insights
   ============================================ */

const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const util = require('util');

const execAsync = util.promisify(exec);

// Import updateProjectRemotes for auto-updating github fields
const { updateProjectRemotes } = require('./github-api');

// Path to projects config
const PROJECTS_CONFIG = path.join(__dirname, '..', 'data', 'projects.json');

// ============================================
// Git Scanning Functions
// ============================================

/**
 * Check if a path exists and is a git repository
 */
async function isGitRepo(repoPath) {
    try {
        await fs.access(path.join(repoPath, '.git'));
        return true;
    } catch {
        return false;
    }
}

/**
 * Scan a single project's git history
 * Returns commits from the last 7 days
 */
async function scanProject(projectPath) {
    if (!await isGitRepo(projectPath)) {
        return { error: 'Not a git repository', commits: [] };
    }

    try {
        // Get commits from last 7 days with timestamp
        const { stdout } = await execAsync(
            `git log --since="7 days ago" --format="%H|%at|%s" --no-merges`,
            { cwd: projectPath }
        );

        if (!stdout.trim()) {
            return { commits: [], lastCommitDaysAgo: null };
        }

        const commits = stdout.trim().split('\n').map(line => {
            const [hash, timestamp, message] = line.split('|');
            return {
                hash,
                timestamp: parseInt(timestamp) * 1000,
                message
            };
        });

        return { commits };
    } catch (error) {
        return { error: error.message, commits: [] };
    }
}

/**
 * Get activity statistics for a project
 */
function getActivityStats(projectName, scanResult) {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    if (scanResult.error || scanResult.commits.length === 0) {
        // Try to get last commit date
        return {
            name: projectName,
            commitsToday: 0,
            commitsYesterday: 0,
            commitsThisWeek: 0,
            daysSilent: null, // Unknown
            isActive: false
        };
    }

    const commits = scanResult.commits;
    const todayStart = new Date().setHours(0, 0, 0, 0);
    const yesterdayStart = todayStart - oneDayMs;

    const commitsToday = commits.filter(c => c.timestamp >= todayStart).length;
    const commitsYesterday = commits.filter(c =>
        c.timestamp >= yesterdayStart && c.timestamp < todayStart
    ).length;

    // Days since last commit
    const lastCommitTime = commits[0].timestamp;
    const daysSilent = Math.floor((now - lastCommitTime) / oneDayMs);

    return {
        name: projectName,
        commitsToday,
        commitsYesterday,
        commitsThisWeek: commits.length,
        daysSilent,
        isActive: daysSilent === 0,
        lastCommitMessage: commits[0].message
    };
}

/**
 * Generate an insight message based on stats
 * ALWAYS returns an insight for any project with activity
 */
function generateInsight(stats) {
    const { name, commitsToday, commitsYesterday, commitsThisWeek, daysSilent, lastCommitMessage } = stats;

    // Priority 1: Hot today (3+ commits) — direct
    if (commitsToday >= 3) {
        const templates = [
            `${name}: ${commitsToday} commits today. Nice.`,
            `${commitsToday} commits in ${name}. Keep going.`,
            `${name} is on fire. ${commitsToday} commits.`
        ];
        return {
            message: templates[Math.floor(Math.random() * templates.length)],
            type: 'active',
            priority: 5
        };
    }

    // Priority 2: Some activity today (1-2 commits)
    if (commitsToday >= 1) {
        const templates = [
            `${name}: ${commitsToday} commit today.`,
            `${name} — you're working.`,
            `${name} is moving.`
        ];
        return {
            message: templates[Math.floor(Math.random() * templates.length)],
            type: 'active',
            priority: 4
        };
    }

    // Priority 3: Yesterday was active (3+ commits)
    if (commitsYesterday >= 3) {
        const templates = [
            `Yesterday ${name} was hot (${commitsYesterday}). What about today?`,
            `${commitsYesterday} commits yesterday in ${name}. So what now?`,
            `${name}: ${commitsYesterday} yesterday. Quiet today so far.`
        ];
        return {
            message: templates[Math.floor(Math.random() * templates.length)],
            type: 'momentum',
            priority: 3
        };
    }

    // Priority 4: Yesterday had some activity
    if (commitsYesterday >= 1) {
        const templates = [
            `${name}: had ${commitsYesterday} yesterday. Continue?`,
            `Touched ${name} yesterday. Today?`
        ];
        return {
            message: templates[Math.floor(Math.random() * templates.length)],
            type: 'momentum',
            priority: 2
        };
    }

    // Priority 5: Long silence (3+ days) — provocative
    if (daysSilent !== null && daysSilent >= 3) {
        const templates = [
            `${name} silent for ${daysSilent} ${getDaysWord(daysSilent)}. Anyone alive?`,
            `${daysSilent} days without commits in ${name}. Gave up?`,
            `${name} in a coma for ${daysSilent} ${getDaysWord(daysSilent)}.`
        ];
        return {
            message: templates[Math.floor(Math.random() * templates.length)],
            type: 'silent',
            priority: 1
        };
    }

    // Priority 6: Any weekly activity — fallback
    if (commitsThisWeek > 0) {
        const templates = [
            `${name}: ${commitsThisWeek} this week.`,
            `${name} — ${commitsThisWeek} commits this week.`,
            `${name} slowly. ${commitsThisWeek} commits.`
        ];
        return {
            message: templates[Math.floor(Math.random() * templates.length)],
            type: 'weekly',
            priority: 0
        };
    }

    // Still nothing — project exists but no commits in 7 days
    if (daysSilent !== null) {
        return {
            message: `${name}: silent for ${daysSilent} ${getDaysWord(daysSilent)}.`,
            type: 'silent',
            priority: 0
        };
    }

    // Absolutely nothing known
    return {
        message: `${name} — no data.`,
        type: 'unknown',
        priority: 0
    };
}

/**
 * Helper: English days word form
 */
function getDaysWord(n) {
    return n === 1 ? 'day' : 'days';
}

// ============================================
// Color Schemes for random selection
// ============================================

const COLOR_SCHEMES = [
    { name: 'ember', accent: '#E85D04' },
    { name: 'ocean', accent: '#0077B6' },
    { name: 'sage', accent: '#2D6A4F' },
    { name: 'plum', accent: '#7B2CBF' },
    { name: 'rust', accent: '#9B2226' },
    { name: 'steel', accent: '#495057' }
];

function pickRandomColorScheme() {
    return COLOR_SCHEMES[Math.floor(Math.random() * COLOR_SCHEMES.length)];
}

// Calm messages when nothing is happening
const CALM_MESSAGES = [
    'Silence. Working or slacking?',
    'All quiet. Suspiciously quiet.',
    'Projects are silent. How are you?',
    'Nothing new. Good or bad?',
    'Calm. The calm before the storm?'
];

function getRandomCalmMessage() {
    return CALM_MESSAGES[Math.floor(Math.random() * CALM_MESSAGES.length)];
}

// ============================================
// Main Export Functions
// ============================================

/**
 * Load projects configuration
 */
async function loadProjects() {
    try {
        const content = await fs.readFile(PROJECTS_CONFIG, 'utf-8');
        const config = JSON.parse(content);
        return config.projects || [];
    } catch (error) {
        console.error('Error loading projects config:', error);
        return [];
    }
}

/**
 * Scan all projects and get the most interesting insight
 */
async function scanAllProjects() {
    const projects = await loadProjects();
    const insights = [];

    for (const project of projects) {
        const scanResult = await scanProject(project.path);
        const stats = getActivityStats(project.name, scanResult);
        const insight = generateInsight(stats);

        if (insight) {
            insights.push({
                ...insight,
                project: project.name
            });
        }
    }

    // Sort by priority (higher = more important)
    insights.sort((a, b) => b.priority - a.priority);

    return insights;
}

/**
 * Get the buddy messages to display
 * Returns ALL insights as an array for frontend queue management
 */
async function getBuddyMessage() {
    // Auto-update github fields for projects with new remotes
    try {
        await updateProjectRemotes();
    } catch (e) {
        console.error('Error updating project remotes:', e);
    }

    const projects = await loadProjects();
    const projectsCount = projects.length;
    const insights = await scanAllProjects();

    // Build full insights array with color schemes
    // If no insights, generate calm messages
    let allInsights = insights.map(insight => ({
        message: insight.message,
        type: insight.type,
        project: insight.project,
        colorScheme: pickRandomColorScheme()
    }));

    // Ensure at least 2 messages (for dual display)
    while (allInsights.length < 2) {
        allInsights.push({
            message: getRandomCalmMessage(),
            type: 'calm',
            project: null,
            colorScheme: pickRandomColorScheme()
        });
    }

    return {
        insights: allInsights,
        colorSchemes: COLOR_SCHEMES,
        timestamp: new Date().toISOString(),
        projectsCount
    };
}

module.exports = {
    scanProject,
    getActivityStats,
    generateInsight,
    scanAllProjects,
    getBuddyMessage,
    loadProjects
};
