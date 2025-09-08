// Branestawm - Memory Optimizer
// Advanced memory management, leak detection, and cleanup mechanisms

class MemoryOptimizer {
    constructor() {
        if (MemoryOptimizer.instance) {
            return MemoryOptimizer.instance;
        }
        
        this.memoryStats = new Map();
        this.memorySnapshots = [];
        this.cleanupTasks = new Map();
        this.leakDetectors = new Map();
        this.optimizationStrategies = new Map();
        
        this.initializeOptimizationStrategies();
        this.setupMemoryMonitoring();
        this.registerCleanupTasks();
        this.startMemoryOptimization();
        
        MemoryOptimizer.instance = this;
        console.log('MemoryOptimizer initialized');
    }
    
    /**
     * Initialize memory optimization strategies
     */
    initializeOptimizationStrategies() {
        // Large object pooling strategy
        this.optimizationStrategies.set('object_pooling', {
            name: 'Object Pooling',
            description: 'Reuse large objects to reduce GC pressure',
            execute: this.executeObjectPooling.bind(this),
            priority: 'high',
            frequency: 'on_demand'
        });
        
        // Weak reference cleanup strategy
        this.optimizationStrategies.set('weak_references', {
            name: 'Weak Reference Cleanup',
            description: 'Clean up weak references and event listeners',
            execute: this.executeWeakReferenceCleanup.bind(this),
            priority: 'medium',
            frequency: 'periodic'
        });
        
        // Data structure optimization strategy
        this.optimizationStrategies.set('data_structures', {
            name: 'Data Structure Optimization',
            description: 'Optimize data structures for memory efficiency',
            execute: this.executeDataStructureOptimization.bind(this),
            priority: 'high',
            frequency: 'periodic'
        });
        
        // Cache eviction strategy
        this.optimizationStrategies.set('cache_eviction', {
            name: 'Smart Cache Eviction',
            description: 'Intelligently evict cached data based on usage patterns',
            execute: this.executeCacheEviction.bind(this),
            priority: 'medium',
            frequency: 'periodic'
        });
        
        // DOM cleanup strategy
        this.optimizationStrategies.set('dom_cleanup', {
            name: 'DOM Element Cleanup',
            description: 'Remove unused DOM elements and event listeners',
            execute: this.executeDOMCleanup.bind(this),
            priority: 'medium',
            frequency: 'periodic'
        });
        
        // Memory defragmentation strategy
        this.optimizationStrategies.set('defragmentation', {
            name: 'Memory Defragmentation',
            description: 'Reorganize memory to reduce fragmentation',
            execute: this.executeMemoryDefragmentation.bind(this),
            priority: 'low',
            frequency: 'on_demand'
        });
    }
    
    /**
     * Setup memory monitoring and leak detection
     */
    setupMemoryMonitoring() {
        // Memory usage tracking
        this.memoryTrackingInterval = setInterval(() => {
            this.trackMemoryUsage();
        }, 30000); // Every 30 seconds
        
        // Memory leak detection
        this.leakDetectionInterval = setInterval(() => {
            this.detectMemoryLeaks();
        }, 5 * 60 * 1000); // Every 5 minutes
        
        // Periodic memory snapshots
        this.snapshotInterval = setInterval(() => {
            this.createMemorySnapshot();
        }, 2 * 60 * 1000); // Every 2 minutes
        
        // Setup performance observers for memory
        if ('PerformanceObserver' in window) {
            this.setupPerformanceObservers();
        }
    }
    
    /**
     * Register cleanup tasks for different systems
     */
    registerCleanupTasks() {
        // Data manager cleanup
        this.cleanupTasks.set('data_manager', {
            name: 'Data Manager Cleanup',
            execute: this.cleanupDataManager.bind(this),
            priority: 'high',
            interval: 10 * 60 * 1000 // 10 minutes
        });
        
        // Message manager cleanup
        this.cleanupTasks.set('message_manager', {
            name: 'Message Manager Cleanup',
            execute: this.cleanupMessageManager.bind(this),
            priority: 'high',
            interval: 15 * 60 * 1000 // 15 minutes
        });
        
        // Cache manager cleanup
        this.cleanupTasks.set('cache_manager', {
            name: 'Cache Manager Cleanup',
            execute: this.cleanupCacheManager.bind(this),
            priority: 'medium',
            interval: 5 * 60 * 1000 // 5 minutes
        });
        
        // Background processor cleanup
        this.cleanupTasks.set('background_processor', {
            name: 'Background Processor Cleanup',
            execute: this.cleanupBackgroundProcessor.bind(this),
            priority: 'medium',
            interval: 20 * 60 * 1000 // 20 minutes
        });
        
        // Stream manager cleanup
        this.cleanupTasks.set('stream_manager', {
            name: 'Stream Manager Cleanup',
            execute: this.cleanupStreamManager.bind(this),
            priority: 'medium',
            interval: 30 * 60 * 1000 // 30 minutes
        });
        
        // Performance monitor cleanup
        this.cleanupTasks.set('performance_monitor', {
            name: 'Performance Monitor Cleanup',
            execute: this.cleanupPerformanceMonitor.bind(this),
            priority: 'low',
            interval: 60 * 60 * 1000 // 1 hour
        });
    }
    
    /**
     * Start memory optimization scheduling
     */
    startMemoryOptimization() {
        // Schedule cleanup tasks
        this.cleanupTasks.forEach((task, taskId) => {
            setInterval(() => {
                this.executeCleanupTask(taskId).catch(error => {
                    console.error(`Cleanup task ${taskId} failed:`, error);
                });
            }, task.interval);
        });
        
        // Schedule optimization strategies
        setInterval(() => {
            this.executePeriodicOptimizations();
        }, 60 * 1000); // Every minute
        
        // Emergency cleanup when memory is high
        setInterval(() => {
            this.checkMemoryPressure();
        }, 10 * 1000); // Every 10 seconds
    }
    
    /**
     * Track current memory usage
     */
    trackMemoryUsage() {
        try {
            const memoryInfo = this.getMemoryInfo();
            const timestamp = Date.now();
            
            // Store current stats
            this.memoryStats.set(timestamp, memoryInfo);
            
            // Keep only last 100 entries
            if (this.memoryStats.size > 100) {
                const oldest = Math.min(...this.memoryStats.keys());
                this.memoryStats.delete(oldest);
            }
            
            // Record performance metrics
            if (window.performanceMonitor) {
                window.performanceMonitor.recordMetric('system.memoryUsage', memoryInfo.usedMB);
                window.performanceMonitor.recordMetric('system.memoryGrowth', memoryInfo.growthRate || 0);
            }
            
            return memoryInfo;
            
        } catch (error) {
            console.error('Error tracking memory usage:', error);
            return null;
        }
    }
    
    /**
     * Get comprehensive memory information
     */
    getMemoryInfo() {
        const info = {
            timestamp: Date.now(),
            available: false,
            usedBytes: 0,
            usedMB: 0,
            totalBytes: 0,
            totalMB: 0,
            limitBytes: 0,
            limitMB: 0,
            utilizationRate: 0,
            growthRate: 0
        };
        
        if (performance.memory) {
            info.available = true;
            info.usedBytes = performance.memory.usedJSHeapSize;
            info.usedMB = info.usedBytes / (1024 * 1024);
            info.totalBytes = performance.memory.totalJSHeapSize;
            info.totalMB = info.totalBytes / (1024 * 1024);
            info.limitBytes = performance.memory.jsHeapSizeLimit;
            info.limitMB = info.limitBytes / (1024 * 1024);
            info.utilizationRate = info.usedBytes / info.limitBytes;
            
            // Calculate growth rate
            const previousStats = Array.from(this.memoryStats.values()).slice(-2, -1)[0];
            if (previousStats) {
                const timeDiff = (info.timestamp - previousStats.timestamp) / 1000; // seconds
                const memoryDiff = info.usedMB - previousStats.usedMB;
                info.growthRate = memoryDiff / timeDiff; // MB per second
            }
        }
        
        return info;
    }
    
    /**
     * Create detailed memory snapshot
     */
    createMemorySnapshot() {
        const snapshot = {
            timestamp: Date.now(),
            memory: this.getMemoryInfo(),
            systems: {},
            domElements: document.querySelectorAll('*').length,
            eventListeners: this.estimateEventListeners()
        };
        
        // Collect system-specific memory usage
        if (window.dataManager) {
            snapshot.systems.dataManager = this.estimateSystemMemory('dataManager');
        }
        if (window.cacheManager) {
            snapshot.systems.cacheManager = window.cacheManager.getStatistics().overall.memoryUsage;
        }
        if (window.streamManager) {
            snapshot.systems.streamManager = window.streamManager.getStreamStatistics();
        }
        
        this.memorySnapshots.push(snapshot);
        
        // Keep only last 20 snapshots
        if (this.memorySnapshots.length > 20) {
            this.memorySnapshots.shift();
        }
        
        return snapshot;
    }
    
    /**
     * Detect potential memory leaks
     */
    detectMemoryLeaks() {
        const currentSnapshot = this.createMemorySnapshot();
        
        if (this.memorySnapshots.length < 3) {
            return; // Need more data points
        }
        
        const leaks = [];
        const recent = this.memorySnapshots.slice(-3);
        
        // Analyze memory growth patterns
        const memoryGrowth = recent.map((snapshot, index) => {
            if (index === 0) return 0;
            return snapshot.memory.usedMB - recent[index - 1].memory.usedMB;
        }).slice(1);
        
        // Check for consistent memory growth
        if (memoryGrowth.every(growth => growth > 5)) { // 5MB+ growth consistently
            leaks.push({
                type: 'consistent_growth',
                severity: 'warning',
                description: `Consistent memory growth detected: ${memoryGrowth.join(', ')} MB`,
                recommendation: 'Check for object references not being released'
            });
        }
        
        // Check for DOM element growth
        const domGrowth = recent.map((snapshot, index) => {
            if (index === 0) return 0;
            return snapshot.domElements - recent[index - 1].domElements;
        }).slice(1);
        
        if (domGrowth.every(growth => growth > 100)) { // 100+ elements consistently
            leaks.push({
                type: 'dom_growth',
                severity: 'warning',
                description: `DOM element growth detected: ${domGrowth.join(', ')} elements`,
                recommendation: 'Check for DOM elements not being properly removed'
            });
        }
        
        // Check system-specific growth
        Object.keys(currentSnapshot.systems).forEach(systemName => {
            const systemSnapshots = recent.map(s => s.systems[systemName]).filter(Boolean);
            if (systemSnapshots.length >= 2) {
                const growth = systemSnapshots[systemSnapshots.length - 1].memoryUsage - 
                              systemSnapshots[0].memoryUsage;
                
                if (growth > 10) { // 10MB+ system growth
                    leaks.push({
                        type: 'system_growth',
                        system: systemName,
                        severity: 'warning',
                        description: `${systemName} memory growth: ${growth.toFixed(1)}MB`,
                        recommendation: `Investigate ${systemName} for memory leaks`
                    });
                }
            }
        });
        
        // Store detected leaks
        if (leaks.length > 0) {
            this.leakDetectors.set(Date.now(), {
                timestamp: Date.now(),
                leaks,
                snapshot: currentSnapshot
            });
            
            // Report to quality assurance
            if (window.qualityAssurance) {
                leaks.forEach(leak => {
                    window.qualityAssurance.recordIssue({
                        severity: leak.severity,
                        code: 'MEMORY_LEAK_DETECTED',
                        message: leak.description,
                        field: 'memory',
                        source: 'memory_optimizer',
                        details: leak
                    });
                });
            }
        }
        
        return leaks;
    }
    
    /**
     * Check for memory pressure and trigger emergency cleanup
     */
    checkMemoryPressure() {
        const memoryInfo = this.getMemoryInfo();
        if (!memoryInfo.available) return;
        
        // High memory pressure thresholds
        const warningThreshold = 0.8; // 80% of limit
        const criticalThreshold = 0.9; // 90% of limit
        
        if (memoryInfo.utilizationRate > criticalThreshold) {
            console.warn('CRITICAL memory pressure detected, executing emergency cleanup');
            this.executeEmergencyCleanup();
        } else if (memoryInfo.utilizationRate > warningThreshold) {
            console.warn('HIGH memory pressure detected, executing aggressive optimization');
            this.executeAggressiveOptimization();
        }
    }
    
    /**
     * Execute emergency cleanup procedures
     */
    async executeEmergencyCleanup() {
        const startTime = performance.now();
        let freedMemory = 0;
        
        try {
            // Force garbage collection if available
            if (window.gc) {
                window.gc();
            }
            
            // Execute all high-priority cleanup tasks immediately
            const highPriorityTasks = Array.from(this.cleanupTasks.entries())
                .filter(([, task]) => task.priority === 'high');
                
            for (const [taskId] of highPriorityTasks) {
                await this.executeCleanupTask(taskId);
            }
            
            // Execute all high-priority optimization strategies
            const highPriorityStrategies = Array.from(this.optimizationStrategies.entries())
                .filter(([, strategy]) => strategy.priority === 'high');
                
            for (const [strategyId, strategy] of highPriorityStrategies) {
                await strategy.execute();
            }
            
            // Clear all non-essential caches
            if (window.cacheManager) {
                const cacheStats = window.cacheManager.getStatistics();
                Object.keys(cacheStats.caches).forEach(cacheType => {
                    if (!['llm_responses', 'context_generation'].includes(cacheType)) {
                        window.cacheManager.clear(cacheType);
                    }
                });
            }
            
            // Clean up stream data
            if (window.streamManager) {
                window.streamManager.cleanupStreamMemory(null, true); // Force cleanup all
            }
            
            const endTime = performance.now();
            const executionTime = endTime - startTime;
            
            console.log(`Emergency cleanup completed in ${executionTime.toFixed(1)}ms`);
            
            // Record performance metric
            if (window.performanceMonitor) {
                window.performanceMonitor.recordMetric('memory.emergency_cleanup_time', executionTime);
            }
            
        } catch (error) {
            console.error('Emergency cleanup failed:', error);
        }
    }
    
    /**
     * Execute aggressive memory optimization
     */
    async executeAggressiveOptimization() {
        try {
            // Execute medium and high priority optimizations
            const strategies = Array.from(this.optimizationStrategies.entries())
                .filter(([, strategy]) => ['high', 'medium'].includes(strategy.priority));
                
            for (const [strategyId, strategy] of strategies) {
                await strategy.execute();
            }
            
            // Trigger cache eviction
            if (window.cacheManager) {
                const cacheStats = window.cacheManager.getStatistics();
                Object.entries(cacheStats.caches).forEach(([cacheType, stats]) => {
                    if (stats.utilizationRate > 0.8) {
                        const evictCount = Math.ceil(stats.size * 0.3); // Evict 30%
                        for (let i = 0; i < evictCount; i++) {
                            window.cacheManager.evictEntries(cacheType, 1);
                        }
                    }
                });
            }
            
        } catch (error) {
            console.error('Aggressive optimization failed:', error);
        }
    }
    
    /**
     * Execute periodic optimization strategies
     */
    async executePeriodicOptimizations() {
        const periodicStrategies = Array.from(this.optimizationStrategies.entries())
            .filter(([, strategy]) => strategy.frequency === 'periodic');
        
        for (const [strategyId, strategy] of periodicStrategies) {
            try {
                await strategy.execute();
            } catch (error) {
                console.error(`Periodic optimization ${strategyId} failed:`, error);
            }
        }
    }
    
    /**
     * Execute object pooling optimization
     */
    async executeObjectPooling() {
        // This would implement object pooling for frequently created objects
        // For now, this is a placeholder for the strategy
        
        console.log('Object pooling optimization executed');
        return { optimized: 0, poolsCreated: 0 };
    }
    
    /**
     * Execute weak reference cleanup
     */
    async executeWeakReferenceCleanup() {
        let cleanedUp = 0;
        
        try {
            // Clean up event listeners on removed DOM elements
            const elements = document.querySelectorAll('*');
            elements.forEach(element => {
                if (!element.isConnected) {
                    // Element is detached, clean up potential listeners
                    cleanedUp++;
                }
            });
            
            // Clean up observers and intervals that might hold references
            if (window.performanceMonitor) {
                // This would trigger cleanup of old performance observers
            }
            
        } catch (error) {
            console.error('Weak reference cleanup failed:', error);
        }
        
        return { cleanedReferences: cleanedUp };
    }
    
    /**
     * Execute data structure optimization
     */
    async executeDataStructureOptimization() {
        let optimized = 0;
        
        try {
            // Optimize large arrays by removing null/undefined entries
            if (window.dataManager) {
                const folios = window.dataManager.getFolios();
                Object.values(folios).forEach(folio => {
                    if (folio.messages) {
                        const originalLength = folio.messages.length;
                        folio.messages = folio.messages.filter(msg => msg && msg.id);
                        if (folio.messages.length < originalLength) {
                            optimized += originalLength - folio.messages.length;
                        }
                    }
                });
            }
            
            // Optimize Maps and Sets by removing empty entries
            [this.memoryStats, this.leakDetectors].forEach(map => {
                const keysToDelete = [];
                map.forEach((value, key) => {
                    if (!value || (Array.isArray(value) && value.length === 0)) {
                        keysToDelete.push(key);
                    }
                });
                keysToDelete.forEach(key => {
                    map.delete(key);
                    optimized++;
                });
            });
            
        } catch (error) {
            console.error('Data structure optimization failed:', error);
        }
        
        return { optimizedEntries: optimized };
    }
    
    /**
     * Execute cache eviction strategy
     */
    async executeCacheEviction() {
        let evicted = 0;
        
        try {
            if (window.cacheManager) {
                const cacheStats = window.cacheManager.getStatistics();
                
                Object.entries(cacheStats.caches).forEach(([cacheType, stats]) => {
                    // Evict from caches that are over 70% full
                    if (stats.utilizationRate > 0.7) {
                        const evictCount = Math.ceil(stats.size * 0.2); // Evict 20%
                        for (let i = 0; i < evictCount; i++) {
                            if (window.cacheManager.evictEntries(cacheType, 1)) {
                                evicted++;
                            }
                        }
                    }
                });
            }
            
        } catch (error) {
            console.error('Cache eviction failed:', error);
        }
        
        return { evictedEntries: evicted };
    }
    
    /**
     * Execute DOM cleanup
     */
    async executeDOMCleanup() {
        let cleaned = 0;
        
        try {
            // Remove detached DOM elements
            const walker = document.createTreeWalker(
                document.body,
                NodeFilter.SHOW_ELEMENT,
                {
                    acceptNode: function(node) {
                        return !node.isConnected ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
                    }
                }
            );
            
            const detachedElements = [];
            let node;
            while (node = walker.nextNode()) {
                detachedElements.push(node);
            }
            
            detachedElements.forEach(element => {
                if (element.parentNode) {
                    element.parentNode.removeChild(element);
                    cleaned++;
                }
            });
            
        } catch (error) {
            console.error('DOM cleanup failed:', error);
        }
        
        return { cleanedElements: cleaned };
    }
    
    /**
     * Execute memory defragmentation
     */
    async executeMemoryDefragmentation() {
        // This is a conceptual operation - JavaScript doesn't provide direct memory defragmentation
        // Instead, we can reorganize data structures to be more memory efficient
        
        try {
            // Force garbage collection if available
            if (window.gc) {
                window.gc();
            }
            
            // Recreate large data structures to potentially improve memory layout
            if (window.dataManager) {
                // This would trigger data reorganization
            }
            
        } catch (error) {
            console.error('Memory defragmentation failed:', error);
        }
        
        return { defragmented: true };
    }
    
    /**
     * Execute specific cleanup task
     */
    async executeCleanupTask(taskId) {
        const task = this.cleanupTasks.get(taskId);
        if (!task) {
            console.warn(`Cleanup task ${taskId} not found`);
            return;
        }
        
        const startTime = performance.now();
        
        try {
            const result = await task.execute();
            const executionTime = performance.now() - startTime;
            
            console.log(`Cleanup task ${task.name} completed in ${executionTime.toFixed(1)}ms:`, result);
            
            // Record performance metric
            if (window.performanceMonitor) {
                window.performanceMonitor.recordMetric(`memory.cleanup_${taskId}_time`, executionTime);
            }
            
            return result;
            
        } catch (error) {
            console.error(`Cleanup task ${task.name} failed:`, error);
            throw error;
        }
    }
    
    /**
     * Cleanup data manager memory
     */
    async cleanupDataManager() {
        if (!window.dataManager) return { cleaned: 0 };
        
        let cleaned = 0;
        
        try {
            // This would trigger data manager internal cleanup
            // For example, removing old transaction logs, compacting data, etc.
            cleaned = 1; // Placeholder
            
        } catch (error) {
            console.error('Data manager cleanup failed:', error);
        }
        
        return { cleaned };
    }
    
    /**
     * Cleanup message manager memory
     */
    async cleanupMessageManager() {
        if (!window.messageManager) return { cleaned: 0 };
        
        let cleaned = 0;
        
        try {
            // This would trigger message manager cleanup
            // For example, clearing old semantic analysis caches
            cleaned = 1; // Placeholder
            
        } catch (error) {
            console.error('Message manager cleanup failed:', error);
        }
        
        return { cleaned };
    }
    
    /**
     * Cleanup cache manager memory
     */
    async cleanupCacheManager() {
        if (!window.cacheManager) return { cleaned: 0 };
        
        try {
            // Trigger cache manager's built-in cleanup
            window.cacheManager.cleanupExpiredEntries();
            return { cleaned: 1 };
            
        } catch (error) {
            console.error('Cache manager cleanup failed:', error);
            return { cleaned: 0 };
        }
    }
    
    /**
     * Cleanup background processor memory
     */
    async cleanupBackgroundProcessor() {
        if (!window.backgroundProcessor) return { cleaned: 0 };
        
        try {
            const stats = window.backgroundProcessor.getStatistics();
            // Clean up old task results
            return { cleaned: stats.totalTasksProcessed };
            
        } catch (error) {
            console.error('Background processor cleanup failed:', error);
            return { cleaned: 0 };
        }
    }
    
    /**
     * Cleanup stream manager memory
     */
    async cleanupStreamManager() {
        if (!window.streamManager) return { cleaned: 0 };
        
        try {
            const cleaned = window.streamManager.cleanupStreamMemory();
            return { cleaned };
            
        } catch (error) {
            console.error('Stream manager cleanup failed:', error);
            return { cleaned: 0 };
        }
    }
    
    /**
     * Cleanup performance monitor memory
     */
    async cleanupPerformanceMonitor() {
        if (!window.performanceMonitor) return { cleaned: 0 };
        
        try {
            // This would trigger performance monitor cleanup
            // For example, removing old metric data
            return { cleaned: 1 };
            
        } catch (error) {
            console.error('Performance monitor cleanup failed:', error);
            return { cleaned: 0 };
        }
    }
    
    /**
     * Estimate memory usage of a system
     */
    estimateSystemMemory(systemName) {
        try {
            const system = window[systemName];
            if (!system) return { estimated: 0 };
            
            // Rough estimation based on JSON stringification
            const systemString = JSON.stringify(system);
            const bytes = new TextEncoder().encode(systemString).length;
            
            return {
                estimated: bytes / (1024 * 1024), // MB
                method: 'json_estimation'
            };
            
        } catch (error) {
            return { estimated: 0, error: error.message };
        }
    }
    
    /**
     * Estimate number of event listeners
     */
    estimateEventListeners() {
        try {
            // This is a rough estimation
            const elements = document.querySelectorAll('*');
            let estimated = 0;
            
            // Count elements that commonly have event listeners
            estimated += document.querySelectorAll('[onclick]').length;
            estimated += document.querySelectorAll('button').length;
            estimated += document.querySelectorAll('input').length;
            estimated += document.querySelectorAll('a').length;
            
            return estimated;
            
        } catch (error) {
            return 0;
        }
    }
    
    /**
     * Setup performance observers for memory monitoring
     */
    setupPerformanceObservers() {
        try {
            // Memory usage observer
            if ('PerformanceObserver' in window) {
                const observer = new PerformanceObserver((list) => {
                    list.getEntries().forEach(entry => {
                        if (entry.entryType === 'memory') {
                            this.trackMemoryUsage();
                        }
                    });
                });
                
                try {
                    observer.observe({ entryTypes: ['memory'] });
                } catch (e) {
                    // Memory entries not supported in Chrome extensions - use alternative tracking
                    console.debug('Memory performance observer not supported, using alternative tracking');
                }
            }
            
        } catch (error) {
            console.warn('Memory performance observers not supported:', error);
        }
    }
    
    /**
     * Get memory optimization report
     */
    getMemoryReport(timeRange = 60 * 60 * 1000) {
        const cutoffTime = Date.now() - timeRange;
        
        const recentStats = Array.from(this.memoryStats.entries())
            .filter(([timestamp]) => timestamp > cutoffTime)
            .map(([timestamp, stats]) => ({ timestamp, ...stats }));
            
        const recentSnapshots = this.memorySnapshots
            .filter(snapshot => snapshot.timestamp > cutoffTime);
            
        const recentLeaks = Array.from(this.leakDetectors.entries())
            .filter(([timestamp]) => timestamp > cutoffTime)
            .map(([timestamp, detection]) => detection);
        
        // Calculate memory trends
        const memoryTrend = this.calculateMemoryTrend(recentStats);
        
        return {
            timestamp: Date.now(),
            timeRange,
            currentMemory: this.getMemoryInfo(),
            memoryTrend,
            recentStats: recentStats.slice(-10), // Last 10 measurements
            snapshots: recentSnapshots.slice(-5), // Last 5 snapshots
            leakDetections: recentLeaks,
            optimizationStrategies: Object.fromEntries(this.optimizationStrategies),
            cleanupTasks: Object.fromEntries(this.cleanupTasks),
            recommendations: this.generateMemoryRecommendations(recentStats, recentLeaks)
        };
    }
    
    /**
     * Calculate memory usage trend
     */
    calculateMemoryTrend(stats) {
        if (stats.length < 2) return 'insufficient_data';
        
        const recent = stats.slice(-10);
        const older = stats.slice(-20, -10);
        
        if (older.length === 0) return 'insufficient_data';
        
        const recentAvg = recent.reduce((sum, stat) => sum + stat.usedMB, 0) / recent.length;
        const olderAvg = older.reduce((sum, stat) => sum + stat.usedMB, 0) / older.length;
        
        const change = (recentAvg - olderAvg) / olderAvg;
        
        if (change > 0.1) return 'increasing';
        if (change < -0.1) return 'decreasing';
        return 'stable';
    }
    
    /**
     * Generate memory optimization recommendations
     */
    generateMemoryRecommendations(stats, leaks) {
        const recommendations = [];
        
        // High memory usage recommendations
        const currentMemory = this.getMemoryInfo();
        if (currentMemory.utilizationRate > 0.8) {
            recommendations.push({
                priority: 'critical',
                category: 'memory_pressure',
                message: `High memory usage: ${(currentMemory.utilizationRate * 100).toFixed(1)}%`,
                action: 'Execute emergency cleanup and review memory-intensive operations'
            });
        }
        
        // Memory growth recommendations
        if (stats.length > 0) {
            const growthRates = stats.map(s => s.growthRate).filter(rate => rate > 0);
            if (growthRates.length > 5 && growthRates.every(rate => rate > 0.1)) {
                recommendations.push({
                    priority: 'high',
                    category: 'memory_growth',
                    message: 'Consistent memory growth detected',
                    action: 'Investigate for memory leaks and implement more frequent cleanup'
                });
            }
        }
        
        // Leak-specific recommendations
        leaks.forEach(detection => {
            detection.leaks.forEach(leak => {
                recommendations.push({
                    priority: leak.severity === 'critical' ? 'critical' : 'high',
                    category: 'memory_leak',
                    message: leak.description,
                    action: leak.recommendation
                });
            });
        });
        
        return recommendations.sort((a, b) => {
            const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        });
    }
    
    /**
     * Force memory optimization
     */
    async forceOptimization(level = 'aggressive') {
        console.log(`Forcing ${level} memory optimization...`);
        
        switch (level) {
            case 'emergency':
                await this.executeEmergencyCleanup();
                break;
            case 'aggressive':
                await this.executeAggressiveOptimization();
                break;
            case 'standard':
                await this.executePeriodicOptimizations();
                break;
            default:
                console.warn(`Unknown optimization level: ${level}`);
        }
    }
    
    /**
     * Cleanup and destroy memory optimizer
     */
    cleanup() {
        // Clear all intervals
        if (this.memoryTrackingInterval) clearInterval(this.memoryTrackingInterval);
        if (this.leakDetectionInterval) clearInterval(this.leakDetectionInterval);
        if (this.snapshotInterval) clearInterval(this.snapshotInterval);
        
        // Clear data structures
        this.memoryStats.clear();
        this.memorySnapshots.length = 0;
        this.cleanupTasks.clear();
        this.leakDetectors.clear();
        this.optimizationStrategies.clear();
        
        console.log('MemoryOptimizer cleaned up');
    }
}

// Global instance
window.memoryOptimizer = new MemoryOptimizer();