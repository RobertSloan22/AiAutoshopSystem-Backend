import express from 'express';
import OpenAIContainerService from '../services/openaiContainerService.js';

const router = express.Router();

// Initialize container service
const containerService = new OpenAIContainerService();

// Create a new container
router.post('/containers', async (req, res) => {
  try {
    const { name, fileIds = [] } = req.body;

    const container = await containerService.createContainer(name, fileIds);

    res.status(201).json({
      success: true,
      container: {
        id: container.id,
        name: container.name,
        status: container.status,
        createdAt: container.created_at
      }
    });

    console.log(`📦 Container created: ${container.id}`);
  } catch (error) {
    console.error('❌ Failed to create container:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create container',
      message: error.message
    });
  }
});

// Get container by ID
router.get('/containers/:containerId', async (req, res) => {
  try {
    const { containerId } = req.params;

    const container = await containerService.getContainer(containerId);

    res.json({
      success: true,
      container: {
        id: container.id,
        name: container.name,
        status: container.status,
        createdAt: container.created_at,
        lastActiveAt: container.last_active_at
      }
    });
  } catch (error) {
    console.error(`❌ Failed to get container ${req.params.containerId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to get container',
      message: error.message
    });
  }
});

// List all containers
router.get('/containers', async (req, res) => {
  try {
    const { limit = 50, after } = req.query;
    
    const options = {};
    if (limit) options.limit = parseInt(limit);
    if (after) options.after = after;

    const containers = await containerService.listContainers(options);

    res.json({
      success: true,
      containers: containers.map(container => ({
        id: container.id,
        name: container.name,
        status: container.status,
        createdAt: container.created_at,
        lastActiveAt: container.last_active_at
      })),
      count: containers.length
    });
  } catch (error) {
    console.error('❌ Failed to list containers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list containers',
      message: error.message
    });
  }
});

// Delete container
router.delete('/containers/:containerId', async (req, res) => {
  try {
    const { containerId } = req.params;

    await containerService.deleteContainer(containerId);

    res.json({
      success: true,
      message: 'Container deleted successfully'
    });

    console.log(`🗑️ Container deleted: ${containerId}`);
  } catch (error) {
    console.error(`❌ Failed to delete container ${req.params.containerId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete container',
      message: error.message
    });
  }
});

// Upload file to container
router.post('/containers/:containerId/files', async (req, res) => {
  try {
    const { containerId } = req.params;
    const { filename, fileData } = req.body;

    if (!filename || !fileData) {
      return res.status(400).json({
        success: false,
        error: 'Filename and file data are required'
      });
    }

    // Convert base64 to buffer if needed
    let fileBuffer;
    if (fileData.startsWith('data:')) {
      // Remove data URL prefix
      const base64Data = fileData.split(',')[1];
      fileBuffer = Buffer.from(base64Data, 'base64');
    } else {
      fileBuffer = Buffer.from(fileData, 'base64');
    }

    const file = await containerService.uploadFile(containerId, fileBuffer, filename);

    res.status(201).json({
      success: true,
      file: {
        id: file.id,
        filename: file.filename,
        purpose: file.purpose,
        createdAt: file.created_at
      }
    });

    console.log(`📁 File uploaded to container ${containerId}: ${filename}`);
  } catch (error) {
    console.error(`❌ Failed to upload file to container ${req.params.containerId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload file',
      message: error.message
    });
  }
});

// List files in container
router.get('/containers/:containerId/files', async (req, res) => {
  try {
    const { containerId } = req.params;

    const files = await containerService.listContainerFiles(containerId);

    res.json({
      success: true,
      files: files.map(file => ({
        id: file.id,
        filename: file.filename,
        purpose: file.purpose,
        createdAt: file.created_at
      })),
      count: files.length
    });
  } catch (error) {
    console.error(`❌ Failed to list files in container ${req.params.containerId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to list files',
      message: error.message
    });
  }
});

// Download file from container
router.get('/containers/:containerId/files/:fileId', async (req, res) => {
  try {
    const { containerId, fileId } = req.params;

    const file = await containerService.downloadFile(containerId, fileId);

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.send(file);

    console.log(`📥 File downloaded from container ${containerId}: ${file.filename}`);
  } catch (error) {
    console.error(`❌ Failed to download file ${fileId} from container ${containerId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to download file',
      message: error.message
    });
  }
});

// Execute code in container
router.post('/containers/:containerId/execute', async (req, res) => {
  try {
    const { containerId } = req.params;
    const { 
      instructions, 
      input, 
      model = 'gpt-4o-mini',
      tool_choice = 'auto'
    } = req.body;

    if (!instructions || !input) {
      return res.status(400).json({
        success: false,
        error: 'Instructions and input are required'
      });
    }

    const response = await containerService.executeCode(containerId, instructions, input, {
      model,
      tool_choice
    });

    res.json({
      success: true,
      response: {
        output: response.output,
        usage: response.usage,
        model: response.model
      }
    });

    console.log(`🐍 Code executed in container ${containerId}`);
  } catch (error) {
    console.error(`❌ Failed to execute code in container ${req.params.containerId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to execute code',
      message: error.message
    });
  }
});

// Execute code with auto container creation
router.post('/containers/execute-auto', async (req, res) => {
  try {
    const { 
      instructions, 
      input, 
      model = 'gpt-4o-mini',
      tool_choice = 'auto'
    } = req.body;

    if (!instructions || !input) {
      return res.status(400).json({
        success: false,
        error: 'Instructions and input are required'
      });
    }

    const response = await containerService.executeCodeAuto(instructions, input, {
      model,
      tool_choice
    });

    res.json({
      success: true,
      response: {
        output: response.output,
        usage: response.usage,
        model: response.model
      }
    });

    console.log(`🐍 Code executed with auto container`);
  } catch (error) {
    console.error('❌ Failed to execute code with auto container:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to execute code',
      message: error.message
    });
  }
});

// Get container status
router.get('/containers/:containerId/status', async (req, res) => {
  try {
    const { containerId } = req.params;

    const status = await containerService.getContainerStatus(containerId);

    res.json({
      success: true,
      status
    });
  } catch (error) {
    console.error(`❌ Failed to get container status ${req.params.containerId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to get container status',
      message: error.message
    });
  }
});

// Get all containers status
router.get('/containers/status/all', async (req, res) => {
  try {
    const statuses = await containerService.getAllContainersStatus();

    res.json({
      success: true,
      containers: statuses,
      count: statuses.length
    });
  } catch (error) {
    console.error('❌ Failed to get all containers status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get containers status',
      message: error.message
    });
  }
});

// Get or create container for session
router.post('/containers/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { name } = req.body;

    const container = await containerService.getOrCreateContainerForSession(sessionId, name);

    res.json({
      success: true,
      container: {
        id: container.id,
        name: container.name,
        status: container.status,
        createdAt: container.created_at,
        sessionId: sessionId
      }
    });

    console.log(`📦 Container for session ${sessionId}: ${container.id}`);
  } catch (error) {
    console.error(`❌ Failed to get/create container for session ${sessionId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to get/create container for session',
      message: error.message
    });
  }
});

// Health check
router.get('/containers/health', async (req, res) => {
  try {
    const statuses = await containerService.getAllContainersStatus();
    const activeContainers = statuses.filter(c => !c.isExpired).length;
    const expiredContainers = statuses.filter(c => c.isExpired).length;

    res.json({
      success: true,
      status: 'healthy',
      containers: {
        total: statuses.length,
        active: activeContainers,
        expired: expiredContainers
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Container health check failed:', error);
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
