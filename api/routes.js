import express from 'express';
import turnResponseRoutes from '../routes/turnResponse.routes.js';

const router = express.Router();

// Vector Store Routes
import createStore from './vector_stores/create_store/route.js';
import retrieveStore from './vector_stores/retrieve_store/route.js';
import addFile from './vector_stores/add_file/route.js';
import listFiles from './vector_stores/list_files/route.js';
import uploadFile from './vector_stores/upload_file/route.js';

// Turn Response Route
import turnResponse from './turn_response/route.js';

// Function Routes
import getJoke from './functions/get_joke/route.js';
import getWeather from './functions/get_weather/route.js';

// Mount the turn response routes at /v1/responses to match frontend
router.use('/v1/responses', turnResponseRoutes);

// Vector Store endpoints
router.post('/vector-store/create', createStore);
router.get('/vector-store/retrieve/:storeId', retrieveStore);
router.post('/vector-store/add-file', addFile);
router.get('/vector-store/list-files', listFiles);
router.post('/vector-store/upload', uploadFile);

// Turn Response endpoint
router.post('/turn-response', turnResponse);

// Function endpoints
router.get('/functions/joke', getJoke);
router.get('/functions/weather', getWeather);

export default router; 