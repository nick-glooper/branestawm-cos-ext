# Contributing to Branestawm

We're thrilled that you're interested in contributing to Branestawm! This guide will help you get started and ensure your contributions align with our project goals.

## 🌟 Our Mission

Branestawm is designed as a cognitive prosthetic for neurodivergent users, providing AI-powered task management and organizational support. We prioritize:

- **Accessibility** - Making productivity tools accessible to minds that work differently
- **Privacy** - Respecting user data and providing transparent controls
- **Quality** - Maintaining high code standards and comprehensive testing
- **Community** - Building an inclusive environment for all contributors

## 🤝 How to Contribute

### Ways to Contribute

1. **🐛 Bug Reports** - Help us identify and fix issues
2. **💡 Feature Requests** - Suggest new functionality
3. **📝 Code Contributions** - Implement features or fixes
4. **📖 Documentation** - Improve guides and API docs
5. **🧪 Testing** - Write tests or test new features
6. **🎨 Design** - UI/UX improvements and accessibility enhancements
7. **🌍 Localization** - Translate the extension to other languages

### Getting Started

#### 1. Fork and Clone
```bash
# Fork the repository on GitHub, then:
git clone https://github.com/YOUR_USERNAME/branestawm-cos-ext.git
cd branestawm-cos-ext

# Add upstream remote
git remote add upstream https://github.com/original/branestawm-cos-ext.git
```

#### 2. Set Up Development Environment
```bash
# Install dependencies
npm install

# Run the development build
npm run dev

# Open Chrome and load unpacked extension from ./build directory
```

#### 3. Run Tests
```bash
# Run all tests
npm test

# Run tests in watch mode (recommended during development)
npm run test:watch

# Run linting
npm run lint
```

## 📋 Development Guidelines

### Code Style

We use ESLint and our custom linter for consistent code style:

```bash
# Check code style
npm run lint

# Auto-fix style issues
npm run lint -- --fix
```

#### JavaScript/TypeScript Standards
- **ES2020+** features encouraged
- **TypeScript** preferred for new modules
- **JSDoc** comments for all public functions
- **Descriptive** variable and function names
- **No console.log** in production code (use logger instead)

#### Security Requirements
- **Always escape user input** using `SecurityUtils.escapeHtml()`
- **Validate data** before processing
- **Use safe DOM methods** (textContent over innerHTML)
- **Never use eval()** or similar unsafe functions

### Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```bash
# Format: type(scope): description
git commit -m "feat(tasks): add pause/resume functionality"
git commit -m "fix(security): escape HTML in task renderer"
git commit -m "docs: update API documentation"
git commit -m "test: add unit tests for task extraction"
```

#### Commit Types
- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style/formatting
- **refactor**: Code refactoring
- **test**: Adding or updating tests
- **perf**: Performance improvements
- **security**: Security improvements

### Branch Naming
```bash
# Feature branches
feature/task-pause-resume
feature/accessibility-improvements

# Bug fix branches
fix/xss-vulnerability
fix/memory-leak

# Documentation branches
docs/api-reference
docs/contributing-guide
```

## 🧪 Testing

### Writing Tests

We use our custom test framework. Here's how to write tests:

```javascript
// tests/example.test.js
test('should do something correctly', () => {
    const result = someFunction('input');
    expect(result).toBe('expected');
});

test('should handle async operations', async () => {
    const result = await asyncFunction();
    expect(result).toBeTruthy();
});

test('should throw on invalid input', () => {
    expect(() => functionThatShouldThrow()).toThrow();
});
```

### Test Coverage Requirements
- **New features** must include tests
- **Bug fixes** should include regression tests
- **Critical paths** require comprehensive test coverage
- **Security functions** need thorough validation tests

### Running Specific Tests
```bash
# Run all tests
npm test

# Run tests for specific module
node test-runner.js tests/task-extractor.test.js

# Run with debugging
DEBUG=true npm test
```

## 📖 Documentation

### Code Documentation
- **JSDoc** for all public APIs
- **Inline comments** for complex logic
- **README updates** for new features
- **Architecture docs** for significant changes

```javascript
/**
 * Extract potential tasks from message content
 * @param {string} messageContent - The message text to analyze
 * @param {Object} options - Extraction options
 * @param {number} options.maxTasks - Maximum tasks to extract (default: 3)
 * @returns {Array<PotentialTask>} Array of potential tasks with confidence scores
 */
extractPotentialTasks(messageContent, options = {}) {
    // Implementation...
}
```

### Documentation Updates
When adding features or making changes:
1. Update relevant `.md` files
2. Add examples to documentation
3. Update API references
4. Include screenshots for UI changes

## 🐛 Bug Reports

### Before Submitting
1. **Search existing issues** to avoid duplicates
2. **Test with latest version** to ensure bug still exists
3. **Minimal reproduction** - create smallest possible example
4. **Check browser console** for error messages

### Bug Report Template
```markdown
## Bug Description
A clear description of what the bug is.

## Steps to Reproduce
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

## Expected Behavior
What you expected to happen.

## Actual Behavior
What actually happened.

## Environment
- OS: [e.g., Windows 11, macOS 12.0]
- Browser: [e.g., Chrome 96.0]
- Extension Version: [e.g., 1.0.0]

## Additional Context
- Screenshots
- Console errors
- Network requests
- Related issues
```

## 💡 Feature Requests

### Before Submitting
1. **Check existing requests** to avoid duplicates
2. **Consider the scope** - is this aligned with our mission?
3. **Think about accessibility** - how does this help neurodivergent users?
4. **Provide use cases** - real-world scenarios where this helps

### Feature Request Template
```markdown
## Feature Summary
Brief description of the feature.

## Problem Statement
What problem does this solve? Who experiences this problem?

## Proposed Solution
Detailed description of how you envision this working.

## User Stories
- As a [user type], I want [goal] so that [benefit]
- As a [user type], I want [goal] so that [benefit]

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Accessibility Considerations
How does this feature improve accessibility for neurodivergent users?

## Alternative Solutions
Other ways this problem could be solved.

## Additional Context
Mockups, examples, related issues, etc.
```

## 🔍 Code Review Process

### Submitting Pull Requests

1. **Create feature branch** from `main`
2. **Implement changes** following our guidelines
3. **Write/update tests** for your changes
4. **Update documentation** as needed
5. **Run full validation** (`npm run validate`)
6. **Submit pull request** with clear description

### Pull Request Template
```markdown
## Description
What does this PR do? Why is it needed?

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing
- [ ] I have run the existing tests and they pass
- [ ] I have added new tests to cover my changes
- [ ] I have tested this manually in the browser

## Checklist
- [ ] My code follows the project's style guidelines
- [ ] I have performed a self-review of my own code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] New and existing unit tests pass locally with my changes

## Screenshots (if applicable)
Before/after screenshots for UI changes.

## Related Issues
Closes #123
Relates to #456
```

### Review Criteria
Reviewers will check for:
- **Functionality** - Does it work as expected?
- **Security** - Are there any security vulnerabilities?
- **Performance** - Does it impact extension performance?
- **Accessibility** - Does it maintain or improve accessibility?
- **Code Quality** - Is it well-written and maintainable?
- **Tests** - Are there adequate tests?
- **Documentation** - Is documentation updated?

## 🚀 Release Process

### Version Numbering
We follow [Semantic Versioning](https://semver.org/):
- **MAJOR.MINOR.PATCH** (e.g., 1.2.3)
- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Release Steps
1. **Update version** in `manifest.json` and `package.json`
2. **Update CHANGELOG.md** with release notes
3. **Create release branch** (`release/v1.2.3`)
4. **Run full test suite** and quality checks
5. **Create pull request** to main branch
6. **Tag release** after merge
7. **GitHub Actions** handles the rest!

## 🎯 Areas of Focus

### High Priority
- **Accessibility improvements** for screen readers and keyboard navigation
- **Performance optimizations** for large task lists
- **Security enhancements** and vulnerability fixes
- **Test coverage** expansion
- **TypeScript migration** of remaining modules

### Medium Priority
- **New task templates** for different use cases
- **Advanced analytics** features
- **Integration improvements** with external services
- **UI/UX enhancements** based on user feedback

### Low Priority
- **Experimental features** and research
- **Developer tooling** improvements
- **Documentation** enhancements
- **Code cleanup** and refactoring

## 🆘 Getting Help

### Discord/Slack Community
Join our community channels for:
- **Quick questions** and troubleshooting
- **Feature discussions** and brainstorming
- **Pair programming** sessions
- **Code reviews** and feedback

### GitHub Discussions
Use GitHub Discussions for:
- **Design decisions** and architectural questions
- **Long-form technical** discussions
- **Community feedback** and suggestions
- **Show and tell** your contributions

### Maintainer Contact
- **@maintainer1** - Lead Developer
- **@maintainer2** - Security & Performance
- **@maintainer3** - Accessibility & UX

## 🙏 Recognition

All contributors are recognized in:
- **CONTRIBUTORS.md** file
- **GitHub contributors** page  
- **Release notes** acknowledgments
- **Annual contributor** highlights

We appreciate every contribution, no matter how small! 🎉

## 📜 Code of Conduct

We are committed to providing a welcoming and inclusive environment for all contributors. Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md).

---

Thank you for contributing to Branestawm! Together, we're making productivity tools accessible for minds that work differently. 🧠✨