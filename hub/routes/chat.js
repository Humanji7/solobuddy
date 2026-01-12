/**
 * Chat routes - chat with Claude, intent parsing
 */

const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();

const { PATHS, loadProjectsConfig } = require('../config');
const { parseSessionLog, parseBacklog, parseDraft } = require('../parsing');
const { parseIntent, buildActionCard, extractEntities, findContextualLinks } = require('../intent-parser');
const { sendToClaude } = require('../chat-api');
const { getBuddyMessage } = require('../watcher');
const { classifyIntent } = require('../llm-intent-classifier');

// POST /api/intent/parse
router.post('/intent/parse', async (req, res) => {
    const { message } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'Message is required' });
    }

    try {
        const projects = await loadProjectsConfig();

        const backlogContent = await fs.readFile(PATHS.backlog, 'utf-8').catch(() => '');
        const backlogItems = parseBacklog(backlogContent);

        const { loadProjects, scanProject, getActivityStats } = require('../watcher');
        let gitActivity = [];
        try {
            const allProjects = await loadProjects();
            for (const project of allProjects.slice(0, 10)) {
                const scanResult = await scanProject(project.path);
                const stats = getActivityStats(project.name, scanResult);
                gitActivity.push(stats);
            }
        } catch (e) { /* watcher not available */ }

        const context = { backlogItems, projects, gitActivity };

        // Step 1: Try regex-based detection
        let result = parseIntent(message, context);

        // Step 2: Hybrid logic
        if (result.confidence >= 80) {
            // High confidence: use regex result as-is
            result.source = 'regex';
        } else if (result.confidence >= 50) {
            // Gray zone: ask LLM for clarification
            const llmResult = await classifyIntent(message, context);

            if (llmResult.confidence > result.confidence) {
                // LLM is more confident, rebuild action card
                const entities = extractEntities(message, context);
                const links = findContextualLinks(entities, context);
                const actionCard = buildActionCard(llmResult.type, entities, links, llmResult.confidence);

                result = {
                    intentType: llmResult.type,
                    entities,
                    links,
                    actionCard,
                    confidence: llmResult.confidence,
                    source: 'llm'
                };
            } else {
                result.source = 'regex';
            }
        } else {
            // Low confidence: no action card
            result.source = 'none';
        }

        res.json(result);
    } catch (error) {
        console.error('Intent parse error:', error.message);
        res.status(500).json({ error: 'Failed to parse intent' });
    }
});

// POST /api/chat
router.post('/chat', async (req, res) => {
    const { message, history = [] } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'Message is required' });
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
            for (const project of allProjects) {
                const scanResult = await scanProject(project.path);
                const stats = getActivityStats(project.name, scanResult);
                gitActivity.push(stats);
            }
        } catch (e) { /* Watcher not available */ }

        const buddyMessage = await getBuddyMessage().catch(() => null);

        const context = {
            projects,
            backlogItems,
            sessionLog,
            drafts,
            gitActivity,
            buddyMessage
        };

        const { intentType, actionCard, confidence } = parseIntent(message, context);

        const messages = [
            ...history,
            { role: 'user', content: message }
        ];

        const response = await sendToClaude(messages, context);

        res.json({
            response,
            actionCard,
            intent: intentType,
            confidence
        });
    } catch (error) {
        console.error('Chat error:', error.message);
        res.status(500).json({ error: error.message || 'Failed to get response' });
    }
});

module.exports = router;
