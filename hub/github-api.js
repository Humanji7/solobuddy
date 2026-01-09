/* ============================================
   SoloBuddy Hub — GitHub API Module
   ============================================ */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

const PROJECTS_PATH = path.join(__dirname, '..', 'data', 'projects.json');

/**
 * Fetch all repositories for the authenticated user
 * @param {string} token - GitHub access token
 * @returns {Promise<Array>} List of repositories
 */
async function getUserRepos(token) {
    const repos = [];
    let page = 1;
    const perPage = 100;

    while (true) {
        const response = await axios.get('https://api.github.com/user/repos', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'SoloBuddy-Hub'
            },
            params: {
                per_page: perPage,
                page: page,
                sort: 'pushed',
                direction: 'desc'
            }
        });

        if (response.data.length === 0) break;

        repos.push(...response.data.map(repo => ({
            id: repo.id,
            name: repo.name,
            full_name: repo.full_name,
            clone_url: repo.clone_url,
            ssh_url: repo.ssh_url,
            html_url: repo.html_url,
            description: repo.description,
            private: repo.private,
            pushed_at: repo.pushed_at,
            default_branch: repo.default_branch
        })));

        if (response.data.length < perPage) break;
        page++;
    }

    return repos;
}

/**
 * Find local paths for repositories by matching git remote URLs
 * @param {Array} repos - List of repositories from GitHub
 * @returns {Promise<Array>} Repos with localPath if found
 */
async function matchLocalRepos(repos) {
    // Common project directories to scan
    const searchPaths = [
        path.join(process.env.HOME || '/Users/admin', 'projects'),
        path.join(process.env.HOME || '/Users/admin', 'dev'),
        path.join(process.env.HOME || '/Users/admin', 'code'),
        path.join(process.env.HOME || '/Users/admin', 'Sites'),
        path.join(process.env.HOME || '/Users/admin', 'Documents', 'projects')
    ];

    const localRepoMap = new Map();

    for (const searchPath of searchPaths) {
        try {
            const dirs = await fs.readdir(searchPath);
            for (const dir of dirs) {
                const fullPath = path.join(searchPath, dir);
                const gitPath = path.join(fullPath, '.git');

                try {
                    await fs.access(gitPath);
                    // It's a git repo
                    const remoteUrl = getGitRemoteUrl(fullPath);
                    if (remoteUrl) {
                        localRepoMap.set(normalizeGitUrl(remoteUrl), fullPath);
                    }
                } catch {
                    // Not a git repo, skip
                }
            }
        } catch {
            // Directory doesn't exist, skip
        }
    }

    // Match repos with local paths
    return repos.map(repo => {
        const cloneUrlNorm = normalizeGitUrl(repo.clone_url);
        const sshUrlNorm = normalizeGitUrl(repo.ssh_url);

        const localPath = localRepoMap.get(cloneUrlNorm) || localRepoMap.get(sshUrlNorm);

        return {
            ...repo,
            localPath: localPath || null,
            hasLocal: !!localPath
        };
    });
}

/**
 * Get git remote origin URL for a local repo
 */
function getGitRemoteUrl(repoPath) {
    try {
        const result = execSync('git remote get-url origin', {
            cwd: repoPath,
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'ignore']
        });
        return result.trim();
    } catch {
        return null;
    }
}

/**
 * Normalize git URL for comparison
 * Handles https://, git@, and removes .git suffix
 */
function normalizeGitUrl(url) {
    if (!url) return '';
    return url
        .replace(/^git@github\.com:/, 'github.com/')
        .replace(/^https?:\/\//, '')
        .replace(/\.git$/, '')
        .toLowerCase();
}

/**
 * Add selected repositories to projects.json
 * @param {Array} projects - Projects to add (with localPath)
 * @returns {Promise<number>} Number of projects added
 */
async function addProjectsToConfig(projects) {
    // Ensure data directory exists
    const dataDir = path.dirname(PROJECTS_PATH);
    try {
        await fs.access(dataDir);
    } catch {
        await fs.mkdir(dataDir, { recursive: true });
    }

    // Read existing projects
    let existingArray = [];
    try {
        const content = await fs.readFile(PROJECTS_PATH, 'utf-8');
        const parsed = JSON.parse(content);
        // Handle both formats: {projects: [...]} or plain [...]
        existingArray = Array.isArray(parsed) ? parsed : (parsed.projects || []);
    } catch {
        // File doesn't exist or is invalid, start fresh
    }

    // Filter out duplicates and projects without local paths
    const existingPaths = new Set(existingArray.map(p => p.path));
    const newProjects = projects.filter(p =>
        p.localPath && !existingPaths.has(p.localPath)
    );

    // Add new projects
    for (const proj of newProjects) {
        existingArray.push({
            name: proj.name,
            path: proj.localPath,
            github: proj.html_url
        });
    }

    // Write back in the wrapper format to maintain compatibility
    await fs.writeFile(PROJECTS_PATH, JSON.stringify({ projects: existingArray }, null, 4), 'utf-8');

    return newProjects.length;
}

/**
 * Scan local directories for Git projects
 * Returns projects NOT already in projects.json
 * @returns {Promise<Array>} List of local Git projects
 */
async function scanLocalProjects() {
    // Common project directories to scan
    const searchPaths = [
        path.join(process.env.HOME || '/Users/admin', 'projects'),
        path.join(process.env.HOME || '/Users/admin', 'dev'),
        path.join(process.env.HOME || '/Users/admin', 'code'),
        path.join(process.env.HOME || '/Users/admin', 'Sites')
    ];

    // Load existing projects to filter duplicates
    let existingPaths = new Set();
    try {
        const content = await fs.readFile(PROJECTS_PATH, 'utf-8');
        const parsed = JSON.parse(content);
        const existingArray = Array.isArray(parsed) ? parsed : (parsed.projects || []);
        existingPaths = new Set(existingArray.map(p => p.path));
    } catch {
        // File doesn't exist, proceed with empty set
    }

    const localProjects = [];

    for (const searchPath of searchPaths) {
        try {
            const dirs = await fs.readdir(searchPath);
            for (const dir of dirs) {
                const fullPath = path.join(searchPath, dir);

                // Skip if already in projects.json
                if (existingPaths.has(fullPath)) continue;

                const gitPath = path.join(fullPath, '.git');

                try {
                    await fs.access(gitPath);
                    // It's a git repo
                    const remoteUrl = getGitRemoteUrl(fullPath);

                    localProjects.push({
                        name: dir,
                        path: fullPath,
                        hasGit: true,
                        remoteUrl: remoteUrl || null
                    });
                } catch {
                    // Not a git repo, skip
                }
            }
        } catch {
            // Directory doesn't exist, skip
        }
    }

    // Sort: projects with remote first, then alphabetically
    localProjects.sort((a, b) => {
        if (a.remoteUrl && !b.remoteUrl) return -1;
        if (!a.remoteUrl && b.remoteUrl) return 1;
        return a.name.localeCompare(b.name);
    });

    return localProjects;
}

/**
 * Add local projects to projects.json
 * @param {Array} projects - Local projects to add
 * @returns {Promise<number>} Number of projects added
 */
async function addLocalProjectsToConfig(projects) {
    // Ensure data directory exists
    const dataDir = path.dirname(PROJECTS_PATH);
    try {
        await fs.access(dataDir);
    } catch {
        await fs.mkdir(dataDir, { recursive: true });
    }

    // Read existing projects
    let existingArray = [];
    try {
        const content = await fs.readFile(PROJECTS_PATH, 'utf-8');
        const parsed = JSON.parse(content);
        existingArray = Array.isArray(parsed) ? parsed : (parsed.projects || []);
    } catch {
        // File doesn't exist or is invalid, start fresh
    }

    // Filter out duplicates
    const existingPaths = new Set(existingArray.map(p => p.path));
    const newProjects = projects.filter(p => !existingPaths.has(p.path));

    // Add new projects
    for (const proj of newProjects) {
        existingArray.push({
            name: proj.name,
            path: proj.path,
            github: proj.remoteUrl || null
        });
    }

    // Write back
    await fs.writeFile(PROJECTS_PATH, JSON.stringify({ projects: existingArray }, null, 4), 'utf-8');

    return newProjects.length;
}

/**
 * Update github field for projects that have null but now have a remote
 * @returns {Promise<number>} Number of projects updated
 */
async function updateProjectRemotes() {
    // Read projects.json
    let existingArray = [];
    try {
        const content = await fs.readFile(PROJECTS_PATH, 'utf-8');
        const parsed = JSON.parse(content);
        existingArray = Array.isArray(parsed) ? parsed : (parsed.projects || []);
    } catch {
        return 0; // No projects file
    }

    // Filter projects with null github field
    const projectsToCheck = existingArray.filter(p =>
        p.github === null || p.github === undefined
    );

    if (projectsToCheck.length === 0) {
        return 0;
    }

    let updated = 0;

    // Check each project for remote URL
    for (const project of projectsToCheck) {
        const remoteUrl = getGitRemoteUrl(project.path);
        if (remoteUrl) {
            // Update the project in the original array
            const index = existingArray.findIndex(p => p.path === project.path);
            if (index !== -1) {
                existingArray[index].github = remoteUrl;
                updated++;
            }
        }
    }

    // Only write if we made updates
    if (updated > 0) {
        await fs.writeFile(
            PROJECTS_PATH,
            JSON.stringify({ projects: existingArray }, null, 4),
            'utf-8'
        );
    }

    return updated;
}

module.exports = {
    getUserRepos,
    matchLocalRepos,
    addProjectsToConfig,
    scanLocalProjects,
    addLocalProjectsToConfig,
    updateProjectRemotes,
    getGitRemoteUrl
};
