// Branestawm - Performance Tracker
// Advanced performance monitoring and metrics collection

class PerformanceTracker {
    constructor() {
        this.metrics = new Map();
        this.thresholds = {
            taskExtraction: 100,    // ms
            taskCreation: 50,       // ms
            uiRender: 16,          // ms (60fps target)
            apiCall: 1000,         // ms
            dataStorage: 100       // ms
        };
        this.isEnabled = this.shouldEnableTracking();
        this.listeners = new Map();
        this.memoryBaseline = null;
        
        if (this.isEnabled) {
            this.initializeTracking();
        }
    }
    
    /**
     * Check if performance tracking should be enabled
     */
    shouldEnableTracking() {
        try {
            // Enable in development or when explicitly requested
            const isDevelopment = typeof chrome !== 'undefined' && 
                                chrome.runtime && 
                                chrome.runtime.getURL('').includes('unpacked');
            
            const explicitEnable = localStorage.getItem('branestawm_perf_tracking') === 'true';
            
            return isDevelopment || explicitEnable;
        } catch (error) {
            return false;
        }
    }
    
    /**
     * Initialize performance tracking
     */
    initializeTracking() {
        logger.debug('Performance tracking initialized');
        
        // Set memory baseline
        this.updateMemoryBaseline();
        
        // Set up periodic metrics collection
        this.startPeriodicCollection();
        
        // Monitor critical browser APIs
        this.monitorBrowserAPIs();
        
        // Track memory usage
        this.startMemoryMonitoring();
    }
    
    /**
     * Start timing an operation
     */
    start(operationName) {
        if (!this.isEnabled) return null;
        
        const timerId = `${operationName}_${Date.now()}_${Math.random()}`;
        
        this.metrics.set(timerId, {
            operation: operationName,
            startTime: performance.now(),
            startMemory: this.getCurrentMemoryUsage(),
            metadata: {}
        });
        
        return timerId;
    }
    
    /**
     * End timing an operation and record metrics
     */
    end(timerId, metadata = {}) {
        if (!this.isEnabled || !timerId || !this.metrics.has(timerId)) return null;
        
        const endTime = performance.now();
        const endMemory = this.getCurrentMemoryUsage();
        const metric = this.metrics.get(timerId);
        
        const result = {
            operation: metric.operation,
            duration: endTime - metric.startTime,
            memoryDelta: endMemory - metric.startMemory,
            timestamp: new Date().toISOString(),
            metadata: { ...metric.metadata, ...metadata }
        };
        
        // Store the result
        this.storeMetric(result);
        
        // Check thresholds and warn if exceeded
        this.checkThresholds(result);
        
        // Clean up
        this.metrics.delete(timerId);
        
        return result;
    }
    
    /**
     * Add metadata to an ongoing operation
     */
    addMetadata(timerId, metadata) {
        if (!this.isEnabled || !timerId || !this.metrics.has(timerId)) return;
        
        const metric = this.metrics.get(timerId);
        metric.metadata = { ...metric.metadata, ...metadata };
    }
    
    /**
     * Time a function execution
     */
    async timeFunction(operationName, fn, ...args) {
        if (!this.isEnabled) {
            return typeof fn === 'function' ? fn(...args) : fn;
        }
        
        const timerId = this.start(operationName);
        
        try {
            const result = typeof fn === 'function' ? await fn(...args) : fn;
            this.end(timerId, { success: true });
            return result;
        } catch (error) {
            this.end(timerId, { success: false, error: error.message });
            throw error;
        }
    }
    
    /**
     * Store performance metric
     */
    storeMetric(result) {
        try {
            // Get existing metrics
            const stored = JSON.parse(localStorage.getItem('branestawm_perf_metrics') || '[]');
            
            // Add new metric
            stored.push(result);
            
            // Keep only last 100 metrics per operation
            const grouped = stored.reduce((acc, metric) => {
                if (!acc[metric.operation]) acc[metric.operation] = [];
                acc[metric.operation].push(metric);
                return acc;
            }, {});
            
            // Trim each operation to last 100 entries
            Object.keys(grouped).forEach(operation => {
                if (grouped[operation].length > 100) {
                    grouped[operation] = grouped[operation].slice(-100);
                }
            });
            
            // Flatten back to array
            const trimmed = Object.values(grouped).flat();
            
            localStorage.setItem('branestawm_perf_metrics', JSON.stringify(trimmed));
            
        } catch (error) {
            logger.warn('Failed to store performance metric:', error);
        }
    }
    
    /**
     * Check performance thresholds
     */
    checkThresholds(result) {
        const threshold = this.thresholds[result.operation];
        
        if (threshold && result.duration > threshold) {
            logger.warn(`Performance threshold exceeded for ${result.operation}:`, {
                duration: `${result.duration.toFixed(2)}ms`,
                threshold: `${threshold}ms`,
                metadata: result.metadata
            });
            
            // Emit warning event
            this.emit('thresholdExceeded', {
                operation: result.operation,
                duration: result.duration,
                threshold: threshold,
                metadata: result.metadata
            });
        }
    }
    
    /**
     * Get current memory usage
     */
    getCurrentMemoryUsage() {
        try {
            if (performance.memory) {
                return performance.memory.usedJSHeapSize;
            }
            return 0;
        } catch (error) {
            return 0;
        }
    }
    
    /**
     * Update memory baseline
     */
    updateMemoryBaseline() {
        this.memoryBaseline = this.getCurrentMemoryUsage();
    }
    
    /**
     * Get performance summary
     */
    getSummary() {
        try {
            const metrics = JSON.parse(localStorage.getItem('branestawm_perf_metrics') || '[]');
            
            if (metrics.length === 0) {
                return { message: 'No performance data available' };
            }
            
            // Group by operation
            const grouped = metrics.reduce((acc, metric) => {
                if (!acc[metric.operation]) {
                    acc[metric.operation] = {
                        count: 0,
                        totalDuration: 0,
                        minDuration: Infinity,
                        maxDuration: 0,
                        avgMemoryDelta: 0,
                        errorRate: 0,
                        recent: []
                    };
                }
                
                const group = acc[metric.operation];
                group.count++;
                group.totalDuration += metric.duration;
                group.minDuration = Math.min(group.minDuration, metric.duration);
                group.maxDuration = Math.max(group.maxDuration, metric.duration);
                group.avgMemoryDelta += metric.memoryDelta || 0;
                
                if (metric.metadata && metric.metadata.success === false) {
                    group.errorRate++;
                }
                
                // Keep last 10 for recent analysis
                group.recent.push(metric);
                if (group.recent.length > 10) {
                    group.recent.shift();
                }
                
                return acc;
            }, {});
            
            // Calculate averages and rates
            Object.keys(grouped).forEach(operation => {
                const group = grouped[operation];
                group.avgDuration = group.totalDuration / group.count;
                group.avgMemoryDelta = group.avgMemoryDelta / group.count;
                group.errorRate = (group.errorRate / group.count) * 100;
                
                // Calculate recent trend
                if (group.recent.length >= 5) {
                    const first5 = group.recent.slice(0, 5);
                    const last5 = group.recent.slice(-5);
                    const firstAvg = first5.reduce((sum, m) => sum + m.duration, 0) / first5.length;
                    const lastAvg = last5.reduce((sum, m) => sum + m.duration, 0) / last5.length;
                    group.trend = lastAvg > firstAvg ? 'slower' : 'faster';
                    group.trendPercent = Math.abs(((lastAvg - firstAvg) / firstAvg) * 100);
                }
                
                delete group.recent; // Clean up for summary
            });
            
            return {
                operations: grouped,
                totalMetrics: metrics.length,
                memoryBaseline: this.memoryBaseline,
                currentMemory: this.getCurrentMemoryUsage(),
                trackingEnabled: this.isEnabled
            };
            
        } catch (error) {
            logger.error('Failed to generate performance summary:', error);
            return { error: 'Failed to generate summary' };
        }
    }
    
    /**
     * Clear all metrics
     */
    clearMetrics() {
        try {
            localStorage.removeItem('branestawm_perf_metrics');
            logger.info('Performance metrics cleared');
        } catch (error) {
            logger.error('Failed to clear performance metrics:', error);
        }
    }
    
    /**
     * Monitor critical browser APIs
     */
    monitorBrowserAPIs() {
        if (typeof chrome === 'undefined') return;
        
        // Monitor storage operations
        if (chrome.storage && chrome.storage.local) {
            const originalSet = chrome.storage.local.set;
            chrome.storage.local.set = (...args) => {
                const timerId = this.start('chromeStorage');
                const callback = args[args.length - 1];
                
                if (typeof callback === 'function') {
                    args[args.length - 1] = (...cbArgs) => {
                        this.end(timerId);
                        callback(...cbArgs);
                    };
                }
                
                return originalSet.apply(chrome.storage.local, args);
            };
        }
        
        // Monitor tab operations
        if (chrome.tabs) {
            const originalCreate = chrome.tabs.create;
            chrome.tabs.create = (...args) => {
                const timerId = this.start('tabCreate');
                const callback = args[args.length - 1];
                
                if (typeof callback === 'function') {
                    args[args.length - 1] = (...cbArgs) => {
                        this.end(timerId);
                        callback(...cbArgs);
                    };
                }
                
                return originalCreate.apply(chrome.tabs, args);
            };
        }
    }
    
    /**
     * Start periodic metrics collection
     */
    startPeriodicCollection() {
        setInterval(() => {
            const memoryUsage = this.getCurrentMemoryUsage();
            const memoryDelta = memoryUsage - (this.memoryBaseline || 0);
            
            // Store system metrics
            this.storeMetric({
                operation: 'memoryUsage',
                duration: 0,
                memoryDelta: memoryDelta,
                timestamp: new Date().toISOString(),
                metadata: {
                    totalMemory: memoryUsage,
                    baseline: this.memoryBaseline,
                    type: 'system'
                }
            });
            
        }, 60000); // Every minute
    }
    
    /**
     * Start memory monitoring
     */
    startMemoryMonitoring() {
        // Monitor for memory leaks
        let previousMemory = this.getCurrentMemoryUsage();
        
        setInterval(() => {
            const currentMemory = this.getCurrentMemoryUsage();
            const increase = currentMemory - previousMemory;
            
            // Warn if memory increased significantly
            if (increase > 10 * 1024 * 1024) { // 10MB increase
                logger.warn('Significant memory increase detected:', {
                    increase: `${(increase / 1024 / 1024).toFixed(2)}MB`,
                    current: `${(currentMemory / 1024 / 1024).toFixed(2)}MB`
                });
            }
            
            previousMemory = currentMemory;
        }, 30000); // Every 30 seconds
    }
    
    /**
     * Event system for performance alerts
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }
    
    /**
     * Emit performance events
     */
    emit(event, data) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    logger.error('Performance event callback error:', error);
                }
            });
        }
    }
    
    /**
     * Export performance data for analysis
     */
    exportData() {
        const summary = this.getSummary();
        const rawMetrics = JSON.parse(localStorage.getItem('branestawm_perf_metrics') || '[]');
        
        return {
            summary,
            rawMetrics,
            exportedAt: new Date().toISOString(),
            browser: navigator.userAgent,
            memory: performance.memory ? {
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit
            } : null
        };
    }
}

// Create global instance
const performanceTracker = new PerformanceTracker();

// Convenience functions for easy usage
window.perf = {
    start: (op) => performanceTracker.start(op),
    end: (id, meta) => performanceTracker.end(id, meta),
    time: (op, fn, ...args) => performanceTracker.timeFunction(op, fn, ...args),
    summary: () => performanceTracker.getSummary(),
    clear: () => performanceTracker.clearMetrics(),
    export: () => performanceTracker.exportData()
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PerformanceTracker;
} else {
    window.PerformanceTracker = PerformanceTracker;
    window.performanceTracker = performanceTracker;
}