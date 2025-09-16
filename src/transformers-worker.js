// Branestawm - Modern Transformers.js Worker (ES Module Bundled)
// Clean, robust implementation using standard ES Module imports

console.log('🧠 TRANSFORMERS WORKER: Starting modern ES Module worker...');

// ✅ STEP 1: Import the library directly as ES Modules - no more importScripts!
import { pipeline, env } from '@xenova/transformers';

// ✅ STEP 2: Configure environment for Chrome extension immediately
env.allowLocalModels = true;
env.backends = env.backends || {};
env.backends.onnx = env.backends.onnx || {};
env.backends.onnx.wasm = env.backends.onnx.wasm || {};
env.backends.onnx.wasm.numThreads = 2;
env.backends.onnx.wasm.simd = true;
env.useBrowserCache = true;
env.localModelPath = './models/';

console.log('✅ TRANSFORMERS WORKER: Environment configured for Chrome extension');

// ✅ STEP 3: Clean, modern AI Pipeline Management
class AIPipelines {
  static scout = null;        // Classification specialist
  static indexer = null;      // Embeddings specialist  
  static extractor = null;    // Named Entity Recognition specialist
  static synthesizer = null;  // Text generation specialist
  static isInitialized = false;

  // 🔍 The Scout (Classification) - DistilBERT-SST2
  static async getScout() {
    if (this.scout === null) {
      console.log('🔍 TRANSFORMERS WORKER: Loading The Scout (Classification)...');
      
      this.scout = await pipeline(
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

  // 📚 The Indexer (Embeddings) - MiniLM-L6-v2 (reliable fallback)
  static async getIndexer() {
    if (this.indexer === null) {
      console.log('📚 TRANSFORMERS WORKER: Loading The Indexer (Embeddings)...');
      
      this.indexer = await pipeline(
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
      console.log('✅ INDEXER: Successfully loaded all-MiniLM-L6-v2 (~90MB)');
    }
    return this.indexer;
  }

  // 🏷️ The Extractor (NER) - BERT-base-NER
  static async getExtractor() {
    if (this.extractor === null) {
      console.log('🏷️ TRANSFORMERS WORKER: Loading The Extractor (NER)...');
      
      this.extractor = await pipeline(
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

  // ✍️ The Synthesizer (LLM) - Phi-3-mini
  static async getSynthesizer() {
    if (this.synthesizer === null) {
      console.log('✍️ TRANSFORMERS WORKER: Loading The Synthesizer (LLM)...');
      
      this.synthesizer = await pipeline(
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

// ✅ STEP 4: Clean Message Handler
self.addEventListener('message', async (event) => {
  const { type, data } = event.data;
  console.log(`🧠 TRANSFORMERS WORKER: Received message: ${type}`);
  
  try {
    switch (type) {
      case 'init':
        await handleInit(data);
        break;
        
      case 'classify':
        await handleClassify(data);
        break;
        
      case 'embed':
        await handleEmbed(data);
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
    console.log('🧠 TRANSFORMERS WORKER: Initializing AI specialists...');
    
    self.postMessage({
      type: 'status',
      message: 'Loading AI specialists (~3.7GB total download)...',
      progress: 10
    });
    
    // Load specialists in order of importance/size
    const loadOrder = [
      { name: 'indexer', progress: 25 },
      { name: 'scout', progress: 45 }, 
      { name: 'extractor', progress: 65 },
      { name: 'synthesizer', progress: 85 }
    ];
    
    for (const { name, progress } of loadOrder) {
      self.postMessage({
        type: 'status',
        message: `Loading ${name}...`,
        progress: progress
      });
      
      switch (name) {
        case 'indexer':
          await AIPipelines.getIndexer();
          break;
        case 'scout':
          await AIPipelines.getScout();
          break;
        case 'extractor':
          await AIPipelines.getExtractor();
          break;
        case 'synthesizer':
          await AIPipelines.getSynthesizer();
          break;
      }
    }
    
    AIPipelines.isInitialized = true;
    
    self.postMessage({
      type: 'init-complete',
      success: true,
      progress: 100,
      message: '✅ Modern AI architecture ready! (4 Transformers.js specialists)'
    });
    
    console.log('🧠 TRANSFORMERS WORKER: All specialists initialized successfully!');
    
  } catch (error) {
    console.error('❌ TRANSFORMERS WORKER: Initialization failed:', error);
    self.postMessage({
      type: 'init-complete',
      success: false,
      error: error.message
    });
  }
}

// Handle classification requests
async function handleClassify(data) {
  try {
    console.log('🔍 TRANSFORMERS WORKER: Processing classification request...');
    
    const scout = await AIPipelines.getScout();
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

// Handle embedding requests
async function handleEmbed(data) {
  try {
    console.log('📚 TRANSFORMERS WORKER: Processing embedding request...');
    
    const indexer = await AIPipelines.getIndexer();
    const result = await indexer(data.text, { 
      pooling: 'mean', 
      normalize: true 
    });
    
    self.postMessage({
      type: 'embed-result',
      id: data.id,
      embeddings: Array.from(result.data),
      model: 'all-MiniLM-L6-v2'
    });
    
  } catch (error) {
    console.error('❌ TRANSFORMERS WORKER: Embedding generation failed:', error);
    throw error;
  }
}

// Handle entity extraction requests
async function handleExtractEntities(data) {
  try {
    console.log('🏷️ TRANSFORMERS WORKER: Processing entity extraction request...');
    
    const extractor = await AIPipelines.getExtractor();
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
    
    const synthesizer = await AIPipelines.getSynthesizer();
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

console.log('🧠 TRANSFORMERS WORKER: Modern ES Module worker ready for initialization');