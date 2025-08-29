// Branestawm - LLM Router
// Intelligent routing between local Ollama and cloud LLM APIs

class LLMRouter {
    constructor(ollamaClient) {
        this.ollamaClient = ollamaClient;
        this.routingPreference = 'local-first'; // local-first, cloud-first, auto
        this.complexityThreshold = 0.6; // 0-1 scale, configurable
        this.maxLocalTokens = 8192; // Maximum tokens to send to local model
        this.fallbackEnabled = true;
        
        // Performance tracking
        this.responseMetrics = {
            local: { count: 0, totalTime: 0, failures: 0 },
            cloud: { count: 0, totalTime: 0, failures: 0 }
        };
        
        // Load settings
        this.loadRouterSettings();
        
        // Keywords that suggest complexity requiring cloud processing
        this.complexityKeywords = [
            'analyze', 'synthesize', 'compare', 'research', 'comprehensive',
            'detailed analysis', 'in-depth', 'elaborate', 'multiple sources',
            'complex reasoning', 'step-by-step analysis', 'pros and cons',
            'research paper', 'literature review', 'market analysis'
        ];
        
        // Keywords that suggest simple local processing
        this.simpleKeywords = [
            'quick', 'simple', 'brief', 'short', 'summarize', 'list',
            'what is', 'how to', 'define', 'explain', 'help me',
            'remind me', 'format', 'rewrite', 'edit', 'check'
        ];
    }

    /**
     * Main query routing method
     */
    async query(message, context, options = {}) {
        const startTime = performance.now();
        
        try {
            // Determine optimal routing
            const routing = this.determineRouting(message, context, options);
            console.log(`Routing decision: ${routing.target} (confidence: ${routing.confidence})`);
            
            let response;
            
            switch (routing.target) {
                case 'local':
                    response = await this.queryLocal(message, context, options);
                    break;
                case 'cloud':
                    response = await this.queryCloud(message, context, options);
                    break;
                case 'hybrid':
                    response = await this.hybridQuery(message, context, options);
                    break;
                default:
                    throw new Error(`Unknown routing target: ${routing.target}`);
            }
            
            // Track performance
            const duration = performance.now() - startTime;
            this.updateMetrics(response.source, duration, false);
            
            return {
                ...response,
                routing: routing.target,
                processingTime: duration
            };
            
        } catch (error) {
            const duration = performance.now() - startTime;
            console.error('LLM Router error:', error);
            
            // Attempt fallback if enabled
            if (this.fallbackEnabled && !options.noFallback) {
                return await this.handleFallback(message, context, { ...options, noFallback: true });
            }
            
            throw error;
        }
    }

    /**
     * Determine optimal routing strategy
     */
    determineRouting(message, context, options = {}) {
        const factors = {
            complexity: this.analyzeComplexity(message),
            messageLength: message.length,
            ollamaAvailable: this.ollamaClient.isConnected(),
            forceLocal: options.forceLocal,
            forceCloud: options.forceCloud,
            userPreference: this.routingPreference,
            connectivity: navigator.onLine,
            contextSize: this.estimateContextSize(context)
        };
        
        // Force routing if explicitly requested
        if (factors.forceLocal && factors.ollamaAvailable) {
            return { target: 'local', confidence: 1.0, reason: 'force_local' };
        }
        
        if (factors.forceCloud && factors.connectivity) {
            return { target: 'cloud', confidence: 1.0, reason: 'force_cloud' };
        }
        
        // No connectivity - must use local if available
        if (!factors.connectivity) {
            if (factors.ollamaAvailable) {
                return { target: 'local', confidence: 0.9, reason: 'no_connectivity' };
            } else {
                throw new Error('No connectivity and Ollama not available');
            }
        }
        
        // Ollama not available - use cloud
        if (!factors.ollamaAvailable) {
            return { target: 'cloud', confidence: 0.8, reason: 'ollama_unavailable' };
        }
        
        // Context too large for local model
        if (factors.contextSize > this.maxLocalTokens) {
            return { target: 'cloud', confidence: 0.9, reason: 'context_too_large' };
        }
        
        // Apply routing preference logic
        return this.calculateOptimalRoute(factors);
    }

    /**
     * Calculate optimal route based on all factors
     */
    calculateOptimalRoute(factors) {
        let localScore = 0.5;
        let cloudScore = 0.5;
        
        // Base preference weighting
        if (factors.userPreference === 'local-first') {
            localScore += 0.3;
        } else if (factors.userPreference === 'cloud-first') {
            cloudScore += 0.3;
        }
        
        // Complexity analysis
        if (factors.complexity > this.complexityThreshold) {
            cloudScore += 0.4;
            localScore -= 0.2;
        } else {
            localScore += 0.3;
            cloudScore -= 0.1;
        }
        
        // Message length consideration
        if (factors.messageLength > 1000) {
            cloudScore += 0.2;
        } else {
            localScore += 0.1;
        }
        
        // Performance history
        const localPerf = this.getAverageResponseTime('local');
        const cloudPerf = this.getAverageResponseTime('cloud');
        
        if (localPerf > 0 && cloudPerf > 0) {
            if (localPerf < cloudPerf) {
                localScore += 0.1;
            } else {
                cloudScore += 0.1;
            }
        }
        
        // Determine target
        const confidence = Math.abs(localScore - cloudScore);
        
        if (localScore > cloudScore) {
            return { 
                target: 'local', 
                confidence: Math.min(confidence + 0.3, 1.0),
                reason: 'optimal_local'
            };
        } else {
            return { 
                target: 'cloud', 
                confidence: Math.min(confidence + 0.3, 1.0),
                reason: 'optimal_cloud'
            };
        }
    }

    /**
     * Analyze query complexity
     */
    analyzeComplexity(message) {
        const lowerMessage = message.toLowerCase();
        
        let complexityScore = 0;
        
        // Check for complexity indicators
        this.complexityKeywords.forEach(keyword => {
            if (lowerMessage.includes(keyword)) {
                complexityScore += 0.1;
            }
        });
        
        // Check for simplicity indicators
        this.simpleKeywords.forEach(keyword => {
            if (lowerMessage.includes(keyword)) {
                complexityScore -= 0.05;
            }
        });
        
        // Length-based complexity
        if (message.length > 500) complexityScore += 0.1;
        if (message.length > 1000) complexityScore += 0.2;
        
        // Question marks might indicate simpler queries
        const questionMarks = (message.match(/\?/g) || []).length;
        if (questionMarks > 0) complexityScore -= 0.05 * questionMarks;
        
        // Code blocks or technical content
        if (message.includes('```') || message.includes('function') || message.includes('class')) {
            complexityScore += 0.15;
        }
        
        return Math.max(0, Math.min(1, complexityScore));
    }

    /**
     * Estimate context size in tokens (rough approximation)
     */
    estimateContextSize(context) {
        if (!context || !Array.isArray(context)) return 0;
        
        let totalText = context.map(msg => msg.content || '').join(' ');
        // Rough approximation: 1 token ≈ 4 characters
        return Math.ceil(totalText.length / 4);
    }

    /**
     * Query local Ollama model
     */
    async queryLocal(message, context, options = {}) {
        if (!this.ollamaClient.isConnected()) {
            throw new Error('Ollama not connected');
        }

        // Prepare messages in OpenAI format
        const messages = this.prepareMessages(message, context);
        
        try {
            const response = await this.ollamaClient.chatCompletion(messages, {
                temperature: options.temperature || 0.7,
                max_tokens: options.maxTokens || 4096
            });
            
            return {
                content: response.content,
                model: response.model,
                source: 'local',
                usage: response.usage
            };
            
        } catch (error) {
            console.error('Local query failed:', error);
            throw new Error(`Local model error: ${error.message}`);
        }
    }

    /**
     * Query cloud LLM (existing implementation)
     */
    async queryCloud(message, context, options = {}) {
        // Use existing cloud API function
        const messages = this.prepareMessages(message, context);
        
        try {
            const response = await callLLMAPI(messages);
            
            return {
                content: response,
                model: settings.apiProvider || 'cloud-llm',
                source: 'cloud',
                usage: {}
            };
            
        } catch (error) {
            console.error('Cloud query failed:', error);
            throw new Error(`Cloud model error: ${error.message}`);
        }
    }

    /**
     * Hybrid query - try local first, cloud for refinement
     */
    async hybridQuery(message, context, options = {}) {
        try {
            // First attempt with local model
            const localResponse = await this.queryLocal(message, context, options);
            
            // For hybrid, we could implement response quality assessment
            // and potentially refine with cloud if needed
            // For now, just return local response
            return {
                ...localResponse,
                source: 'hybrid-local'
            };
            
        } catch (error) {
            console.log('Hybrid query: local failed, falling back to cloud');
            const cloudResponse = await this.queryCloud(message, context, options);
            
            return {
                ...cloudResponse,
                source: 'hybrid-cloud'
            };
        }
    }

    /**
     * Handle fallback routing
     */
    async handleFallback(message, context, options = {}) {
        console.log('Attempting fallback routing');
        
        // Try opposite of what failed
        if (this.ollamaClient.isConnected()) {
            try {
                const response = await this.queryLocal(message, context, options);
                return { ...response, source: 'fallback-local' };
            } catch (localError) {
                console.log('Fallback local failed:', localError.message);
            }
        }
        
        if (navigator.onLine) {
            try {
                const response = await this.queryCloud(message, context, options);
                return { ...response, source: 'fallback-cloud' };
            } catch (cloudError) {
                console.log('Fallback cloud failed:', cloudError.message);
            }
        }
        
        throw new Error('All fallback options exhausted');
    }

    /**
     * Prepare messages in OpenAI-compatible format
     */
    prepareMessages(message, context) {
        const messages = [];
        
        // Add context messages if available
        if (Array.isArray(context)) {
            messages.push(...context);
        }
        
        // Add current user message
        if (typeof message === 'string') {
            messages.push({
                role: 'user',
                content: message
            });
        }
        
        return messages;
    }

    /**
     * Update performance metrics
     */
    updateMetrics(source, duration, isFailure) {
        if (this.responseMetrics[source]) {
            this.responseMetrics[source].count++;
            
            if (isFailure) {
                this.responseMetrics[source].failures++;
            } else {
                this.responseMetrics[source].totalTime += duration;
            }
        }
    }

    /**
     * Get average response time for a source
     */
    getAverageResponseTime(source) {
        const metrics = this.responseMetrics[source];
        if (!metrics || metrics.count === 0) return 0;
        
        const successfulRequests = metrics.count - metrics.failures;
        return successfulRequests > 0 ? metrics.totalTime / successfulRequests : 0;
    }

    /**
     * Get performance statistics
     */
    getPerformanceStats() {
        return {
            local: {
                requests: this.responseMetrics.local.count,
                failures: this.responseMetrics.local.failures,
                avgResponseTime: this.getAverageResponseTime('local'),
                successRate: this.responseMetrics.local.count > 0 ? 
                    (this.responseMetrics.local.count - this.responseMetrics.local.failures) / this.responseMetrics.local.count : 0
            },
            cloud: {
                requests: this.responseMetrics.cloud.count,
                failures: this.responseMetrics.cloud.failures,
                avgResponseTime: this.getAverageResponseTime('cloud'),
                successRate: this.responseMetrics.cloud.count > 0 ? 
                    (this.responseMetrics.cloud.count - this.responseMetrics.cloud.failures) / this.responseMetrics.cloud.count : 0
            }
        };
    }

    /**
     * Set routing preference
     */
    setRoutingPreference(preference) {
        if (['local-first', 'cloud-first', 'auto'].includes(preference)) {
            this.routingPreference = preference;
            this.saveRouterSettings();
        }
    }

    /**
     * Set complexity threshold
     */
    setComplexityThreshold(threshold) {
        if (threshold >= 0 && threshold <= 1) {
            this.complexityThreshold = threshold;
            this.saveRouterSettings();
        }
    }

    /**
     * Save router settings
     */
    saveRouterSettings() {
        const settings = {
            routingPreference: this.routingPreference,
            complexityThreshold: this.complexityThreshold,
            fallbackEnabled: this.fallbackEnabled
        };
        
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.set({ llmRouterSettings: settings });
        } else {
            localStorage.setItem('llmRouterSettings', JSON.stringify(settings));
        }
    }

    /**
     * Load router settings
     */
    async loadRouterSettings() {
        try {
            let settings;
            
            if (typeof chrome !== 'undefined' && chrome.storage) {
                const result = await chrome.storage.local.get(['llmRouterSettings']);
                settings = result.llmRouterSettings;
            } else {
                const saved = localStorage.getItem('llmRouterSettings');
                settings = saved ? JSON.parse(saved) : null;
            }
            
            if (settings) {
                this.routingPreference = settings.routingPreference || 'local-first';
                this.complexityThreshold = settings.complexityThreshold || 0.6;
                this.fallbackEnabled = settings.fallbackEnabled !== false;
            }
        } catch (error) {
            console.error('Error loading router settings:', error);
        }
    }

    /**
     * Reset performance metrics
     */
    resetMetrics() {
        this.responseMetrics = {
            local: { count: 0, totalTime: 0, failures: 0 },
            cloud: { count: 0, totalTime: 0, failures: 0 }
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LLMRouter;
} else {
    window.LLMRouter = LLMRouter;
}