// Transformers.js Web Worker for Chrome Extension
// Runs in a separate context with different CSP rules

console.log('🔍 WORKER: Transformers.js worker starting...');

// Global variables
let transformersModule = null;
let pipeline = null;
let env = null;

// Models
let embedder = null;
let generator = null;

// Load transformers.js via importScripts (works in Web Workers)
async function loadTransformersJS() {
    try {
        console.log('🔍 WORKER: Attempting to load transformers.js via importScripts...');
        
        // Try multiple CDN sources
        const cdnUrls = [
            'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.1/dist/transformers.min.js',
            'https://unpkg.com/@xenova/transformers@2.17.1/dist/transformers.min.js'
        ];
        
        for (const url of cdnUrls) {
            try {
                console.log(`🔍 WORKER: Trying ${url}...`);
                importScripts(url);
                
                // Check if transformers is available
                if (typeof Transformers !== 'undefined') {
                    transformersModule = Transformers;
                    console.log('🔍 WORKER: Transformers.js loaded successfully via importScripts');
                    break;
                } else if (typeof transformers !== 'undefined') {
                    transformersModule = transformers;
                    console.log('🔍 WORKER: transformers loaded successfully via importScripts');
                    break;
                }
            } catch (error) {
                console.log(`🔍 WORKER: Failed to load from ${url}:`, error.message);
            }
        }
        
        if (!transformersModule) {
            throw new Error('Could not load transformers.js from any CDN');
        }
        
        // Extract pipeline and env
        pipeline = transformersModule.pipeline;
        env = transformersModule.env;
        
        if (!pipeline) {
            throw new Error('Pipeline not found in transformers module');
        }
        
        // Configure transformers.js
        if (env) {
            env.allowRemoteModels = true;
            env.allowLocalModels = false;
            console.log('🔍 WORKER: Transformers.js environment configured');
        }
        
        return true;
        
    } catch (error) {
        console.error('🔍 WORKER: Failed to load transformers.js:', error);
        throw error;
    }
}

// Initialize models
async function initializeModels() {
    try {
        console.log('🔍 WORKER: Initializing embedding model...');
        postMessage({ type: 'status', message: 'Loading embedding model...', progress: 20 });
        
        // Load embedding model
        embedder = await pipeline('feature-extraction', 'google/embedding-gecko@q8', {
            quantized: true
        });
        
        console.log('🔍 WORKER: Embedding model loaded');
        postMessage({ type: 'status', message: 'Loading generative model...', progress: 60 });
        
        // Load generative model  
        generator = await pipeline('text-generation', 'Xenova/gemma-2b-it', {
            quantized: true
        });
        
        console.log('🔍 WORKER: All models loaded successfully');
        postMessage({ type: 'models_ready', ready: true });
        
    } catch (error) {
        console.error('🔍 WORKER: Model initialization failed:', error);
        postMessage({ type: 'error', error: error.message });
    }
}

// Generate embedding
async function generateEmbedding(text) {
    try {
        if (!embedder) {
            throw new Error('Embedding model not ready');
        }
        
        const result = await embedder(text);
        return result.data;
        
    } catch (error) {
        console.error('🔍 WORKER: Embedding generation failed:', error);
        throw error;
    }
}

// Generate text response
async function generateText(prompt, options = {}) {
    try {
        if (!generator) {
            throw new Error('Generator model not ready');
        }
        
        const result = await generator(prompt, {
            max_length: options.maxLength || 100,
            temperature: options.temperature || 0.7,
            ...options
        });
        
        return result[0].generated_text;
        
    } catch (error) {
        console.error('🔍 WORKER: Text generation failed:', error);
        throw error;
    }
}

// Handle messages from main thread
self.onmessage = async function(e) {
    const { type, data } = e.data;
    
    try {
        switch (type) {
            case 'load_transformers':
                await loadTransformersJS();
                postMessage({ type: 'transformers_loaded', success: true });
                break;
                
            case 'init_models':
                await initializeModels();
                break;
                
            case 'generate_embedding':
                const embedding = await generateEmbedding(data.text);
                postMessage({ 
                    type: 'embedding_result', 
                    id: data.id,
                    embedding: embedding 
                });
                break;
                
            case 'generate_text':
                const text = await generateText(data.prompt, data.options);
                postMessage({ 
                    type: 'text_result', 
                    id: data.id,
                    text: text 
                });
                break;
                
            default:
                console.log('🔍 WORKER: Unknown message type:', type);
        }
        
    } catch (error) {
        postMessage({ 
            type: 'error', 
            id: data?.id,
            error: error.message 
        });
    }
};

console.log('🔍 WORKER: Transformers.js worker ready for messages');