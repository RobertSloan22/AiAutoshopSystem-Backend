import express from 'express';
import {
  ingestOBD2Data,
  getOBD2DataHistory,
  getVehicleCurrentState,
  triggerDataAnalysis,
  getAnalysisResults,
  streamOBD2Data,
  getDTCHistory,
  clearDTCCodes,
  startOBD2Session,
  endOBD2Session,
  bulkIngestOBD2Data,
  getDataQualityReport,
  exportOBD2Data
} from '../controllers/obd2.controller.js';
import protectRoute from '../middleware/protectRoute.js';

const router = express.Router();

// Session management
router.post('/session/start', protectRoute, startOBD2Session);
router.post('/session/end/:sessionId', protectRoute, endOBD2Session);

// Data ingestion endpoints
router.post('/ingest', protectRoute, ingestOBD2Data);
router.post('/ingest/bulk', protectRoute, bulkIngestOBD2Data);

// Data streaming (WebSocket endpoint handled separately)
router.get('/stream/:sessionId', protectRoute, streamOBD2Data);

// Data retrieval endpoints
router.get('/history/:vehicleId', protectRoute, getOBD2DataHistory);
router.get('/current-state/:vehicleId', protectRoute, getVehicleCurrentState);
router.get('/dtc-history/:vehicleId', protectRoute, getDTCHistory);

// Analysis endpoints
router.post('/analyze/:sessionId', protectRoute, triggerDataAnalysis);
router.get('/analysis/:sessionId', protectRoute, getAnalysisResults);

// Maintenance and utilities
router.delete('/dtc/clear/:vehicleId', protectRoute, clearDTCCodes);
router.get('/data-quality/:sessionId', protectRoute, getDataQualityReport);
router.get('/export/:vehicleId', protectRoute, exportOBD2Data);

export default router;