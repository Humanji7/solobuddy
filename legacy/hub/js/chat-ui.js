/* ============================================
   Chat UI Module
   Main chat interface with Claude integration
   ============================================ */

const CHAT_STORAGE_KEY = 'solobuddy_chat_history';

// DOM Elements
const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const chatSubmit = chatForm?.querySelector('.chat-submit');

// State
let chatHistory = [];
let isTyping = false;

/**
 * Load chat history from localStorage
 */
function loadChatHistory() {
    try {
        const stored = localStorage.getItem(CHAT_STORAGE_KEY);
        if (stored) {
            chatHistory = JSON.parse(stored);
            chatHistory.forEach(msg => renderChatMessage(msg.role, msg.text, false));
            scrollChatToBottom();
        }
    } catch (e) {
        console.error('Error loading chat history:', e);
        chatHistory = [];
    }
}

/**
 * Save chat history to localStorage
 */
function saveChatHistory() {
    try {
        // Keep only last 50 messages
        const toSave = chatHistory.slice(-50);
        localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(toSave));
    } catch (e) {
        console.error('Error saving chat history:', e);
    }
}

/**
 * Render a chat message bubble
 */
function renderChatMessage(role, text, animate = true) {
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${role}`;
    if (!animate) bubble.style.animation = 'none';

    const p = document.createElement('p');
    p.innerHTML = text.replace(/\n/g, '<br>');
    bubble.appendChild(p);

    chatMessages.appendChild(bubble);
    scrollChatToBottom();
}

/**
 * Scroll chat container to bottom
 */
function scrollChatToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * Show typing indicator
 */
function showTypingIndicator() {
    if (isTyping) return;
    isTyping = true;

    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.id = 'typing-indicator';
    indicator.innerHTML = '<span></span><span></span><span></span>';
    chatMessages.appendChild(indicator);
    scrollChatToBottom();
}

/**
 * Hide typing indicator
 */
function hideTypingIndicator() {
    isTyping = false;
    const indicator = document.getElementById('typing-indicator');
    if (indicator) indicator.remove();
}

/**
 * Send chat message and process response
 */
async function sendChatMessage(text) {
    if (!text.trim()) return;

    // Add user message
    chatHistory.push({ role: 'user', text });
    renderChatMessage('user', text);
    saveChatHistory();

    // Disable input while waiting
    chatInput.disabled = true;
    chatSubmit.disabled = true;
    showTypingIndicator();

    try {
        // Step 1: Check for actionable intent first
        const intentResponse = await fetch('/api/intent/parse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text })
        });

        if (intentResponse.ok) {
            const intentData = await intentResponse.json();

            // If we have an actionable intent with high enough confidence, show Action Card
            if (intentData.actionCard && intentData.confidence >= 60) {
                hideTypingIndicator();

                // Render Action Card in chat (uses global renderActionCard from action-cards.js)
                const card = window.renderActionCard(intentData.actionCard, {
                    onAction: async (action, data) => {
                        if (action === 'add') {
                            const response = await fetch('/api/backlog', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    title: data.title,
                                    format: data.format,
                                    priority: data.priority,
                                    project: data.project || null
                                })
                            });

                            if (!response.ok) {
                                throw new Error('Failed to add idea');
                            }

                            // Refresh backlog display
                            if (window.refreshBacklog) {
                                await window.refreshBacklog();
                            }

                            return { id: Date.now(), ...data };
                        }

                        if (action === 'clarify') {
                            chatInput.value = 'No, I meant ';
                            chatInput.focus();
                        }
                    },
                    onDismiss: () => {
                        console.log('Action card dismissed');
                    },
                    onFeedback: (type, data) => {
                        console.log('Feedback:', type, data);
                    }
                });

                if (card) {
                    chatMessages.appendChild(card);
                    scrollChatToBottom();

                    chatHistory.push({
                        role: 'buddy',
                        text: `Got it! ${intentData.intentType === 'add_to_backlog' ? 'Adding idea?' : 'Here\'s what I found:'}`
                    });
                    saveChatHistory();

                    chatInput.disabled = false;
                    chatSubmit.disabled = false;
                    chatInput.focus();
                    return;
                }
            }
        }

        // Step 2: Fallback to Claude chat if no Action Card
        const apiHistory = chatHistory.slice(-10).map(m => ({
            role: m.role === 'buddy' ? 'assistant' : m.role,
            content: m.text
        }));

        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: text,
                history: apiHistory.slice(0, -1)
            })
        });

        hideTypingIndicator();

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to get response');
        }

        const data = await response.json();

        // Add buddy response
        chatHistory.push({ role: 'buddy', text: data.response });
        renderChatMessage('buddy', data.response);
        saveChatHistory();

    } catch (error) {
        hideTypingIndicator();
        console.error('Chat error:', error);
        window.showToast(error.message || 'Chat error', true);
    } finally {
        chatInput.disabled = false;
        chatSubmit.disabled = false;
        chatInput.focus();
    }
}

/**
 * Initialize chat UI event listeners
 */
function initChatUI() {
    if (chatForm) {
        chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const text = chatInput.value.trim();
            if (text) {
                sendChatMessage(text);
                chatInput.value = '';
            }
        });
    }

    if (chatInput) {
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                chatInput.value = '';
            }
        });
    }

    // Help button toggle
    const helpBtn = document.getElementById('help-btn');
    const helpTooltip = document.getElementById('help-tooltip');
    if (helpBtn && helpTooltip) {
        helpBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            helpTooltip.classList.toggle('visible');
        });

        document.addEventListener('click', (e) => {
            if (!helpBtn.contains(e.target) && !helpTooltip.contains(e.target)) {
                helpTooltip.classList.remove('visible');
            }
        });
    }
}

// Export for global access
window.ChatUI = {
    init: initChatUI,
    loadHistory: loadChatHistory,
    sendMessage: sendChatMessage,
    renderMessage: renderChatMessage
};
