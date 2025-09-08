// Branestawm - Logging System
// Centralized logging with levels and configuration

class Logger {
    constructor() {
        this.logLevel = this.getLogLevel();
        this.isProduction = this.isProductionEnvironment();
        
        // Log levels (higher numbers = more verbose)
        this.levels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3
        };
        
        // Only show performance logs in development
        this.enablePerformanceLogs = !this.isProduction;
        
        this.init();
    }
    
    /**
     * Initialize logger
     */
    init() {
        // Don't log in production unless specifically enabled
        if (this.isProduction && this.logLevel < this.levels.error) {
            this.logLevel = -1; // Disable all logging
        }
        
        this.info('Logger initialized', { 
            level: this.logLevel, 
            production: this.isProduction,
            performance: this.enablePerformanceLogs 
        });
    }
    
    /**
     * Get current log level from settings or default
     */
    getLogLevel() {
        try {
            // Check if we're in development mode
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest) {
                const manifest = chrome.runtime.getManifest();
                if (manifest.version.includes('dev') || manifest.name.includes('dev')) {
                    return this.levels.debug;
                }
            }
            
            // Check localStorage for user preference
            const savedLevel = localStorage.getItem('branestawm_log_level');
            if (savedLevel && this.levels.hasOwnProperty(savedLevel)) {
                return this.levels[savedLevel];
            }
            
            // Default to info level
            return this.levels.info;
        } catch (error) {
            return this.levels.info;
        }
    }
    
    /**
     * Check if we're in production environment
     */
    isProductionEnvironment() {
        try {
            // Check for extension context
            if (typeof chrome !== 'undefined' && chrome.runtime) {
                const url = chrome.runtime.getURL('');
                return !url.includes('unpacked');
            }
            
            // Check for localhost or development indicators
            if (typeof window !== 'undefined') {
                return !window.location.hostname.includes('localhost') && 
                       !window.location.hostname.includes('127.0.0.1') &&
                       !window.location.protocol.includes('chrome-extension');
            }
            
            return true;
        } catch (error) {
            return true; // Default to production mode for safety
        }
    }
    
    /**
     * Log error message
     */
    error(message, data = null) {
        if (this.shouldLog('error')) {
            this.log('error', message, data);
        }
    }
    
    /**
     * Log warning message
     */
    warn(message, data = null) {
        if (this.shouldLog('warn')) {
            this.log('warn', message, data);
        }
    }
    
    /**
     * Log info message
     */
    info(message, data = null) {
        if (this.shouldLog('info')) {
            this.log('info', message, data);
        }
    }
    
    /**
     * Log debug message
     */
    debug(message, data = null) {
        if (this.shouldLog('debug')) {
            this.log('debug', message, data);
        }
    }
    
    /**
     * Log performance metric
     */
    performance(operation, duration, data = null) {
        if (this.enablePerformanceLogs && this.shouldLog('debug')) {
            this.log('perf', `${operation}: ${duration}ms`, data);
        }
    }
    
    /**
     * Time an operation
     */
    time(label) {
        if (this.enablePerformanceLogs) {
            console.time(`[Branestawm] ${label}`);
        }
    }
    
    /**
     * End timing an operation
     */
    timeEnd(label) {
        if (this.enablePerformanceLogs) {
            console.timeEnd(`[Branestawm] ${label}`);
        }
    }
    
    /**
     * Check if we should log at this level
     */
    shouldLog(level) {
        if (this.logLevel < 0) return false; // Logging disabled
        return this.levels[level] <= this.logLevel;
    }
    
    /**
     * Internal log method
     */
    log(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const prefix = `[Branestawm:${level.toUpperCase()}] ${timestamp}:`;
        
        // Choose appropriate console method
        const consoleMethod = this.getConsoleMethod(level);
        
        if (data) {
            consoleMethod(prefix, message, data);
        } else {
            consoleMethod(prefix, message);
        }
        
        // Store critical errors for debugging
        if (level === 'error') {
            this.storeError(message, data);
        }
    }
    
    /**
     * Get appropriate console method for log level
     */
    getConsoleMethod(level) {
        switch (level) {
            case 'error': return console.error.bind(console);
            case 'warn': return console.warn.bind(console);
            case 'perf': return console.debug.bind(console);
            case 'debug': return console.debug.bind(console);
            default: return console.log.bind(console);
        }
    }
    
    /**
     * Store error for debugging
     */
    storeError(message, data) {
        try {
            const errorLog = {
                timestamp: new Date().toISOString(),
                message,
                data,
                userAgent: navigator.userAgent,
                url: window.location ? window.location.href : 'unknown'
            };
            
            // Store in localStorage for debugging (keep only last 10 errors)
            const errors = JSON.parse(localStorage.getItem('branestawm_errors') || '[]');
            errors.push(errorLog);
            
            if (errors.length > 10) {
                errors.shift(); // Remove oldest error
            }
            
            localStorage.setItem('branestawm_errors', JSON.stringify(errors));
        } catch (error) {
            // Fail silently if we can't store the error
        }
    }
    
    /**
     * Get stored errors for debugging
     */
    getStoredErrors() {
        try {
            return JSON.parse(localStorage.getItem('branestawm_errors') || '[]');
        } catch (error) {
            return [];
        }
    }
    
    /**
     * Clear stored errors
     */
    clearStoredErrors() {
        try {
            localStorage.removeItem('branestawm_errors');
            this.info('Stored errors cleared');
        } catch (error) {
            this.error('Failed to clear stored errors', error);
        }
    }
    
    /**
     * Set log level
     */
    setLogLevel(level) {
        if (this.levels.hasOwnProperty(level)) {
            this.logLevel = this.levels[level];
            localStorage.setItem('branestawm_log_level', level);
            this.info(`Log level set to: ${level}`);
        } else {
            this.warn(`Invalid log level: ${level}. Valid levels: ${Object.keys(this.levels).join(', ')}`);
        }
    }
    
    /**
     * Get current configuration
     */
    getConfig() {
        return {
            logLevel: this.logLevel,
            logLevelName: Object.keys(this.levels).find(key => this.levels[key] === this.logLevel) || 'unknown',
            isProduction: this.isProduction,
            enablePerformanceLogs: this.enablePerformanceLogs,
            availableLevels: Object.keys(this.levels)
        };
    }
}

// Create global logger instance
const logger = new Logger();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = logger;
} else {
    window.logger = logger;
}