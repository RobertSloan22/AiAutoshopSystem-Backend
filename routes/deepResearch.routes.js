import express from 'express';
import deepResearchService from '../services/deepResearchService.js';

const router = express.Router();

// Initialize the deep research service
let serviceInitialized = false;

const initializeService = async () => {
    if (!serviceInitialized) {
        try {
            await deepResearchService.initialize();
            serviceInitialized = true;
            console.log('✅ Deep Research Service initialized for routes');
        } catch (error) {
            console.error('❌ Failed to initialize Deep Research Service:', error);
            throw error;
        }
    }
};

// Middleware to ensure service is initialized
const ensureServiceInitialized = async (req, res, next) => {
    try {
        await initializeService();
        next();
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Deep Research Service initialization failed',
            message: error.message
        });
    }
};

/**
 * @swagger
 * /api/deep-research/health:
 *   get:
 *     summary: Check deep research service health
 *     tags: [Deep Research]
 *     responses:
 *       200:
 *         description: Service health status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 status:
 *                   type: string
 *                 healthy:
 *                   type: boolean
 */
router.get('/health', async (req, res) => {
    try {
        const healthStatus = await deepResearchService.healthCheck();
        res.json({
            success: healthStatus.healthy,
            ...healthStatus
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Health check failed',
            message: error.message
        });
    }
});

/**
 * @swagger
 * /api/deep-research/conduct:
 *   post:
 *     summary: Conduct comprehensive automotive research
 *     tags: [Deep Research]
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
 *                 description: Research query
 *               mockAnswers:
 *                 type: object
 *                 description: Pre-filled answers to potential clarification questions
 *               options:
 *                 type: object
 *                 properties:
 *                   verbose:
 *                     type: boolean
 *                     description: Enable verbose logging
 *                   timeout:
 *                     type: number
 *                     description: Timeout in milliseconds
 *     responses:
 *       200:
 *         description: Research completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 research:
 *                   type: string
 *                   description: Research results
 *                 citations:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       title:
 *                         type: string
 *                       url:
 *                         type: string
 *                       excerpt:
 *                         type: string
 *                 metadata:
 *                   type: object
 */
router.post('/conduct', ensureServiceInitialized, async (req, res) => {
    try {
        const { query, mockAnswers = {}, options = {} } = req.body;

        if (!query || typeof query !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Valid query string is required'
            });
        }

        console.log(`🔍 Received deep research request: "${query}"`);
        
        const result = await deepResearchService.conductResearch(query, mockAnswers, options);
        
        res.json(result);
    } catch (error) {
        console.error('❌ Deep research error:', error);
        res.status(500).json({
            success: false,
            error: 'Research failed',
            message: error.message
        });
    }
});

/**
 * @swagger
 * /api/deep-research/quick:
 *   post:
 *     summary: Conduct quick automotive research
 *     tags: [Deep Research]
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
 *                 description: Research query
 *               options:
 *                 type: object
 *                 properties:
 *                   timeout:
 *                     type: number
 *                     description: Timeout in milliseconds
 *     responses:
 *       200:
 *         description: Quick research completed successfully
 */
router.post('/quick', ensureServiceInitialized, async (req, res) => {
    try {
        const { query, options = {} } = req.body;

        if (!query || typeof query !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Valid query string is required'
            });
        }

        console.log(`⚡ Received quick research request: "${query}"`);
        
        const result = await deepResearchService.quickResearch(query, options);
        
        res.json(result);
    } catch (error) {
        console.error('❌ Quick research error:', error);
        res.status(500).json({
            success: false,
            error: 'Quick research failed',
            message: error.message
        });
    }
});

/**
 * @swagger
 * /api/deep-research/dtc-codes:
 *   post:
 *     summary: Research specific DTC (Diagnostic Trouble Codes)
 *     tags: [Deep Research]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - dtcCodes
 *             properties:
 *               dtcCodes:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: List of DTC codes to research
 *               vehicleInfo:
 *                 type: object
 *                 properties:
 *                   year:
 *                     type: string
 *                   make:
 *                     type: string
 *                   model:
 *                     type: string
 *                   engine:
 *                     type: string
 *                   vin:
 *                     type: string
 *                   symptoms:
 *                     type: string
 *     responses:
 *       200:
 *         description: DTC research completed successfully
 */
router.post('/dtc-codes', ensureServiceInitialized, async (req, res) => {
    try {
        const { dtcCodes, vehicleInfo = {} } = req.body;

        if (!Array.isArray(dtcCodes) || dtcCodes.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Valid DTC codes array is required'
            });
        }

        console.log(`🔧 Received DTC research request for codes: ${dtcCodes.join(', ')}`);
        
        const result = await deepResearchService.researchDTCCodes(dtcCodes, vehicleInfo);
        
        res.json(result);
    } catch (error) {
        console.error('❌ DTC research error:', error);
        res.status(500).json({
            success: false,
            error: 'DTC research failed',
            message: error.message
        });
    }
});

/**
 * @swagger
 * /api/deep-research/parts-compatibility:
 *   post:
 *     summary: Research automotive parts compatibility
 *     tags: [Deep Research]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - partQuery
 *             properties:
 *               partQuery:
 *                 type: string
 *                 description: Parts search query
 *               vehicleInfo:
 *                 type: object
 *                 properties:
 *                   year:
 *                     type: string
 *                   make:
 *                     type: string
 *                   model:
 *                     type: string
 *                   engine:
 *                     type: string
 *                   vin:
 *                     type: string
 *     responses:
 *       200:
 *         description: Parts compatibility research completed successfully
 */
router.post('/parts-compatibility', ensureServiceInitialized, async (req, res) => {
    try {
        const { partQuery, vehicleInfo = {} } = req.body;

        if (!partQuery || typeof partQuery !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Valid part query string is required'
            });
        }

        console.log(`🔩 Received parts compatibility request: "${partQuery}"`);
        
        const result = await deepResearchService.researchPartsCompatibility(partQuery, vehicleInfo);
        
        res.json(result);
    } catch (error) {
        console.error('❌ Parts compatibility research error:', error);
        res.status(500).json({
            success: false,
            error: 'Parts compatibility research failed',
            message: error.message
        });
    }
});

/**
 * @swagger
 * /api/deep-research/initialize:
 *   post:
 *     summary: Manually initialize the deep research service
 *     tags: [Deep Research]
 *     responses:
 *       200:
 *         description: Service initialized successfully
 */
router.post('/initialize', async (req, res) => {
    try {
        await deepResearchService.initialize();
        serviceInitialized = true;
        
        res.json({
            success: true,
            message: 'Deep Research Service initialized successfully',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Manual initialization error:', error);
        res.status(500).json({
            success: false,
            error: 'Initialization failed',
            message: error.message
        });
    }
});

// Error handling middleware
router.use((error, req, res, next) => {
    console.error('Deep Research Route Error:', error);
    res.status(500).json({
        success: false,
        error: 'Internal server error in deep research service',
        message: error.message
    });
});

export default router;