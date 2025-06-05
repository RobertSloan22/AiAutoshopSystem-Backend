import express from 'express';
import ResponsesAPIService from '../services/responsesService.js';
const router = express.Router();

const responsesService = new ResponsesAPIService();

// Cleanup old sessions every 10 minutes
setInterval(() => {
  responsesService.cleanupOldSessions();
}, 10 * 60 * 1000);

// Fixed streaming chat session endpoint with improved content buffering
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