import express from 'express';
import {
  saveComprehensiveReport,
  getLatestReport,
  getAllReports,
  getReportById,
  updateReport,
  deleteReport,
  getAllComprehensiveReports
} from '../controllers/comprehensiveReport.controller.js';

const router = express.Router();

// Session-based report routes
router.post('/sessions/:sessionId/reports', saveComprehensiveReport);
router.get('/sessions/:sessionId/reports/latest', getLatestReport);
router.get('/sessions/:sessionId/reports', getAllReports);

// Individual report routes
router.get('/reports/all', getAllComprehensiveReports); // Must be before /:reportId to avoid conflicts
router.get('/reports/:reportId', getReportById);
router.put('/reports/:reportId', updateReport);
router.delete('/reports/:reportId', deleteReport);

export default router;