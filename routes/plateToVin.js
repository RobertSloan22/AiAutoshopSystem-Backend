import express from 'express';
import { getVinFromPlate } from '../controllers/plateToVinController.js';

const router = express.Router();

// Route to get VIN from license plate
router.get('/lookup', getVinFromPlate);

export default router;