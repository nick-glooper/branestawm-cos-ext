// src/transformers-worker.js
// Web Worker for loading transformers.js locally (no CDN)

console.log('🔍 WORKER: Transformers.js worker starting (local build)...');

// Global pipeline variables
let classifier = null;
let embedder = null; 
let nerExtractor = null;
let generator = null;

// 1. Load the bundled library (local file, not CDN)
// Note: transformers.js will be loaded after receiving the init message with extension URL

// 2. Set up event listener for messages from the offscreen document
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

      // Load transformers.js using the extension URL
      try {
        console.log('🔍 WORKER: Loading local transformers.js...');
        importScripts(extensionBaseURL + 'transformers.js');
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

      // **CRITICAL:** Configure WASM paths for local loading
      if (typeof Transformers !== 'undefined' && Transformers.env) {
        // Configure paths to local WASM files
        Transformers.env.backends.onnx.wasm.wasmPaths = extensionBaseURL;
        console.log('🔍 WORKER: WASM paths configured for local loading');
      }

      try {
        postMessage({ type: 'status', message: 'Loading classifier model...', progress: 20 });
        
        // The Scout (Classifier) - Zero-shot classification
        console.log('🔍 WORKER: Loading classifier (The Scout)...');
        classifier = await Transformers.pipeline('zero-shot-classification', 'Xenova/distilbert-base-uncased-mnli');
        console.log('🔍 WORKER: Classifier loaded');

        postMessage({ type: 'status', message: 'Loading embedding model...', progress: 40 });
        
        // The Indexer (Embedding) - Text embeddings
        console.log('🔍 WORKER: Loading embedder (The Indexer)...');
        embedder = await Transformers.pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
        console.log('🔍 WORKER: Embedder loaded');

        postMessage({ type: 'status', message: 'Loading NER model...', progress: 60 });
        
        // The Extractor (NER) - Named entity recognition
        console.log('🔍 WORKER: Loading NER extractor (The Extractor)...');
        nerExtractor = await Transformers.pipeline('ner', 'Xenova/distilbert-base-multilingual-cased-ner-hrl');
        console.log('🔍 WORKER: NER extractor loaded');

        postMessage({ type: 'status', message: 'Loading generative model...', progress: 80 });
        
        // The Synthesizer (LLM) - Text generation  
        console.log('🔍 WORKER: Loading generator (The Synthesizer)...');
        generator = await Transformers.pipeline('text-generation', 'Xenova/gemma-2b-it');
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