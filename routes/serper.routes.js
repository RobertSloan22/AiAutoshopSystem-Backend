import express from 'express';
import { searchImages } from '../controllers/serper.controller.js';
import protectRoute from "../middleware/protectRoute.js";

const router = express.Router();

// Apply protection middleware

// Protected routes
router.post('/images', searchImages);

export default router;