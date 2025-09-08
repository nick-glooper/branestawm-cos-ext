// Branestawm - Analytics Tracker
// Advanced error tracking and user analytics with privacy focus

class AnalyticsTracker {
    constructor() {
        this.isEnabled = this.shouldEnableTracking();
        this.sessionId = this.generateSessionId();
        this.userId = this.getOrCreateUserId();
        this.events = [];
        this.errors = [];
        this.userMetrics = {
            tasksCreated: 0,
            tasksCompleted: 0,
            averageTaskDuration: 0,
            mostUsedFeatures: new Map(),
            sessionDuration: 0,
            errorCount: 0
        };
        
        this.startTime = Date.now();
        this.lastActivity = Date.now();
        
        if (this.isEnabled) {
            this.initialize();
        }
    }
    
    /**
     * Check if analytics tracking should be enabled
     */
    shouldEnableTracking() {
        try {
            // Respect user privacy - only enable if explicitly opted in
            const userConsent = localStorage.getItem('branestawm_analytics_consent');
            const isDevelopment = typeof chrome !== 'undefined' && 
                                chrome.runtime && 
                                chrome.runtime.getURL('').includes('unpacked');
            
            // Enable for development or with explicit consent
            return isDevelopment || userConsent === 'true';
        } catch (error) {
            return false;
        }
    }
    
    /**
     * Initialize analytics tracking
     */
    initialize() {
        logger.debug('Analytics tracking initialized', { 
            sessionId: this.sessionId,
            userId: this.userId.substring(0, 8) + '...' 
        });
        
        // Track session start
        this.trackEvent('session_started', {
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            version: this.getExtensionVersion()
        });
        
        // Set up error tracking
        this.setupErrorTracking();
        
        // Set up activity tracking
        this.setupActivityTracking();
        
        // Set up periodic metrics collection
        this.startPeriodicCollection();
        
        // Track extension lifecycle events
        this.setupLifecycleTracking();
    }
    
    /**
     * Generate unique session ID
     */
    generateSessionId() {
        return 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    /**
     * Get or create anonymous user ID
     */
    getOrCreateUserId() {
        try {
            let userId = localStorage.getItem('branestawm_user_id');
            
            if (!userId) {
                userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                localStorage.setItem('branestawm_user_id', userId);
            }
            
            return userId;
        } catch (error) {
            // Fallback to session-based ID
            return 'temp_' + Date.now();
        }
    }
    
    /**
     * Get extension version
     */
    getExtensionVersion() {
        try {
            if (typeof chrome !== 'undefined' && chrome.runtime) {
                return chrome.runtime.getManifest().version;
            }
            return '1.0.0';
        } catch (error) {
            return 'unknown';
        }
    }
    
    /**
     * Track custom event
     */
    trackEvent(eventName, properties = {}, category = 'general') {
        if (!this.isEnabled) return;
        
        const event = {
            id: this.generateEventId(),
            name: eventName,
            category: category,
            properties: {
                ...properties,
                sessionId: this.sessionId,
                timestamp: new Date().toISOString(),
                url: window.location ? window.location.href : 'extension'
            },
            timestamp: Date.now()
        };
        
        this.events.push(event);
        this.updateActivity();
        
        // Keep only last 1000 events in memory
        if (this.events.length > 1000) {
            this.events = this.events.slice(-1000);
        }
        
        // Update feature usage tracking
        this.trackFeatureUsage(eventName, category);
        
        logger.debug('Event tracked:', eventName, properties);
    }
    
    /**
     * Generate event ID
     */
    generateEventId() {
        return 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    }
    
    /**
     * Track feature usage for insights
     */
    trackFeatureUsage(feature, category) {
        const featureKey = `${category}.${feature}`;
        const currentCount = this.userMetrics.mostUsedFeatures.get(featureKey) || 0;
        this.userMetrics.mostUsedFeatures.set(featureKey, currentCount + 1);
    }
    
    /**
     * Track error with context
     */
    trackError(error, context = {}, severity = 'error') {
        if (!this.isEnabled) return;
        
        const errorEvent = {
            id: this.generateEventId(),
            name: 'error_occurred',
            category: 'error',
            properties: {
                message: error.message || String(error),
                stack: error.stack || null,
                context: context,
                severity: severity,
                sessionId: this.sessionId,
                timestamp: new Date().toISOString(),
                url: window.location ? window.location.href : 'extension',
                userAgent: navigator.userAgent
            },
            timestamp: Date.now()
        };
        
        this.errors.push(errorEvent);
        this.userMetrics.errorCount++;
        
        // Keep only last 100 errors
        if (this.errors.length > 100) {
            this.errors = this.errors.slice(-100);
        }
        
        // Store critical errors persistently
        if (severity === 'error' || severity === 'critical') {
            this.persistError(errorEvent);
        }
        
        logger.error('Error tracked:', error.message, context);
    }
    
    /**
     * Persist critical errors to storage
     */
    persistError(errorEvent) {
        try {
            const storedErrors = JSON.parse(localStorage.getItem('branestawm_critical_errors') || '[]');
            storedErrors.push(errorEvent);
            
            // Keep only last 50 critical errors
            if (storedErrors.length > 50) {
                storedErrors.shift();
            }
            
            localStorage.setItem('branestawm_critical_errors', JSON.stringify(storedErrors));
        } catch (error) {
            // Fail silently if storage is full
        }
    }
    
    /**
     * Track task-specific metrics
     */
    trackTaskMetrics(action, taskData = {}) {
        if (!this.isEnabled) return;
        
        switch (action) {
            case 'task_created':
                this.userMetrics.tasksCreated++;
                this.trackEvent('task_created', {
                    category: taskData.category || 'general',
                    hasTemplate: !!taskData.templateApplied,
                    estimatedMinutes: taskData.estimatedMinutes || null
                }, 'tasks');
                break;
                
            case 'task_completed':
                this.userMetrics.tasksCompleted++;
                
                // Calculate completion rate
                const completionRate = this.userMetrics.tasksCreated > 0 ? 
                    (this.userMetrics.tasksCompleted / this.userMetrics.tasksCreated) * 100 : 0;
                
                this.trackEvent('task_completed', {
                    category: taskData.category || 'general',
                    actualMinutes: taskData.actualMinutes || null,
                    accuracy: taskData.accuracy || null,
                    completionRate: completionRate
                }, 'tasks');
                
                // Update average task duration
                if (taskData.actualMinutes) {
                    this.updateAverageTaskDuration(taskData.actualMinutes);
                }
                break;
                
            case 'task_abandoned':
                this.trackEvent('task_abandoned', {
                    category: taskData.category || 'general',
                    timeSpent: taskData.timeSpent || null
                }, 'tasks');
                break;
        }
    }
    
    /**
     * Update average task duration
     */
    updateAverageTaskDuration(newDuration) {
        const currentAvg = this.userMetrics.averageTaskDuration;
        const completedTasks = this.userMetrics.tasksCompleted;
        
        // Running average calculation
        this.userMetrics.averageTaskDuration = 
            ((currentAvg * (completedTasks - 1)) + newDuration) / completedTasks;
    }
    
    /**
     * Setup global error tracking
     */
    setupErrorTracking() {
        // Global error handler
        window.addEventListener('error', (event) => {
            this.trackError(event.error, {
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                type: 'javascript'
            }, 'error');
        });
        
        // Unhandled promise rejection handler
        window.addEventListener('unhandledrejection', (event) => {
            this.trackError(event.reason, {
                type: 'unhandled_promise',
                promise: event.promise
            }, 'error');
        });
        
        // Console error interception
        const originalConsoleError = console.error;
        console.error = (...args) => {
            this.trackError(new Error(args.join(' ')), {
                type: 'console_error',
                args: args
            }, 'warn');
            
            originalConsoleError.apply(console, args);
        };
    }
    
    /**
     * Setup activity tracking
     */
    setupActivityTracking() {
        const updateActivity = () => {
            this.updateActivity();
        };
        
        // Track user interactions
        ['click', 'keydown', 'scroll', 'mousemove'].forEach(eventType => {
            document.addEventListener(eventType, updateActivity, { passive: true });
        });
        
        // Track page visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.trackEvent('session_paused', {
                    duration: Date.now() - this.startTime
                }, 'session');
            } else {
                this.trackEvent('session_resumed', {
                    duration: Date.now() - this.startTime
                }, 'session');
            }
        });
    }
    
    /**
     * Update last activity timestamp
     */
    updateActivity() {
        this.lastActivity = Date.now();
        this.userMetrics.sessionDuration = this.lastActivity - this.startTime;
    }
    
    /**
     * Setup extension lifecycle tracking
     */
    setupLifecycleTracking() {
        // Track when user leaves
        window.addEventListener('beforeunload', () => {
            this.trackSessionEnd();
        });
        
        // Track extension updates if available
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.onInstalled.addListener((details) => {
                if (details.reason === 'update') {
                    this.trackEvent('extension_updated', {
                        previousVersion: details.previousVersion,
                        currentVersion: chrome.runtime.getManifest().version
                    }, 'extension');
                }
            });
        }
    }
    
    /**
     * Track session end
     */
    trackSessionEnd() {
        if (!this.isEnabled) return;
        
        const sessionDuration = Date.now() - this.startTime;
        
        this.trackEvent('session_ended', {
            duration: sessionDuration,
            tasksCreated: this.userMetrics.tasksCreated,
            tasksCompleted: this.userMetrics.tasksCompleted,
            averageTaskDuration: this.userMetrics.averageTaskDuration,
            errorCount: this.userMetrics.errorCount,
            topFeatures: Array.from(this.userMetrics.mostUsedFeatures.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([feature, count]) => ({ feature, count }))
        }, 'session');
        
        // Persist session data
        this.persistSessionData();
    }
    
    /**
     * Persist session data to storage
     */
    persistSessionData() {
        try {
            const sessionData = {
                sessionId: this.sessionId,
                userId: this.userId,
                startTime: this.startTime,
                endTime: Date.now(),
                duration: Date.now() - this.startTime,
                metrics: this.userMetrics,
                eventCount: this.events.length,
                errorCount: this.errors.length
            };
            
            const sessions = JSON.parse(localStorage.getItem('branestawm_sessions') || '[]');
            sessions.push(sessionData);
            
            // Keep only last 10 sessions
            if (sessions.length > 10) {
                sessions.shift();
            }
            
            localStorage.setItem('branestawm_sessions', JSON.stringify(sessions));
        } catch (error) {
            logger.error('Failed to persist session data:', error);
        }
    }
    
    /**
     * Start periodic metrics collection
     */
    startPeriodicCollection() {
        // Collect metrics every 5 minutes
        setInterval(() => {
            this.collectPeriodicMetrics();
        }, 5 * 60 * 1000);
    }
    
    /**
     * Collect periodic metrics
     */
    collectPeriodicMetrics() {
        const metrics = {
            sessionDuration: Date.now() - this.startTime,
            memoryUsage: performance.memory ? performance.memory.usedJSHeapSize : null,
            eventCount: this.events.length,
            errorCount: this.errors.length,
            lastActivity: Date.now() - this.lastActivity,
            tasksInProgress: this.getTasksInProgress()
        };
        
        this.trackEvent('periodic_metrics', metrics, 'system');
    }
    
    /**
     * Get number of tasks in progress (if TaskManager is available)
     */
    getTasksInProgress() {
        try {
            if (window.taskManager) {
                const tasks = window.taskManager.getAllTasks();
                return tasks.filter(task => task.status === 'in-progress').length;
            }
            return 0;
        } catch (error) {
            return 0;
        }
    }
    
    /**
     * Get analytics summary
     */
    getSummary() {
        return {
            session: {
                id: this.sessionId,
                startTime: this.startTime,
                duration: Date.now() - this.startTime,
                lastActivity: this.lastActivity
            },
            metrics: this.userMetrics,
            events: {
                total: this.events.length,
                byCategory: this.getEventsByCategory()
            },
            errors: {
                total: this.errors.length,
                bySeverity: this.getErrorsBySeverity()
            },
            topFeatures: Array.from(this.userMetrics.mostUsedFeatures.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
        };
    }
    
    /**
     * Get events grouped by category
     */
    getEventsByCategory() {
        return this.events.reduce((acc, event) => {
            acc[event.category] = (acc[event.category] || 0) + 1;
            return acc;
        }, {});
    }
    
    /**
     * Get errors grouped by severity
     */
    getErrorsBySeverity() {
        return this.errors.reduce((acc, error) => {
            const severity = error.properties.severity || 'unknown';
            acc[severity] = (acc[severity] || 0) + 1;
            return acc;
        }, {});
    }
    
    /**
     * Export analytics data
     */
    exportData() {
        return {
            summary: this.getSummary(),
            events: this.events,
            errors: this.errors,
            sessions: JSON.parse(localStorage.getItem('branestawm_sessions') || '[]'),
            criticalErrors: JSON.parse(localStorage.getItem('branestawm_critical_errors') || '[]'),
            exportedAt: new Date().toISOString(),
            version: this.getExtensionVersion()
        };
    }
    
    /**
     * Clear all analytics data
     */
    clearData() {
        this.events = [];
        this.errors = [];
        this.userMetrics = {
            tasksCreated: 0,
            tasksCompleted: 0,
            averageTaskDuration: 0,
            mostUsedFeatures: new Map(),
            sessionDuration: 0,
            errorCount: 0
        };
        
        localStorage.removeItem('branestawm_sessions');
        localStorage.removeItem('branestawm_critical_errors');
        
        logger.info('Analytics data cleared');
    }
    
    /**
     * Set user consent for analytics
     */
    setConsent(consent) {
        localStorage.setItem('branestawm_analytics_consent', consent.toString());
        this.isEnabled = consent;
        
        if (consent && !this.sessionId) {
            this.initialize();
        }
        
        this.trackEvent('consent_updated', { consent: consent }, 'privacy');
    }
}

// Create global instance
const analyticsTracker = new AnalyticsTracker();

// Convenience functions
window.analytics = {
    track: (event, props, category) => analyticsTracker.trackEvent(event, props, category),
    error: (error, context, severity) => analyticsTracker.trackError(error, context, severity),
    task: (action, data) => analyticsTracker.trackTaskMetrics(action, data),
    summary: () => analyticsTracker.getSummary(),
    export: () => analyticsTracker.exportData(),
    clear: () => analyticsTracker.clearData(),
    consent: (enable) => analyticsTracker.setConsent(enable)
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AnalyticsTracker;
} else {
    window.AnalyticsTracker = AnalyticsTracker;
    window.analyticsTracker = analyticsTracker;
}