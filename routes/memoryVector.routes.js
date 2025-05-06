import express from 'express';
import { MemoryVectorService } from '../services/MemoryVectorService.js';

const router = express.Router();

/**
 * @swagger
 * /api/memory-vector/instances:
 *   get:
 *     summary: Get all memory vector store instances
 *     tags: [Memory Vector Store]
 *     responses:
 *       200:
 *         description: List of all memory vector store instances and their sizes
 */
router.get('/instances', async (req, res) => {
    try {
        const instances = MemoryVectorService.getAllInstances();
        
        // Get size of each instance
        const instanceInfo = {};
        Object.keys(instances).forEach(name => {
            instanceInfo[name] = {
                size: MemoryVectorService.getSize(name),
                created: new Date().toISOString()
            };
        });
        
        res.json({
            success: true,
            instances: instanceInfo
        });
    } catch (error) {
        console.error('Error retrieving memory vector instances:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Failed to retrieve memory vector instances'
        });
    }
});

/**
 * @swagger
 * /api/memory-vector/create:
 *   post:
 *     summary: Create a new memory vector store instance
 *     tags: [Memory Vector Store]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               instanceName:
 *                 type: string
 *     responses:
 *       200:
 *         description: Memory vector store instance created
 */
router.post('/create', async (req, res) => {
    try {
        const { instanceName } = req.body;
        
        if (!instanceName) {
            return res.status(400).json({
                success: false,
                message: 'Instance name is required'
            });
        }
        
        await MemoryVectorService.initialize(instanceName);
        
        res.json({
            success: true,
            message: `Memory vector store '${instanceName}' created successfully`
        });
    } catch (error) {
        console.error('Error creating memory vector instance:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Failed to create memory vector instance'
        });
    }
});

/**
 * @swagger
 * /api/memory-vector/add:
 *   post:
 *     summary: Add documents to a memory vector store
 *     tags: [Memory Vector Store]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               instanceName:
 *                 type: string
 *               documents:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     pageContent:
 *                       type: string
 *                     metadata:
 *                       type: object
 *               splitText:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Documents added successfully
 */
router.post('/add', async (req, res) => {
    try {
        const { instanceName = 'default', documents, splitText = false } = req.body;
        
        if (!documents || !Array.isArray(documents) || documents.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid documents array is required'
            });
        }
        
        const options = { splitText };
        const success = await MemoryVectorService.addDocuments(instanceName, documents, options);
        
        if (success) {
            res.json({
                success: true,
                message: `Added ${documents.length} documents to memory vector store '${instanceName}'`,
                instanceSize: MemoryVectorService.getSize(instanceName)
            });
        } else {
            res.status(500).json({
                success: false,
                message: `Failed to add documents to memory vector store '${instanceName}'`
            });
        }
    } catch (error) {
        console.error('Error adding documents to memory vector store:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Failed to add documents to memory vector store'
        });
    }
});

/**
 * @swagger
 * /api/memory-vector/search:
 *   post:
 *     summary: Search for similar documents in a memory vector store
 *     tags: [Memory Vector Store]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               instanceName:
 *                 type: string
 *               query:
 *                 type: string
 *               k:
 *                 type: number
 *     responses:
 *       200:
 *         description: Search results
 */
router.post('/search', async (req, res) => {
    try {
        const { instanceName = 'default', query, k = 5 } = req.body;
        
        if (!query) {
            return res.status(400).json({
                success: false,
                message: 'Query is required'
            });
        }
        
        const results = await MemoryVectorService.similaritySearch(instanceName, query, k);
        
        res.json({
            success: true,
            results,
            count: results.length
        });
    } catch (error) {
        console.error('Error searching memory vector store:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Failed to search memory vector store'
        });
    }
});

/**
 * @swagger
 * /api/memory-vector/clear:
 *   post:
 *     summary: Clear a memory vector store instance
 *     tags: [Memory Vector Store]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               instanceName:
 *                 type: string
 *     responses:
 *       200:
 *         description: Memory vector store instance cleared
 */
router.post('/clear', async (req, res) => {
    try {
        const { instanceName = 'default' } = req.body;
        
        const success = await MemoryVectorService.clear(instanceName);
        
        if (success) {
            res.json({
                success: true,
                message: `Memory vector store '${instanceName}' cleared successfully`
            });
        } else {
            res.status(404).json({
                success: false,
                message: `Memory vector store '${instanceName}' not found`
            });
        }
    } catch (error) {
        console.error('Error clearing memory vector store:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Failed to clear memory vector store'
        });
    }
});

/**
 * @swagger
 * /api/memory-vector/delete:
 *   post:
 *     summary: Delete a memory vector store instance
 *     tags: [Memory Vector Store]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               instanceName:
 *                 type: string
 *     responses:
 *       200:
 *         description: Memory vector store instance deleted
 */
router.post('/delete', async (req, res) => {
    try {
        const { instanceName = 'default' } = req.body;
        
        // Prevent deletion of core instances
        if (['default', 'user_sessions', 'forum_crawler'].includes(instanceName)) {
            return res.status(403).json({
                success: false,
                message: `Cannot delete core instance '${instanceName}'`
            });
        }
        
        const success = MemoryVectorService.delete(instanceName);
        
        if (success) {
            res.json({
                success: true,
                message: `Memory vector store '${instanceName}' deleted successfully`
            });
        } else {
            res.status(404).json({
                success: false,
                message: `Memory vector store '${instanceName}' not found`
            });
        }
    } catch (error) {
        console.error('Error deleting memory vector store:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Failed to delete memory vector store'
        });
    }
});

export default router; 