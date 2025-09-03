// Branestawm - Test Suite
// Comprehensive testing framework for all optimization features

class TestSuite {
    constructor() {
        if (TestSuite.instance) {
            return TestSuite.instance;
        }
        
        this.tests = new Map();
        this.testResults = new Map();
        this.benchmarks = new Map();
        this.testRunners = new Map();
        this.suiteConfig = {
            timeout: 30000, // 30 second default timeout
            retries: 2,
            parallel: true,
            reportingLevel: 'detailed'
        };
        
        this.initializeTestSuite();
        this.registerTestRunners();
        this.setupBenchmarking();
        
        TestSuite.instance = this;
        console.log('TestSuite initialized');
    }
    
    /**
     * Initialize test suite categories and configurations
     */
    initializeTestSuite() {
        this.testCategories = {
            unit: {
                name: 'Unit Tests',
                description: 'Test individual components and functions',
                timeout: 5000,
                parallel: true
            },
            integration: {
                name: 'Integration Tests',
                description: 'Test interaction between components',
                timeout: 15000,
                parallel: false
            },
            performance: {
                name: 'Performance Tests',
                description: 'Benchmark and performance regression tests',
                timeout: 30000,
                parallel: false
            },
            endToEnd: {
                name: 'End-to-End Tests',
                description: 'Test complete user workflows',
                timeout: 60000,
                parallel: false
            },
            stress: {
                name: 'Stress Tests',
                description: 'Test system under high load',
                timeout: 120000,
                parallel: false
            }
        };
        
        // Test execution statistics
        this.executionStats = {
            totalTests: 0,
            passedTests: 0,
            failedTests: 0,
            skippedTests: 0,
            totalExecutionTime: 0,
            lastRun: null
        };
    }
    
    /**
     * Register test runners for different categories
     */
    registerTestRunners() {
        // Unit test runner
        this.testRunners.set('unit', {
            name: 'Unit Test Runner',
            execute: this.runUnitTests.bind(this),
            setup: this.setupUnitTests.bind(this),
            teardown: this.teardownUnitTests.bind(this)
        });
        
        // Integration test runner
        this.testRunners.set('integration', {
            name: 'Integration Test Runner',
            execute: this.runIntegrationTests.bind(this),
            setup: this.setupIntegrationTests.bind(this),
            teardown: this.teardownIntegrationTests.bind(this)
        });
        
        // Performance test runner
        this.testRunners.set('performance', {
            name: 'Performance Test Runner',
            execute: this.runPerformanceTests.bind(this),
            setup: this.setupPerformanceTests.bind(this),
            teardown: this.teardownPerformanceTests.bind(this)
        });
        
        // End-to-end test runner
        this.testRunners.set('endToEnd', {
            name: 'End-to-End Test Runner',
            execute: this.runEndToEndTests.bind(this),
            setup: this.setupEndToEndTests.bind(this),
            teardown: this.teardownEndToEndTests.bind(this)
        });
        
        // Stress test runner
        this.testRunners.set('stress', {
            name: 'Stress Test Runner',
            execute: this.runStressTests.bind(this),
            setup: this.setupStressTests.bind(this),
            teardown: this.teardownStressTests.bind(this)
        });
    }
    
    /**
     * Setup benchmarking system
     */
    setupBenchmarking() {
        this.benchmarkSuites = {
            dataOperations: {
                name: 'Data Operations Benchmark',
                description: 'Benchmark data loading, saving, and processing operations',
                tests: [
                    'dataManager_loadData',
                    'dataManager_saveData',
                    'messageManager_addMessage',
                    'summarizationEngine_generateSummary'
                ]
            },
            cachePerformance: {
                name: 'Cache Performance Benchmark',
                description: 'Benchmark cache operations and hit rates',
                tests: [
                    'cacheManager_set',
                    'cacheManager_get',
                    'cacheManager_eviction',
                    'cacheManager_compression'
                ]
            },
            memoryUsage: {
                name: 'Memory Usage Benchmark',
                description: 'Benchmark memory consumption and cleanup',
                tests: [
                    'memoryOptimizer_cleanup',
                    'memoryOptimizer_leakDetection',
                    'streamManager_loadData'
                ]
            },
            backgroundProcessing: {
                name: 'Background Processing Benchmark',
                description: 'Benchmark background task processing',
                tests: [
                    'backgroundProcessor_taskExecution',
                    'backgroundProcessor_queueManagement',
                    'backgroundProcessor_workerUtilization'
                ]
            }
        };
    }
    
    /**
     * Register a test case
     */
    registerTest(category, testName, testFunction, options = {}) {
        const testId = `${category}_${testName}`;
        
        const test = {
            id: testId,
            category,
            name: testName,
            function: testFunction,
            options: {
                timeout: options.timeout || this.testCategories[category]?.timeout || this.suiteConfig.timeout,
                retries: options.retries || this.suiteConfig.retries,
                skip: options.skip || false,
                only: options.only || false,
                description: options.description || '',
                dependencies: options.dependencies || [],
                setup: options.setup,
                teardown: options.teardown
            },
            registeredAt: Date.now()
        };
        
        if (!this.tests.has(category)) {
            this.tests.set(category, new Map());
        }
        
        this.tests.get(category).set(testName, test);
        this.executionStats.totalTests++;
        
        return testId;
    }
    
    /**
     * Run all tests in a category or specific test
     */
    async runTests(category = 'all', testName = null) {
        const startTime = Date.now();
        const results = {
            timestamp: startTime,
            category,
            testName,
            results: new Map(),
            summary: {
                total: 0,
                passed: 0,
                failed: 0,
                skipped: 0,
                executionTime: 0
            },
            errors: []
        };
        
        try {
            if (category === 'all') {
                // Run all test categories
                for (const [cat] of this.tests) {
                    const categoryResults = await this.runTestCategory(cat);
                    results.results.set(cat, categoryResults);
                    
                    // Aggregate summary
                    results.summary.total += categoryResults.summary.total;
                    results.summary.passed += categoryResults.summary.passed;
                    results.summary.failed += categoryResults.summary.failed;
                    results.summary.skipped += categoryResults.summary.skipped;
                }
            } else if (testName) {
                // Run specific test
                const testResult = await this.runSingleTest(category, testName);
                results.results.set(`${category}_${testName}`, testResult);
                results.summary.total = 1;
                results.summary.passed = testResult.passed ? 1 : 0;
                results.summary.failed = testResult.passed ? 0 : 1;
            } else {
                // Run specific category
                const categoryResults = await this.runTestCategory(category);
                results.results.set(category, categoryResults);
                results.summary = categoryResults.summary;
            }
            
            const endTime = Date.now();
            results.summary.executionTime = endTime - startTime;
            
            // Update execution statistics
            this.updateExecutionStats(results.summary);
            
            // Store results
            this.testResults.set(startTime, results);
            
            // Clean up old results (keep last 50)
            if (this.testResults.size > 50) {
                const oldest = Math.min(...this.testResults.keys());
                this.testResults.delete(oldest);
            }
            
            console.log(`Test execution completed in ${results.summary.executionTime}ms:`, 
                       `${results.summary.passed}/${results.summary.total} passed`);
            
            return results;
            
        } catch (error) {
            console.error('Test execution failed:', error);
            results.errors.push({
                type: 'execution_error',
                message: error.message,
                stack: error.stack,
                timestamp: Date.now()
            });
            return results;
        }
    }
    
    /**
     * Run all tests in a specific category
     */
    async runTestCategory(category) {
        const categoryTests = this.tests.get(category);
        if (!categoryTests) {
            throw new Error(`Test category '${category}' not found`);
        }
        
        const runner = this.testRunners.get(category);
        const results = {
            category,
            timestamp: Date.now(),
            tests: new Map(),
            summary: {
                total: categoryTests.size,
                passed: 0,
                failed: 0,
                skipped: 0,
                executionTime: 0
            }
        };
        
        // Setup for category
        if (runner && runner.setup) {
            await runner.setup();
        }
        
        try {
            // Run tests in parallel or series based on category config
            const categoryConfig = this.testCategories[category];
            const testsToRun = Array.from(categoryTests.values());
            
            if (categoryConfig && categoryConfig.parallel && this.suiteConfig.parallel) {
                // Run tests in parallel
                const testPromises = testsToRun.map(test => this.executeSingleTest(test));
                const testResults = await Promise.allSettled(testPromises);
                
                testResults.forEach((result, index) => {
                    const test = testsToRun[index];
                    const testResult = result.status === 'fulfilled' ? result.value : {
                        testId: test.id,
                        passed: false,
                        error: result.reason,
                        executionTime: 0,
                        timestamp: Date.now()
                    };
                    
                    results.tests.set(test.name, testResult);
                    this.updateCategorySummary(results.summary, testResult);
                });
            } else {
                // Run tests in series
                for (const test of testsToRun) {
                    const testResult = await this.executeSingleTest(test);
                    results.tests.set(test.name, testResult);
                    this.updateCategorySummary(results.summary, testResult);
                }
            }
            
        } finally {
            // Teardown for category
            if (runner && runner.teardown) {
                await runner.teardown();
            }
        }
        
        return results;
    }
    
    /**
     * Execute a single test with timeout and retry logic
     */
    async executeSingleTest(test) {
        const result = {
            testId: test.id,
            testName: test.name,
            category: test.category,
            passed: false,
            error: null,
            executionTime: 0,
            attempts: 0,
            timestamp: Date.now(),
            logs: []
        };
        
        // Skip test if configured
        if (test.options.skip) {
            result.skipped = true;
            result.reason = 'Test marked as skip';
            return result;
        }
        
        // Check dependencies
        if (test.options.dependencies.length > 0) {
            const dependencyCheck = await this.checkTestDependencies(test.options.dependencies);
            if (!dependencyCheck.satisfied) {
                result.skipped = true;
                result.reason = `Dependency not satisfied: ${dependencyCheck.missing.join(', ')}`;
                return result;
            }
        }
        
        const maxAttempts = test.options.retries + 1;
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            result.attempts = attempt;
            const attemptStartTime = performance.now();
            
            try {
                // Setup for individual test
                if (test.options.setup) {
                    await test.options.setup();
                }
                
                // Execute test with timeout
                const testPromise = test.function();
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Test timeout')), test.options.timeout)
                );
                
                await Promise.race([testPromise, timeoutPromise]);
                
                const attemptEndTime = performance.now();
                result.executionTime = attemptEndTime - attemptStartTime;
                result.passed = true;
                
                result.logs.push({
                    level: 'info',
                    message: `Test passed on attempt ${attempt}`,
                    timestamp: Date.now()
                });
                
                break; // Test passed, exit retry loop
                
            } catch (error) {
                const attemptEndTime = performance.now();
                const attemptTime = attemptEndTime - attemptStartTime;
                
                result.logs.push({
                    level: 'error',
                    message: `Attempt ${attempt} failed: ${error.message}`,
                    timestamp: Date.now(),
                    executionTime: attemptTime
                });
                
                if (attempt === maxAttempts) {
                    // Last attempt failed
                    result.error = {
                        message: error.message,
                        stack: error.stack,
                        type: error.constructor.name
                    };
                    result.executionTime = result.logs.reduce((total, log) => 
                        total + (log.executionTime || 0), 0);
                } else {
                    // Wait before retry
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                }
                
            } finally {
                // Teardown for individual test
                if (test.options.teardown) {
                    try {
                        await test.options.teardown();
                    } catch (teardownError) {
                        result.logs.push({
                            level: 'warning',
                            message: `Teardown failed: ${teardownError.message}`,
                            timestamp: Date.now()
                        });
                    }
                }
            }
        }
        
        return result;
    }
    
    /**
     * Run unit tests
     */
    async runUnitTests() {
        // Register and run unit tests for all systems
        await this.registerDataManagerUnitTests();
        await this.registerCacheManagerUnitTests();
        await this.registerPerformanceMonitorUnitTests();
        await this.registerMemoryOptimizerUnitTests();
        
        console.log('Unit tests execution completed');
    }
    
    /**
     * Run integration tests
     */
    async runIntegrationTests() {
        await this.registerSystemIntegrationTests();
        console.log('Integration tests execution completed');
    }
    
    /**
     * Run performance tests
     */
    async runPerformanceTests() {
        await this.runBenchmarkSuite('dataOperations');
        await this.runBenchmarkSuite('cachePerformance');
        await this.runBenchmarkSuite('memoryUsage');
        console.log('Performance tests execution completed');
    }
    
    /**
     * Run end-to-end tests
     */
    async runEndToEndTests() {
        await this.registerEndToEndWorkflowTests();
        console.log('End-to-end tests execution completed');
    }
    
    /**
     * Run stress tests
     */
    async runStressTests() {
        await this.registerStressTests();
        console.log('Stress tests execution completed');
    }
    
    /**
     * Register Data Manager unit tests
     */
    async registerDataManagerUnitTests() {
        if (!window.dataManager) {
            this.registerTest('unit', 'dataManager_availability', async () => {
                throw new Error('DataManager is not available');
            });
            return;
        }
        
        this.registerTest('unit', 'dataManager_loadData', async () => {
            const startTime = performance.now();
            const data = await window.dataManager.loadData();
            const loadTime = performance.now() - startTime;
            
            if (!data) throw new Error('Failed to load data');
            if (loadTime > 2000) throw new Error(`Load time too slow: ${loadTime}ms`);
        }, { description: 'Test data loading functionality and performance' });
        
        this.registerTest('unit', 'dataManager_saveData', async () => {
            const startTime = performance.now();
            await window.dataManager.saveData();
            const saveTime = performance.now() - startTime;
            
            if (saveTime > 1000) throw new Error(`Save time too slow: ${saveTime}ms`);
        }, { description: 'Test data saving functionality and performance' });
        
        this.registerTest('unit', 'dataManager_getSettings', async () => {
            const settings = window.dataManager.getSettings();
            
            if (!settings) throw new Error('Settings not loaded');
            if (typeof settings !== 'object') throw new Error('Settings is not an object');
            if (!settings.hasOwnProperty('activeLlm')) throw new Error('Missing required setting: activeLlm');
        }, { description: 'Test settings retrieval' });
        
        this.registerTest('unit', 'dataManager_getFolios', async () => {
            const folios = window.dataManager.getFolios();
            
            if (!folios) throw new Error('Folios not loaded');
            if (typeof folios !== 'object') throw new Error('Folios is not an object');
        }, { description: 'Test folios retrieval' });
    }
    
    /**
     * Register Cache Manager unit tests
     */
    async registerCacheManagerUnitTests() {
        if (!window.cacheManager) {
            this.registerTest('unit', 'cacheManager_availability', async () => {
                throw new Error('CacheManager is not available');
            });
            return;
        }
        
        this.registerTest('unit', 'cacheManager_setGet', async () => {
            const testKey = 'test_cache_key_' + Date.now();
            const testValue = { test: 'data', timestamp: Date.now() };
            
            const setSuccess = await window.cacheManager.set('llm_responses', testKey, testValue);
            if (!setSuccess) throw new Error('Failed to set cache value');
            
            const retrievedValue = await window.cacheManager.get('llm_responses', testKey);
            if (!retrievedValue) throw new Error('Failed to retrieve cache value');
            
            if (JSON.stringify(retrievedValue) !== JSON.stringify(testValue)) {
                throw new Error('Retrieved value does not match set value');
            }
        }, { description: 'Test basic cache set and get operations' });
        
        this.registerTest('unit', 'cacheManager_eviction', async () => {
            const cacheType = 'test_cache_' + Date.now();
            
            // Create cache with small size for testing
            window.cacheManager.createCache(cacheType, { maxSize: 2, ttl: 60000 });
            
            // Fill cache beyond capacity
            await window.cacheManager.set(cacheType, 'key1', 'value1');
            await window.cacheManager.set(cacheType, 'key2', 'value2');
            await window.cacheManager.set(cacheType, 'key3', 'value3'); // Should trigger eviction
            
            // Check that eviction occurred
            const value1 = await window.cacheManager.get(cacheType, 'key1');
            if (value1) throw new Error('Expected key1 to be evicted');
            
            const value3 = await window.cacheManager.get(cacheType, 'key3');
            if (!value3) throw new Error('Expected key3 to be present');
            
            // Clean up
            window.cacheManager.clear(cacheType);
        }, { description: 'Test cache eviction functionality' });
        
        this.registerTest('unit', 'cacheManager_statistics', async () => {
            const stats = window.cacheManager.getStatistics();
            
            if (!stats) throw new Error('Statistics not available');
            if (!stats.overall) throw new Error('Overall statistics missing');
            if (typeof stats.overall.totalCaches !== 'number') {
                throw new Error('Invalid statistics format');
            }
        }, { description: 'Test cache statistics retrieval' });
    }
    
    /**
     * Register Performance Monitor unit tests
     */
    async registerPerformanceMonitorUnitTests() {
        if (!window.performanceMonitor) {
            this.registerTest('unit', 'performanceMonitor_availability', async () => {
                throw new Error('PerformanceMonitor is not available');
            });
            return;
        }
        
        this.registerTest('unit', 'performanceMonitor_recordMetric', async () => {
            const testMetric = 'test.metric_' + Date.now();
            const testValue = Math.random() * 100;
            
            window.performanceMonitor.recordMetric(testMetric, testValue);
            
            // Wait a moment for metric to be processed
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const report = window.performanceMonitor.getPerformanceReport();
            
            if (!report) throw new Error('Performance report not available');
            if (!report.categories) throw new Error('Categories missing from report');
        }, { description: 'Test metric recording functionality' });
        
        this.registerTest('unit', 'performanceMonitor_timer', async () => {
            const timerId = window.performanceMonitor.startTimer('test_operation');
            
            if (!timerId) throw new Error('Failed to start timer');
            
            // Simulate some work
            await new Promise(resolve => setTimeout(resolve, 50));
            
            const duration = window.performanceMonitor.endTimer(timerId);
            
            if (typeof duration !== 'number') throw new Error('Timer did not return duration');
            if (duration < 40) throw new Error('Timer duration too short');
            if (duration > 100) throw new Error('Timer duration too long');
        }, { description: 'Test performance timing functionality' });
    }
    
    /**
     * Register Memory Optimizer unit tests
     */
    async registerMemoryOptimizerUnitTests() {
        if (!window.memoryOptimizer) {
            this.registerTest('unit', 'memoryOptimizer_availability', async () => {
                throw new Error('MemoryOptimizer is not available');
            });
            return;
        }
        
        this.registerTest('unit', 'memoryOptimizer_memoryInfo', async () => {
            const memoryInfo = window.memoryOptimizer.getMemoryInfo();
            
            if (!memoryInfo) throw new Error('Memory info not available');
            if (typeof memoryInfo.timestamp !== 'number') {
                throw new Error('Invalid memory info format');
            }
        }, { description: 'Test memory information retrieval' });
        
        this.registerTest('unit', 'memoryOptimizer_cleanup', async () => {
            const initialMemory = window.memoryOptimizer.getMemoryInfo();
            
            // Force optimization
            await window.memoryOptimizer.forceOptimization('standard');
            
            // Wait for cleanup to complete
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const postCleanupMemory = window.memoryOptimizer.getMemoryInfo();
            
            // Validate cleanup occurred (memory should be same or lower)
            if (postCleanupMemory.usedMB > initialMemory.usedMB * 1.1) {
                throw new Error('Memory usage increased after cleanup');
            }
        }, { description: 'Test memory cleanup functionality', timeout: 10000 });
    }
    
    /**
     * Run benchmark suite
     */
    async runBenchmarkSuite(suiteName) {
        const suite = this.benchmarkSuites[suiteName];
        if (!suite) {
            throw new Error(`Benchmark suite '${suiteName}' not found`);
        }
        
        const benchmarkResults = {
            suiteName,
            timestamp: Date.now(),
            results: new Map(),
            summary: {
                totalTests: suite.tests.length,
                completedTests: 0,
                averageExecutionTime: 0,
                totalExecutionTime: 0
            }
        };
        
        for (const testName of suite.tests) {
            try {
                const result = await this.runBenchmarkTest(testName);
                benchmarkResults.results.set(testName, result);
                benchmarkResults.summary.completedTests++;
                benchmarkResults.summary.totalExecutionTime += result.executionTime;
            } catch (error) {
                benchmarkResults.results.set(testName, {
                    testName,
                    error: error.message,
                    executionTime: 0,
                    timestamp: Date.now()
                });
            }
        }
        
        benchmarkResults.summary.averageExecutionTime = 
            benchmarkResults.summary.totalExecutionTime / benchmarkResults.summary.completedTests;
        
        this.benchmarks.set(`${suiteName}_${Date.now()}`, benchmarkResults);
        
        return benchmarkResults;
    }
    
    /**
     * Run individual benchmark test
     */
    async runBenchmarkTest(testName) {
        const iterations = 10;
        const executionTimes = [];
        
        for (let i = 0; i < iterations; i++) {
            const startTime = performance.now();
            
            switch (testName) {
                case 'dataManager_loadData':
                    if (window.dataManager) await window.dataManager.loadData();
                    break;
                case 'dataManager_saveData':
                    if (window.dataManager) await window.dataManager.saveData();
                    break;
                case 'cacheManager_set':
                    if (window.cacheManager) {
                        await window.cacheManager.set('test_cache', `key_${i}`, { data: `value_${i}` });
                    }
                    break;
                case 'cacheManager_get':
                    if (window.cacheManager) {
                        await window.cacheManager.get('test_cache', 'key_0');
                    }
                    break;
                default:
                    console.warn(`Unknown benchmark test: ${testName}`);
            }
            
            const endTime = performance.now();
            executionTimes.push(endTime - startTime);
            
            // Small delay between iterations
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        return {
            testName,
            iterations,
            executionTimes,
            averageTime: executionTimes.reduce((sum, time) => sum + time, 0) / iterations,
            minTime: Math.min(...executionTimes),
            maxTime: Math.max(...executionTimes),
            timestamp: Date.now()
        };
    }
    
    /**
     * Update category summary with test result
     */
    updateCategorySummary(summary, testResult) {
        if (testResult.skipped) {
            summary.skipped++;
        } else if (testResult.passed) {
            summary.passed++;
        } else {
            summary.failed++;
        }
        summary.executionTime += testResult.executionTime || 0;
    }
    
    /**
     * Update overall execution statistics
     */
    updateExecutionStats(summary) {
        this.executionStats.passedTests += summary.passed;
        this.executionStats.failedTests += summary.failed;
        this.executionStats.skippedTests += summary.skipped;
        this.executionStats.totalExecutionTime += summary.executionTime;
        this.executionStats.lastRun = Date.now();
    }
    
    /**
     * Check test dependencies
     */
    async checkTestDependencies(dependencies) {
        const result = {
            satisfied: true,
            missing: []
        };
        
        for (const dependency of dependencies) {
            if (!window[dependency]) {
                result.satisfied = false;
                result.missing.push(dependency);
            }
        }
        
        return result;
    }
    
    /**
     * Get test report
     */
    getTestReport(includeDetails = false) {
        const recentResults = Array.from(this.testResults.values()).slice(-10);
        const recentBenchmarks = Array.from(this.benchmarks.values()).slice(-5);
        
        const report = {
            timestamp: Date.now(),
            executionStats: { ...this.executionStats },
            recentResults: includeDetails ? recentResults : recentResults.map(result => ({
                timestamp: result.timestamp,
                category: result.category,
                summary: result.summary
            })),
            benchmarks: recentBenchmarks,
            testCategories: Object.keys(this.testCategories),
            totalRegisteredTests: this.executionStats.totalTests,
            health: this.assessTestHealth()
        };
        
        return report;
    }
    
    /**
     * Assess overall test health
     */
    assessTestHealth() {
        const stats = this.executionStats;
        
        if (stats.totalTests === 0) {
            return {
                status: 'unknown',
                message: 'No tests have been run yet'
            };
        }
        
        const totalRun = stats.passedTests + stats.failedTests;
        const passRate = totalRun > 0 ? stats.passedTests / totalRun : 0;
        
        if (passRate >= 0.95) {
            return {
                status: 'excellent',
                message: `${(passRate * 100).toFixed(1)}% pass rate - excellent test health`
            };
        } else if (passRate >= 0.8) {
            return {
                status: 'good',
                message: `${(passRate * 100).toFixed(1)}% pass rate - good test health`
            };
        } else if (passRate >= 0.6) {
            return {
                status: 'fair',
                message: `${(passRate * 100).toFixed(1)}% pass rate - fair test health`
            };
        } else {
            return {
                status: 'poor',
                message: `${(passRate * 100).toFixed(1)}% pass rate - poor test health`
            };
        }
    }
    
    /**
     * Setup methods for test categories
     */
    async setupUnitTests() {
        console.log('Setting up unit tests...');
        // Any global setup for unit tests
    }
    
    async teardownUnitTests() {
        console.log('Tearing down unit tests...');
        // Any global teardown for unit tests
    }
    
    async setupIntegrationTests() {
        console.log('Setting up integration tests...');
        // Ensure all systems are initialized
    }
    
    async teardownIntegrationTests() {
        console.log('Tearing down integration tests...');
        // Clean up any test data
    }
    
    async setupPerformanceTests() {
        console.log('Setting up performance tests...');
        // Clear caches, reset metrics
        if (window.performanceMonitor) {
            // Reset performance metrics for clean benchmarking
        }
    }
    
    async teardownPerformanceTests() {
        console.log('Tearing down performance tests...');
        // Clean up performance test artifacts
    }
    
    async setupEndToEndTests() {
        console.log('Setting up end-to-end tests...');
        // Initialize complete system state
    }
    
    async teardownEndToEndTests() {
        console.log('Tearing down end-to-end tests...');
        // Reset system to clean state
    }
    
    async setupStressTests() {
        console.log('Setting up stress tests...');
        // Prepare system for high load testing
    }
    
    async teardownStressTests() {
        console.log('Tearing down stress tests...');
        // Clean up after stress testing
    }
    
    /**
     * Export test results
     */
    exportResults(format = 'json') {
        const exportData = {
            timestamp: Date.now(),
            executionStats: this.executionStats,
            testResults: Object.fromEntries(this.testResults.entries()),
            benchmarks: Object.fromEntries(this.benchmarks.entries()),
            testCategories: this.testCategories
        };
        
        if (format === 'csv') {
            return this.convertResultsToCSV(exportData);
        }
        
        return exportData;
    }
    
    /**
     * Convert results to CSV format
     */
    convertResultsToCSV(data) {
        const csv = ['Category,Test,Status,ExecutionTime,Timestamp,Error'];
        
        Object.values(data.testResults).forEach(result => {
            if (result.results) {
                result.results.forEach((categoryResult, category) => {
                    if (categoryResult.tests) {
                        categoryResult.tests.forEach((testResult, testName) => {
                            const status = testResult.skipped ? 'skipped' : 
                                         testResult.passed ? 'passed' : 'failed';
                            const error = testResult.error ? 
                                         testResult.error.message.replace(/,/g, ';') : '';
                            
                            csv.push(`${category},${testName},${status},${testResult.executionTime},${testResult.timestamp},${error}`);
                        });
                    }
                });
            }
        });
        
        return csv.join('\n');
    }
    
    /**
     * Cleanup and destroy test suite
     */
    cleanup() {
        // Clear all data structures
        this.tests.clear();
        this.testResults.clear();
        this.benchmarks.clear();
        this.testRunners.clear();
        
        // Reset statistics
        this.executionStats = {
            totalTests: 0,
            passedTests: 0,
            failedTests: 0,
            skippedTests: 0,
            totalExecutionTime: 0,
            lastRun: null
        };
        
        console.log('TestSuite cleaned up');
    }
}

// Global instance
window.testSuite = new TestSuite();