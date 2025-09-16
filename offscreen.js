// Branestawm - RAG Architecture Integration
// Offscreen document for running local AI models with WebGPU access

console.log('🔍 OFFSCREEN DEBUG: RAG SCRIPT LOADING STARTED...');
console.log('🔍 OFFSCREEN DEBUG: Date:', new Date().toISOString());

// Immediate status update to confirm script execution
try {
    chrome.runtime.sendMessage({
        type: 'LOCAL_AI_STATUS',
        status: 'Offscreen script loading...',
        progress: 1,
        ready: false
    });
    console.log('🔍 OFFSCREEN DEBUG: Initial status message sent');
} catch (error) {
    console.log('🔍 OFFSCREEN DEBUG: Failed to send initial status:', error);
}

console.log('🔍 OFFSCREEN DEBUG: Basic script execution working');

// Send HTML loaded status
try {
    chrome.runtime.sendMessage({
        type: 'LOCAL_AI_STATUS',
        status: 'Offscreen HTML loaded!',
        progress: 0.5,
        ready: false
    });
    console.log('🔍 OFFSCREEN DEBUG: HTML status message sent');
} catch (error) {
    console.log('🔍 OFFSCREEN DEBUG: Failed to send HTML status:', error);
}

// Global variables for Web LLM
let isReady = false;
let workerReady = false;

console.log('🔍 OFFSCREEN DEBUG: Setting up Web Worker for Web LLM...');

// UI elements
const statusEl = document.getElementById('status');
const progressBar = document.getElementById('progressBar');
const detailsEl = document.getElementById('details');

// Update UI status
function updateStatus(message, progress = null, details = null) {
    if (statusEl) statusEl.textContent = message;
    if (progress !== null && progressBar) progressBar.style.width = `${progress}%`;
    if (details && detailsEl) detailsEl.textContent = details;
    
    // Show detailed model progress when AI models start loading
    if (message && message.includes('Loading') && message.includes('model')) {
        showModelProgress();
        updateModelProgress(message, progress);
    }
    
    // Send status to background script
    chrome.runtime.sendMessage({
        type: 'LOCAL_AI_STATUS',
        status: message,
        progress,
        ready: isReady
    });
}

// Show detailed model progress UI
function showModelProgress() {
    const modelProgressEl = document.getElementById('modelProgress');
    const downloadInfoEl = document.getElementById('downloadInfo');
    
    if (modelProgressEl && modelProgressEl.style.display === 'none') {
        modelProgressEl.style.display = 'block';
        if (downloadInfoEl) downloadInfoEl.style.display = 'block';
    }
}

// Update individual model progress
function updateModelProgress(message, progress) {
    const modelMap = {
        'classifier': { element: 'scout', name: 'Scout', emoji: '🔍' },
        'embedding': { element: 'indexer', name: 'Indexer', emoji: '📊' },
        'NER': { element: 'extractor', name: 'Extractor', emoji: '🏷️' },
        'generative': { element: 'synthesizer', name: 'Synthesizer', emoji: '✨' }
    };
    
    // Determine which model is being loaded
    let currentModel = null;
    for (const [key, model] of Object.entries(modelMap)) {
        if (message.toLowerCase().includes(key.toLowerCase())) {
            currentModel = model;
            break;
        }
    }
    
    if (currentModel) {
        const progressEl = document.getElementById(`${currentModel.element}Progress`);
        const statusEl = document.getElementById(`${currentModel.element}Status`);
        
        if (progressEl && statusEl) {
            // Show download progress or completion
            if (message.includes('Loading')) {
                progressEl.style.width = '50%'; // Downloading
                statusEl.textContent = 'Downloading...';
                statusEl.className = 'model-status downloading';
            } else if (message.includes('loaded')) {
                progressEl.style.width = '100%'; // Complete
                statusEl.textContent = 'Ready ✅';
                statusEl.className = 'model-status complete';
            }
        }
    }
}

// Web Worker for Web LLM
let webllmWorker = null;

// Initialize ONNX Runtime AI Worker with team of specialists
function initializeONNXWorker() {
    console.log('🧠 OFFSCREEN DEBUG: Creating ONNX Runtime Worker (team of specialists)...');
    
    try {
        webllmWorker = new Worker(chrome.runtime.getURL('webllm-worker.js'));
        
        // Handle worker messages
        webllmWorker.onmessage = function(e) {
            const message = e.data;
            const { type } = message;
            
            switch (type) {
                case 'status':
                    updateStatus(message.message, message.progress);
                    break;
                    
                case 'init-complete':
                    if (message.success) {
                        console.log('🧠 OFFSCREEN DEBUG: ONNX team of specialists initialized');
                        workerReady = true;
                        isReady = true;
                        console.log('🔍 OFFSCREEN DEBUG: Setting isReady = true, workerReady =', workerReady);
                        updateStatus('🧠 Team of specialists ready!', 100, message.message);
                        
                        chrome.runtime.sendMessage({
                            type: 'LOCAL_AI_STATUS',
                            status: message.message,
                            progress: 100,
                            ready: true
                        });
                    } else {
                        console.error('🧠 OFFSCREEN DEBUG: ONNX initialization failed:', message.error);
                        handleAIFailure(new Error(message.error));
                    }
                    break;
                    
                case 'error':
                    console.error('🧠 OFFSCREEN DEBUG: ONNX Worker error:', message.error);
                    handleAIFailure(new Error(message.error));
                    break;
                    
                default:
                    console.log('🧠 OFFSCREEN DEBUG: Unknown message type from ONNX Worker:', type);
            }
        };
        
        webllmWorker.onerror = function(error) {
            console.error('🧠 OFFSCREEN DEBUG: ONNX Worker error:', error);
            handleAIFailure(error);
        };
        
        // Initialize the worker
        webllmWorker.postMessage({
            type: 'init',
            data: {}
        });
        
    } catch (error) {
        console.error('🧠 OFFSCREEN DEBUG: Failed to create ONNX Worker:', error);
        handleAIFailure(error);
    }
}

// Handle AI worker failure
function handleAIFailure(error) {
    console.error('🔍 OFFSCREEN DEBUG: AI Worker failed:', error);
    updateStatus('❌ AI worker initialization failed', 0, error.message);
    
    // Send error status to background
    chrome.runtime.sendMessage({
        type: 'LOCAL_AI_ERROR',
        error: error.message || 'AI Worker failed'
    });
}

// Handle AI results from worker
function handleAIResult(message) {
    const { type, id } = message;
    
    switch (type) {
        case 'classify-result':
            console.log('🔍 OFFSCREEN DEBUG: Received classification result for ID:', id);
            // Handle classification result
            break;
            
        case 'embed-result':
            console.log('🔍 OFFSCREEN DEBUG: Received embedding result for ID:', id);
            // Handle embedding result
            break;
            
        case 'entities-result':
            console.log('🔍 OFFSCREEN DEBUG: Received entities result for ID:', id);
            // Handle NER result
            break;
            
        case 'generate-result':
            console.log('🔍 OFFSCREEN DEBUG: Received generation result for ID:', id);
            // Handle text generation result
            break;
            
        default:
            console.log('🔍 OFFSCREEN DEBUG: Unknown AI result type:', type);
    }
}

// Send immediate status update
try {
    chrome.runtime.sendMessage({
        type: 'LOCAL_AI_STATUS',
        status: 'Setting up Web LLM...',
        progress: 2,
        ready: false
    });
} catch (error) {
    console.log('🔍 OFFSCREEN DEBUG: Failed to send setup status:', error);
}

// Legacy script loading function removed - Web LLM loads via worker

// Initialize AI Worker (placeholder for transformers.js)
console.log('🔍 OFFSCREEN DEBUG: Starting AI Worker initialization...');

// Send status update
try {
    chrome.runtime.sendMessage({
        type: 'LOCAL_AI_STATUS',
        status: 'Starting AI Worker...',
        progress: 3,
        ready: false
    });
} catch (error) {
    console.log('🔍 OFFSCREEN DEBUG: Failed to send AI Worker status:', error);
}

// Start ONNX Worker initialization when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeONNXWorker);
} else {
    // DOM is already ready
    initializeONNXWorker();
}

// AI processing functions - delegate to ONNX team of specialists
async function generateEmbedding(text) {
    if (!workerReady || !webllmWorker) {
        throw new Error('ONNX team of specialists not ready. Please wait for initialization.');
    }
    
    return new Promise((resolve, reject) => {
        const id = Date.now().toString();
        
        const handleResponse = (e) => {
            const message = e.data;
            if (message.type === 'embed-result' && message.id === id) {
                webllmWorker.removeEventListener('message', handleResponse);
                resolve(message.embedding);
            } else if (message.type === 'error' && message.id === id) {
                webllmWorker.removeEventListener('message', handleResponse);
                reject(new Error(message.error));
            }
        };
        
        webllmWorker.addEventListener('message', handleResponse);
        webllmWorker.postMessage({
            type: 'embed',
            data: { id, text }
        });
    });
}

async function generateText(prompt, options = {}) {
    if (!workerReady || !webllmWorker) {
        throw new Error('ONNX team of specialists not ready. Please wait for initialization.');
    }
    
    return new Promise((resolve, reject) => {
        const id = Date.now().toString();
        
        const handleResponse = (e) => {
            const message = e.data;
            if (message.type === 'generate-result' && message.id === id) {
                webllmWorker.removeEventListener('message', handleResponse);
                resolve(message.text);
            } else if (message.type === 'error' && message.id === id) {
                webllmWorker.removeEventListener('message', handleResponse);
                reject(new Error(message.error));
            }
        };
        
        webllmWorker.addEventListener('message', handleResponse);
        webllmWorker.postMessage({
            type: 'generate',
            data: { id, prompt, ...options }
        });
    });
}

// Message handlers for communication with background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('🔍 OFFSCREEN DEBUG: Received message:', message.type, message);
    
    switch (message.type) {
        case 'INIT_LOCAL_AI':
            console.log('🔍 OFFSCREEN DEBUG: Starting model initialization...');
            // Models are already initializing via Web Worker
            sendResponse({ success: true, ready: isReady });
            break;
            
        case 'GENERATE_EMBEDDING':
            if (workerReady) {
                generateEmbedding(message.text)
                    .then(embedding => sendResponse({ success: true, embedding }))
                    .catch(error => sendResponse({ success: false, error: error.message }));
            } else {
                sendResponse({ success: false, error: 'AI models not ready' });
            }
            return true; // Async response
            
        case 'GENERATE_TEXT':
            if (workerReady) {
                generateText(message.prompt, message.options || {})
                    .then(text => sendResponse({ success: true, text }))
                    .catch(error => sendResponse({ success: false, error: error.message }));
            } else {
                sendResponse({ success: false, error: 'AI models not ready' });
            }
            return true; // Async response
            
        case 'CHECK_STATUS':
            sendResponse({ 
                ready: isReady,
                workerReady: workerReady,
                status: isReady ? 'Ready' : 'Not ready'
            });
            break;
            
        case 'CHECK_LOCAL_AI_STATUS':
            console.log('🔍 OFFSCREEN DEBUG: Status check - isReady:', isReady, 'workerReady:', workerReady);
            sendResponse({ 
                ready: isReady, 
                workerReady: workerReady,
                status: isReady ? 'Ready' : 'Not ready'
            });
            break;
            
        default:
            console.log('Unknown message type:', message.type);
    }
});

// Send ready message to background script
updateStatus('Ready to load model', 0, 'Click "Setup Local AI" to begin');

console.log('🔍 OFFSCREEN DEBUG: Document ready, sending OFFSCREEN_READY message...');
chrome.runtime.sendMessage({ type: 'OFFSCREEN_READY' })
    .then(() => {
        console.log('🔍 OFFSCREEN DEBUG: OFFSCREEN_READY message sent successfully');
    })
    .catch(error => {
        console.log('🔍 OFFSCREEN DEBUG: Failed to send OFFSCREEN_READY:', error);
    });

console.log('🔍 OFFSCREEN DEBUG: Branestawm offscreen document loaded and ready for messages');
console.log('🔍 OFFSCREEN DEBUG: ONNX Runtime Web implementation with team of specialists');
