import express from 'express';
import { crawl } from '../controllers/crawlerController.js';
import protectRoute from '../middleware/protectRoute.js';
import { VectorService } from '../services/VectorService.js';
import { MemoryVectorService } from '../services/MemoryVectorService.js';

const router = express.Router();

// Apply authentication middleware
router.use(protectRoute);

// Initialize vector services for crawler
const CRAWLER_COLLECTION_NAME = 'forum_crawler';
const MEMORY_INSTANCE_NAME = 'forum_crawler';

// Initialize vector services on module load
async function initializeVectorServices() {
  try {
    // Initialize persistent VectorService for crawler
    await VectorService.initialize({
      collectionName: CRAWLER_COLLECTION_NAME,
      useOpenAI: false,  // Use local embeddings for cost efficiency
      useLocal: true     // Use local storage for crawler data
    });
    console.log(`VectorService initialized for crawler with collection: ${CRAWLER_COLLECTION_NAME}`);
    
    // Initialize memory VectorService for quick operations
    if (!MemoryVectorService.hasInstance(MEMORY_INSTANCE_NAME)) {
      await MemoryVectorService.initialize(MEMORY_INSTANCE_NAME);
      console.log(`MemoryVectorService initialized for crawler with instance: ${MEMORY_INSTANCE_NAME}`);
    }
    
    return true;
  } catch (error) {
    console.error('Failed to initialize vector services for crawler:', error);
    return false;
  }
}

// Initialize services
initializeVectorServices().catch(console.error);

// Crawl a forum URL and store in vector database
router.post('/crawl', async (req, res) => {
  try {
    const { url, depth = 2, maxPages = 10 } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    // Call crawler controller, passing our vector services
    const crawlResults = await crawl(url, depth, maxPages, {
      vectorService: VectorService.initialized ? VectorService : null,
      memoryVectorService: {
        instance: MEMORY_INSTANCE_NAME,
        service: MemoryVectorService
      },
      vectorCollectionName: CRAWLER_COLLECTION_NAME
    });
    
    res.json(crawlResults);
  } catch (error) {
    console.error('Crawler error:', error);
    res.status(500).json({
      error: error.message,
      details: error.toString(),
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Retrieve crawled data
router.get('/results', async (req, res) => {
  try {
    // Implement to fetch from vector database
    const { query, limit = 5 } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }
    
    let results = [];
    
    // First try memory vector service for fast results
    if (MemoryVectorService.hasInstance(MEMORY_INSTANCE_NAME)) {
      try {
        const memoryResults = await MemoryVectorService.similaritySearch(
          MEMORY_INSTANCE_NAME, 
          query,
          parseInt(limit)
        );
        
        if (memoryResults && memoryResults.length > 0) {
          console.log(`Found ${memoryResults.length} results in memory vector store`);
          results = memoryResults;
        }
      } catch (memError) {
        console.error('Error searching memory vector store:', memError);
      }
    }
    
    // If no results from memory, try persistent vector service
    if (results.length === 0 && VectorService.initialized) {
      try {
        const vectorResults = await VectorService.similaritySearch(
          query,
          parseInt(limit),
          { collection: CRAWLER_COLLECTION_NAME }
        );
        
        if (vectorResults && vectorResults.length > 0) {
          console.log(`Found ${vectorResults.length} results in persistent vector store`);
          results = vectorResults;
        }
      } catch (vecError) {
        console.error('Error searching persistent vector store:', vecError);
      }
    }
    
    res.json({ results, count: results.length });
  } catch (error) {
    console.error('Error retrieving crawler results:', error);
    res.status(500).json({
      error: error.message,
      details: error.toString(),
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Clear crawler data
router.post('/clear', async (req, res) => {
  try {
    const clearPromises = [];
    
    // Clear from memory vector store if exists
    if (MemoryVectorService.hasInstance(MEMORY_INSTANCE_NAME)) {
      clearPromises.push(
        MemoryVectorService.clearInstance(MEMORY_INSTANCE_NAME)
          .then(() => console.log('Memory vector store cleared'))
          .catch(err => console.error('Error clearing memory vector store:', err))
      );
    }
    
    // Clear from persistent vector store if initialized
    if (VectorService.initialized) {
      clearPromises.push(
        VectorService.clearCollection(CRAWLER_COLLECTION_NAME)
          .then(() => console.log('Persistent vector store cleared'))
          .catch(err => console.error('Error clearing persistent vector store:', err))
      );
    }
    
    await Promise.allSettled(clearPromises);
    
    res.json({ success: true, message: 'Crawler data cleared successfully' });
  } catch (error) {
    console.error('Error clearing crawler data:', error);
    res.status(500).json({
      error: error.message,
      details: error.toString(),
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

export default router; 