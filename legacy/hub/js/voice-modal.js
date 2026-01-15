/* ============================================
   Voice Modal Module
   Project Voice chat and My Posts management
   ============================================ */

// ============================================
// Project Voice Modal
// ============================================

const voiceBtn = document.getElementById('voice-btn');
const voiceModal = document.getElementById('project-voice-modal');
const voiceModalClose = document.getElementById('voice-modal-close');
const voiceProjectSelect = document.getElementById('voice-project-select');
const voiceChatMessages = document.getElementById('voice-chat-messages');
const voiceChatForm = document.getElementById('voice-chat-form');
const voiceChatInput = document.getElementById('voice-chat-input');
const voiceChatSubmit = voiceChatForm?.querySelector('.voice-chat-submit');

let voiceChatHistory = [];
let currentVoiceProject = null;

/**
 * Populate project dropdown for voice chat
 */
async function populateVoiceProjectDropdown() {
    try {
        const response = await fetch('/api/projects');
        const projects = await response.json();

        voiceProjectSelect.innerHTML = '<option value="">Select a project...</option>';

        if (projects.length === 0) {
            voiceProjectSelect.innerHTML = '<option value="">No projects connected</option>';
            return;
        }

        projects.forEach(proj => {
            const option = document.createElement('option');
            option.value = proj.name;
            option.textContent = proj.name;
            voiceProjectSelect.appendChild(option);
        });
    } catch (e) {
        console.error('Error loading projects for voice:', e);
        voiceProjectSelect.innerHTML = '<option value="">Error loading projects</option>';
    }
}

/**
 * Open voice modal
 */
function openVoiceModal() {
    voiceModal.classList.add('active');
    populateVoiceProjectDropdown();
    voiceChatHistory = [];
    currentVoiceProject = null;
    voiceChatMessages.innerHTML = '<div class="voice-placeholder">Choose a project to start talking...</div>';
    voiceChatInput.disabled = true;
    voiceChatSubmit.disabled = true;
}

/**
 * Close voice modal
 */
function closeVoiceModal() {
    voiceModal.classList.remove('active');
    voiceChatHistory = [];
    currentVoiceProject = null;
}

/**
 * Render voice chat message
 */
function renderVoiceMessage(role, text) {
    const bubble = document.createElement('div');
    bubble.className = `voice-bubble ${role}`;
    const p = document.createElement('p');
    p.innerHTML = text.replace(/\n/g, '<br>');
    bubble.appendChild(p);
    voiceChatMessages.appendChild(bubble);
    voiceChatMessages.scrollTop = voiceChatMessages.scrollHeight;
}

/**
 * Show voice typing indicator
 */
function showVoiceTyping() {
    const indicator = document.createElement('div');
    indicator.className = 'voice-typing';
    indicator.id = 'voice-typing';
    indicator.innerHTML = '<span></span><span></span><span></span>';
    voiceChatMessages.appendChild(indicator);
    voiceChatMessages.scrollTop = voiceChatMessages.scrollHeight;
}

/**
 * Hide voice typing indicator
 */
function hideVoiceTyping() {
    const indicator = document.getElementById('voice-typing');
    if (indicator) indicator.remove();
}

/**
 * Send voice message to project
 */
async function sendVoiceMessage(text) {
    if (!text.trim() || !currentVoiceProject) return;

    voiceChatHistory.push({ role: 'user', content: text });
    renderVoiceMessage('user', text);

    voiceChatInput.disabled = true;
    voiceChatSubmit.disabled = true;
    showVoiceTyping();

    try {
        const response = await fetch('/api/project-voice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                projectName: currentVoiceProject,
                message: text,
                history: voiceChatHistory.slice(0, -1)
            })
        });

        hideVoiceTyping();

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to get response');
        }

        const data = await response.json();

        voiceChatHistory.push({ role: 'project', content: data.response });
        renderVoiceMessage('project', data.response);

    } catch (error) {
        hideVoiceTyping();
        console.error('Voice chat error:', error);
        renderVoiceMessage('project', `Sorry, I can't respond right now... (${error.message})`);
    } finally {
        voiceChatInput.disabled = false;
        voiceChatSubmit.disabled = false;
        voiceChatInput.focus();
    }
}

/**
 * Start voice chat for a project (called from onboarding)
 */
function startProjectVoiceChat(projectName) {
    if (voiceProjectSelect) {
        voiceProjectSelect.value = projectName;
    }
    currentVoiceProject = projectName;
    voiceChatMessages.innerHTML = '';
    voiceChatInput.disabled = false;
    voiceChatSubmit.disabled = false;
    voiceChatInput.focus();
    voiceChatInput.placeholder = `Talk to ${projectName}...`;
    renderVoiceMessage('project', `Hey. I am ${projectName}. Now I have a soul! What shall we talk about?`);
}

/**
 * Initialize voice modal
 */
function initVoiceModal() {
    if (voiceBtn) {
        voiceBtn.addEventListener('click', openVoiceModal);
    }

    if (voiceModalClose) {
        voiceModalClose.addEventListener('click', closeVoiceModal);
    }

    if (voiceModal) {
        voiceModal.addEventListener('click', (e) => {
            if (e.target === voiceModal) closeVoiceModal();
        });
    }

    if (voiceProjectSelect) {
        voiceProjectSelect.addEventListener('change', async () => {
            const selected = voiceProjectSelect.value;
            if (selected) {
                // Check if SOUL onboarding is needed
                if (typeof checkSoulOnboarding === 'function') {
                    const needsOnboarding = await checkSoulOnboarding(selected);
                    if (needsOnboarding) {
                        voiceChatMessages.innerHTML = '<div class="voice-placeholder">Complete SOUL onboarding first...</div>';
                        voiceChatInput.disabled = true;
                        voiceChatSubmit.disabled = true;
                        return;
                    }
                }

                currentVoiceProject = selected;
                voiceChatMessages.innerHTML = '';
                voiceChatInput.disabled = false;
                voiceChatSubmit.disabled = false;
                voiceChatInput.focus();
                voiceChatInput.placeholder = `Talk to ${selected}...`;
                renderVoiceMessage('project', `Hey. I am ${selected}. What do you want to talk about?`);
            } else {
                currentVoiceProject = null;
                voiceChatMessages.innerHTML = '<div class="voice-placeholder">Choose a project to start talking...</div>';
                voiceChatInput.disabled = true;
                voiceChatSubmit.disabled = true;
            }
        });
    }

    if (voiceChatForm) {
        voiceChatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const text = voiceChatInput.value.trim();
            if (text) {
                sendVoiceMessage(text);
                voiceChatInput.value = '';
            }
        });
    }

    // Escape to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && voiceModal?.classList.contains('active')) {
            closeVoiceModal();
        }
    });
}

// ============================================
// My Posts Modal (Voice Training Dataset)
// ============================================

const myPostsBtn = document.getElementById('my-posts-btn');
const myPostsModal = document.getElementById('my-posts-modal');
const myPostsModalClose = document.getElementById('my-posts-modal-close');
const myPostsList = document.getElementById('my-posts-list');
const addPostBtn = document.getElementById('add-post-btn');
const newPostContent = document.getElementById('new-post-content');
const newPostPlatform = document.getElementById('new-post-platform');
const newPostProject = document.getElementById('new-post-project');
const postsCount = document.getElementById('posts-count');

let myPostsData = [];

/**
 * Load posts from API
 */
async function loadMyPosts() {
    try {
        const response = await fetch('/api/posts');
        myPostsData = await response.json();
        renderMyPosts();
    } catch (error) {
        console.error('Error loading posts:', error);
        myPostsList.innerHTML = '<div class="my-posts-empty">Failed to load posts</div>';
    }
}

/**
 * Load projects for posts dropdown
 */
async function loadProjectsForPosts() {
    try {
        const response = await fetch('/api/projects');
        const projects = await response.json();
        newPostProject.innerHTML = '<option value="">No project</option>';
        projects.forEach(p => {
            const option = document.createElement('option');
            option.value = p.name;
            option.textContent = p.name;
            newPostProject.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading projects for posts:', error);
    }
}

/**
 * Render posts list
 */
function renderMyPosts() {
    if (myPostsData.length === 0) {
        myPostsList.innerHTML = '<div class="my-posts-empty">No posts yet. Add your first published post to train the AI voice.</div>';
        postsCount.textContent = '0 posts';
        return;
    }

    postsCount.textContent = myPostsData.length + ' posts';

    myPostsList.innerHTML = myPostsData
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map(post => {
            const contentDiv = document.createElement('div');
            contentDiv.textContent = post.content;
            const escapedContent = contentDiv.innerHTML;
            const date = new Date(post.createdAt);
            const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

            return '<div class="my-post-item" data-id="' + post.id + '">' +
                '<div class="my-post-content">' + escapedContent + '</div>' +
                '<div class="my-post-meta">' +
                '<span class="my-post-platform">' + post.platform + '</span>' +
                (post.project ? '<span>📁 ' + post.project + '</span>' : '') +
                '<span>' + dateStr + '</span>' +
                '</div>' +
                '<button class="my-post-delete" data-id="' + post.id + '" title="Delete">×</button>' +
                '</div>';
        }).join('');

    // Add delete handlers
    myPostsList.querySelectorAll('.my-post-delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.target.dataset.id;
            if (confirm('Delete this post?')) {
                await deletePost(id);
            }
        });
    });
}

/**
 * Add new post
 */
async function addPost() {
    const content = newPostContent.value.trim();
    if (!content) {
        alert('Please enter post content');
        return;
    }

    try {
        const response = await fetch('/api/posts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content,
                platform: newPostPlatform.value,
                project: newPostProject.value || null
            })
        });

        if (!response.ok) throw new Error('Failed to add post');

        newPostContent.value = '';
        await loadMyPosts();
    } catch (error) {
        console.error('Error adding post:', error);
        alert('Failed to add post');
    }
}

/**
 * Delete post
 */
async function deletePost(id) {
    try {
        const response = await fetch('/api/posts/' + id, { method: 'DELETE' });
        if (!response.ok) throw new Error('Failed to delete post');
        await loadMyPosts();
    } catch (error) {
        console.error('Error deleting post:', error);
        alert('Failed to delete post');
    }
}

/**
 * Open my posts modal
 */
function openMyPostsModal() {
    myPostsModal.classList.add('active');
    loadMyPosts();
    loadProjectsForPosts();
}

/**
 * Close my posts modal
 */
function closeMyPostsModal() {
    myPostsModal.classList.remove('active');
}

/**
 * Initialize my posts modal
 */
function initMyPostsModal() {
    if (myPostsBtn) {
        myPostsBtn.addEventListener('click', openMyPostsModal);
    }

    if (myPostsModalClose) {
        myPostsModalClose.addEventListener('click', closeMyPostsModal);
    }

    if (myPostsModal) {
        myPostsModal.addEventListener('click', (e) => {
            if (e.target === myPostsModal) closeMyPostsModal();
        });
    }

    if (addPostBtn) {
        addPostBtn.addEventListener('click', addPost);
    }

    // Ctrl+Enter to add post
    if (newPostContent) {
        newPostContent.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                addPost();
            }
        });
    }

    // Escape to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && myPostsModal && myPostsModal.classList.contains('active')) {
            closeMyPostsModal();
        }
    });
}

// Export for global access
window.VoiceModal = {
    init: initVoiceModal,
    open: openVoiceModal,
    close: closeVoiceModal,
    startChat: startProjectVoiceChat
};

window.MyPostsModal = {
    init: initMyPostsModal,
    open: openMyPostsModal,
    close: closeMyPostsModal
};

// Global callback for onboarding
window.startProjectVoiceChat = startProjectVoiceChat;
