// Branestawm - Background Processor
// High-performance background processing system with Web Workers and task queuing

class BackgroundProcessor {
    constructor() {
        if (BackgroundProcessor.instance) {
            return BackgroundProcessor.instance;
        }
        
        this.workers = new Map();
        this.taskQueue = [];
        this.activeTasks = new Map();
        this.taskResults = new Map();
        this.workerPool = [];
        this.maxWorkers = Math.min(4, navigator.hardwareConcurrency || 2);
        this.taskIdCounter = 0;
        
        this.initializeWorkerPool();
        this.setupPerformanceMonitoring();
        
        BackgroundProcessor.instance = this;
        console.log(`BackgroundProcessor initialized with ${this.maxWorkers} workers`);
    }
    
    /**
     * Initialize Web Worker pool for background processing
     */
    initializeWorkerPool() {
        try {
            // Create worker pool
            for (let i = 0; i < this.maxWorkers; i++) {
                this.createWorker(i);
            }
            
            console.log(`Worker pool initialized with ${this.workerPool.length} workers`);
            
        } catch (error) {
            console.error('Failed to initialize worker pool:', error);
            this.fallbackToMainThread = true;
        }
    }
    
    /**
     * Create a Web Worker with comprehensive task handling
     */
    createWorker(workerId) {
        try {
            // Create worker from inline script to avoid file dependencies
            const workerScript = `
                class WorkerTaskProcessor {
                    constructor() {
                        this.processors = {
                            'summarization': this.processSummarization.bind(this),
                            'semantic_analysis': this.processSemanticAnalysis.bind(this),
                            'context_optimization': this.processContextOptimization.bind(this),
                            'search_indexing': this.processSearchIndexing.bind(this),
                            'data_migration': this.processDataMigration.bind(this),
                            'text_processing': this.processTextProcessing.bind(this)
                        };
                    }
                    
                    async processTask(taskData) {
                        const { type, data, options = {} } = taskData;
                        
                        if (!this.processors[type]) {
                            throw new Error(\`Unknown task type: \${type}\`);
                        }
                        
                        const startTime = performance.now();
                        const result = await this.processors[type](data, options);
                        const processingTime = performance.now() - startTime;
                        
                        return {
                            result,
                            processingTime,
                            workerStats: {
                                memoryUsage: performance.memory ? {
                                    used: performance.memory.usedJSHeapSize,
                                    total: performance.memory.totalJSHeapSize,
                                    limit: performance.memory.jsHeapSizeLimit
                                } : null
                            }
                        };
                    }
                    
                    async processSummarization(data, options) {
                        const { messages, type, maxLength } = data;
                        
                        // Simulate LLM summarization processing
                        // In real implementation, this would call the LLM API
                        const content = messages.map(m => m.content).join('\\n\\n');
                        const wordCount = content.split(' ').length;
                        
                        // Simulate processing time based on content length
                        await this.simulateProcessingDelay(Math.min(wordCount * 2, 5000));
                        
                        return {
                            summary: \`[BACKGROUND] \${type} Summary: \${content.substring(0, maxLength || 500)}...\`,
                            originalTokenCount: Math.ceil(wordCount * 1.3),
                            summaryTokenCount: Math.ceil((maxLength || 500) * 1.3 / 4),
                            compressionRatio: 0.25,
                            processingMethod: 'background_worker'
                        };
                    }
                    
                    async processSemanticAnalysis(data, options) {
                        const { messages } = data;
                        
                        // Semantic analysis processing
                        const results = [];
                        for (const message of messages) {
                            await this.simulateProcessingDelay(50);
                            
                            results.push({
                                id: message.id,
                                semanticType: this.analyzeSemanticType(message.content, message.role),
                                importance: this.calculateImportance(message.content),
                                topics: this.extractTopics(message.content),
                                sentiment: this.analyzeSentiment(message.content),
                                entities: this.extractEntities(message.content)
                            });
                        }
                        
                        return { analyses: results };
                    }
                    
                    async processContextOptimization(data, options) {
                        const { messages, query, targetTokens } = data;
                        
                        // Context optimization processing
                        await this.simulateProcessingDelay(messages.length * 10);
                        
                        const optimized = messages
                            .map(msg => ({
                                ...msg,
                                relevance: this.calculateRelevance(msg.content, query),
                                tokenCount: Math.ceil(msg.content.split(' ').length * 1.3)
                            }))
                            .sort((a, b) => b.relevance - a.relevance)
                            .filter((msg, index, arr) => {
                                const currentTokens = arr.slice(0, index + 1)
                                    .reduce((sum, m) => sum + m.tokenCount, 0);
                                return currentTokens <= targetTokens;
                            });
                        
                        return {
                            optimizedMessages: optimized,
                            totalTokens: optimized.reduce((sum, msg) => sum + msg.tokenCount, 0),
                            compressionRatio: optimized.length / messages.length,
                            relevanceThreshold: optimized.length > 0 ? optimized[optimized.length - 1].relevance : 0
                        };
                    }
                    
                    async processSearchIndexing(data, options) {
                        const { messages, artifacts } = data;
                        
                        // Search indexing processing
                        const index = { messages: [], artifacts: [] };
                        
                        // Index messages
                        for (const message of messages) {
                            await this.simulateProcessingDelay(20);
                            
                            const keywords = this.extractKeywords(message.content);
                            const topics = this.extractTopics(message.content);
                            
                            index.messages.push({
                                id: message.id,
                                keywords,
                                topics,
                                wordCount: message.content.split(' ').length,
                                lastIndexed: Date.now()
                            });
                        }
                        
                        // Index artifacts
                        for (const artifact of artifacts || []) {
                            await this.simulateProcessingDelay(30);
                            
                            const keywords = this.extractKeywords(artifact.content);
                            const topics = this.extractTopics(artifact.content);
                            
                            index.artifacts.push({
                                id: artifact.id,
                                keywords,
                                topics,
                                type: artifact.type,
                                wordCount: artifact.content.split(' ').length,
                                lastIndexed: Date.now()
                            });
                        }
                        
                        return { searchIndex: index };
                    }
                    
                    async processDataMigration(data, options) {
                        const { items, migrationRules } = data;
                        
                        // Data migration processing
                        const migrated = [];
                        const errors = [];
                        
                        for (const item of items) {
                            await this.simulateProcessingDelay(10);
                            
                            try {
                                const migratedItem = this.applyMigrationRules(item, migrationRules);
                                migrated.push(migratedItem);
                            } catch (error) {
                                errors.push({ item: item.id, error: error.message });
                            }
                        }
                        
                        return {
                            migratedItems: migrated,
                            migrationErrors: errors,
                            successRate: migrated.length / items.length
                        };
                    }
                    
                    async processTextProcessing(data, options) {
                        const { texts, operations } = data;
                        
                        // Text processing operations
                        const results = [];
                        
                        for (const text of texts) {
                            await this.simulateProcessingDelay(25);
                            
                            let processed = text;
                            
                            for (const operation of operations) {
                                switch (operation.type) {
                                    case 'clean':
                                        processed = processed.replace(/\\s+/g, ' ').trim();
                                        break;
                                    case 'extract_entities':
                                        processed = { original: processed, entities: this.extractEntities(processed) };
                                        break;
                                    case 'tokenize':
                                        processed = { original: processed, tokens: this.tokenize(processed) };
                                        break;
                                    case 'summarize':
                                        processed = processed.substring(0, operation.maxLength || 200) + '...';
                                        break;
                                }
                            }
                            
                            results.push(processed);
                        }
                        
                        return { processedTexts: results };
                    }
                    
                    // Helper methods for semantic analysis
                    analyzeSemanticType(content, role) {
                        if (role === 'assistant') return 'response';
                        
                        const lowerContent = content.toLowerCase();
                        if (lowerContent.includes('please') || lowerContent.includes('can you') || lowerContent.includes('?')) {
                            return 'query';
                        }
                        if (lowerContent.includes('do this') || lowerContent.includes('create') || lowerContent.includes('implement')) {
                            return 'task';
                        }
                        if (lowerContent.includes('summary') || lowerContent.includes('overview')) {
                            return 'summary';
                        }
                        return 'general';
                    }
                    
                    calculateImportance(content) {
                        let score = 1;
                        const lowerContent = content.toLowerCase();
                        
                        // Boost importance for certain keywords
                        if (lowerContent.includes('urgent') || lowerContent.includes('important')) score += 2;
                        if (lowerContent.includes('error') || lowerContent.includes('bug')) score += 1.5;
                        if (lowerContent.includes('meeting') || lowerContent.includes('deadline')) score += 1;
                        if (content.includes('!')) score += 0.5;
                        if (content.length > 500) score += 0.5;
                        
                        return Math.min(5, score);
                    }
                    
                    extractTopics(content) {
                        const topics = [];
                        const lowerContent = content.toLowerCase();
                        
                        // Simple topic extraction
                        const topicPatterns = {
                            'development': ['code', 'programming', 'development', 'software'],
                            'meeting': ['meeting', 'call', 'discussion', 'agenda'],
                            'task': ['task', 'todo', 'action', 'implement'],
                            'issue': ['bug', 'error', 'issue', 'problem'],
                            'planning': ['plan', 'strategy', 'roadmap', 'timeline']
                        };
                        
                        for (const [topic, keywords] of Object.entries(topicPatterns)) {
                            if (keywords.some(keyword => lowerContent.includes(keyword))) {
                                topics.push(topic);
                            }
                        }
                        
                        return topics.length > 0 ? topics : ['general'];
                    }
                    
                    analyzeSentiment(content) {
                        const lowerContent = content.toLowerCase();
                        let score = 0;
                        
                        const positiveWords = ['good', 'great', 'excellent', 'perfect', 'success', 'working'];
                        const negativeWords = ['bad', 'terrible', 'error', 'fail', 'broken', 'issue'];
                        
                        positiveWords.forEach(word => {
                            if (lowerContent.includes(word)) score += 1;
                        });
                        
                        negativeWords.forEach(word => {
                            if (lowerContent.includes(word)) score -= 1;
                        });
                        
                        return score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral';
                    }
                    
                    extractEntities(content) {
                        const entities = [];
                        
                        // Simple entity extraction
                        const emailRegex = /\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b/g;
                        const urlRegex = /https?:\\/\\/(www\\.)?[-a-zA-Z0-9@:%._\\+~#=]{1,256}\\.[a-zA-Z0-9()]{1,6}\\b([-a-zA-Z0-9()@:%_\\+.~#?&//=]*)/g;
                        const dateRegex = /\\b\\d{1,2}\\/\\d{1,2}\\/\\d{2,4}\\b|\\b\\d{4}-\\d{2}-\\d{2}\\b/g;
                        
                        const emails = content.match(emailRegex) || [];
                        const urls = content.match(urlRegex) || [];
                        const dates = content.match(dateRegex) || [];
                        
                        if (emails.length > 0) entities.push({ type: 'email', values: emails });
                        if (urls.length > 0) entities.push({ type: 'url', values: urls });
                        if (dates.length > 0) entities.push({ type: 'date', values: dates });
                        
                        return entities;
                    }
                    
                    extractKeywords(content) {
                        // Simple keyword extraction
                        const words = content.toLowerCase()
                            .replace(/[^a-zA-Z0-9\\s]/g, '')
                            .split(/\\s+/)
                            .filter(word => word.length > 3);
                        
                        const stopWords = new Set(['this', 'that', 'with', 'have', 'will', 'from', 'they', 'been', 'were', 'said']);
                        const keywords = words.filter(word => !stopWords.has(word));
                        
                        // Get unique keywords with frequency
                        const frequency = {};
                        keywords.forEach(word => frequency[word] = (frequency[word] || 0) + 1);
                        
                        return Object.entries(frequency)
                            .sort(([,a], [,b]) => b - a)
                            .slice(0, 10)
                            .map(([word]) => word);
                    }
                    
                    calculateRelevance(content, query) {
                        if (!query) return 0.5;
                        
                        const contentWords = content.toLowerCase().split(/\\s+/);
                        const queryWords = query.toLowerCase().split(/\\s+/);
                        
                        let matches = 0;
                        queryWords.forEach(word => {
                            if (contentWords.includes(word)) matches++;
                        });
                        
                        return matches / queryWords.length;
                    }
                    
                    tokenize(text) {
                        return text.split(/\\s+/).filter(token => token.length > 0);
                    }
                    
                    applyMigrationRules(item, rules) {
                        let migrated = { ...item };
                        
                        rules.forEach(rule => {
                            switch (rule.type) {
                                case 'add_field':
                                    migrated[rule.field] = rule.defaultValue;
                                    break;
                                case 'rename_field':
                                    if (migrated[rule.oldField] !== undefined) {
                                        migrated[rule.newField] = migrated[rule.oldField];
                                        delete migrated[rule.oldField];
                                    }
                                    break;
                                case 'transform_field':
                                    if (migrated[rule.field] !== undefined) {
                                        migrated[rule.field] = rule.transform(migrated[rule.field]);
                                    }
                                    break;
                            }
                        });
                        
                        return migrated;
                    }
                    
                    async simulateProcessingDelay(ms) {
                        // Simulate processing time without blocking
                        return new Promise(resolve => setTimeout(resolve, Math.min(ms, 100)));
                    }
                }
                
                const processor = new WorkerTaskProcessor();
                
                self.onmessage = async function(e) {
                    const { taskId, taskData } = e.data;
                    
                    try {
                        const result = await processor.processTask(taskData);
                        self.postMessage({
                            taskId,
                            success: true,
                            result
                        });
                    } catch (error) {
                        self.postMessage({
                            taskId,
                            success: false,
                            error: {
                                message: error.message,
                                stack: error.stack
                            }
                        });
                    }
                };
            `;
            
            const blob = new Blob([workerScript], { type: 'application/javascript' });
            const workerUrl = URL.createObjectURL(blob);
            const worker = new Worker(workerUrl);
            
            worker.onmessage = (e) => this.handleWorkerMessage(e, workerId);
            worker.onerror = (error) => this.handleWorkerError(error, workerId);
            
            this.workerPool.push({
                id: workerId,
                worker,
                busy: false,
                tasksCompleted: 0,
                lastUsed: Date.now()
            });
            
            // Clean up blob URL after worker creation
            URL.revokeObjectURL(workerUrl);
            
        } catch (error) {
            console.error(`Failed to create worker ${workerId}:`, error);
            this.fallbackToMainThread = true;
        }
    }
    
    /**
     * Handle messages from Web Workers
     */
    handleWorkerMessage(e, workerId) {
        const { taskId, success, result, error } = e.data;
        const workerInfo = this.workerPool.find(w => w.id === workerId);
        
        if (workerInfo) {
            workerInfo.busy = false;
            workerInfo.tasksCompleted++;
            workerInfo.lastUsed = Date.now();
        }
        
        if (this.activeTasks.has(taskId)) {
            const taskInfo = this.activeTasks.get(taskId);
            
            if (success) {
                this.taskResults.set(taskId, {
                    ...result,
                    completedAt: Date.now(),
                    workerId,
                    status: 'completed'
                });
                
                if (taskInfo.resolve) {
                    taskInfo.resolve(result);
                }
            } else {
                this.taskResults.set(taskId, {
                    error,
                    completedAt: Date.now(),
                    workerId,
                    status: 'failed'
                });
                
                if (taskInfo.reject) {
                    taskInfo.reject(new Error(error.message));
                }
            }
            
            this.activeTasks.delete(taskId);
            this.processQueue();
        }
    }
    
    /**
     * Handle Web Worker errors
     */
    handleWorkerError(error, workerId) {
        console.error(`Worker ${workerId} error:`, error);
        
        const workerInfo = this.workerPool.find(w => w.id === workerId);
        if (workerInfo) {
            workerInfo.busy = false;
            
            // Find tasks assigned to this worker and mark as failed
            this.activeTasks.forEach((taskInfo, taskId) => {
                if (taskInfo.workerId === workerId) {
                    this.taskResults.set(taskId, {
                        error: { message: error.message },
                        completedAt: Date.now(),
                        workerId,
                        status: 'worker_error'
                    });
                    
                    if (taskInfo.reject) {
                        taskInfo.reject(new Error(error.message));
                    }
                    
                    this.activeTasks.delete(taskId);
                }
            });
        }
        
        this.processQueue();
    }
    
    /**
     * Process background task with automatic worker assignment
     */
    async processTask(type, data, options = {}) {
        return new Promise((resolve, reject) => {
            const taskId = this.generateTaskId();
            const priority = options.priority || 'normal';
            const timeout = options.timeout || 30000; // 30 second default timeout
            
            const task = {
                id: taskId,
                type,
                data,
                options,
                priority,
                createdAt: Date.now(),
                resolve,
                reject
            };
            
            // Set timeout
            const timeoutId = setTimeout(() => {
                if (this.activeTasks.has(taskId)) {
                    this.activeTasks.delete(taskId);
                    this.taskResults.set(taskId, {
                        error: { message: 'Task timeout' },
                        completedAt: Date.now(),
                        status: 'timeout'
                    });
                    reject(new Error('Task timeout'));
                }
            }, timeout);
            
            task.timeoutId = timeoutId;
            
            // Add to queue based on priority
            if (priority === 'high') {
                this.taskQueue.unshift(task);
            } else {
                this.taskQueue.push(task);
            }
            
            this.processQueue();
        });
    }
    
    /**
     * Process task queue and assign tasks to available workers
     */
    processQueue() {
        if (this.taskQueue.length === 0) return;
        
        // Find available worker
        const availableWorker = this.workerPool.find(w => !w.busy);
        if (!availableWorker) return;
        
        const task = this.taskQueue.shift();
        if (!task) return;
        
        // Assign task to worker
        availableWorker.busy = true;
        availableWorker.lastUsed = Date.now();
        
        this.activeTasks.set(task.id, {
            ...task,
            workerId: availableWorker.id,
            assignedAt: Date.now()
        });
        
        // Send task to worker
        availableWorker.worker.postMessage({
            taskId: task.id,
            taskData: {
                type: task.type,
                data: task.data,
                options: task.options
            }
        });
        
        // Continue processing queue if more workers available
        setTimeout(() => this.processQueue(), 0);
    }
    
    /**
     * Get task status and result
     */
    getTaskResult(taskId) {
        return this.taskResults.get(taskId);
    }
    
    /**
     * Cancel a pending task
     */
    cancelTask(taskId) {
        // Remove from queue if pending
        const queueIndex = this.taskQueue.findIndex(task => task.id === taskId);
        if (queueIndex !== -1) {
            const task = this.taskQueue.splice(queueIndex, 1)[0];
            if (task.timeoutId) clearTimeout(task.timeoutId);
            if (task.reject) task.reject(new Error('Task cancelled'));
            return true;
        }
        
        // Mark active task as cancelled
        if (this.activeTasks.has(taskId)) {
            const task = this.activeTasks.get(taskId);
            if (task.timeoutId) clearTimeout(task.timeoutId);
            if (task.reject) task.reject(new Error('Task cancelled'));
            this.activeTasks.delete(taskId);
            return true;
        }
        
        return false;
    }
    
    /**
     * Get processor statistics
     */
    getStatistics() {
        const totalTasks = this.taskResults.size;
        const completedTasks = Array.from(this.taskResults.values()).filter(r => r.status === 'completed').length;
        const failedTasks = Array.from(this.taskResults.values()).filter(r => r.status === 'failed').length;
        
        return {
            totalWorkers: this.workerPool.length,
            activeWorkers: this.workerPool.filter(w => w.busy).length,
            queueLength: this.taskQueue.length,
            activeTasks: this.activeTasks.size,
            totalTasksProcessed: totalTasks,
            completedTasks,
            failedTasks,
            successRate: totalTasks > 0 ? (completedTasks / totalTasks) : 0,
            workerStats: this.workerPool.map(w => ({
                id: w.id,
                busy: w.busy,
                tasksCompleted: w.tasksCompleted,
                lastUsed: w.lastUsed
            }))
        };
    }
    
    /**
     * Setup performance monitoring
     */
    setupPerformanceMonitoring() {
        // Monitor queue size and performance
        this.performanceMonitor = setInterval(() => {
            const stats = this.getStatistics();
            
            // Log warnings for performance issues
            if (stats.queueLength > 50) {
                console.warn('Background processor queue is getting large:', stats.queueLength);
            }
            
            if (stats.successRate < 0.8 && stats.totalTasksProcessed > 10) {
                console.warn('Background processor success rate is low:', stats.successRate);
            }
            
            // Clean up old task results (keep last 100)
            if (this.taskResults.size > 100) {
                const sortedTasks = Array.from(this.taskResults.entries())
                    .sort(([,a], [,b]) => b.completedAt - a.completedAt);
                
                // Keep most recent 50
                this.taskResults.clear();
                sortedTasks.slice(0, 50).forEach(([id, result]) => {
                    this.taskResults.set(id, result);
                });
            }
            
        }, 30000); // Check every 30 seconds
    }
    
    /**
     * Generate unique task ID
     */
    generateTaskId() {
        return `task_${++this.taskIdCounter}_${Date.now()}`;
    }
    
    /**
     * Batch process multiple tasks
     */
    async processBatch(tasks, options = {}) {
        const batchId = `batch_${Date.now()}`;
        const results = [];
        
        try {
            const promises = tasks.map(task => 
                this.processTask(task.type, task.data, { 
                    ...task.options, 
                    priority: options.priority || 'normal' 
                })
            );
            
            const batchResults = await Promise.allSettled(promises);
            
            batchResults.forEach((result, index) => {
                results.push({
                    taskIndex: index,
                    success: result.status === 'fulfilled',
                    result: result.status === 'fulfilled' ? result.value : null,
                    error: result.status === 'rejected' ? result.reason.message : null
                });
            });
            
            return {
                batchId,
                results,
                successCount: results.filter(r => r.success).length,
                totalCount: results.length
            };
            
        } catch (error) {
            console.error('Batch processing error:', error);
            throw error;
        }
    }
    
    /**
     * Cleanup resources
     */
    cleanup() {
        // Clear performance monitor
        if (this.performanceMonitor) {
            clearInterval(this.performanceMonitor);
        }
        
        // Terminate all workers
        this.workerPool.forEach(workerInfo => {
            workerInfo.worker.terminate();
        });
        
        // Clear all data structures
        this.workerPool.clear();
        this.taskQueue.length = 0;
        this.activeTasks.clear();
        this.taskResults.clear();
        
        console.log('BackgroundProcessor cleaned up');
    }
}

// Global instance
window.backgroundProcessor = new BackgroundProcessor();