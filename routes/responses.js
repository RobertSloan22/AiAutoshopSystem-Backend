import express from 'express';
import ResponsesAPIService from '../services/responsesService.js';
const router = express.Router();

const responsesService = new ResponsesAPIService();

// Cleanup old sessions every 10 minutes
setInterval(() => {
  responsesService.cleanupOldSessions();
}, 10 * 60 * 1000);

// Create streaming chat session
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
    let currentToolCall = null;

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      
      if (delta?.content) {
        // Regular content
        res.write(`data: ${JSON.stringify({
          type: 'content',
          content: delta.content,
          sessionId
        })}\n\n`);
      }

      if (delta?.tool_calls) {
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
          
          // Process continued stream
          for await (const continueChunk of continuedStream) {
            const continueDelta = continueChunk.choices[0]?.delta;
            
            if (continueDelta?.content) {
              res.write(`data: ${JSON.stringify({
                type: 'content',
                content: continueDelta.content,
                sessionId
              })}\n\n`);
            }

            if (continueChunk.choices[0]?.finish_reason === 'stop') {
              res.write(`data: ${JSON.stringify({
                type: 'stream_complete',
                sessionId
              })}\n\n`);
              break;
            }
          }
        } catch (toolError) {
          res.write(`data: ${JSON.stringify({
            type: 'error',
            error: 'Tool execution failed: ' + toolError.message,
            sessionId
          })}\n\n`);
        }
        break;
      }

      if (chunk.choices[0]?.finish_reason === 'stop') {
        res.write(`data: ${JSON.stringify({
          type: 'stream_complete',
          sessionId
        })}\n\n`);
        break;
      }
    }

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

// Get MCP server status
router.get('/mcp/status', async (req, res) => {
  try {
    const status = await responsesService.getMCPStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Simple chat endpoint (non-streaming)
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

export default router;