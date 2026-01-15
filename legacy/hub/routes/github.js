/**
 * GitHub routes - OAuth, repos
 */

const express = require('express');
const axios = require('axios');
const router = express.Router();

const { GITHUB_CONFIG, loadProjectsConfig } = require('../config');
const { getUserRepos, matchLocalRepos, addProjectsToConfig, normalizeGitUrl } = require('../github-api');

// GET /auth/github — Redirect to GitHub OAuth
router.get('/auth/github', (req, res) => {
    const authUrl = new URL('https://github.com/login/oauth/authorize');
    authUrl.searchParams.set('client_id', GITHUB_CONFIG.clientId);
    authUrl.searchParams.set('redirect_uri', GITHUB_CONFIG.redirectUri);
    authUrl.searchParams.set('scope', GITHUB_CONFIG.scopes.join(' '));
    authUrl.searchParams.set('state', req.sessionID);

    res.redirect(authUrl.toString());
});

// GET /auth/github/callback — Handle OAuth callback
router.get('/auth/github/callback', async (req, res) => {
    const { code, error } = req.query;

    if (error) {
        console.error('GitHub OAuth error:', error);
        return res.redirect('/?github_error=' + encodeURIComponent(error));
    }

    if (!code) {
        return res.redirect('/?github_error=no_code');
    }

    try {
        const tokenResponse = await axios.post(
            'https://github.com/login/oauth/access_token',
            {
                client_id: GITHUB_CONFIG.clientId,
                client_secret: GITHUB_CONFIG.clientSecret,
                code: code,
                redirect_uri: GITHUB_CONFIG.redirectUri
            },
            {
                headers: { 'Accept': 'application/json' }
            }
        );

        const { access_token, error: tokenError } = tokenResponse.data;

        if (tokenError || !access_token) {
            console.error('Token exchange error:', tokenError);
            return res.redirect('/?github_error=token_exchange_failed');
        }

        req.session.githubToken = access_token;
        res.redirect('/?github_connected=true');
    } catch (err) {
        console.error('GitHub callback error:', err.message);
        res.redirect('/?github_error=callback_failed');
    }
});

// GET /api/github/status
router.get('/status', (req, res) => {
    const connected = !!req.session.githubToken;
    res.json({ connected });
});

// GET /api/github/logout
router.get('/logout', (req, res) => {
    delete req.session.githubToken;
    res.json({ success: true });
});

// GET /api/github/repos
router.get('/repos', async (req, res) => {
    const token = req.session.githubToken;

    if (!token) {
        return res.status(401).json({ error: 'Not authenticated with GitHub' });
    }

    try {
        const repos = await getUserRepos(token);
        const reposWithLocal = await matchLocalRepos(repos);

        const existingProjects = await loadProjectsConfig();
        const connectedUrls = new Set(
            existingProjects.filter(p => p.github).map(p => normalizeGitUrl(p.github))
        );

        reposWithLocal.forEach(repo => {
            repo.alreadyConnected = connectedUrls.has(normalizeGitUrl(repo.clone_url));
        });

        reposWithLocal.sort((a, b) => {
            if (a.alreadyConnected !== b.alreadyConnected) return a.alreadyConnected - b.alreadyConnected;
            if (a.hasLocal !== b.hasLocal) return b.hasLocal - a.hasLocal;
            return new Date(b.pushed_at) - new Date(a.pushed_at);
        });

        res.json(reposWithLocal);
    } catch (error) {
        console.error('Error fetching repos:', error.message);
        res.status(500).json({ error: 'Failed to fetch repositories' });
    }
});

// POST /api/github/connect
router.post('/connect', async (req, res) => {
    const token = req.session.githubToken;
    const { repos } = req.body;

    if (!token) {
        return res.status(401).json({ error: 'Not authenticated with GitHub' });
    }

    if (!repos || !Array.isArray(repos) || repos.length === 0) {
        return res.status(400).json({ error: 'No repositories selected' });
    }

    try {
        const count = await addProjectsToConfig(repos);
        res.json({
            success: true,
            added: count,
            message: `Added ${count} project(s) to monitoring`
        });
    } catch (error) {
        console.error('Error connecting repos:', error.message);
        res.status(500).json({ error: 'Failed to connect repositories' });
    }
});

module.exports = router;
