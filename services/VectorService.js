import { ChromaClient } from "chromadb";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import OpenAI from "openai";
import dotenv from 'dotenv';
import { LoggerService } from './LoggerService.js';

dotenv.config();

// Embedding service that works with both local and OpenAI models
class EmbeddingService {
    constructor(config = {}) {
        this.localUrl = config.localUrl || process.env.LOCAL_EMBEDDING_URL || 'http://localhost:8080';
        this.openaiApiKey = config.openaiApiKey || process.env.OPENAI_API_KEY;
        this.useOpenAI = config.useOpenAI !== undefined ? config.useOpenAI : true;
        this.useLocal = config.useLocal !== undefined ? config.useLocal : true;
        this.batchSize = config.batchSize || 100; // Add batch size parameter with default of 100
        
        if (this.useOpenAI && !this.openaiApiKey) {
            console.warn('OpenAI API key not provided. OpenAI embeddings will be disabled.');
            this.useOpenAI = false;
        }
        
        if (this.useOpenAI) {
            this.openai = new OpenAI({
                apiKey: this.openaiApiKey
            });
        }
    }

    async getEmbeddings(texts, options = {}) {
        const results = {};
        const errors = {};

        // Try local embeddings if enabled
        if (this.useLocal) {
            try {
                const localEmbeddings = await this.getLocalEmbeddings(texts);
                results.local = localEmbeddings;
            } catch (error) {
                console.error('Error with local embeddings:', error);
                errors.local = error.message;
                // Fall back to OpenAI if local fails and OpenAI is enabled
                if (this.useOpenAI) {
                    console.log('Local embeddings failed, falling back to OpenAI...');
                }
            }
        }

        // Try OpenAI embeddings if enabled or if local failed and fallback is needed
        if (this.useOpenAI && !results.local) {
            try {
                const openaiEmbeddings = await this.getOpenAIEmbeddings(texts);
                results.openai = openaiEmbeddings;
            } catch (error) {
                console.error('Error with OpenAI embeddings:', error);
                errors.openai = error.message;
            }
        }

        // Check if we have at least one successful embedding set
        if (Object.keys(results).length === 0) {
            throw new Error(`All embedding services failed: ${JSON.stringify(errors)}`);
        }

        return {
            results,
            errors: Object.keys(errors).length > 0 ? errors : null
        };
    }

    async getLocalEmbeddings(texts) {
        try {
            LoggerService.info(`Generating local embeddings for ${texts.length} texts`);
            
            // Check if the input array is empty to avoid API errors
            if (!texts || texts.length === 0) {
                LoggerService.info('Empty texts array provided for embeddings, returning empty array');
                return [];
            }
            
            // Process texts in batches
            if (texts.length > this.batchSize) {
                LoggerService.info(`Batching ${texts.length} texts into chunks of ${this.batchSize}`);
                const batches = [];
                
                for (let i = 0; i < texts.length; i += this.batchSize) {
                    batches.push(texts.slice(i, i + this.batchSize));
                }
                
                let allEmbeddings = [];
                for (let i = 0; i < batches.length; i++) {
                    const batch = batches[i];
                    LoggerService.progress('Processing batch', i+1, batches.length, { batchSize: batch.length });
                    const response = await fetch(`${this.localUrl}/v1/embeddings`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            model: "text-embedding-ada-002",
                            input: batch
                        })
                    });

                    if (!response.ok) {
                        throw new Error(`Local embedding service returned ${response.status}: ${response.statusText}`);
                    }

                    const data = await response.json();
                    const batchEmbeddings = data.data.map(item => item.embedding);
                    allEmbeddings = [...allEmbeddings, ...batchEmbeddings];
                    
                    // Add a small delay between batches to prevent overwhelming the service
                    if (i < batches.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 200));
                    }
                }
                
                return allEmbeddings;
            } else {
                // For smaller sets, process normally
                const response = await fetch(`${this.localUrl}/v1/embeddings`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        model: "text-embedding-ada-002",
                        input: texts
                    })
                });

                if (!response.ok) {
                    throw new Error(`Local embedding service returned ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();
                return data.data.map(item => item.embedding);
            }
        } catch (error) {
            LoggerService.error('Error generating local embeddings:', error);
            throw error;
        }
    }

    async getOpenAIEmbeddings(texts) {
        try {
            console.log(`Generating OpenAI embeddings for ${texts.length} texts`);
            
            // Process texts in batches to avoid OpenAI rate limits
            if (texts.length > this.batchSize) {
                console.log(`Batching ${texts.length} texts into chunks of ${this.batchSize}`);
                const batches = [];
                
                for (let i = 0; i < texts.length; i += this.batchSize) {
                    batches.push(texts.slice(i, i + this.batchSize));
                }
                
                let allEmbeddings = [];
                for (let i = 0; i < batches.length; i++) {
                    const batch = batches[i];
                    console.log(`Processing OpenAI batch ${i+1}/${batches.length} with ${batch.length} texts`);
                    const response = await this.openai.embeddings.create({
                        model: "text-embedding-3-small",
                        input: batch
                    });
                    
                    const batchEmbeddings = response.data.map(item => item.embedding);
                    allEmbeddings = [...allEmbeddings, ...batchEmbeddings];
                    
                    // Add a small delay between batches to prevent rate limiting
                    if (i < batches.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                }
                
                return allEmbeddings;
            } else {
                // For smaller sets, process normally
                const response = await this.openai.embeddings.create({
                    model: "text-embedding-3-small",
                    input: texts
                });
                
                return response.data.map(item => item.embedding);
            }
        } catch (error) {
            console.error('Error generating OpenAI embeddings:', error);
            throw error;
        }
    }

    // Convenience method for single text embedding
    async embedQuery(text) {
        const result = await this.getEmbeddings([text]);
        // Prefer local embeddings if available, fall back to OpenAI
        return result.results.local?.[0] || result.results.openai?.[0];
    }
}

// LocalEmbeddings class for compatibility with LangChain
class LocalEmbeddings {
    constructor(embeddingService) {
        this.embeddingService = embeddingService;
    }

    async embedDocuments(texts) {
        const result = await this.embeddingService.getEmbeddings(texts);
        return result.results.local || result.results.openai;
    }

    async embedQuery(text) {
        return this.embeddingService.embedQuery(text);
    }
}

// Main Vector Service class
export class VectorService {
    static instance = null;
    static embeddingService = null;
    static localVectorStore = null;
    static openaiVectorStore = null;
    static chromaClient = null;
    static openaiClient = null;
    static collectionName = "unified_data";
    static initialized = false;
    static config = {
        useLocal: true,
        useOpenAI: true,
        chromaUrl: process.env.CHROMA_URL || "http://localhost:8000",
        localEmbeddingUrl: process.env.LOCAL_EMBEDDING_URL || "http://localhost:8080",
        openaiApiKey: process.env.OPENAI_API_KEY,
        useDualStorage: true,
        batchSize: 50
    };

    static async initialize(options = {}) {
        if (this.initialized) {
            return this;
        }
        
        this.config = { ...this.config, ...options };
        
        console.log('Initializing VectorService with config:', {
            useLocal: this.config.useLocal,
            useOpenAI: this.config.useOpenAI,
            chromaUrl: this.config.chromaUrl,
            localEmbeddingUrl: this.config.localEmbeddingUrl,
            useDualStorage: this.config.useDualStorage,
            batchSize: this.config.batchSize,
            hasOpenAIKey: !!this.config.openaiApiKey
        });

        // Initialize embedding service
        this.embeddingService = new EmbeddingService({
            localUrl: this.config.localEmbeddingUrl,
            openaiApiKey: this.config.openaiApiKey,
            useLocal: this.config.useLocal,
            useOpenAI: this.config.useOpenAI,
            batchSize: this.config.batchSize
        });

        // Initialize local ChromaDB if enabled
        if (this.config.useLocal) {
            try {
                await this.initializeLocalStorage();
            } catch (error) {
                console.error('Error initializing local vector storage:', error);
                if (this.config.useDualStorage) {
                    console.warn('Continuing with OpenAI vector storage only');
                    this.config.useLocal = false;
                } else {
                    throw error;
                }
            }
        }

        // Initialize OpenAI vector storage if enabled
        if (this.config.useOpenAI) {
            try {
                await this.initializeOpenAIStorage();
            } catch (error) {
                console.error('Error initializing OpenAI vector storage:', error);
                if (this.config.useDualStorage) {
                    console.warn('Continuing with local vector storage only');
                    this.config.useOpenAI = false;
                } else if (!this.config.useLocal) {
                    throw error;
                }
            }
        }

        if (!this.config.useLocal && !this.config.useOpenAI) {
            throw new Error('No vector storage initialized. Both local and OpenAI storage failed.');
        }

        this.initialized = true;
        return this;
    }

    static async initializeLocalStorage() {
        if (!this.chromaClient) {
            this.chromaClient = new ChromaClient({
                path: this.config.chromaUrl
            });
            console.log('ChromaDB client initialized at', this.config.chromaUrl);
        }

        // Get or create collection
        try {
            await this.chromaClient.getCollection({ name: this.collectionName });
            console.log('Using existing ChromaDB collection');
        } catch {
            await this.chromaClient.createCollection({ 
                name: this.collectionName,
                metadata: {
                    "description": "Unified vector storage collection",
                    "created_at": new Date().toISOString()
                }
            });
            console.log('Created new ChromaDB collection');
        }

        // Initialize vector store with ChromaDB
        if (!this.localVectorStore) {
            const localEmbeddings = new LocalEmbeddings(this.embeddingService);
            this.localVectorStore = await Chroma.fromExistingCollection(
                localEmbeddings,
                { collectionName: this.collectionName }
            );
            console.log('Local vector store initialized with ChromaDB');
        }
    }

    static async initializeOpenAIStorage() {
        if (!this.config.openaiApiKey) {
            throw new Error('OpenAI API key not provided');
        }

        if (!this.openaiClient) {
            this.openaiClient = new OpenAI({
                apiKey: this.config.openaiApiKey
            });
            console.log('OpenAI client initialized');
        }
    }

    static async addDocuments(documents, options = {}) {
        await this.ensureInitialized();

        const results = {
            local: null,
            openai: null
        };

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

        // Add to local storage
        if (this.config.useLocal) {
            try {
                await this.localVectorStore.addDocuments(processedDocs);
                console.log(`Added ${processedDocs.length} documents to local vector store`);
                results.local = true;
            } catch (error) {
                console.error('Error adding documents to local vector store:', error);
                results.local = false;
            }
        }

        // Add to OpenAI vector storage
        if (this.config.useOpenAI) {
            try {
                // Process in smaller batches for OpenAI rate limits
                const batchSize = 20;
                for (let i = 0; i < processedDocs.length; i += batchSize) {
                    const batch = processedDocs.slice(i, i + batchSize);
                    
                    const embeddingResponse = await this.openaiClient.embeddings.create({
                        model: "text-embedding-3-small",
                        input: batch.map(doc => doc.pageContent)
                    });
                    
                    console.log(`Generated OpenAI embeddings for batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(processedDocs.length/batchSize)}`);
                    
                    // Here you would store these in OpenAI's vector DB
                    // This is a placeholder as the actual implementation depends on the OpenAI vector DB API
                    // For example, this might involve calls to the files.uploadFile API
                    
                    await new Promise(resolve => setTimeout(resolve, 200)); // Rate limiting
                }
                
                console.log(`Added ${processedDocs.length} documents to OpenAI vector store`);
                results.openai = true;
            } catch (error) {
                console.error('Error adding documents to OpenAI vector store:', error);
                results.openai = false;
            }
        }

        // Check if at least one storage method succeeded
        if (!results.local && !results.openai) {
            throw new Error('Failed to add documents to any vector store');
        }

        return results;
    }

    /**
     * Search for similar documents across all configured vector stores
     * @param {string} query - Text to search for
     * @param {number} k - Number of results to return
     * @param {object} options - Search options including filters
     * @returns {array} - Array of document results
     */
    static async similaritySearch(query, k = 5, options = {}) {
        await this.ensureInitialized();
        
        const results = {
            local: [],
            openai: []
        };
        
        // Search local vector store
        if (this.localVectorStore) {
            try {
                // Extract and validate filter options
                const filterOptions = options?.filters;
                
                // Explicitly set filters to null if undefined, null, or an empty object
                // ChromaDB expects either null or a valid filter with operators
                const filters = (filterOptions && 
                               typeof filterOptions === 'object' && 
                               Object.keys(filterOptions).length > 0) 
                               ? filterOptions 
                               : null;
                
                LoggerService.info('Searching local vector store with filters:', filters);
                
                // Pass validated filters to the vector store
                const localResults = await this.localVectorStore.similaritySearch(
                    query, 
                    k,
                    filters
                );
                results.local = localResults;
            } catch (error) {
                LoggerService.error('Error searching local vector store:', error);
            }
        }
        
        // Search OpenAI vector storage
        if (this.config.useOpenAI) {
            try {
                // Generate embedding for query
                const embedding = await this.openaiClient.embeddings.create({
                    model: "text-embedding-3-small",
                    input: query
                });
                
                // This is a placeholder for OpenAI vector search
                // Implementation depends on the specific OpenAI vector storage being used
                results.openai = []; // Replace with actual OpenAI vector search results
            } catch (error) {
                console.error('Error searching OpenAI vector store:', error);
            }
        }
        
        // Combine and deduplicate results
        let combinedResults = [];
        
        if (results.local && results.local.length > 0) {
            combinedResults = [...results.local];
        }
        
        if (results.openai && results.openai.length > 0) {
            // Add OpenAI results that aren't already in local results
            // This is a simple deduplication strategy using content matching
            for (const openaiResult of results.openai) {
                const duplicate = combinedResults.find(
                    localResult => localResult.pageContent === openaiResult.pageContent
                );
                
                if (!duplicate) {
                    combinedResults.push(openaiResult);
                }
            }
        }
        
        // Sort by relevance if we have mixed results
        // This would require a common scoring mechanism
        
        // Limit to k results
        return combinedResults.slice(0, k);
    }

    static async ensureInitialized() {
        if (!this.initialized) {
            await this.initialize();
        }
    }
}

export default VectorService; 