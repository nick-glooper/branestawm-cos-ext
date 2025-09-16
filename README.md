# Branestawm - Your AI Chief of Staff

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Build](https://img.shields.io/badge/build-passing-brightgreen.svg)

> Your indispensable AI Chief of Staff - A cognitive prosthetic designed specifically for neurodivergent users.

## 🌟 Current Architecture

Branestawm is a Chrome extension that provides multiple AI options for neurodivergent users:

### 🤖 **Four-AI System**
- **Local AI (ONNX Runtime)**: 4-model architecture running entirely offline
- **Google Gemini**: One-click OAuth setup with free tier
- **Custom APIs**: Support for Cerebras, OpenAI, OpenRouter, and any OpenAI-compatible endpoint
- **Smart Routing**: Automatic failover and optimal model selection

### 🧠 **Local AI (4-Model Architecture)**
- **🔍 Scout** (DistilBERT-SST2): Classification and sentiment analysis
- **📚 Indexer** (EmbeddingGemma-300M): Semantic embeddings and search
- **🏷️ Extractor** (DistilBERT-NER): Named entity recognition and extraction
- **✨ Synthesizer** (Phi-3-mini): High-quality text generation

### 🚀 **Core Features**
- **Offline-First**: Full functionality without internet via ONNX Runtime
- **Privacy-Focused**: Local processing with optional cloud sync
- **Neurodivergent-Optimized**: Patient, structured AI responses
- **Cross-Platform**: Works entirely in browser with no installation
- **Data Portability**: Full export capabilities

## 📦 Installation

### For Users
1. Load as unpacked extension in Chrome (Chrome Web Store coming soon)
2. Choose your AI setup:
   - **Easy**: Google sign-in (1,500 free requests/day)
   - **Offline**: Local AI (no internet required)
   - **Advanced**: Custom API keys

### For Developers
```bash
# Clone the repository
git clone https://github.com/your-org/branestawm-cos-ext.git
cd branestawm-cos-ext

# Load the extension in Chrome:
# 1. Go to chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select this folder
```

## 🏗️ Architecture

### **Core Files**
```
branestawm-cos-ext/
├── manifest.json           # Chrome extension configuration
├── index.html             # Main conversation interface
├── options.html           # Settings and AI configuration
├── background.js          # Service worker with vector database
├── offscreen.html         # ONNX Runtime processing interface
├── offscreen.js           # Local AI orchestration
├── onnx-worker.js         # 4-model ONNX Runtime implementation
├── api.js                 # AI routing and API management
├── chat.js                # Conversation logic
├── ui.js                  # UI components and themes
└── main.js                # Application core
```

### **Key Components**

#### Background Service Worker
- **Vector Database**: IndexedDB-based semantic search
- **Message Routing**: AI provider selection and failover
- **Offscreen Management**: ONNX Runtime process coordination
- **Auto-sync**: Optional encrypted cloud synchronization

#### Local AI System (ONNX Runtime)
- **4-Model Pipeline**: Specialized models for different tasks
- **WebGL/CPU Acceleration**: Hardware-optimized inference
- **Progressive Loading**: Smart model initialization
- **Memory Management**: Efficient resource utilization

#### API Layer
- **Universal Routing**: Seamless switching between AI providers
- **Authentication**: OAuth2 + API key management
- **Error Handling**: Graceful degradation and retry logic
- **Rate Limiting**: Respectful API usage

## 🔧 Configuration

### **AI Provider Setup**

#### Local AI (Offline)
```javascript
// Automatically initialized on first run
// No configuration required
// Models download on demand (~2-4GB total)
```

#### Google Gemini (Recommended)
```javascript
// One-click OAuth setup
// 1,500 free requests per day
// No API key required
```

#### Custom API Providers
```javascript
// Supported: Cerebras, OpenAI, OpenRouter, Hugging Face
// Requires API key
// Configurable endpoints and models
```

## 🧪 Development

### **Local Development**
```bash
# Make changes and reload extension
# No build step required - uses vanilla JavaScript

# Test Local AI
chrome://extensions/ → Details → Inspect views: offscreen.html

# Debug background script
chrome://extensions/ → Details → Inspect views: service worker
```

### **Key APIs**

#### Check Local AI Status
```javascript
const status = await chrome.runtime.sendMessage({
    type: 'CHECK_LOCAL_AI_STATUS'
});
console.log(status.ready); // true/false
```

#### Generate Text (Any Provider)
```javascript
const response = await callLLMAPI([
    { role: 'user', content: 'Hello!' }
]);
```

#### Vector Database Search
```javascript
const results = await chrome.runtime.sendMessage({
    type: 'SEARCH_VECTOR_DB',
    query: 'search query',
    options: { topK: 5 }
});
```

## 📊 Performance

### **Local AI Benchmarks**
- **Cold Start**: ~30-60 seconds (first model load)
- **Warm Inference**: ~1-3 seconds per response
- **Memory Usage**: ~4-6GB RAM (all models loaded)
- **Storage**: ~2-4GB (model cache)

### **Cloud API Performance**
- **Google Gemini**: ~500ms average response
- **Cerebras**: ~200ms average response (free tier)
- **OpenAI**: ~1-2s average response

## 🛡️ Security & Privacy

### **Local AI Security**
- **Air-Gapped**: No data leaves device when using Local AI
- **Sandboxed**: Runs in Chrome's secure offscreen context with ONNX Runtime
- **No Telemetry**: Zero tracking or analytics

### **Cloud API Security**
- **API Key Encryption**: Keys stored securely, never synced
- **OAuth2**: Google-managed authentication
- **Request Filtering**: No sensitive data in API calls

### **Data Privacy**
- **Local-First**: All data stored locally by default
- **Optional Sync**: AES256-encrypted cloud backup
- **Full Export**: Complete data portability
- **No Tracking**: Zero user analytics or telemetry

## 🎯 Use Cases

### **For Neurodivergent Users**
- **Executive Function Support**: Task breakdown and planning
- **Context Switching Help**: Conversation threading and recall
- **Decision Fatigue Relief**: AI-assisted choices and prioritization
- **Working Memory Aid**: Conversation history and search

### **For Privacy-Conscious Users**
- **Offline AI**: Complete functionality without internet
- **Local Processing**: Sensitive data never leaves device
- **Self-Hosted Compatible**: Works with any OpenAI-compatible API

### **For Developers**
- **AI Integration Testing**: Multi-provider compatibility testing
- **Offline Development**: Local AI for air-gapped environments
- **API Exploration**: Easy switching between different AI providers

## 🗺️ Roadmap

### **Current (v1.0)**
- ✅ 4-model ONNX Runtime implementation
- ✅ Multi-provider AI routing
- ✅ Google OAuth integration
- ✅ Vector database for semantic search
- ✅ Encrypted cloud sync

### **Near-term (v1.1)**
- [ ] Enhanced model management UI
- [ ] Performance optimization for mobile devices
- [ ] Additional AI provider integrations
- [ ] Advanced conversation threading

### **Future (v2.0)**
- [ ] Custom model fine-tuning
- [ ] Team collaboration features
- [ ] Plugin ecosystem
- [ ] Mobile companion app

## 📜 License

MIT License - See LICENSE file for details.

## 🙏 Acknowledgments

- **Microsoft**: For ONNX Runtime Web technology enabling local AI
- **Neurodivergent Community**: For feedback and testing
- **Open Source AI**: Models from Meta, Microsoft, and others

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/your-org/branestawm-cos-ext/issues)
- **Documentation**: See code comments and inline help
- **Community**: Built for and with the neurodivergent community

---

**Branestawm** - Your indispensable AI Chief of Staff, powered by cutting-edge local AI technology. 🧠✨