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
    ],
    generate_content: [
        // Russian: напиши/сделай/создай + content type (tolerant to typos)
        /(?:напи?[шс][иы]?|сделай|создай|сгенер\w+)\s*(?:пост|тред|thread|tip|совет)/i,
        // Russian: нужен/хочу/дай/давай/запили + content type
        /(?:нужен|хочу|дай|давай|запили|накидай|набросай)\s*(?:пост|тред)/i,
        // Russian: content type + "про" (topic trigger)
        /(?:пост|тред|thread|контент)\s*про/i,
        // English: write/generate/draft/create/make + content type
        /(?:write|generate|draft|create|make|gimme|give\s*me)\s*(?:post|thread|content)/i
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

    // Extract content generation prompt (for generate_content intent)
    // The original message IS the prompt for content generation
    entities.contentPrompt = message;

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
 * Find project by name (fuzzy matching with aliases)
 * @param {string} message - User message
 * @param {Array} projects - Project list from projects.json
 * @returns {Object|null} Matched project or null
 */
function findProject(message, projects) {
    if (!projects || projects.length === 0) return null;

    const normalizedMsg = message.toLowerCase();

    // Build aliases from project paths and GitHub URLs
    for (const project of projects) {
        const aliases = [
            project.name.toLowerCase(),
            // Extract folder name from path
            project.path?.split('/').pop()?.toLowerCase(),
            // Extract repo name from GitHub URL
            project.github?.split('/').pop()?.replace('.git', '')?.toLowerCase()
        ].filter(Boolean);

        // Check if any alias matches
        for (const alias of aliases) {
            if (alias && normalizedMsg.includes(alias)) {
                return project;
            }
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
 * Calculate temporal relevance score (Phase 2: Context Awareness)
 * Implements decay: today=100, yesterday=70, 2-3 days=50, week+=10
 * @param {number} daysSilent - Days since last activity
 * @returns {number} Score 0-100
 */
function calculateTemporalScore(daysSilent) {
    if (daysSilent === 0) return 100;  // Today
    if (daysSilent === 1) return 70;   // Yesterday  
    if (daysSilent <= 3) return 50;    // This week
    if (daysSilent <= 7) return 30;    // Last week
    return 10;                          // Older
}

/**
 * Format temporal suggestion text based on days silent
 * @param {string} projectName - Project name
 * @param {number} daysSilent - Days since last activity
 * @returns {string} Formatted suggestion
 */
function formatTemporalSuggestion(projectName, daysSilent) {
    const timeLabel =
        daysSilent === 0 ? 'today' :
            daysSilent === 1 ? 'yesterday' :
                daysSilent <= 3 ? `${daysSilent} days ago` :
                    daysSilent <= 7 ? 'this week' : 'a while ago';

    return `Link to ${projectName}? (touched ${timeLabel})`;
}

/**
 * Find contextual links between entities
 */
function findContextualLinks(entities, context) {
    const links = [];
    const { gitActivity = [], projects = [], backlogItems = [] } = context;

    // Phase 2: Enhanced contextual linking with temporal decay
    const title = entities.idea?.title || entities.newIdeaTitle || '';
    const titleLower = title.toLowerCase();

    // Find project suggestions based on:
    // 1. Explicit project mention in message/title
    // 2. Recent git activity with name match
    const projectSuggestions = [];

    for (const proj of gitActivity) {
        const projNameLower = proj.name.toLowerCase();
        const score = calculateTemporalScore(proj.daysSilent);

        // Check if project name appears in title or has recent activity
        const nameMatch = titleLower.includes(projNameLower) ||
            projNameLower.includes(titleLower.split(' ')[0]);

        // Include if: name matches OR touched recently (score >= 50)
        if (nameMatch || score >= 50) {
            projectSuggestions.push({
                project: proj.name,
                daysSilent: proj.daysSilent,
                score: nameMatch ? score + 20 : score,  // Bonus for name match
                nameMatch
            });
        }
    }

    // Sort by score descending, take top 3
    projectSuggestions.sort((a, b) => b.score - a.score);
    const topSuggestions = projectSuggestions.slice(0, 3);

    // Add to links
    for (const suggestion of topSuggestions) {
        links.push({
            type: 'project_suggestion',
            project: suggestion.project,
            daysSilent: suggestion.daysSilent,
            score: suggestion.score,
            nameMatch: suggestion.nameMatch,
            suggestion: formatTemporalSuggestion(suggestion.project, suggestion.daysSilent, suggestion.score)
        });
    }

    // Duplicate detection for new ideas
    if (entities.newIdeaTitle && backlogItems.length > 0) {
        const similar = findSimilarIdea(entities.newIdeaTitle, backlogItems);
        if (similar) {
            links.push({
                type: 'duplicate_warning',
                existingIdea: similar,
                suggestion: `💡 Similar idea exists: "${similar.title}"`
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
    const base = {
        confidence,
        confidenceLevel: confidence >= 85 ? 'high' : confidence >= 70 ? 'medium' : 'low',
        confidenceBadge: confidence >= 85 ? '🟢' : confidence >= 70 ? '🟡' : '🔴'
    };

    const cardBuilders = {
        add_to_backlog: () => ({
            type: 'AddIdeaCard',
            title: entities.idea?.title || entities.newIdeaTitle || 'New idea',
            existingIdea: entities.idea || null,
            suggestedPriority: entities.priority || 'medium',
            suggestedFormat: entities.format || 'thread',
            links,
            hasDuplicateWarning: links.some(l => l.type === 'duplicate_warning')
        }),
        find_idea: () => ({
            type: 'FindIdeaCard',
            foundIdea: entities.idea || null,
            searchQuery: entities.newIdeaTitle || ''
        }),
        show_activity: () => ({
            type: 'ActivityCard',
            project: entities.project || null
        }),
        change_priority: () => ({
            type: 'ChangePriorityCard',
            idea: entities.idea || null,
            newPriority: entities.priority || 'high'
        }),
        generate_content: () => ({
            type: 'ContentGeneratorCard',
            prompt: entities.contentPrompt || '',
            template: entities.format || 'thread',
            project: entities.project?.name || null
        })
    };

    const builder = cardBuilders[intentType];
    return builder ? { ...base, ...builder() } : null;
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
