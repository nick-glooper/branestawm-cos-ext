// Branestawm - Summarization Engine
// Progressive summarization system for intelligent context compression

class SummarizationEngine {
    constructor(dataManager, messageManager, errorManager) {
        this.dataManager = dataManager;
        this.messageManager = messageManager;
        this.errorManager = errorManager;
        
        // Summarization thresholds and parameters
        this.config = {
            dailySummaryThreshold: 20, // messages per day before daily summary
            weeklySummaryThreshold: 100, // messages per week before weekly summary
            threadSummaryThreshold: 10, // messages per thread before thread summary
            maxTokensPerSummary: 500, // maximum tokens for a summary
            minTokensForSummary: 100, // minimum tokens to warrant summarization
            compressionRatio: 0.3, // target compression ratio (30% of original)
            summaryUpdateInterval: 24 * 60 * 60 * 1000, // 24 hours in ms
        };
        
        // Summary types and their priorities
        this.summaryTypes = {
            THREAD: { priority: 1, maxAge: 7 * 24 * 60 * 60 * 1000 }, // 7 days
            DAILY: { priority: 2, maxAge: 30 * 24 * 60 * 60 * 1000 }, // 30 days
            WEEKLY: { priority: 3, maxAge: 90 * 24 * 60 * 60 * 1000 }, // 90 days
            TOPICAL: { priority: 4, maxAge: 60 * 24 * 60 * 60 * 1000 }, // 60 days
        };
        
        // Background processing state
        this.isProcessing = false;
        this.processingQueue = [];
        this.lastProcessingTime = null;
        
        console.log('SummarizationEngine initialized');
        
        // Start background processing
        this.startBackgroundProcessing();
    }
    
    /**
     * Generate summary for a specific set of messages
     */
    async generateSummary(messages, type = 'THREAD', options = {}) {
        try {
            if (!messages || messages.length === 0) {
                return null;
            }
            
            // Filter and prepare messages for summarization
            const preparedMessages = this._prepareMessagesForSummary(messages);
            
            // Check if summary is needed
            if (!this._shouldSummarize(preparedMessages, type)) {
                return null;
            }
            
            // Create summary prompt
            const summaryPrompt = this._buildSummaryPrompt(preparedMessages, type, options);
            
            // Generate summary using LLM
            const summaryContent = await this._generateSummaryWithLLM(summaryPrompt, options);
            
            // Create summary object
            const summary = {
                id: this._generateSummaryId(),
                type: type,
                content: summaryContent,
                messageIds: messages.map(msg => msg.id),
                threadIds: [...new Set(messages.map(msg => msg.threadId).filter(Boolean))],
                tokenCount: this._estimateTokenCount(summaryContent),
                originalTokenCount: messages.reduce((sum, msg) => sum + (msg.tokenCount || 0), 0),
                compressionRatio: this._calculateCompressionRatio(summaryContent, messages),
                createdAt: new Date().toISOString(),
                validUntil: this._calculateValidityDate(type),
                metadata: {
                    messageCount: messages.length,
                    timespan: this._calculateTimespan(messages),
                    topics: this._extractCommonTopics(messages),
                    importance: this._calculateAverageImportance(messages)
                }
            };
            
            console.log(`Generated ${type} summary:`, summary.id, `(${summary.compressionRatio}% compression)`);
            return summary;
            
        } catch (error) {
            if (this.errorManager) {
                this.errorManager.handleError(this.errorManager.createError('SUMMARIZATION_FAILED', {
                    operation: 'generateSummary',
                    type: type,
                    messageCount: messages.length,
                    error: error.message
                }));
            }
            throw error;
        }
    }
    
    /**
     * Update folio summaries based on new activity
     */
    async updateFolioSummaries(folioId) {
        try {
            const folio = this.dataManager.getState(`folios.${folioId}`);
            if (!folio) return false;
            
            // Initialize summaries structure if needed
            if (!folio.summaries) {
                await this.dataManager.updateState(`folios.${folioId}.summaries`, {
                    daily: [],
                    weekly: [],
                    topical: [],
                    threads: {}
                });
            }
            
            const messages = folio.messages || [];
            let updatedSummaries = false;
            
            // Generate thread summaries
            const threadSummaries = await this._generateThreadSummaries(messages, folioId);
            if (threadSummaries.length > 0) {
                await this._updateThreadSummaries(folioId, threadSummaries);
                updatedSummaries = true;
            }
            
            // Generate daily summaries
            const dailySummary = await this._generateDailySummary(messages, folioId);
            if (dailySummary) {
                await this._addDailySummary(folioId, dailySummary);
                updatedSummaries = true;
            }
            
            // Generate weekly summaries
            const weeklySummary = await this._generateWeeklySummary(messages, folioId);
            if (weeklySummary) {
                await this._addWeeklySummary(folioId, weeklySummary);
                updatedSummaries = true;
            }
            
            // Generate topical summaries
            const topicalSummaries = await this._generateTopicalSummaries(messages, folioId);
            if (topicalSummaries.length > 0) {
                await this._addTopicalSummaries(folioId, topicalSummaries);
                updatedSummaries = true;
            }
            
            if (updatedSummaries) {
                await this._cleanupOldSummaries(folioId);
                console.log(`Updated summaries for folio: ${folio.title}`);
            }
            
            return updatedSummaries;
            
        } catch (error) {
            console.error('Error updating folio summaries:', error);
            return false;
        }
    }
    
    /**
     * Get optimal context for LLM with summaries
     */
    async getOptimalContext(folioId, currentMessage, maxTokens = 4000) {
        try {
            const folio = this.dataManager.getState(`folios.${folioId}`);
            if (!folio) return { messages: [], summaries: [], tokenCount: 0 };
            
            const messages = folio.messages || [];
            const summaries = folio.summaries || {};
            
            // Build context with intelligent selection
            const context = {
                messages: [],
                summaries: [],
                tokenCount: 0,
                compressionAchieved: false
            };
            
            // Reserve tokens for current message and response
            const reservedTokens = 1000;
            const availableTokens = maxTokens - reservedTokens;
            
            // Get recent messages (always include some recent context)
            const recentMessages = messages.slice(-5);
            const recentTokenCount = recentMessages.reduce((sum, msg) => sum + (msg.tokenCount || 0), 0);
            
            if (recentTokenCount <= availableTokens) {
                context.messages = recentMessages;
                context.tokenCount += recentTokenCount;
                
                const remainingTokens = availableTokens - recentTokenCount;
                
                // Fill remaining space with summaries and older relevant messages
                await this._addSummariesToContext(context, summaries, remainingTokens / 2);
                await this._addRelevantHistoryToContext(context, messages, currentMessage, remainingTokens / 2);
                
                context.compressionAchieved = context.tokenCount < (messages.length * 100); // rough estimate
            } else {
                // Recent messages too long, use summaries more aggressively
                context.messages = messages.slice(-2); // Just last 2 messages
                context.tokenCount += recentMessages.slice(-2).reduce((sum, msg) => sum + (msg.tokenCount || 0), 0);
                
                const remainingTokens = availableTokens - context.tokenCount;
                await this._addSummariesToContext(context, summaries, remainingTokens);
                context.compressionAchieved = true;
            }
            
            console.log(`Context optimized: ${context.messages.length} messages, ${context.summaries.length} summaries, ${context.tokenCount} tokens`);
            return context;
            
        } catch (error) {
            console.error('Error getting optimal context:', error);
            return { messages: messages.slice(-10), summaries: [], tokenCount: 0 }; // fallback
        }
    }
    
    /**
     * Start background summarization processing
     */
    startBackgroundProcessing() {
        // Process every 30 minutes
        setInterval(async () => {
            if (!this.isProcessing) {
                await this.processBackgroundSummarization();
            }
        }, 30 * 60 * 1000);
        
        // Also process on page visibility change
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && !this.isProcessing) {
                setTimeout(() => this.processBackgroundSummarization(), 5000);
            }
        });
    }
    
    /**
     * Process background summarization for all folios
     */
    async processBackgroundSummarization() {
        if (this.isProcessing) return;
        
        this.isProcessing = true;
        const startTime = Date.now();
        
        try {
            const allFolios = this.dataManager.getState('folios');
            let processedCount = 0;
            
            for (const [folioId, folio] of Object.entries(allFolios)) {
                // Skip if folio hasn't been active recently
                const lastActivity = new Date(folio.lastUsed || folio.createdAt);
                const daysSinceActivity = (Date.now() - lastActivity.getTime()) / (24 * 60 * 60 * 1000);
                
                if (daysSinceActivity > 7) continue; // Skip folios inactive for >7 days
                
                // Check if summarization is needed
                if (await this._needsSummarization(folioId)) {
                    await this.updateFolioSummaries(folioId);
                    processedCount++;
                    
                    // Limit processing time to avoid blocking
                    if (Date.now() - startTime > 30000) { // 30 seconds max
                        break;
                    }
                }
            }
            
            if (processedCount > 0) {
                console.log(`Background summarization: processed ${processedCount} folios`);
            }
            
            this.lastProcessingTime = Date.now();
            
        } catch (error) {
            console.error('Background summarization error:', error);
        } finally {
            this.isProcessing = false;
        }
    }
    
    /**
     * Get summarization statistics
     */
    getSummarizationStats(folioId = null) {
        try {
            if (folioId) {
                return this._getFolioSummarizationStats(folioId);
            } else {
                return this._getAllSummarizationStats();
            }
        } catch (error) {
            console.error('Error getting summarization stats:', error);
            return null;
        }
    }
    
    /**
     * Private helper methods
     */
    
    _generateSummaryId() {
        return 'summary_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    _prepareMessagesForSummary(messages) {
        return messages
            .filter(msg => msg.role !== 'system') // Exclude system messages
            .filter(msg => (msg.tokenCount || 0) >= 10) // Exclude very short messages
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }
    
    _shouldSummarize(messages, type) {
        const totalTokens = messages.reduce((sum, msg) => sum + (msg.tokenCount || 0), 0);
        
        if (totalTokens < this.config.minTokensForSummary) return false;
        
        switch (type) {
            case 'THREAD':
                return messages.length >= this.config.threadSummaryThreshold;
            case 'DAILY':
                return messages.length >= this.config.dailySummaryThreshold;
            case 'WEEKLY':
                return messages.length >= this.config.weeklySummaryThreshold;
            default:
                return messages.length >= 5; // minimum for any summary
        }
    }
    
    _buildSummaryPrompt(messages, type, options) {
        const messagesText = messages.map(msg => 
            `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
        ).join('\n\n');
        
        const prompts = {
            THREAD: `Summarize this conversation thread, capturing the key points, decisions, and outcomes:\n\n${messagesText}\n\nProvide a concise summary that preserves the essential information and context.`,
            
            DAILY: `Summarize today's conversation activity, highlighting important topics, tasks, and insights:\n\n${messagesText}\n\nCreate a daily summary that captures the main themes and significant exchanges.`,
            
            WEEKLY: `Create a weekly summary of conversations, focusing on major developments, recurring themes, and important outcomes:\n\n${messagesText}\n\nProvide a comprehensive weekly overview that identifies patterns and key insights.`,
            
            TOPICAL: `Summarize conversations related to the topic "${options.topic || 'general'}", extracting key insights and relevant information:\n\n${messagesText}\n\nFocus on topic-specific information and related discussions.`
        };
        
        return prompts[type] || prompts.THREAD;
    }
    
    async _generateSummaryWithLLM(prompt, options = {}) {
        try {
            // Use the existing LLM API system
            const messages = [
                { 
                    role: 'system', 
                    content: 'You are an expert at creating concise, informative summaries. Focus on key information, decisions, and outcomes. Use clear, structured language.' 
                },
                { role: 'user', content: prompt }
            ];
            
            // Use the hybrid LLM system if available
            if (typeof getHybridLLMResponse === 'function') {
                return await getHybridLLMResponse(messages, prompt);
            } else if (typeof callLLMAPI === 'function') {
                return await callLLMAPI(messages);
            } else {
                throw new Error('No LLM API available for summarization');
            }
            
        } catch (error) {
            console.error('LLM summarization error:', error);
            // Fallback to extractive summary
            return this._generateExtractiveSummary(prompt);
        }
    }
    
    _generateExtractiveSummary(messagesText) {
        // Simple extractive summarization as fallback
        const sentences = messagesText.split(/[.!?]+/).filter(s => s.trim().length > 20);
        const topSentences = sentences
            .sort((a, b) => b.length - a.length) // Prefer longer sentences
            .slice(0, 3); // Take top 3
        
        return topSentences.join('. ') + '.';
    }
    
    _estimateTokenCount(text) {
        return Math.ceil(text.length / 4);
    }
    
    _calculateCompressionRatio(summaryText, originalMessages) {
        const summaryTokens = this._estimateTokenCount(summaryText);
        const originalTokens = originalMessages.reduce((sum, msg) => sum + (msg.tokenCount || 0), 0);
        return originalTokens > 0 ? Math.round((summaryTokens / originalTokens) * 100) : 0;
    }
    
    _calculateValidityDate(type) {
        const maxAge = this.summaryTypes[type]?.maxAge || (7 * 24 * 60 * 60 * 1000);
        return new Date(Date.now() + maxAge).toISOString();
    }
    
    _calculateTimespan(messages) {
        if (messages.length === 0) return 0;
        const earliest = new Date(messages[0].timestamp);
        const latest = new Date(messages[messages.length - 1].timestamp);
        return latest.getTime() - earliest.getTime();
    }
    
    _extractCommonTopics(messages) {
        const allTopics = messages.flatMap(msg => msg.topics || []);
        const topicCounts = {};
        
        allTopics.forEach(topic => {
            topicCounts[topic] = (topicCounts[topic] || 0) + 1;
        });
        
        return Object.entries(topicCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([topic]) => topic);
    }
    
    _calculateAverageImportance(messages) {
        const importanceValues = messages.map(msg => msg.importance || 1);
        return importanceValues.reduce((sum, imp) => sum + imp, 0) / importanceValues.length;
    }
    
    async _generateThreadSummaries(messages, folioId) {
        const threadGroups = {};
        
        // Group messages by thread
        messages.forEach(msg => {
            if (msg.threadId) {
                if (!threadGroups[msg.threadId]) {
                    threadGroups[msg.threadId] = [];
                }
                threadGroups[msg.threadId].push(msg);
            }
        });
        
        const summaries = [];
        
        for (const [threadId, threadMessages] of Object.entries(threadGroups)) {
            if (threadMessages.length >= this.config.threadSummaryThreshold) {
                const summary = await this.generateSummary(threadMessages, 'THREAD', { threadId });
                if (summary) {
                    summaries.push(summary);
                }
            }
        }
        
        return summaries;
    }
    
    async _generateDailySummary(messages, folioId) {
        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        
        const todayMessages = messages.filter(msg => {
            const msgDate = new Date(msg.timestamp);
            return msgDate >= todayStart;
        });
        
        if (todayMessages.length >= this.config.dailySummaryThreshold) {
            return await this.generateSummary(todayMessages, 'DAILY', { date: todayStart.toISOString() });
        }
        
        return null;
    }
    
    async _generateWeeklySummary(messages, folioId) {
        const today = new Date();
        const weekStart = new Date(today.getTime() - (7 * 24 * 60 * 60 * 1000));
        
        const weekMessages = messages.filter(msg => {
            const msgDate = new Date(msg.timestamp);
            return msgDate >= weekStart;
        });
        
        if (weekMessages.length >= this.config.weeklySummaryThreshold) {
            return await this.generateSummary(weekMessages, 'WEEKLY', { weekStart: weekStart.toISOString() });
        }
        
        return null;
    }
    
    async _generateTopicalSummaries(messages, folioId) {
        // Group messages by common topics
        const topicGroups = {};
        
        messages.forEach(msg => {
            if (msg.topics) {
                msg.topics.forEach(topic => {
                    if (!topicGroups[topic]) {
                        topicGroups[topic] = [];
                    }
                    topicGroups[topic].push(msg);
                });
            }
        });
        
        const summaries = [];
        
        for (const [topic, topicMessages] of Object.entries(topicGroups)) {
            if (topicMessages.length >= 5) { // Minimum messages for topical summary
                const summary = await this.generateSummary(topicMessages, 'TOPICAL', { topic });
                if (summary) {
                    summaries.push(summary);
                }
            }
        }
        
        return summaries;
    }
    
    async _addSummariesToContext(context, summaries, maxTokens) {
        // Add most relevant and recent summaries within token limit
        const relevantSummaries = []
            .concat(summaries.daily || [])
            .concat(summaries.weekly || [])
            .concat(Object.values(summaries.threads || {}))
            .concat(summaries.topical || [])
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .filter(summary => new Date(summary.validUntil) > new Date());
        
        let usedTokens = 0;
        
        for (const summary of relevantSummaries) {
            if (usedTokens + summary.tokenCount <= maxTokens) {
                context.summaries.push(summary);
                usedTokens += summary.tokenCount;
                context.tokenCount += summary.tokenCount;
            } else {
                break;
            }
        }
    }
    
    async _addRelevantHistoryToContext(context, allMessages, currentMessage, maxTokens) {
        // Add older messages that are relevant to current context
        const excludeIds = new Set(context.messages.map(msg => msg.id));
        const relevantMessages = allMessages
            .filter(msg => !excludeIds.has(msg.id))
            .filter(msg => msg.importance >= 3) // Only important messages
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 10); // Limit to prevent excessive processing
        
        let usedTokens = 0;
        
        for (const msg of relevantMessages) {
            if (usedTokens + (msg.tokenCount || 0) <= maxTokens) {
                context.messages.push(msg);
                usedTokens += msg.tokenCount || 0;
                context.tokenCount += msg.tokenCount || 0;
            } else {
                break;
            }
        }
        
        // Sort messages chronologically
        context.messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }
    
    async _needsSummarization(folioId) {
        const folio = this.dataManager.getState(`folios.${folioId}`);
        if (!folio || !folio.messages) return false;
        
        const messages = folio.messages;
        const summaries = folio.summaries || {};
        
        // Check if we have enough new messages since last summarization
        const lastSummaryTime = this._getLastSummaryTime(summaries);
        const newMessages = messages.filter(msg => 
            new Date(msg.timestamp) > new Date(lastSummaryTime)
        );
        
        return newMessages.length >= this.config.threadSummaryThreshold;
    }
    
    _getLastSummaryTime(summaries) {
        const allSummaries = []
            .concat(summaries.daily || [])
            .concat(summaries.weekly || [])
            .concat(Object.values(summaries.threads || {}))
            .concat(summaries.topical || []);
        
        if (allSummaries.length === 0) {
            return new Date(0).toISOString(); // Very old date
        }
        
        return allSummaries
            .map(s => new Date(s.createdAt))
            .sort((a, b) => b - a)[0]
            .toISOString();
    }
    
    async _cleanupOldSummaries(folioId) {
        const folio = this.dataManager.getState(`folios.${folioId}`);
        const summaries = folio.summaries || {};
        
        const now = new Date();
        let cleaned = false;
        
        // Clean up expired summaries
        for (const [type, summaryList] of Object.entries(summaries)) {
            if (Array.isArray(summaryList)) {
                const validSummaries = summaryList.filter(summary => 
                    new Date(summary.validUntil) > now
                );
                
                if (validSummaries.length !== summaryList.length) {
                    await this.dataManager.updateState(`folios.${folioId}.summaries.${type}`, validSummaries);
                    cleaned = true;
                }
            }
        }
        
        if (cleaned) {
            console.log(`Cleaned up expired summaries for folio: ${folioId}`);
        }
    }
    
    _getFolioSummarizationStats(folioId) {
        const folio = this.dataManager.getState(`folios.${folioId}`);
        if (!folio) return null;
        
        const messages = folio.messages || [];
        const summaries = folio.summaries || {};
        
        const allSummaries = []
            .concat(summaries.daily || [])
            .concat(summaries.weekly || [])
            .concat(Object.values(summaries.threads || {}))
            .concat(summaries.topical || []);
        
        const totalOriginalTokens = messages.reduce((sum, msg) => sum + (msg.tokenCount || 0), 0);
        const totalSummaryTokens = allSummaries.reduce((sum, summary) => sum + summary.tokenCount, 0);
        
        return {
            folioId: folioId,
            messageCount: messages.length,
            summaryCount: allSummaries.length,
            originalTokens: totalOriginalTokens,
            summaryTokens: totalSummaryTokens,
            overallCompression: totalOriginalTokens > 0 ? 
                Math.round((totalSummaryTokens / totalOriginalTokens) * 100) : 0,
            summaryTypes: {
                daily: summaries.daily?.length || 0,
                weekly: summaries.weekly?.length || 0,
                threads: Object.keys(summaries.threads || {}).length,
                topical: summaries.topical?.length || 0
            }
        };
    }
    
    _getAllSummarizationStats() {
        const allFolios = this.dataManager.getState('folios');
        const stats = {
            totalFolios: 0,
            totalMessages: 0,
            totalSummaries: 0,
            totalOriginalTokens: 0,
            totalSummaryTokens: 0,
            folioStats: {}
        };
        
        for (const [folioId, folio] of Object.entries(allFolios)) {
            const folioStats = this._getFolioSummarizationStats(folioId);
            if (folioStats) {
                stats.totalFolios++;
                stats.totalMessages += folioStats.messageCount;
                stats.totalSummaries += folioStats.summaryCount;
                stats.totalOriginalTokens += folioStats.originalTokens;
                stats.totalSummaryTokens += folioStats.summaryTokens;
                stats.folioStats[folioId] = folioStats;
            }
        }
        
        stats.overallCompression = stats.totalOriginalTokens > 0 ? 
            Math.round((stats.totalSummaryTokens / stats.totalOriginalTokens) * 100) : 0;
        
        return stats;
    }
    
    // Utility methods for external access
    async updateThreadSummaries(folioId, threadSummaries) {
        return await this._updateThreadSummaries(folioId, threadSummaries);
    }
    
    async _updateThreadSummaries(folioId, threadSummaries) {
        const folio = this.dataManager.getState(`folios.${folioId}`);
        const existingThreads = folio.summaries?.threads || {};
        
        threadSummaries.forEach(summary => {
            const threadId = summary.threadIds[0]; // Use first thread ID
            if (threadId) {
                existingThreads[threadId] = summary;
            }
        });
        
        await this.dataManager.updateState(`folios.${folioId}.summaries.threads`, existingThreads);
    }
    
    async _addDailySummary(folioId, summary) {
        const folio = this.dataManager.getState(`folios.${folioId}`);
        const dailySummaries = folio.summaries?.daily || [];
        
        // Remove any existing summary for the same date
        const date = summary.metadata?.date || new Date().toISOString();
        const filtered = dailySummaries.filter(s => s.metadata?.date !== date);
        
        filtered.push(summary);
        await this.dataManager.updateState(`folios.${folioId}.summaries.daily`, filtered);
    }
    
    async _addWeeklySummary(folioId, summary) {
        const folio = this.dataManager.getState(`folios.${folioId}`);
        const weeklySummaries = folio.summaries?.weekly || [];
        
        weeklySummaries.push(summary);
        
        // Keep only last 12 weeks
        const recent = weeklySummaries.slice(-12);
        await this.dataManager.updateState(`folios.${folioId}.summaries.weekly`, recent);
    }
    
    async _addTopicalSummaries(folioId, summaries) {
        const folio = this.dataManager.getState(`folios.${folioId}`);
        const topicalSummaries = folio.summaries?.topical || [];
        
        summaries.forEach(summary => {
            // Remove existing summary for same topic
            const topic = summary.metadata?.topic;
            if (topic) {
                const filtered = topicalSummaries.filter(s => s.metadata?.topic !== topic);
                filtered.push(summary);
                topicalSummaries.length = 0;
                topicalSummaries.push(...filtered);
            } else {
                topicalSummaries.push(summary);
            }
        });
        
        // Keep only most recent 20 topical summaries
        const recent = topicalSummaries.slice(-20);
        await this.dataManager.updateState(`folios.${folioId}.summaries.topical`, recent);
    }
}

// Export singleton
const summarizationEngine = new SummarizationEngine(
    window.dataManager, 
    window.messageManager, 
    window.errorManager
);

// Make available globally
if (typeof window !== 'undefined') {
    window.summarizationEngine = summarizationEngine;
}

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = summarizationEngine;
}