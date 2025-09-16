// Branestawm - Transformers.js Hybrid AI Worker
// 4-specialist architecture with EmbeddingGemma fallback strategy

console.log('🧠 TRANSFORMERS WORKER: Starting hybrid AI worker...');

// Import Transformers.js and ONNX Runtime Web
let transformers = null;
let ort = null;

// Global AI Architecture Manager
class AIArchitecture {
  static scout = null;
  static indexer = null;
  static indexerType = null; // 'embedgemma' or 'minilm'
  static extractor = null;
  static synthesizer = null;
  static isInitialized = false;

  // Initialize Transformers.js environment
  static async initializeEnvironment() {
    try {
      console.log('🧠 TRANSFORMERS WORKER: Loading Transformers.js...');
      
      // Load Transformers.js via importScripts for web worker
      importScripts('./transformers.min.js');
      
      // Access the global transformers object
      const { pipeline, env } = self;
      transformers = { pipeline, env };
      
      // Configure environment for Chrome extension
      transformers.env.allowLocalModels = true;
      transformers.env.backends.onnx.wasm.numThreads = 2;
      transformers.env.backends.onnx.wasm.simd = true;
      transformers.env.useBrowserCache = true;
      transformers.env.localModelPath = './models/';
      
      console.log('✅ TRANSFORMERS WORKER: Transformers.js loaded successfully');
      return true;
    } catch (error) {
      console.error('❌ TRANSFORMERS WORKER: Failed to load Transformers.js:', error);
      return false;
    }
  }

  // Load ONNX Runtime Web for EmbeddingGemma fallback
  static async initializeONNXRuntime() {
    try {
      console.log('🧠 TRANSFORMERS WORKER: Loading ONNX Runtime for EmbeddingGemma...');
      
      // Try loading ONNX Runtime Web
      if (typeof self.ort === 'undefined') {
        importScripts('./ort.min.js');
      }
      ort = self.ort;
      
      if (ort) {
        ort.env.wasm.simd = true;
        ort.env.wasm.numThreads = 2;
        ort.env.logLevel = 'warning';
        console.log('✅ TRANSFORMERS WORKER: ONNX Runtime loaded for fallback');
        return true;
      }
      return false;
    } catch (error) {
      console.warn('⚠️ TRANSFORMERS WORKER: ONNX Runtime not available:', error);
      return false;
    }
  }

  // 📚 The Indexer (Embeddings) - Hybrid approach
  static async getIndexer() {
    if (this.indexer === null) {
      console.log('📚 TRANSFORMERS WORKER: Loading The Indexer (Embeddings)...');
      
      // Try EmbeddingGemma first (cutting-edge performance)
      try {
        if (ort) {
          const session = await ort.InferenceSession.create(
            'https://huggingface.co/onnx-community/embeddinggemma-300m-ONNX/resolve/main/model_quantized.onnx',
            { executionProviders: ['wasm', 'cpu'] }
          );
          this.indexer = session;
          this.indexerType = 'embedgemma';
          console.log('✅ INDEXER: Successfully loaded EmbeddingGemma-300M (~200MB)');
          return { model: this.indexer, type: this.indexerType };
        }
      } catch (error) {
        console.warn('⚠️ INDEXER: EmbeddingGemma failed, falling back to all-MiniLM-L6-v2:', error.message);
      }
      
      // Fallback to proven Transformers.js model
      try {
        this.indexer = await transformers.pipeline(
          'feature-extraction',
          'Xenova/all-MiniLM-L6-v2',
          {
            progress_callback: (data) => {
              self.postMessage({
                type: 'download-progress',
                specialist: 'indexer',
                data: data
              });
            }
          }
        );
        this.indexerType = 'minilm';
        console.log('✅ INDEXER: Successfully loaded all-MiniLM-L6-v2 fallback');
      } catch (error) {
        console.error('❌ INDEXER: Both EmbeddingGemma and MiniLM failed:', error);
        throw error;
      }
    }
    return { model: this.indexer, type: this.indexerType };
  }

  // 🔍 The Scout (Classification)
  static async getScout() {
    if (this.scout === null) {
      console.log('🔍 TRANSFORMERS WORKER: Loading The Scout (Classification)...');
      
      this.scout = await transformers.pipeline(
        'zero-shot-classification',
        'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
        {
          progress_callback: (data) => {
            self.postMessage({
              type: 'download-progress',
              specialist: 'scout',
              data: data
            });
          }
        }
      );
      console.log('✅ SCOUT: Successfully loaded DistilBERT-SST2 (~67MB)');
    }
    return this.scout;
  }

  // 🏷️ The Extractor (NER)
  static async getExtractor() {
    if (this.extractor === null) {
      console.log('🏷️ TRANSFORMERS WORKER: Loading The Extractor (NER)...');
      
      this.extractor = await transformers.pipeline(
        'token-classification',
        'Xenova/bert-base-NER',
        {
          progress_callback: (data) => {
            self.postMessage({
              type: 'download-progress',
              specialist: 'extractor',
              data: data
            });
          }
        }
      );
      console.log('✅ EXTRACTOR: Successfully loaded BERT-base-NER (~110MB)');
    }
    return this.extractor;
  }

  // ✍️ The Synthesizer (LLM)
  static async getSynthesizer() {
    if (this.synthesizer === null) {
      console.log('✍️ TRANSFORMERS WORKER: Loading The Synthesizer (LLM)...');
      
      this.synthesizer = await transformers.pipeline(
        'text-generation',
        'Xenova/Phi-3-mini-4k-instruct',
        {
          progress_callback: (data) => {
            self.postMessage({
              type: 'download-progress',
              specialist: 'synthesizer',
              data: data
            });
          }
        }
      );
      console.log('✅ SYNTHESIZER: Successfully loaded Phi-3-mini (~2.4GB)');
    }
    return this.synthesizer;
  }
}

// Message handler
self.addEventListener('message', async (event) => {
  const { type, data } = event.data;
  console.log(`🧠 TRANSFORMERS WORKER: Received message: ${type}`);
  
  try {
    switch (type) {
      case 'init':
        await handleInit(data);
        break;
        
      case 'embed':
        await handleEmbed(data);
        break;
        
      case 'classify':
        await handleClassify(data);
        break;
        
      case 'extract_entities':
        await handleExtractEntities(data);
        break;
        
      case 'generate':
        await handleGenerate(data);
        break;
        
      default:
        console.log('🧠 TRANSFORMERS WORKER: Unknown message type:', type);
    }
  } catch (error) {
    console.error('❌ TRANSFORMERS WORKER: Error processing message:', error);
    self.postMessage({
      type: 'error',
      id: data?.id,
      error: error.message
    });
  }
});

// Initialize all specialists
async function handleInit(data) {
  try {
    console.log('🧠 TRANSFORMERS WORKER: Initializing hybrid AI architecture...');
    
    self.postMessage({
      type: 'status',
      message: 'Loading Transformers.js environment...',
      progress: 5
    });
    
    // Initialize Transformers.js environment
    const transformersLoaded = await AIArchitecture.initializeEnvironment();
    if (!transformersLoaded) {
      throw new Error('Failed to initialize Transformers.js');
    }
    
    self.postMessage({
      type: 'status',
      message: 'Loading ONNX Runtime for hybrid support...',
      progress: 15
    });
    
    // Initialize ONNX Runtime for EmbeddingGemma fallback
    await AIArchitecture.initializeONNXRuntime();
    
    self.postMessage({
      type: 'status',
      message: 'Pre-loading AI specialists (this may take several minutes)...',
      progress: 25
    });
    
    // Pre-load all specialists
    const loadOrder = ['indexer', 'scout', 'extractor', 'synthesizer'];
    for (let i = 0; i < loadOrder.length; i++) {
      const role = loadOrder[i];
      const progressStart = 25 + (i * 18);
      
      self.postMessage({
        type: 'status',
        message: `Loading ${role}...`,
        progress: progressStart
      });
      
      switch (role) {
        case 'indexer':
          await AIArchitecture.getIndexer();
          break;
        case 'scout':
          await AIArchitecture.getScout();
          break;
        case 'extractor':
          await AIArchitecture.getExtractor();
          break;
        case 'synthesizer':
          await AIArchitecture.getSynthesizer();
          break;
      }
      
      self.postMessage({
        type: 'status',
        message: `${role} ready!`,
        progress: progressStart + 18
      });
    }
    
    AIArchitecture.isInitialized = true;
    
    self.postMessage({
      type: 'init-complete',
      success: true,
      progress: 100,
      message: '✅ Hybrid AI architecture ready! (Transformers.js + ONNX Runtime)'
    });
    
    console.log('🧠 TRANSFORMERS WORKER: Hybrid AI architecture initialized successfully!');
    
  } catch (error) {
    console.error('❌ TRANSFORMERS WORKER: Initialization failed:', error);
    self.postMessage({
      type: 'init-complete',
      success: false,
      error: error.message
    });
  }
}

// Handle embedding requests
async function handleEmbed(data) {
  try {
    console.log('📚 TRANSFORMERS WORKER: Processing embedding request...');
    
    const { model: indexer, type: indexerType } = await AIArchitecture.getIndexer();
    let embeddings;
    
    if (indexerType === 'embedgemma') {
      // Handle ONNX Runtime Web inference for EmbeddingGemma
      const inputTensor = new ort.Tensor('string', [data.text]);
      const results = await indexer.run({ input: inputTensor });
      embeddings = Array.from(results.output.data);
    } else {
      // Handle Transformers.js inference for MiniLM
      const result = await indexer(data.text, { 
        pooling: 'mean', 
        normalize: true 
      });
      embeddings = Array.from(result.data);
    }
    
    self.postMessage({
      type: 'embed-result',
      id: data.id,
      embeddings: embeddings,
      model: indexerType
    });
    
  } catch (error) {
    console.error('❌ TRANSFORMERS WORKER: Embedding failed:', error);
    throw error;
  }
}

// Handle classification requests
async function handleClassify(data) {
  try {
    console.log('🔍 TRANSFORMERS WORKER: Processing classification request...');
    
    const scout = await AIArchitecture.getScout();
    const result = await scout(data.text, data.candidate_labels || ['positive', 'negative', 'neutral']);
    
    self.postMessage({
      type: 'classify-result',
      id: data.id,
      result: result
    });
    
  } catch (error) {
    console.error('❌ TRANSFORMERS WORKER: Classification failed:', error);
    throw error;
  }
}

// Handle entity extraction requests
async function handleExtractEntities(data) {
  try {
    console.log('🏷️ TRANSFORMERS WORKER: Processing entity extraction request...');
    
    const extractor = await AIArchitecture.getExtractor();
    const entities = await extractor(data.text);
    
    self.postMessage({
      type: 'entities-result',
      id: data.id,
      entities: entities
    });
    
  } catch (error) {
    console.error('❌ TRANSFORMERS WORKER: Entity extraction failed:', error);
    throw error;
  }
}

// Handle text generation requests
async function handleGenerate(data) {
  try {
    console.log('✍️ TRANSFORMERS WORKER: Processing text generation request...');
    
    const synthesizer = await AIArchitecture.getSynthesizer();
    const result = await synthesizer(data.prompt, {
      max_new_tokens: data.max_tokens || 150,
      temperature: data.temperature || 0.7,
      top_p: data.top_p || 0.9,
      do_sample: true
    });
    
    self.postMessage({
      type: 'generate-result',
      id: data.id,
      text: result[0].generated_text
    });
    
  } catch (error) {
    console.error('❌ TRANSFORMERS WORKER: Text generation failed:', error);
    throw error;
  }
}

console.log('🧠 TRANSFORMERS WORKER: Hybrid AI worker ready for initialization');