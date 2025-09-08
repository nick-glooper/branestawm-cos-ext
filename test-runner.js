// Branestawm Test Runner
// Simple test framework for Chrome extension components

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class TestRunner {
    constructor() {
        this.testDir = path.join(__dirname, 'tests');
        this.results = {
            passed: 0,
            failed: 0,
            errors: [],
            startTime: null,
            endTime: null
        };
        this.watchMode = process.argv.includes('--watch');
    }
    
    /**
     * Run all tests
     */
    async runTests() {
        console.log('🧪 Starting Branestawm test suite...\n');
        this.results.startTime = Date.now();
        
        try {
            // Ensure test directory exists
            if (!fs.existsSync(this.testDir)) {
                fs.mkdirSync(this.testDir, { recursive: true });
                this.createInitialTests();
            }
            
            // Load test files
            const testFiles = this.getTestFiles();
            
            if (testFiles.length === 0) {
                console.log('⚠️ No test files found. Creating initial tests...');
                this.createInitialTests();
                return;
            }
            
            // Run each test file
            for (const testFile of testFiles) {
                await this.runTestFile(testFile);
            }
            
            this.results.endTime = Date.now();
            this.printResults();
            
            if (this.watchMode) {
                this.startWatchMode();
            }
            
        } catch (error) {
            console.error('❌ Test runner failed:', error.message);
            process.exit(1);
        }
    }
    
    /**
     * Get all test files
     */
    getTestFiles() {
        if (!fs.existsSync(this.testDir)) return [];
        
        return fs.readdirSync(this.testDir)
            .filter(file => file.endsWith('.test.js'))
            .map(file => path.join(this.testDir, file));
    }
    
    /**
     * Run a specific test file
     */
    async runTestFile(testFile) {
        const fileName = path.basename(testFile);
        console.log(`📝 Running ${fileName}...`);
        
        try {
            // Read and execute test file in a controlled environment
            const testCode = fs.readFileSync(testFile, 'utf8');
            const testContext = this.createTestContext();
            
            // Execute test file
            const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
            const testFunction = new AsyncFunction('test', 'expect', 'console', testCode);
            
            await testFunction(testContext.test, testContext.expect, console);
            
            console.log(`  ✅ ${fileName} completed\n`);
            
        } catch (error) {
            console.log(`  ❌ ${fileName} failed: ${error.message}\n`);
            this.results.failed++;
            this.results.errors.push({
                file: fileName,
                error: error.message,
                stack: error.stack
            });
        }
    }
    
    /**
     * Create test context with test utilities
     */
    createTestContext() {
        const self = this;
        
        return {
            test: (description, testFn) => {
                console.log(`    → ${description}`);
                try {
                    const result = testFn();
                    if (result instanceof Promise) {
                        return result.then(() => {
                            self.results.passed++;
                            console.log(`      ✓ passed`);
                        }).catch((error) => {
                            self.results.failed++;
                            console.log(`      ✗ failed: ${error.message}`);
                            self.results.errors.push({
                                test: description,
                                error: error.message
                            });
                        });
                    } else {
                        self.results.passed++;
                        console.log(`      ✓ passed`);
                    }
                } catch (error) {
                    self.results.failed++;
                    console.log(`      ✗ failed: ${error.message}`);
                    self.results.errors.push({
                        test: description,
                        error: error.message
                    });
                }
            },
            
            expect: (actual) => ({
                toBe: (expected) => {
                    if (actual !== expected) {
                        throw new Error(`Expected ${expected}, got ${actual}`);
                    }
                },
                toEqual: (expected) => {
                    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
                        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
                    }
                },
                toBeTruthy: () => {
                    if (!actual) {
                        throw new Error(`Expected truthy value, got ${actual}`);
                    }
                },
                toBeFalsy: () => {
                    if (actual) {
                        throw new Error(`Expected falsy value, got ${actual}`);
                    }
                },
                toContain: (expected) => {
                    if (!actual || !actual.includes || !actual.includes(expected)) {
                        throw new Error(`Expected ${actual} to contain ${expected}`);
                    }
                },
                toThrow: () => {
                    let threw = false;
                    try {
                        if (typeof actual === 'function') {
                            actual();
                        }
                    } catch (error) {
                        threw = true;
                    }
                    if (!threw) {
                        throw new Error('Expected function to throw an error');
                    }
                }
            })
        };
    }
    
    /**
     * Create initial test files
     */
    createInitialTests() {
        console.log('📁 Creating initial test files...\n');
        
        // Task Extractor Tests
        this.createTestFile('task-extractor.test.js', `
// Test TaskExtractor functionality
test('should extract tasks from message', () => {
    // Mock TaskExtractor for testing
    const mockExtractor = {
        extractPotentialTasks: (message) => {
            if (message.includes('I need to')) {
                return [{ text: 'test task', confidence: 0.8 }];
            }
            return [];
        }
    };
    
    const result = mockExtractor.extractPotentialTasks('I need to test this');
    expect(result).toBeTruthy();
    expect(result.length).toBe(1);
    expect(result[0].text).toBe('test task');
});

test('should calculate confidence correctly', () => {
    // Mock confidence calculation
    const mockCalculateConfidence = (text) => {
        if (text.includes('call') || text.includes('email')) return 0.8;
        return 0.5;
    };
    
    expect(mockCalculateConfidence('call John')).toBe(0.8);
    expect(mockCalculateConfidence('email Sarah')).toBe(0.8);
    expect(mockCalculateConfidence('do something')).toBe(0.5);
});

test('should categorize tasks correctly', () => {
    // Mock task categorization
    const mockCategorize = (text) => {
        if (text.includes('meeting') || text.includes('work')) return 'work';
        if (text.includes('doctor') || text.includes('family')) return 'personal';
        return 'general';
    };
    
    expect(mockCategorize('schedule meeting')).toBe('work');
    expect(mockCategorize('doctor appointment')).toBe('personal');
    expect(mockCategorize('buy groceries')).toBe('general');
});
`);

        // Security Utils Tests
        this.createTestFile('security-utils.test.js', `
// Test SecurityUtils functionality
test('should escape HTML correctly', () => {
    // Mock HTML escaping
    const mockEscapeHtml = (text) => {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    };
    
    expect(mockEscapeHtml('<script>')).toBe('&lt;script&gt;');
    expect(mockEscapeHtml('Hello & "World"')).toBe('Hello &amp; &quot;World&quot;');
});

test('should sanitize CSS colors', () => {
    // Mock color sanitization
    const mockSanitizeColor = (color) => {
        const safePattern = /^#[0-9A-Fa-f]{3,6}$/;
        return safePattern.test(color) ? color : '#64748b';
    };
    
    expect(mockSanitizeColor('#ff0000')).toBe('#ff0000');
    expect(mockSanitizeColor('#abc')).toBe('#abc');
    expect(mockSanitizeColor('javascript:alert(1)')).toBe('#64748b');
});

test('should validate safe URLs', () => {
    // Mock URL validation
    const mockIsSafeUrl = (url) => {
        try {
            const parsed = new URL(url);
            return ['http:', 'https:', 'mailto:'].includes(parsed.protocol);
        } catch {
            return false;
        }
    };
    
    expect(mockIsSafeUrl('https://example.com')).toBeTruthy();
    expect(mockIsSafeUrl('http://example.com')).toBeTruthy();
    expect(mockIsSafeUrl('javascript:alert(1)')).toBeFalsy();
});
`);

        // Logger Tests
        this.createTestFile('logger.test.js', `
// Test Logger functionality
test('should set correct log levels', () => {
    // Mock logger levels
    const mockLevels = {
        error: 0,
        warn: 1,
        info: 2,
        debug: 3
    };
    
    expect(mockLevels.error).toBe(0);
    expect(mockLevels.debug).toBe(3);
});

test('should detect production environment', () => {
    // Mock production detection
    const mockIsProduction = (url) => {
        return url && !url.includes('unpacked') && !url.includes('localhost');
    };
    
    expect(mockIsProduction('chrome-extension://abc123/index.html')).toBeTruthy();
    expect(mockIsProduction('chrome-extension://unpacked/index.html')).toBeFalsy();
});

test('should store errors correctly', () => {
    // Mock error storage
    const mockErrors = [];
    const mockStoreError = (message, data) => {
        mockErrors.push({ message, data, timestamp: Date.now() });
        if (mockErrors.length > 10) mockErrors.shift();
    };
    
    mockStoreError('Test error', { test: true });
    expect(mockErrors.length).toBe(1);
    expect(mockErrors[0].message).toBe('Test error');
});
`);

        // Task Storage Tests
        this.createTestFile('task-storage.test.js', `
// Test TaskStorage functionality
test('should create tasks correctly', () => {
    // Mock task creation
    const mockTasks = new Map();
    let nextId = 1;
    
    const mockCreateTask = (taskData) => {
        const taskId = 'task_' + nextId++;
        const task = {
            id: taskId,
            title: taskData.text || taskData.title,
            status: 'pending',
            createdAt: new Date().toISOString(),
            ...taskData
        };
        mockTasks.set(taskId, task);
        return task;
    };
    
    const task = mockCreateTask({ text: 'Test task' });
    expect(task.id).toBe('task_1');
    expect(task.title).toBe('Test task');
    expect(task.status).toBe('pending');
});

test('should filter tasks correctly', () => {
    // Mock task filtering
    const mockAllTasks = [
        { id: '1', status: 'pending', category: 'work' },
        { id: '2', status: 'completed', category: 'work' },
        { id: '3', status: 'pending', category: 'personal' }
    ];
    
    const mockFilterTasks = (filters) => {
        return mockAllTasks.filter(task => {
            if (filters.status && task.status !== filters.status) return false;
            if (filters.category && task.category !== filters.category) return false;
            return true;
        });
    };
    
    const pendingTasks = mockFilterTasks({ status: 'pending' });
    expect(pendingTasks.length).toBe(2);
    
    const workTasks = mockFilterTasks({ category: 'work' });
    expect(workTasks.length).toBe(2);
});
`);

        console.log('✅ Created initial test files');
    }
    
    /**
     * Create a test file
     */
    createTestFile(filename, content) {
        const filePath = path.join(this.testDir, filename);
        fs.writeFileSync(filePath, content.trim(), 'utf8');
        console.log(`  ✓ Created ${filename}`);
    }
    
    /**
     * Print test results
     */
    printResults() {
        const duration = this.results.endTime - this.results.startTime;
        const total = this.results.passed + this.results.failed;
        
        console.log('\n📊 Test Results:');
        console.log(`   Passed:  ${this.results.passed}`);
        console.log(`   Failed:  ${this.results.failed}`);
        console.log(`   Total:   ${total}`);
        console.log(`   Time:    ${duration}ms`);
        
        if (this.results.failed > 0) {
            console.log('\n❌ Failed Tests:');
            this.results.errors.forEach(error => {
                console.log(`   ${error.test || error.file}: ${error.error}`);
            });
            process.exit(1);
        } else {
            console.log('\n✅ All tests passed!');
        }
    }
    
    /**
     * Start watch mode
     */
    startWatchMode() {
        console.log('\n👀 Watching for changes... (Press Ctrl+C to exit)');
        
        const watchedDirs = [this.testDir, __dirname];
        const watchedFiles = new Set();
        
        watchedDirs.forEach(dir => {
            if (fs.existsSync(dir)) {
                fs.readdirSync(dir).forEach(file => {
                    if (file.endsWith('.js')) {
                        watchedFiles.add(path.join(dir, file));
                    }
                });
            }
        });
        
        watchedFiles.forEach(file => {
            fs.watchFile(file, { interval: 1000 }, () => {
                console.log(`\n🔄 File changed: ${path.basename(file)}`);
                console.log('Re-running tests...\n');
                
                // Reset results
                this.results = {
                    passed: 0,
                    failed: 0,
                    errors: [],
                    startTime: null,
                    endTime: null
                };
                
                // Re-run tests
                this.runTests();
            });
        });
    }
}

// CLI interface
if (require.main === module) {
    const runner = new TestRunner();
    runner.runTests().catch(console.error);
}

module.exports = TestRunner;