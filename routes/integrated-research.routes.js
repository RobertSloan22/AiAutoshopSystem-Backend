import express from 'express';
import { performResearch, performStreamingResearch, healthCheck } from '../controllers/research.controller.js';

const router = express.Router();

// Health check endpoint
router.get('/health', healthCheck);

// Regular research endpoint
router.post('/research', performResearch);

// Streaming research endpoint
router.post('/research/stream', performStreamingResearch);

export default router;