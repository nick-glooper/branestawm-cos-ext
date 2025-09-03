// Branestawm - Cache Manager
// Intelligent caching system with TTL, LRU eviction, and dependency tracking

class CacheManager {
    constructor() {
        if (CacheManager.instance) {
            return CacheManager.instance;
        }
        
        this.caches = new Map();
        this.cacheStats = new Map();
        this.dependencyGraph = new Map();
        this.cleanupInterval = null;
        
        this.initializeCaches();
        this.setupCleanupScheduler();
        
        CacheManager.instance = this;
        console.log('CacheManager initialized');
    }
    
    /**
     * Initialize different cache types with specific configurations
     */
    initializeCaches() {
        const cacheConfigs = {
            // LLM response cache - TTL: 1 hour, Max: 200 entries
            llm_responses: {
                maxSize: 200,
                ttl: 60 * 60 * 1000, // 1 hour
                evictionPolicy: 'lru',
                compressionEnabled: true
            },
            
            // Context generation cache - TTL: 30 minutes, Max: 100 entries
            context_generation: {
                maxSize: 100,
                ttl: 30 * 60 * 1000, // 30 minutes
                evictionPolicy: 'lru',
                compressionEnabled: true
            },
            
            // Summarization cache - TTL: 2 hours, Max: 150 entries
            summarization: {
                maxSize: 150,
                ttl: 2 * 60 * 60 * 1000, // 2 hours
                evictionPolicy: 'lru',
                compressionEnabled: true
            },
            
            // Search index cache - TTL: 1 hour, Max: 50 entries
            search_index: {
                maxSize: 50,
                ttl: 60 * 60 * 1000, // 1 hour
                evictionPolicy: 'lru',
                compressionEnabled: false // Search indices need full data
            },
            
            // Semantic analysis cache - TTL: 4 hours, Max: 300 entries
            semantic_analysis: {
                maxSize: 300,
                ttl: 4 * 60 * 60 * 1000, // 4 hours
                evictionPolicy: 'lru',
                compressionEnabled: true
            },
            
            // Performance metrics cache - TTL: 15 minutes, Max: 1000 entries
            performance_metrics: {
                maxSize: 1000,
                ttl: 15 * 60 * 1000, // 15 minutes
                evictionPolicy: 'fifo', // First In, First Out for metrics
                compressionEnabled: false
            }
        };
        
        for (const [cacheType, config] of Object.entries(cacheConfigs)) {
            this.createCache(cacheType, config);
        }
    }
    
    /**
     * Create a new cache with specified configuration
     */
    createCache(cacheType, config) {
        const cache = new Map();
        const accessOrder = []; // For LRU tracking
        const insertOrder = []; // For FIFO tracking
        
        this.caches.set(cacheType, {
            cache,
            config,
            accessOrder,
            insertOrder,
            stats: {
                hits: 0,
                misses: 0,
                sets: 0,
                evictions: 0,
                compressions: 0,
                totalSize: 0,
                lastCleanup: Date.now()
            }
        });
        
        this.cacheStats.set(cacheType, {
            hitRate: 0,
            averageSize: 0,
            compressionRatio: 0,
            lastAccessed: null
        });
    }
    
    /**
     * Store item in cache with dependency tracking
     */
    async set(cacheType, key, value, options = {}) {
        if (!this.caches.has(cacheType)) {
            console.warn(`Cache type ${cacheType} not found`);
            return false;
        }
        
        const cacheInfo = this.caches.get(cacheType);
        const { cache, config, accessOrder, insertOrder, stats } = cacheInfo;
        
        try {
            // Create cache entry
            const entry = {
                value: config.compressionEnabled ? await this.compressValue(value) : value,
                timestamp: Date.now(),
                ttl: options.ttl || config.ttl,
                dependencies: options.dependencies || [],
                metadata: {
                    originalSize: JSON.stringify(value).length,
                    compressed: config.compressionEnabled,
                    accessCount: 0,
                    lastAccessed: Date.now()
                }
            };
            
            // Check if we need to evict entries
            if (cache.size >= config.maxSize) {
                await this.evictEntries(cacheType, 1);
            }
            
            // Store entry
            cache.set(key, entry);
            
            // Update tracking arrays
            if (config.evictionPolicy === 'lru') {
                this.updateLRUOrder(accessOrder, key);
            } else if (config.evictionPolicy === 'fifo') {
                insertOrder.push(key);
            }
            
            // Track dependencies
            if (entry.dependencies.length > 0) {
                this.addDependencies(cacheType, key, entry.dependencies);
            }
            
            // Update stats
            stats.sets++;
            stats.totalSize += entry.metadata.originalSize;
            if (config.compressionEnabled) stats.compressions++;
            
            this.updateCacheStats(cacheType);
            return true;
            
        } catch (error) {
            console.error(`Error setting cache entry for ${cacheType}:${key}:`, error);
            return false;
        }
    }
    
    /**
     * Retrieve item from cache
     */
    async get(cacheType, key) {
        if (!this.caches.has(cacheType)) {
            return null;
        }
        
        const cacheInfo = this.caches.get(cacheType);
        const { cache, config, accessOrder, stats } = cacheInfo;
        
        const entry = cache.get(key);
        
        if (!entry) {
            stats.misses++;
            this.updateCacheStats(cacheType);
            return null;
        }
        
        // Check TTL
        if (Date.now() - entry.timestamp > entry.ttl) {
            cache.delete(key);
            this.removeDependencies(cacheType, key);
            stats.misses++;
            stats.evictions++;
            this.updateCacheStats(cacheType);
            return null;
        }
        
        // Update access tracking
        entry.metadata.accessCount++;
        entry.metadata.lastAccessed = Date.now();
        
        if (config.evictionPolicy === 'lru') {
            this.updateLRUOrder(accessOrder, key);
        }
        
        // Update stats
        stats.hits++;
        this.updateCacheStats(cacheType);
        
        // Decompress value if needed
        const value = entry.metadata.compressed ? 
            await this.decompressValue(entry.value) : entry.value;
        
        return value;
    }
    
    /**
     * Remove item from cache
     */
    delete(cacheType, key) {
        if (!this.caches.has(cacheType)) {
            return false;
        }
        
        const cacheInfo = this.caches.get(cacheType);
        const { cache, accessOrder, insertOrder } = cacheInfo;
        
        const deleted = cache.delete(key);
        
        if (deleted) {
            // Remove from tracking arrays
            const lruIndex = accessOrder.indexOf(key);
            if (lruIndex !== -1) accessOrder.splice(lruIndex, 1);
            
            const fifoIndex = insertOrder.indexOf(key);
            if (fifoIndex !== -1) insertOrder.splice(fifoIndex, 1);
            
            // Remove dependencies
            this.removeDependencies(cacheType, key);
            
            this.updateCacheStats(cacheType);
        }
        
        return deleted;
    }
    
    /**
     * Invalidate cache entries based on dependencies
     */
    invalidateDependencies(dependency) {
        if (!this.dependencyGraph.has(dependency)) {
            return;
        }
        
        const dependentEntries = this.dependencyGraph.get(dependency);
        let invalidatedCount = 0;
        
        dependentEntries.forEach(({ cacheType, key }) => {
            if (this.delete(cacheType, key)) {
                invalidatedCount++;
            }
        });
        
        // Remove the dependency entry
        this.dependencyGraph.delete(dependency);
        
        console.log(`Invalidated ${invalidatedCount} cache entries for dependency: ${dependency}`);
        return invalidatedCount;
    }
    
    /**
     * Clear entire cache or specific cache type
     */
    clear(cacheType = null) {
        if (cacheType) {
            if (this.caches.has(cacheType)) {
                const cacheInfo = this.caches.get(cacheType);
                cacheInfo.cache.clear();
                cacheInfo.accessOrder.length = 0;
                cacheInfo.insertOrder.length = 0;
                
                // Reset stats
                cacheInfo.stats = {
                    hits: 0,
                    misses: 0,
                    sets: 0,
                    evictions: 0,
                    compressions: 0,
                    totalSize: 0,
                    lastCleanup: Date.now()
                };
                
                this.updateCacheStats(cacheType);
            }
        } else {
            // Clear all caches
            this.caches.forEach((_, type) => this.clear(type));
            this.dependencyGraph.clear();
        }
    }
    
    /**
     * Evict entries based on configured eviction policy
     */
    async evictEntries(cacheType, count = 1) {
        const cacheInfo = this.caches.get(cacheType);
        if (!cacheInfo) return;
        
        const { cache, config, accessOrder, insertOrder, stats } = cacheInfo;
        
        let evicted = 0;
        
        for (let i = 0; i < count && cache.size > 0; i++) {
            let keyToEvict;
            
            if (config.evictionPolicy === 'lru') {
                // Evict least recently used
                keyToEvict = accessOrder[0];
                if (keyToEvict) accessOrder.shift();
            } else if (config.evictionPolicy === 'fifo') {
                // Evict first inserted
                keyToEvict = insertOrder[0];
                if (keyToEvict) insertOrder.shift();
            }
            
            if (keyToEvict && cache.has(keyToEvict)) {
                cache.delete(keyToEvict);
                this.removeDependencies(cacheType, keyToEvict);
                evicted++;
                stats.evictions++;
            }
        }
        
        if (evicted > 0) {
            this.updateCacheStats(cacheType);
        }
        
        return evicted;
    }
    
    /**
     * Compress value for storage
     */
    async compressValue(value) {
        try {
            // Simple compression simulation - in real implementation would use proper compression
            const jsonString = JSON.stringify(value);
            
            // Simulate compression by removing unnecessary whitespace and shortening strings
            const compressed = jsonString
                .replace(/\s+/g, ' ')
                .replace(/: "/g, ':"')
                .replace(/", "/g, '","');
            
            return {
                compressed: true,
                data: compressed,
                originalSize: jsonString.length,
                compressedSize: compressed.length,
                compressionRatio: compressed.length / jsonString.length
            };
        } catch (error) {
            console.error('Compression error:', error);
            return value; // Return original on error
        }
    }
    
    /**
     * Decompress value from storage
     */
    async decompressValue(compressedValue) {
        try {
            if (compressedValue.compressed) {
                return JSON.parse(compressedValue.data);
            }
            return compressedValue;
        } catch (error) {
            console.error('Decompression error:', error);
            return compressedValue; // Return as-is on error
        }
    }
    
    /**
     * Update LRU access order
     */
    updateLRUOrder(accessOrder, key) {
        const index = accessOrder.indexOf(key);
        if (index !== -1) {
            accessOrder.splice(index, 1);
        }
        accessOrder.push(key);
    }
    
    /**
     * Add dependency relationships
     */
    addDependencies(cacheType, key, dependencies) {
        dependencies.forEach(dependency => {
            if (!this.dependencyGraph.has(dependency)) {
                this.dependencyGraph.set(dependency, []);
            }
            
            this.dependencyGraph.get(dependency).push({ cacheType, key });
        });
    }
    
    /**
     * Remove dependency relationships
     */
    removeDependencies(cacheType, key) {
        this.dependencyGraph.forEach((dependents, dependency) => {
            const filtered = dependents.filter(d => 
                !(d.cacheType === cacheType && d.key === key)
            );
            
            if (filtered.length === 0) {
                this.dependencyGraph.delete(dependency);
            } else {
                this.dependencyGraph.set(dependency, filtered);
            }
        });
    }
    
    /**
     * Update cache statistics
     */
    updateCacheStats(cacheType) {
        const cacheInfo = this.caches.get(cacheType);
        if (!cacheInfo) return;
        
        const { stats } = cacheInfo;
        const totalRequests = stats.hits + stats.misses;
        
        this.cacheStats.set(cacheType, {
            hitRate: totalRequests > 0 ? stats.hits / totalRequests : 0,
            averageSize: stats.sets > 0 ? stats.totalSize / stats.sets : 0,
            compressionRatio: stats.compressions > 0 ? 
                stats.compressions / stats.sets : 0,
            lastAccessed: Date.now()
        });
    }
    
    /**
     * Setup automatic cleanup scheduler
     */
    setupCleanupScheduler() {
        // Run cleanup every 5 minutes
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpiredEntries();
        }, 5 * 60 * 1000);
    }
    
    /**
     * Clean up expired entries across all caches
     */
    cleanupExpiredEntries() {
        let totalCleaned = 0;
        const now = Date.now();
        
        this.caches.forEach((cacheInfo, cacheType) => {
            const { cache, accessOrder, insertOrder, stats } = cacheInfo;
            const keysToDelete = [];
            
            cache.forEach((entry, key) => {
                if (now - entry.timestamp > entry.ttl) {
                    keysToDelete.push(key);
                }
            });
            
            keysToDelete.forEach(key => {
                cache.delete(key);
                
                // Remove from tracking arrays
                const lruIndex = accessOrder.indexOf(key);
                if (lruIndex !== -1) accessOrder.splice(lruIndex, 1);
                
                const fifoIndex = insertOrder.indexOf(key);
                if (fifoIndex !== -1) insertOrder.splice(fifoIndex, 1);
                
                // Remove dependencies
                this.removeDependencies(cacheType, key);
                
                stats.evictions++;
                totalCleaned++;
            });
            
            if (keysToDelete.length > 0) {
                stats.lastCleanup = now;
                this.updateCacheStats(cacheType);
            }
        });
        
        if (totalCleaned > 0) {
            console.log(`Cache cleanup completed: removed ${totalCleaned} expired entries`);
        }
    }
    
    /**
     * Get comprehensive cache statistics
     */
    getStatistics() {
        const stats = {};
        
        this.caches.forEach((cacheInfo, cacheType) => {
            const { cache, stats: cacheStats } = cacheInfo;
            const derived = this.cacheStats.get(cacheType);
            
            stats[cacheType] = {
                size: cache.size,
                maxSize: cacheInfo.config.maxSize,
                utilizationRate: cache.size / cacheInfo.config.maxSize,
                hits: cacheStats.hits,
                misses: cacheStats.misses,
                sets: cacheStats.sets,
                evictions: cacheStats.evictions,
                compressions: cacheStats.compressions,
                hitRate: derived.hitRate,
                averageSize: derived.averageSize,
                compressionRatio: derived.compressionRatio,
                lastAccessed: derived.lastAccessed,
                lastCleanup: cacheStats.lastCleanup
            };
        });
        
        // Overall statistics
        const totalSize = Object.values(stats).reduce((sum, s) => sum + s.size, 0);
        const totalHits = Object.values(stats).reduce((sum, s) => sum + s.hits, 0);
        const totalMisses = Object.values(stats).reduce((sum, s) => sum + s.misses, 0);
        const totalRequests = totalHits + totalMisses;
        
        return {
            overall: {
                totalCaches: this.caches.size,
                totalEntries: totalSize,
                totalDependencies: this.dependencyGraph.size,
                overallHitRate: totalRequests > 0 ? totalHits / totalRequests : 0,
                memoryUsage: this.estimateMemoryUsage()
            },
            caches: stats
        };
    }
    
    /**
     * Estimate memory usage
     */
    estimateMemoryUsage() {
        let totalBytes = 0;
        
        this.caches.forEach(cacheInfo => {
            cacheInfo.cache.forEach(entry => {
                // Rough estimation
                const valueSize = entry.metadata.compressed ? 
                    entry.value.compressedSize : entry.metadata.originalSize;
                totalBytes += valueSize + 200; // Add overhead for metadata
            });
        });
        
        return {
            bytes: totalBytes,
            kb: Math.round(totalBytes / 1024),
            mb: Math.round(totalBytes / (1024 * 1024))
        };
    }
    
    /**
     * Create cache key from parameters
     */
    createKey(...parts) {
        return parts.filter(p => p !== null && p !== undefined).join('::');
    }
    
    /**
     * Bulk operations for better performance
     */
    async setBulk(cacheType, entries) {
        const results = [];
        
        for (const { key, value, options } of entries) {
            const success = await this.set(cacheType, key, value, options);
            results.push({ key, success });
        }
        
        return results;
    }
    
    async getBulk(cacheType, keys) {
        const results = {};
        
        for (const key of keys) {
            results[key] = await this.get(cacheType, key);
        }
        
        return results;
    }
    
    /**
     * Export cache for backup/analysis
     */
    exportCache(cacheType) {
        if (!this.caches.has(cacheType)) return null;
        
        const cacheInfo = this.caches.get(cacheType);
        const exported = {
            type: cacheType,
            config: cacheInfo.config,
            entries: [],
            stats: cacheInfo.stats,
            exportedAt: Date.now()
        };
        
        cacheInfo.cache.forEach((entry, key) => {
            exported.entries.push({
                key,
                ...entry,
                // Don't export actual compressed data for privacy
                hasData: true
            });
        });
        
        return exported;
    }
    
    /**
     * Cleanup and destroy cache manager
     */
    cleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        
        this.clear(); // Clear all caches
        this.caches.clear();
        this.cacheStats.clear();
        this.dependencyGraph.clear();
        
        console.log('CacheManager cleaned up');
    }
}

// Global instance
window.cacheManager = new CacheManager();