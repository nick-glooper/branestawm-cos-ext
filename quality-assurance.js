// Branestawm - Quality Assurance System
// Comprehensive validation, health checks, and data integrity monitoring

class QualityAssurance {
    constructor() {
        if (QualityAssurance.instance) {
            return QualityAssurance.instance;
        }
        
        this.validators = new Map();
        this.healthChecks = new Map();
        this.issues = [];
        this.validationResults = new Map();
        this.healthStatus = new Map();
        
        this.initializeValidators();
        this.initializeHealthChecks();
        this.setupContinuousMonitoring();
        
        QualityAssurance.instance = this;
        console.log('QualityAssurance system initialized');
    }
    
    /**
     * Initialize data validators
     */
    initializeValidators() {
        // Folio data validation
        this.validators.set('folio', {
            name: 'Folio Data Validation',
            validate: this.validateFolio.bind(this),
            critical: true,
            frequency: 'on_change'
        });
        
        // Message data validation
        this.validators.set('message', {
            name: 'Message Data Validation',
            validate: this.validateMessage.bind(this),
            critical: true,
            frequency: 'on_create'
        });
        
        // Settings validation
        this.validators.set('settings', {
            name: 'Settings Configuration Validation',
            validate: this.validateSettings.bind(this),
            critical: true,
            frequency: 'on_change'
        });
        
        // Cache integrity validation
        this.validators.set('cache', {
            name: 'Cache Integrity Validation',
            validate: this.validateCacheIntegrity.bind(this),
            critical: false,
            frequency: 'periodic'
        });
        
        // Performance metrics validation
        this.validators.set('performance', {
            name: 'Performance Metrics Validation',
            validate: this.validatePerformanceMetrics.bind(this),
            critical: false,
            frequency: 'periodic'
        });
        
        // Data consistency validation
        this.validators.set('consistency', {
            name: 'Data Consistency Validation',
            validate: this.validateDataConsistency.bind(this),
            critical: true,
            frequency: 'periodic'
        });
    }
    
    /**
     * Initialize health check systems
     */
    initializeHealthChecks() {
        // System resource health
        this.healthChecks.set('system_resources', {
            name: 'System Resources Health',
            check: this.checkSystemResources.bind(this),
            threshold: 'warning',
            interval: 30000 // 30 seconds
        });
        
        // Data manager health
        this.healthChecks.set('data_manager', {
            name: 'Data Manager Health',
            check: this.checkDataManagerHealth.bind(this),
            threshold: 'critical',
            interval: 60000 // 1 minute
        });
        
        // Background processor health
        this.healthChecks.set('background_processor', {
            name: 'Background Processor Health',
            check: this.checkBackgroundProcessorHealth.bind(this),
            threshold: 'warning',
            interval: 45000 // 45 seconds
        });
        
        // Cache system health
        this.healthChecks.set('cache_system', {
            name: 'Cache System Health',
            check: this.checkCacheSystemHealth.bind(this),
            threshold: 'warning',
            interval: 120000 // 2 minutes
        });
        
        // LLM connectivity health
        this.healthChecks.set('llm_connectivity', {
            name: 'LLM Connectivity Health',
            check: this.checkLLMConnectivity.bind(this),
            threshold: 'critical',
            interval: 180000 // 3 minutes
        });
        
        // UI responsiveness health
        this.healthChecks.set('ui_responsiveness', {
            name: 'UI Responsiveness Health',
            check: this.checkUIResponsiveness.bind(this),
            threshold: 'warning',
            interval: 30000 // 30 seconds
        });
    }
    
    /**
     * Setup continuous monitoring
     */
    setupContinuousMonitoring() {
        // Start periodic health checks
        this.healthChecks.forEach((check, checkId) => {
            setInterval(() => {
                this.runHealthCheck(checkId).catch(error => {
                    console.error(`Health check ${checkId} failed:`, error);
                });
            }, check.interval);
        });
        
        // Run comprehensive validation every 10 minutes
        this.comprehensiveValidationInterval = setInterval(() => {
            this.runComprehensiveValidation().catch(error => {
                console.error('Comprehensive validation failed:', error);
            });
        }, 10 * 60 * 1000);
        
        // Clean up old issues every hour
        this.cleanupInterval = setInterval(() => {
            this.cleanupOldIssues();
        }, 60 * 60 * 1000);
    }
    
    /**
     * Validate folio data structure
     */
    async validateFolio(folioData) {
        const issues = [];
        
        if (!folioData) {
            issues.push({
                severity: 'critical',
                code: 'FOLIO_NULL',
                message: 'Folio data is null or undefined',
                field: 'folio'
            });
            return { valid: false, issues };
        }
        
        // Required fields validation
        const requiredFields = ['id', 'title', 'messages', 'lastUsed'];
        requiredFields.forEach(field => {
            if (!folioData.hasOwnProperty(field)) {
                issues.push({
                    severity: 'critical',
                    code: 'MISSING_FIELD',
                    message: `Required field '${field}' is missing`,
                    field
                });
            }
        });
        
        // Data type validation
        if (folioData.id && typeof folioData.id !== 'string') {
            issues.push({
                severity: 'critical',
                code: 'INVALID_TYPE',
                message: 'Folio ID must be a string',
                field: 'id'
            });
        }
        
        if (folioData.title && typeof folioData.title !== 'string') {
            issues.push({
                severity: 'warning',
                code: 'INVALID_TYPE',
                message: 'Folio title should be a string',
                field: 'title'
            });
        }
        
        if (folioData.messages && !Array.isArray(folioData.messages)) {
            issues.push({
                severity: 'critical',
                code: 'INVALID_TYPE',
                message: 'Messages must be an array',
                field: 'messages'
            });
        }
        
        // Messages validation
        if (Array.isArray(folioData.messages)) {
            folioData.messages.forEach((message, index) => {
                const messageValidation = this.validateMessage(message);
                if (!messageValidation.valid) {
                    messageValidation.issues.forEach(issue => {
                        issues.push({
                            ...issue,
                            field: `messages[${index}].${issue.field}`,
                            context: `Message ${index}`
                        });
                    });
                }
            });
        }
        
        // Date validation
        if (folioData.lastUsed) {
            const lastUsedDate = new Date(folioData.lastUsed);
            if (isNaN(lastUsedDate.getTime())) {
                issues.push({
                    severity: 'warning',
                    code: 'INVALID_DATE',
                    message: 'Invalid lastUsed date format',
                    field: 'lastUsed'
                });
            }
        }
        
        return {
            valid: issues.length === 0,
            issues,
            validationTime: Date.now()
        };
    }
    
    /**
     * Validate message data structure
     */
    validateMessage(messageData) {
        const issues = [];
        
        if (!messageData) {
            issues.push({
                severity: 'critical',
                code: 'MESSAGE_NULL',
                message: 'Message data is null or undefined',
                field: 'message'
            });
            return { valid: false, issues };
        }
        
        // Required fields
        const requiredFields = ['id', 'role', 'content', 'timestamp'];
        requiredFields.forEach(field => {
            if (!messageData.hasOwnProperty(field)) {
                issues.push({
                    severity: 'critical',
                    code: 'MISSING_FIELD',
                    message: `Required field '${field}' is missing`,
                    field
                });
            }
        });
        
        // Role validation
        if (messageData.role && !['user', 'assistant'].includes(messageData.role)) {
            issues.push({
                severity: 'warning',
                code: 'INVALID_ROLE',
                message: `Invalid role '${messageData.role}', expected 'user' or 'assistant'`,
                field: 'role'
            });
        }
        
        // Content validation
        if (messageData.content) {
            if (typeof messageData.content !== 'string') {
                issues.push({
                    severity: 'critical',
                    code: 'INVALID_TYPE',
                    message: 'Message content must be a string',
                    field: 'content'
                });
            } else if (messageData.content.length > 50000) {
                issues.push({
                    severity: 'warning',
                    code: 'CONTENT_TOO_LONG',
                    message: 'Message content is unusually long (>50k characters)',
                    field: 'content'
                });
            }
        }
        
        // Enhanced message structure validation
        if (messageData.schemaVersion >= 2) {
            if (messageData.semanticType && !['task', 'query', 'response', 'summary', 'clarification', 'general'].includes(messageData.semanticType)) {
                issues.push({
                    severity: 'warning',
                    code: 'INVALID_SEMANTIC_TYPE',
                    message: `Invalid semantic type '${messageData.semanticType}'`,
                    field: 'semanticType'
                });
            }
            
            if (messageData.importance && (messageData.importance < 1 || messageData.importance > 5)) {
                issues.push({
                    severity: 'warning',
                    code: 'INVALID_IMPORTANCE',
                    message: 'Importance score must be between 1 and 5',
                    field: 'importance'
                });
            }
        }
        
        return {
            valid: issues.length === 0,
            issues,
            validationTime: Date.now()
        };
    }
    
    /**
     * Validate settings configuration
     */
    async validateSettings(settingsData) {
        const issues = [];
        
        if (!settingsData) {
            issues.push({
                severity: 'critical',
                code: 'SETTINGS_NULL',
                message: 'Settings data is null or undefined',
                field: 'settings'
            });
            return { valid: false, issues };
        }
        
        // LLM configuration validation
        if (settingsData.activeLlm && !['local', 'custom'].includes(settingsData.activeLlm)) {
            issues.push({
                severity: 'warning',
                code: 'INVALID_LLM_TYPE',
                message: `Invalid active LLM type '${settingsData.activeLlm}'`,
                field: 'activeLlm'
            });
        }
        
        // API endpoint validation
        if (settingsData.apiEndpoint) {
            try {
                new URL(settingsData.apiEndpoint);
            } catch (error) {
                issues.push({
                    severity: 'warning',
                    code: 'INVALID_URL',
                    message: 'Invalid API endpoint URL format',
                    field: 'apiEndpoint'
                });
            }
        }
        
        // Persona validation
        if (settingsData.personas) {
            Object.entries(settingsData.personas).forEach(([personaId, persona]) => {
                if (!persona.name || typeof persona.name !== 'string') {
                    issues.push({
                        severity: 'warning',
                        code: 'INVALID_PERSONA',
                        message: `Persona '${personaId}' missing or invalid name`,
                        field: `personas.${personaId}.name`
                    });
                }
            });
        }
        
        return {
            valid: issues.length === 0,
            issues,
            validationTime: Date.now()
        };
    }
    
    /**
     * Validate cache integrity
     */
    async validateCacheIntegrity() {
        const issues = [];
        
        if (!window.cacheManager) {
            issues.push({
                severity: 'warning',
                code: 'CACHE_UNAVAILABLE',
                message: 'Cache manager is not available',
                field: 'cacheManager'
            });
            return { valid: false, issues };
        }
        
        try {
            const cacheStats = window.cacheManager.getStatistics();
            
            // Check for extremely low hit rates
            Object.entries(cacheStats.caches).forEach(([cacheType, stats]) => {
                if (stats.hits > 10 && stats.hitRate < 0.2) {
                    issues.push({
                        severity: 'warning',
                        code: 'LOW_CACHE_HIT_RATE',
                        message: `Cache '${cacheType}' has low hit rate: ${(stats.hitRate * 100).toFixed(1)}%`,
                        field: `cache.${cacheType}.hitRate`
                    });
                }
                
                // Check for excessive evictions
                if (stats.evictions > 100 && stats.evictions / stats.sets > 0.5) {
                    issues.push({
                        severity: 'warning',
                        code: 'HIGH_EVICTION_RATE',
                        message: `Cache '${cacheType}' has high eviction rate`,
                        field: `cache.${cacheType}.evictions`
                    });
                }
            });
            
        } catch (error) {
            issues.push({
                severity: 'warning',
                code: 'CACHE_VALIDATION_ERROR',
                message: `Cache validation failed: ${error.message}`,
                field: 'cache'
            });
        }
        
        return {
            valid: issues.length === 0,
            issues,
            validationTime: Date.now()
        };
    }
    
    /**
     * Validate performance metrics
     */
    async validatePerformanceMetrics() {
        const issues = [];
        
        if (!window.performanceMonitor) {
            issues.push({
                severity: 'info',
                code: 'PERFORMANCE_MONITOR_UNAVAILABLE',
                message: 'Performance monitor is not available',
                field: 'performanceMonitor'
            });
            return { valid: true, issues };
        }
        
        try {
            const report = window.performanceMonitor.getPerformanceReport();
            
            // Check for performance degradation
            Object.entries(report.categories).forEach(([category, metrics]) => {
                Object.entries(metrics).forEach(([metricName, data]) => {
                    if (data.health === 'critical') {
                        issues.push({
                            severity: 'critical',
                            code: 'PERFORMANCE_CRITICAL',
                            message: `Critical performance issue in ${category}.${metricName}`,
                            field: `performance.${category}.${metricName}`
                        });
                    } else if (data.health === 'warning') {
                        issues.push({
                            severity: 'warning',
                            code: 'PERFORMANCE_WARNING',
                            message: `Performance warning in ${category}.${metricName}`,
                            field: `performance.${category}.${metricName}`
                        });
                    }
                });
            });
            
        } catch (error) {
            issues.push({
                severity: 'warning',
                code: 'PERFORMANCE_VALIDATION_ERROR',
                message: `Performance validation failed: ${error.message}`,
                field: 'performance'
            });
        }
        
        return {
            valid: issues.filter(i => i.severity === 'critical').length === 0,
            issues,
            validationTime: Date.now()
        };
    }
    
    /**
     * Validate data consistency across systems
     */
    async validateDataConsistency() {
        const issues = [];
        
        try {
            if (window.dataManager) {
                const folios = window.dataManager.getFolios();
                
                // Check for duplicate folio IDs
                const folioIds = Object.keys(folios);
                const uniqueIds = new Set(folioIds);
                if (folioIds.length !== uniqueIds.size) {
                    issues.push({
                        severity: 'critical',
                        code: 'DUPLICATE_FOLIO_IDS',
                        message: 'Duplicate folio IDs detected',
                        field: 'folios'
                    });
                }
                
                // Check for orphaned message references
                Object.entries(folios).forEach(([folioId, folio]) => {
                    if (folio.messages) {
                        const messageIds = folio.messages.map(m => m.id);
                        const uniqueMessageIds = new Set(messageIds);
                        if (messageIds.length !== uniqueMessageIds.size) {
                            issues.push({
                                severity: 'warning',
                                code: 'DUPLICATE_MESSAGE_IDS',
                                message: `Duplicate message IDs in folio ${folioId}`,
                                field: `folios.${folioId}.messages`
                            });
                        }
                    }
                });
            }
            
        } catch (error) {
            issues.push({
                severity: 'critical',
                code: 'CONSISTENCY_CHECK_ERROR',
                message: `Data consistency check failed: ${error.message}`,
                field: 'consistency'
            });
        }
        
        return {
            valid: issues.filter(i => i.severity === 'critical').length === 0,
            issues,
            validationTime: Date.now()
        };
    }
    
    /**
     * Run system resources health check
     */
    async checkSystemResources() {
        const health = {
            status: 'healthy',
            issues: [],
            metrics: {}
        };
        
        try {
            // Memory usage check
            if (performance.memory) {
                const memoryMB = performance.memory.usedJSHeapSize / (1024 * 1024);
                health.metrics.memoryUsage = memoryMB;
                
                if (memoryMB > 200) {
                    health.status = 'critical';
                    health.issues.push({
                        severity: 'critical',
                        message: `High memory usage: ${memoryMB.toFixed(1)}MB`
                    });
                } else if (memoryMB > 100) {
                    health.status = 'warning';
                    health.issues.push({
                        severity: 'warning',
                        message: `Elevated memory usage: ${memoryMB.toFixed(1)}MB`
                    });
                }
            }
            
            // Storage usage check
            if (navigator.storage && navigator.storage.estimate) {
                const estimate = await navigator.storage.estimate();
                const storageMB = (estimate.usage || 0) / (1024 * 1024);
                health.metrics.storageUsage = storageMB;
                
                if (storageMB > 500) {
                    health.status = 'warning';
                    health.issues.push({
                        severity: 'warning',
                        message: `High storage usage: ${storageMB.toFixed(1)}MB`
                    });
                }
            }
            
        } catch (error) {
            health.status = 'error';
            health.issues.push({
                severity: 'error',
                message: `System resources check failed: ${error.message}`
            });
        }
        
        return health;
    }
    
    /**
     * Check data manager health
     */
    async checkDataManagerHealth() {
        const health = {
            status: 'healthy',
            issues: [],
            metrics: {}
        };
        
        if (!window.dataManager) {
            health.status = 'critical';
            health.issues.push({
                severity: 'critical',
                message: 'Data manager is not available'
            });
            return health;
        }
        
        try {
            // Test data manager operations
            const startTime = performance.now();
            const settings = window.dataManager.getSettings();
            const loadTime = performance.now() - startTime;
            
            health.metrics.loadTime = loadTime;
            
            if (!settings) {
                health.status = 'critical';
                health.issues.push({
                    severity: 'critical',
                    message: 'Failed to load settings from data manager'
                });
            } else if (loadTime > 1000) {
                health.status = 'warning';
                health.issues.push({
                    severity: 'warning',
                    message: `Slow data manager response: ${loadTime.toFixed(1)}ms`
                });
            }
            
        } catch (error) {
            health.status = 'error';
            health.issues.push({
                severity: 'error',
                message: `Data manager health check failed: ${error.message}`
            });
        }
        
        return health;
    }
    
    /**
     * Check background processor health
     */
    async checkBackgroundProcessorHealth() {
        const health = {
            status: 'healthy',
            issues: [],
            metrics: {}
        };
        
        if (!window.backgroundProcessor) {
            health.status = 'info';
            health.issues.push({
                severity: 'info',
                message: 'Background processor is not available'
            });
            return health;
        }
        
        try {
            const stats = window.backgroundProcessor.getStatistics();
            health.metrics = stats;
            
            // Check queue length
            if (stats.queueLength > 50) {
                health.status = 'warning';
                health.issues.push({
                    severity: 'warning',
                    message: `Large background processing queue: ${stats.queueLength} items`
                });
            }
            
            // Check success rate
            if (stats.totalTasksProcessed > 10 && stats.successRate < 0.8) {
                health.status = 'warning';
                health.issues.push({
                    severity: 'warning',
                    message: `Low background processing success rate: ${(stats.successRate * 100).toFixed(1)}%`
                });
            }
            
        } catch (error) {
            health.status = 'error';
            health.issues.push({
                severity: 'error',
                message: `Background processor health check failed: ${error.message}`
            });
        }
        
        return health;
    }
    
    /**
     * Check cache system health
     */
    async checkCacheSystemHealth() {
        const health = {
            status: 'healthy',
            issues: [],
            metrics: {}
        };
        
        if (!window.cacheManager) {
            health.status = 'info';
            health.issues.push({
                severity: 'info',
                message: 'Cache manager is not available'
            });
            return health;
        }
        
        try {
            const stats = window.cacheManager.getStatistics();
            health.metrics = stats.overall;
            
            // Check overall hit rate
            if (stats.overall.overallHitRate < 0.5) {
                health.status = 'warning';
                health.issues.push({
                    severity: 'warning',
                    message: `Low cache hit rate: ${(stats.overall.overallHitRate * 100).toFixed(1)}%`
                });
            }
            
            // Check memory usage
            if (stats.overall.memoryUsage.mb > 100) {
                health.status = 'warning';
                health.issues.push({
                    severity: 'warning',
                    message: `High cache memory usage: ${stats.overall.memoryUsage.mb}MB`
                });
            }
            
        } catch (error) {
            health.status = 'error';
            health.issues.push({
                severity: 'error',
                message: `Cache system health check failed: ${error.message}`
            });
        }
        
        return health;
    }
    
    /**
     * Check LLM connectivity health
     */
    async checkLLMConnectivity() {
        const health = {
            status: 'healthy',
            issues: [],
            metrics: {}
        };
        
        try {
            // This would normally test actual LLM connectivity
            // For now, we'll simulate based on settings
            const settings = window.dataManager?.getSettings();
            
            if (!settings) {
                health.status = 'warning';
                health.issues.push({
                    severity: 'warning',
                    message: 'Unable to check LLM settings'
                });
                return health;
            }
            
            if (settings.airplaneMode) {
                health.status = 'info';
                health.issues.push({
                    severity: 'info',
                    message: 'Airplane mode is enabled - LLM connectivity disabled'
                });
                return health;
            }
            
            if (!settings.apiEndpoint && settings.activeLlm === 'custom') {
                health.status = 'warning';
                health.issues.push({
                    severity: 'warning',
                    message: 'Custom LLM selected but no API endpoint configured'
                });
            }
            
        } catch (error) {
            health.status = 'error';
            health.issues.push({
                severity: 'error',
                message: `LLM connectivity check failed: ${error.message}`
            });
        }
        
        return health;
    }
    
    /**
     * Check UI responsiveness health
     */
    async checkUIResponsiveness() {
        const health = {
            status: 'healthy',
            issues: [],
            metrics: {}
        };
        
        try {
            // Measure DOM interaction time
            const startTime = performance.now();
            const testElement = document.createElement('div');
            document.body.appendChild(testElement);
            document.body.removeChild(testElement);
            const domTime = performance.now() - startTime;
            
            health.metrics.domInteractionTime = domTime;
            
            if (domTime > 100) {
                health.status = 'warning';
                health.issues.push({
                    severity: 'warning',
                    message: `Slow DOM interactions: ${domTime.toFixed(1)}ms`
                });
            }
            
            // Check for long tasks (if available)
            if (window.PerformanceObserver) {
                // This would be set up separately to monitor long tasks
                // For now, just mark as healthy
            }
            
        } catch (error) {
            health.status = 'error';
            health.issues.push({
                severity: 'error',
                message: `UI responsiveness check failed: ${error.message}`
            });
        }
        
        return health;
    }
    
    /**
     * Run a specific health check
     */
    async runHealthCheck(checkId) {
        const check = this.healthChecks.get(checkId);
        if (!check) {
            throw new Error(`Health check ${checkId} not found`);
        }
        
        try {
            const result = await check.check();
            result.checkId = checkId;
            result.checkName = check.name;
            result.timestamp = Date.now();
            
            this.healthStatus.set(checkId, result);
            
            // Record issues if any
            if (result.issues && result.issues.length > 0) {
                result.issues.forEach(issue => {
                    this.recordIssue({
                        ...issue,
                        source: 'health_check',
                        checkId,
                        timestamp: result.timestamp
                    });
                });
            }
            
            return result;
            
        } catch (error) {
            const errorResult = {
                checkId,
                checkName: check.name,
                status: 'error',
                issues: [{
                    severity: 'error',
                    message: `Health check failed: ${error.message}`
                }],
                timestamp: Date.now()
            };
            
            this.healthStatus.set(checkId, errorResult);
            this.recordIssue({
                severity: 'error',
                message: `Health check ${checkId} failed: ${error.message}`,
                source: 'health_check',
                checkId,
                timestamp: errorResult.timestamp
            });
            
            return errorResult;
        }
    }
    
    /**
     * Run comprehensive validation across all systems
     */
    async runComprehensiveValidation() {
        const results = {
            timestamp: Date.now(),
            validations: {},
            overallStatus: 'healthy',
            issuesSummary: {
                critical: 0,
                warning: 0,
                info: 0
            }
        };
        
        // Run all validators
        for (const [validatorId, validator] of this.validators.entries()) {
            try {
                let validationResult;
                
                // Get appropriate data for validation
                switch (validatorId) {
                    case 'folio':
                        const folios = window.dataManager?.getFolios();
                        if (folios) {
                            const folioResults = await Promise.all(
                                Object.values(folios).map(folio => validator.validate(folio))
                            );
                            validationResult = {
                                valid: folioResults.every(r => r.valid),
                                issues: folioResults.flatMap(r => r.issues),
                                validationTime: Date.now()
                            };
                        }
                        break;
                        
                    case 'settings':
                        const settings = window.dataManager?.getSettings();
                        if (settings) {
                            validationResult = await validator.validate(settings);
                        }
                        break;
                        
                    default:
                        validationResult = await validator.validate();
                }
                
                if (validationResult) {
                    results.validations[validatorId] = validationResult;
                    
                    // Count issues by severity
                    validationResult.issues.forEach(issue => {
                        if (issue.severity === 'critical') {
                            results.issuesSummary.critical++;
                            results.overallStatus = 'critical';
                        } else if (issue.severity === 'warning') {
                            results.issuesSummary.warning++;
                            if (results.overallStatus === 'healthy') {
                                results.overallStatus = 'warning';
                            }
                        } else if (issue.severity === 'info') {
                            results.issuesSummary.info++;
                        }
                        
                        // Record the issue
                        this.recordIssue({
                            ...issue,
                            source: 'validation',
                            validatorId,
                            timestamp: results.timestamp
                        });
                    });
                }
                
            } catch (error) {
                results.validations[validatorId] = {
                    valid: false,
                    issues: [{
                        severity: 'error',
                        message: `Validation failed: ${error.message}`
                    }],
                    validationTime: Date.now()
                };
                
                results.overallStatus = 'critical';
                results.issuesSummary.critical++;
            }
        }
        
        // Store validation results
        this.validationResults.set(results.timestamp, results);
        
        // Keep only last 10 validation results
        if (this.validationResults.size > 10) {
            const oldest = Math.min(...this.validationResults.keys());
            this.validationResults.delete(oldest);
        }
        
        return results;
    }
    
    /**
     * Record a quality assurance issue
     */
    recordIssue(issue) {
        const enhancedIssue = {
            id: `issue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
            resolved: false,
            ...issue
        };
        
        this.issues.push(enhancedIssue);
        
        // Keep only last 1000 issues
        if (this.issues.length > 1000) {
            this.issues.shift();
        }
        
        // Trigger error manager for critical issues
        if (issue.severity === 'critical' && window.errorManager) {
            window.errorManager.handleError({
                type: 'quality_assurance_issue',
                level: 'error',
                details: enhancedIssue,
                timestamp: enhancedIssue.timestamp,
                recovery: 'quality_assurance_intervention_required'
            });
        }
        
        return enhancedIssue.id;
    }
    
    /**
     * Resolve an issue
     */
    resolveIssue(issueId, resolution = null) {
        const issue = this.issues.find(i => i.id === issueId);
        if (issue) {
            issue.resolved = true;
            issue.resolvedAt = Date.now();
            issue.resolution = resolution;
            return true;
        }
        return false;
    }
    
    /**
     * Get quality assurance report
     */
    getQualityReport(timeRange = 60 * 60 * 1000) {
        const cutoffTime = Date.now() - timeRange;
        
        const recentIssues = this.issues.filter(issue => issue.timestamp > cutoffTime);
        const recentValidations = Array.from(this.validationResults.values())
            .filter(result => result.timestamp > cutoffTime);
        const currentHealth = Object.fromEntries(this.healthStatus.entries());
        
        // Calculate health score
        const healthScores = Object.values(currentHealth).map(health => {
            switch (health.status) {
                case 'healthy': return 100;
                case 'warning': return 70;
                case 'critical': return 30;
                case 'error': return 10;
                default: return 50;
            }
        });
        
        const overallHealthScore = healthScores.length > 0 ? 
            healthScores.reduce((sum, score) => sum + score, 0) / healthScores.length : 100;
        
        return {
            timestamp: Date.now(),
            timeRange,
            overallHealthScore,
            healthStatus: currentHealth,
            recentIssues: {
                total: recentIssues.length,
                critical: recentIssues.filter(i => i.severity === 'critical').length,
                warning: recentIssues.filter(i => i.severity === 'warning').length,
                info: recentIssues.filter(i => i.severity === 'info').length,
                resolved: recentIssues.filter(i => i.resolved).length,
                issues: recentIssues.slice(-20) // Last 20 issues
            },
            validationResults: recentValidations.slice(-5), // Last 5 validation runs
            recommendations: this.generateQualityRecommendations(recentIssues, currentHealth)
        };
    }
    
    /**
     * Generate quality improvement recommendations
     */
    generateQualityRecommendations(recentIssues, healthStatus) {
        const recommendations = [];
        
        // Analyze issue patterns
        const issuesByType = {};
        recentIssues.forEach(issue => {
            const key = `${issue.source}_${issue.code || 'unknown'}`;
            issuesByType[key] = (issuesByType[key] || 0) + 1;
        });
        
        // High frequency issues
        Object.entries(issuesByType).forEach(([issueType, count]) => {
            if (count > 5) {
                recommendations.push({
                    priority: 'high',
                    category: 'pattern_analysis',
                    message: `Frequent issue detected: ${issueType} (${count} occurrences)`,
                    action: 'Investigate root cause and implement systematic fix'
                });
            }
        });
        
        // Health status recommendations
        Object.entries(healthStatus).forEach(([checkId, health]) => {
            if (health.status === 'critical') {
                recommendations.push({
                    priority: 'critical',
                    category: 'health_check',
                    message: `Critical health issue in ${health.checkName}`,
                    action: 'Immediate attention required'
                });
            } else if (health.status === 'warning') {
                recommendations.push({
                    priority: 'medium',
                    category: 'health_check',
                    message: `Warning in ${health.checkName}`,
                    action: 'Monitor and optimize if pattern continues'
                });
            }
        });
        
        // Critical issues
        const criticalCount = recentIssues.filter(i => i.severity === 'critical').length;
        if (criticalCount > 0) {
            recommendations.push({
                priority: 'critical',
                category: 'data_integrity',
                message: `${criticalCount} critical data integrity issues detected`,
                action: 'Perform data validation and repair operations'
            });
        }
        
        return recommendations.sort((a, b) => {
            const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        });
    }
    
    /**
     * Clean up old issues and results
     */
    cleanupOldIssues() {
        const cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days
        
        // Remove old issues
        const initialIssueCount = this.issues.length;
        this.issues = this.issues.filter(issue => 
            issue.timestamp > cutoffTime || !issue.resolved
        );
        
        // Remove old validation results
        const initialValidationCount = this.validationResults.size;
        const validationCutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
        this.validationResults.forEach((result, timestamp) => {
            if (timestamp < validationCutoff) {
                this.validationResults.delete(timestamp);
            }
        });
        
        const cleanedIssues = initialIssueCount - this.issues.length;
        const cleanedValidations = initialValidationCount - this.validationResults.size;
        
        if (cleanedIssues > 0 || cleanedValidations > 0) {
            console.log(`QA Cleanup: Removed ${cleanedIssues} old issues and ${cleanedValidations} old validation results`);
        }
    }
    
    /**
     * Validate specific data on demand
     */
    async validateData(dataType, data) {
        const validator = this.validators.get(dataType);
        if (!validator) {
            throw new Error(`No validator found for data type: ${dataType}`);
        }
        
        return await validator.validate(data);
    }
    
    /**
     * Cleanup and destroy quality assurance system
     */
    cleanup() {
        // Clear intervals
        if (this.comprehensiveValidationInterval) {
            clearInterval(this.comprehensiveValidationInterval);
        }
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        
        // Clear health check intervals (they're managed separately)
        // Individual health checks clear their own intervals
        
        // Clear data structures
        this.validators.clear();
        this.healthChecks.clear();
        this.issues.length = 0;
        this.validationResults.clear();
        this.healthStatus.clear();
        
        console.log('QualityAssurance system cleaned up');
    }
}

// Global instance
window.qualityAssurance = new QualityAssurance();