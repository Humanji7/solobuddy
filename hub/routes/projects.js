/**
 * Project routes - projects, soul, voice, sensitivity
 */

const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();

const { PATHS, loadProjectsConfig, findProjectByName } = require('../config');
const { parseBacklog } = require('../parsing');
const soulManager = require('../soul-manager');
const { sendProjectVoice, extractPersonalityFromReadme, generateSoulFromSelections } = require('../chat-api');
const { updateProjectRemotes, scanLocalProjects, addLocalProjectsToConfig } = require('../github-api');

// GET /api/projects
router.get('/', async (req, res) => {
    try {
        const allProjects = await loadProjectsConfig();

        const validatedProjects = [];
        const staleProjects = [];

        for (const project of allProjects) {
            try {
                await fs.access(project.path);
                validatedProjects.push({ ...project, exists: true });
            } catch (e) {
                staleProjects.push(project);
                console.log(`[Projects] Stale project detected: ${project.name} (${project.path})`);
            }
        }

        if (staleProjects.length > 0 && req.query.cleanup === 'true') {
            const cleanedData = {
                projects: validatedProjects.map(p => {
                    const { exists, ...rest } = p;
                    return rest;
                })
            };
            await fs.writeFile(PATHS.projects, JSON.stringify(cleanedData, null, 4));
            console.log(`[Projects] Cleaned up ${staleProjects.length} stale project(s)`);
        }

        res.json(validatedProjects);
    } catch (error) {
        console.error('Error loading projects:', error.message);
        res.json([]);
    }
});

// POST /api/projects/refresh-remotes
router.post('/refresh-remotes', async (req, res) => {
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

// POST /api/project-voice
router.post('/project-voice', async (req, res) => {
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

        const { scanProject, getActivityStats } = require('../watcher');
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
            extractionStatus
        });
    } catch (error) {
        console.error('Project Voice error:', error.message);
        res.status(500).json({ error: error.message || 'Failed to get response' });
    }
});

// POST /api/project-soul/:name/memory
router.post('/project-soul/:name/memory', async (req, res) => {
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

// GET /api/project-soul/:name
router.get('/project-soul/:name', async (req, res) => {
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

// POST /api/project-soul/:name/extract
router.post('/project-soul/:name/extract', async (req, res) => {
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

// GET /api/project-sensitivity/:name
router.get('/project-sensitivity/:name', async (req, res) => {
    const { name } = req.params;
    const { getSensitivity } = require('../sensitivity-detector');

    try {
        const project = await findProjectByName(name);
        if (!project) {
            return res.status(404).json({ error: `Project "${name}" not found` });
        }
        if (!project.path) {
            return res.status(400).json({ error: `Project "${name}" has no path configured` });
        }

        const hasOnboarding = await soulManager.hasCompletedOnboarding(project.name);
        const sensitivity = await getSensitivity(project.name, project.path);

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

// POST /api/project-soul/:name/generate
router.post('/project-soul/:name/generate', async (req, res) => {
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

        console.log(`[Soul] Generating SOUL for ${project.name} from onboarding selections...`);

        const result = await generateSoulFromSelections(project.name, selections, project.path);

        if (!result.success) {
            return res.status(500).json({ error: result.error || 'Failed to generate SOUL' });
        }

        await soulManager.saveSoulFromOnboarding(
            project.name,
            selections,
            result.soulMd,
            result.personality
        );

        console.log(`[Soul] ✅ SOUL generated and saved for ${project.name}`);

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

// GET /api/local/scan
router.get('/local/scan', async (req, res) => {
    try {
        const projects = await scanLocalProjects();
        res.json(projects);
    } catch (error) {
        console.error('Error scanning local projects:', error.message);
        res.status(500).json({ error: 'Failed to scan local projects' });
    }
});

// POST /api/local/connect
router.post('/local/connect', async (req, res) => {
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

module.exports = router;
