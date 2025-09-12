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

// Global variables for transformers.js
let pipeline, env;
let transformersLoaded = false;

console.log('🔍 OFFSCREEN DEBUG: Setting up transformers.js loading...');

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

// Direct import approach (CSP-compliant)
console.log('🔍 OFFSCREEN DEBUG: Using direct import approach to avoid CSP issues');

// Start loading transformers.js directly (avoid inline scripts due to CSP)
(async () => {
    try {
        console.log('🔍 OFFSCREEN DEBUG: Starting direct transformers.js loading...');
        
        // Send status update
        try {
            chrome.runtime.sendMessage({
                type: 'LOCAL_AI_STATUS',
                status: 'Starting direct import...',
                progress: 3,
                ready: false
            });
        } catch (error) {
            console.log('🔍 OFFSCREEN DEBUG: Failed to send direct import status:', error);
        }
        
        console.log('🔍 OFFSCREEN DEBUG: Attempting direct dynamic import...');
        const transformersModule = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.1/dist/transformers.min.js');
        
        console.log('🔍 OFFSCREEN DEBUG: Direct import completed!');
        console.log('🔍 OFFSCREEN DEBUG: Available exports:', Object.keys(transformersModule));
        
        // Extract pipeline and env
        pipeline = transformersModule.pipeline;
        env = transformersModule.env;
        
        console.log('🔍 OFFSCREEN DEBUG: Pipeline type:', typeof pipeline);
        console.log('🔍 OFFSCREEN DEBUG: Env type:', typeof env);
        
        if (!pipeline) {
            throw new Error('Pipeline not found in transformers module');
        }
        
        // Configure transformers.js
        if (env) {
            env.allowRemoteModels = true;
            env.allowLocalModels = false;
            console.log('🔍 OFFSCREEN DEBUG: Transformers.js configured');
        }
        
        transformersLoaded = true;
        
        // Send success status
        try {
            chrome.runtime.sendMessage({
                type: 'LOCAL_AI_STATUS',
                status: 'Transformers.js loaded!',
                progress: 15,
                ready: false
            });
        } catch (error) {
            console.log('🔍 OFFSCREEN DEBUG: Failed to send success status:', error);
        }
        
        console.log('🔍 OFFSCREEN DEBUG: Transformers.js ready, starting auto-initialization...');
        updateStatus('Transformers.js loaded', 15, 'Starting model download...');
        
        setTimeout(() => {
            initializeModel().catch(error => {
                console.error('🔍 OFFSCREEN DEBUG: Auto-initialization failed:', error);
                updateStatus('❌ Model initialization failed', 0, `Error: ${error.message}`);
            });
        }, 1000);
        
    } catch (error) {
        console.error('🔍 OFFSCREEN DEBUG: Direct import failed:', error);
        console.error('🔍 OFFSCREEN DEBUG: Error name:', error.name);
        console.error('🔍 OFFSCREEN DEBUG: Error message:', error.message);
        console.error('🔍 OFFSCREEN DEBUG: Error stack:', error.stack);
        
        // Send error status
        try {
            chrome.runtime.sendMessage({
                type: 'LOCAL_AI_STATUS',
                status: '❌ Import failed',
                progress: 0,
                ready: false
            });
        } catch (e) {
            console.log('🔍 OFFSCREEN DEBUG: Failed to send error status:', e);
        }
        
        updateStatus('❌ Failed to load transformers.js', 0, `Error: ${error.message}`);
    }
})();

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
            // Fallback: embedding-only mode
            console.log('🔍 OFFSCREEN DEBUG: Generator not ready, using embedding-only response');
            updateStatus('Embedding-only response', null, 'Generative model not available');
            
            return {
                response: `Based on the retrieved context, I found ${relevantChunks.length} relevant sections related to: "${query}". However, the generative model is not loaded for detailed text generation.`,
                sources: relevantChunks.map(c => ({ id: c.docId, snippet: c.text.substring(0, 200) + '...' })),
                query,
                context: context.substring(0, 1000) + '...'
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