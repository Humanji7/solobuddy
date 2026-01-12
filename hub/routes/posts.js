/**
 * Posts routes - voice training dataset (real published posts)
 * MVP: CRUD for posts to use as few-shot examples in content generation
 */

const express = require('express');
const fs = require('fs').promises;
const router = express.Router();

const { PATHS } = require('../config');

/**
 * Load posts from JSON file
 */
async function loadPosts() {
    try {
        const data = await fs.readFile(PATHS.myPosts, 'utf-8');
        const parsed = JSON.parse(data);
        return parsed.posts || [];
    } catch (e) {
        return [];
    }
}

/**
 * Save posts to JSON file
 */
async function savePosts(posts) {
    const data = {
        posts,
        meta: {
            description: 'Voice training dataset - real posts for style learning',
            updated: new Date().toISOString()
        }
    };
    await fs.writeFile(PATHS.myPosts, JSON.stringify(data, null, 2));
}

// GET /api/posts - List all posts
router.get('/', async (req, res) => {
    try {
        const posts = await loadPosts();
        res.json(posts);
    } catch (error) {
        console.error('Error loading posts:', error);
        res.status(500).json({ error: 'Failed to load posts' });
    }
});

// POST /api/posts - Add new post
router.post('/', async (req, res) => {
    try {
        const { content, platform, project, url } = req.body;

        if (!content) {
            return res.status(400).json({ error: 'Content is required' });
        }

        const posts = await loadPosts();

        const newPost = {
            id: Date.now(),
            content: content.trim(),
            platform: platform || 'unknown',
            project: project || null,
            url: url || null,
            createdAt: new Date().toISOString()
        };

        posts.push(newPost);
        await savePosts(posts);

        res.json({ success: true, post: newPost, total: posts.length });
    } catch (error) {
        console.error('Error adding post:', error);
        res.status(500).json({ error: 'Failed to add post' });
    }
});

// DELETE /api/posts/:id - Delete post
router.delete('/:id', async (req, res) => {
    try {
        const postId = parseInt(req.params.id);
        let posts = await loadPosts();

        const before = posts.length;
        posts = posts.filter(p => p.id !== postId);

        if (posts.length === before) {
            return res.status(404).json({ error: 'Post not found' });
        }

        await savePosts(posts);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting post:', error);
        res.status(500).json({ error: 'Failed to delete post' });
    }
});

// GET /api/posts/random - Get random posts for few-shot prompting
router.get('/random', async (req, res) => {
    try {
        const count = parseInt(req.query.count) || 3;
        const project = req.query.project;

        let posts = await loadPosts();

        // Filter by project if specified
        if (project) {
            posts = posts.filter(p => p.project && p.project.toLowerCase() === project.toLowerCase());
        }

        // Shuffle and take count
        const shuffled = posts.sort(() => Math.random() - 0.5);
        const selected = shuffled.slice(0, Math.min(count, posts.length));

        res.json(selected);
    } catch (error) {
        console.error('Error getting random posts:', error);
        res.status(500).json({ error: 'Failed to get random posts' });
    }
});

module.exports = router;
