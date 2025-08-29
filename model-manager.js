// Branestawm - Model Manager
// Manages Ollama models, settings, and UI integration

class ModelManager {
    constructor(ollamaClient, llmRouter) {
        this.ollamaClient = ollamaClient;
        this.llmRouter = llmRouter;
        this.modelSettings = {};
        this.refreshInterval = null;
        
        // Initialize
        this.initializeManager();
    }

    /**
     * Initialize the model manager
     */
    async initializeManager() {
        await this.loadModelSettings();
        this.startPeriodicRefresh();
    }

    /**
     * Get all available models with detailed information
     */
    async getAvailableModels() {
        if (!this.ollamaClient.isConnected()) {
            return [];
        }
        
        const models = this.ollamaClient.getAvailableModels();
        
        // Enhance with additional metadata
        return models.map(model => ({
            ...model,
            displayName: this.getModelDisplayName(model.name),
            category: this.categorizeModel(model.name),
            estimatedLoadTime: this.ollamaClient.estimateLoadTime(model.name),
            isActive: model.name === this.ollamaClient.getActiveModel(),
            capabilities: this.getModelCapabilities(model.name),
            settings: this.modelSettings[model.name] || this.getDefaultModelSettings()
        }));
    }

    /**
     * Set active model
     */
    async setActiveModel(modelName) {
        try {
            await this.ollamaClient.setActiveModel(modelName);
            
            // Update UI if available
            this.updateModelDisplays();
            
            // Show brief loading notification if model takes time to load
            const estimatedTime = this.ollamaClient.estimateLoadTime(modelName);
            if (estimatedTime > 3) {
                this.showModelLoadingNotification(modelName, estimatedTime);
            }
            
            return true;
        } catch (error) {
            console.error('Error setting active model:', error);
            throw error;
        }
    }

    /**
     * Get model display name (clean up technical names)
     */
    getModelDisplayName(modelName) {
        // Common model name mappings for better UX
        const displayNames = {
            'llama2:latest': 'Llama 2 (Latest)',
            'llama2:7b': 'Llama 2 7B',
            'llama2:13b': 'Llama 2 13B',
            'llama2:70b': 'Llama 2 70B',
            'codellama:latest': 'Code Llama (Latest)',
            'codellama:7b': 'Code Llama 7B',
            'codellama:13b': 'Code Llama 13B',
            'mistral:latest': 'Mistral (Latest)',
            'mistral:7b': 'Mistral 7B',
            'gemma:2b': 'Gemma 2B',
            'gemma:7b': 'Gemma 7B',
            'gemma2:9b': 'Gemma 2 9B',
            'gemma2:27b': 'Gemma 2 27B',
            'phi3:latest': 'Phi-3 (Latest)',
            'phi3:mini': 'Phi-3 Mini',
            'phi3:medium': 'Phi-3 Medium',
            'qwen:latest': 'Qwen (Latest)',
            'neural-chat:latest': 'Neural Chat'
        };
        
        return displayNames[modelName] || this.formatModelName(modelName);
    }

    /**
     * Format model name for display
     */
    formatModelName(modelName) {
        return modelName
            .split(':')[0] // Remove tag
            .split('/').pop() // Remove path
            .replace(/-/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase()); // Title case
    }

    /**
     * Categorize models for organization
     */
    categorizeModel(modelName) {
        const name = modelName.toLowerCase();
        
        if (name.includes('code') || name.includes('codellama')) {
            return 'coding';
        } else if (name.includes('mistral') || name.includes('mixtral')) {
            return 'general';
        } else if (name.includes('llama')) {
            return 'general';
        } else if (name.includes('gemma')) {
            return 'general';
        } else if (name.includes('phi')) {
            return 'reasoning';
        } else if (name.includes('neural-chat')) {
            return 'chat';
        } else {
            return 'other';
        }
    }

    /**
     * Get model capabilities based on known model characteristics
     */
    getModelCapabilities(modelName) {
        const name = modelName.toLowerCase();
        const capabilities = [];
        
        // Basic capabilities all models have
        capabilities.push('text-generation', 'question-answering');
        
        // Specific capabilities
        if (name.includes('code') || name.includes('codellama')) {
            capabilities.push('code-generation', 'code-analysis', 'debugging');
        }
        
        if (name.includes('instruct') || name.includes('chat')) {
            capabilities.push('instruction-following', 'conversation');
        }
        
        if (name.includes('13b') || name.includes('70b') || name.includes('27b')) {
            capabilities.push('complex-reasoning', 'long-context');
        }
        
        if (name.includes('2b') || name.includes('7b')) {
            capabilities.push('fast-inference', 'low-resource');
        }
        
        return capabilities;
    }

    /**
     * Get default model settings
     */
    getDefaultModelSettings() {
        return {
            temperature: 0.7,
            top_k: 40,
            top_p: 0.9,
            max_tokens: 4096,
            context_length: 8192,
            preferred_for: ['general']
        };
    }

    /**
     * Update model-specific settings
     */
    updateModelSettings(modelName, settings) {
        this.modelSettings[modelName] = {
            ...this.getDefaultModelSettings(),
            ...this.modelSettings[modelName],
            ...settings
        };
        
        this.saveModelSettings();
    }

    /**
     * Get model settings
     */
    getModelSettings(modelName) {
        return this.modelSettings[modelName] || this.getDefaultModelSettings();
    }

    /**
     * Get recommended models for specific tasks
     */
    getRecommendedModels(taskType = 'general') {
        const models = this.ollamaClient.getAvailableModels();
        
        const recommendations = {
            'coding': ['codellama', 'deepseek-coder', 'starcoder'],
            'reasoning': ['phi3', 'qwen', 'llama2:13b'],
            'chat': ['neural-chat', 'mistral', 'llama2'],
            'speed': ['gemma:2b', 'phi3:mini', 'tinyllama'],
            'quality': ['llama2:70b', 'gemma2:27b', 'mistral:7b']
        };
        
        const preferred = recommendations[taskType] || [];
        
        return models.filter(model => 
            preferred.some(rec => model.name.toLowerCase().includes(rec))
        ).map(model => ({
            ...model,
            displayName: this.getModelDisplayName(model.name),
            reason: this.getRecommendationReason(model.name, taskType)
        }));
    }

    /**
     * Get recommendation reason
     */
    getRecommendationReason(modelName, taskType) {
        const reasons = {
            'coding': 'Optimized for code generation and analysis',
            'reasoning': 'Excellent for complex problem solving',
            'chat': 'Designed for natural conversation',
            'speed': 'Fast inference with good quality',
            'quality': 'Highest quality responses'
        };
        
        return reasons[taskType] || 'Good general-purpose model';
    }

    /**
     * Test model performance
     */
    async testModelPerformance(modelName) {
        const originalModel = this.ollamaClient.getActiveModel();
        
        try {
            // Switch to test model
            await this.ollamaClient.setActiveModel(modelName);
            
            const testPrompts = [
                'Hello, how are you?',
                'What is 2+2?',
                'Write a short poem about AI.'
            ];
            
            const results = [];
            
            for (const prompt of testPrompts) {
                const startTime = performance.now();
                
                try {
                    const response = await this.ollamaClient.chatCompletion([
                        { role: 'user', content: prompt }
                    ]);
                    
                    const endTime = performance.now();
                    
                    results.push({
                        prompt,
                        success: true,
                        responseTime: endTime - startTime,
                        responseLength: response.content.length
                    });
                } catch (error) {
                    results.push({
                        prompt,
                        success: false,
                        error: error.message
                    });
                }
            }
            
            // Calculate performance metrics
            const successfulTests = results.filter(r => r.success);
            const avgResponseTime = successfulTests.length > 0 
                ? successfulTests.reduce((sum, r) => sum + r.responseTime, 0) / successfulTests.length
                : 0;
                
            return {
                model: modelName,
                successRate: successfulTests.length / results.length,
                averageResponseTime: avgResponseTime,
                results: results
            };
            
        } finally {
            // Restore original model
            if (originalModel) {
                await this.ollamaClient.setActiveModel(originalModel);
            }
        }
    }

    /**
     * Generate model comparison data
     */
    async compareModels(modelNames = null) {
        if (!modelNames) {
            modelNames = this.ollamaClient.getAvailableModels().map(m => m.name);
        }
        
        const comparisons = [];
        
        for (const modelName of modelNames) {
            try {
                const performance = await this.testModelPerformance(modelName);
                const modelInfo = this.ollamaClient.getModelInfo(modelName);
                
                comparisons.push({
                    ...performance,
                    size: modelInfo ? modelInfo.size : 0,
                    displayName: this.getModelDisplayName(modelName),
                    category: this.categorizeModel(modelName),
                    capabilities: this.getModelCapabilities(modelName)
                });
            } catch (error) {
                console.error(`Error testing model ${modelName}:`, error);
            }
        }
        
        return comparisons.sort((a, b) => b.successRate - a.successRate);
    }

    /**
     * Start periodic model refresh
     */
    startPeriodicRefresh() {
        // Refresh every 5 minutes
        this.refreshInterval = setInterval(() => {
            if (this.ollamaClient.isConnected()) {
                this.ollamaClient.loadAvailableModels();
            }
        }, 5 * 60 * 1000);
    }

    /**
     * Update model displays in UI
     */
    updateModelDisplays() {
        // Update any UI elements that show current model
        const currentModel = this.ollamaClient.getActiveModel();
        
        if (currentModel) {
            const displayName = this.getModelDisplayName(currentModel);
            
            // Update settings panel if visible
            const modelSelect = document.getElementById('ollamaModelSelect');
            if (modelSelect) {
                modelSelect.value = currentModel;
            }
            
            // Update any status displays
            const statusElements = document.querySelectorAll('.current-model-display');
            statusElements.forEach(el => {
                el.textContent = displayName;
            });
        }
    }

    /**
     * Show model loading notification
     */
    showModelLoadingNotification(modelName, estimatedTime) {
        const displayName = this.getModelDisplayName(modelName);
        const message = `Loading ${displayName}... (estimated ${estimatedTime}s)`;
        
        // Use existing notification system if available
        if (typeof showMessage === 'function') {
            showMessage(message, 'info');
        } else {
            console.log(message);
        }
    }

    /**
     * Save model settings to storage
     */
    saveModelSettings() {
        const data = {
            modelSettings: this.modelSettings,
            timestamp: Date.now()
        };
        
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.set({ modelManagerSettings: data });
        } else {
            localStorage.setItem('modelManagerSettings', JSON.stringify(data));
        }
    }

    /**
     * Load model settings from storage
     */
    async loadModelSettings() {
        try {
            let data;
            
            if (typeof chrome !== 'undefined' && chrome.storage) {
                const result = await chrome.storage.local.get(['modelManagerSettings']);
                data = result.modelManagerSettings;
            } else {
                const saved = localStorage.getItem('modelManagerSettings');
                data = saved ? JSON.parse(saved) : null;
            }
            
            if (data && data.modelSettings) {
                this.modelSettings = data.modelSettings;
            }
        } catch (error) {
            console.error('Error loading model settings:', error);
        }
    }

    /**
     * Get model statistics
     */
    getModelStatistics() {
        const models = this.ollamaClient.getAvailableModels();
        const routerStats = this.llmRouter.getPerformanceStats();
        
        return {
            totalModels: models.length,
            activeModel: this.ollamaClient.getActiveModel(),
            connectionStatus: this.ollamaClient.isConnected(),
            categories: this.getCategoryBreakdown(models),
            performance: routerStats,
            lastRefresh: new Date().toISOString()
        };
    }

    /**
     * Get model category breakdown
     */
    getCategoryBreakdown(models) {
        const categories = {};
        
        models.forEach(model => {
            const category = this.categorizeModel(model.name);
            categories[category] = (categories[category] || 0) + 1;
        });
        
        return categories;
    }

    /**
     * Clean up resources
     */
    cleanup() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ModelManager;
} else {
    window.ModelManager = ModelManager;
}