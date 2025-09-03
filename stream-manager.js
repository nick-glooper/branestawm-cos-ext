// Branestawm - Stream Manager
// Progressive loading and data streaming for large datasets

class StreamManager {
    constructor() {
        if (StreamManager.instance) {
            return StreamManager.instance;
        }
        
        this.streams = new Map();
        this.buffers = new Map();
        this.loaders = new Map();
        this.streamStats = new Map();
        
        this.initializeStreamTypes();
        this.setupStreamingOptimizations();
        
        StreamManager.instance = this;
        console.log('StreamManager initialized');
    }
    
    /**
     * Initialize different stream types and configurations
     */
    initializeStreamTypes() {
        this.streamConfigs = {
            // Large folio message streaming
            folio_messages: {
                chunkSize: 50, // Messages per chunk
                bufferSize: 200, // Messages to keep in memory
                preloadChunks: 2, // Number of chunks to preload
                sortField: 'timestamp',
                sortOrder: 'desc'
            },
            
            // Search result streaming
            search_results: {
                chunkSize: 25, // Results per chunk
                bufferSize: 100, // Results to keep in memory
                preloadChunks: 3, // Number of chunks to preload
                sortField: 'relevance',
                sortOrder: 'desc'
            },
            
            // Artifact content streaming
            artifact_content: {
                chunkSize: 10, // Artifacts per chunk
                bufferSize: 50, // Artifacts to keep in memory
                preloadChunks: 1, // Number of chunks to preload
                sortField: 'lastModified',
                sortOrder: 'desc'
            },
            
            // Summarization streaming
            summary_generation: {
                chunkSize: 100, // Messages to summarize per chunk
                bufferSize: 500, // Messages to keep for context
                preloadChunks: 1, // Context chunks to preload
                sortField: 'timestamp',
                sortOrder: 'asc'
            },
            
            // Export data streaming
            export_data: {
                chunkSize: 100, // Items per chunk
                bufferSize: 1000, // Items to keep in memory
                preloadChunks: 0, // No preloading for exports
                sortField: 'timestamp',
                sortOrder: 'asc'
            }
        };
    }
    
    /**
     * Setup streaming optimizations
     */
    setupStreamingOptimizations() {
        // Virtual scrolling support
        this.virtualScrollConfigs = {
            itemHeight: 120, // Average message height in pixels
            containerHeight: 600, // Visible area height
            overscan: 5 // Extra items to render outside viewport
        };
        
        // Intersection observer for lazy loading
        if ('IntersectionObserver' in window) {
            this.intersectionObserver = new IntersectionObserver(
                (entries) => this.handleIntersection(entries),
                { threshold: 0.1, rootMargin: '50px' }
            );
        }
        
        // Background processing for chunk preparation
        this.chunkPreparationQueue = [];
        this.processingChunks = false;
    }
    
    /**
     * Create a new data stream
     */
    async createStream(streamType, dataSource, options = {}) {
        const streamId = `${streamType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const config = { ...this.streamConfigs[streamType], ...options };
        
        if (!config) {
            throw new Error(`Unknown stream type: ${streamType}`);
        }
        
        const stream = {
            id: streamId,
            type: streamType,
            config,
            dataSource,
            totalItems: 0,
            loadedChunks: new Map(),
            currentChunk: 0,
            loadingChunks: new Set(),
            subscribers: new Set(),
            status: 'initializing',
            metadata: {
                createdAt: Date.now(),
                lastAccess: Date.now(),
                bytesLoaded: 0,
                itemsLoaded: 0
            }
        };
        
        // Initialize the stream
        await this.initializeStream(stream);
        
        this.streams.set(streamId, stream);
        this.streamStats.set(streamId, {
            chunksLoaded: 0,
            totalLoadTime: 0,
            averageChunkTime: 0,
            cacheHitRate: 0,
            memoryUsage: 0
        });
        
        return streamId;
    }
    
    /**
     * Initialize stream by loading metadata and first chunk
     */
    async initializeStream(stream) {
        const timerId = window.performanceMonitor?.startTimer('stream_initialization');
        
        try {
            stream.status = 'loading_metadata';
            
            // Load total item count and prepare first chunk
            const metadata = await this.loadStreamMetadata(stream.dataSource);
            stream.totalItems = metadata.totalItems;
            stream.totalChunks = Math.ceil(stream.totalItems / stream.config.chunkSize);
            
            // Load initial chunk
            stream.status = 'loading_initial';
            await this.loadChunk(stream, 0);
            
            // Preload additional chunks if configured
            if (stream.config.preloadChunks > 0) {
                this.preloadChunks(stream, 1, stream.config.preloadChunks);
            }
            
            stream.status = 'ready';
            
        } catch (error) {
            stream.status = 'error';
            throw new Error(`Stream initialization failed: ${error.message}`);
        } finally {
            if (timerId) window.performanceMonitor?.endTimer(timerId);
        }
    }
    
    /**
     * Load stream metadata (total count, indices, etc.)
     */
    async loadStreamMetadata(dataSource) {
        if (typeof dataSource === 'function') {
            // Data source is a function - call with metadata request
            return await dataSource({ type: 'metadata' });
        }
        
        if (Array.isArray(dataSource)) {
            // Data source is an array
            return {
                totalItems: dataSource.length,
                lastModified: Date.now(),
                estimatedSize: JSON.stringify(dataSource).length
            };
        }
        
        if (typeof dataSource === 'object' && dataSource.folioId) {
            // Data source is a folio reference
            const folio = await window.dataManager?.getFolio(dataSource.folioId);
            if (folio && folio.messages) {
                return {
                    totalItems: folio.messages.length,
                    lastModified: folio.lastUsed || Date.now(),
                    estimatedSize: JSON.stringify(folio.messages).length
                };
            }
        }
        
        throw new Error('Unsupported data source type');
    }
    
    /**
     * Load a specific chunk of data
     */
    async loadChunk(stream, chunkIndex) {
        if (stream.loadedChunks.has(chunkIndex) || stream.loadingChunks.has(chunkIndex)) {
            return stream.loadedChunks.get(chunkIndex);
        }
        
        const timerId = window.performanceMonitor?.startTimer('stream_chunk_load');
        stream.loadingChunks.add(chunkIndex);
        
        try {
            const startOffset = chunkIndex * stream.config.chunkSize;
            const endOffset = Math.min(startOffset + stream.config.chunkSize, stream.totalItems);
            
            let chunkData;
            
            // Check cache first
            const cacheKey = window.cacheManager?.createKey('stream_chunk', stream.id, chunkIndex);
            if (window.cacheManager && cacheKey) {
                chunkData = await window.cacheManager.get('search_index', cacheKey);
            }
            
            if (!chunkData) {
                // Load chunk data from source
                chunkData = await this.loadChunkFromSource(
                    stream.dataSource, 
                    startOffset, 
                    endOffset - startOffset,
                    stream.config
                );
                
                // Cache the chunk
                if (window.cacheManager && cacheKey) {
                    await window.cacheManager.set('search_index', cacheKey, chunkData, {
                        dependencies: [`folio_${stream.dataSource.folioId || 'global'}`]
                    });
                }
            }
            
            // Process chunk data
            const processedChunk = await this.processChunkData(chunkData, stream.config);
            
            // Store in stream
            stream.loadedChunks.set(chunkIndex, processedChunk);
            stream.metadata.itemsLoaded += processedChunk.items.length;
            stream.metadata.bytesLoaded += JSON.stringify(processedChunk).length;
            stream.metadata.lastAccess = Date.now();
            
            // Update statistics
            const stats = this.streamStats.get(stream.id);
            stats.chunksLoaded++;
            stats.totalLoadTime += window.performanceMonitor?.endTimer(timerId) || 0;
            stats.averageChunkTime = stats.totalLoadTime / stats.chunksLoaded;
            
            // Notify subscribers
            this.notifySubscribers(stream, 'chunk_loaded', {
                chunkIndex,
                items: processedChunk.items,
                totalLoaded: stream.metadata.itemsLoaded
            });
            
            return processedChunk;
            
        } catch (error) {
            console.error(`Error loading chunk ${chunkIndex} for stream ${stream.id}:`, error);
            throw error;
        } finally {
            stream.loadingChunks.delete(chunkIndex);
            if (timerId) window.performanceMonitor?.endTimer(timerId);
        }
    }
    
    /**
     * Load chunk data from the original source
     */
    async loadChunkFromSource(dataSource, offset, limit, config) {
        if (typeof dataSource === 'function') {
            // Data source is a function
            return await dataSource({
                type: 'chunk',
                offset,
                limit,
                sortField: config.sortField,
                sortOrder: config.sortOrder
            });
        }
        
        if (Array.isArray(dataSource)) {
            // Data source is an array
            const sorted = this.sortData(dataSource, config.sortField, config.sortOrder);
            return {
                items: sorted.slice(offset, offset + limit),
                offset,
                limit,
                totalItems: dataSource.length
            };
        }
        
        if (typeof dataSource === 'object' && dataSource.folioId) {
            // Data source is a folio reference
            const folio = await window.dataManager?.getFolio(dataSource.folioId);
            if (folio && folio.messages) {
                const sorted = this.sortData(folio.messages, config.sortField, config.sortOrder);
                return {
                    items: sorted.slice(offset, offset + limit),
                    offset,
                    limit,
                    totalItems: folio.messages.length,
                    folioId: dataSource.folioId
                };
            }
        }
        
        throw new Error('Unsupported data source for chunk loading');
    }
    
    /**
     * Process and enhance chunk data
     */
    async processChunkData(chunkData, config) {
        const processedItems = [];
        
        for (const item of chunkData.items) {
            let processedItem = { ...item };
            
            // Add virtual scrolling metadata
            processedItem._streamMetadata = {
                index: chunkData.offset + processedItems.length,
                chunkIndex: Math.floor((chunkData.offset + processedItems.length) / config.chunkSize),
                loadedAt: Date.now()
            };
            
            // Process based on item type
            if (item.role && item.content) {
                // Message item
                processedItem = await this.processMessageItem(processedItem);
            } else if (item.type === 'artifact') {
                // Artifact item
                processedItem = await this.processArtifactItem(processedItem);
            }
            
            processedItems.push(processedItem);
        }
        
        return {
            items: processedItems,
            chunkIndex: Math.floor(chunkData.offset / config.chunkSize),
            offset: chunkData.offset,
            limit: chunkData.limit,
            loadedAt: Date.now(),
            processedAt: Date.now()
        };
    }
    
    /**
     * Process message items for streaming
     */
    async processMessageItem(message) {
        // Add lazy loading placeholder for large content
        if (message.content && message.content.length > 1000) {
            message._originalContent = message.content;
            message.content = message.content.substring(0, 300) + '...';
            message._hasMore = true;
        }
        
        // Add semantic metadata if available
        if (window.messageManager) {
            const semanticData = await window.messageManager.analyzeSemanticType(
                message.content, message.role
            ).catch(() => null);
            
            if (semanticData) {
                message._semanticType = semanticData.type;
                message._importance = semanticData.importance;
            }
        }
        
        return message;
    }
    
    /**
     * Process artifact items for streaming
     */
    async processArtifactItem(artifact) {
        // Add preview for large artifacts
        if (artifact.content && artifact.content.length > 500) {
            artifact._preview = artifact.content.substring(0, 200) + '...';
            artifact._hasFullContent = false;
        }
        
        return artifact;
    }
    
    /**
     * Sort data based on configuration
     */
    sortData(data, sortField, sortOrder) {
        if (!sortField) return data;
        
        return [...data].sort((a, b) => {
            let aVal = a[sortField];
            let bVal = b[sortField];
            
            // Handle different data types
            if (typeof aVal === 'string' && typeof bVal === 'string') {
                aVal = aVal.toLowerCase();
                bVal = bVal.toLowerCase();
            }
            
            if (typeof aVal === 'number' && typeof bVal === 'number') {
                return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
            }
            
            // String comparison
            if (aVal < bVal) return sortOrder === 'desc' ? 1 : -1;
            if (aVal > bVal) return sortOrder === 'desc' ? -1 : 1;
            return 0;
        });
    }
    
    /**
     * Preload chunks in background
     */
    async preloadChunks(stream, startChunk, count) {
        const preloadPromises = [];
        
        for (let i = 0; i < count; i++) {
            const chunkIndex = startChunk + i;
            if (chunkIndex < stream.totalChunks && !stream.loadedChunks.has(chunkIndex)) {
                preloadPromises.push(this.loadChunk(stream, chunkIndex));
            }
        }
        
        if (preloadPromises.length > 0) {
            // Use background processor if available
            if (window.backgroundProcessor) {
                await window.backgroundProcessor.processBatch(
                    preloadPromises.map(promise => ({
                        type: 'chunk_preload',
                        data: { promise },
                        options: { priority: 'low' }
                    }))
                );
            } else {
                await Promise.allSettled(preloadPromises);
            }
        }
    }
    
    /**
     * Get items from stream with virtual scrolling support
     */
    async getStreamItems(streamId, startIndex = 0, count = 50, options = {}) {
        const stream = this.streams.get(streamId);
        if (!stream) {
            throw new Error(`Stream ${streamId} not found`);
        }
        
        stream.metadata.lastAccess = Date.now();
        
        const endIndex = Math.min(startIndex + count, stream.totalItems);
        const items = [];
        
        // Calculate which chunks we need
        const startChunk = Math.floor(startIndex / stream.config.chunkSize);
        const endChunk = Math.floor(endIndex / stream.config.chunkSize);
        
        // Load required chunks
        const chunkPromises = [];
        for (let chunkIndex = startChunk; chunkIndex <= endChunk; chunkIndex++) {
            if (!stream.loadedChunks.has(chunkIndex)) {
                chunkPromises.push(this.loadChunk(stream, chunkIndex));
            }
        }
        
        if (chunkPromises.length > 0) {
            await Promise.all(chunkPromises);
        }
        
        // Collect items from loaded chunks
        for (let chunkIndex = startChunk; chunkIndex <= endChunk; chunkIndex++) {
            const chunk = stream.loadedChunks.get(chunkIndex);
            if (!chunk) continue;
            
            const chunkStartIndex = chunkIndex * stream.config.chunkSize;
            const itemStartInChunk = Math.max(0, startIndex - chunkStartIndex);
            const itemEndInChunk = Math.min(chunk.items.length, endIndex - chunkStartIndex);
            
            for (let i = itemStartInChunk; i < itemEndInChunk; i++) {
                if (items.length < count) {
                    items.push(chunk.items[i]);
                }
            }
        }
        
        // Start preloading next chunks if needed
        if (options.preload !== false) {
            this.preloadChunks(stream, endChunk + 1, stream.config.preloadChunks);
        }
        
        return {
            items,
            totalItems: stream.totalItems,
            startIndex,
            endIndex: startIndex + items.length,
            hasMore: endIndex < stream.totalItems,
            loadedChunks: stream.loadedChunks.size,
            totalChunks: stream.totalChunks
        };
    }
    
    /**
     * Subscribe to stream updates
     */
    subscribeToStream(streamId, callback) {
        const stream = this.streams.get(streamId);
        if (!stream) {
            throw new Error(`Stream ${streamId} not found`);
        }
        
        const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        stream.subscribers.add({ id: subscriptionId, callback });
        
        return subscriptionId;
    }
    
    /**
     * Unsubscribe from stream updates
     */
    unsubscribeFromStream(streamId, subscriptionId) {
        const stream = this.streams.get(streamId);
        if (!stream) return false;
        
        const subscription = Array.from(stream.subscribers)
            .find(sub => sub.id === subscriptionId);
        
        if (subscription) {
            stream.subscribers.delete(subscription);
            return true;
        }
        
        return false;
    }
    
    /**
     * Notify stream subscribers
     */
    notifySubscribers(stream, eventType, data) {
        stream.subscribers.forEach(subscriber => {
            try {
                subscriber.callback({
                    streamId: stream.id,
                    eventType,
                    data,
                    timestamp: Date.now()
                });
            } catch (error) {
                console.error('Error notifying stream subscriber:', error);
            }
        });
    }
    
    /**
     * Handle intersection observer events for lazy loading
     */
    handleIntersection(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const element = entry.target;
                const streamId = element.dataset.streamId;
                const itemIndex = parseInt(element.dataset.itemIndex);
                
                if (streamId && !isNaN(itemIndex)) {
                    this.loadItemsNearIndex(streamId, itemIndex);
                }
            }
        });
    }
    
    /**
     * Load items near a specific index for smooth scrolling
     */
    async loadItemsNearIndex(streamId, centerIndex) {
        const stream = this.streams.get(streamId);
        if (!stream) return;
        
        const bufferSize = Math.floor(stream.config.bufferSize / 2);
        const startIndex = Math.max(0, centerIndex - bufferSize);
        const count = bufferSize * 2;
        
        try {
            await this.getStreamItems(streamId, startIndex, count, { preload: true });
        } catch (error) {
            console.error('Error loading items near index:', error);
        }
    }
    
    /**
     * Create virtual scrolling metadata
     */
    createVirtualScrollMetadata(streamId, containerHeight = null) {
        const stream = this.streams.get(streamId);
        if (!stream) return null;
        
        const config = this.virtualScrollConfigs;
        const visibleHeight = containerHeight || config.containerHeight;
        const visibleItems = Math.ceil(visibleHeight / config.itemHeight);
        const totalHeight = stream.totalItems * config.itemHeight;
        
        return {
            totalItems: stream.totalItems,
            itemHeight: config.itemHeight,
            visibleItems,
            overscan: config.overscan,
            totalHeight,
            visibleStartIndex: 0,
            visibleEndIndex: visibleItems - 1
        };
    }
    
    /**
     * Update virtual scroll position
     */
    updateVirtualScrollPosition(streamId, scrollTop, containerHeight) {
        const stream = this.streams.get(streamId);
        if (!stream) return null;
        
        const config = this.virtualScrollConfigs;
        const visibleStartIndex = Math.floor(scrollTop / config.itemHeight);
        const visibleItems = Math.ceil(containerHeight / config.itemHeight);
        const visibleEndIndex = Math.min(
            stream.totalItems - 1,
            visibleStartIndex + visibleItems + config.overscan
        );
        
        // Trigger loading if needed
        this.loadItemsNearIndex(streamId, visibleStartIndex);
        
        return {
            visibleStartIndex: Math.max(0, visibleStartIndex - config.overscan),
            visibleEndIndex,
            scrollOffset: (visibleStartIndex - config.overscan) * config.itemHeight
        };
    }
    
    /**
     * Get stream statistics
     */
    getStreamStatistics(streamId = null) {
        if (streamId) {
            const stream = this.streams.get(streamId);
            const stats = this.streamStats.get(streamId);
            
            if (!stream || !stats) return null;
            
            return {
                streamId,
                type: stream.type,
                status: stream.status,
                totalItems: stream.totalItems,
                totalChunks: stream.totalChunks,
                loadedChunks: stream.loadedChunks.size,
                itemsLoaded: stream.metadata.itemsLoaded,
                bytesLoaded: stream.metadata.bytesLoaded,
                memoryUsage: this.estimateStreamMemoryUsage(stream),
                ...stats
            };
        }
        
        // Return statistics for all streams
        const allStats = {};
        this.streams.forEach((stream, id) => {
            allStats[id] = this.getStreamStatistics(id);
        });
        
        return {
            totalStreams: this.streams.size,
            streams: allStats
        };
    }
    
    /**
     * Estimate memory usage for a stream
     */
    estimateStreamMemoryUsage(stream) {
        let totalBytes = 0;
        
        stream.loadedChunks.forEach(chunk => {
            totalBytes += JSON.stringify(chunk).length;
        });
        
        return {
            bytes: totalBytes,
            kb: Math.round(totalBytes / 1024),
            mb: Math.round(totalBytes / (1024 * 1024))
        };
    }
    
    /**
     * Clean up memory by evicting old chunks
     */
    cleanupStreamMemory(streamId = null, forceAll = false) {
        const streamsToClean = streamId ? [this.streams.get(streamId)] : Array.from(this.streams.values());
        
        let totalCleaned = 0;
        
        streamsToClean.forEach(stream => {
            if (!stream) return;
            
            const maxChunks = forceAll ? 0 : Math.ceil(stream.config.bufferSize / stream.config.chunkSize);
            
            if (stream.loadedChunks.size > maxChunks) {
                // Sort chunks by last access time
                const chunks = Array.from(stream.loadedChunks.entries())
                    .sort(([,a], [,b]) => (b.loadedAt || 0) - (a.loadedAt || 0));
                
                // Keep only the most recently accessed chunks
                const chunksToKeep = chunks.slice(0, maxChunks);
                const chunksToRemove = chunks.slice(maxChunks);
                
                // Clear the map and add back only kept chunks
                stream.loadedChunks.clear();
                chunksToKeep.forEach(([index, chunk]) => {
                    stream.loadedChunks.set(index, chunk);
                });
                
                totalCleaned += chunksToRemove.length;
                
                // Update metadata
                stream.metadata.itemsLoaded = chunksToKeep.reduce(
                    (total, [, chunk]) => total + chunk.items.length, 0
                );
                stream.metadata.bytesLoaded = chunksToKeep.reduce(
                    (total, [, chunk]) => total + JSON.stringify(chunk).length, 0
                );
            }
        });
        
        if (totalCleaned > 0) {
            console.log(`StreamManager: Cleaned up ${totalCleaned} chunks from memory`);
        }
        
        return totalCleaned;
    }
    
    /**
     * Destroy a stream and free resources
     */
    destroyStream(streamId) {
        const stream = this.streams.get(streamId);
        if (!stream) return false;
        
        // Clear all loaded chunks
        stream.loadedChunks.clear();
        
        // Clear subscribers
        stream.subscribers.clear();
        
        // Remove from maps
        this.streams.delete(streamId);
        this.streamStats.delete(streamId);
        
        console.log(`Stream ${streamId} destroyed`);
        return true;
    }
    
    /**
     * Cleanup all streams and resources
     */
    cleanup() {
        // Disconnect intersection observer
        if (this.intersectionObserver) {
            this.intersectionObserver.disconnect();
        }
        
        // Destroy all streams
        Array.from(this.streams.keys()).forEach(streamId => {
            this.destroyStream(streamId);
        });
        
        // Clear all data structures
        this.streams.clear();
        this.buffers.clear();
        this.loaders.clear();
        this.streamStats.clear();
        
        console.log('StreamManager cleaned up');
    }
}

// Global instance
window.streamManager = new StreamManager();