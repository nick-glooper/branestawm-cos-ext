# Branestawm - Your AI Chief of Staff

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Build](https://img.shields.io/badge/build-passing-brightgreen.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)

> Your indispensable AI Chief of Staff - A cognitive prosthetic designed specifically for neurodivergent users.

## 🌟 Features

### 🧠 **Intelligent Task Management**
- **Automatic Task Extraction**: AI-powered detection of tasks from conversations
- **Smart Templates**: Context-aware task breakdowns with time estimates
- **Time-First Approach**: Conscious deadline decisions with pause/resume functionality
- **Category Intelligence**: Automatic categorization (Work, Personal, Creative, Administrative)

### 🔍 **Advanced Analytics & Monitoring**
- **Performance Tracking**: Real-time performance metrics and optimization
- **Error Monitoring**: Comprehensive error tracking and analytics
- **Privacy-First Analytics**: User consent-based usage insights
- **Memory Leak Detection**: Automatic memory usage monitoring

### 🛡️ **Security & Quality**
- **XSS Protection**: Comprehensive input sanitization and HTML escaping
- **Type Safety**: Gradual TypeScript migration for better maintainability
- **Code Quality**: Automated linting with security and performance rules
- **Content Security Policy**: Secure Chrome extension architecture

### 🚀 **Developer Experience**
- **Modern Build System**: Minification, bundling, and optimization
- **Comprehensive Testing**: Custom test framework with watch mode
- **CI/CD Pipeline**: Automated testing, building, and deployment
- **Hot Reload**: Development workflow with live reloading

## 📦 Installation

### For Users
1. Download from [Chrome Web Store](https://chrome.google.com/webstore) (coming soon)
2. Or load as unpacked extension for development

### For Developers
```bash
# Clone the repository
git clone https://github.com/your-org/branestawm-cos-ext.git
cd branestawm-cos-ext

# Install dependencies (if any)
npm install

# Build the extension
npm run build

# Load the extension in Chrome:
# 1. Go to chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select the 'build' folder
```

## 🔧 Development

### Quick Start
```bash
# Development build with file watching
npm run dev

# Run tests
npm run test

# Run tests in watch mode
npm run test:watch

# Lint code
npm run lint

# Full validation (lint + test + build)
npm run validate

# Clean build artifacts
npm run clean
```

### Project Structure
```
branestawm-cos-ext/
├── 📁 src/                     # Source code (future TypeScript migration)
├── 📁 build/                   # Built extension files
├── 📁 dist/                    # Distribution packages
├── 📁 docs/                    # Documentation
├── 📁 tests/                   # Test suites
├── 📁 types/                   # TypeScript definitions
├── 📁 .github/workflows/       # CI/CD pipelines
├── 🔧 manifest.json            # Chrome extension manifest
├── 🔧 tsconfig.json            # TypeScript configuration
├── 🔧 package.json             # NPM configuration
├── 🧪 test-runner.js           # Custom test framework
├── 🏗️ build.js                # Build system
├── 📋 linter.js               # Code quality checker
└── 📊 analytics-tracker.js    # Usage analytics
```

### Core Modules

#### Task Management System
- **`task-manager.js`** - Main coordinator (284 lines, was 8,341!)
- **`task-extractor.js`** - Pattern matching and extraction logic
- **`task-templates.js`** - Template generation and suggestions
- **`task-storage.js`** - Data persistence and management
- **`task-scheduler.js`** - Time tracking and scheduling
- **`task-renderer.js`** - UI rendering and interactions

#### Infrastructure
- **`logger.js`** - Centralized logging with levels
- **`security-utils.js`** - XSS protection and sanitization
- **`performance-tracker.js`** - Performance monitoring
- **`analytics-tracker.js`** - Privacy-conscious usage analytics

## 🧪 Testing

Our custom test framework provides:
- **Async/await support** for modern JavaScript testing
- **Watch mode** for continuous testing during development
- **Comprehensive assertions** with clear error messages
- **Performance tracking** integration

```bash
# Run all tests
npm test

# Run tests with file watching
npm run test:watch

# Run specific test file
node test-runner.js tests/task-extractor.test.js
```

### Test Coverage
- ✅ Task extraction and validation
- ✅ Security utilities and XSS prevention
- ✅ Logger configuration and levels
- ✅ Task storage operations
- 🔄 Performance monitoring (in progress)
- 🔄 Analytics tracking (in progress)

## 📊 Performance

### Build Optimization
- **94% size reduction** in main task manager (8,341 → 284 lines)
- **Minification** reduces bundle size by ~40%
- **Tree shaking** eliminates unused code
- **Source maps** for development debugging

### Runtime Performance
- **Memory usage monitoring** with leak detection
- **Operation timing** with threshold alerting
- **Chrome API optimization** with automatic wrapping
- **Lazy loading** for non-critical components

### Metrics Dashboard
Access performance insights via:
```javascript
// In browser console
perf.summary()        // Get performance overview
perf.export()         // Export detailed metrics
analytics.summary()   // Get usage analytics
```

## 🛡️ Security

### XSS Protection
- **Input sanitization** for all user data
- **HTML escaping** in template rendering
- **CSS value validation** for safe styling
- **URL validation** for external links

### Privacy
- **Opt-in analytics** with user consent
- **Local data storage** with encryption option
- **Minimal permissions** following principle of least privilege
- **No external tracking** without explicit permission

### Chrome Extension Security
- **Manifest V3** compliance
- **Content Security Policy** configured
- **Host permissions** limited to necessary domains
- **No eval()** or unsafe dynamic code execution

## 📈 Analytics & Monitoring

### User Analytics (Privacy-First)
- **Task completion rates** and patterns
- **Feature usage** insights
- **Performance metrics** collection
- **Error tracking** and reporting

### Developer Insights
- **Real-time performance** monitoring
- **Memory usage** tracking
- **Error aggregation** with stack traces
- **Build optimization** metrics

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](docs/CONTRIBUTING.md) for details.

### Development Workflow
1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Code Style
- **ESLint** configuration for consistent style
- **TypeScript** preferred for new features
- **Security-first** development practices
- **Performance** considerations for all changes

## 📋 Roadmap

### Phase 1: ✅ Completed
- [x] Modular architecture refactoring
- [x] Security improvements and XSS protection
- [x] Centralized logging system
- [x] Performance monitoring infrastructure

### Phase 2: ✅ Completed
- [x] Build system with minification
- [x] Comprehensive testing framework
- [x] Task timer pause/resume functionality
- [x] Code quality tools and linting

### Phase 3: ✅ Completed
- [x] TypeScript migration foundation
- [x] Advanced error tracking and analytics
- [x] CI/CD pipeline setup
- [x] Comprehensive documentation

### Future Enhancements
- [ ] AI model integration improvements
- [ ] Advanced task scheduling algorithms
- [ ] Team collaboration features
- [ ] Mobile companion app
- [ ] Advanced reporting dashboard

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with ❤️ for the neurodivergent community
- Powered by modern web technologies and AI
- Inspired by the needs of users who think differently

## 📞 Support

- **Documentation**: [docs/](docs/)
- **Issues**: [GitHub Issues](https://github.com/your-org/branestawm-cos-ext/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/branestawm-cos-ext/discussions)

---

**Branestawm** - Making productivity accessible for minds that work differently. 🧠✨