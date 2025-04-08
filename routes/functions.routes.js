import express from 'express';
import { getWeather } from '../controllers/functions/getWeather.js';
import protectRoute from '../middleware/protectRoute.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(protectRoute);

// Function endpoints
router.get('/weather', getWeather);

export default router; 