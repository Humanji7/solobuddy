/* ============================================
   SoloBuddy Hub — Intent Recognition Layer (IRL)
   Nielsen-Approved Phase 1 Implementation
   ============================================ */

/**
 * Intent patterns for fuzzy matching
 */
const INTENT_PATTERNS = {
    add_to_backlog: [
        /добав[ь|ить|й].*идею?/i,
        /запис[ать|ь].*в.*backlog/i,
        /новая.*идея/i,
        /та.*штук[а|у].*про/i,  // fuzzy: "та штука про orb"
        /хочу.*запомнить/i,
        /add.*idea/i,
        /save.*backlog/i
    ],
    find_idea: [
        /где.*идея.*про/i,
        /найди.*идею?/i,
        /та.*идея.*про/i,
        /что.*там.*про/i,
        /покажи.*backlog/i
    ],
    show_activity: [
        /что.*происходит/i,
        /как.*дела.*с/i,
        /последн[ее|ие].*commit/i,
        /где.*активность/i,
        /status/i,
        /update/i
    ],
    link_to_project: [
        /связ[ать|ь].*с.*проект/i,
        /это.*для.*проект/i,
        /добавь.*к.*проект/i
    ],
    change_priority: [
        /сделай.*high/i,
        /повысь.*приоритет/i,
        /urgent/i,
        /срочн/i
    ]
};

/**
 * Detect intent type from message
 * @returns {{ type: string, confidence: number }}
 */
function detectIntentType(message) {
    const normalizedMsg = message.toLowerCase().trim();

    for (const [intentType, patterns] of Object.entries(INTENT_PATTERNS)) {
        for (const pattern of patterns) {
            if (pattern.test(normalizedMsg)) {
                // Calculate confidence based on pattern specificity
                const confidence = calculateConfidence(pattern, normalizedMsg);
                return { type: intentType, confidence };
            }
        }
    }

    return { type: 'unknown', confidence: 0 };
}

/**
 * Calculate confidence score (0-100)
 */
function calculateConfidence(pattern, message) {
    const match = message.match(pattern);
    if (!match) return 0;

    // Base confidence
    let confidence = 70;

    // Bonus for longer matches
    const matchRatio = match[0].length / message.length;
    confidence += matchRatio * 20;

    // Bonus for exact keywords
    if (/backlog|идея|priority|проект/.test(message)) {
        confidence += 10;
    }

    return Math.min(Math.round(confidence), 100);
}

/**
 * Extract entities from message using context
 */
function extractEntities(message, context) {
    const entities = {};
    const { backlogItems = [], projects = [] } = context;

    // Extract idea reference (fuzzy match)
    const ideaMatch = findBacklogIdea(message, backlogItems);
    if (ideaMatch) {
        entities.idea = ideaMatch;
    }

    // Extract project reference
    const projectMatch = findProject(message, projects);
    if (projectMatch) {
        entities.project = projectMatch;
    }

    // Extract priority if mentioned
    const priority = extractPriority(message);
    if (priority) {
        entities.priority = priority;
    }

    // Extract format if mentioned
    const format = extractFormat(message);
    if (format) {
        entities.format = format;
    }

    // Extract new idea title if creating
    const newIdeaTitle = extractNewIdeaTitle(message);
    if (newIdeaTitle && !entities.idea) {
        entities.newIdeaTitle = newIdeaTitle;
    }

    return entities;
}

/**
 * Fuzzy match idea from backlog
 * "та штука про orb" → "Live orb for UI"
 */
function findBacklogIdea(message, backlogItems) {
    if (!backlogItems || backlogItems.length === 0) return null;

    const normalizedMsg = message.toLowerCase();

    // Pattern: "про X" - extract keyword
    const proMatch = normalizedMsg.match(/про\s+(\w+)/i);
    const keyword = proMatch ? proMatch[1] : null;

    // Also try: "та идея X", "штука X"
    const altMatch = normalizedMsg.match(/(?:идея|штука|та)\s+[^\s]*\s*(\w+)/i);
    const altKeyword = altMatch ? altMatch[1] : null;

    const searchKeyword = keyword || altKeyword;

    if (searchKeyword) {
        // Find matching backlog item
        const match = backlogItems.find(item =>
            item.title.toLowerCase().includes(searchKeyword.toLowerCase())
        );
        if (match) return match;
    }

    // Fallback: check if any backlog title words appear in message
    for (const item of backlogItems) {
        const titleWords = item.title.toLowerCase().split(/\s+/);
        const significantWords = titleWords.filter(w => w.length > 3);

        for (const word of significantWords) {
            if (normalizedMsg.includes(word)) {
                return item;
            }
        }
    }

    return null;
}

/**
 * Find project by name
 */
function findProject(message, projects) {
    if (!projects || projects.length === 0) return null;

    const normalizedMsg = message.toLowerCase();

    for (const project of projects) {
        if (normalizedMsg.includes(project.name.toLowerCase())) {
            return project;
        }
    }

    return null;
}

/**
 * Extract priority from message
 */
function extractPriority(message) {
    const msg = message.toLowerCase();

    if (/high|🔥|срочн|важн|критичн/.test(msg)) return 'high';
    if (/medium|⚡|обычн|normal/.test(msg)) return 'medium';
    if (/low|💭|потом|когда-нибудь/.test(msg)) return 'low';

    return null;
}

/**
 * Extract format from message
 */
function extractFormat(message) {
    const msg = message.toLowerCase();

    if (/thread/i.test(msg)) return 'thread';
    if (/gif/i.test(msg)) return 'gif';
    if (/post|пост/i.test(msg)) return 'post';
    if (/video|видео/i.test(msg)) return 'video';

    return null;
}

/**
 * Extract new idea title from "добавь идею X" pattern
 */
function extractNewIdeaTitle(message) {
    // Pattern: добавь идею "X" / добавь идею X
    const patterns = [
        /добав[ь|ить].*идею?\s+[«"']?([^»"']+)[»"']?$/i,
        /add.*idea\s+[«"']?([^»"']+)[»"']?$/i,
        /запиш[и|ь]\s+[«"']?([^»"']+)[»"']?$/i
    ];

    for (const pattern of patterns) {
        const match = message.match(pattern);
        if (match && match[1]) {
            return match[1].trim();
        }
    }

    return null;
}

/**
 * Find contextual links between entities
 */
function findContextualLinks(entities, context) {
    const links = [];
    const { gitActivity = [], projects = [] } = context;

    // If idea mentions project that was recently touched
    if (entities.idea) {
        for (const proj of gitActivity) {
            if (proj.daysSilent <= 1) { // Touched today or yesterday
                const titleLower = entities.idea.title.toLowerCase();
                const projNameLower = proj.name.toLowerCase();

                if (titleLower.includes(projNameLower) ||
                    projNameLower.includes(titleLower.split(' ')[0])) {
                    links.push({
                        type: 'recent_activity',
                        project: proj.name,
                        daysSilent: proj.daysSilent,
                        suggestion: proj.daysSilent === 0
                            ? `Связать с ${proj.name}? (трогал сегодня)`
                            : `Связать с ${proj.name}? (трогал вчера)`
                    });
                }
            }
        }
    }

    // If creating new idea and similar exists
    if (entities.newIdeaTitle && context.backlogItems) {
        const similar = findSimilarIdea(entities.newIdeaTitle, context.backlogItems);
        if (similar) {
            links.push({
                type: 'duplicate_warning',
                existingIdea: similar,
                suggestion: `💡 Похожая идея уже есть: \"${similar.title}\"`
            });
        }
    }

    return links;
}

/**
 * Find similar existing idea (duplicate detection)
 */
function findSimilarIdea(newTitle, backlogItems) {
    const newWords = new Set(newTitle.toLowerCase().split(/\s+/).filter(w => w.length > 3));

    for (const item of backlogItems) {
        const existingWords = new Set(item.title.toLowerCase().split(/\s+/).filter(w => w.length > 3));

        // Count common words
        let common = 0;
        for (const word of newWords) {
            if (existingWords.has(word)) common++;
        }

        // More than 50% match = potential duplicate
        if (common > 0 && common / newWords.size >= 0.5) {
            return item;
        }
    }

    return null;
}

/**
 * Build Action Card specification
 */
function buildActionCard(intentType, entities, links, confidence) {
    // Get confidence level for badge
    const confidenceLevel = confidence >= 85 ? 'high' : confidence >= 70 ? 'medium' : 'low';
    const confidenceBadge = confidence >= 85 ? '🟢' : confidence >= 70 ? '🟡' : '🔴';

    switch (intentType) {
        case 'add_to_backlog':
            return {
                type: 'AddIdeaCard',
                title: entities.idea?.title || entities.newIdeaTitle || 'Новая идея',
                existingIdea: entities.idea || null,
                suggestedPriority: entities.priority || 'medium',
                suggestedFormat: entities.format || 'thread',
                links: links,
                confidence,
                confidenceLevel,
                confidenceBadge,
                // Nielsen: duplicate warning
                hasDuplicateWarning: links.some(l => l.type === 'duplicate_warning')
            };

        case 'find_idea':
            return {
                type: 'FindIdeaCard',
                foundIdea: entities.idea || null,
                searchQuery: entities.newIdeaTitle || '',
                confidence,
                confidenceLevel,
                confidenceBadge
            };

        case 'show_activity':
            return {
                type: 'ActivityCard',
                project: entities.project || null,
                confidence,
                confidenceLevel,
                confidenceBadge
            };

        case 'change_priority':
            return {
                type: 'ChangePriorityCard',
                idea: entities.idea || null,
                newPriority: entities.priority || 'high',
                confidence,
                confidenceLevel,
                confidenceBadge
            };

        default:
            return null; // No action card for unknown intent
    }
}

/**
 * Main intent parsing function
 * @param {string} message - User message
 * @param {Object} context - { backlogItems, projects, gitActivity, sessionLog }
 * @returns {{ intentType, entities, links, actionCard, confidence }}
 */
function parseIntent(message, context) {
    // 1. Detect intent type
    const { type: intentType, confidence } = detectIntentType(message);

    // If confidence too low, return null (fallback to regular chat)
    if (intentType === 'unknown' || confidence < 50) {
        return {
            intentType: 'unknown',
            entities: {},
            links: [],
            actionCard: null,
            confidence: 0
        };
    }

    // 2. Extract entities
    const entities = extractEntities(message, context);

    // 3. Find contextual links
    const links = findContextualLinks(entities, context);

    // 4. Build Action Card spec
    const actionCard = buildActionCard(intentType, entities, links, confidence);

    return {
        intentType,
        entities,
        links,
        actionCard,
        confidence
    };
}

module.exports = {
    parseIntent,
    detectIntentType,
    extractEntities,
    findContextualLinks,
    buildActionCard
};
