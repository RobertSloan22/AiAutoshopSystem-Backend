import express from 'express';
import { storeData, queryData, testConnections } from '../controllers/vectorStore.controller.js';

const router = express.Router();

// Store data in vector store
router.post('/store', storeData);

// Query vector store
router.post('/query', queryData);

// Test connections
router.get('/test', testConnections);

export default router; 