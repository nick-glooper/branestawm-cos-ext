// Branestawm - EmbeddingGemma Integration
// Offscreen document for running local AI models with WebGPU access

import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.1/dist/transformers.min.js';

// Configure transformers.js for Chrome extension
env.allowRemoteModels = true;
env.allowLocalModels = false;

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
    if (isLoading || isReady) return;
    
    isLoading = true;
    
    try {
        updateStatus('Loading EmbeddingGemma...', 10, 'Downloading model files (first time only)');
        
        // Load the embedding model
        embedder = await pipeline(
            'feature-extraction', 
            'google/embeddinggemma-300m',
            {
                progress_callback: (data) => {
                    if (data.status === 'downloading') {
                        const progress = Math.round((data.loaded / data.total) * 100);
                        updateStatus(
                            `Loading model: ${data.name}`, 
                            10 + (progress * 0.7), 
                            `Downloaded ${Math.round(data.loaded / 1024 / 1024)}MB / ${Math.round(data.total / 1024 / 1024)}MB`
                        );
                    } else if (data.status === 'loading') {
                        updateStatus('Initializing model...', 85, 'Setting up EmbeddingGemma for inference');
                    }
                }
            }
        );
        
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
    switch (message.type) {
        case 'INIT_LOCAL_AI':
            initializeModel()
                .then(() => sendResponse({ success: true, ready: isReady }))
                .catch(error => sendResponse({ success: false, error: error.message }));
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

// Notify background script that offscreen document is ready
chrome.runtime.sendMessage({
    type: 'OFFSCREEN_READY'
}).catch(() => {
    // Ignore errors during startup
    console.log('Background script not ready yet');
});

console.log('Branestawm offscreen document loaded');