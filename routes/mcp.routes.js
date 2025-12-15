import express from 'express';
import { MCPClientService } from '../services/mcpClient.ts';

const router = express.Router();
const mcpClient = new MCPClientService();

// Connect to MCP server
router.post('/connect', async (req, res) => {
  try {
    const { serverCommand, serverArgs = [] } = req.body;
    
    if (!serverCommand) {
      return res.status(400).json({ error: 'Server command is required' });
    }

    await mcpClient.connect(serverCommand, serverArgs);
    res.json({ success: true, message: 'Connected to MCP server' });
  } catch (error) {
    console.error('MCP connection error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Disconnect from MCP server
router.post('/disconnect', async (req, res) => {
  try {
    await mcpClient.disconnect();
    res.json({ success: true, message: 'Disconnected from MCP server' });
  } catch (error) {
    console.error('MCP disconnection error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get connection status
router.get('/status', (req, res) => {
  res.json({ connected: mcpClient.isConnected() });
});

// List available tools
router.get('/tools', async (req, res) => {
  try {
    const tools = await mcpClient.listTools();
    res.json(tools);
  } catch (error) {
    console.error('Error listing tools:', error);
    res.status(500).json({ error: error.message });
  }
});

// Call a tool
router.post('/tools/call', async (req, res) => {
  try {
    const { name, arguments: args = {} } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Tool name is required' });
    }

    const result = await mcpClient.callTool(name, args);
    res.json(result);
  } catch (error) {
    console.error('Error calling tool:', error);
    res.status(500).json({ error: error.message });
  }
});

// List available resources
router.get('/resources', async (req, res) => {
  try {
    const resources = await mcpClient.listResources();
    res.json(resources);
  } catch (error) {
    console.error('Error listing resources:', error);
    res.status(500).json({ error: error.message });
  }
});

// Read a resource
router.post('/resources/read', async (req, res) => {
  try {
    const { uri } = req.body;
    
    if (!uri) {
      return res.status(400).json({ error: 'Resource URI is required' });
    }

    const resource = await mcpClient.readResource(uri);
    res.json(resource);
  } catch (error) {
    console.error('Error reading resource:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;