import express from 'express';
import { getSingleEmbedding, getBatchEmbeddings } from '../controllers/embeddings.controller.js';

const router = express.Router();

// Route for getting a single embedding
router.post('/single', getSingleEmbedding);

// Route for getting batch embeddings
router.post('/batch', getBatchEmbeddings);

export default router; 