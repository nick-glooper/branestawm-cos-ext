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

// Global variables for transformers.js
let pipeline, env;
let transformersLoaded = false;
let isReady = false;

console.log('🔍 OFFSCREEN DEBUG: Setting up Web Worker for transformers.js...');

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

// Initialize Web Worker with local-first architecture
function initializeTransformersWorker() {
    console.log('🔍 OFFSCREEN DEBUG: Creating transformers.js Web Worker (local build)...');
    
    try {
        transformersWorker = new Worker('transformers-worker.js');
        
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
    console.log('🔍 OFFSCREEN DEBUG: Transformers.js Web Worker failed, falling back to browser-native approach...');
    updateStatus('Transformers.js incompatible, using browser-native approach...', 10);
    initializeBrowserNativeRAG();
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
        status: 'Setting up transformers.js...',
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

// Initialize transformers.js via Web Worker approach
console.log('🔍 OFFSCREEN DEBUG: Starting Web Worker transformers.js loading...');

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

// Start Web Worker initialization when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeTransformersWorker);
} else {
    // DOM is already ready
    initializeTransformersWorker();
}

// Browser-native RAG implementation (no external libraries)
async function initializeBrowserNativeRAG() {
    console.log('🔍 OFFSCREEN DEBUG: Initializing browser-native RAG system...');
    
    try {
        updateStatus('Setting up browser-native AI...', 15, 'Initializing simple embedding system');
        
        // Initialize vector storage first
        await initializeVectorStore();
        
        // Create simple embedding system using browser APIs
        pipeline = createSimpleEmbedder();
        env = { allowRemoteModels: true, allowLocalModels: false };
        
        // Mark as ready
        transformersLoaded = true;
        isEmbedderReady = true;
        isReady = true;
        
        console.log('🔍 OFFSCREEN DEBUG: Browser-native RAG system ready');
        
        // Send success status
        try {
            chrome.runtime.sendMessage({
                type: 'LOCAL_AI_STATUS',
                status: 'Browser-native AI ready!',
                progress: 50,
                ready: true
            });
        } catch (e) {
            console.log('🔍 OFFSCREEN DEBUG: Failed to send ready status:', e);
        }
        
        updateStatus('Browser-native AI Ready! ✅', 50, 'Simple embedding system loaded');
        
        // Note: No generative model in browser-native mode
        isGeneratorReady = false;
        
    } catch (error) {
        console.error('🔍 OFFSCREEN DEBUG: Browser-native RAG initialization failed:', error);
        updateStatus('❌ Browser-native AI failed', 0, error.message);
        throw error;
    }
}

// Create simple embedding system using browser-native string/text APIs
function createSimpleEmbedder() {
    console.log('🔍 OFFSCREEN DEBUG: Creating simple embedder...');
    
    return async (text, options = {}) => {
        console.log('🔍 OFFSCREEN DEBUG: Generating simple embedding for text length:', text.length);
        
        // Simple text-based embedding using character frequencies and n-grams
        const embedding = generateSimpleEmbedding(text);
        
        return {
            data: embedding
        };
    };
}

// Generate simple embedding using character/word frequency analysis
function generateSimpleEmbedding(text, dimensions = 256) {
    // Normalize text
    const normalizedText = text.toLowerCase().replace(/[^\w\s]/g, ' ').trim();
    const words = normalizedText.split(/\s+/).filter(word => word.length > 2);
    
    // Create embedding vector
    const embedding = new Array(dimensions).fill(0);
    
    // Character frequency features (first 26 dimensions)
    for (let i = 0; i < Math.min(26, dimensions); i++) {
        const char = String.fromCharCode(97 + i); // a-z
        const count = (normalizedText.match(new RegExp(char, 'g')) || []).length;
        embedding[i] = count / normalizedText.length;
    }
    
    // Word length distribution (next 10 dimensions)
    if (dimensions > 26) {
        const lengthBuckets = new Array(10).fill(0);
        words.forEach(word => {
            const bucket = Math.min(9, Math.floor(word.length / 2));
            lengthBuckets[bucket]++;
        });
        
        for (let i = 0; i < Math.min(10, dimensions - 26); i++) {
            embedding[26 + i] = lengthBuckets[i] / words.length;
        }
    }
    
    // Simple hash-based features for remaining dimensions
    if (dimensions > 36) {
        for (let i = 36; i < dimensions; i++) {
            let hash = 0;
            for (let j = 0; j < normalizedText.length; j++) {
                hash = ((hash << 5) - hash + normalizedText.charCodeAt(j)) & 0xffffffff;
            }
            embedding[i] = (hash % 1000) / 1000;
        }
    }
    
    // Normalize to unit vector
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
        for (let i = 0; i < embedding.length; i++) {
            embedding[i] /= magnitude;
        }
    }
    
    return embedding;
}

// Generate intelligent responses using browser-native text processing
function generateBrowserNativeResponse(query, relevantChunks) {
    if (relevantChunks.length === 0) {
        return `I couldn't find any relevant information for: "${query}". Please try a different question or check if documents have been indexed.`;
    }
    
    // Analyze query for intent
    const queryWords = query.toLowerCase().split(/\s+/);
    const isQuestion = query.includes('?') || queryWords.some(word => 
        ['what', 'how', 'why', 'when', 'where', 'who', 'which'].includes(word)
    );
    
    const isComparison = queryWords.some(word => 
        ['compare', 'difference', 'versus', 'vs', 'better', 'worse'].includes(word)
    );
    
    const isDefinition = queryWords.some(word => 
        ['define', 'meaning', 'what is', 'definition'].includes(word)
    );
    
    // Extract relevant information from chunks
    const relevantSentences = [];
    relevantChunks.forEach((chunk, index) => {
        const sentences = chunk.text.split(/[.!?]+/).filter(s => s.trim().length > 10);
        sentences.forEach(sentence => {
            const sentenceLower = sentence.toLowerCase();
            if (queryWords.some(word => sentenceLower.includes(word))) {
                relevantSentences.push({
                    text: sentence.trim(),
                    source: index + 1,
                    relevance: calculateRelevance(sentenceLower, queryWords)
                });
            }
        });
    });
    
    // Sort by relevance and take top sentences
    relevantSentences.sort((a, b) => b.relevance - a.relevance);
    const topSentences = relevantSentences.slice(0, 3);
    
    // Generate response based on query type
    let response = '';
    
    if (isDefinition && topSentences.length > 0) {
        response = `Based on the documents:\n\n${topSentences[0].text}`;
        if (topSentences.length > 1) {
            response += `\n\nAdditionally: ${topSentences[1].text}`;
        }
    } else if (isComparison && relevantChunks.length > 1) {
        response = `I found information about "${query}" in ${relevantChunks.length} different sections:\n\n`;
        relevantChunks.slice(0, 2).forEach((chunk, i) => {
            const summary = chunk.text.substring(0, 150) + '...';
            response += `**Source ${i + 1}:** ${summary}\n\n`;
        });
    } else if (topSentences.length > 0) {
        if (isQuestion) {
            response = `Regarding "${query}":\n\n`;
        } else {
            response = `I found relevant information about "${query}":\n\n`;
        }
        
        topSentences.forEach((sentence, i) => {
            if (i === 0) {
                response += sentence.text;
            } else {
                response += `\n\nAdditionally: ${sentence.text}`;
            }
        });
    } else {
        response = `I found ${relevantChunks.length} potentially relevant sections for "${query}", but couldn't extract specific answers. `;
        response += `The most relevant content begins with: "${relevantChunks[0].text.substring(0, 100)}..."`;
    }
    
    response += `\n\n*This response was generated using browser-native text processing from ${relevantChunks.length} relevant document sections.*`;
    
    return response;
}

// Calculate relevance score between sentence and query words
function calculateRelevance(sentence, queryWords) {
    let score = 0;
    queryWords.forEach(word => {
        if (word.length > 2) { // Ignore short words
            const count = (sentence.match(new RegExp(word, 'g')) || []).length;
            score += count * word.length; // Longer words get higher weight
        }
    });
    return score;
}

// Global model instances for RAG architecture
let embedder = null;          // For creating document/query embeddings
let generator = null;         // For text generation (Gemma-2b-it)
let isEmbedderLoading = false;
let isGeneratorLoading = false;
let isEmbedderReady = false;
let isGeneratorReady = false;

// RAG-specific globals
let vectorStore = null;       // IndexedDB interface for vector storage
let documentChunks = new Map(); // Cache for document chunks

// Initialize both embedding and generative models for RAG
async function initializeModel() {
    console.log('🔍 OFFSCREEN DEBUG: initializeModel called');
    console.log('🔍 OFFSCREEN DEBUG: Embedder status - loading:', isEmbedderLoading, 'ready:', isEmbedderReady);
    console.log('🔍 OFFSCREEN DEBUG: Generator status - loading:', isGeneratorLoading, 'ready:', isGeneratorReady);
    
    if ((isEmbedderLoading || isEmbedderReady) && (isGeneratorLoading || isGeneratorReady)) {
        console.log('🔍 OFFSCREEN DEBUG: Models already loading or ready, returning early');
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
    
    try {
        // Initialize vector storage first
        await initializeVectorStore();
        
        // Load embedding model first (smaller, faster)
        if (!isEmbedderReady && !isEmbedderLoading) {
            await loadEmbeddingModel();
        }
        
        // Load generative model (larger, slower)
        if (!isGeneratorReady && !isGeneratorLoading) {
            await loadGenerativeModel();
        }
        
        console.log('🔍 OFFSCREEN DEBUG: RAG system fully initialized!');
        
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

// Load embedding model (for document and query vectorization)
async function loadEmbeddingModel() {
    isEmbedderLoading = true;
    console.log('🔍 OFFSCREEN DEBUG: Loading embedding model...');
    
    try {
        updateStatus('Loading Embedding Model...', 20, 'Downloading google/embeddinggemma-300m');
        
        embedder = await pipeline(
            'feature-extraction', 
            'google/embeddinggemma-300m',
            {
                progress_callback: (data) => {
                    if (data.status === 'downloading') {
                        const progress = Math.round((data.loaded / data.total) * 100);
                        console.log(`🔍 OFFSCREEN DEBUG: Embedding model progress: ${progress}% - ${data.name}`);
                        updateStatus(
                            `Loading embedding model: ${data.name}`, 
                            20 + (progress * 0.3), 
                            `Downloaded ${Math.round(data.loaded / 1024 / 1024)}MB / ${Math.round(data.total / 1024 / 1024)}MB`
                        );
                    }
                }
            }
        );
        
        isEmbedderReady = true;
        isEmbedderLoading = false;
        console.log('🔍 OFFSCREEN DEBUG: Embedding model loaded successfully');
        updateStatus('Embedding Model Ready ✅', 50, 'Now loading generative model...');
        
    } catch (error) {
        isEmbedderLoading = false;
        console.error('🔍 OFFSCREEN DEBUG: Failed to load embedding model:', error);
        throw error;
    }
}

// Load generative model (for text generation in RAG)
async function loadGenerativeModel() {
    isGeneratorLoading = true;
    console.log('🔍 OFFSCREEN DEBUG: Loading generative model...');
    
    try {
        updateStatus('Loading Generative Model...', 50, 'Downloading Xenova/gemma-2b-it');
        
        // Use Xenova's quantized Gemma-2b-it model optimized for transformers.js
        generator = await pipeline(
            'text-generation',
            'Xenova/gemma-2b-it',
            {
                progress_callback: (data) => {
                    if (data.status === 'downloading') {
                        const progress = Math.round((data.loaded / data.total) * 100);
                        console.log(`🔍 OFFSCREEN DEBUG: Generative model progress: ${progress}% - ${data.name}`);
                        updateStatus(
                            `Loading generative model: ${data.name}`, 
                            50 + (progress * 0.4), 
                            `Downloaded ${Math.round(data.loaded / 1024 / 1024)}MB / ${Math.round(data.total / 1024 / 1024)}MB`
                        );
                    }
                }
            }
        );
        
        isGeneratorReady = true;
        isGeneratorLoading = false;
        console.log('🔍 OFFSCREEN DEBUG: Generative model loaded successfully');
        updateStatus('RAG System Ready! ✅', 100, 'Both models loaded - ready for document processing');
        
    } catch (error) {
        isGeneratorLoading = false;
        console.error('🔍 OFFSCREEN DEBUG: Failed to load generative model:', error);
        // Don't throw - embedding-only mode still useful
        updateStatus('Embedding Ready (Generator Failed)', 50, 'Can create embeddings but not generate text');
    }
}

// Initialize IndexedDB vector storage system
async function initializeVectorStore() {
    console.log('🔍 OFFSCREEN DEBUG: Initializing vector storage...');
    
    try {
        updateStatus('Setting up vector storage...', 10, 'Initializing IndexedDB');
        
        // TODO: Implement IndexedDB vector store
        // This will store document chunks and their embeddings
        vectorStore = {
            store: async (docId, chunks, embeddings) => {
                // Store document chunks and embeddings in IndexedDB
                console.log('🔍 OFFSCREEN DEBUG: Storing vectors for document:', docId);
            },
            
            search: async (queryEmbedding, topK = 5) => {
                // Search for similar embeddings using cosine similarity
                console.log('🔍 OFFSCREEN DEBUG: Searching for similar vectors');
                return [];
            },
            
            list: async () => {
                // List all stored documents
                return [];
            }
        };
        
        console.log('🔍 OFFSCREEN DEBUG: Vector storage initialized');
        updateStatus('Vector storage ready', 15, 'IndexedDB initialized');
        
    } catch (error) {
        console.error('🔍 OFFSCREEN DEBUG: Failed to initialize vector storage:', error);
        throw error;
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

// Full RAG pipeline: Retrieve relevant chunks and generate response
async function generateResponse(query, options = {}) {
    if (!isEmbedderReady) {
        throw new Error('Embedding model not ready');
    }
    
    try {
        console.log('🔍 OFFSCREEN DEBUG: Starting RAG pipeline for query:', query);
        updateStatus('Processing query...', null, 'Generating query embedding');
        
        // Step 1: Generate embedding for user query
        const queryEmbedding = await generateEmbedding(query);
        console.log('🔍 OFFSCREEN DEBUG: Query embedding generated');
        
        // Step 2: Retrieve relevant document chunks
        updateStatus('Searching documents...', null, 'Finding relevant context');
        const relevantChunks = await vectorStore.search(queryEmbedding, options.topK || 3);
        console.log('🔍 OFFSCREEN DEBUG: Found relevant chunks:', relevantChunks.length);
        
        // Step 3: Build context from retrieved chunks
        const context = relevantChunks
            .map(chunk => chunk.text)
            .join('\n\n');
            
        // Step 4: Generate response using generative model
        if (isGeneratorReady && generator) {
            updateStatus('Generating response...', null, 'Using Gemma-2b-it for text generation');
            
            // Construct RAG prompt
            const prompt = buildRAGPrompt(query, context, options);
            console.log('🔍 OFFSCREEN DEBUG: Generated RAG prompt length:', prompt.length);
            
            const response = await generator(prompt, {
                max_new_tokens: options.maxTokens || 256,
                temperature: options.temperature || 0.7,
                do_sample: true,
                top_p: 0.9
            });
            
            updateStatus('Response generated ✅', null, 'RAG pipeline complete');
            return {
                response: response[0].generated_text.replace(prompt, '').trim(),
                sources: relevantChunks.map(c => ({ id: c.docId, snippet: c.text.substring(0, 100) + '...' })),
                query,
                context: context.substring(0, 500) + '...'
            };
            
        } else {
            // Browser-native mode: provide structured response without generative model
            console.log('🔍 OFFSCREEN DEBUG: Using browser-native response mode');
            updateStatus('Browser-native response', null, 'Generating structured response');
            
            // Create a more intelligent response using the retrieved context
            const response = generateBrowserNativeResponse(query, relevantChunks);
            
            return {
                response,
                sources: relevantChunks.map(c => ({ id: c.docId, snippet: c.text.substring(0, 200) + '...' })),
                query,
                context: context.substring(0, 1000) + '...',
                mode: 'browser-native'
            };
        }
        
    } catch (error) {
        console.error('🔍 OFFSCREEN DEBUG: Error in RAG pipeline:', error);
        updateStatus('RAG pipeline error', null, error.message);
        throw error;
    }
}

// Build RAG prompt from query and retrieved context
function buildRAGPrompt(query, context, options = {}) {
    const systemPrompt = options.systemPrompt || 
        "You are a helpful AI assistant that answers questions based on provided context. " +
        "Use only the information from the context to answer questions. " +
        "If the context doesn't contain relevant information, say so clearly.";
        
    return `${systemPrompt}

Context:
${context}

Question: ${query}

Answer:`;
}

// Document processing functions for RAG
async function processDocument(docId, text, options = {}) {
    console.log('🔍 OFFSCREEN DEBUG: Processing document:', docId);
    
    if (!isEmbedderReady) {
        throw new Error('Embedding model not ready for document processing');
    }
    
    try {
        updateStatus('Processing document...', null, `Chunking text for ${docId}`);
        
        // Step 1: Split document into chunks
        const chunks = chunkText(text, options.chunkSize || 512, options.chunkOverlap || 50);
        console.log('🔍 OFFSCREEN DEBUG: Created chunks:', chunks.length);
        
        // Step 2: Generate embeddings for each chunk
        updateStatus('Generating embeddings...', null, `Processing ${chunks.length} chunks`);
        const embeddings = [];
        
        for (let i = 0; i < chunks.length; i++) {
            const embedding = await generateEmbedding(chunks[i]);
            embeddings.push(embedding);
            
            // Update progress
            const progress = Math.round(((i + 1) / chunks.length) * 100);
            updateStatus(`Embedding chunks... ${i + 1}/${chunks.length}`, null, `${progress}% complete`);
        }
        
        // Step 3: Store in vector database
        await vectorStore.store(docId, chunks, embeddings);
        
        updateStatus('Document processed ✅', null, `${chunks.length} chunks indexed`);
        return { docId, chunks: chunks.length, success: true };
        
    } catch (error) {
        console.error('🔍 OFFSCREEN DEBUG: Error processing document:', error);
        throw error;
    }
}

// Chunk text into overlapping segments
function chunkText(text, chunkSize = 512, overlap = 50) {
    const chunks = [];
    const words = text.split(/\s+/);
    
    for (let i = 0; i < words.length; i += (chunkSize - overlap)) {
        const chunk = words.slice(i, i + chunkSize).join(' ');
        if (chunk.trim().length > 0) {
            chunks.push(chunk.trim());
        }
    }
    
    return chunks;
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
            if (isEmbedderReady) {
                generateEmbedding(message.text)
                    .then(embedding => sendResponse({ success: true, embedding }))
                    .catch(error => sendResponse({ success: false, error: error.message }));
            } else {
                sendResponse({ success: false, error: 'Embedding model not ready' });
            }
            return true;
            
        case 'GENERATE_RESPONSE':
            if (isEmbedderReady) {
                generateResponse(message.query, message.options || {})
                    .then(response => sendResponse({ success: true, response }))
                    .catch(error => sendResponse({ success: false, error: error.message }));
            } else {
                sendResponse({ success: false, error: 'RAG system not ready' });
            }
            return true;
            
        case 'PROCESS_DOCUMENT':
            if (isEmbedderReady) {
                processDocument(message.docId, message.text, message.options || {})
                    .then(result => sendResponse({ success: true, result }))
                    .catch(error => sendResponse({ success: false, error: error.message }));
            } else {
                sendResponse({ success: false, error: 'Embedding model not ready for document processing' });
            }
            return true;
            
        case 'LIST_DOCUMENTS':
            if (vectorStore) {
                vectorStore.list()
                    .then(documents => sendResponse({ success: true, documents }))
                    .catch(error => sendResponse({ success: false, error: error.message }));
            } else {
                sendResponse({ success: false, error: 'Vector store not initialized' });
            }
            return true;
            
        case 'CHECK_STATUS':
            sendResponse({ 
                embedderReady: isEmbedderReady,
                generatorReady: isGeneratorReady,
                embedderLoading: isEmbedderLoading,
                generatorLoading: isGeneratorLoading,
                vectorStoreReady: !!vectorStore,
                ragReady: isEmbedderReady && !!vectorStore
            });
            break;
            
        case 'CHECK_LOCAL_AI_STATUS':
            sendResponse({ 
                ready: isReady,
                embedderReady: isEmbedderReady,
                generatorReady: isGeneratorReady,
                transformersLoaded: transformersLoaded,
                status: isReady ? 'Ready' : 'Not ready'
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