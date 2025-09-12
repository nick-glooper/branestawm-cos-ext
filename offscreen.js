// Branestawm - EmbeddingGemma Integration
// Offscreen document for running local AI models with WebGPU access

console.log('🔍 OFFSCREEN DEBUG: Script loading started...');

// Test if basic offscreen loading works first
console.log('🔍 OFFSCREEN DEBUG: Basic script execution working');

// Global variables for transformers.js
let pipeline, env;

// Load transformers.js asynchronously
(async () => {
    try {
        console.log('🔍 OFFSCREEN DEBUG: Attempting to import transformers.js...');
        console.log('🔍 OFFSCREEN DEBUG: Import URL: https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.1/dist/transformers.min.js');
        
        // Try with a timeout to detect hanging imports
        const importPromise = import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.1/dist/transformers.min.js');
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Import timeout after 30 seconds')), 30000)
        );
        
        console.log('🔍 OFFSCREEN DEBUG: Starting import with 30s timeout...');
        const transformersModule = await Promise.race([importPromise, timeoutPromise]);
        
        console.log('🔍 OFFSCREEN DEBUG: Import completed, extracting pipeline and env...');
        pipeline = transformersModule.pipeline;
        env = transformersModule.env;
        
        console.log('🔍 OFFSCREEN DEBUG: Pipeline available:', typeof pipeline);
        console.log('🔍 OFFSCREEN DEBUG: Env available:', typeof env);
        
        if (!pipeline) {
            throw new Error('Pipeline function not found in transformers module');
        }
        
        console.log('🔍 OFFSCREEN DEBUG: Transformers.js imported successfully');
        
        // Configure transformers.js for Chrome extension
        if (env) {
            env.allowRemoteModels = true;
            env.allowLocalModels = false;
            console.log('🔍 OFFSCREEN DEBUG: Transformers.js configured successfully');
        } else {
            console.warn('🔍 OFFSCREEN DEBUG: env not available for configuration');
        }
        
        // Trigger model initialization now that transformers.js is ready
        console.log('🔍 OFFSCREEN DEBUG: Transformers.js ready, starting auto-initialization...');
        setTimeout(() => {
            initializeModel().catch(error => {
                console.error('🔍 OFFSCREEN DEBUG: Auto-initialization failed:', error);
            });
        }, 1000);
        
    } catch (error) {
        console.error('🔍 OFFSCREEN DEBUG: Failed to import transformers.js:', error);
        console.error('🔍 OFFSCREEN DEBUG: Error details:', error.message, error.stack);
        
        // Send error status
        updateStatus('❌ Failed to load transformers.js', 0, `Error: ${error.message}`);
    }
})();

// Global model instance
let embedder = null;
let isLoading = false;
let isReady = false;

// UI elements
const statusEl = document.getElementById('status');
const progressBar = document.getElementById('progressBar');
const detailsEl = document.getElementById('details');

// Update UI status
function updateStatus(message, progress = null, details = null) {
    if (statusEl) statusEl.textContent = message;
    if (progress !== null && progressBar) progressBar.style.width = `${progress}%`;
    if (details && detailsEl) detailsEl.textContent = details;
    
    // Send status to background script
    chrome.runtime.sendMessage({
        type: 'LOCAL_AI_STATUS',
        status: message,
        progress,
        ready: isReady
    });
}

// Initialize EmbeddingGemma model
async function initializeModel() {
    console.log('🔍 OFFSCREEN DEBUG: initializeModel called, isLoading:', isLoading, 'isReady:', isReady);
    
    if (isLoading || isReady) {
        console.log('🔍 OFFSCREEN DEBUG: Model already loading or ready, returning early');
        return;
    }
    
    // Check if transformers.js is loaded
    if (!pipeline) {
        console.log('🔍 OFFSCREEN DEBUG: Transformers.js not loaded yet, waiting...');
        updateStatus('Waiting for transformers.js...', 5, 'Loading dependencies');
        
        // Wait for transformers.js to load (up to 10 seconds)
        for (let i = 0; i < 20; i++) {
            if (pipeline) {
                console.log('🔍 OFFSCREEN DEBUG: Transformers.js now available, proceeding');
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        if (!pipeline) {
            throw new Error('Transformers.js failed to load after 10 seconds');
        }
    }
    
    isLoading = true;
    console.log('🔍 OFFSCREEN DEBUG: Starting model download...');
    
    try {
        updateStatus('Loading EmbeddingGemma...', 10, 'Downloading model files (first time only)');
        
        console.log('🔍 OFFSCREEN DEBUG: Calling pipeline for google/embeddinggemma-300m...');
        
        // Load the embedding model
        embedder = await pipeline(
            'feature-extraction', 
            'google/embeddinggemma-300m',
            {
                progress_callback: (data) => {
                    console.log('🔍 OFFSCREEN DEBUG: Pipeline progress:', data);
                    
                    if (data.status === 'downloading') {
                        const progress = Math.round((data.loaded / data.total) * 100);
                        console.log(`🔍 OFFSCREEN DEBUG: Download progress: ${progress}% - ${data.name}`);
                        updateStatus(
                            `Loading model: ${data.name}`, 
                            10 + (progress * 0.7), 
                            `Downloaded ${Math.round(data.loaded / 1024 / 1024)}MB / ${Math.round(data.total / 1024 / 1024)}MB`
                        );
                    } else if (data.status === 'loading') {
                        console.log('🔍 OFFSCREEN DEBUG: Model loading phase started');
                        updateStatus('Initializing model...', 85, 'Setting up EmbeddingGemma for inference');
                    }
                }
            }
        );
        
        console.log('🔍 OFFSCREEN DEBUG: Pipeline completed successfully!');
        
        updateStatus('Model Ready! ✅', 100, 'EmbeddingGemma loaded successfully');
        isReady = true;
        isLoading = false;
        
        console.log('EmbeddingGemma model initialized successfully');
        
    } catch (error) {
        console.error('Failed to initialize EmbeddingGemma:', error);
        updateStatus('❌ Failed to load model', 0, `Error: ${error.message}`);
        isLoading = false;
        
        // Send error to background script
        chrome.runtime.sendMessage({
            type: 'LOCAL_AI_ERROR',
            error: error.message
        });
    }
}

// Generate embeddings for text
async function generateEmbedding(text) {
    if (!isReady || !embedder) {
        throw new Error('Model not ready. Please initialize first.');
    }
    
    try {
        updateStatus('Processing text...', null, `Generating embedding for ${text.length} characters`);
        
        const startTime = Date.now();
        const embedding = await embedder(text, { pooling: 'mean', normalize: true });
        const processingTime = Date.now() - startTime;
        
        updateStatus('Model Ready! ✅', 100, `Processed in ${processingTime}ms`);
        
        // Return the embedding as an array
        return Array.from(embedding.data);
        
    } catch (error) {
        console.error('Error generating embedding:', error);
        updateStatus('Model Ready! ✅', 100, 'Ready for processing');
        throw error;
    }
}

// Generate AI response using embeddings and retrieval
async function generateResponse(query, context = null) {
    if (!isReady) {
        throw new Error('Local AI model not ready');
    }
    
    try {
        // For now, we'll implement a simple embedding-based response
        // This can be enhanced with RAG capabilities later
        const queryEmbedding = await generateEmbedding(query);
        
        // Simple response generation based on query analysis
        let response = "I understand you're asking about: " + query;
        
        if (context) {
            const contextEmbedding = await generateEmbedding(context);
            // Calculate similarity (cosine similarity approximation)
            const similarity = cosineSimilarity(queryEmbedding, contextEmbedding);
            
            if (similarity > 0.7) {
                response = "Based on the context provided, I can help with: " + query;
            }
        }
        
        return response;
        
    } catch (error) {
        console.error('Error generating response:', error);
        throw error;
    }
}

// Utility function for cosine similarity
function cosineSimilarity(a, b) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('🔍 OFFSCREEN DEBUG: Received message:', message.type, message);
    
    switch (message.type) {
        case 'INIT_LOCAL_AI':
            console.log('🔍 OFFSCREEN DEBUG: Starting model initialization...');
            initializeModel()
                .then(() => {
                    console.log('🔍 OFFSCREEN DEBUG: Model initialization completed, isReady:', isReady);
                    sendResponse({ success: true, ready: isReady });
                })
                .catch(error => {
                    console.log('🔍 OFFSCREEN DEBUG: Model initialization failed:', error.message);
                    sendResponse({ success: false, error: error.message });
                });
            return true; // Keep message channel open for async response
            
        case 'GENERATE_EMBEDDING':
            if (isReady) {
                generateEmbedding(message.text)
                    .then(embedding => sendResponse({ success: true, embedding }))
                    .catch(error => sendResponse({ success: false, error: error.message }));
            } else {
                sendResponse({ success: false, error: 'Model not ready' });
            }
            return true;
            
        case 'GENERATE_RESPONSE':
            if (isReady) {
                generateResponse(message.query, message.context)
                    .then(response => sendResponse({ success: true, response }))
                    .catch(error => sendResponse({ success: false, error: error.message }));
            } else {
                sendResponse({ success: false, error: 'Model not ready' });
            }
            return true;
            
        case 'CHECK_STATUS':
            sendResponse({ 
                ready: isReady, 
                loading: isLoading,
                hasModel: !!embedder 
            });
            break;
            
        default:
            console.log('Unknown message type:', message.type);
    }
});

// Initialize status
updateStatus('Ready to load model', 0, 'Click "Setup Local AI" to begin');

console.log('🔍 OFFSCREEN DEBUG: Document ready, sending OFFSCREEN_READY message...');

// Notify background script that offscreen document is ready
chrome.runtime.sendMessage({
    type: 'OFFSCREEN_READY'
}).then(() => {
    console.log('🔍 OFFSCREEN DEBUG: OFFSCREEN_READY message sent successfully');
}).catch((error) => {
    console.log('🔍 OFFSCREEN DEBUG: Failed to send OFFSCREEN_READY:', error);
});

console.log('🔍 OFFSCREEN DEBUG: Branestawm offscreen document loaded and ready for messages');
console.log('🔍 OFFSCREEN DEBUG: Auto-initialization will trigger after transformers.js loads');