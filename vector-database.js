// Branestawm Vector Database
// IndexedDB-based vector storage for embeddings and semantic search

class BranestawmVectorDB {
    constructor() {
        this.db = null;
        this.dbName = 'BranestawmVectorDB';
        this.version = 1;
        this.ready = false;
    }

    async initialize() {
        console.log('🔍 VECTOR DB: Initializing IndexedDB vector database...');
        
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);
            
            request.onerror = () => {
                console.error('🔍 VECTOR DB: Failed to open database:', request.error);
                reject(request.error);
            };
            
            request.onsuccess = () => {
                this.db = request.result;
                this.ready = true;
                console.log('🔍 VECTOR DB: Database initialized successfully');
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                console.log('🔍 VECTOR DB: Setting up database schema...');
                const db = event.target.result;
                
                // Documents store - contains document metadata and chunks
                if (!db.objectStoreNames.contains('documents')) {
                    const documentsStore = db.createObjectStore('documents', { keyPath: 'id' });
                    documentsStore.createIndex('type', 'type', { unique: false });
                    documentsStore.createIndex('createdAt', 'createdAt', { unique: false });
                    documentsStore.createIndex('source', 'source', { unique: false });
                }
                
                // Embeddings store - contains vector embeddings for semantic search
                if (!db.objectStoreNames.contains('embeddings')) {
                    const embeddingsStore = db.createObjectStore('embeddings', { keyPath: 'id' });
                    embeddingsStore.createIndex('docId', 'docId', { unique: false });
                    embeddingsStore.createIndex('chunkIndex', 'chunkIndex', { unique: false });
                    embeddingsStore.createIndex('embeddingType', 'embeddingType', { unique: false });
                }
                
                // Metadata store - contains database statistics and configuration
                if (!db.objectStoreNames.contains('metadata')) {
                    const metadataStore = db.createObjectStore('metadata', { keyPath: 'key' });
                }
            };
        });
    }

    async storeDocument(docId, content, metadata = {}) {
        if (!this.ready) throw new Error('Vector database not initialized');
        
        console.log('🔍 VECTOR DB: Storing document:', docId);
        
        const transaction = this.db.transaction(['documents'], 'readwrite');
        const store = transaction.objectStore('documents');
        
        const document = {
            id: docId,
            content: content,
            type: metadata.type || 'unknown',
            source: metadata.source || 'user',
            title: metadata.title || docId,
            chunks: this.chunkText(content),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            metadata: metadata
        };
        
        return new Promise((resolve, reject) => {
            const request = store.put(document);
            request.onsuccess = () => {
                console.log('🔍 VECTOR DB: Document stored successfully');
                resolve(document);
            };
            request.onerror = () => {
                console.error('🔍 VECTOR DB: Failed to store document:', request.error);
                reject(request.error);
            };
        });
    }

    async storeEmbedding(docId, chunkIndex, embedding, embeddingType = 'simple') {
        if (!this.ready) throw new Error('Vector database not initialized');
        
        const transaction = this.db.transaction(['embeddings'], 'readwrite');
        const store = transaction.objectStore('embeddings');
        
        const embeddingData = {
            id: `${docId}-${chunkIndex}`,
            docId: docId,
            chunkIndex: chunkIndex,
            embedding: Array.from(embedding), // Convert to regular array for storage
            embeddingType: embeddingType,
            createdAt: new Date().toISOString()
        };
        
        return new Promise((resolve, reject) => {
            const request = store.put(embeddingData);
            request.onsuccess = () => resolve(embeddingData);
            request.onerror = () => reject(request.error);
        });
    }

    async searchSimilar(queryEmbedding, topK = 5, threshold = 0.5) {
        if (!this.ready) throw new Error('Vector database not initialized');
        
        console.log('🔍 VECTOR DB: Searching for similar embeddings...');
        
        const transaction = this.db.transaction(['embeddings', 'documents'], 'readonly');
        const embeddingsStore = transaction.objectStore('embeddings');
        const documentsStore = transaction.objectStore('documents');
        
        return new Promise((resolve, reject) => {
            const similarities = [];
            const request = embeddingsStore.openCursor();
            
            request.onsuccess = async (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    const embeddingData = cursor.value;
                    const similarity = this.cosineSimilarity(queryEmbedding, embeddingData.embedding);
                    
                    if (similarity >= threshold) {
                        similarities.push({
                            docId: embeddingData.docId,
                            chunkIndex: embeddingData.chunkIndex,
                            similarity: similarity,
                            embeddingType: embeddingData.embeddingType
                        });
                    }
                    
                    cursor.continue();
                } else {
                    // Sort by similarity (highest first) and take top K
                    similarities.sort((a, b) => b.similarity - a.similarity);
                    const topResults = similarities.slice(0, topK);
                    
                    // Fetch document content for top results
                    const results = [];
                    for (const result of topResults) {
                        const docRequest = documentsStore.get(result.docId);
                        const doc = await new Promise((resolve) => {
                            docRequest.onsuccess = () => resolve(docRequest.result);
                        });
                        
                        if (doc && doc.chunks[result.chunkIndex]) {
                            results.push({
                                ...result,
                                content: doc.chunks[result.chunkIndex],
                                title: doc.title,
                                type: doc.type,
                                source: doc.source
                            });
                        }
                    }
                    
                    console.log(`🔍 VECTOR DB: Found ${results.length} similar chunks`);
                    resolve(results);
                }
            };
            
            request.onerror = () => reject(request.error);
        });
    }

    async listDocuments() {
        if (!this.ready) throw new Error('Vector database not initialized');
        
        const transaction = this.db.transaction(['documents'], 'readonly');
        const store = transaction.objectStore('documents');
        
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => {
                const documents = request.result.map(doc => ({
                    id: doc.id,
                    title: doc.title,
                    type: doc.type,
                    source: doc.source,
                    chunkCount: doc.chunks?.length || 0,
                    createdAt: doc.createdAt,
                    updatedAt: doc.updatedAt
                }));
                resolve(documents);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async getDocument(docId) {
        if (!this.ready) throw new Error('Vector database not initialized');
        
        const transaction = this.db.transaction(['documents'], 'readonly');
        const store = transaction.objectStore('documents');
        
        return new Promise((resolve, reject) => {
            const request = store.get(docId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteDocument(docId) {
        if (!this.ready) throw new Error('Vector database not initialized');
        
        const transaction = this.db.transaction(['documents', 'embeddings'], 'readwrite');
        const documentsStore = transaction.objectStore('documents');
        const embeddingsStore = transaction.objectStore('embeddings');
        
        // Delete document
        await new Promise((resolve, reject) => {
            const request = documentsStore.delete(docId);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
        
        // Delete associated embeddings
        const embeddingIndex = embeddingsStore.index('docId');
        return new Promise((resolve, reject) => {
            const request = embeddingIndex.openCursor(IDBKeyRange.only(docId));
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                } else {
                    resolve();
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    async getStatistics() {
        if (!this.ready) throw new Error('Vector database not initialized');
        
        const transaction = this.db.transaction(['documents', 'embeddings'], 'readonly');
        const documentsStore = transaction.objectStore('documents');
        const embeddingsStore = transaction.objectStore('embeddings');
        
        const docCount = await new Promise((resolve, reject) => {
            const request = documentsStore.count();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        
        const embeddingCount = await new Promise((resolve, reject) => {
            const request = embeddingsStore.count();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        
        return {
            documentCount: docCount,
            embeddingCount: embeddingCount,
            ready: this.ready
        };
    }

    // Simple text chunking for embedding
    chunkText(text, chunkSize = 500, overlap = 50) {
        const chunks = [];
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        
        let currentChunk = '';
        for (const sentence of sentences) {
            if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
                chunks.push(currentChunk.trim());
                // Add overlap by keeping last part of current chunk
                const words = currentChunk.split(' ');
                currentChunk = words.slice(-overlap).join(' ') + ' ' + sentence;
            } else {
                currentChunk += (currentChunk ? ' ' : '') + sentence;
            }
        }
        
        if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
        }
        
        return chunks.length > 0 ? chunks : [text]; // Fallback to original text if no chunks
    }

    // Simple text-based embedding fallback (when GemmaEmbedding unavailable)
    createSimpleEmbedding(text) {
        // Create a simple TF-IDF style embedding
        const words = text.toLowerCase().split(/\s+/).filter(word => word.length > 2);
        const wordFreq = {};
        
        // Count word frequencies
        words.forEach(word => {
            wordFreq[word] = (wordFreq[word] || 0) + 1;
        });
        
        // Create fixed-size embedding vector (128 dimensions)
        const embedding = new Array(128).fill(0);
        
        // Use simple hash function to map words to dimensions
        Object.keys(wordFreq).forEach(word => {
            const hash = this.simpleHash(word) % 128;
            embedding[hash] += wordFreq[word];
        });
        
        // Normalize vector
        const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
        if (magnitude > 0) {
            for (let i = 0; i < embedding.length; i++) {
                embedding[i] /= magnitude;
            }
        }
        
        return embedding;
    }

    // Simple hash function for text-based embeddings
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }

    // Cosine similarity calculation
    cosineSimilarity(a, b) {
        if (a.length !== b.length) return 0;
        
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        
        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        
        if (normA === 0 || normB === 0) return 0;
        
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }
}

// Export for use in background script
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BranestawmVectorDB;
}