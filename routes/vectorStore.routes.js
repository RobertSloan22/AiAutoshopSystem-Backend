import express from 'express';
import { storeData, queryData, testConnections } from '../controllers/vectorStore.controller.js';
import { createStore } from '../controllers/vectorStore/createStore.js';
import { retrieveStore } from '../controllers/vectorStore/retrieveStore.js';
import { addFile } from '../controllers/vectorStore/addFile.js';
import { listFiles } from '../controllers/vectorStore/listFiles.js';
import { uploadFile } from '../controllers/vectorStore/uploadFile.js';
import protectRoute from '../middleware/protectRoute.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(protectRoute);

// Store data in vector store
router.post('/store', storeData);

// Query vector store
router.post('/query', queryData);

// Test connections
router.get('/test', testConnections);

// Vector Store endpoints
router.post('/create', createStore);
router.get('/retrieve/:storeId', retrieveStore);
router.post('/add-file', addFile);
router.get('/list-files', listFiles);
router.post('/upload', uploadFile);

export default router; 