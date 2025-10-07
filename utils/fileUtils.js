import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directory to store temporary files
export const TEMP_DIR = path.join(__dirname, '..', 'temp');

/**
 * Ensures the temporary directory exists
 */
export const ensureTempDir = () => {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR);
  }
};

/**
 * Creates a set of temporary file paths with a unique timestamp
 * @returns {Object} - Object containing paths for various files
 */
export const createTempFilePaths = () => {
  const timestamp = Date.now();
  return {
    diagramPath: path.join(TEMP_DIR, `diagram-${timestamp}.png`),
    promptPath: path.join(TEMP_DIR, `prompt-${timestamp}.txt`),
    responsePath: path.join(TEMP_DIR, `response-${timestamp}.txt`),
    scriptPath: path.join(TEMP_DIR, `blender-script-${timestamp}.py`),
    cursorScriptPath: path.join(TEMP_DIR, `cursor-script-${timestamp}.js`),
    renderPath: path.join(TEMP_DIR, `render-${timestamp}.png`),
    timestamp
  };
};

/**
 * Reads a file and returns it as a base64 encoded string
 * @param {string} filePath - Path to the file
 * @returns {string} - Base64 encoded file data
 */
export const fileToBase64 = (filePath) => {
  const fileData = fs.readFileSync(filePath);
  return fileData.toString('base64');
};

/**
 * Cleanup temporary files
 * @param {Array} filePaths - Array of file paths to delete
 */
export const cleanupTempFiles = (filePaths) => {
  filePaths.forEach(file => {
    try { 
      if (fs.existsSync(file)) {
        fs.unlinkSync(file); 
      }
    } catch (e) { 
      console.error(`Failed to delete ${file}: ${e.message}`); 
    }
  });
}; 