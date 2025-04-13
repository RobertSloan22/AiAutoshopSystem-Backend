// routes/multiagent-research.routes.js
import express from 'express';
import { ResearchAgentSystem } from '../services/ResearchAgentSystem.js';
import { VectorService } from '../services/VectorService.js';
import crypto from 'crypto';

const router = express.Router();

// Collection for storing multi-agent research results
const COLLECTION_NAME = 'multiagent_research';

/**
 * @swagger
 * components:
 *   schemas:
 *     MultiAgentResearch:
 *       type: object
 *       required:
 *         - query
 *       properties:
 *         query:
 *           type: string
 *           description: The research query or topic
 *         status:
 *           type: string
 *           enum: [pending, in-progress, completed, failed]
 *           description: Status of the research
 *         decomposedQuestions:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *               question:
 *                 type: string
 *               category:
 *                 type: string
 *               completed:
 *                 type: boolean
 *         finalReport:
 *           type: string
 *           description: Final synthesized research results
 */

/**
 * @swagger
 * /api/multiagent-research:
 *   post:
 *     summary: Create a new multi-agent research request
 *     tags: [MultiAgentResearch]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - query
 *             properties:
 *               query:
 *                 type: string
 *                 description: The research query
 *     responses:
 *       201:
 *         description: Research request created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MultiAgentResearch'
 *       400:
 *         description: Invalid input
 */
router.post('/', async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string' || query.trim() === '') {
      return res.status(400).json({ error: 'Valid query is required' });
    }

    // Generate a unique ID for the research
    const researchId = crypto.randomUUID();

    // Create initial research object
    const research = {
      id: researchId,
      query: query.trim(),
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    // Initialize VectorService if not initialized
    if (!VectorService.isInitialized()) {
      await VectorService.initialize({
        collectionName: COLLECTION_NAME,
        useOpenAI: true,
        useLocal: true
      });
    }

    // Store initial research in database
    await VectorService.addDocument(COLLECTION_NAME, {
      id: researchId,
      content: JSON.stringify(research),
      metadata: {
        status: 'pending',
        query: query.trim(),
        type: 'multiagent-research'
      }
    });

    // Queue the research process (non-blocking)
    processResearch(researchId, query)
      .catch(err => console.error(`Error processing research ${researchId}:`, err));

    return res.status(201).json({
      id: researchId,
      query,
      status: 'pending',
      message: 'Research request accepted and is being processed'
    });
  } catch (error) {
    console.error('Error creating research request:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/multiagent-research/{id}:
 *   get:
 *     summary: Get multi-agent research results by ID
 *     tags: [MultiAgentResearch]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Research ID
 *     responses:
 *       200:
 *         description: Research results
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MultiAgentResearch'
 *       404:
 *         description: Research not found
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Initialize VectorService if not initialized
    if (!VectorService.isInitialized()) {
      await VectorService.initialize({
        collectionName: COLLECTION_NAME,
        useOpenAI: true,
        useLocal: true
      });
    }

    // Retrieve research from database
    const results = await VectorService.searchByMetadata(COLLECTION_NAME, {
      filter: {
        must: [
          { key: 'id', match: { value: id } }
        ]
      },
      limit: 1
    });

    if (!results || results.length === 0) {
      return res.status(404).json({ error: 'Research not found' });
    }

    const research = JSON.parse(results[0].document.content);
    return res.status(200).json(research);
  } catch (error) {
    console.error('Error retrieving research:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/multiagent-research:
 *   get:
 *     summary: Get all multi-agent research requests
 *     tags: [MultiAgentResearch]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, in-progress, completed, failed]
 *         description: Filter by status
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items to return
 *     responses:
 *       200:
 *         description: List of research requests
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/MultiAgentResearch'
 */
router.get('/', async (req, res) => {
  try {
    const { status, limit = 10 } = req.query;
    
    // Initialize VectorService if not initialized
    if (!VectorService.isInitialized()) {
      await VectorService.initialize({
        collectionName: COLLECTION_NAME,
        useOpenAI: true,
        useLocal: true
      });
    }

    // Prepare filter for search
    const filter = {
      must: [
        { key: 'type', match: { value: 'multiagent-research' } }
      ]
    };

    // Add status filter if provided
    if (status) {
      filter.must.push({ key: 'status', match: { value: status } });
    }

    // Retrieve research from database
    const results = await VectorService.searchByMetadata(COLLECTION_NAME, {
      filter,
      limit: parseInt(limit)
    });

    // Parse and return results
    const research = results.map(item => JSON.parse(item.document.content));
    return res.status(200).json(research);
  } catch (error) {
    console.error('Error retrieving research list:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to process research asynchronously
async function processResearch(researchId, query) {
  try {
    // Update status to in-progress
    await updateResearchStatus(researchId, 'in-progress');

    // Run the multi-agent research workflow
    const result = await ResearchAgentSystem.runResearch(query);

    // Update the research with results
    await updateResearchResults(researchId, {
      status: 'completed',
      decomposedQuestions: result.decomposedQuestions,
      vehicleFindings: result.vehicleFindings,
      complianceFindings: result.complianceFindings,
      oemFindings: result.oemFindings,
      forumFindings: result.forumFindings,
      finalReport: result.finalReport,
      completedAt: new Date().toISOString()
    });

    console.log(`Research ${researchId} completed successfully`);
  } catch (error) {
    console.error(`Error processing research ${researchId}:`, error);
    
    // Update status to failed
    await updateResearchStatus(researchId, 'failed', error.message);
  }
}

// Helper function to update research status
async function updateResearchStatus(researchId, status, errorMessage = null) {
  try {
    // Get current research
    const results = await VectorService.searchByMetadata(COLLECTION_NAME, {
      filter: {
        must: [
          { key: 'id', match: { value: researchId } }
        ]
      },
      limit: 1
    });

    if (!results || results.length === 0) {
      throw new Error('Research not found');
    }

    // Parse current research
    const research = JSON.parse(results[0].document.content);
    
    // Update status
    research.status = status;
    
    // Add error message if provided
    if (errorMessage) {
      research.error = errorMessage;
    }
    
    // Update timestamp
    if (status === 'in-progress') {
      research.startedAt = new Date().toISOString();
    } else if (status === 'completed' || status === 'failed') {
      research.completedAt = new Date().toISOString();
    }

    // Update in database
    await VectorService.updateDocument(COLLECTION_NAME, results[0].document.id, {
      content: JSON.stringify(research),
      metadata: {
        ...results[0].document.metadata,
        status
      }
    });
  } catch (error) {
    console.error(`Error updating research status for ${researchId}:`, error);
    throw error;
  }
}

// Helper function to update research results
async function updateResearchResults(researchId, updates) {
  try {
    // Get current research
    const results = await VectorService.searchByMetadata(COLLECTION_NAME, {
      filter: {
        must: [
          { key: 'id', match: { value: researchId } }
        ]
      },
      limit: 1
    });

    if (!results || results.length === 0) {
      throw new Error('Research not found');
    }

    // Parse current research
    const research = JSON.parse(results[0].document.content);
    
    // Apply updates
    const updatedResearch = { ...research, ...updates };

    // Update in database
    await VectorService.updateDocument(COLLECTION_NAME, results[0].document.id, {
      content: JSON.stringify(updatedResearch),
      metadata: {
        ...results[0].document.metadata,
        status: updates.status || research.status
      }
    });
  } catch (error) {
    console.error(`Error updating research results for ${researchId}:`, error);
    throw error;
  }
}

export default router;