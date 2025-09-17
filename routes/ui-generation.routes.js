import express from 'express';
import OpenAI from 'openai';
import protectRoute from '../middleware/protectRoute.js';

const router = express.Router();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// UI Generation tool definition
const generateUITool = {
  name: 'generate_ui',
  description: 'Generate UI components based on user requirements',
  parameters: {
    type: 'object',
    properties: {
      component_type: {
        type: 'string',
        enum: ['form', 'table', 'chart', 'card', 'layout', 'custom'],
        description: 'Type of UI component to generate'
      },
      requirements: {
        type: 'string',
        description: 'Detailed requirements for the UI component'
      },
      framework: {
        type: 'string',
        enum: ['react', 'html', 'vue'],
        default: 'react',
        description: 'UI framework to use'
      },
      styling: {
        type: 'string',
        enum: ['tailwind', 'css', 'styled-components'],
        default: 'tailwind',
        description: 'Styling approach'
      }
    },
    required: ['component_type', 'requirements']
  }
};

const SYSTEM_PROMPT = `You are an expert UI developer. Generate clean, modern, and accessible UI components based on user requirements. 
Follow best practices for the specified framework and styling approach. 
Include proper structure, styling, and any necessary imports or dependencies.`;

// POST /api/ui/generate - Generate UI component
router.post('/generate', protectRoute, async (req, res) => {
  const { user_input } = req.body;

  if (!user_input) {
    return res.status(400).json({ error: 'user_input is required' });
  }

  try {
    // Set up SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    const messages = [
      {
        role: 'system',
        content: SYSTEM_PROMPT
      },
      {
        role: 'user',
        content: user_input
      }
    ];

    const stream = await openai.beta.chat.completions.stream({
      model: 'gpt-4-turbo-preview',
      messages,
      temperature: 0,
      tools: [{
        type: 'function',
        function: generateUITool
      }],
      tool_choice: {
        type: 'function',
        function: { name: 'generate_ui' }
      },
      parallel_tool_calls: false
    });

    let functionArguments = '';
    let callId = '';
    let functionName = '';
    let isCollectingFunctionArgs = false;

    for await (const part of stream) {
      const delta = part.choices[0].delta;
      const finishReason = part.choices[0].finish_reason;

      if (delta.content) {
        res.write(`data: ${JSON.stringify({
          event: 'assistant_delta',
          data: delta
        })}\n\n`);
      }

      if (delta.tool_calls) {
        isCollectingFunctionArgs = true;
        if (delta.tool_calls[0].id) {
          callId = delta.tool_calls[0].id;
        }
        if (delta.tool_calls[0].function?.name) {
          functionName = delta.tool_calls[0].function.name;
        }
        functionArguments += delta.tool_calls[0].function?.arguments || '';

        res.write(`data: ${JSON.stringify({
          event: 'function_arguments_delta',
          data: {
            callId: callId,
            name: functionName,
            arguments: delta.tool_calls[0].function?.arguments
          }
        })}\n\n`);
      }

      if (finishReason === 'tool_calls' && isCollectingFunctionArgs) {
        console.log(`Tool call ${functionName} is complete`);
        
        // Parse the function arguments
        const args = JSON.parse(functionArguments);
        
        // Generate the actual UI component based on the arguments
        const uiComponent = await generateUIComponent(args);
        
        res.write(`data: ${JSON.stringify({
          event: 'function_arguments_done',
          data: {
            callId: callId,
            name: functionName,
            arguments: functionArguments,
            generatedUI: uiComponent
          }
        })}\n\n`);
        
        functionArguments = '';
        functionName = '';
        isCollectingFunctionArgs = false;
      }
    }

    res.write(`data: ${JSON.stringify({ event: 'done' })}\n\n`);
    res.end();

  } catch (error) {
    console.error('Error in UI generation:', error);
    res.write(`data: ${JSON.stringify({ 
      event: 'error', 
      data: { message: error.message } 
    })}\n\n`);
    res.end();
  }
});

// Helper function to generate the actual UI component
async function generateUIComponent(args) {
  const { component_type, requirements, framework = 'react', styling = 'tailwind' } = args;
  
  const componentPrompt = `Generate a ${component_type} component with the following requirements:
${requirements}

Framework: ${framework}
Styling: ${styling}

Provide complete, production-ready code with all necessary imports and proper structure.`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    messages: [
      {
        role: 'system',
        content: 'You are an expert UI developer. Generate clean, well-structured UI components.'
      },
      {
        role: 'user',
        content: componentPrompt
      }
    ],
    temperature: 0.2
  });

  return completion.choices[0].message.content;
}

// GET /api/ui/templates - Get available UI templates
router.get('/templates', protectRoute, async (req, res) => {
  try {
    const templates = [
      {
        id: 'vehicle-form',
        name: 'Vehicle Information Form',
        type: 'form',
        description: 'Form for adding/editing vehicle information'
      },
      {
        id: 'service-table',
        name: 'Service History Table',
        type: 'table',
        description: 'Table displaying vehicle service history'
      },
      {
        id: 'diagnostic-chart',
        name: 'Diagnostic Data Chart',
        type: 'chart',
        description: 'Chart for visualizing diagnostic data'
      },
      {
        id: 'customer-card',
        name: 'Customer Information Card',
        type: 'card',
        description: 'Card component for displaying customer details'
      }
    ];

    res.json({ templates });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// POST /api/ui/preview - Preview generated UI component
router.post('/preview', protectRoute, async (req, res) => {
  const { code, framework = 'react' } = req.body;

  if (!code) {
    return res.status(400).json({ error: 'code is required' });
  }

  try {
    // In a real implementation, you would:
    // 1. Sanitize the code
    // 2. Create a sandboxed environment
    // 3. Render the component
    // 4. Return a preview URL or rendered HTML
    
    // For now, return a simple response
    res.json({
      success: true,
      message: 'Preview functionality to be implemented',
      code: code,
      framework: framework
    });
  } catch (error) {
    console.error('Error generating preview:', error);
    res.status(500).json({ error: 'Failed to generate preview' });
  }
});

export default router;