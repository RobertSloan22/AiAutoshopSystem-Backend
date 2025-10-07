import express from 'express';
import {
  getDashboardData,
  getOverview,
  getTrends,
  getVehicleSummary,
  getAlerts,
  getPerformanceMetrics,
  getRecommendations,
  getPredictions,
  getVehicleAnalysis,
  exportDashboardData,
  clearCache,
  getCacheStats
} from '../controllers/analysisDashboard.controller.js';
import { verifyToken } from '../middleware/auth.middleware.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(verifyToken);

/**
 * @swagger
 * components:
 *   schemas:
 *     DashboardData:
 *       type: object
 *       properties:
 *         overview:
 *           type: object
 *         trends:
 *           type: object
 *         vehicles:
 *           type: array
 *         alerts:
 *           type: object
 *         performance:
 *           type: object
 *         recommendations:
 *           type: array
 *         predictions:
 *           type: object
 *         generatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/analysis/dashboard:
 *   get:
 *     summary: Get comprehensive dashboard data
 *     tags: [Analysis Dashboard]
 *     parameters:
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 1y]
 *           default: 30d
 *         description: Time range for data analysis
 *       - in: query
 *         name: vehicleId
 *         schema:
 *           type: string
 *         description: Filter by specific vehicle ID
 *       - in: query
 *         name: includePredictions
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Include predictive analytics
 *     responses:
 *       200:
 *         description: Dashboard data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/DashboardData'
 *       500:
 *         description: Failed to get dashboard data
 */
router.get('/dashboard', getDashboardData);

/**
 * @swagger
 * /api/analysis/overview:
 *   get:
 *     summary: Get overview statistics
 *     tags: [Analysis Dashboard]
 *     parameters:
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 1y]
 *           default: 30d
 *         description: Time range for data analysis
 *       - in: query
 *         name: vehicleId
 *         schema:
 *           type: string
 *         description: Filter by specific vehicle ID
 *     responses:
 *       200:
 *         description: Overview statistics retrieved successfully
 *       500:
 *         description: Failed to get overview
 */
router.get('/overview', getOverview);

/**
 * @swagger
 * /api/analysis/trends:
 *   get:
 *     summary: Get trend analysis
 *     tags: [Analysis Dashboard]
 *     parameters:
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 1y]
 *           default: 30d
 *         description: Time range for data analysis
 *       - in: query
 *         name: vehicleId
 *         schema:
 *           type: string
 *         description: Filter by specific vehicle ID
 *     responses:
 *       200:
 *         description: Trend analysis retrieved successfully
 *       500:
 *         description: Failed to get trends
 */
router.get('/trends', getTrends);

/**
 * @swagger
 * /api/analysis/vehicles:
 *   get:
 *     summary: Get vehicle summary
 *     tags: [Analysis Dashboard]
 *     parameters:
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 1y]
 *           default: 30d
 *         description: Time range for data analysis
 *     responses:
 *       200:
 *         description: Vehicle summary retrieved successfully
 *       500:
 *         description: Failed to get vehicle summary
 */
router.get('/vehicles', getVehicleSummary);

/**
 * @swagger
 * /api/analysis/vehicles/{vehicleId}:
 *   get:
 *     summary: Get specific vehicle analysis
 *     tags: [Analysis Dashboard]
 *     parameters:
 *       - in: path
 *         name: vehicleId
 *         required: true
 *         schema:
 *           type: string
 *         description: Vehicle ID
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 1y]
 *           default: 30d
 *         description: Time range for data analysis
 *     responses:
 *       200:
 *         description: Vehicle analysis retrieved successfully
 *       404:
 *         description: Vehicle not found
 *       500:
 *         description: Failed to get vehicle analysis
 */
router.get('/vehicles/:vehicleId', getVehicleAnalysis);

/**
 * @swagger
 * /api/analysis/alerts:
 *   get:
 *     summary: Get alerts summary
 *     tags: [Analysis Dashboard]
 *     parameters:
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 1y]
 *           default: 30d
 *         description: Time range for data analysis
 *       - in: query
 *         name: vehicleId
 *         schema:
 *           type: string
 *         description: Filter by specific vehicle ID
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *           enum: [critical, warning, info]
 *         description: Filter by alert severity
 *     responses:
 *       200:
 *         description: Alerts summary retrieved successfully
 *       500:
 *         description: Failed to get alerts
 */
router.get('/alerts', getAlerts);

/**
 * @swagger
 * /api/analysis/performance:
 *   get:
 *     summary: Get performance metrics
 *     tags: [Analysis Dashboard]
 *     parameters:
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 1y]
 *           default: 30d
 *         description: Time range for data analysis
 *       - in: query
 *         name: vehicleId
 *         schema:
 *           type: string
 *         description: Filter by specific vehicle ID
 *     responses:
 *       200:
 *         description: Performance metrics retrieved successfully
 *       500:
 *         description: Failed to get performance metrics
 */
router.get('/performance', getPerformanceMetrics);

/**
 * @swagger
 * /api/analysis/recommendations:
 *   get:
 *     summary: Get recommendations
 *     tags: [Analysis Dashboard]
 *     parameters:
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 1y]
 *           default: 30d
 *         description: Time range for data analysis
 *       - in: query
 *         name: vehicleId
 *         schema:
 *           type: string
 *         description: Filter by specific vehicle ID
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [high, medium, low]
 *         description: Filter by recommendation priority
 *     responses:
 *       200:
 *         description: Recommendations retrieved successfully
 *       500:
 *         description: Failed to get recommendations
 */
router.get('/recommendations', getRecommendations);

/**
 * @swagger
 * /api/analysis/predictions:
 *   get:
 *     summary: Get predictions
 *     tags: [Analysis Dashboard]
 *     parameters:
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 1y]
 *           default: 30d
 *         description: Time range for data analysis
 *       - in: query
 *         name: vehicleId
 *         schema:
 *           type: string
 *         description: Filter by specific vehicle ID
 *     responses:
 *       200:
 *         description: Predictions retrieved successfully
 *       500:
 *         description: Failed to get predictions
 */
router.get('/predictions', getPredictions);

/**
 * @swagger
 * /api/analysis/export:
 *   get:
 *     summary: Export dashboard data
 *     tags: [Analysis Dashboard]
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *           default: json
 *         description: Export format
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 1y]
 *           default: 30d
 *         description: Time range for data analysis
 *       - in: query
 *         name: vehicleId
 *         schema:
 *           type: string
 *         description: Filter by specific vehicle ID
 *     responses:
 *       200:
 *         description: Dashboard data exported successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *           text/csv:
 *             schema:
 *               type: string
 *       500:
 *         description: Export failed
 */
router.get('/export', exportDashboardData);

/**
 * @swagger
 * /api/analysis/cache/clear:
 *   post:
 *     summary: Clear dashboard cache
 *     tags: [Analysis Dashboard]
 *     responses:
 *       200:
 *         description: Cache cleared successfully
 *       500:
 *         description: Failed to clear cache
 */
router.post('/cache/clear', clearCache);

/**
 * @swagger
 * /api/analysis/cache/stats:
 *   get:
 *     summary: Get cache statistics
 *     tags: [Analysis Dashboard]
 *     responses:
 *       200:
 *         description: Cache statistics retrieved successfully
 *       500:
 *         description: Failed to get cache stats
 */
router.get('/cache/stats', getCacheStats);

export default router;
