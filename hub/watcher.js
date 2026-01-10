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
 * Returns null if nothing interesting to say
 */
function generateInsight(stats) {
    const { name, commitsToday, commitsYesterday, commitsThisWeek, daysSilent, isActive } = stats;

    // Priority 1: High activity today
    if (commitsToday >= 5) {
        return {
            message: `Активный день в ${name} — ${commitsToday} коммитов уже сегодня!`,
            type: 'active',
            priority: 3
        };
    }

    // Priority 2: High activity yesterday
    if (commitsYesterday >= 5) {
        return {
            message: `${name} кипел вчера — ${commitsYesterday} коммитов. Продолжишь?`,
            type: 'momentum',
            priority: 2
        };
    }

    // Priority 3: Long silence (3+ days)
    if (daysSilent !== null && daysSilent >= 3) {
        return {
            message: `${name} притих уже ${daysSilent} ${getDaysWord(daysSilent)}.`,
            type: 'silent',
            priority: 1
        };
    }

    // Priority 4: Return after pause (1-2 days silent, then active)
    if (daysSilent === 0 && commitsThisWeek > 0 && commitsThisWeek <= 3) {
        return {
            message: `О, ты вернулся к ${name}!`,
            type: 'return',
            priority: 1
        };
    }

    // No interesting insight
    return null;
}

/**
 * Helper: Russian days word form
 */
function getDaysWord(n) {
    const lastTwo = n % 100;
    const lastOne = n % 10;

    if (lastTwo >= 11 && lastTwo <= 14) return 'дней';
    if (lastOne === 1) return 'день';
    if (lastOne >= 2 && lastOne <= 4) return 'дня';
    return 'дней';
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
 * Get the buddy message to display
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

    if (insights.length === 0) {
        return {
            message: 'Всё тихо. Проекты дышат ровно.',
            type: 'calm',
            timestamp: new Date().toISOString(),
            projectsCount
        };
    }

    // Take the top priority insight
    const topInsight = insights[0];

    // If there are multiple insights, combine them
    if (insights.length > 1) {
        const activeCount = insights.filter(i => i.type === 'active' || i.type === 'momentum').length;
        const silentCount = insights.filter(i => i.type === 'silent').length;

        if (activeCount > 0 && silentCount > 0) {
            const active = insights.find(i => i.type === 'active' || i.type === 'momentum');
            const silent = insights.find(i => i.type === 'silent');
            return {
                message: `${active.message} ${silent.project} тихо уже ${silent.project === 'VOP' ? 'немного' : 'давно'}.`,
                type: 'mixed',
                timestamp: new Date().toISOString(),
                projectsCount
            };
        }
    }

    return {
        message: topInsight.message,
        type: topInsight.type,
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
