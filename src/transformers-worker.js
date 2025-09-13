// src/transformers-worker.js
// Web Worker for loading transformers.js locally using ES6 modules

console.log('🔍 WORKER: Transformers.js worker starting (local build)...');

// Global pipeline variables
let classifier = null;
let embedder = null; 
let nerExtractor = null;
let generator = null;

// Global transformers reference
let Transformers = null;

// Set up event listener for messages from the offscreen document
self.addEventListener('message', async (event) => {
  const { type, data } = event.data;
  console.log(`🔍 WORKER: Received message: ${type}`);

  try {
    // 3. Initialize all AI models
    if (type === 'init') {
      console.log('🔍 WORKER: Initializing AI models...');
      
      // Get the base URL for local model access
      const extensionBaseURL = data.extensionBaseURL;
      console.log('🔍 WORKER: Extension base URL:', extensionBaseURL);

      // Load transformers.js using dynamic ES6 import
      try {
        console.log('🔍 WORKER: Loading local transformers.js...');
        const transformersModule = await import(extensionBaseURL + 'transformers.js');
        Transformers = transformersModule;
        console.log('🔍 WORKER: Local transformers.js loaded successfully!');
      } catch (e) {
        console.error('🔍 WORKER: Failed to load local transformers.js:', e);
        postMessage({ 
          type: 'init-complete', 
          success: false,
          error: 'Failed to load transformers.js: ' + e.message 
        });
        return;
      }

      // **CRITICAL:** Configure transformers.js for CSP-compatible operation
      if (typeof Transformers !== 'undefined' && Transformers.env) {
        // Configure ONNX Runtime to avoid Web Workers (CSP compatibility)
        Transformers.env.backends.onnx.wasm.wasmPaths = extensionBaseURL;
        Transformers.env.backends.onnx.wasm.numThreads = 1; // Force single-threaded to avoid workers
        Transformers.env.backends.onnx.wasm.simd = true; // Enable SIMD if supported
        
        // Enable remote models (required for HuggingFace Hub access)
        Transformers.env.allowRemoteModels = true;
        Transformers.env.allowLocalModels = false; // Disable local file system access in extensions
        
        // Configure remote access to HuggingFace Hub
        Transformers.env.remoteHost = 'https://huggingface.co/';
        Transformers.env.remotePathTemplate = '{model}/resolve/main/';
        
        console.log('🔍 WORKER: Transformers.js configured for single-threaded CSP-compatible operation');
        console.log('🔍 WORKER: ONNX threads:', Transformers.env.backends.onnx.wasm.numThreads);
        console.log('🔍 WORKER: Remote host:', Transformers.env.remoteHost);
      }

      try {
        postMessage({ type: 'status', message: 'Loading classifier model...', progress: 20 });
        
        // The Scout (Classifier) - Zero-shot classification with DeBERTa v3
        console.log('🔍 WORKER: Loading classifier (The Scout)...');
        classifier = await Transformers.pipeline('zero-shot-classification', 'Xenova/nli-deberta-v3-small', {
          session_options: {
            executionProviders: ['wasm']
          }
        });
        console.log('🔍 WORKER: Classifier loaded');

        postMessage({ type: 'status', message: 'Loading embedding model...', progress: 40 });
        
        // The Indexer (Embedding) - EmbeddingGemma for RAG applications
        console.log('🔍 WORKER: Loading embedder (The Indexer)...');
        embedder = await Transformers.pipeline('feature-extraction', 'onnx-community/embeddinggemma-300m-ONNX', {
          session_options: {
            executionProviders: ['wasm']
          }
        });
        console.log('🔍 WORKER: Embedder loaded');

        postMessage({ type: 'status', message: 'Loading NER model...', progress: 60 });
        
        // The Extractor (NER) - BERT-based named entity recognition
        console.log('🔍 WORKER: Loading NER extractor (The Extractor)...');
        nerExtractor = await Transformers.pipeline('token-classification', 'Xenova/bert-base-NER', {
          session_options: {
            executionProviders: ['wasm']
          }
        });
        console.log('🔍 WORKER: NER extractor loaded');

        postMessage({ type: 'status', message: 'Loading generative model...', progress: 80 });
        
        // The Synthesizer (LLM) - Gemma 3n multimodal text generation
        console.log('🔍 WORKER: Loading generator (The Synthesizer)...');
        generator = await Transformers.pipeline('text-generation', 'onnx-community/gemma-3n-E2B-it-ONNX', {
          session_options: {
            executionProviders: ['wasm']
          }
        });
        console.log('🔍 WORKER: Generator loaded');

        postMessage({ type: 'init-complete', success: true, progress: 100 });
        console.log('🔍 WORKER: All AI models initialized successfully!');

      } catch (modelError) {
        console.error('🔍 WORKER: Model initialization failed:', modelError);
        postMessage({ 
          type: 'init-complete', 
          success: false, 
          error: modelError.message 
        });
      }
    }

    // Handle classification requests (The Scout)
    else if (type === 'classify') {
      if (!classifier) {
        throw new Error('Classifier not initialized');
      }
      console.log('🔍 WORKER: Running classification...');
      const result = await classifier(data.text, data.labels);
      postMessage({ 
        type: 'classify-result', 
        id: data.id,
        result 
      });
    }

    // Handle embedding requests (The Indexer)
    else if (type === 'embed') {
      if (!embedder) {
        throw new Error('Embedder not initialized');
      }
      console.log('🔍 WORKER: Generating embedding...');
      const result = await embedder(data.text);
      postMessage({ 
        type: 'embed-result', 
        id: data.id,
        embedding: result.data 
      });
    }

    // Handle NER requests (The Extractor)
    else if (type === 'extract_entities') {
      if (!nerExtractor) {
        throw new Error('NER extractor not initialized');
      }
      console.log('🔍 WORKER: Extracting entities...');
      const result = await nerExtractor(data.text);
      postMessage({ 
        type: 'entities-result', 
        id: data.id,
        entities: result 
      });
    }

    // Handle text generation requests (The Synthesizer)
    else if (type === 'generate') {
      if (!generator) {
        throw new Error('Generator not initialized');
      }
      console.log('🔍 WORKER: Generating text...');
      const result = await generator(data.prompt, {
        max_length: data.maxLength || 100,
        temperature: data.temperature || 0.7,
        ...data.options
      });
      postMessage({ 
        type: 'generate-result', 
        id: data.id,
        text: result[0].generated_text 
      });
    }

    else {
      console.log('🔍 WORKER: Unknown message type:', type);
    }

  } catch (error) {
    console.error('🔍 WORKER: Error processing message:', error);
    postMessage({ 
      type: 'error',
      id: data?.id, 
      error: error.message 
    });
  }
});

console.log('🔍 WORKER: Transformers.js worker ready for messages (local build)');