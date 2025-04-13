import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import OpenAI from "openai";
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Memory Embeddings class that wraps a local or OpenAI embedding service
 * but can be used with LangChain vector stores
 */
class MemoryEmbeddings {
    constructor(config = {}) {
        this.localUrl = config.localUrl || process.env.LOCAL_EMBEDDING_URL || 'http://localhost:8080';
        this.openaiApiKey = config.openaiApiKey || process.env.OPENAI_API_KEY;
        this.useOpenAI = config.useOpenAI !== undefined ? config.useOpenAI : false;
        this.batchSize = config.batchSize || 100;
        this.fallbackToOpenAI = config.fallbackToOpenAI !== undefined ? config.fallbackToOpenAI : true;
        
        if ((this.useOpenAI || this.fallbackToOpenAI) && !this.openaiApiKey) {
            console.warn('OpenAI API key not provided. OpenAI embeddings and fallback will be disabled.');
            this.useOpenAI = false;
            this.fallbackToOpenAI = false;
        }
        
        if (this.useOpenAI || this.fallbackToOpenAI) {
            this.openai = new OpenAI({
                apiKey: this.openaiApiKey
            });
        }
    }

    async embedDocuments(texts) {
        if (this.useOpenAI) {
            return this.getOpenAIEmbeddings(texts);
        } else {
            try {
                return await this.getLocalEmbeddings(texts);
            } catch (error) {
                // If local embeddings fail and fallback is enabled, try OpenAI
                if (this.fallbackToOpenAI && this.openai) {
                    console.log('Local embeddings failed, falling back to OpenAI...');
                    return this.getOpenAIEmbeddings(texts);
                } else {
                    throw error;
                }
            }
        }
    }

    async embedQuery(text) {
        const embeddings = await this.embedDocuments([text]);
        return embeddings[0];
    }

    async getLocalEmbeddings(texts) {
        try {
            console.log(`Generating local embeddings for ${texts.length} texts`);
            
            // Check if the input array is empty to avoid API errors
            if (!texts || texts.length === 0) {
                console.log('Empty texts array provided for embeddings, returning empty array');
                return [];
            }
            
            // Process texts in batches to avoid overloading the embedding service
            if (texts.length > this.batchSize) {
                console.log(`Batching ${texts.length} texts into chunks of ${this.batchSize}`);
                const batches = [];
                
                for (let i = 0; i < texts.length; i += this.batchSize) {
                    batches.push(texts.slice(i, i + this.batchSize));
                }
                
                let allEmbeddings = [];
                for (let i = 0; i < batches.length; i++) {
                    const batch = batches[i];
                    console.log(`Processing batch ${i+1}/${batches.length} with ${batch.length} texts`);
                    const response = await axios.post(`${this.localUrl}/v1/embeddings`, {
                        model: "text-embedding-ada-002",
                        input: batch
                    });
                    
                    if (!response.data || !response.data.data) {
                        throw new Error('Invalid response from embedding service');
                    }
                    
                    const batchEmbeddings = response.data.data.map(item => item.embedding);
                    allEmbeddings = [...allEmbeddings, ...batchEmbeddings];
                    
                    // Add a small delay between batches to prevent overwhelming the service
                    if (i < batches.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 200));
                    }
                }
                
                return allEmbeddings;
            } else {
                // For smaller sets, process normally
                const response = await axios.post(`${this.localUrl}/v1/embeddings`, {
                    model: "text-embedding-ada-002",
                    input: texts
                });

                if (!response.data || !response.data.data) {
                    throw new Error('Invalid response from embedding service');
                }

                return response.data.data.map(item => item.embedding);
            }
        } catch (error) {
            console.error('Error generating local embeddings:', error);
            throw error;
        }
    }

    async getOpenAIEmbeddings(texts) {
        try {
            console.log(`Generating OpenAI embeddings for ${texts.length} texts`);
            // Check if the input array is empty to avoid API errors
            if (!texts || texts.length === 0) {
                console.log('Empty texts array provided for embeddings, returning empty array');
                return [];
            }
            
            const response = await this.openai.embeddings.create({
                model: "text-embedding-3-small",
                input: texts
            });
            
            return response.data.map(item => item.embedding);
        } catch (error) {
            console.error('Error generating OpenAI embeddings:', error);
            throw error;
        }
    }
}

/**
 * In-memory vector store service for ephemeral vector operations
 * This service does not persist data between application restarts
 */
export class MemoryVectorService {
    static instances = {};
    static embeddingsService = null;
    
    /**
     * Check if a named memory vector store instance exists
     * @param {string} instanceName - Name of the instance to check
     * @returns {boolean} - True if the instance exists, false otherwise
     */
    static hasInstance(instanceName = 'default') {
        return !!this.instances[instanceName];
    }
    
    /**
     * Initialize a named memory vector store instance
     * @param {string} instanceName - Name to identify this memory store
     * @param {object} options - Configuration options
     * @returns {MemoryVectorStore} - The initialized memory vector store
     */
    static async initialize(instanceName = 'default', options = {}) {
        if (!this.instances[instanceName]) {
            // Initialize embeddings service
            if (!this.embeddingsService) {
                this.embeddingsService = new MemoryEmbeddings({
                    localUrl: options.localEmbeddingUrl || process.env.LOCAL_EMBEDDING_URL,
                    openaiApiKey: options.openaiApiKey || process.env.OPENAI_API_KEY,
                    useOpenAI: options.useOpenAI || false,
                    fallbackToOpenAI: options.fallbackToOpenAI !== undefined ? options.fallbackToOpenAI : true,
                    batchSize: options.batchSize || 50
                });
            }
            
            // Create an empty memory vector store without calling embedding API
            try {
                // Directly create an instance without calling embeddings API
                this.instances[instanceName] = new MemoryVectorStore(this.embeddingsService);
                this.instances[instanceName].memoryVectors = [];
                
                console.log(`Memory vector store '${instanceName}' initialized`);
            } catch (error) {
                console.error(`Error initializing memory vector store '${instanceName}':`, error);
                throw error;
            }
        }
        
        return this.instances[instanceName];
    }
    
    /**
     * Get an existing memory vector store instance
     * @param {string} instanceName - Name of the instance to retrieve
     * @returns {MemoryVectorStore} - The requested memory store or null if not found
     */
    static getInstance(instanceName = 'default') {
        if (!this.instances[instanceName]) {
            console.warn(`Memory vector store '${instanceName}' not found. Call initialize() first.`);
            return null;
        }
        return this.instances[instanceName];
    }
    
    /**
     * Get all initialized memory store instances
     * @returns {object} - Map of all initialized instances
     */
    static getAllInstances() {
        return this.instances;
    }
    
    /**
     * Add documents to a memory vector store
     * @param {string} instanceName - Name of the instance to add documents to
     * @param {array} documents - Documents to add (with pageContent and metadata)
     * @param {object} options - Options for processing documents
     * @returns {boolean} - Success status
     */
    static async addDocuments(instanceName = 'default', documents, options = {}) {
        const vectorStore = await this.ensureInstance(instanceName);
        
        // Process documents with a text splitter if needed
        let processedDocs = documents;
        if (options.splitText) {
            const textSplitter = new RecursiveCharacterTextSplitter({
                chunkSize: options.chunkSize || 1000,
                chunkOverlap: options.chunkOverlap || 200,
            });
            
            processedDocs = await textSplitter.splitDocuments(documents);
            console.log(`Split ${documents.length} documents into ${processedDocs.length} chunks`);
        }
        
        try {
            // Extract texts and metadata
            const texts = processedDocs.map(doc => doc.pageContent);
            const metadatas = processedDocs.map(doc => doc.metadata || {});
            
            // Add to memory vector store
            await vectorStore.addVectors(
                await this.embeddingsService.embedDocuments(texts),
                texts,
                metadatas
            );
            
            console.log(`Added ${processedDocs.length} documents to memory vector store '${instanceName}'`);
            return true;
        } catch (error) {
            console.error(`Error adding documents to memory vector store '${instanceName}':`, error);
            return false;
        }
    }
    
    /**
     * Search for similar documents in a memory vector store
     * @param {string} instanceName - Name of the instance to search
     * @param {string} query - Query text to search for
     * @param {number} k - Number of results to return
     * @returns {array} - Array of similar documents
     */
    static async similaritySearch(instanceName = 'default', query, k = 5) {
        const vectorStore = await this.ensureInstance(instanceName);
        
        try {
            const results = await vectorStore.similaritySearch(query, k);
            console.log(`Found ${results.length} results for query in memory vector store '${instanceName}'`);
            return results;
        } catch (error) {
            console.error(`Error searching memory vector store '${instanceName}':`, error);
            return [];
        }
    }
    
    /**
     * Clear a memory vector store instance
     * @param {string} instanceName - Name of the instance to clear
     * @returns {boolean} - Success status
     */
    static async clear(instanceName = 'default') {
        if (this.instances[instanceName]) {
            // Create a new empty store without calling embedding API
            try {
                this.instances[instanceName] = new MemoryVectorStore(this.embeddingsService);
                this.instances[instanceName].memoryVectors = [];
                console.log(`Memory vector store '${instanceName}' cleared`);
                return true;
            } catch (error) {
                console.error(`Error clearing memory vector store '${instanceName}':`, error);
                return false;
            }
        }
        return false;
    }
    
    /**
     * Delete a memory vector store instance
     * @param {string} instanceName - Name of the instance to delete
     * @returns {boolean} - Success status
     */
    static delete(instanceName = 'default') {
        if (this.instances[instanceName]) {
            delete this.instances[instanceName];
            console.log(`Memory vector store '${instanceName}' deleted`);
            return true;
        }
        return false;
    }
    
    /**
     * Get the size of a memory vector store
     * @param {string} instanceName - Name of the instance to check
     * @returns {number} - Number of documents in the store
     */
    static getSize(instanceName = 'default') {
        const vectorStore = this.getInstance(instanceName);
        if (!vectorStore) return 0;
        
        // Access the internal docstore of MemoryVectorStore
        return vectorStore.memoryVectors?.length || 0;
    }
    
    /**
     * Ensure an instance exists, initializing it if needed
     * @param {string} instanceName - Name of the instance to ensure
     * @returns {MemoryVectorStore} - The vector store instance
     */
    static async ensureInstance(instanceName = 'default') {
        if (!this.instances[instanceName]) {
            return await this.initialize(instanceName);
        }
        return this.instances[instanceName];
    }
}

export default MemoryVectorService;
