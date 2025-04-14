// blender.js - Express server that handles image processing with Cursor and Blender
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import blenderRoutes from './routes/blenderRoutes.js';
import { ensureTempDir, TEMP_DIR } from './utils/fileUtils.js';

// Get current directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Initialize Blender functionality with the given app
 * @param {Object} app - Express app
 */
export const initializeBlender = (app) => {
  // Ensure temp directory exists
  ensureTempDir();

  // Serve static files from the temp directory
  app.use('/temp', express.static(TEMP_DIR));

  // Use blender routes
  app.use('/api/blender', blenderRoutes);
  
  console.log('Blender processing functionality initialized');
};

// Export the routes for direct access if needed
export { blenderRoutes };

// Export the necessary utility functions
export { ensureTempDir }; 