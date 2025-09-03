// Branestawm - Context Manager
// Intelligent context selection and optimization for LLM calls

class ContextManager {
    constructor(dataManager, messageManager, summarizationEngine, errorManager) {
        this.dataManager = dataManager;
        this.messageManager = messageManager;
        this.summarizationEngine = summarizationEngine;
        this.errorManager = errorManager;
        
        // Context optimization parameters
        this.config = {
            maxTokens: 8000, // Maximum context tokens
            reservedTokens: 1000, // Reserved for system prompt + response
            minRecentMessages: 3, // Always include at least this many recent messages
            maxRecentMessages: 10, // Maximum recent messages to consider
            importanceThreshold: 3.0, // Minimum importance for historical inclusion
            relevanceThreshold: 0.6, // Minimum relevance score for inclusion
            compressionRatio: 0.3, // Target compression for long contexts
            cacheTimeout: 5 * 60 * 1000, // 5 minutes cache timeout
        };
        
        // Context cache for performance
        this.contextCache = new Map();
        this.relevanceCache = new Map();
        
        // Token counting utilities
        this.tokenEstimator = {
            // Rough estimates - can be refined with actual tokenizer
            avgCharsPerToken: 4,
            avgWordsPerToken: 0.75,
            codeMultiplier: 1.2, // Code tokens are typically longer
            markdownMultiplier: 1.1 // Markdown has formatting tokens
        };
        
        console.log('ContextManager initialized');
    }
    
    /**
     * Build optimal context for LLM query
     */
    async buildOptimalContext(folioId, query, options = {}) {
        const startTime = Date.now();
        
        try {
            // Check cache first
            const cacheKey = this._generateCacheKey(folioId, query, options);
            if (this.contextCache.has(cacheKey)) {
                const cached = this.contextCache.get(cacheKey);
                if (Date.now() - cached.timestamp < this.config.cacheTimeout) {
                    console.log('Context cache hit');
                    return cached.context;
                }
            }
            
            const maxTokens = options.maxTokens || this.config.maxTokens;
            const availableTokens = maxTokens - this.config.reservedTokens;
            
            // Get folio data
            const folio = this.dataManager.getState(`folios.${folioId}`);
            if (!folio) {
                throw new Error(`Folio ${folioId} not found`);
            }
            
            // Build context components
            const context = {
                systemPrompt: '',
                messages: [],
                summaries: [],
                artifacts: [],
                metadata: {
                    folioId: folioId,
                    query: query,
                    totalTokens: 0,
                    compressionAchieved: false,
                    processingTime: 0,
                    sources: []
                }
            };
            
            // Build system prompt with persona and folio context
            context.systemPrompt = await this._buildSystemPrompt(folio, availableTokens * 0.2);
            const systemPromptTokens = this._estimateTokens(context.systemPrompt);
            context.metadata.totalTokens += systemPromptTokens;
            
            const remainingTokens = availableTokens - systemPromptTokens;
            
            // Get optimal message selection
            await this._selectOptimalMessages(context, folio, query, remainingTokens * 0.6);
            
            // Add summaries if beneficial
            await this._addRelevantSummaries(context, folio, query, remainingTokens * 0.3);
            
            // Add relevant artifacts
            await this._addRelevantArtifacts(context, folio, query, remainingTokens * 0.1);
            
            // Optimize and finalize
            await this._optimizeContext(context, availableTokens);
            
            context.metadata.processingTime = Date.now() - startTime;
            
            // Cache the result
            this.contextCache.set(cacheKey, {
                context: context,
                timestamp: Date.now()
            });
            
            // Clean old cache entries
            this._cleanCache();
            
            console.log(`Context built: ${context.metadata.totalTokens} tokens, ${context.messages.length} messages, ${context.summaries.length} summaries`);
            return context;
            
        } catch (error) {
            if (this.errorManager) {
                this.errorManager.handleError(this.errorManager.createError('CONTEXT_BUILD_FAILED', {
                    operation: 'buildOptimalContext',
                    folioId: folioId,
                    query: query.substring(0, 100),
                    error: error.message
                }));
            }
            throw error;
        }
    }
    
    /**
     * Calculate relevance score between query and content
     */
    calculateRelevance(query, content, options = {}) {
        try {
            const cacheKey = `${query.substring(0, 50)}_${content.substring(0, 50)}`;
            if (this.relevanceCache.has(cacheKey)) {
                return this.relevanceCache.get(cacheKey);
            }
            
            let relevance = 0;
            
            // Keyword matching
            const queryWords = this._extractKeywords(query.toLowerCase());
            const contentWords = this._extractKeywords(content.toLowerCase());
            
            const commonWords = queryWords.filter(word => contentWords.includes(word));
            const keywordScore = commonWords.length / Math.max(queryWords.length, 1);
            relevance += keywordScore * 0.4;
            
            // Topic similarity
            const queryTopics = this._extractTopics(query);
            const contentTopics = this._extractTopics(content);
            const commonTopics = queryTopics.filter(topic => contentTopics.includes(topic));
            const topicScore = commonTopics.length / Math.max(queryTopics.length, 1);
            relevance += topicScore * 0.3;
            
            // Semantic type matching
            if (options.semanticType) {
                const queryType = this._analyzeSemanticType(query);
                if (queryType === options.semanticType) {
                    relevance += 0.2;
                }
            }
            
            // Recency factor
            if (options.timestamp) {
                const age = Date.now() - new Date(options.timestamp).getTime();
                const daysSinceCreation = age / (24 * 60 * 60 * 1000);
                const recencyScore = Math.max(0, 1 - (daysSinceCreation / 30)); // Decay over 30 days
                relevance += recencyScore * 0.1;
            }
            
            // Normalize to 0-1 range
            relevance = Math.min(1, relevance);
            
            // Cache the result
            this.relevanceCache.set(cacheKey, relevance);
            
            return relevance;
            
        } catch (error) {
            console.warn('Error calculating relevance:', error);
            return 0.5; // Default relevance
        }
    }
    
    /**
     * Optimize context to fit within token limits
     */
    async optimizeContextForTokens(context, maxTokens) {
        const currentTokens = context.metadata.totalTokens;
        
        if (currentTokens <= maxTokens) {
            return context; // Already within limits
        }
        
        const targetTokens = maxTokens * 0.95; // 5% buffer
        const compressionNeeded = targetTokens / currentTokens;
        
        console.log(`Context optimization needed: ${currentTokens} -> ${targetTokens} tokens (${Math.round(compressionNeeded * 100)}% compression)`);
        
        // Step 1: Remove lowest relevance messages
        if (context.messages.length > this.config.minRecentMessages) {
            context.messages = context.messages
                .sort((a, b) => (b.relevance || 0) - (a.relevance || 0))
                .slice(0, Math.max(this.config.minRecentMessages, Math.floor(context.messages.length * compressionNeeded)));
        }
        
        // Step 2: Truncate long messages
        context.messages = context.messages.map(msg => {
            if (msg.tokenCount > 200) {
                const targetLength = Math.floor(msg.content.length * compressionNeeded);
                return {
                    ...msg,
                    content: msg.content.substring(0, targetLength) + '...[truncated]',
                    tokenCount: this._estimateTokens(msg.content.substring(0, targetLength) + '...[truncated]'),
                    truncated: true
                };
            }
            return msg;
        });
        
        // Step 3: Prefer summaries over full messages if available
        if (this.summarizationEngine && context.summaries.length > 0) {
            const summaryTokens = context.summaries.reduce((sum, summary) => sum + summary.tokenCount, 0);
            const messageTokens = context.messages.reduce((sum, msg) => sum + (msg.tokenCount || 0), 0);
            
            if (summaryTokens < messageTokens * 0.6) {
                // Summaries are more efficient, keep fewer full messages
                context.messages = context.messages.slice(-this.config.minRecentMessages);
                context.metadata.compressionAchieved = true;
            }
        }
        
        // Step 4: Recalculate total tokens
        context.metadata.totalTokens = this._calculateTotalTokens(context);
        
        return context;
    }
    
    /**
     * Get context statistics for analysis
     */
    getContextStatistics(folioId = null) {
        const stats = {
            cacheHits: 0,
            cacheMisses: 0,
            totalQueries: 0,
            avgProcessingTime: 0,
            avgTokens: 0,
            compressionRate: 0
        };
        
        // Calculate from cache entries
        for (const [key, cached] of this.contextCache.entries()) {
            if (!folioId || key.includes(folioId)) {
                stats.totalQueries++;
                stats.avgProcessingTime += cached.context.metadata.processingTime || 0;
                stats.avgTokens += cached.context.metadata.totalTokens || 0;
                if (cached.context.metadata.compressionAchieved) {
                    stats.compressionRate++;
                }
            }
        }
        
        if (stats.totalQueries > 0) {
            stats.avgProcessingTime = Math.round(stats.avgProcessingTime / stats.totalQueries);
            stats.avgTokens = Math.round(stats.avgTokens / stats.totalQueries);
            stats.compressionRate = Math.round((stats.compressionRate / stats.totalQueries) * 100);
        }
        
        return stats;
    }
    
    /**
     * Clear context cache
     */
    clearCache() {
        this.contextCache.clear();
        this.relevanceCache.clear();
        console.log('Context cache cleared');
    }
    
    /**
     * Private helper methods
     */
    
    async _buildSystemPrompt(folio, maxTokens) {
        const persona = this.dataManager.getState(`settings.personas.${folio.assignedPersona}`) ||
                       this.dataManager.getState('settings.personas.core');
        
        let prompt = `SYSTEM CONTEXT (PERSONA):
Identity: ${persona.identity}
Communication Style: ${persona.communicationStyle}
Tone: ${persona.tone}
Role Context: ${persona.roleContext}

`;

        // Add folio context if available
        if (folio.guidelines?.trim() || folio.description?.trim()) {
            prompt += `DOMAIN CONTEXT (FOLIO):
Folio: ${folio.title}`;
            
            if (folio.description?.trim()) {
                prompt += `\nDescription: ${folio.description}`;
            }
            
            if (folio.guidelines?.trim()) {
                prompt += `\nGuidelines: ${folio.guidelines}`;
            }
            
            prompt += `\n\n`;
        }

        // Add temporal context
        const currentDate = new Date();
        const dateString = currentDate.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        const timeString = currentDate.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short'
        });
        
        prompt += `TEMPORAL CONTEXT:
📅 CURRENT DATE AND TIME: ${dateString} at ${timeString}
🗓️ Today is: ${dateString}
⏰ Current time: ${timeString}

`;

        // Truncate if too long
        if (this._estimateTokens(prompt) > maxTokens) {
            const targetLength = Math.floor(prompt.length * (maxTokens / this._estimateTokens(prompt)));
            prompt = prompt.substring(0, targetLength) + '...[truncated]';
        }

        return prompt;
    }
    
    async _selectOptimalMessages(context, folio, query, maxTokens) {
        const messages = folio.messages || [];
        if (messages.length === 0) return;
        
        // Always include recent messages
        const recentMessages = messages.slice(-this.config.maxRecentMessages);
        const recentTokens = recentMessages.reduce((sum, msg) => sum + (msg.tokenCount || this._estimateTokens(msg.content)), 0);
        
        if (recentTokens <= maxTokens) {
            // Recent messages fit, add them all
            context.messages = recentMessages.map(msg => ({
                ...msg,
                relevance: this.calculateRelevance(query, msg.content, {
                    semanticType: msg.semanticType,
                    timestamp: msg.timestamp
                })
            }));
            
            context.metadata.totalTokens += recentTokens;
            context.metadata.sources.push('recent_messages');
            
            // Try to add more relevant historical messages
            const remainingTokens = maxTokens - recentTokens;
            await this._addHistoricalMessages(context, messages, query, remainingTokens);
            
        } else {
            // Recent messages too long, select most important
            const sortedRecent = recentMessages
                .map(msg => ({
                    ...msg,
                    relevance: this.calculateRelevance(query, msg.content, {
                        semanticType: msg.semanticType,
                        timestamp: msg.timestamp
                    })
                }))
                .sort((a, b) => (b.relevance * (b.importance || 1)) - (a.relevance * (a.importance || 1)));
            
            let usedTokens = 0;
            for (const msg of sortedRecent) {
                const msgTokens = msg.tokenCount || this._estimateTokens(msg.content);
                if (usedTokens + msgTokens <= maxTokens) {
                    context.messages.push(msg);
                    usedTokens += msgTokens;
                }
            }
            
            // Ensure we have at least minimum recent messages
            if (context.messages.length < this.config.minRecentMessages) {
                context.messages = sortedRecent.slice(0, this.config.minRecentMessages);
                usedTokens = context.messages.reduce((sum, msg) => sum + (msg.tokenCount || this._estimateTokens(msg.content)), 0);
            }
            
            context.metadata.totalTokens += usedTokens;
            context.metadata.sources.push('selected_messages');
            context.metadata.compressionAchieved = true;
        }
        
        // Sort messages chronologically
        context.messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }
    
    async _addHistoricalMessages(context, allMessages, query, maxTokens) {
        const excludeIds = new Set(context.messages.map(msg => msg.id));
        const historicalMessages = allMessages
            .filter(msg => !excludeIds.has(msg.id))
            .filter(msg => (msg.importance || 1) >= this.config.importanceThreshold)
            .map(msg => ({
                ...msg,
                relevance: this.calculateRelevance(query, msg.content, {
                    semanticType: msg.semanticType,
                    timestamp: msg.timestamp
                })
            }))
            .filter(msg => msg.relevance >= this.config.relevanceThreshold)
            .sort((a, b) => (b.relevance * (b.importance || 1)) - (a.relevance * (a.importance || 1)));
        
        let usedTokens = 0;
        for (const msg of historicalMessages) {
            const msgTokens = msg.tokenCount || this._estimateTokens(msg.content);
            if (usedTokens + msgTokens <= maxTokens) {
                context.messages.push(msg);
                usedTokens += msgTokens;
                context.metadata.totalTokens += msgTokens;
            }
        }
        
        if (historicalMessages.length > 0) {
            context.metadata.sources.push('historical_messages');
        }
    }
    
    async _addRelevantSummaries(context, folio, query, maxTokens) {
        if (!this.summarizationEngine || !folio.summaries) return;
        
        const allSummaries = []
            .concat(folio.summaries.daily || [])
            .concat(folio.summaries.weekly || [])
            .concat(Object.values(folio.summaries.threads || {}))
            .concat(folio.summaries.topical || [])
            .filter(summary => new Date(summary.validUntil) > new Date())
            .map(summary => ({
                ...summary,
                relevance: this.calculateRelevance(query, summary.content, {
                    timestamp: summary.createdAt
                })
            }))
            .filter(summary => summary.relevance >= this.config.relevanceThreshold)
            .sort((a, b) => (b.relevance * (b.metadata?.importance || 1)) - (a.relevance * (a.metadata?.importance || 1)));
        
        let usedTokens = 0;
        for (const summary of allSummaries) {
            if (usedTokens + summary.tokenCount <= maxTokens) {
                context.summaries.push(summary);
                usedTokens += summary.tokenCount;
                context.metadata.totalTokens += summary.tokenCount;
            }
        }
        
        if (context.summaries.length > 0) {
            context.metadata.sources.push('summaries');
        }
    }
    
    async _addRelevantArtifacts(context, folio, query, maxTokens) {
        const artifactIds = [...(folio.artifacts || []), ...(folio.sharedArtifacts || [])];
        const relevantArtifacts = [];
        
        for (const artifactId of artifactIds) {
            const artifact = this.dataManager.getState(`artifacts.${artifactId}`);
            if (artifact) {
                const relevance = this.calculateRelevance(query, artifact.content, {
                    timestamp: artifact.createdAt
                });
                
                if (relevance >= this.config.relevanceThreshold) {
                    relevantArtifacts.push({
                        ...artifact,
                        relevance: relevance,
                        tokenCount: this._estimateTokens(artifact.content)
                    });
                }
            }
        }
        
        // Sort by relevance and add within token limits
        relevantArtifacts.sort((a, b) => b.relevance - a.relevance);
        
        let usedTokens = 0;
        for (const artifact of relevantArtifacts) {
            if (usedTokens + artifact.tokenCount <= maxTokens) {
                context.artifacts.push(artifact);
                usedTokens += artifact.tokenCount;
                context.metadata.totalTokens += artifact.tokenCount;
            }
        }
        
        if (context.artifacts.length > 0) {
            context.metadata.sources.push('artifacts');
        }
    }
    
    async _optimizeContext(context, maxTokens) {
        if (context.metadata.totalTokens > maxTokens) {
            context = await this.optimizeContextForTokens(context, maxTokens);
        }
        
        // Add optimization metadata
        context.metadata.optimized = true;
        context.metadata.tokenEfficiency = Math.round((context.metadata.totalTokens / maxTokens) * 100);
        
        return context;
    }
    
    _estimateTokens(text) {
        if (!text) return 0;
        
        let multiplier = this.tokenEstimator.avgCharsPerToken;
        
        // Adjust for content type
        if (text.includes('```')) {
            multiplier *= this.tokenEstimator.codeMultiplier;
        } else if (text.includes('#') || text.includes('*') || text.includes('[')) {
            multiplier *= this.tokenEstimator.markdownMultiplier;
        }
        
        return Math.ceil(text.length / multiplier);
    }
    
    _calculateTotalTokens(context) {
        let total = this._estimateTokens(context.systemPrompt);
        
        total += context.messages.reduce((sum, msg) => sum + (msg.tokenCount || this._estimateTokens(msg.content)), 0);
        total += context.summaries.reduce((sum, summary) => sum + summary.tokenCount, 0);
        total += context.artifacts.reduce((sum, artifact) => sum + artifact.tokenCount, 0);
        
        return total;
    }
    
    _extractKeywords(text) {
        return text.toLowerCase()
            .match(/\b\w{4,}\b/g)
            ?.filter(word => !['this', 'that', 'with', 'have', 'been', 'they', 'them', 'will', 'from', 'what', 'when', 'where', 'which', 'would'].includes(word))
            ?.slice(0, 20) || [];
    }
    
    _extractTopics(text) {
        const words = this._extractKeywords(text);
        const frequency = {};
        
        words.forEach(word => {
            frequency[word] = (frequency[word] || 0) + 1;
        });
        
        return Object.entries(frequency)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([word]) => word);
    }
    
    _analyzeSemanticType(text) {
        const lowerText = text.toLowerCase();
        
        if (/^(what|how|when|where|why|which|who)\s/.test(lowerText) || /\?$/.test(text)) {
            return 'query';
        }
        if (/^(create|make|build|generate|write)/.test(lowerText)) {
            return 'task';
        }
        if (/^(in summary|to summarize|overall)/.test(lowerText)) {
            return 'summary';
        }
        
        return 'query'; // Default
    }
    
    _generateCacheKey(folioId, query, options) {
        const hash = this._simpleHash(query + JSON.stringify(options));
        return `${folioId}_${hash}`;
    }
    
    _simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString(36);
    }
    
    _cleanCache() {
        const now = Date.now();
        for (const [key, cached] of this.contextCache.entries()) {
            if (now - cached.timestamp > this.config.cacheTimeout) {
                this.contextCache.delete(key);
            }
        }
        
        // Limit cache size
        if (this.contextCache.size > 100) {
            const entries = Array.from(this.contextCache.entries())
                .sort((a, b) => b[1].timestamp - a[1].timestamp);
            
            this.contextCache.clear();
            entries.slice(0, 50).forEach(([key, value]) => {
                this.contextCache.set(key, value);
            });
        }
    }
}

// Export singleton
const contextManager = new ContextManager(
    window.dataManager,
    window.messageManager,
    window.summarizationEngine,
    window.errorManager
);

// Make available globally
if (typeof window !== 'undefined') {
    window.contextManager = contextManager;
}

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = contextManager;
}