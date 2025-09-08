// Branestawm - Data Manager
// Centralized data operations with consistent patterns, validation, and error handling

class DataManager {
    constructor() {
        if (DataManager.instance) {
            return DataManager.instance;
        }
        
        this.initializeState();
        this.setupEventListeners();
        DataManager.instance = this;
        
        console.log('DataManager initialized');
    }
    
    /**
     * Initialize default state structure
     */
    initializeState() {
        this.defaultState = {
            settings: {
                // New LLM selection system
                activeLlm: 'local',
                airplaneMode: false,
                
                // Legacy settings (for backward compatibility)
                authMethod: null,
                googleToken: null,
                apiEndpoint: 'https://api.cerebras.ai/v1/chat/completions',
                apiKey: '',
                model: 'llama3.1-8b',
                
                // Custom endpoints structure
                customEndpoints: {},
                
                // User personalization
                userName: '',
                
                systemPrompt: 'You are Branestawm, an indispensable AI Chief of Staff designed to provide cognitive support for neurodivergent users. Always break down complex tasks into clear, manageable steps. Provide patient, structured guidance. Use numbered lists and clear headings to organize information. Focus on being helpful, supportive, and understanding of executive function challenges.',
                showTooltips: true,
                webSearchEnabled: true,
                syncKey: '',
                syncId: '',
                jsonbinApiKey: '',
                usePrivateBins: false,
                autoSync: false,
                
                // Glooper Design System settings
                colorScheme: 'professional',
                themeMode: 'dark',
                fontSize: 'standard',
                reducedMotion: false,
                highContrast: false,
                
                // Persona system
                personas: {
                    'core': {
                        id: 'core',
                        name: 'Core',
                        identity: 'Helpful AI assistant and cognitive support specialist',
                        communicationStyle: 'Clear, structured, and supportive',
                        tone: 'Professional yet approachable',
                        roleContext: 'General assistance, task breakdown, executive function support',
                        isDefault: true,
                        createdAt: new Date().toISOString()
                    }
                },
                
                // Pinned folios
                pinnedFolios: []
            },
            
            folios: {
                'general': {
                    id: 'general',
                    title: 'General Folio',
                    description: 'General purpose folio for continuous dialogue',
                    guidelines: '',
                    assignedPersona: 'core',
                    messages: [],
                    artifacts: [],
                    sharedArtifacts: [],
                    createdAt: new Date().toISOString(),
                    lastUsed: new Date().toISOString()
                }
            },
            
            conversations: {},
            artifacts: {},
            artifactTemplates: {
                'note': { name: 'General Note', icon: '📝', description: 'Simple markdown note' },
                'summary': { name: 'Summary Document', icon: '📋', description: 'AI-generated summary from conversation' },
                'plan': { name: 'Project Plan', icon: '📈', description: 'Structured project or task plan' },
                'research': { name: 'Research Document', icon: '🔬', description: 'Research findings and analysis' },
                'meeting': { name: 'Meeting Notes', icon: '👥', description: 'Meeting agenda, notes, and action items' },
                'report': { name: 'Report', icon: '📊', description: 'Formal report or analysis' },
                'template': { name: 'Custom Template', icon: '📄', description: 'Reusable document template' }
            },
            
            currentFolio: 'general',
            recentFolios: ['general'],
            recentConversations: [],
            
            // Task management system
            tasks: {
                items: {},  // Will be converted to Map at runtime
                timeline: {
                    overdue: [],    // Will be converted to Set at runtime  
                    today: [],
                    tomorrow: [],
                    thisWeek: [],
                    future: [],
                    someday: []
                },
                lastUpdated: new Date().toISOString()
            }
        };
        
        // Current state - will be populated from storage
        this.state = {};
        
        // Transaction queue for atomic operations
        this.transactionQueue = [];
        this.isProcessingTransaction = false;
    }
    
    /**
     * Setup event listeners for data changes
     */
    setupEventListeners() {
        // Listen for storage changes from other instances
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.onChanged.addListener((changes, namespace) => {
                if (namespace === 'local') {
                    this.handleStorageChange(changes);
                }
            });
        }
    }
    
    /**
     * Handle external storage changes
     */
    handleStorageChange(changes) {
        console.log('External storage change detected', changes);
        
        // Reload state if significant changes occurred
        if (changes.settings || changes.folios || changes.artifacts) {
            this.loadData().catch(error => {
                console.error('Error reloading data after external change:', error);
            });
        }
    }
    
    /**
     * Load all data from storage with proper error handling
     */
    async loadData() {
        try {
            console.log('DataManager: Loading data from storage...');
            
            const data = await this._getFromStorage([
                'settings', 'folios', 'conversations', 'artifacts', 'tasks',
                'currentFolio', 'recentFolios', 'recentConversations', 'artifactTemplates'
            ]);
            
            // Merge with defaults to ensure all properties exist
            this.state = this._mergeWithDefaults(data);
            
            // Convert task storage from plain objects to Maps/Sets
            if (this.state.tasks) {
                this.state.tasks = this._deserializeTasks(this.state.tasks);
            }
            
            // Run data migrations if needed
            await this._runMigrations();
            
            // Validate data integrity
            this._validateDataIntegrity();
            
            console.log('DataManager: Data loaded successfully');
            return this.state;
            
        } catch (error) {
            console.error('DataManager: Error loading data:', error);
            
            // Use ErrorManager for structured error handling
            if (window.errorManager) {
                const recovery = window.errorManager.handleDataError('load', error, {
                    operation: 'loadData',
                    hasBackup: true
                });
                
                if (recovery.canUseBackup) {
                    console.log('DataManager: Using default state as backup');
                    this.state = JSON.parse(JSON.stringify(this.defaultState));
                    return this.state;
                }
            }
            
            // Fallback to default state
            this.state = JSON.parse(JSON.stringify(this.defaultState));
            throw new Error(`Data loading failed: ${error.message}`);
        }
    }
    
    /**
     * Save all data to storage with atomic transaction support
     */
    async saveData(options = {}) {
        if (options.transaction) {
            return this._queueTransaction('save', null, options);
        }
        
        try {
            console.log('DataManager: Saving data to storage...');
            
            // Validate data before saving
            this._validateDataIntegrity();
            
            await this._saveToStorage({
                settings: this.state.settings,
                folios: this.state.folios,
                conversations: this.state.conversations,
                artifacts: this.state.artifacts,
                artifactTemplates: this.state.artifactTemplates,
                tasks: this._serializeTasks(this.state.tasks),
                currentFolio: this.state.currentFolio,
                recentFolios: this.state.recentFolios,
                recentConversations: this.state.recentConversations
            });
            
            console.log('DataManager: Data saved successfully');
            return true;
            
        } catch (error) {
            console.error('DataManager: Error saving data:', error);
            
            // Use ErrorManager for structured error handling
            if (window.errorManager) {
                window.errorManager.handleDataError('save', error, {
                    operation: 'saveData',
                    dataSize: JSON.stringify(this.state).length
                });
            }
            
            throw new Error(`Data saving failed: ${error.message}`);
        }
    }
    
    /**
     * Get current state or specific part of state
     */
    getState(path = null) {
        if (!path) {
            return this.state;
        }
        
        return this._getNestedProperty(this.state, path);
    }
    
    /**
     * Get settings object
     */
    getSettings() {
        return this.state.settings;
    }
    
    /**
     * Get folios object
     */
    getFolios() {
        return this.state.folios;
    }
    
    /**
     * Update state with validation and change tracking
     */
    async updateState(path, value, options = {}) {
        if (options.transaction) {
            return this._queueTransaction('update', { path, value }, options);
        }
        
        try {
            // Validate the update
            this._validateUpdate(path, value);
            
            // Create backup for rollback
            const backup = JSON.parse(JSON.stringify(this.state));
            
            // Apply the update
            this._setNestedProperty(this.state, path, value);
            
            // Validate integrity after update
            try {
                this._validateDataIntegrity();
            } catch (validationError) {
                // Rollback on validation failure
                this.state = backup;
                throw new Error(`Update validation failed: ${validationError.message}`);
            }
            
            // Save if auto-save enabled
            if (options.autoSave !== false) {
                await this.saveData();
            }
            
            console.log(`DataManager: Updated ${path}:`, value);
            return true;
            
        } catch (error) {
            console.error('DataManager: Error updating state:', error);
            throw error;
        }
    }
    
    /**
     * Transaction support for atomic operations
     */
    async executeTransaction(operations) {
        if (this.isProcessingTransaction) {
            throw new Error('Transaction already in progress');
        }
        
        this.isProcessingTransaction = true;
        const backup = JSON.parse(JSON.stringify(this.state));
        
        try {
            // Execute all operations
            for (const operation of operations) {
                if (operation.type === 'update') {
                    this._setNestedProperty(this.state, operation.path, operation.value);
                } else if (operation.type === 'delete') {
                    this._deleteNestedProperty(this.state, operation.path);
                }
            }
            
            // Validate integrity
            this._validateDataIntegrity();
            
            // Save all changes
            await this.saveData({ transaction: false });
            
            console.log('DataManager: Transaction completed successfully');
            return true;
            
        } catch (error) {
            // Rollback all changes
            this.state = backup;
            console.error('DataManager: Transaction failed, rolled back:', error);
            throw error;
            
        } finally {
            this.isProcessingTransaction = false;
        }
    }
    
    /**
     * Task storage serialization methods
     */
    _serializeTasks(tasks) {
        if (!tasks) return null;
        
        const serialized = {
            items: {},
            timeline: {},
            lastUpdated: tasks.lastUpdated
        };
        
        // Convert Map to plain object
        if (tasks.items instanceof Map) {
            for (const [key, value] of tasks.items) {
                serialized.items[key] = value;
            }
        } else {
            serialized.items = tasks.items || {};
        }
        
        // Convert Sets to arrays
        if (tasks.timeline) {
            for (const [category, items] of Object.entries(tasks.timeline)) {
                if (items instanceof Set) {
                    serialized.timeline[category] = Array.from(items);
                } else {
                    serialized.timeline[category] = Array.isArray(items) ? items : [];
                }
            }
        }
        
        return serialized;
    }
    
    _deserializeTasks(tasks) {
        if (!tasks) {
            return {
                items: new Map(),
                timeline: {
                    overdue: new Set(),
                    today: new Set(),
                    tomorrow: new Set(),
                    thisWeek: new Set(),
                    future: new Set(),
                    someday: new Set()
                },
                lastUpdated: new Date().toISOString()
            };
        }
        
        const deserialized = {
            lastUpdated: tasks.lastUpdated || new Date().toISOString()
        };
        
        // Convert plain object to Map
        deserialized.items = new Map();
        if (tasks.items && typeof tasks.items === 'object') {
            for (const [key, value] of Object.entries(tasks.items)) {
                deserialized.items.set(key, value);
            }
        }
        
        // Convert arrays to Sets
        deserialized.timeline = {};
        const categories = ['overdue', 'today', 'tomorrow', 'thisWeek', 'future', 'someday'];
        for (const category of categories) {
            const items = tasks.timeline?.[category];
            if (Array.isArray(items)) {
                deserialized.timeline[category] = new Set(items);
            } else {
                deserialized.timeline[category] = new Set();
            }
        }
        
        return deserialized;
    }
    
    /**
     * Data migration utilities
     */
    async _runMigrations() {
        const currentVersion = this.state.dataVersion || 1;
        console.log(`DataManager: Current data version: ${currentVersion}`);
        
        // Migration 1: Ensure personas exist
        if (!this.state.settings.personas) {
            console.log('DataManager: Running persona migration');
            this.state.settings.personas = this.defaultState.settings.personas;
        }
        
        // Migration 2: Migrate shared artifacts
        this._migrateSharedArtifacts();
        
        // Migration 3: Migrate persona names (remove "Persona" suffix)
        this._migratePersonaNames();
        
        // Update version
        this.state.dataVersion = 2;
    }
    
    /**
     * Data validation
     */
    _validateDataIntegrity() {
        // Validate required properties exist
        const requiredPaths = [
            'settings',
            'folios', 
            'artifacts',
            'currentFolio',
            'recentFolios'
        ];
        
        for (const path of requiredPaths) {
            if (this._getNestedProperty(this.state, path) === undefined) {
                throw new Error(`Required property missing: ${path}`);
            }
        }
        
        // Validate current folio exists
        if (!this.state.folios[this.state.currentFolio]) {
            console.warn('DataManager: Current folio not found, resetting to general');
            this.state.currentFolio = 'general';
        }
        
        // Validate folio structure
        for (const [folioId, folio] of Object.entries(this.state.folios)) {
            if (!folio.id || !folio.title || !Array.isArray(folio.messages)) {
                throw new Error(`Invalid folio structure: ${folioId}`);
            }
        }
    }
    
    /**
     * Validate individual updates
     */
    _validateUpdate(path, value) {
        // Validate folio updates
        if (path.startsWith('folios.')) {
            const pathParts = path.split('.');
            if (pathParts.length >= 3 && pathParts[2] === 'messages') {
                if (!Array.isArray(value)) {
                    throw new Error('Folio messages must be an array');
                }
            }
        }
        
        // Validate settings updates
        if (path.startsWith('settings.')) {
            // Add specific settings validation here
        }
    }
    
    /**
     * Storage abstraction methods
     */
    async _getFromStorage(keys) {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            return new Promise((resolve, reject) => {
                chrome.storage.local.get(keys, (result) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        resolve(result);
                    }
                });
            });
        } else {
            // Fallback to localStorage for testing
            const result = {};
            for (const key of keys) {
                const stored = localStorage.getItem(key);
                if (stored) {
                    result[key] = JSON.parse(stored);
                }
            }
            return result;
        }
    }
    
    async _saveToStorage(data) {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            return new Promise((resolve, reject) => {
                chrome.storage.local.set(data, () => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        resolve();
                    }
                });
            });
        } else {
            // Fallback to localStorage for testing
            for (const [key, value] of Object.entries(data)) {
                localStorage.setItem(key, JSON.stringify(value));
            }
        }
    }
    
    /**
     * Utility methods
     */
    _mergeWithDefaults(loadedData) {
        const merged = JSON.parse(JSON.stringify(this.defaultState));
        
        // Deep merge loaded data with defaults
        for (const [key, value] of Object.entries(loadedData)) {
            if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
                merged[key] = { ...merged[key], ...value };
            } else if (value !== undefined) {
                merged[key] = value;
            }
        }
        
        return merged;
    }
    
    _getNestedProperty(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }
    
    _setNestedProperty(obj, path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((current, key) => {
            if (!current[key]) current[key] = {};
            return current[key];
        }, obj);
        target[lastKey] = value;
    }
    
    _deleteNestedProperty(obj, path) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((current, key) => current?.[key], obj);
        if (target) {
            delete target[lastKey];
        }
    }
    
    _queueTransaction(type, operation, options) {
        return new Promise((resolve, reject) => {
            this.transactionQueue.push({
                type,
                operation,
                options,
                resolve,
                reject
            });
            
            if (!this.isProcessingTransaction) {
                this._processTransactionQueue();
            }
        });
    }
    
    async _processTransactionQueue() {
        if (this.transactionQueue.length === 0) return;
        
        const batch = this.transactionQueue.splice(0);
        const operations = [];
        
        try {
            // Collect all operations
            for (const item of batch) {
                if (item.type === 'update') {
                    operations.push({
                        type: 'update',
                        path: item.operation.path,
                        value: item.operation.value
                    });
                } else if (item.type === 'save') {
                    // Save operations don't need to be collected
                }
            }
            
            // Execute transaction if we have operations
            if (operations.length > 0) {
                await this.executeTransaction(operations);
            } else {
                // Just save if only save operations
                await this.saveData({ transaction: false });
            }
            
            // Resolve all promises
            batch.forEach(item => item.resolve(true));
            
        } catch (error) {
            // Reject all promises
            batch.forEach(item => item.reject(error));
        }
    }
    
    /**
     * Legacy migration methods
     */
    _migrateSharedArtifacts() {
        // Ensure all folios have sharedArtifacts array
        Object.keys(this.state.folios).forEach(folioId => {
            if (!this.state.folios[folioId].sharedArtifacts) {
                this.state.folios[folioId].sharedArtifacts = [];
            }
        });
        
        // Find all shared artifacts and ensure they're in all folios' shared lists
        Object.values(this.state.artifacts).forEach(artifact => {
            if (artifact.shared) {
                Object.keys(this.state.folios).forEach(folioId => {
                    if (!this.state.folios[folioId].sharedArtifacts.includes(artifact.id)) {
                        this.state.folios[folioId].sharedArtifacts.push(artifact.id);
                    }
                });
            }
        });
    }
    
    _migratePersonaNames() {
        if (!this.state.settings.personas) return;
        
        let migrated = false;
        Object.values(this.state.settings.personas).forEach(persona => {
            if (persona.name && persona.name.endsWith(' Persona')) {
                const newName = persona.name.replace(/ Persona$/, '');
                console.log(`DataManager: Migrating persona name: "${persona.name}" → "${newName}"`);
                persona.name = newName;
                migrated = true;
            }
        });
        
        if (migrated) {
            console.log('DataManager: Persona names migration completed');
        }
    }
}

// Export as singleton
const dataManager = new DataManager();

// Make it available globally for backward compatibility
if (typeof window !== 'undefined') {
    window.dataManager = dataManager;
}

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = dataManager;
}