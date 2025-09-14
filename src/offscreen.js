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
let pipeline, env;
let transformersLoaded = false;
let isReady = false;

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

// Web Worker approach for transformers.js loading
let transformersWorker = null;
let workerReady = false;

// Initialize Web LLM Worker with latest models
function initializeWebLLMWorker() {
    console.log('🚀 OFFSCREEN DEBUG: Creating Web LLM Worker (latest models)...');
    
    try {
        transformersWorker = new Worker(chrome.runtime.getURL('webllm-worker.js'), { type: 'module' });
        
        // Handle worker messages
        transformersWorker.onmessage = function(e) {
            const message = e.data;
            const { type } = message;
            
            switch (type) {
                case 'status':
                    updateStatus(message.message, message.progress);
                    break;
                    
                case 'model-progress':
                    updateStatus(message.text, message.progress);
                    break;
                    
                case 'init-complete':
                    if (message.success) {
                        console.log('🚀 OFFSCREEN DEBUG: All Web LLM models initialized successfully!');
                        transformersLoaded = true;
                        isReady = true;
                        updateStatus('✅ Local AI ready with Web LLM!', 100, message.message);
                        
                        chrome.runtime.sendMessage({
                            type: 'LOCAL_AI_STATUS',
                            status: '✅ All 4 AI models ready with Web LLM!',
                            progress: 100,
                            ready: true
                        });
                    } else {
                        console.error('🚀 OFFSCREEN DEBUG: Web LLM model initialization failed:', message.error);
                        handleTransformersFailure(new Error(message.error));
                    }
                    break;
                    
                case 'error':
                    console.error('🚀 OFFSCREEN DEBUG: Web LLM Worker error:', message.error);
                    handleTransformersFailure(new Error(message.error));
                    break;
                    
                default:
                    console.log('🚀 OFFSCREEN DEBUG: Unknown message type from Web LLM Worker:', type);
            }
        };
        
        transformersWorker.onerror = function(error) {
            console.error('🚀 OFFSCREEN DEBUG: Web LLM Worker error:', error);
            handleTransformersFailure(error);
        };
        
        // Initialize the worker
        const extensionBaseURL = chrome.runtime.getURL('');
        console.log('🚀 OFFSCREEN DEBUG: Extension base URL:', extensionBaseURL);
        
        transformersWorker.postMessage({
            type: 'init',
            data: { extensionBaseURL }
        });
        
    } catch (error) {
        console.error('🚀 OFFSCREEN DEBUG: Failed to create Web LLM Worker:', error);
        handleTransformersFailure(error);
    }
}

// Initialize Web Worker with local-first architecture (Legacy transformers.js)
function initializeTransformersWorker() {
    console.log('🔍 OFFSCREEN DEBUG: Creating transformers.js Web Worker (local build)...');
    
    try {
        transformersWorker = new Worker(chrome.runtime.getURL('transformers-worker.js'), { type: 'module' });
        
        // Handle worker messages
        transformersWorker.onmessage = function(e) {
            const message = e.data;
            const { type } = message;
            
            switch (type) {
                case 'status':
                    updateStatus(message.message, message.progress);
                    break;
                    
                case 'init-complete':
                    if (message.success) {
                        console.log('🔍 OFFSCREEN DEBUG: All AI models initialized successfully!');
                        workerReady = true;
                        isReady = true;
                        updateStatus('All AI models ready! ✅', 100);
                    } else {
                        console.error('🔍 OFFSCREEN DEBUG: AI model initialization failed:', message.error);
                        handleTransformersFailure(new Error(message.error));
                    }
                    break;
                    
                case 'error':
                    console.error('🔍 OFFSCREEN DEBUG: Worker error:', message.error);
                    handleTransformersFailure(new Error(message.error || 'Unknown worker error'));
                    break;
                    
                case 'classify-result':
                case 'embed-result':
                case 'entities-result':
                case 'generate-result':
                    // Handle AI task results
                    handleAIResult(message);
                    break;
                    
                default:
                    console.log('🔍 OFFSCREEN DEBUG: Unknown worker message:', type);
            }
        };
        
        transformersWorker.onerror = function(error) {
            console.error('🔍 OFFSCREEN DEBUG: Worker error:', error);
            handleTransformersFailure(error);
        };
        
        // **CRITICAL:** Get the extension's base URL and send it to the worker
        const extensionBaseURL = chrome.runtime.getURL('/');
        console.log('🔍 OFFSCREEN DEBUG: Extension base URL:', extensionBaseURL);
        
        // Initialize AI models in the worker with the base URL
        updateStatus('Initializing AI models...', 5);
        transformersWorker.postMessage({ 
            type: 'init', 
            data: { extensionBaseURL } 
        });
        
    } catch (error) {
        console.error('🔍 OFFSCREEN DEBUG: Failed to create Web Worker:', error);
        handleTransformersFailure(error);
    }
}

// Handle transformers loading failure
function handleTransformersFailure(error) {
    console.error('🔍 OFFSCREEN DEBUG: Transformers.js Web Worker failed:', error);
    updateStatus('❌ AI model initialization failed', 0, error.message);
    
    // Send error status to background
    chrome.runtime.sendMessage({
        type: 'LOCAL_AI_ERROR',
        error: error.message || 'Transformers.js Web Worker failed'
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

// Load transformers.js via script tag (for UMD builds)
function loadViaScriptTag(url, globalVarName, timeout = 20000) {
    return new Promise((resolve, reject) => {
        console.log(`🔍 OFFSCREEN DEBUG: Creating script tag for ${url}`);
        
        const script = document.createElement('script');
        script.src = url;
        script.type = 'text/javascript'; // Regular script, not module
        
        // Add timeout
        const timeoutId = setTimeout(() => {
            console.error(`🔍 OFFSCREEN DEBUG: Script loading timeout for ${url}`);
            reject(new Error(`Script loading timeout after ${timeout}ms`));
        }, timeout);
        
        script.onload = () => {
            clearTimeout(timeoutId);
            console.log(`🔍 OFFSCREEN DEBUG: Script loaded, checking for global: ${globalVarName}`);
            
            // Give the script a moment to initialize
            setTimeout(() => {
                // Check if the global variable exists
                if (window[globalVarName]) {
                    console.log(`🔍 OFFSCREEN DEBUG: Found global ${globalVarName}:`, typeof window[globalVarName]);
                    resolve(window[globalVarName]);
                } else {
                    console.log(`🔍 OFFSCREEN DEBUG: Global ${globalVarName} not found. Available globals:`, Object.keys(window).filter(key => key.toLowerCase().includes('transform')));
                    
                    // Try common transformer.js global names
                    const possibleNames = ['Transformers', 'transformers', 'TransformersJS', 'HuggingFace', 'XenovaTransformers'];
                    for (const name of possibleNames) {
                        if (window[name]) {
                            console.log(`🔍 OFFSCREEN DEBUG: Found alternative global: ${name}`);
                            resolve(window[name]);
                            return;
                        }
                    }
                    
                    reject(new Error(`Global variable ${globalVarName} not found after script load`));
                }
            }, 100); // Small delay for initialization
        };
        
        script.onerror = (error) => {
            clearTimeout(timeoutId);
            console.error(`🔍 OFFSCREEN DEBUG: Script tag loading failed:`, error);
            reject(new Error(`Script tag loading failed`));
        };
        
        // Append script to start loading
        document.head.appendChild(script);
        console.log(`🔍 OFFSCREEN DEBUG: Script tag appended for ${url}`);
    });
}

// Initialize Web LLM via Web Worker approach
console.log('🔍 OFFSCREEN DEBUG: Starting Web Worker Web LLM loading...');

// Send status update
try {
    chrome.runtime.sendMessage({
        type: 'LOCAL_AI_STATUS',
        status: 'Starting Web Worker approach...',
        progress: 3,
        ready: false
    });
} catch (error) {
    console.log('🔍 OFFSCREEN DEBUG: Failed to send Web Worker status:', error);
}

// Start Web LLM Worker initialization when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeWebLLMWorker);
} else {
    // DOM is already ready
    initializeWebLLMWorker();
}

// AI processing functions - these delegate to the Web Worker
async function generateEmbedding(text) {
    if (!workerReady || !transformersWorker) {
        throw new Error('AI models not ready. Please wait for initialization to complete.');
    }
    
    return new Promise((resolve, reject) => {
        const id = Date.now().toString();
        
        const handleResponse = (e) => {
            const message = e.data;
            if (message.type === 'embed-result' && message.id === id) {
                transformersWorker.removeEventListener('message', handleResponse);
                resolve(message.embedding);
            } else if (message.type === 'error' && message.id === id) {
                transformersWorker.removeEventListener('message', handleResponse);
                reject(new Error(message.error));
            }
        };
        
        transformersWorker.addEventListener('message', handleResponse);
        transformersWorker.postMessage({
            type: 'embed',
            data: { id, text }
        });
    });
}

async function generateText(prompt, options = {}) {
    if (!workerReady || !transformersWorker) {
        throw new Error('AI models not ready. Please wait for initialization to complete.');
    }
    
    return new Promise((resolve, reject) => {
        const id = Date.now().toString();
        
        const handleResponse = (e) => {
            const message = e.data;
            if (message.type === 'generate-result' && message.id === id) {
                transformersWorker.removeEventListener('message', handleResponse);
                resolve(message.text);
            } else if (message.type === 'error' && message.id === id) {
                transformersWorker.removeEventListener('message', handleResponse);
                reject(new Error(message.error));
            }
        };
        
        transformersWorker.addEventListener('message', handleResponse);
        transformersWorker.postMessage({
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
console.log('🔍 OFFSCREEN DEBUG: Auto-initialization will trigger after Web LLM loads');
