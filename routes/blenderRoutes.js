import express from 'express';
import multer from 'multer';
import { 
  generateScene, 
  getSceneInfo, 
  getObjectInfo,
  executeCustomCode 
} from '../controllers/blenderController.js';

// Configure multer for handling file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

const router = express.Router();

// Route to generate a 3D scene from a diagram
router.post('/generate-scene', upload.single('diagram'), generateScene);

// Route to get scene information from Blender
router.get('/scene-info', getSceneInfo);

// Route to get object information from Blender
router.get('/object-info/:objectName', getObjectInfo);

// Route to execute custom Blender code
router.post('/execute-code', executeCustomCode);

export default router; 