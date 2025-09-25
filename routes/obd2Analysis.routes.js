import express from 'express';
import {
  analyzeSession,
  getAnalysisResults,
  analyzeParameters,
  getVehicleAnalysisSummary,
  getDetailedAnalysis,
  exportAnalysisResults,
  getAnalysisStatistics
} from '../controllers/obd2Analysis.controller.js';
import { verifyToken } from '../middleware/auth.middleware.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(verifyToken);

/**
 * @swagger
 * components:
 *   schemas:
 *     AnalysisResult:
 *       type: object
 *       properties:
 *         analysisId:
 *           type: string
 *         sessionId:
 *           type: string
 *         vehicleId:
 *           type: string
 *         vehicleInfo:
 *           type: object
 *         sessionInfo:
 *           type: object
 *         analysisResults:
 *           type: object
 *         summary:
 *           type: object
 *         processingTime:
 *           type: number
 *         generatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/obd2/sessions/{sessionId}/analyze:
 *   post:
 *     summary: Analyze a complete OBD2 session
 *     tags: [OBD2 Analysis]
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Session ID to analyze
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               analysisType:
 *                 type: string
 *                 enum: [comprehensive, performance, diagnostics, fuel_efficiency, maintenance, driving_behavior]
 *                 default: comprehensive
 *               options:
 *                 type: object
 *                 description: Analysis-specific options
 *     responses:
 *       200:
 *         description: Analysis completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/AnalysisResult'
 *       400:
 *         description: Insufficient data for analysis
 *       404:
 *         description: Session not found
 *       500:
 *         description: Analysis failed
 */
router.post('/sessions/:sessionId/analyze', analyzeSession);

/**
 * @swagger
 * /api/obd2/sessions/{sessionId}/analysis:
 *   get:
 *     summary: Get analysis results for a session
 *     tags: [OBD2 Analysis]
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Session ID
 *     responses:
 *       200:
 *         description: Analysis results retrieved successfully
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
 *                     sessionId:
 *                       type: string
 *                     processingStatus:
 *                       type: string
 *                     analysisResults:
 *                       type: array
 *                     errors:
 *                       type: array
 *       404:
 *         description: Session not found
 *       500:
 *         description: Failed to get analysis results
 */
router.get('/sessions/:sessionId/analysis', getAnalysisResults);

/**
 * @swagger
 * /api/obd2/sessions/{sessionId}/analyze-parameters:
 *   post:
 *     summary: Analyze specific parameters for a session
 *     tags: [OBD2 Analysis]
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Session ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - parameters
 *             properties:
 *               parameters:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of parameter IDs or names to analyze
 *               analysisOptions:
 *                 type: object
 *                 description: Analysis-specific options
 *     responses:
 *       200:
 *         description: Parameter analysis completed successfully
 *       400:
 *         description: Invalid parameters
 *       404:
 *         description: Session not found
 *       500:
 *         description: Analysis failed
 */
router.post('/sessions/:sessionId/analyze-parameters', analyzeParameters);

/**
 * @swagger
 * /api/obd2/vehicles/{vehicleId}/analysis-summary:
 *   get:
 *     summary: Get analysis summary for a vehicle
 *     tags: [OBD2 Analysis]
 *     parameters:
 *       - in: path
 *         name: vehicleId
 *         required: true
 *         schema:
 *           type: string
 *         description: Vehicle ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Maximum number of recent sessions to include
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for filtering sessions
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for filtering sessions
 *     responses:
 *       200:
 *         description: Analysis summary retrieved successfully
 *       500:
 *         description: Failed to get analysis summary
 */
router.get('/vehicles/:vehicleId/analysis-summary', getVehicleAnalysisSummary);

/**
 * @swagger
 * /api/obd2/sessions/{sessionId}/analysis/{analysisId}:
 *   get:
 *     summary: Get detailed analysis for a specific analysis result
 *     tags: [OBD2 Analysis]
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Session ID
 *       - in: path
 *         name: analysisId
 *         required: true
 *         schema:
 *           type: string
 *         description: Analysis result ID
 *     responses:
 *       200:
 *         description: Detailed analysis retrieved successfully
 *       404:
 *         description: Session or analysis not found
 *       500:
 *         description: Failed to get detailed analysis
 */
router.get('/sessions/:sessionId/analysis/:analysisId', getDetailedAnalysis);

/**
 * @swagger
 * /api/obd2/sessions/{sessionId}/analysis/export:
 *   get:
 *     summary: Export analysis results
 *     tags: [OBD2 Analysis]
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Session ID
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *           default: json
 *         description: Export format
 *     responses:
 *       200:
 *         description: Analysis results exported successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *           text/csv:
 *             schema:
 *               type: string
 *       404:
 *         description: Session not found
 *       500:
 *         description: Export failed
 */
router.get('/sessions/:sessionId/analysis/export', exportAnalysisResults);

/**
 * @swagger
 * /api/obd2/analysis/statistics:
 *   get:
 *     summary: Get analysis statistics
 *     tags: [OBD2 Analysis]
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for filtering
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for filtering
 *       - in: query
 *         name: vehicleId
 *         schema:
 *           type: string
 *         description: Vehicle ID for filtering
 *     responses:
 *       200:
 *         description: Analysis statistics retrieved successfully
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
 *                     totalSessions:
 *                       type: integer
 *                     analyzedSessions:
 *                       type: integer
 *                     totalAnalyses:
 *                       type: integer
 *                     successRate:
 *                       type: number
 *                     analysisRate:
 *                       type: number
 *                     averageAnalysesPerSession:
 *                       type: number
 *       500:
 *         description: Failed to get statistics
 */
router.get('/analysis/statistics', getAnalysisStatistics);

export default router;
