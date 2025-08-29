// Branestawm - Ollama Client
// Handles local Ollama API communication and model management

class OllamaClient {
    constructor() {
        this.baseUrl = 'http://localhost:11434';
        this.connected = false;
        this.availableModels = [];
        this.activeModel = null;
        this.connectionRetries = 0;
        this.maxRetries = 3;
        this.retryDelay = 1000; // Start with 1 second
        this.healthCheckInterval = null;
        this.requestTimeout = 30000; // 30 seconds for model responses
        this.healthCheckTimeout = 5000; // 5 seconds for health checks
        
        // Start connection monitoring
        this.initializeConnection();
    }

    /**
     * Initialize connection and start monitoring
     */
    async initializeConnection() {
        try {
            await this.checkConnection();
            if (this.connected) {
                await this.loadAvailableModels();
                this.startHealthMonitoring();
            }
        } catch (error) {
            console.log('Ollama not available at startup, will retry periodically');
            this.startConnectionRetries();
        }
    }

    /**
     * Check if Ollama service is available
     */
    async checkConnection() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.healthCheckTimeout);
            
            const response = await fetch(`${this.baseUrl}/api/tags`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                this.connected = true;
                this.connectionRetries = 0;
                return true;
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            this.connected = false;
            console.log('Ollama connection check failed:', error.message);
            return false;
        }
    }

    /**
     * Load available models from Ollama
     */
    async loadAvailableModels() {
        if (!this.connected) return [];

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.healthCheckTimeout);
            
            const response = await fetch(`${this.baseUrl}/api/tags`, {
                method: 'GET',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const data = await response.json();
                this.availableModels = data.models || [];
                
                // Set active model if none selected and models are available
                if (!this.activeModel && this.availableModels.length > 0) {
                    this.activeModel = this.availableModels[0].name;
                    this.saveActiveModel();
                }
                
                console.log(`Found ${this.availableModels.length} Ollama models:`, 
                    this.availableModels.map(m => m.name));
                
                return this.availableModels;
            } else {
                throw new Error(`Failed to load models: HTTP ${response.status}`);
            }
        } catch (error) {
            console.error('Error loading Ollama models:', error);
            this.availableModels = [];
            return [];
        }
    }

    /**
     * Send chat completion request to Ollama
     */
    async chatCompletion(messages, options = {}) {
        if (!this.connected || !this.activeModel) {
            throw new Error('Ollama not connected or no active model');
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);

            const requestBody = {
                model: this.activeModel,
                messages: messages,
                stream: false,
                options: {
                    temperature: options.temperature || 0.7,
                    top_k: options.top_k || 40,
                    top_p: options.top_p || 0.9,
                    num_predict: options.max_tokens || -1
                }
            };

            const response = await fetch(`${this.baseUrl}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            
            if (data.message && data.message.content) {
                return {
                    content: data.message.content,
                    model: this.activeModel,
                    source: 'ollama',
                    usage: data.usage || {}
                };
            } else {
                throw new Error('Invalid response format from Ollama');
            }

        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('Ollama request timeout - model may be loading');
            }
            console.error('Ollama chat completion error:', error);
            throw error;
        }
    }

    /**
     * Start health monitoring
     */
    startHealthMonitoring() {
        // Check connection every 30 seconds
        this.healthCheckInterval = setInterval(async () => {
            const wasConnected = this.connected;
            await this.checkConnection();
            
            // If connection status changed, update models
            if (this.connected && !wasConnected) {
                await this.loadAvailableModels();
                console.log('Ollama connection restored');
            } else if (!this.connected && wasConnected) {
                console.log('Ollama connection lost');
            }
        }, 30000);
    }

    /**
     * Start connection retry logic with exponential backoff
     */
    startConnectionRetries() {
        if (this.connectionRetries >= this.maxRetries) return;

        setTimeout(async () => {
            this.connectionRetries++;
            console.log(`Ollama connection retry ${this.connectionRetries}/${this.maxRetries}`);
            
            if (await this.checkConnection()) {
                await this.loadAvailableModels();
                this.startHealthMonitoring();
                console.log('Ollama connection established');
            } else if (this.connectionRetries < this.maxRetries) {
                this.retryDelay *= 2; // Exponential backoff
                this.startConnectionRetries();
            } else {
                console.log('Max Ollama connection retries reached');
            }
        }, this.retryDelay);
    }

    /**
     * Set active model
     */
    async setActiveModel(modelName) {
        if (!this.availableModels.find(m => m.name === modelName)) {
            throw new Error(`Model ${modelName} not available`);
        }
        
        this.activeModel = modelName;
        this.saveActiveModel();
        console.log(`Active Ollama model set to: ${modelName}`);
    }

    /**
     * Get model information
     */
    getModelInfo(modelName = null) {
        const targetModel = modelName || this.activeModel;
        return this.availableModels.find(m => m.name === targetModel);
    }

    /**
     * Check if specific model is available
     */
    isModelAvailable(modelName) {
        return this.availableModels.some(m => m.name === modelName);
    }

    /**
     * Get connection status
     */
    isConnected() {
        return this.connected;
    }

    /**
     * Get available models
     */
    getAvailableModels() {
        return this.availableModels.map(m => ({
            name: m.name,
            size: m.size,
            modified_at: m.modified_at,
            digest: m.digest
        }));
    }

    /**
     * Get active model name
     */
    getActiveModel() {
        return this.activeModel;
    }

    /**
     * Estimate model loading time (heuristic based on model size)
     */
    estimateLoadTime(modelName = null) {
        const model = this.getModelInfo(modelName);
        if (!model || !model.size) return 0;
        
        // Rough estimate: 1GB = 2 seconds loading time
        const sizeInGB = model.size / (1024 * 1024 * 1024);
        return Math.ceil(sizeInGB * 2);
    }

    /**
     * Save active model to storage
     */
    saveActiveModel() {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.set({
                ollamaActiveModel: this.activeModel
            });
        } else {
            localStorage.setItem('ollamaActiveModel', this.activeModel);
        }
    }

    /**
     * Load active model from storage
     */
    async loadActiveModel() {
        try {
            if (typeof chrome !== 'undefined' && chrome.storage) {
                const result = await chrome.storage.local.get(['ollamaActiveModel']);
                if (result.ollamaActiveModel) {
                    this.activeModel = result.ollamaActiveModel;
                }
            } else {
                const saved = localStorage.getItem('ollamaActiveModel');
                if (saved) {
                    this.activeModel = saved;
                }
            }
        } catch (error) {
            console.error('Error loading active model:', error);
        }
    }

    /**
     * Clean up resources
     */
    cleanup() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
    }

    /**
     * Force refresh of models and connection
     */
    async refresh() {
        await this.checkConnection();
        if (this.connected) {
            await this.loadAvailableModels();
        }
        return {
            connected: this.connected,
            models: this.availableModels,
            activeModel: this.activeModel
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OllamaClient;
} else {
    window.OllamaClient = OllamaClient;
}