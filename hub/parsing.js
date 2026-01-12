/**
 * Parsing utilities for SoloBuddy Hub
 * Handles parsing of session-log.md, backlog.md, and draft files
 */

const fs = require('fs').promises;
const path = require('path');

// ============================================
// Session Log Parser
// ============================================

/**
 * Parse session-log.md
 * Format:
 * ### 2026-01-08
 * 1. **🏆 "Title"** — description
 *    - Формат: Thread
 *    - Цитата: "hook"
 */
function parseSessionLog(content) {
    const items = [];
    const entryRegex = /(\d+)\.\s+\*\*([^*]+)\*\*\s*[—–-]\s*(.+?)(?=\n\s+-|\n\s*\n|\n\d+\.|\n###|$)/gs;
    const dateRegex = /###\s+(\d{4}-\d{2}-\d{2})/;

    const dateMatch = content.match(dateRegex);
    const date = dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0];

    let match;
    while ((match = entryRegex.exec(content)) !== null) {
        const num = match[1];
        const titlePart = match[2].trim();
        const description = match[3].trim();

        const emojiMatch = titlePart.match(/^([^\w\s]*)\s*["«]?([^"»]+)["»]?\s*(.*)$/);
        let emoji = '📝';
        let title = titlePart;

        if (emojiMatch) {
            emoji = emojiMatch[1] || '📝';
            title = emojiMatch[2] + (emojiMatch[3] ? ' ' + emojiMatch[3] : '');
        }

        const blockEnd = content.indexOf('\n' + (parseInt(num) + 1) + '.', match.index);
        const block = blockEnd > 0
            ? content.substring(match.index, blockEnd)
            : content.substring(match.index, match.index + 500);

        const formatMatch = block.match(/Формат:\s*(.+)/i);
        const hookMatch = block.match(/(?:Цитата|Hook):\s*["«]?([^"»\n]+)["»]?/i);

        items.push({
            id: parseInt(num),
            emoji: emoji.trim(),
            title: title.trim(),
            format: formatMatch ? formatMatch[1].trim() : 'Post',
            hook: hookMatch ? hookMatch[1].trim() : description,
            date: date
        });
    }

    return items;
}

// ============================================
// Backlog Parser
// ============================================

const PRIORITY_PATTERNS = [
    { regex: /##.*High/i, priority: 'high' },
    { regex: /##.*Medium/i, priority: 'medium' },
    { regex: /##.*(Ideas Pool|Low|Raw)/i, priority: 'low' }
];

function detectPriority(line) {
    for (const { regex, priority } of PRIORITY_PATTERNS) {
        if (regex.test(line)) return priority;
    }
    return null;
}

/**
 * Parse backlog.md
 * Format:
 * ## High Priority
 * - [ ] **Title**: subtitle
 *   - Format: type
 *   - Hook: "hook"
 */
function parseBacklog(content) {
    const items = [];
    let currentPriority = 'medium';
    let id = 0;

    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.match(/##.*Tracker/i)) break;

        const newPriority = detectPriority(line);
        if (newPriority) {
            currentPriority = newPriority;
            continue;
        }

        const itemMatch = line.match(/^-\s*\[[ x]\]\s*\*\*([^*]+)\*\*[:\s]*(.*)$/);
        if (itemMatch) {
            id++;
            const title = itemMatch[1].trim();
            const subtitle = itemMatch[2].trim();

            let format = 'Post';
            let hook = null;
            let project = null;

            for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
                const nextLine = lines[j];
                if (nextLine.match(/^-\s*\[/)) break;
                if (nextLine.match(/^##/)) break;

                const formatMatch = nextLine.match(/Format:\s*(.+)/i);
                const hookMatch = nextLine.match(/Hook:\s*["«]?([^"»\n]+)["»]?/i);
                const projectMatch = nextLine.match(/Project:\s*(.+)/i);

                if (formatMatch) format = formatMatch[1].trim();
                if (hookMatch) hook = hookMatch[1].trim();
                if (projectMatch) project = projectMatch[1].trim();
            }

            items.push({
                id,
                title: subtitle ? `${title}: ${subtitle}` : title,
                format,
                hook,
                priority: currentPriority,
                project
            });
            continue;
        }

        const simpleMatch = line.match(/^-\s*\[[ x]\]\s*(.+)$/);
        if (simpleMatch && !simpleMatch[1].startsWith('**')) {
            id++;
            items.push({
                id,
                title: simpleMatch[1].trim(),
                format: 'Post',
                hook: null,
                priority: currentPriority,
                project: null
            });
        }
    }

    return items;
}

// ============================================
// Draft Parser
// ============================================

function detectStatus(text) {
    if (!text) return 'draft';
    const t = text.toLowerCase();
    if (t.includes('ready') || t.includes('done')) return 'ready';
    if (t.includes('progress') || t.includes('v1')) return 'in-progress';
    return 'draft';
}

/**
 * Parse a draft file
 * Format:
 * # Title
 * **Status**: DRAFT v1
 * **Format**: Thread
 */
async function parseDraft(filepath) {
    const content = await fs.readFile(filepath, 'utf-8');
    const filename = path.basename(filepath);

    const titleMatch = content.match(/^#\s+(.+)/m);
    const title = titleMatch ? titleMatch[1].trim() : filename.replace('.md', '');

    const statusMatch = content.match(/\*\*Status\*\*:\s*(.+)/i);
    const status = detectStatus(statusMatch?.[1]);

    return { filename, title, status };
}

module.exports = {
    parseSessionLog,
    parseBacklog,
    parseDraft,
    detectStatus,
    detectPriority
};
