import express from 'express';
import {
  getAllAgentReports,
  getAgentReportById,
  searchAgentReports,
  getAgentReportsByDateRange,
  getAgentReportsByVehicle,
  getAgentReportsByStatus,
  getAgentReportsStats,
  deleteAgentReport,
  updateAgentReportTags
} from '../controllers/agent-reports.controller.js';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     AgentReport:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: MongoDB ID of the report
 *         researchId:
 *           type: string
 *           description: UUID of the research session
 *         query:
 *           type: string
 *           description: Original search query
 *         executiveSummary:
 *           type: string
 *           description: Executive summary of the report
 *         result:
 *           type: object
 *           description: Complete report data including diagnosis, parts, labor analysis
 *         metadata:
 *           type: object
 *           properties:
 *             agentType:
 *               type: string
 *               description: Type of agent that generated the report
 *             processingTime:
 *               type: number
 *               description: Time taken to generate report in ms
 *             searchCount:
 *               type: number
 *               description: Number of searches performed
 *         vehicle:
 *           type: object
 *           properties:
 *             year:
 *               type: string
 *             make:
 *               type: string
 *             model:
 *               type: string
 *             vin:
 *               type: string
 *         status:
 *           type: string
 *           enum: [pending, completed, failed]
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/agent-reports:
 *   get:
 *     summary: Get all agent reports with pagination and filtering
 *     tags: [AgentReports]
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
 *           default: 20
 *         description: Results per page
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, updatedAt, query]
 *           default: createdAt
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, completed, failed]
 *         description: Filter by status
 *     responses:
 *       200:
 *         description: List of agent reports
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/AgentReport'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     pages:
 *                       type: integer
 *       500:
 *         description: Server error
 */
router.get('/', getAllAgentReports);

/**
 * @swagger
 * /api/agent-reports/search:
 *   get:
 *     summary: Search agent reports by query text
 *     tags: [AgentReports]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query
 *       - in: query
 *         name: searchIn
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *             enum: [query, executiveSummary, tags]
 *           default: [query, executiveSummary]
 *         description: Fields to search in
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Maximum results to return
 *     responses:
 *       200:
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/AgentReport'
 *                 count:
 *                   type: integer
 *                   description: Number of results found
 *       400:
 *         description: Invalid search query
 *       500:
 *         description: Server error
 */
router.get('/search', searchAgentReports);

/**
 * @swagger
 * /api/agent-reports/by-date:
 *   get:
 *     summary: Get agent reports by date range
 *     tags: [AgentReports]
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: End date (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Reports within date range
 *       400:
 *         description: Invalid date format
 *       500:
 *         description: Server error
 */
router.get('/by-date', getAgentReportsByDateRange);

/**
 * @swagger
 * /api/agent-reports/by-vehicle:
 *   get:
 *     summary: Get agent reports by vehicle information
 *     tags: [AgentReports]
 *     parameters:
 *       - in: query
 *         name: make
 *         schema:
 *           type: string
 *         description: Vehicle make
 *       - in: query
 *         name: model
 *         schema:
 *           type: string
 *         description: Vehicle model
 *       - in: query
 *         name: year
 *         schema:
 *           type: string
 *         description: Vehicle year
 *       - in: query
 *         name: vin
 *         schema:
 *           type: string
 *         description: Vehicle VIN
 *     responses:
 *       200:
 *         description: Reports for specified vehicle
 *       500:
 *         description: Server error
 */
router.get('/by-vehicle', getAgentReportsByVehicle);

/**
 * @swagger
 * /api/agent-reports/by-status/{status}:
 *   get:
 *     summary: Get agent reports by status
 *     tags: [AgentReports]
 *     parameters:
 *       - in: path
 *         name: status
 *         required: true
 *         schema:
 *           type: string
 *           enum: [pending, completed, failed]
 *         description: Report status
 *     responses:
 *       200:
 *         description: Reports with specified status
 *       400:
 *         description: Invalid status
 *       500:
 *         description: Server error
 */
router.get('/by-status/:status', getAgentReportsByStatus);

/**
 * @swagger
 * /api/agent-reports/stats:
 *   get:
 *     summary: Get statistics about agent reports
 *     tags: [AgentReports]
 *     responses:
 *       200:
 *         description: Report statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalReports:
 *                       type: integer
 *                     reportsByStatus:
 *                       type: object
 *                       properties:
 *                         pending:
 *                           type: integer
 *                         completed:
 *                           type: integer
 *                         failed:
 *                           type: integer
 *                     reportsByMonth:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           month:
 *                             type: string
 *                           count:
 *                             type: integer
 *                     topSearchQueries:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           query:
 *                             type: string
 *                           count:
 *                             type: integer
 *       500:
 *         description: Server error
 */
router.get('/stats', getAgentReportsStats);

/**
 * @swagger
 * /api/agent-reports/{id}:
 *   get:
 *     summary: Get agent report by ID
 *     tags: [AgentReports]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Report ID (MongoDB ID or researchId)
 *     responses:
 *       200:
 *         description: Agent report found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/AgentReport'
 *       404:
 *         description: Report not found
 *       500:
 *         description: Server error
 */
router.get('/:id', getAgentReportById);

/**
 * @swagger
 * /api/agent-reports/{id}/tags:
 *   patch:
 *     summary: Update tags for an agent report
 *     tags: [AgentReports]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Report ID
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
 *                 description: New tags for the report
 *     responses:
 *       200:
 *         description: Tags updated successfully
 *       404:
 *         description: Report not found
 *       500:
 *         description: Server error
 */
router.patch('/:id/tags', updateAgentReportTags);

/**
 * @swagger
 * /api/agent-reports/{id}:
 *   delete:
 *     summary: Delete an agent report
 *     tags: [AgentReports]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Report ID
 *     responses:
 *       200:
 *         description: Report deleted successfully
 *       404:
 *         description: Report not found
 *       500:
 *         description: Server error
 */
router.delete('/:id', deleteAgentReport);

export default router;