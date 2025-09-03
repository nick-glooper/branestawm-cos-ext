// Branestawm - Performance Monitor
// Real-time performance monitoring and metrics collection system

class PerformanceMonitor {
    constructor() {
        if (PerformanceMonitor.instance) {
            return PerformanceMonitor.instance;
        }
        
        this.metrics = new Map();
        this.timers = new Map();
        this.alerts = [];
        this.thresholds = new Map();
        this.observers = [];
        
        this.initializeMetrics();
        this.setupPerformanceObservers();
        this.setupThresholds();
        this.startMonitoring();
        
        PerformanceMonitor.instance = this;
        console.log('PerformanceMonitor initialized');
    }
    
    /**
     * Initialize metric collection
     */
    initializeMetrics() {
        this.metricCategories = {
            // LLM Performance Metrics
            llm: {
                responseTime: { values: [], unit: 'ms', target: 3000 },
                tokenUsage: { values: [], unit: 'tokens', target: 4000 },
                requestCount: { values: [], unit: 'requests', target: null },
                errorRate: { values: [], unit: '%', target: 5 },
                contextOptimization: { values: [], unit: '%', target: 80 }
            },
            
            // Data Processing Metrics
            data: {
                loadTime: { values: [], unit: 'ms', target: 1000 },
                saveTime: { values: [], unit: 'ms', target: 500 },
                migrationTime: { values: [], unit: 'ms', target: 2000 },
                compressionRatio: { values: [], unit: '%', target: 70 },
                indexingTime: { values: [], unit: 'ms', target: 1500 }
            },
            
            // Background Processing Metrics
            background: {
                taskProcessingTime: { values: [], unit: 'ms', target: 5000 },
                queueLength: { values: [], unit: 'items', target: 20 },
                workerUtilization: { values: [], unit: '%', target: 80 },
                taskSuccessRate: { values: [], unit: '%', target: 95 },
                taskThroughput: { values: [], unit: 'tasks/min', target: 60 }
            },
            
            // Cache Performance Metrics
            cache: {
                hitRate: { values: [], unit: '%', target: 85 },
                evictionRate: { values: [], unit: 'evictions/hour', target: 50 },
                memoryUsage: { values: [], unit: 'MB', target: 50 },
                compressionEfficiency: { values: [], unit: '%', target: 60 }
            },
            
            // UI Performance Metrics
            ui: {
                renderTime: { values: [], unit: 'ms', target: 100 },
                interactionLatency: { values: [], unit: 'ms', target: 200 },
                memoryLeaks: { values: [], unit: 'MB', target: 0 },
                scrollPerformance: { values: [], unit: 'fps', target: 60 }
            },
            
            // System Resource Metrics
            system: {
                memoryUsage: { values: [], unit: 'MB', target: 100 },
                cpuUsage: { values: [], unit: '%', target: 70 },
                storageUsage: { values: [], unit: 'MB', target: 500 },
                networkLatency: { values: [], unit: 'ms', target: 1000 }
            }
        };
        
        // Initialize metrics in the main metrics map
        Object.keys(this.metricCategories).forEach(category => {
            Object.keys(this.metricCategories[category]).forEach(metric => {
                const key = `${category}.${metric}`;
                this.metrics.set(key, {
                    category,
                    name: metric,
                    values: [],
                    stats: { min: null, max: null, avg: null, recent: null },
                    timestamps: [],
                    config: this.metricCategories[category][metric]
                });
            });
        });
    }
    
    /**
     * Setup performance observers for browser APIs
     */
    setupPerformanceObservers() {
        try {
            // Performance Observer for navigation and resource timing
            if ('PerformanceObserver' in window) {
                // Navigation timing
                const navObserver = new PerformanceObserver((list) => {
                    list.getEntries().forEach(entry => {
                        this.recordMetric('ui.renderTime', entry.loadEventEnd - entry.loadEventStart);
                    });
                });
                navObserver.observe({ entryTypes: ['navigation'] });
                this.observers.push(navObserver);
                
                // Resource timing
                const resourceObserver = new PerformanceObserver((list) => {
                    list.getEntries().forEach(entry => {
                        if (entry.name.includes('api') || entry.name.includes('llm')) {
                            this.recordMetric('llm.responseTime', entry.responseEnd - entry.responseStart);
                        }
                    });
                });
                resourceObserver.observe({ entryTypes: ['resource'] });
                this.observers.push(resourceObserver);
                
                // Memory usage observer (if available)
                if ('memory' in performance) {
                    const memoryObserver = new PerformanceObserver((list) => {
                        list.getEntries().forEach(entry => {
                            if (entry.name === 'memory') {
                                const memoryMB = entry.detail.usedJSHeapSize / (1024 * 1024);
                                this.recordMetric('system.memoryUsage', memoryMB);
                            }
                        });
                    });
                    memoryObserver.observe({ entryTypes: ['measure'] });
                    this.observers.push(memoryObserver);
                }
            }
        } catch (error) {
            console.warn('Performance observers not fully supported:', error);
        }
    }
    
    /**
     * Setup performance thresholds and alerts
     */
    setupThresholds() {
        // Define alert thresholds (red line values)
        const alertThresholds = {
            'llm.responseTime': 5000, // 5 seconds
            'llm.errorRate': 10, // 10%
            'data.loadTime': 3000, // 3 seconds
            'background.queueLength': 50, // 50 items
            'cache.hitRate': 50, // Below 50%
            'ui.interactionLatency': 500, // 500ms
            'system.memoryUsage': 200, // 200MB
            'system.cpuUsage': 90 // 90%
        };
        
        Object.entries(alertThresholds).forEach(([metric, threshold]) => {
            this.thresholds.set(metric, {
                warning: threshold * 0.8,
                critical: threshold,
                alertSent: false,
                lastAlert: null
            });
        });
    }
    
    /**
     * Start continuous monitoring
     */
    startMonitoring() {
        // Collect system metrics every 30 seconds
        this.systemMetricsInterval = setInterval(() => {
            this.collectSystemMetrics();
        }, 30000);
        
        // Collect application metrics every 10 seconds
        this.appMetricsInterval = setInterval(() => {
            this.collectApplicationMetrics();
        }, 10000);
        
        // Clean up old metrics every 5 minutes
        this.cleanupInterval = setInterval(() => {
            this.cleanupOldMetrics();
        }, 5 * 60 * 1000);
        
        // Check thresholds every minute
        this.thresholdInterval = setInterval(() => {
            this.checkThresholds();
        }, 60000);
    }
    
    /**
     * Record a performance metric
     */
    recordMetric(metricKey, value, timestamp = Date.now()) {
        if (!this.metrics.has(metricKey)) {
            console.warn(`Unknown metric: ${metricKey}`);
            return;
        }
        
        const metric = this.metrics.get(metricKey);
        
        // Add value and timestamp
        metric.values.push(value);
        metric.timestamps.push(timestamp);
        
        // Keep only last 1000 values to prevent memory bloat
        if (metric.values.length > 1000) {
            metric.values.shift();
            metric.timestamps.shift();
        }
        
        // Update statistics
        this.updateMetricStats(metricKey);
        
        // Cache metrics if cache manager available
        if (window.cacheManager) {
            const cacheKey = window.cacheManager.createKey('performance_metric', metricKey, timestamp);
            window.cacheManager.set('performance_metrics', cacheKey, {
                metric: metricKey,
                value,
                timestamp
            }).catch(error => {
                console.warn('Failed to cache performance metric:', error);
            });
        }
    }
    
    /**
     * Start timing an operation
     */
    startTimer(operationName) {
        const timerId = `${operationName}_${Date.now()}_${Math.random()}`;
        this.timers.set(timerId, {
            name: operationName,
            startTime: performance.now(),
            startTimestamp: Date.now()
        });
        return timerId;
    }
    
    /**
     * End timing an operation and record metric
     */
    endTimer(timerId) {
        if (!this.timers.has(timerId)) {
            console.warn(`Timer ${timerId} not found`);
            return null;
        }
        
        const timer = this.timers.get(timerId);
        const endTime = performance.now();
        const duration = endTime - timer.startTime;
        
        // Determine metric key based on operation name
        const metricKey = this.getMetricKeyFromOperation(timer.name);
        if (metricKey) {
            this.recordMetric(metricKey, duration, timer.startTimestamp);
        }
        
        this.timers.delete(timerId);
        return duration;
    }
    
    /**
     * Map operation names to metric keys
     */
    getMetricKeyFromOperation(operationName) {
        const mappings = {
            'llm_request': 'llm.responseTime',
            'data_load': 'data.loadTime',
            'data_save': 'data.saveTime',
            'data_migration': 'data.migrationTime',
            'background_task': 'background.taskProcessingTime',
            'ui_render': 'ui.renderTime',
            'search_indexing': 'data.indexingTime'
        };
        
        return mappings[operationName] || null;
    }
    
    /**
     * Update metric statistics
     */
    updateMetricStats(metricKey) {
        const metric = this.metrics.get(metricKey);
        if (!metric || metric.values.length === 0) return;
        
        const values = metric.values;
        const stats = {
            min: Math.min(...values),
            max: Math.max(...values),
            avg: values.reduce((sum, val) => sum + val, 0) / values.length,
            recent: values.slice(-10).reduce((sum, val) => sum + val, 0) / Math.min(10, values.length),
            median: this.calculateMedian(values),
            p95: this.calculatePercentile(values, 95),
            p99: this.calculatePercentile(values, 99),
            count: values.length,
            trend: this.calculateTrend(values)
        };
        
        metric.stats = stats;
    }
    
    /**
     * Calculate median value
     */
    calculateMedian(values) {
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        
        if (sorted.length % 2 === 0) {
            return (sorted[mid - 1] + sorted[mid]) / 2;
        }
        return sorted[mid];
    }
    
    /**
     * Calculate percentile
     */
    calculatePercentile(values, percentile) {
        const sorted = [...values].sort((a, b) => a - b);
        const index = Math.ceil((percentile / 100) * sorted.length) - 1;
        return sorted[Math.max(0, index)];
    }
    
    /**
     * Calculate trend direction
     */
    calculateTrend(values) {
        if (values.length < 10) return 'insufficient_data';
        
        const recent = values.slice(-10);
        const older = values.slice(-20, -10);
        
        if (older.length === 0) return 'insufficient_data';
        
        const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
        const olderAvg = older.reduce((sum, val) => sum + val, 0) / older.length;
        
        const change = (recentAvg - olderAvg) / olderAvg;
        
        if (change > 0.1) return 'increasing';
        if (change < -0.1) return 'decreasing';
        return 'stable';
    }
    
    /**
     * Collect system metrics
     */
    collectSystemMetrics() {
        try {
            // Memory usage
            if (performance.memory) {
                const memoryMB = performance.memory.usedJSHeapSize / (1024 * 1024);
                this.recordMetric('system.memoryUsage', memoryMB);
            }
            
            // Storage usage (estimate)
            if (navigator.storage && navigator.storage.estimate) {
                navigator.storage.estimate().then(estimate => {
                    const storageMB = (estimate.usage || 0) / (1024 * 1024);
                    this.recordMetric('system.storageUsage', storageMB);
                });
            }
            
            // Connection quality
            if (navigator.connection) {
                const connection = navigator.connection;
                this.recordMetric('system.networkLatency', connection.rtt || 0);
            }
            
        } catch (error) {
            console.warn('Error collecting system metrics:', error);
        }
    }
    
    /**
     * Collect application-specific metrics
     */
    collectApplicationMetrics() {
        try {
            // Cache metrics
            if (window.cacheManager) {
                const cacheStats = window.cacheManager.getStatistics();
                this.recordMetric('cache.hitRate', cacheStats.overall.overallHitRate * 100);
                this.recordMetric('cache.memoryUsage', cacheStats.overall.memoryUsage.mb);
            }
            
            // Background processor metrics
            if (window.backgroundProcessor) {
                const bgStats = window.backgroundProcessor.getStatistics();
                this.recordMetric('background.queueLength', bgStats.queueLength);
                this.recordMetric('background.workerUtilization', 
                    (bgStats.activeWorkers / bgStats.totalWorkers) * 100);
                this.recordMetric('background.taskSuccessRate', bgStats.successRate * 100);
            }
            
            // Data manager metrics
            if (window.dataManager) {
                // Estimate data load performance
                const startTime = performance.now();
                const testData = window.dataManager.getSettings();
                if (testData) {
                    const loadTime = performance.now() - startTime;
                    this.recordMetric('data.loadTime', loadTime);
                }
            }
            
        } catch (error) {
            console.warn('Error collecting application metrics:', error);
        }
    }
    
    /**
     * Check performance thresholds and trigger alerts
     */
    checkThresholds() {
        this.thresholds.forEach((threshold, metricKey) => {
            const metric = this.metrics.get(metricKey);
            if (!metric || !metric.stats.recent) return;
            
            const value = metric.stats.recent;
            const now = Date.now();
            
            // Check for critical threshold
            if (value >= threshold.critical) {
                if (!threshold.alertSent || (now - threshold.lastAlert > 5 * 60 * 1000)) {
                    this.triggerAlert('critical', metricKey, value, threshold.critical);
                    threshold.alertSent = true;
                    threshold.lastAlert = now;
                }
            } 
            // Check for warning threshold
            else if (value >= threshold.warning) {
                if (!threshold.alertSent || (now - threshold.lastAlert > 10 * 60 * 1000)) {
                    this.triggerAlert('warning', metricKey, value, threshold.warning);
                    threshold.alertSent = true;
                    threshold.lastAlert = now;
                }
            } 
            // Reset alert state if back to normal
            else if (value < threshold.warning * 0.9) {
                if (threshold.alertSent) {
                    this.triggerAlert('resolved', metricKey, value, threshold.warning);
                    threshold.alertSent = false;
                }
            }
        });
    }
    
    /**
     * Trigger performance alert
     */
    triggerAlert(level, metricKey, currentValue, threshold) {
        const alert = {
            id: `alert_${Date.now()}_${Math.random()}`,
            level,
            metric: metricKey,
            currentValue,
            threshold,
            timestamp: Date.now(),
            message: this.generateAlertMessage(level, metricKey, currentValue, threshold)
        };
        
        this.alerts.push(alert);
        
        // Keep only last 100 alerts
        if (this.alerts.length > 100) {
            this.alerts.shift();
        }
        
        // Log alert
        const logLevel = level === 'critical' ? 'error' : level === 'warning' ? 'warn' : 'info';
        console[logLevel]('Performance Alert:', alert.message);
        
        // Trigger error manager if available
        if (level === 'critical' && window.errorManager) {
            window.errorManager.handleError({
                type: 'performance_alert',
                level: 'warning',
                details: alert,
                timestamp: Date.now(),
                recovery: 'performance_optimization_suggested'
            });
        }
        
        // Notify UI if callback registered
        if (this.onAlert) {
            this.onAlert(alert);
        }
    }
    
    /**
     * Generate human-readable alert message
     */
    generateAlertMessage(level, metricKey, value, threshold) {
        const metric = this.metrics.get(metricKey);
        const unit = metric.config.unit;
        
        const messages = {
            critical: `CRITICAL: ${metricKey} is ${value.toFixed(1)}${unit}, exceeding critical threshold of ${threshold}${unit}`,
            warning: `WARNING: ${metricKey} is ${value.toFixed(1)}${unit}, exceeding warning threshold of ${threshold}${unit}`,
            resolved: `RESOLVED: ${metricKey} is back to normal at ${value.toFixed(1)}${unit}`
        };
        
        return messages[level] || `Performance alert for ${metricKey}: ${value}${unit}`;
    }
    
    /**
     * Clean up old metrics data
     */
    cleanupOldMetrics() {
        const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
        let cleanedCount = 0;
        
        this.metrics.forEach(metric => {
            const initialLength = metric.values.length;
            
            // Remove values older than cutoff
            const validIndices = metric.timestamps
                .map((timestamp, index) => timestamp > cutoffTime ? index : -1)
                .filter(index => index !== -1);
            
            if (validIndices.length < metric.values.length) {
                metric.values = validIndices.map(index => metric.values[index]);
                metric.timestamps = validIndices.map(index => metric.timestamps[index]);
                cleanedCount += initialLength - metric.values.length;
                
                // Update stats after cleanup
                this.updateMetricStats(metric);
            }
        });
        
        // Clean up old alerts
        const alertCutoff = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days
        this.alerts = this.alerts.filter(alert => alert.timestamp > alertCutoff);
        
        if (cleanedCount > 0) {
            console.log(`Performance Monitor: Cleaned up ${cleanedCount} old metric values`);
        }
    }
    
    /**
     * Get performance report
     */
    getPerformanceReport(category = null, timeRange = 60 * 60 * 1000) {
        const cutoffTime = Date.now() - timeRange;
        const report = {
            generatedAt: Date.now(),
            timeRange: timeRange,
            categories: {},
            alerts: this.alerts.filter(alert => alert.timestamp > cutoffTime),
            summary: {}
        };
        
        this.metrics.forEach((metric, key) => {
            if (category && !key.startsWith(category)) return;
            
            const categoryName = metric.category;
            if (!report.categories[categoryName]) {
                report.categories[categoryName] = {};
            }
            
            // Filter values by time range
            const recentIndices = metric.timestamps
                .map((timestamp, index) => timestamp > cutoffTime ? index : -1)
                .filter(index => index !== -1);
            
            const recentValues = recentIndices.map(index => metric.values[index]);
            
            report.categories[categoryName][metric.name] = {
                ...metric.stats,
                recentCount: recentValues.length,
                config: metric.config,
                trend: metric.stats.trend,
                health: this.assessMetricHealth(key, metric.stats.recent)
            };
        });
        
        // Generate summary
        report.summary = this.generatePerformanceSummary(report);
        
        return report;
    }
    
    /**
     * Assess metric health status
     */
    assessMetricHealth(metricKey, currentValue) {
        if (!currentValue) return 'unknown';
        
        const threshold = this.thresholds.get(metricKey);
        if (!threshold) return 'unmonitored';
        
        if (currentValue >= threshold.critical) return 'critical';
        if (currentValue >= threshold.warning) return 'warning';
        return 'healthy';
    }
    
    /**
     * Generate performance summary
     */
    generatePerformanceSummary(report) {
        const categories = Object.keys(report.categories);
        let healthyCount = 0;
        let warningCount = 0;
        let criticalCount = 0;
        
        categories.forEach(category => {
            Object.values(report.categories[category]).forEach(metric => {
                switch (metric.health) {
                    case 'healthy': healthyCount++; break;
                    case 'warning': warningCount++; break;
                    case 'critical': criticalCount++; break;
                }
            });
        });
        
        const totalMetrics = healthyCount + warningCount + criticalCount;
        const overallHealth = criticalCount > 0 ? 'critical' : 
                             warningCount > 0 ? 'warning' : 'healthy';
        
        return {
            overallHealth,
            totalMetrics,
            healthyMetrics: healthyCount,
            warningMetrics: warningCount,
            criticalMetrics: criticalCount,
            recentAlerts: report.alerts.length,
            recommendations: this.generateRecommendations(report)
        };
    }
    
    /**
     * Generate performance recommendations
     */
    generateRecommendations(report) {
        const recommendations = [];
        
        // Analyze each category for recommendations
        Object.entries(report.categories).forEach(([category, metrics]) => {
            Object.entries(metrics).forEach(([metricName, data]) => {
                if (data.health === 'critical' || data.health === 'warning') {
                    recommendations.push(this.getRecommendationForMetric(category, metricName, data));
                }
            });
        });
        
        return recommendations.filter(rec => rec !== null);
    }
    
    /**
     * Get specific recommendation for metric
     */
    getRecommendationForMetric(category, metricName, data) {
        const key = `${category}.${metricName}`;
        
        const recommendations = {
            'llm.responseTime': 'Consider optimizing LLM requests or using caching',
            'cache.hitRate': 'Review cache configuration and increase cache size',
            'background.queueLength': 'Add more workers or optimize task processing',
            'system.memoryUsage': 'Implement memory cleanup or reduce data retention',
            'ui.interactionLatency': 'Optimize UI rendering and reduce JavaScript execution time'
        };
        
        return recommendations[key] ? {
            metric: key,
            severity: data.health,
            recommendation: recommendations[key],
            currentValue: data.recent,
            trend: data.trend
        } : null;
    }
    
    /**
     * Register alert callback
     */
    onAlert(callback) {
        this.onAlert = callback;
    }
    
    /**
     * Export metrics data
     */
    exportMetrics(format = 'json') {
        const exportData = {
            exportedAt: Date.now(),
            metrics: {},
            alerts: this.alerts,
            thresholds: Object.fromEntries(this.thresholds)
        };
        
        this.metrics.forEach((metric, key) => {
            exportData.metrics[key] = {
                category: metric.category,
                name: metric.name,
                values: metric.values.slice(-100), // Last 100 values
                timestamps: metric.timestamps.slice(-100),
                stats: metric.stats,
                config: metric.config
            };
        });
        
        if (format === 'csv') {
            return this.convertToCSV(exportData);
        }
        
        return exportData;
    }
    
    /**
     * Convert metrics to CSV format
     */
    convertToCSV(data) {
        const csv = ['Metric,Timestamp,Value,Category'];
        
        Object.entries(data.metrics).forEach(([key, metric]) => {
            metric.values.forEach((value, index) => {
                const timestamp = new Date(metric.timestamps[index]).toISOString();
                csv.push(`${key},${timestamp},${value},${metric.category}`);
            });
        });
        
        return csv.join('\n');
    }
    
    /**
     * Cleanup and destroy performance monitor
     */
    cleanup() {
        // Clear intervals
        if (this.systemMetricsInterval) clearInterval(this.systemMetricsInterval);
        if (this.appMetricsInterval) clearInterval(this.appMetricsInterval);
        if (this.cleanupInterval) clearInterval(this.cleanupInterval);
        if (this.thresholdInterval) clearInterval(this.thresholdInterval);
        
        // Disconnect observers
        this.observers.forEach(observer => {
            try {
                observer.disconnect();
            } catch (error) {
                console.warn('Error disconnecting observer:', error);
            }
        });
        
        // Clear data
        this.metrics.clear();
        this.timers.clear();
        this.thresholds.clear();
        this.alerts.length = 0;
        this.observers.length = 0;
        
        console.log('PerformanceMonitor cleaned up');
    }
}

// Global instance
window.performanceMonitor = new PerformanceMonitor();