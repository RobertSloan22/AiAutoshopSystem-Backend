import express from 'express';
import { handleTurnResponse } from '../controllers/turnResponse/handler.js';

const router = express.Router();

// Route for handling turn responses
router.post('/', handleTurnResponse);

export default router; 