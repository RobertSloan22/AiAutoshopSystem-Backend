import express from 'express';
import {
  getResearchProgress,
  createResearchProgress,
  updateResearchProgress,
  getAllResearchProgress
} from '../controllers/researchProgress.controller.js';

const router = express.Router();

/**
 * @swagger
 * /api/research-progress:
 *   get:
 *     summary: Get all research progress entries
 *     tags: [Research Progress]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, in_progress, completed, error]
 *         description: Filter by status
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items to return
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Filter by user ID
 *     responses:
 *       200:
 *         description: List of research progress entries
 */
router.get('/', getAllResearchProgress);

/**
 * @swagger
 * /api/research-progress/{researchId}:
 *   get:
 *     summary: Get progress for a specific research task
 *     tags: [Research Progress]
 *     parameters:
 *       - in: path
 *         name: researchId
 *         required: true
 *         schema:
 *           type: string
 *         description: Research ID
 *     responses:
 *       200:
 *         description: Research progress details
 *       404:
 *         description: Research progress not found
 */
router.get('/:researchId', getResearchProgress);

/**
 * @swagger
 * /api/research-progress:
 *   post:
 *     summary: Create a new research progress entry
 *     tags: [Research Progress]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - researchId
 *               - query
 *             properties:
 *               researchId:
 *                 type: string
 *               query:
 *                 type: string
 *               userId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Research progress tracking initialized
 *       409:
 *         description: Research progress already exists for this ID
 */
router.post('/', createResearchProgress);

/**
 * @swagger
 * /api/research-progress/{researchId}:
 *   patch:
 *     summary: Update research progress
 *     tags: [Research Progress]
 *     parameters:
 *       - in: path
 *         name: researchId
 *         required: true
 *         schema:
 *           type: string
 *         description: Research ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               agentId:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [pending, in_progress, completed, error]
 *               progress:
 *                 type: object
 *                 properties:
 *                   current:
 *                     type: number
 *                   total:
 *                     type: number
 *                   percentage:
 *                     type: number
 *               message:
 *                 type: string
 *               questions:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     question:
 *                       type: string
 *                     category:
 *                       type: string
 *                     completed:
 *                       type: boolean
 *               errorMessage:
 *                 type: string
 *               result:
 *                 type: object
 *                 description: Final research result
 *     responses:
 *       200:
 *         description: Research progress updated
 *       404:
 *         description: Research progress not found
 */
router.patch('/:researchId', updateResearchProgress);

export default router;