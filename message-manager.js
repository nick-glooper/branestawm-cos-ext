// Branestawm - Message Manager
// Enhanced message structure with hierarchical organization, threading, and semantic analysis

class MessageManager {
    constructor(dataManager, errorManager) {
        this.dataManager = dataManager;
        this.errorManager = errorManager;
        
        // Message schema version for migrations
        this.currentSchemaVersion = 2;
        
        // Semantic type patterns
        this.semanticPatterns = {
            query: [
                /^(what|how|when|where|why|which|who)\s/i,
                /\?$/,
                /^(can you|could you|would you|please)/i,
                /^(help me|assist me|show me)/i
            ],
            task: [
                /^(create|make|build|generate|write|draft)/i,
                /^(calculate|compute|analyze|process)/i,
                /^(find|search|look up|get)/i,
                /^(do|complete|finish|execute)/i
            ],
            clarification: [
                /^(i mean|what i meant|to clarify|let me explain)/i,
                /^(actually|correction|sorry)/i,
                /^(in other words|specifically)/i
            ],
            response: [
                // AI responses are typically identified by role: 'assistant'
            ],
            summary: [
                /^(in summary|to summarize|overall)/i,
                /^(the main points|key takeaways)/i,
                /^(conclusion|final thoughts)/i
            ]
        };
        
        // Importance keywords for scoring
        this.importanceKeywords = {
            high: ['urgent', 'critical', 'important', 'priority', 'deadline', 'asap', 'immediately'],
            medium: ['significant', 'notable', 'relevant', 'useful', 'helpful'],
            contextual: ['example', 'instance', 'case', 'scenario', 'situation']
        };
        
        console.log('MessageManager initialized');
    }
    
    /**
     * Create enhanced message with hierarchical structure
     */
    createMessage(content, role, options = {}) {
        const baseMessage = {
            id: this._generateMessageId(),
            role: role,
            content: content,
            timestamp: new Date().toISOString(),
            schemaVersion: this.currentSchemaVersion
        };
        
        // Enhanced properties
        const enhancedMessage = {
            ...baseMessage,
            
            // Threading support
            threadId: options.threadId || this._generateThreadId(),
            parentId: options.parentId || null,
            conversationDepth: options.conversationDepth || 0,
            
            // Semantic analysis
            semanticType: this._analyzeSemanticType(content, role),
            topics: this._extractTopics(content),
            entities: this._extractEntities(content),
            
            // Importance and relevance
            importance: this._calculateImportance(content, options),
            contextRelevance: 1.0, // Will be calculated based on conversation flow
            
            // Token and content management
            tokenCount: this._estimateTokenCount(content),
            contentHash: this._generateContentHash(content),
            
            // Processing metadata
            processed: false,
            summarized: false,
            indexed: false,
            
            // Relationships
            references: options.references || [], // IDs of referenced messages/artifacts
            mentions: this._extractMentions(content),
            
            // Additional context
            folioId: options.folioId,
            sessionId: options.sessionId || this._getCurrentSessionId(),
            
            // Performance tracking
            processingTime: 0,
            compressionRatio: 1.0
        };
        
        return enhancedMessage;
    }
    
    /**
     * Add message to folio with proper threading
     */
    async addMessageToFolio(folioId, role, content, options = {}) {
        try {
            const folio = this.dataManager.getState(`folios.${folioId}`);
            if (!folio) {
                throw new Error(`Folio ${folioId} not found`);
            }
            
            // Determine threading context
            const threadingOptions = await this._determineThreadingContext(folio, options);
            
            // Create enhanced message
            const message = this.createMessage(content, role, {
                ...options,
                ...threadingOptions,
                folioId: folioId
            });
            
            // Add to folio's message structure
            const updatedMessages = await this._addToMessageStructure(folio.messages, message);
            
            // Update folio
            await this.dataManager.updateState(`folios.${folioId}.messages`, updatedMessages);
            await this.dataManager.updateState(`folios.${folioId}.lastUsed`, new Date().toISOString());
            
            // Update conversation metadata
            await this._updateConversationMetadata(folioId, message);
            
            console.log(`Message added to folio ${folioId}:`, message.id);
            return message;
            
        } catch (error) {
            if (this.errorManager) {
                this.errorManager.handleError(this.errorManager.createError('DATA_VALIDATION_FAILED', {
                    operation: 'addMessageToFolio',
                    folioId: folioId,
                    role: role,
                    error: error.message
                }));
            }
            throw error;
        }
    }
    
    /**
     * Get conversation thread
     */
    getConversationThread(folioId, threadId) {
        const folio = this.dataManager.getState(`folios.${folioId}`);
        if (!folio) return [];
        
        return folio.messages
            .filter(msg => msg.threadId === threadId)
            .sort((a, b) => a.conversationDepth - b.conversationDepth);
    }
    
    /**
     * Get message with context
     */
    getMessageWithContext(folioId, messageId, contextSize = 5) {
        const folio = this.dataManager.getState(`folios.${folioId}`);
        if (!folio) return null;
        
        const messageIndex = folio.messages.findIndex(msg => msg.id === messageId);
        if (messageIndex === -1) return null;
        
        const startIndex = Math.max(0, messageIndex - contextSize);
        const endIndex = Math.min(folio.messages.length, messageIndex + contextSize + 1);
        
        return {
            message: folio.messages[messageIndex],
            context: folio.messages.slice(startIndex, endIndex),
            position: messageIndex,
            totalMessages: folio.messages.length
        };
    }
    
    /**
     * Migrate existing messages to enhanced structure
     */
    async migrateMessagesToEnhancedStructure(folioId) {
        try {
            const folio = this.dataManager.getState(`folios.${folioId}`);
            if (!folio) return false;
            
            const migratedMessages = [];
            let currentThreadId = this._generateThreadId();
            
            for (let i = 0; i < folio.messages.length; i++) {
                const oldMessage = folio.messages[i];
                
                // Skip if already migrated
                if (oldMessage.schemaVersion >= this.currentSchemaVersion) {
                    migratedMessages.push(oldMessage);
                    continue;
                }
                
                // Determine if this starts a new thread (simple heuristic)
                const isNewThread = this._shouldStartNewThread(oldMessage, folio.messages[i - 1]);
                if (isNewThread) {
                    currentThreadId = this._generateThreadId();
                }
                
                // Create enhanced version of existing message
                const enhancedMessage = {
                    ...oldMessage,
                    schemaVersion: this.currentSchemaVersion,
                    threadId: currentThreadId,
                    parentId: i > 0 && !isNewThread ? folio.messages[i - 1].id : null,
                    conversationDepth: this._calculateDepthInThread(migratedMessages, currentThreadId),
                    semanticType: this._analyzeSemanticType(oldMessage.content, oldMessage.role),
                    topics: this._extractTopics(oldMessage.content),
                    entities: this._extractEntities(oldMessage.content),
                    importance: this._calculateImportance(oldMessage.content),
                    contextRelevance: 1.0,
                    tokenCount: this._estimateTokenCount(oldMessage.content),
                    contentHash: this._generateContentHash(oldMessage.content),
                    processed: true,
                    summarized: false,
                    indexed: false,
                    references: [],
                    mentions: this._extractMentions(oldMessage.content),
                    folioId: folioId,
                    sessionId: this._getCurrentSessionId(),
                    processingTime: 0,
                    compressionRatio: 1.0
                };
                
                migratedMessages.push(enhancedMessage);
            }
            
            // Update folio with migrated messages
            await this.dataManager.updateState(`folios.${folioId}.messages`, migratedMessages);
            
            console.log(`Migrated ${migratedMessages.length} messages in folio ${folioId}`);
            return true;
            
        } catch (error) {
            console.error('Error migrating messages:', error);
            return false;
        }
    }
    
    /**
     * Get message statistics for analytics
     */
    getMessageStatistics(folioId) {
        const folio = this.dataManager.getState(`folios.${folioId}`);
        if (!folio) return null;
        
        const messages = folio.messages || [];
        const threads = [...new Set(messages.map(m => m.threadId))];
        
        const semanticTypes = {};
        const importanceLevels = { high: 0, medium: 0, low: 0 };
        let totalTokens = 0;
        
        messages.forEach(msg => {
            // Semantic type distribution
            const type = msg.semanticType || 'unknown';
            semanticTypes[type] = (semanticTypes[type] || 0) + 1;
            
            // Importance distribution
            const importance = msg.importance || 1;
            if (importance >= 4) importanceLevels.high++;
            else if (importance >= 2.5) importanceLevels.medium++;
            else importanceLevels.low++;
            
            // Token counting
            totalTokens += msg.tokenCount || 0;
        });
        
        return {
            totalMessages: messages.length,
            totalThreads: threads.length,
            averageMessagesPerThread: messages.length / Math.max(threads.length, 1),
            semanticTypeDistribution: semanticTypes,
            importanceDistribution: importanceLevels,
            totalTokens: totalTokens,
            averageTokensPerMessage: totalTokens / Math.max(messages.length, 1),
            schemaVersion: this.currentSchemaVersion,
            migrationNeeded: messages.some(m => !m.schemaVersion || m.schemaVersion < this.currentSchemaVersion)
        };
    }
    
    /**
     * Private helper methods
     */
    
    _generateMessageId() {
        return 'msg_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    _generateThreadId() {
        return 'thread_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    _getCurrentSessionId() {
        // Simple session ID based on page load time
        return 'session_' + (window.sessionStartTime || Date.now()).toString(36);
    }
    
    _analyzeSemanticType(content, role) {
        if (role === 'system') return 'system';
        if (role === 'assistant') return 'response';
        
        // Check patterns for user messages
        for (const [type, patterns] of Object.entries(this.semanticPatterns)) {
            for (const pattern of patterns) {
                if (pattern.test(content)) {
                    return type;
                }
            }
        }
        
        return 'query'; // Default for user messages
    }
    
    _extractTopics(content) {
        // Simple keyword extraction (can be enhanced with NLP)
        const words = content.toLowerCase().match(/\b\w{4,}\b/g) || [];
        const topicCandidates = words.filter(word => 
            !['this', 'that', 'with', 'have', 'been', 'they', 'them', 'will', 'from'].includes(word)
        );
        
        // Count frequency and return top topics
        const frequency = {};
        topicCandidates.forEach(word => {
            frequency[word] = (frequency[word] || 0) + 1;
        });
        
        return Object.entries(frequency)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([word]) => word);
    }
    
    _extractEntities(content) {
        // Simple entity extraction (names, dates, etc.)
        const entities = {
            dates: content.match(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g) || [],
            emails: content.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g) || [],
            urls: content.match(/https?:\/\/[^\s]+/g) || [],
            mentions: content.match(/@\w+/g) || []
        };
        
        return entities;
    }
    
    _extractMentions(content) {
        // Extract @mentions and references
        const mentions = [];
        const atMentions = content.match(/@\w+/g) || [];
        mentions.push(...atMentions);
        
        return mentions;
    }
    
    _calculateImportance(content, options = {}) {
        let importance = 1.0; // Base importance
        
        // Check for high importance keywords
        const highImportanceWords = this.importanceKeywords.high.filter(word => 
            content.toLowerCase().includes(word)
        );
        importance += highImportanceWords.length * 1.5;
        
        // Check for medium importance keywords
        const mediumImportanceWords = this.importanceKeywords.medium.filter(word => 
            content.toLowerCase().includes(word)
        );
        importance += mediumImportanceWords.length * 0.5;
        
        // Length factor (longer messages might be more important)
        if (content.length > 500) importance += 0.5;
        if (content.length > 1000) importance += 0.5;
        
        // Question marks suggest queries (potentially important)
        const questionMarks = (content.match(/\?/g) || []).length;
        importance += questionMarks * 0.3;
        
        // External context importance
        if (options.userMarkedImportant) importance += 2.0;
        if (options.isFollowUp) importance += 0.5;
        
        return Math.min(5.0, importance); // Cap at 5.0
    }
    
    _estimateTokenCount(content) {
        // Rough token estimation: ~4 characters per token
        return Math.ceil(content.length / 4);
    }
    
    _generateContentHash(content) {
        // Simple hash for content deduplication
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString(36);
    }
    
    async _determineThreadingContext(folio, options) {
        const messages = folio.messages || [];
        
        if (options.threadId) {
            return { threadId: options.threadId };
        }
        
        // If no messages, start new thread
        if (messages.length === 0) {
            return { threadId: this._generateThreadId(), conversationDepth: 0 };
        }
        
        // Get last message to determine if we should continue thread or start new one
        const lastMessage = messages[messages.length - 1];
        const shouldStartNewThread = options.startNewThread || 
            this._shouldStartNewThread(null, lastMessage);
        
        if (shouldStartNewThread) {
            return { threadId: this._generateThreadId(), conversationDepth: 0 };
        } else {
            return { 
                threadId: lastMessage.threadId, 
                parentId: lastMessage.id,
                conversationDepth: (lastMessage.conversationDepth || 0) + 1
            };
        }
    }
    
    _shouldStartNewThread(currentMessage, previousMessage) {
        if (!previousMessage) return true;
        
        // Start new thread if there's a significant time gap
        const timeDiff = currentMessage ? 
            new Date(currentMessage.timestamp) - new Date(previousMessage.timestamp) :
            Date.now() - new Date(previousMessage.timestamp);
        
        if (timeDiff > 30 * 60 * 1000) return true; // 30 minutes
        
        // Start new thread if topic seems to change significantly
        if (currentMessage && previousMessage.topics) {
            const currentTopics = this._extractTopics(currentMessage.content);
            const commonTopics = currentTopics.filter(topic => 
                previousMessage.topics.includes(topic)
            );
            if (commonTopics.length / Math.max(currentTopics.length, 1) < 0.3) {
                return true;
            }
        }
        
        return false;
    }
    
    async _addToMessageStructure(existingMessages, newMessage) {
        const updated = [...existingMessages, newMessage];
        
        // Update context relevance for nearby messages
        await this._updateContextRelevance(updated, newMessage);
        
        return updated;
    }
    
    async _updateContextRelevance(messages, newMessage) {
        // Update relevance scores based on thread relationship and topic similarity
        const messageIndex = messages.length - 1;
        
        for (let i = Math.max(0, messageIndex - 10); i < messageIndex; i++) {
            const msg = messages[i];
            if (msg.threadId === newMessage.threadId) {
                msg.contextRelevance = Math.min(1.0, msg.contextRelevance + 0.2);
            }
            
            // Topic similarity boost
            const commonTopics = (msg.topics || []).filter(topic => 
                (newMessage.topics || []).includes(topic)
            );
            if (commonTopics.length > 0) {
                msg.contextRelevance = Math.min(1.0, msg.contextRelevance + 0.1);
            }
        }
    }
    
    async _updateConversationMetadata(folioId, message) {
        // Update folio-level metadata based on new message
        const folio = this.dataManager.getState(`folios.${folioId}`);
        if (!folio.metadata) {
            await this.dataManager.updateState(`folios.${folioId}.metadata`, {});
        }
        
        const updates = {
            [`folios.${folioId}.metadata.lastMessageId`]: message.id,
            [`folios.${folioId}.metadata.lastMessageType`]: message.semanticType,
            [`folios.${folioId}.metadata.messageCount`]: (folio.messages || []).length,
            [`folios.${folioId}.metadata.lastActivity`]: message.timestamp
        };
        
        for (const [path, value] of Object.entries(updates)) {
            await this.dataManager.updateState(path, value);
        }
    }
    
    _calculateDepthInThread(messages, threadId) {
        const threadMessages = messages.filter(msg => msg.threadId === threadId);
        return threadMessages.length;
    }
}

// Export singleton
const messageManager = new MessageManager(window.dataManager, window.errorManager);

// Make available globally
if (typeof window !== 'undefined') {
    window.messageManager = messageManager;
}

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = messageManager;
}