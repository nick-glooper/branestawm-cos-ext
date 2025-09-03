// Branestawm - Search Engine
// Semantic search and retrieval enhancement for cross-folio information access

class SearchEngine {
    constructor(dataManager, messageManager, contextManager, errorManager) {
        this.dataManager = dataManager;
        this.messageManager = messageManager;
        this.contextManager = contextManager;
        this.errorManager = errorManager;
        
        // Search configuration
        this.config = {
            maxResults: 20,
            minRelevanceScore: 0.3,
            boostFactors: {
                titleMatch: 2.0,
                exactPhrase: 1.8,
                recentContent: 1.5,
                highImportance: 1.3,
                semanticMatch: 1.2
            },
            temporalDecay: {
                enabled: true,
                halfLife: 30 * 24 * 60 * 60 * 1000, // 30 days in ms
                maxDecay: 0.1 // Minimum relevance factor
            }
        };
        
        // Search indexes for performance
        this.indexes = {
            keywords: new Map(), // keyword -> [documentId, ...]
            topics: new Map(),   // topic -> [documentId, ...]
            entities: new Map(), // entity -> [documentId, ...]
            semantic: new Map()  // semanticType -> [documentId, ...]
        };
        
        // Search cache
        this.searchCache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
        
        // Initialize indexes
        this.initializeIndexes();
        
        console.log('SearchEngine initialized');
    }
    
    /**
     * Perform semantic search across all folios
     */
    async search(query, options = {}) {
        try {
            // Check cache first
            const cacheKey = this._generateSearchCacheKey(query, options);
            if (this.searchCache.has(cacheKey)) {
                const cached = this.searchCache.get(cacheKey);
                if (Date.now() - cached.timestamp < this.cacheTimeout) {
                    console.log('Search cache hit');
                    return cached.results;
                }
            }
            
            const startTime = Date.now();
            
            // Parse and analyze query
            const queryAnalysis = this._analyzeQuery(query);
            
            // Search different content types
            const results = {
                messages: await this._searchMessages(queryAnalysis, options),
                artifacts: await this._searchArtifacts(queryAnalysis, options),
                summaries: await this._searchSummaries(queryAnalysis, options),
                metadata: {
                    query: query,
                    analyzedQuery: queryAnalysis,
                    totalResults: 0,
                    processingTime: 0,
                    searchScope: options.folioId ? 'single_folio' : 'all_folios',
                    filters: options.filters || {}
                }
            };
            
            // Combine and rank all results
            const combinedResults = this._combineAndRankResults(results, queryAnalysis);
            
            // Apply filters and limits
            const filteredResults = this._applyFiltersAndLimits(combinedResults, options);
            
            results.metadata.totalResults = filteredResults.length;
            results.metadata.processingTime = Date.now() - startTime;
            
            const finalResults = {
                results: filteredResults,
                metadata: results.metadata,
                suggestions: this._generateSearchSuggestions(queryAnalysis, filteredResults)
            };
            
            // Cache the results
            this.searchCache.set(cacheKey, {
                results: finalResults,
                timestamp: Date.now()
            });
            
            console.log(`Search completed: "${query}" -> ${filteredResults.length} results in ${results.metadata.processingTime}ms`);
            return finalResults;
            
        } catch (error) {
            if (this.errorManager) {
                this.errorManager.handleError(this.errorManager.createError('SEARCH_FAILED', {
                    operation: 'search',
                    query: query.substring(0, 100),
                    options: JSON.stringify(options),
                    error: error.message
                }));
            }
            throw error;
        }
    }
    
    /**
     * Search within a specific folio
     */
    async searchFolio(folioId, query, options = {}) {
        return await this.search(query, { ...options, folioId: folioId });
    }
    
    /**
     * Find similar content to a given message or artifact
     */
    async findSimilar(contentId, contentType = 'message', options = {}) {
        try {
            let sourceContent;
            
            if (contentType === 'message') {
                sourceContent = this._findMessageById(contentId);
            } else if (contentType === 'artifact') {
                sourceContent = this.dataManager.getState(`artifacts.${contentId}`);
            }
            
            if (!sourceContent) {
                throw new Error(`Content not found: ${contentId}`);
            }
            
            // Use content text as search query
            const searchQuery = sourceContent.content.substring(0, 200); // Use first 200 chars
            
            const results = await this.search(searchQuery, {
                ...options,
                excludeId: contentId,
                maxResults: options.maxResults || 10
            });
            
            return {
                sourceContent: sourceContent,
                similarContent: results.results,
                metadata: {
                    sourceId: contentId,
                    sourceType: contentType,
                    ...results.metadata
                }
            };
            
        } catch (error) {
            console.error('Error finding similar content:', error);
            return { sourceContent: null, similarContent: [], metadata: { error: error.message } };
        }
    }
    
    /**
     * Get search suggestions based on query analysis
     */
    getSearchSuggestions(partialQuery) {
        const suggestions = [];
        
        // Extract keywords from indexes
        const keywords = Array.from(this.indexes.keywords.keys())
            .filter(keyword => keyword.toLowerCase().includes(partialQuery.toLowerCase()))
            .slice(0, 10);
        
        suggestions.push(...keywords.map(keyword => ({
            type: 'keyword',
            text: keyword,
            suggestion: `Search for: ${keyword}`
        })));
        
        // Extract topics
        const topics = Array.from(this.indexes.topics.keys())
            .filter(topic => topic.toLowerCase().includes(partialQuery.toLowerCase()))
            .slice(0, 5);
        
        suggestions.push(...topics.map(topic => ({
            type: 'topic',
            text: `topic:${topic}`,
            suggestion: `Search topic: ${topic}`
        })));
        
        // Semantic type suggestions
        const semanticTypes = ['query', 'task', 'summary', 'clarification'];
        const matchingTypes = semanticTypes.filter(type => 
            type.includes(partialQuery.toLowerCase())
        );
        
        suggestions.push(...matchingTypes.map(type => ({
            type: 'semantic',
            text: `type:${type}`,
            suggestion: `Search ${type} messages`
        })));
        
        return suggestions.slice(0, 15);
    }
    
    /**
     * Update search indexes when content changes
     */
    async updateIndexes(contentType, contentId) {
        try {
            if (contentType === 'message') {
                const message = this._findMessageById(contentId);
                if (message) {
                    this._indexMessage(message);
                }
            } else if (contentType === 'artifact') {
                const artifact = this.dataManager.getState(`artifacts.${contentId}`);
                if (artifact) {
                    this._indexArtifact(artifact);
                }
            }
            
            console.log(`Updated search index for ${contentType}: ${contentId}`);
            
        } catch (error) {
            console.error('Error updating search indexes:', error);
        }
    }
    
    /**
     * Get search statistics
     */
    getSearchStatistics() {
        return {
            indexedKeywords: this.indexes.keywords.size,
            indexedTopics: this.indexes.topics.size,
            indexedEntities: this.indexes.entities.size,
            indexedSemanticTypes: this.indexes.semantic.size,
            cacheSize: this.searchCache.size,
            cacheHitRate: this._calculateCacheHitRate()
        };
    }
    
    /**
     * Clear search cache and optionally rebuild indexes
     */
    clearCache(rebuildIndexes = false) {
        this.searchCache.clear();
        
        if (rebuildIndexes) {
            this._clearIndexes();
            this.initializeIndexes();
        }
        
        console.log('Search cache cleared' + (rebuildIndexes ? ' and indexes rebuilt' : ''));
    }
    
    /**
     * Private helper methods
     */
    
    async initializeIndexes() {
        try {
            this._clearIndexes();
            
            const allFolios = this.dataManager.getState('folios');
            const allArtifacts = this.dataManager.getState('artifacts');
            
            // Index all messages
            for (const folio of Object.values(allFolios)) {
                if (folio.messages) {
                    folio.messages.forEach(message => this._indexMessage(message));
                }
                
                // Index summaries
                if (folio.summaries) {
                    this._indexSummaries(folio.summaries);
                }
            }
            
            // Index all artifacts
            for (const artifact of Object.values(allArtifacts)) {
                this._indexArtifact(artifact);
            }
            
            console.log('Search indexes initialized');
            
        } catch (error) {
            console.error('Error initializing search indexes:', error);
        }
    }
    
    _analyzeQuery(query) {
        const analysis = {
            original: query,
            keywords: [],
            phrases: [],
            topics: [],
            semanticType: null,
            filters: {},
            isQuestion: false,
            sentiment: 'neutral'
        };
        
        // Extract quoted phrases
        const phraseMatches = query.match(/"([^"]+)"/g);
        if (phraseMatches) {
            analysis.phrases = phraseMatches.map(match => match.slice(1, -1));
        }
        
        // Remove phrases from query for keyword extraction
        let cleanQuery = query.replace(/"[^"]+"/g, '');
        
        // Extract filters (e.g., "type:task", "folio:general")
        const filterMatches = cleanQuery.match(/(\w+):(\w+)/g);
        if (filterMatches) {
            filterMatches.forEach(filter => {
                const [key, value] = filter.split(':');
                analysis.filters[key] = value;
                cleanQuery = cleanQuery.replace(filter, '');
            });
        }
        
        // Extract keywords
        analysis.keywords = cleanQuery.toLowerCase()
            .match(/\b\w{3,}\b/g)
            ?.filter(word => !['the', 'and', 'but', 'for', 'are', 'was', 'were'].includes(word))
            ?.slice(0, 10) || [];
        
        // Detect question
        analysis.isQuestion = /\?$/.test(query) || /^(what|how|when|where|why|which|who)\s/i.test(query);
        
        // Analyze semantic type
        if (analysis.isQuestion) {
            analysis.semanticType = 'query';
        } else if (/^(create|make|build|generate)/.test(query.toLowerCase())) {
            analysis.semanticType = 'task';
        } else if (/^(summarize|summary|overview)/.test(query.toLowerCase())) {
            analysis.semanticType = 'summary';
        }
        
        return analysis;
    }
    
    async _searchMessages(queryAnalysis, options) {
        const results = [];
        const folios = options.folioId ? 
            { [options.folioId]: this.dataManager.getState(`folios.${options.folioId}`) } :
            this.dataManager.getState('folios');
        
        for (const [folioId, folio] of Object.entries(folios)) {
            if (!folio || !folio.messages) continue;
            
            folio.messages.forEach(message => {
                if (options.excludeId && message.id === options.excludeId) return;
                
                const relevance = this._calculateMessageRelevance(message, queryAnalysis);
                
                if (relevance >= this.config.minRelevanceScore) {
                    results.push({
                        type: 'message',
                        id: message.id,
                        folioId: folioId,
                        folioTitle: folio.title,
                        content: message.content,
                        role: message.role,
                        timestamp: message.timestamp,
                        semanticType: message.semanticType,
                        importance: message.importance || 1,
                        relevance: relevance,
                        highlights: this._generateHighlights(message.content, queryAnalysis)
                    });
                }
            });
        }
        
        return results.sort((a, b) => b.relevance - a.relevance);
    }
    
    async _searchArtifacts(queryAnalysis, options) {
        const results = [];
        const artifacts = this.dataManager.getState('artifacts');
        
        for (const artifact of Object.values(artifacts)) {
            if (options.excludeId && artifact.id === options.excludeId) return;
            
            // Skip artifacts not in specified folio
            if (options.folioId && artifact.folioId !== options.folioId && !artifact.shared) {
                continue;
            }
            
            const relevance = this._calculateArtifactRelevance(artifact, queryAnalysis);
            
            if (relevance >= this.config.minRelevanceScore) {
                const sourceFolio = this.dataManager.getState(`folios.${artifact.folioId}`);
                
                results.push({
                    type: 'artifact',
                    id: artifact.id,
                    folioId: artifact.folioId,
                    folioTitle: sourceFolio?.title || 'Unknown',
                    title: artifact.title,
                    content: artifact.content,
                    artifactType: artifact.type,
                    timestamp: artifact.createdAt,
                    shared: artifact.shared || false,
                    relevance: relevance,
                    highlights: this._generateHighlights(artifact.content, queryAnalysis)
                });
            }
        }
        
        return results.sort((a, b) => b.relevance - a.relevance);
    }
    
    async _searchSummaries(queryAnalysis, options) {
        const results = [];
        const folios = options.folioId ? 
            { [options.folioId]: this.dataManager.getState(`folios.${options.folioId}`) } :
            this.dataManager.getState('folios');
        
        for (const [folioId, folio] of Object.entries(folios)) {
            if (!folio || !folio.summaries) continue;
            
            // Search all summary types
            const allSummaries = []
                .concat(folio.summaries.daily || [])
                .concat(folio.summaries.weekly || [])
                .concat(Object.values(folio.summaries.threads || {}))
                .concat(folio.summaries.topical || []);
            
            allSummaries.forEach(summary => {
                if (options.excludeId && summary.id === options.excludeId) return;
                
                // Skip expired summaries
                if (new Date(summary.validUntil) <= new Date()) return;
                
                const relevance = this._calculateSummaryRelevance(summary, queryAnalysis);
                
                if (relevance >= this.config.minRelevanceScore) {
                    results.push({
                        type: 'summary',
                        id: summary.id,
                        folioId: folioId,
                        folioTitle: folio.title,
                        summaryType: summary.type,
                        content: summary.content,
                        timestamp: summary.createdAt,
                        messageCount: summary.metadata?.messageCount || 0,
                        relevance: relevance,
                        highlights: this._generateHighlights(summary.content, queryAnalysis)
                    });
                }
            });
        }
        
        return results.sort((a, b) => b.relevance - a.relevance);
    }
    
    _calculateMessageRelevance(message, queryAnalysis) {
        let relevance = 0;
        
        const content = message.content.toLowerCase();
        
        // Keyword matching
        queryAnalysis.keywords.forEach(keyword => {
            if (content.includes(keyword.toLowerCase())) {
                relevance += 0.3;
                
                // Boost for title-like content (first 50 chars)
                if (content.substring(0, 50).includes(keyword.toLowerCase())) {
                    relevance += this.config.boostFactors.titleMatch * 0.1;
                }
            }
        });
        
        // Phrase matching
        queryAnalysis.phrases.forEach(phrase => {
            if (content.includes(phrase.toLowerCase())) {
                relevance += this.config.boostFactors.exactPhrase * 0.2;
            }
        });
        
        // Semantic type matching
        if (queryAnalysis.semanticType && message.semanticType === queryAnalysis.semanticType) {
            relevance += this.config.boostFactors.semanticMatch * 0.15;
        }
        
        // Importance boost
        if ((message.importance || 1) >= 4) {
            relevance *= this.config.boostFactors.highImportance;
        }
        
        // Recency boost
        if (this.config.temporalDecay.enabled) {
            const age = Date.now() - new Date(message.timestamp).getTime();
            const decayFactor = Math.exp(-age / this.config.temporalDecay.halfLife);
            const adjustedDecayFactor = Math.max(this.config.temporalDecay.maxDecay, decayFactor);
            relevance *= adjustedDecayFactor;
        }
        
        // Filter matching
        if (queryAnalysis.filters.type && message.semanticType !== queryAnalysis.filters.type) {
            relevance *= 0.1; // Severely penalize non-matching types
        }
        
        return Math.min(1, relevance); // Cap at 1
    }
    
    _calculateArtifactRelevance(artifact, queryAnalysis) {
        let relevance = 0;
        
        const title = artifact.title.toLowerCase();
        const content = artifact.content.toLowerCase();
        
        // Title matching (higher weight)
        queryAnalysis.keywords.forEach(keyword => {
            if (title.includes(keyword.toLowerCase())) {
                relevance += this.config.boostFactors.titleMatch * 0.2;
            }
            if (content.includes(keyword.toLowerCase())) {
                relevance += 0.25;
            }
        });
        
        // Phrase matching
        queryAnalysis.phrases.forEach(phrase => {
            if (title.includes(phrase.toLowerCase())) {
                relevance += this.config.boostFactors.exactPhrase * 0.3;
            }
            if (content.includes(phrase.toLowerCase())) {
                relevance += this.config.boostFactors.exactPhrase * 0.2;
            }
        });
        
        // Type matching
        if (queryAnalysis.filters.artifactType && artifact.type !== queryAnalysis.filters.artifactType) {
            relevance *= 0.1;
        }
        
        // Shared artifacts get slight boost for cross-folio searches
        if (artifact.shared && !queryAnalysis.filters.folio) {
            relevance *= 1.1;
        }
        
        // Recency factor for artifacts
        if (this.config.temporalDecay.enabled) {
            const age = Date.now() - new Date(artifact.createdAt).getTime();
            const decayFactor = Math.exp(-age / (this.config.temporalDecay.halfLife * 2)); // Slower decay for artifacts
            const adjustedDecayFactor = Math.max(this.config.temporalDecay.maxDecay, decayFactor);
            relevance *= adjustedDecayFactor;
        }
        
        return Math.min(1, relevance);
    }
    
    _calculateSummaryRelevance(summary, queryAnalysis) {
        let relevance = 0;
        
        const content = summary.content.toLowerCase();
        
        // Keyword matching
        queryAnalysis.keywords.forEach(keyword => {
            if (content.includes(keyword.toLowerCase())) {
                relevance += 0.35; // Summaries get slightly higher base relevance
            }
        });
        
        // Phrase matching
        queryAnalysis.phrases.forEach(phrase => {
            if (content.includes(phrase.toLowerCase())) {
                relevance += this.config.boostFactors.exactPhrase * 0.25;
            }
        });
        
        // Summary type matching
        if (queryAnalysis.filters.summaryType && summary.type !== queryAnalysis.filters.summaryType) {
            relevance *= 0.1;
        }
        
        // Importance from metadata
        if (summary.metadata?.importance >= 4) {
            relevance *= this.config.boostFactors.highImportance;
        }
        
        // Recent summaries get a boost
        const age = Date.now() - new Date(summary.createdAt).getTime();
        if (age < 7 * 24 * 60 * 60 * 1000) { // Less than 7 days
            relevance *= this.config.boostFactors.recentContent;
        }
        
        return Math.min(1, relevance);
    }
    
    _combineAndRankResults(results, queryAnalysis) {
        const combined = []
            .concat(results.messages)
            .concat(results.artifacts)
            .concat(results.summaries);
        
        // Apply final ranking with type-specific boosts
        combined.forEach(result => {
            if (result.type === 'artifact' && queryAnalysis.filters.artifacts !== false) {
                result.relevance *= 1.1; // Slight boost for artifacts
            }
            if (result.type === 'summary' && queryAnalysis.isQuestion) {
                result.relevance *= 1.2; // Boost summaries for questions
            }
        });
        
        return combined.sort((a, b) => b.relevance - a.relevance);
    }
    
    _applyFiltersAndLimits(results, options) {
        let filtered = results;
        
        // Apply result type filters
        if (options.resultTypes) {
            filtered = filtered.filter(result => options.resultTypes.includes(result.type));
        }
        
        // Apply minimum relevance filter
        const minRelevance = options.minRelevance || this.config.minRelevanceScore;
        filtered = filtered.filter(result => result.relevance >= minRelevance);
        
        // Apply date range filter
        if (options.dateRange) {
            filtered = filtered.filter(result => {
                const date = new Date(result.timestamp);
                return date >= options.dateRange.start && date <= options.dateRange.end;
            });
        }
        
        // Apply folio filter (if not already applied)
        if (options.folioIds && Array.isArray(options.folioIds)) {
            filtered = filtered.filter(result => options.folioIds.includes(result.folioId));
        }
        
        // Apply result limit
        const maxResults = options.maxResults || this.config.maxResults;
        return filtered.slice(0, maxResults);
    }
    
    _generateHighlights(content, queryAnalysis) {
        const highlights = [];
        
        // Highlight keywords
        queryAnalysis.keywords.forEach(keyword => {
            const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
            const matches = content.match(regex);
            if (matches) {
                highlights.push(...matches);
            }
        });
        
        // Highlight phrases
        queryAnalysis.phrases.forEach(phrase => {
            const regex = new RegExp(phrase, 'gi');
            const matches = content.match(regex);
            if (matches) {
                highlights.push(...matches);
            }
        });
        
        return [...new Set(highlights)]; // Remove duplicates
    }
    
    _generateSearchSuggestions(queryAnalysis, results) {
        const suggestions = [];
        
        // Suggest related topics from results
        const topics = new Set();
        results.forEach(result => {
            if (result.type === 'message' && result.topics) {
                result.topics.forEach(topic => topics.add(topic));
            }
        });
        
        Array.from(topics).slice(0, 5).forEach(topic => {
            suggestions.push({
                type: 'related_topic',
                text: topic,
                suggestion: `Also search: ${topic}`
            });
        });
        
        // Suggest alternative semantic types
        if (queryAnalysis.semanticType) {
            const alternatives = ['query', 'task', 'summary', 'clarification']
                .filter(type => type !== queryAnalysis.semanticType);
            
            suggestions.push({
                type: 'semantic_alternative',
                text: `type:${alternatives[0]}`,
                suggestion: `Try searching ${alternatives[0]} messages`
            });
        }
        
        // Suggest folio-specific search if current search is global
        if (!queryAnalysis.filters.folio && results.length > 0) {
            const folioNames = [...new Set(results.map(r => r.folioTitle))];
            if (folioNames.length > 1) {
                suggestions.push({
                    type: 'folio_specific',
                    text: `folio:${folioNames[0].toLowerCase().replace(/\s+/g, '_')}`,
                    suggestion: `Search only in "${folioNames[0]}"`
                });
            }
        }
        
        return suggestions.slice(0, 10);
    }
    
    _findMessageById(messageId) {
        const folios = this.dataManager.getState('folios');
        
        for (const folio of Object.values(folios)) {
            if (folio.messages) {
                const message = folio.messages.find(msg => msg.id === messageId);
                if (message) return message;
            }
        }
        
        return null;
    }
    
    _indexMessage(message) {
        if (!message.content) return;
        
        const content = message.content.toLowerCase();
        const words = content.match(/\b\w{3,}\b/g) || [];
        
        // Index keywords
        words.forEach(word => {
            if (!this.indexes.keywords.has(word)) {
                this.indexes.keywords.set(word, []);
            }
            this.indexes.keywords.get(word).push(message.id);
        });
        
        // Index topics
        if (message.topics) {
            message.topics.forEach(topic => {
                if (!this.indexes.topics.has(topic)) {
                    this.indexes.topics.set(topic, []);
                }
                this.indexes.topics.get(topic).push(message.id);
            });
        }
        
        // Index entities
        if (message.entities) {
            Object.values(message.entities).flat().forEach(entity => {
                if (!this.indexes.entities.has(entity)) {
                    this.indexes.entities.set(entity, []);
                }
                this.indexes.entities.get(entity).push(message.id);
            });
        }
        
        // Index semantic type
        if (message.semanticType) {
            if (!this.indexes.semantic.has(message.semanticType)) {
                this.indexes.semantic.set(message.semanticType, []);
            }
            this.indexes.semantic.get(message.semanticType).push(message.id);
        }
    }
    
    _indexArtifact(artifact) {
        if (!artifact.content) return;
        
        const content = (artifact.title + ' ' + artifact.content).toLowerCase();
        const words = content.match(/\b\w{3,}\b/g) || [];
        
        // Index keywords with artifact prefix
        words.forEach(word => {
            const key = `artifact_${word}`;
            if (!this.indexes.keywords.has(key)) {
                this.indexes.keywords.set(key, []);
            }
            this.indexes.keywords.get(key).push(artifact.id);
        });
    }
    
    _indexSummaries(summaries) {
        const allSummaries = []
            .concat(summaries.daily || [])
            .concat(summaries.weekly || [])
            .concat(Object.values(summaries.threads || {}))
            .concat(summaries.topical || []);
        
        allSummaries.forEach(summary => {
            if (summary.content) {
                const content = summary.content.toLowerCase();
                const words = content.match(/\b\w{3,}\b/g) || [];
                
                words.forEach(word => {
                    const key = `summary_${word}`;
                    if (!this.indexes.keywords.has(key)) {
                        this.indexes.keywords.set(key, []);
                    }
                    this.indexes.keywords.get(key).push(summary.id);
                });
            }
        });
    }
    
    _clearIndexes() {
        this.indexes.keywords.clear();
        this.indexes.topics.clear();
        this.indexes.entities.clear();
        this.indexes.semantic.clear();
    }
    
    _generateSearchCacheKey(query, options) {
        return `${query}_${JSON.stringify(options)}`.replace(/\s+/g, '_').substring(0, 100);
    }
    
    _calculateCacheHitRate() {
        // This would need to be tracked over time in a real implementation
        return 0; // Placeholder
    }
}

// Export singleton
const searchEngine = new SearchEngine(
    window.dataManager,
    window.messageManager,
    window.contextManager,
    window.errorManager
);

// Make available globally
if (typeof window !== 'undefined') {
    window.searchEngine = searchEngine;
}

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = searchEngine;
}