import express from 'express';
import {
  saveResearchResult,
  getResearchResultById,
  getResearchResults,
  updateResearchResult,
  deleteResearchResult,
  searchResearchResults
} from '../controllers/researchResult.controller.js';

// Import auth middleware if needed
// import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     ResearchResult:
 *       type: object
 *       required:
 *         - query
 *         - result
 *       properties:
 *         _id:
 *           type: string
 *           description: The auto-generated ID of the research result
 *         query:
 *           type: string
 *           description: The query used for the research
 *         result:
 *           type: object
 *           description: The result of the research
 *         sources:
 *           type: array
 *           items:
 *             type: string
 *           description: Sources used for the research
 *         metadata:
 *           type: object
 *           description: Additional metadata about the research
 *         userId:
 *           type: string
 *           description: The user who initiated the research
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *           description: Tags associated with the research
 *         status:
 *           type: string
 *           enum: [pending, in-progress, completed, failed]
 *           description: The status of the research
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: When the research was created
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: When the research was last updated
 */

/**
 * @swagger
 * /api/research-results:
 *   post:
 *     summary: Save a new research result
 *     tags: [ResearchResults]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - query
 *               - result
 *             properties:
 *               query:
 *                 type: string
 *               result:
 *                 type: object
 *               sources:
 *                 type: array
 *                 items:
 *                   type: string
 *               metadata:
 *                 type: object
 *               userId:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Research result saved successfully
 *       400:
 *         description: Invalid input
 *       500:
 *         description: Server error
 */
router.post('/', saveResearchResult);

/**
 * @swagger
 * /api/research-results/{id}:
 *   get:
 *     summary: Get research result by ID
 *     tags: [ResearchResults]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The research result ID
 *     responses:
 *       200:
 *         description: Research result found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ResearchResult'
 *       404:
 *         description: Research result not found
 *       500:
 *         description: Server error
 */
router.get('/:id', getResearchResultById);

/**
 * @swagger
 * /api/research-results:
 *   get:
 *     summary: Get all research results with pagination and filtering
 *     tags: [ResearchResults]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Results per page
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Filter by user ID
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *         description: Filter by tags (comma-separated)
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Text search in query field
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date filter (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date filter (YYYY-MM-DD)
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, in-progress, completed, failed]
 *         description: Filter by status
 *     responses:
 *       200:
 *         description: List of research results
 *       500:
 *         description: Server error
 */
router.get('/', getResearchResults);

/**
 * @swagger
 * /api/research-results/{id}:
 *   put:
 *     summary: Update a research result by ID
 *     tags: [ResearchResults]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The research result ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               metadata:
 *                 type: object
 *               status:
 *                 type: string
 *                 enum: [pending, in-progress, completed, failed]
 *     responses:
 *       200:
 *         description: Research result updated successfully
 *       404:
 *         description: Research result not found
 *       500:
 *         description: Server error
 */
router.put('/:id', updateResearchResult);

/**
 * @swagger
 * /api/research-results/{id}:
 *   delete:
 *     summary: Delete a research result by ID
 *     tags: [ResearchResults]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The research result ID
 *     responses:
 *       200:
 *         description: Research result deleted successfully
 *       404:
 *         description: Research result not found
 *       500:
 *         description: Server error
 */
router.delete('/:id', deleteResearchResult);

/**
 * @swagger
 * /api/research-results/search:
 *   get:
 *     summary: Search research results by query text
 *     tags: [ResearchResults]
 *     parameters:
 *       - in: query
 *         name: query
 *         required: true
 *         schema:
 *           type: string
 *         description: The search query
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Maximum number of results to return
 *     responses:
 *       200:
 *         description: Search results
 *       400:
 *         description: Missing required parameters
 *       500:
 *         description: Server error
 */
router.get('/search', searchResearchResults);

export default router;