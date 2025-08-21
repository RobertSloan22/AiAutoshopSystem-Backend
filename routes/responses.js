import express from 'express';
import OpenAI from 'openai';
import ResponsesAPIService from '../services/responsesService.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const router = express.Router();
const responsesService = new ResponsesAPIService();

// Initialize OpenAI client for direct API calls
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Tool formatting utility - FINAL CORRECTED VERSION
function formatToolsForOpenAI(tools) {
  if (!Array.isArray(tools)) {
    console.warn('Tools is not an array:', typeof tools);
    return [];
  }

  return tools.map(tool => {
    if (!tool || typeof tool !== 'object') {
      console.warn('Invalid tool object:', tool);
      return null;
    }

    // Handle different tool types correctly
    switch (tool.type) {
      case 'web_search':
        // Web search tools should NOT have a name property
        return {
          type: 'web_search'
        };

      case 'code_interpreter':
        // Code interpreter tools should NOT have a name property
        return {
          type: 'code_interpreter',
          container: tool.container || { type: 'auto' }
        };

      case 'file_search':
        // File search tools should NOT have a name property
        return {
          type: 'file_search',
          vector_store_ids: tool.vector_store_ids || []
        };

      case 'mcp':
        // MCP tools should NOT have a name property
        return {
          type: 'mcp',
          server_label: tool.server_label,
          server_url: tool.server_url,
          require_approval: tool.require_approval || 'never',
          ...(tool.allowed_tools && { allowed_tools: tool.allowed_tools }),
          ...(tool.instructions && { instructions: tool.instructions })
        };

      case 'function':
        // Function tools NEED BOTH top-level name AND nested function.name
        if (tool.function) {
          // Already in correct format - ensure both names match
          return {
            type: 'function',
            name: tool.function.name, // ✅ TOP-LEVEL NAME REQUIRED
            function: {
              name: tool.function.name,
              description: tool.function.description,
              parameters: tool.function.parameters,
              ...(tool.function.strict !== undefined && { strict: tool.function.strict })
            }
          };
        } else {
          // Legacy format - convert to correct structure with both names
          return {
            type: 'function',
            name: tool.name, // ✅ TOP-LEVEL NAME REQUIRED
            function: {
              name: tool.name,
              description: tool.description,
              parameters: tool.parameters,
              ...(tool.strict !== undefined && { strict: tool.strict })
            }
          };
        }

      default:
        // Handle tools that might have been incorrectly formatted
        if (tool.name && tool.function) {
          // This is a function tool with wrong top-level structure
          console.warn('Converting malformed function tool:', tool.name);
          return {
            type: 'function',
            name: tool.function.name, // ✅ TOP-LEVEL NAME REQUIRED
            function: {
              name: tool.function.name,
              description: tool.function.description,
              parameters: tool.function.parameters
            }
          };
        }
        
        // If it's a function tool without explicit type
        if (tool.name && (tool.description || tool.parameters)) {
          console.warn('Converting legacy function tool:', tool.name);
          return {
            type: 'function',
            name: tool.name, // ✅ TOP-LEVEL NAME REQUIRED
            function: {
              name: tool.name,
              description: tool.description,
              parameters: tool.parameters,
              ...(tool.strict !== undefined && { strict: tool.strict })
            }
          };
        }

        // Return as-is but log warning
        console.warn('Unknown or malformed tool:', tool);
        return null;
    }
  }).filter(Boolean); // Remove any null/undefined tools
}

// Debug helper for tool formatting
function debugToolsFormat(tools, context = '') {
  console.log(`=== TOOLS DEBUG ${context} ===`);
  console.log(`Total tools: ${tools.length}`);
  
  tools.forEach((tool, index) => {
    const info = {
      index,
      type: tool.type,
      hasTopLevelName: 'name' in tool,
      hasFunction: 'function' in tool,
      topLevelName: tool.name,
      functionName: tool.function?.name,
      namesMatch: tool.name === tool.function?.name,
      keys: Object.keys(tool)
    };
    
    console.log(`Tool ${index}:`, info);
    
    // Check for formatting requirements
    if (tool.type === 'function') {
      if (!('name' in tool)) {
        console.error(`❌ ERROR: Function tool missing top-level 'name' property:`, tool);
      }
      if (!tool.function) {
        console.error(`❌ ERROR: Function tool missing 'function' property:`, tool);
      }
      if (tool.name !== tool.function?.name) {
        console.error(`❌ ERROR: Function tool names don't match. Top-level: "${tool.name}", function: "${tool.function?.name}"`);
      }
    }
    
    if (tool.type !== 'function' && 'name' in tool) {
      console.error(`❌ ERROR: Non-function tool has 'name' property:`, tool);
    }
  });
  console.log('===================');
}

// Cleanup old sessions every 10 minutes
setInterval(() => {
  responsesService.cleanupOldSessions();
}, 10 * 60 * 1000);

// MAIN API ENDPOINT - OpenAI Responses API
router.post('/turn_response', async (req, res) => {
  try {
    const { messages, tools } = req.body;

    console.log('API Request: POST /api/turn_response');
    console.log('Received messages:', messages);
    console.log('Received tools:', tools);

    // FINAL FIX: Apply proper tool formatting
    const formattedTools = formatToolsForOpenAI(tools || []);
    
    // Debug the formatting
    debugToolsFormat(formattedTools, 'AFTER FORMATTING');
    
    console.log('Formatted tools:', JSON.stringify(formattedTools, null, 2));

    // Validate messages
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ 
        error: 'Messages array is required and cannot be empty' 
      });
    }

    // Get the last message as input
    const lastMessage = messages[messages.length - 1];
    const input = lastMessage.content || lastMessage.text || '';

    if (!input.trim()) {
      return res.status(400).json({ 
        error: 'Message content cannot be empty' 
      });
    }

    // Build conversation history for context
    const conversationHistory = messages.map(msg => ({
      role: msg.role,
      content: typeof msg.content === 'string' ? msg.content : 
               Array.isArray(msg.content) ? msg.content.map(c => c.text || c.content).join(' ') :
               msg.content?.text || msg.content?.content || ''
    }));

    // Prepare the request configuration
    const requestConfig = {
      model: "gpt-4o-mini",
      input: input,
      response_format: { type: "text" }
    };

    // Add tools if available
    if (formattedTools.length > 0) {
      requestConfig.tools = formattedTools;
    }

    // Add conversation history if more than just the current message
    if (conversationHistory.length > 1) {
      requestConfig.messages = conversationHistory.slice(0, -1); // All except the last message
    }

    console.log('OpenAI Request Config:', JSON.stringify(requestConfig, null, 2));

    // Make the request to OpenAI Responses API
    const response = await openai.responses.create(requestConfig);

    console.log('OpenAI Response received');

    // Handle streaming response
    if (response.headers?.['content-type']?.includes('text/event-stream')) {
      // Set headers for Server-Sent Events
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      // Forward the stream
      response.body.on('data', (chunk) => {
        res.write(chunk);
      });

      response.body.on('end', () => {
        res.end();
      });

      response.body.on('error', (error) => {
        console.error('Streaming error:', error);
        res.write(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`);
        res.end();
      });

    } else {
      // Handle regular JSON response
      res.json(response);
    }

  } catch (error) {
    console.error('Error in POST handler:', error);
    
    // Enhanced error handling
    if (error.status === 400 && error.error?.param?.includes('tools')) {
      console.error('Tool formatting error details:', {
        param: error.error.param,
        message: error.error.message,
        type: error.error.type
      });
    }
    
    res.status(error.status || 500).json({ 
      error: error.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? {
        status: error.status,
        param: error.error?.param,
        type: error.error?.type
      } : undefined
    });
  }
});

// STREAMING CHAT ENDPOINT - Enhanced version with better buffering
router.post('/chat/stream', async (req, res) => {
  try {
    const { message, vehicleContext, customerContext } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const { sessionId, stream } = await responsesService.createStreamingSession(
      message,
      vehicleContext,
      customerContext
    );

    // Set headers for Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Send session ID first
    res.write(`data: ${JSON.stringify({ type: 'session_started', sessionId })}\n\n`);

    let toolCalls = [];
    let fullResponse = ''; // Track full response content for assistant message
    
    // IMPROVED BUFFERING STRATEGY
    let contentBuffer = '';
    let bufferTimeout = null;
    const BUFFER_TIME = 100; // Much shorter buffer time (100ms)
    const MIN_CHUNK_SIZE = 20; // Minimum characters before sending
    const MAX_BUFFER_TIME = 500; // Maximum time to hold content
    
    const flushContentBuffer = () => {
      if (contentBuffer.length > 0) {
        const trimmedContent = contentBuffer.trim();
        
        if (trimmedContent.length > 0) {
          res.write(`data: ${JSON.stringify({
            type: 'content',
            content: trimmedContent,
            sessionId
          })}\n\n`);
        }
        
        contentBuffer = '';
      }
      
      if (bufferTimeout) {
        clearTimeout(bufferTimeout);
        bufferTimeout = null;
      }
    };

    // Schedule a flush with timeout
    const scheduleFlush = (forceTime = BUFFER_TIME) => {
      if (bufferTimeout) {
        clearTimeout(bufferTimeout);
      }
      bufferTimeout = setTimeout(flushContentBuffer, forceTime);
    };

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      
      if (delta?.content) {
        contentBuffer += delta.content;
        fullResponse += delta.content; // Track full response for tool calls
        
        // IMPROVED LOGIC: Send content more intelligently
        const hasGoodBreakpoint = /[.!?]\s+|[.!?]$|\n/.test(contentBuffer);
        const isLongEnough = contentBuffer.length >= MIN_CHUNK_SIZE;
        const hasWordBoundary = /\s+\w+$/.test(contentBuffer); // Ends with complete word
        
        // Send immediately if we have a natural break and enough content
        if (hasGoodBreakpoint && isLongEnough) {
          flushContentBuffer();
        }
        // Send if we have a decent amount of content at word boundary
        else if (contentBuffer.length >= 40 && hasWordBoundary) {
          flushContentBuffer();
        }
        // Otherwise schedule a quick flush
        else {
          scheduleFlush(BUFFER_TIME);
        }
      }

      if (delta?.tool_calls) {
        // Flush any remaining content before tool calls
        flushContentBuffer();
        
        // Tool calls
        for (const toolCallDelta of delta.tool_calls) {
          if (toolCallDelta.index !== undefined) {
            if (!toolCalls[toolCallDelta.index]) {
              toolCalls[toolCallDelta.index] = {
                id: toolCallDelta.id,
                type: 'function',
                function: { name: '', arguments: '' }
              };
            }

            if (toolCallDelta.function?.name) {
              toolCalls[toolCallDelta.index].function.name += toolCallDelta.function.name;
            }
            if (toolCallDelta.function?.arguments) {
              toolCalls[toolCallDelta.index].function.arguments += toolCallDelta.function.arguments;
            }

            // Send tool call progress
            res.write(`data: ${JSON.stringify({
              type: 'tool_call_progress',
              toolCall: toolCalls[toolCallDelta.index],
              sessionId
            })}\n\n`);
          }
        }
      }

      if (chunk.choices[0]?.finish_reason === 'tool_calls') {
        // Flush any remaining content before processing tool calls
        flushContentBuffer();
        
        // Get the session to add the assistant message with tool_calls
        const session = responsesService.getSession(sessionId);
        if (session) {
          // Add the assistant message with tool_calls to the conversation
          const assistantMessage = {
            role: 'assistant',
            content: fullResponse || null,  // Content accumulated so far
            tool_calls: toolCalls
          };
          session.messages.push(assistantMessage);
        }
        
        // Process tool calls
        res.write(`data: ${JSON.stringify({
          type: 'tool_calls_started',
          toolCalls,
          sessionId
        })}\n\n`);

        try {
          const toolResults = await responsesService.processToolCalls(toolCalls, sessionId);
          
          res.write(`data: ${JSON.stringify({
            type: 'tool_calls_completed',
            results: toolResults,
            sessionId
          })}\n\n`);

          // Continue stream with tool results
          const continuedStream = await responsesService.continueStreamWithToolResults(sessionId, toolResults);
          
          // Reset buffer for continued stream
          contentBuffer = '';
          
          // Process continued stream with same improved buffering logic
          for await (const continueChunk of continuedStream) {
            const continueDelta = continueChunk.choices[0]?.delta;
            
            if (continueDelta?.content) {
              contentBuffer += continueDelta.content;
              fullResponse += continueDelta.content; // Also track in full response
              
              // Same improved buffering logic for continued content
              const hasGoodBreakpoint = /[.!?]\s+|[.!?]$|\n/.test(contentBuffer);
              const isLongEnough = contentBuffer.length >= MIN_CHUNK_SIZE;
              const hasWordBoundary = /\s+\w+$/.test(contentBuffer);
              
              if (hasGoodBreakpoint && isLongEnough) {
                flushContentBuffer();
              } else if (contentBuffer.length >= 40 && hasWordBoundary) {
                flushContentBuffer();
              } else {
                scheduleFlush(BUFFER_TIME);
              }
            }

            if (continueChunk.choices[0]?.finish_reason === 'stop') {
              // Flush any remaining content before completing
              flushContentBuffer();
              
              res.write(`data: ${JSON.stringify({
                type: 'stream_complete',
                sessionId
              })}\n\n`);
              break;
            }
          }
        } catch (toolError) {
          // Flush any remaining content before error
          flushContentBuffer();
          
          res.write(`data: ${JSON.stringify({
            type: 'error',
            error: 'Tool execution failed: ' + toolError.message,
            sessionId
          })}\n\n`);
        }
        break;
      }

      if (chunk.choices[0]?.finish_reason === 'stop') {
        // Flush any remaining content before completing
        flushContentBuffer();
        
        res.write(`data: ${JSON.stringify({
          type: 'stream_complete',
          sessionId
        })}\n\n`);
        break;
      }
    }

    // Final flush and cleanup
    flushContentBuffer();
    res.end();
    responsesService.closeSession(sessionId);

  } catch (error) {
    console.error('Streaming error:', error);
    res.write(`data: ${JSON.stringify({
      type: 'error',
      error: error.message
    })}\n\n`);
    res.end();
  }
});

// SIMPLE CHAT ENDPOINT (non-streaming)
router.post('/chat', async (req, res) => {
  try {
    const { message, vehicleContext, customerContext } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const { sessionId, stream } = await responsesService.createStreamingSession(
      message,
      vehicleContext,
      customerContext
    );

    let fullResponse = '';
    let toolCalls = [];

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      
      if (delta?.content) {
        fullResponse += delta.content;
      }

      if (delta?.tool_calls) {
        for (const toolCallDelta of delta.tool_calls) {
          if (toolCallDelta.index !== undefined) {
            if (!toolCalls[toolCallDelta.index]) {
              toolCalls[toolCallDelta.index] = {
                id: toolCallDelta.id,
                type: 'function',
                function: { name: '', arguments: '' }
              };
            }

            if (toolCallDelta.function?.name) {
              toolCalls[toolCallDelta.index].function.name += toolCallDelta.function.name;
            }
            if (toolCallDelta.function?.arguments) {
              toolCalls[toolCallDelta.index].function.arguments += toolCallDelta.function.arguments;
            }
          }
        }
      }

      if (chunk.choices[0]?.finish_reason === 'tool_calls') {
        // Add the assistant message with tool_calls to conversation
        const session = responsesService.getSession(sessionId);
        if (session) {
          const assistantMessage = {
            role: 'assistant',
            content: fullResponse || null,
            tool_calls: toolCalls
          };
          session.messages.push(assistantMessage);
        }
        
        const toolResults = await responsesService.processToolCalls(toolCalls, sessionId);
        const continuedStream = await responsesService.continueStreamWithToolResults(sessionId, toolResults);
        
        for await (const continueChunk of continuedStream) {
          const continueDelta = continueChunk.choices[0]?.delta;
          if (continueDelta?.content) {
            fullResponse += continueDelta.content;
          }
          if (continueChunk.choices[0]?.finish_reason === 'stop') {
            break;
          }
        }
        break;
      }

      if (chunk.choices[0]?.finish_reason === 'stop') {
        break;
      }
    }

    responsesService.closeSession(sessionId);

    res.json({
      response: fullResponse,
      toolCalls: toolCalls,
      sessionId
    });

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: error.message });
  }
});

// MCP SERVER STATUS ENDPOINT
router.get('/mcp/status', async (req, res) => {
  try {
    const status = await responsesService.getMCPStatus();
    res.json(status);
  } catch (error) {
    console.error('MCP Status error:', error);
    res.status(500).json({ error: error.message });
  }
});


// WEB SEARCH STATUS ENDPOINT
router.get('/websearch/status', async (req, res) => {
  try {
    const status = await responsesService.getWebSearchStatus();
    res.json(status);
  } catch (error) {
    console.error('Web search status error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ALL SERVICES STATUS ENDPOINT
router.get('/services/status', async (req, res) => {
  try {
    const status = await responsesService.getAllServicesStatus();
    res.json(status);
  } catch (error) {
    console.error('Services status error:', error);
    res.status(500).json({ error: error.message });
  }
});


// PYTHON CODE EXECUTION ENDPOINT
router.post('/execute/python', async (req, res) => {
  try {
    const { code, save_plots = true, plot_filename } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Code is required' });
    }

    console.log('Executing Python code via API endpoint');
    
    const result = await responsesService.pythonService.executeCode(code, {
      save_plots,
      plot_filename
    });

    // If plots were generated, convert them to base64
    if (result.plots && result.plots.length > 0) {
      result.plots_data = [];
      for (const plotPath of result.plots) {
        const base64Data = await responsesService.pythonService.getPlotAsBase64(plotPath);
        if (base64Data) {
          result.plots_data.push({
            path: plotPath,
            data: base64Data
          });
        }
      }
    }

    res.json(result);

  } catch (error) {
    console.error('Python execution error:', error);
    res.status(500).json({ 
      error: error.message || 'Python execution failed' 
    });
  }
});


// AGENT QUESTION WITH PLOT GENERATION ENDPOINT
router.post('/chat/analyze', async (req, res) => {
  try {
    const { question, vehicleContext, customerContext, includeVisualization = true } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    // Create a streaming session with the question
    const { sessionId, stream } = await responsesService.createStreamingSession(
      question,
      vehicleContext,
      customerContext
    );

    let fullResponse = '';
    let toolCalls = [];
    let plotResults = [];
    let pythonCode = '';
    let pythonOutput = '';

    // Process the stream to collect the full response
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      
      if (delta?.content) {
        fullResponse += delta.content;
      }

      if (delta?.tool_calls) {
        for (const toolCallDelta of delta.tool_calls) {
          if (toolCallDelta.index !== undefined) {
            if (!toolCalls[toolCallDelta.index]) {
              toolCalls[toolCallDelta.index] = {
                id: toolCallDelta.id,
                type: 'function',
                function: { name: '', arguments: '' }
              };
            }

            if (toolCallDelta.function?.name) {
              toolCalls[toolCallDelta.index].function.name += toolCallDelta.function.name;
            }
            if (toolCallDelta.function?.arguments) {
              toolCalls[toolCallDelta.index].function.arguments += toolCallDelta.function.arguments;
            }
          }
        }
      }

      if (chunk.choices[0]?.finish_reason === 'tool_calls') {
        // Add the assistant message with tool_calls to conversation
        const session = responsesService.getSession(sessionId);
        if (session) {
          const assistantMessage = {
            role: 'assistant',
            content: fullResponse || null,
            tool_calls: toolCalls
          };
          session.messages.push(assistantMessage);
        }
        
        // Process tool calls and extract plot data
        const toolResults = await responsesService.processToolCalls(toolCalls, sessionId);
        
        // Check if any tool calls were Python executions with plots
        for (let i = 0; i < toolCalls.length; i++) {
          if (toolCalls[i].function.name === 'execute_python_code') {
            try {
              const args = JSON.parse(toolCalls[i].function.arguments);
              pythonCode = args.code || '';
              
              // Parse the tool result to extract plot information
              const resultContent = JSON.parse(toolResults[i].content);
              if (resultContent.success) {
                pythonOutput = resultContent.output || '';
                if (resultContent.plots && resultContent.plots.length > 0) {
                  plotResults = resultContent.plots;
                }
              }
            } catch (e) {
              console.error('Error parsing Python tool results:', e);
            }
          }
        }

        // Continue the conversation after tool execution
        const continuedStream = await responsesService.continueStreamWithToolResults(sessionId, toolResults);
        
        for await (const continueChunk of continuedStream) {
          const continueDelta = continueChunk.choices[0]?.delta;
          if (continueDelta?.content) {
            fullResponse += continueDelta.content;
          }
          if (continueChunk.choices[0]?.finish_reason === 'stop') {
            break;
          }
        }
        break;
      }

      if (chunk.choices[0]?.finish_reason === 'stop') {
        break;
      }
    }

    responsesService.closeSession(sessionId);

    // Prepare the combined response
    const response = {
      message: fullResponse,
      analysis: {
        question: question,
        timestamp: new Date().toISOString()
      }
    };

    // Add plot data if available
    if (plotResults.length > 0) {
      response.visualizations = plotResults.map(plot => ({
        imageId: plot.imageId,
        url: plot.url,
        thumbnailUrl: plot.thumbnailUrl,
        data: plot.data, // Base64 encoded image data
        path: plot.path
      }));
      
      // Add Python execution details
      response.codeExecution = {
        code: pythonCode,
        output: pythonOutput,
        success: true
      };
    }

    // Add context information if provided
    if (vehicleContext || customerContext) {
      response.context = {
        vehicle: vehicleContext,
        customer: customerContext
      };
    }

    res.json(response);

  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ 
      error: error.message || 'Analysis failed',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// STREAMING AGENT QUESTION WITH PLOT GENERATION ENDPOINT
router.post('/chat/analyze/stream', async (req, res) => {
  try {
    const { question, vehicleContext, customerContext, includeVisualization = true } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    // Set headers for Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Create a streaming session with the question
    const { sessionId, stream } = await responsesService.createStreamingSession(
      question,
      vehicleContext,
      customerContext
    );

    // Send session info
    res.write(`data: ${JSON.stringify({
      type: 'session_started',
      sessionId,
      question,
      timestamp: new Date().toISOString()
    })}\n\n`);

    let toolCalls = [];
    let fullResponse = '';
    let plotResults = [];
    let pythonCode = '';
    let pythonOutput = '';
    
    // Buffer for streaming content
    let contentBuffer = '';
    let bufferTimeout = null;
    const BUFFER_TIME = 100;
    const MIN_CHUNK_SIZE = 20;
    
    const flushContentBuffer = () => {
      if (contentBuffer.length > 0) {
        const trimmedContent = contentBuffer.trim();
        
        if (trimmedContent.length > 0) {
          res.write(`data: ${JSON.stringify({
            type: 'content',
            content: trimmedContent,
            sessionId
          })}\n\n`);
        }
        
        contentBuffer = '';
      }
      
      if (bufferTimeout) {
        clearTimeout(bufferTimeout);
        bufferTimeout = null;
      }
    };

    const scheduleFlush = (forceTime = BUFFER_TIME) => {
      if (bufferTimeout) {
        clearTimeout(bufferTimeout);
      }
      bufferTimeout = setTimeout(flushContentBuffer, forceTime);
    };

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      
      if (delta?.content) {
        contentBuffer += delta.content;
        fullResponse += delta.content;
        
        const hasGoodBreakpoint = /[.!?]\s+|[.!?]$|\n/.test(contentBuffer);
        const isLongEnough = contentBuffer.length >= MIN_CHUNK_SIZE;
        const hasWordBoundary = /\s+\w+$/.test(contentBuffer);
        
        if (hasGoodBreakpoint && isLongEnough) {
          flushContentBuffer();
        } else if (contentBuffer.length >= 40 && hasWordBoundary) {
          flushContentBuffer();
        } else {
          scheduleFlush(BUFFER_TIME);
        }
      }

      if (delta?.tool_calls) {
        flushContentBuffer();
        
        for (const toolCallDelta of delta.tool_calls) {
          if (toolCallDelta.index !== undefined) {
            if (!toolCalls[toolCallDelta.index]) {
              toolCalls[toolCallDelta.index] = {
                id: toolCallDelta.id,
                type: 'function',
                function: { name: '', arguments: '' }
              };
            }

            if (toolCallDelta.function?.name) {
              toolCalls[toolCallDelta.index].function.name += toolCallDelta.function.name;
            }
            if (toolCallDelta.function?.arguments) {
              toolCalls[toolCallDelta.index].function.arguments += toolCallDelta.function.arguments;
            }
          }
        }
      }

      if (chunk.choices[0]?.finish_reason === 'tool_calls') {
        flushContentBuffer();
        
        // Add the assistant message with tool_calls to conversation
        const session = responsesService.getSession(sessionId);
        if (session) {
          const assistantMessage = {
            role: 'assistant',
            content: fullResponse || null,
            tool_calls: toolCalls
          };
          session.messages.push(assistantMessage);
        }
        
        // Notify about tool execution starting
        res.write(`data: ${JSON.stringify({
          type: 'tools_executing',
          tools: toolCalls.map(tc => tc.function.name),
          sessionId
        })}\n\n`);
        
        // Process tool calls
        const toolResults = await responsesService.processToolCalls(toolCalls, sessionId);
        
        // Check if any tool calls were Python executions with plots
        for (let i = 0; i < toolCalls.length; i++) {
          if (toolCalls[i].function.name === 'execute_python_code') {
            try {
              const args = JSON.parse(toolCalls[i].function.arguments);
              pythonCode = args.code || '';
              
              // Parse the tool result to extract plot information
              const resultContent = JSON.parse(toolResults[i].content);
              if (resultContent.success) {
                pythonOutput = resultContent.output || '';
                
                // Send Python execution info
                res.write(`data: ${JSON.stringify({
                  type: 'code_execution',
                  code: pythonCode,
                  output: pythonOutput,
                  sessionId
                })}\n\n`);
                
                if (resultContent.plots && resultContent.plots.length > 0) {
                  plotResults = resultContent.plots;
                  
                  // Send plot data immediately
                  res.write(`data: ${JSON.stringify({
                    type: 'visualization_ready',
                    visualizations: plotResults.map(plot => ({
                      imageId: plot.imageId,
                      url: plot.url,
                      thumbnailUrl: plot.thumbnailUrl,
                      data: plot.data,
                      path: plot.path
                    })),
                    sessionId
                  })}\n\n`);
                }
              }
            } catch (e) {
              console.error('Error parsing Python tool results:', e);
            }
          }
        }

        // Continue the conversation after tool execution
        const continuedStream = await responsesService.continueStreamWithToolResults(sessionId, toolResults);
        
        contentBuffer = '';
        
        for await (const continueChunk of continuedStream) {
          const continueDelta = continueChunk.choices[0]?.delta;
          
          if (continueDelta?.content) {
            contentBuffer += continueDelta.content;
            fullResponse += continueDelta.content;
            
            const hasGoodBreakpoint = /[.!?]\s+|[.!?]$|\n/.test(contentBuffer);
            const isLongEnough = contentBuffer.length >= MIN_CHUNK_SIZE;
            const hasWordBoundary = /\s+\w+$/.test(contentBuffer);
            
            if (hasGoodBreakpoint && isLongEnough) {
              flushContentBuffer();
            } else if (contentBuffer.length >= 40 && hasWordBoundary) {
              flushContentBuffer();
            } else {
              scheduleFlush(BUFFER_TIME);
            }
          }
          
          if (continueChunk.choices[0]?.finish_reason === 'stop') {
            break;
          }
        }
        break;
      }

      if (chunk.choices[0]?.finish_reason === 'stop') {
        break;
      }
    }

    // Final flush
    flushContentBuffer();
    
    // Send completion event with full summary
    const completionData = {
      type: 'analysis_complete',
      sessionId,
      summary: {
        message: fullResponse,
        hasVisualization: plotResults.length > 0,
        timestamp: new Date().toISOString()
      }
    };
    
    if (plotResults.length > 0) {
      completionData.summary.visualizationCount = plotResults.length;
      completionData.summary.codeExecuted = !!pythonCode;
    }
    
    res.write(`data: ${JSON.stringify(completionData)}\n\n`);
    
    res.end();
    responsesService.closeSession(sessionId);

  } catch (error) {
    console.error('Streaming analysis error:', error);
    res.write(`data: ${JSON.stringify({
      type: 'error',
      error: error.message || 'Analysis failed'
    })}\n\n`);
    res.end();
  }
});


// HEALTH CHECK ENDPOINT
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    openai_configured: !!process.env.OPENAI_API_KEY,
    mcp_server_url: process.env.MCP_SERVER_URL || 'http://localhost:3700',
    python_execution: true
  });
});

// ERROR HANDLING MIDDLEWARE
router.use((error, req, res, next) => {
  console.error('API Route Error:', error);
  
  if (error.status === 400 && error.error?.param?.includes('tools')) {
    return res.status(400).json({
      error: 'Tool formatting error',
      details: error.error.message,
      param: error.error.param
    });
  }
  
  res.status(error.status || 500).json({
    error: error.message || 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

export default router;