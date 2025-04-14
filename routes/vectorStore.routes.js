import OpenAI from 'openai';
import express from 'express';
import config from '../config/config.js';
import protectRoute from '../middleware/protectRoute.js';
import { VectorService } from '../services/VectorService.js';
import { MemoryVectorService } from '../services/MemoryVectorService.js';

// Debug logging for configuration
console.log('OpenAI API Key configured:', !!config.openai.apiKey);

if (!config.openai.apiKey) {
  throw new Error('OpenAI API key is not configured. Please check your environment variables.');
}

const openai = new OpenAI({
  apiKey: config.openai.apiKey
});

const router = express.Router();

// Apply authentication middleware to all routes
router.use(protectRoute);

// Initialize the vector service
const VECTOR_COLLECTION_NAME = 'vehicle_research_store';
const MEMORY_INSTANCE_NAME = 'vehicle_store_memory';

// Initialize vector services
async function initializeVectorServices() {
  try {
    // Initialize persistent VectorService
    await VectorService.initialize({
      collectionName: VECTOR_COLLECTION_NAME,
      useOpenAI: true,  // Ensure we use OpenAI for this route
      useLocal: true    // Also use local storage for redundancy
    });
    console.log(`VectorService initialized with collection: ${VECTOR_COLLECTION_NAME}`);
    
    // Initialize memory VectorService for quick operations
    await MemoryVectorService.initialize(MEMORY_INSTANCE_NAME);
    console.log(`MemoryVectorService initialized with instance: ${MEMORY_INSTANCE_NAME}`);
    
    return true;
  } catch (error) {
    console.error('Failed to initialize vector services:', error);
    return false;
  }
}

// Initialize on module load
initializeVectorServices().catch(console.error);

// Store data in vector store
router.post('/store', async (req, res) => {
  try {
    const { researchData, vehicleInfo, problem } = req.body;
    
    // Format the data into a single text for embedding
    const textToEmbed = `
      Research: ${JSON.stringify(researchData)}
      Vehicle: ${JSON.stringify(vehicleInfo)}
      Problem: ${problem}
    `.trim();

    console.log('Processing data for vector storage:', textToEmbed.substring(0, 100) + '...');

    // Create document object for our vector services
    const document = {
      pageContent: textToEmbed,
      metadata: { 
        researchData, 
        vehicleInfo, 
        problem,
        timestamp: new Date().toISOString(),
        source: 'vectorStore.routes'
      }
    };
    
    // Store in all available vector services
    const storePromises = [];
    
    // 1. Store in VectorService (both local and OpenAI)
    if (VectorService.initialized) {
      storePromises.push(
        VectorService.addDocuments([document])
          .then(results => {
            console.log('Vector storage results:', results);
            return results;
          })
          .catch(error => {
            console.error('Error storing in VectorService:', error);
            throw error;
          })
      );
    }
    
    // 2. Store in MemoryVectorService for temporary use
    storePromises.push(
      MemoryVectorService.addDocuments(MEMORY_INSTANCE_NAME, [document])
        .then(() => console.log('Successfully stored in MemoryVectorService'))
        .catch(error => console.error('Error storing in MemoryVectorService:', error))
    );
    
    // 3. Also still use the original OpenAI vector store directly
    storePromises.push(
      (async () => {
        try {
          // Generate embedding with OpenAI directly
          const embedding = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: textToEmbed
          });
    
          console.log('Successfully generated embedding with OpenAI');
    
          // Store in OpenAI vector store directly
          const vectorStore = await openai.beta.vector_stores.create({
            name: "vehicle_research_store"
          });
    
          const { id: vectorStoreId } = vectorStore;
    
          await openai.beta.vector_stores.files.upload(
            vectorStoreId,
            {
              content: textToEmbed,
              embedding: embedding.data[0].embedding,
              metadata: { researchData, vehicleInfo, problem }
            }
          );
    
          console.log('Successfully stored in OpenAI vector store directly');
        } catch (error) {
          console.error('Error in direct OpenAI vector storage:', error);
        }
      })()
    );
    
    // Wait for all storage operations
    await Promise.allSettled(storePromises);
    
    console.log('Successfully stored data in all vector stores');
    res.json({ success: true, message: 'Data stored successfully in vector stores' });
  } catch (error) {
    console.error('Vector store error:', error);
    res.status(500).json({
      error: error.message,
      details: error.toString(),
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Query vector store
router.post('/query', async (req, res) => {
  try {
    const { query, limit = 5, metadata = {} } = req.body;

    console.log('Processing vector query:', query);
    
    let results = [];
    
    // Try MemoryVectorService first (fastest)
    try {
      console.log(`Searching MemoryVectorService instance: ${MEMORY_INSTANCE_NAME}`);
      const memoryResults = await MemoryVectorService.similaritySearch(MEMORY_INSTANCE_NAME, query, limit);
      
      if (memoryResults.length > 0) {
        console.log(`Found ${memoryResults.length} results in MemoryVectorService`);
        results = memoryResults;
      }
    } catch (memoryError) {
      console.error('Error searching MemoryVectorService:', memoryError);
    }
    
    // Try VectorService if memory search fails or has no results
    if (results.length === 0) {
      try {
        console.log('Searching VectorService');
        const vectorResults = await VectorService.similaritySearch(query, limit, metadata);
        
        if (vectorResults.length > 0) {
          console.log(`Found ${vectorResults.length} results in VectorService`);
          results = vectorResults;
        }
      } catch (vectorError) {
        console.error('Error searching VectorService:', vectorError);
      }
    }
    
    // Fall back to direct OpenAI vector search if needed
    if (results.length === 0) {
      try {
        console.log('Falling back to direct OpenAI vector search');
        
        // Generate query embedding
        const embedding = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: query
        });
    
        console.log('Successfully generated query embedding');
    
        // Search OpenAI vector store
        const searchResults = await openai.beta.vector_stores.search({
          vectorStoreName: "vehicle_research_store",
          queryEmbedding: embedding.data[0].embedding,
          matchThreshold: 0.7,
          matchCount: limit
        });
    
        console.log(`Found ${searchResults.length} matches in direct OpenAI search`);
        
        // Convert to standardized format
        results = searchResults.map(result => ({
          pageContent: result.content,
          metadata: result.metadata || {},
          score: result.score
        }));
      } catch (openaiError) {
        console.error('Error in direct OpenAI vector search:', openaiError);
      }
    }

    res.json({ results, count: results.length });
  } catch (error) {
    console.error('Vector store query error:', error);
    res.status(500).json({
      error: error.message,
      details: error.toString(),
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

export default router;
