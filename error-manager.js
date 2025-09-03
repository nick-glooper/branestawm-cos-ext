// Branestawm - Error Manager
// Centralized error handling, reporting, and recovery system

class ErrorManager {
    constructor() {
        if (ErrorManager.instance) {
            return ErrorManager.instance;
        }
        
        this.initializeErrorTracking();
        this.setupGlobalErrorHandlers();
        ErrorManager.instance = this;
        
        console.log('ErrorManager initialized');
    }
    
    /**
     * Initialize error tracking and categorization
     */
    initializeErrorTracking() {
        this.errorLog = [];
        this.errorCounts = {
            dataManager: 0,
            api: 0,
            ui: 0,
            network: 0,
            validation: 0,
            unknown: 0
        };
        
        this.errorTypes = {
            DATA_LOAD_FAILED: 'dataManager',
            DATA_SAVE_FAILED: 'dataManager', 
            DATA_VALIDATION_FAILED: 'validation',
            API_REQUEST_FAILED: 'api',
            NETWORK_ERROR: 'network',
            UI_ELEMENT_NOT_FOUND: 'ui',
            STORAGE_QUOTA_EXCEEDED: 'dataManager',
            AUTHENTICATION_EXPIRED: 'api',
            UNKNOWN_ERROR: 'unknown'
        };
        
        this.maxLogSize = 100; // Keep last 100 errors
    }
    
    /**
     * Setup global error handlers
     */
    setupGlobalErrorHandlers() {
        // Global JavaScript errors
        window.addEventListener('error', (event) => {
            this.handleError({
                type: 'UNKNOWN_ERROR',
                message: event.message,
                source: event.filename,
                line: event.lineno,
                column: event.colno,
                stack: event.error?.stack
            });
        });
        
        // Unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.handleError({
                type: 'UNKNOWN_ERROR',
                message: 'Unhandled promise rejection: ' + event.reason,
                source: 'Promise',
                promise: true,
                stack: event.reason?.stack
            });
        });
    }
    
    /**
     * Main error handling method
     */
    handleError(errorInfo) {
        try {
            // Normalize error info
            const normalizedError = this._normalizeError(errorInfo);
            
            // Log the error
            this._logError(normalizedError);
            
            // Update error counts
            this._updateErrorCounts(normalizedError);
            
            // Attempt recovery if possible
            this._attemptRecovery(normalizedError);
            
            // Show user notification if appropriate
            this._showUserNotification(normalizedError);
            
            // Report to console for development
            this._reportToConsole(normalizedError);
            
        } catch (handlingError) {
            // Error in error handling - just log to console
            console.error('Error in error handling:', handlingError);
            console.error('Original error:', errorInfo);
        }
    }
    
    /**
     * Create structured error for specific scenarios
     */
    createError(type, details = {}) {
        const baseError = {
            type: type,
            timestamp: new Date().toISOString(),
            category: this.errorTypes[type] || 'unknown',
            id: this._generateErrorId(),
            ...details
        };
        
        return baseError;
    }
    
    /**
     * Handle data-related errors with recovery
     */
    handleDataError(operation, error, context = {}) {
        const errorInfo = this.createError('DATA_LOAD_FAILED', {
            operation: operation,
            message: error.message,
            stack: error.stack,
            context: context,
            recoverable: true
        });
        
        this.handleError(errorInfo);
        
        // Return recovery suggestions
        return this._getDataRecoveryOptions(operation, error);
    }
    
    /**
     * Handle API errors with retry logic
     */
    handleAPIError(endpoint, error, retryCount = 0) {
        const maxRetries = 3;
        const isRetryable = this._isRetryableError(error);
        
        const errorInfo = this.createError('API_REQUEST_FAILED', {
            endpoint: endpoint,
            message: error.message,
            status: error.status || 'unknown',
            retryCount: retryCount,
            retryable: isRetryable && retryCount < maxRetries,
            stack: error.stack
        });
        
        this.handleError(errorInfo);
        
        // Return retry recommendation
        return {
            shouldRetry: isRetryable && retryCount < maxRetries,
            retryDelay: Math.pow(2, retryCount) * 1000, // Exponential backoff
            finalAttempt: retryCount >= maxRetries
        };
    }
    
    /**
     * Handle validation errors
     */
    handleValidationError(field, value, rule, context = {}) {
        const errorInfo = this.createError('DATA_VALIDATION_FAILED', {
            field: field,
            value: typeof value === 'string' ? value.substring(0, 100) : String(value),
            rule: rule,
            context: context,
            recoverable: true
        });
        
        this.handleError(errorInfo);
        
        return this._getValidationGuidance(field, rule);
    }
    
    /**
     * Get error statistics
     */
    getErrorStats() {
        return {
            totalErrors: this.errorLog.length,
            categoryCounts: { ...this.errorCounts },
            recentErrors: this.errorLog.slice(-10),
            timeRange: {
                earliest: this.errorLog[0]?.timestamp,
                latest: this.errorLog[this.errorLog.length - 1]?.timestamp
            }
        };
    }
    
    /**
     * Clear error log (for testing or user request)
     */
    clearErrors() {
        this.errorLog = [];
        this.errorCounts = {
            dataManager: 0,
            api: 0,
            ui: 0,
            network: 0,
            validation: 0,
            unknown: 0
        };
        console.log('Error log cleared');
    }
    
    /**
     * Check if system is in error state
     */
    isSystemHealthy() {
        const recentErrors = this.errorLog.filter(error => {
            const errorTime = new Date(error.timestamp);
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            return errorTime > fiveMinutesAgo;
        });
        
        return {
            healthy: recentErrors.length < 5,
            recentErrorCount: recentErrors.length,
            criticalErrors: recentErrors.filter(e => e.critical).length
        };
    }
    
    /**
     * Private helper methods
     */
    _normalizeError(errorInfo) {
        if (errorInfo instanceof Error) {
            return {
                type: 'UNKNOWN_ERROR',
                message: errorInfo.message,
                stack: errorInfo.stack,
                timestamp: new Date().toISOString(),
                id: this._generateErrorId()
            };
        }
        
        return {
            timestamp: new Date().toISOString(),
            id: this._generateErrorId(),
            category: this.errorTypes[errorInfo.type] || 'unknown',
            ...errorInfo
        };
    }
    
    _logError(error) {
        this.errorLog.push(error);
        
        // Maintain log size limit
        if (this.errorLog.length > this.maxLogSize) {
            this.errorLog = this.errorLog.slice(-this.maxLogSize);
        }
    }
    
    _updateErrorCounts(error) {
        const category = error.category || 'unknown';
        if (this.errorCounts.hasOwnProperty(category)) {
            this.errorCounts[category]++;
        }
    }
    
    _attemptRecovery(error) {
        try {
            switch (error.type) {
                case 'DATA_LOAD_FAILED':
                    this._recoverDataLoad(error);
                    break;
                case 'UI_ELEMENT_NOT_FOUND':
                    this._recoverMissingElement(error);
                    break;
                case 'STORAGE_QUOTA_EXCEEDED':
                    this._recoverStorageQuota(error);
                    break;
                // Add more recovery strategies as needed
            }
        } catch (recoveryError) {
            console.warn('Recovery attempt failed:', recoveryError);
        }
    }
    
    _showUserNotification(error) {
        // Only show user notifications for certain error types
        const userVisibleTypes = [
            'API_REQUEST_FAILED',
            'NETWORK_ERROR', 
            'STORAGE_QUOTA_EXCEEDED',
            'AUTHENTICATION_EXPIRED'
        ];
        
        if (!userVisibleTypes.includes(error.type)) {
            return;
        }
        
        const userMessage = this._getUserFriendlyMessage(error);
        
        // Use existing message system if available
        if (typeof showMessage === 'function') {
            showMessage(userMessage, 'error');
        } else {
            console.error('User notification:', userMessage);
        }
    }
    
    _reportToConsole(error) {
        const logMethod = error.critical ? console.error : console.warn;
        logMethod(`[ErrorManager] ${error.type}:`, error);
    }
    
    _generateErrorId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }
    
    _isRetryableError(error) {
        const retryableStatuses = [500, 502, 503, 504];
        const retryableTypes = ['network', 'timeout'];
        
        return retryableStatuses.includes(error.status) ||
               retryableTypes.includes(error.type) ||
               error.message?.includes('timeout') ||
               error.message?.includes('network');
    }
    
    _getDataRecoveryOptions(operation, error) {
        return {
            canRetry: true,
            canUseBackup: operation === 'load',
            canReset: true,
            suggestions: [
                'Try refreshing the page',
                'Check your internet connection',
                'Clear browser cache if the problem persists'
            ]
        };
    }
    
    _getValidationGuidance(field, rule) {
        const guidance = {
            required: 'This field is required and cannot be empty',
            email: 'Please enter a valid email address',
            url: 'Please enter a valid URL starting with http:// or https://',
            minLength: 'The value is too short',
            maxLength: 'The value is too long',
            numeric: 'Please enter a valid number'
        };
        
        return guidance[rule] || 'Please check the value and try again';
    }
    
    _getUserFriendlyMessage(error) {
        const messages = {
            'API_REQUEST_FAILED': 'Unable to connect to the AI service. Please check your internet connection and try again.',
            'NETWORK_ERROR': 'Network connection issue. Please check your internet connection.',
            'STORAGE_QUOTA_EXCEEDED': 'Storage space is full. Please free up some space or contact support.',
            'AUTHENTICATION_EXPIRED': 'Your session has expired. Please sign in again.',
            'DATA_VALIDATION_FAILED': 'The information provided is not valid. Please check and try again.'
        };
        
        return messages[error.type] || 'An unexpected error occurred. Please try again.';
    }
    
    _recoverDataLoad(error) {
        console.log('Attempting data load recovery...');
        // Could trigger a data reload or fallback to cached data
    }
    
    _recoverMissingElement(error) {
        console.log('Attempting UI element recovery...');
        // Could trigger UI re-render or show fallback UI
    }
    
    _recoverStorageQuota(error) {
        console.log('Attempting storage quota recovery...');
        // Could trigger cleanup of old data
    }
}

// Create singleton instance
const errorManager = new ErrorManager();

// Global convenience functions
window.handleError = (error) => errorManager.handleError(error);
window.createError = (type, details) => errorManager.createError(type, details);

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = errorManager;
} else {
    window.errorManager = errorManager;
}