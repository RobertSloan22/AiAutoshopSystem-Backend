import express from 'express';
import { searchImages } from '../controllers/image.controller.js';
import protectRoute from "../middleware/protectRoute.js";
import { verifyToken } from '../middleware/auth.middleware.js';

const router = express.Router();

// Apply protection middleware

// Protected routes
router.post('/images', searchImages);

export default router;