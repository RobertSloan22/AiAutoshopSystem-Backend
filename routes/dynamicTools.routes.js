import express from 'express';
import DynamicToolService from '../services/DynamicToolService.js';
import mongoose from 'mongoose';

const router = express.Router();
const dynamicToolService = new DynamicToolService();

// Get all tools for a specific agent
router.get('/agent/:agentId/tools', async (req, res) => {
  try {
    const { agentId } = req.params;
    const tools = await dynamicToolService.getToolsForAgent(agentId);
    
    res.json({
      success: true,
      tools,
      count: tools.length
    });
  } catch (error) {
    console.error('❌ Error getting tools for agent:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Generate a new tool using AI
router.post('/generate', async (req, res) => {
  try {
    const { name, description, category, agentSource, requirements } = req.body;

    if (!name || !description || !category || !agentSource) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, description, category, agentSource'
      });
    }

    const toolSpec = {
      name,
      description,
      category,
      agentSource,
      requirements: requirements || 'Standard automotive diagnostic functionality'
    };

    const generatedTool = await dynamicToolService.generateTool(toolSpec);
    
    res.json({
      success: true,
      tool: generatedTool,
      message: 'Tool generated successfully'
    });
  } catch (error) {
    console.error('❌ Error generating tool:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Register a new dynamic tool
router.post('/register', async (req, res) => {
  try {
    const toolDefinition = req.body;

    const registeredTool = await dynamicToolService.registerTool(toolDefinition);
    
    res.json({
      success: true,
      tool: registeredTool,
      message: 'Tool registered successfully'
    });
  } catch (error) {
    console.error('❌ Error registering tool:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Execute a dynamic tool
router.post('/execute/:toolId', async (req, res) => {
  try {
    const { toolId } = req.params;
    const { parameters, context } = req.body;

    if (!context || !context.sessionId || !context.agentId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required context: sessionId, agentId'
      });
    }

    const result = await dynamicToolService.executeTool(toolId, parameters, context);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('❌ Error executing tool:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get tool execution history
router.get('/:toolId/history', async (req, res) => {
  try {
    const { toolId } = req.params;
    const { limit = 50 } = req.query;

    const history = await dynamicToolService.getToolExecutionHistory(toolId, parseInt(limit));
    
    res.json({
      success: true,
      history,
      count: history.length
    });
  } catch (error) {
    console.error('❌ Error getting tool history:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get tool analytics
router.get('/:toolId/analytics', async (req, res) => {
  try {
    const { toolId } = req.params;

    const analytics = await dynamicToolService.getToolAnalytics(toolId);
    
    res.json({
      success: true,
      analytics
    });
  } catch (error) {
    console.error('❌ Error getting tool analytics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update tool status
router.patch('/:toolId/status', async (req, res) => {
  try {
    const { toolId } = req.params;
    const { status } = req.body;

    const validStatuses = ['draft', 'active', 'deprecated', 'error'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const tool = await mongoose.model('DynamicTool').findByIdAndUpdate(
      toolId,
      { status, updatedAt: new Date() },
      { new: true }
    );

    if (!tool) {
      return res.status(404).json({
        success: false,
        error: 'Tool not found'
      });
    }

    res.json({
      success: true,
      tool,
      message: `Tool status updated to ${status}`
    });
  } catch (error) {
    console.error('❌ Error updating tool status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Delete a tool
router.delete('/:toolId', async (req, res) => {
  try {
    const { toolId } = req.params;

    const tool = await mongoose.model('DynamicTool').findByIdAndDelete(toolId);

    if (!tool) {
      return res.status(404).json({
        success: false,
        error: 'Tool not found'
      });
    }

    res.json({
      success: true,
      message: 'Tool deleted successfully'
    });
  } catch (error) {
    console.error('❌ Error deleting tool:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get all tools (admin endpoint)
router.get('/', async (req, res) => {
  try {
    const { category, status, agentSource } = req.query;
    
    const filter = {};
    if (category) filter.category = category;
    if (status) filter.status = status;
    if (agentSource) filter.agentSource = agentSource;

    const tools = await mongoose.model('DynamicTool').find(filter)
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({
      success: true,
      tools,
      count: tools.length
    });
  } catch (error) {
    console.error('❌ Error getting all tools:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Bulk tool operations
router.post('/bulk', async (req, res) => {
  try {
    const { operation, toolIds, data } = req.body;

    if (!operation || !toolIds || !Array.isArray(toolIds)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: operation, toolIds (array)'
      });
    }

    let result;
    switch (operation) {
      case 'activate':
        result = await mongoose.model('DynamicTool').updateMany(
          { _id: { $in: toolIds } },
          { status: 'active', updatedAt: new Date() }
        );
        break;
      case 'deprecate':
        result = await mongoose.model('DynamicTool').updateMany(
          { _id: { $in: toolIds } },
          { status: 'deprecated', updatedAt: new Date() }
        );
        break;
      case 'delete':
        result = await mongoose.model('DynamicTool').deleteMany(
          { _id: { $in: toolIds } }
        );
        break;
      default:
        return res.status(400).json({
          success: false,
          error: `Unknown operation: ${operation}`
        });
    }

    res.json({
      success: true,
      result,
      message: `Bulk ${operation} completed`
    });
  } catch (error) {
    console.error('❌ Error in bulk operation:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Tool template endpoint
router.get('/templates/:category', async (req, res) => {
  try {
    const { category } = req.params;

    const templates = {
      'obd2-connection': {
        name: 'obd2_connect_device',
        description: 'Connect to OBD2 device',
        category: 'obd2-connection',
        parameters: {
          type: 'object',
          properties: {
            device_id: { type: 'string', description: 'Device ID to connect to' }
          },
          required: ['device_id']
        },
        implementation: {
          type: 'api_call',
          apiEndpoint: '/api/obd2/connect'
        }
      },
      'dtc-analysis': {
        name: 'analyze_dtc_codes',
        description: 'Analyze DTC codes with AI',
        category: 'dtc-analysis',
        parameters: {
          type: 'object',
          properties: {
            dtc_codes: { type: 'array', items: { type: 'string' } }
          },
          required: ['dtc_codes']
        },
        implementation: {
          type: 'ai_generated',
          aiPrompt: 'Analyze the provided DTC codes and provide diagnostic information.'
        }
      },
      'data-visualization': {
        name: 'create_data_chart',
        description: 'Create data visualization chart',
        category: 'data-visualization',
        parameters: {
          type: 'object',
          properties: {
            data: { type: 'object', description: 'Data to visualize' },
            chart_type: { type: 'string', enum: ['line', 'bar', 'pie'] }
          },
          required: ['data', 'chart_type']
        },
        implementation: {
          type: 'function',
          code: 'return { chart: "generated", data: parameters.data };'
        }
      }
    };

    const template = templates[category];
    if (!template) {
      return res.status(404).json({
        success: false,
        error: `Template not found for category: ${category}`
      });
    }

    res.json({
      success: true,
      template
    });
  } catch (error) {
    console.error('❌ Error getting template:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
