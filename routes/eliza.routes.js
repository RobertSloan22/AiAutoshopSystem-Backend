import express from 'express';
import { getElizaAgent } from '../../src/elizaServer'; // Adjust path if needed
import ResponsesAPIService from '../services/responsesService.js';

const router = express.Router();
const responsesService = new ResponsesAPIService();

// POST /eliza/message - send user message to Eliza
router.post('/message', async (req, res) => {
  try {
    const { agents } = await getElizaAgent();
    const agent = agents[0]; // fixed ID agent

    const { message, userId, sessionId } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Missing message in request body' });
    }

    const response = await agent.respond({
      input: message,
      userId: userId || 'anon',
      sessionId: sessionId || 'default',
    });

    res.json({ response });
  } catch (error) {
    console.error('Eliza /message error:', error);
    res.status(500).json({ error: 'Eliza failed to process message' });
  }
});

// POST /eliza/fallback-stream - text-based fallback streaming route
router.post('/fallback-stream', async (req, res) => {
  try {
    const { message, vehicleContext, customerContext, userId, sessionId } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Missing message in request body' });
    }

    // Set headers for Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    try {
      // Try to use the responsesService first
      const { sessionId: chatSessionId, stream } = await responsesService.createStreamingSession(
        message,
        vehicleContext || {},
        customerContext || {}
      );

      // Send session ID first
      res.write(`data: ${JSON.stringify({ type: 'session_started', sessionId: chatSessionId })}\n\n`);

      let toolCalls = [];

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        
        if (delta?.content) {
          // Regular content
          res.write(`data: ${JSON.stringify({
            type: 'content',
            content: delta.content,
            sessionId: chatSessionId
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
                sessionId: chatSessionId
              })}\n\n`);
            }
          }
        }

        if (chunk.choices[0]?.finish_reason === 'tool_calls') {
          // Process tool calls
          res.write(`data: ${JSON.stringify({
            type: 'tool_calls_started',
            toolCalls,
            sessionId: chatSessionId
          })}\n\n`);

          try {
            const toolResults = await responsesService.processToolCalls(toolCalls, chatSessionId);
            
            res.write(`data: ${JSON.stringify({
              type: 'tool_calls_completed',
              results: toolResults,
              sessionId: chatSessionId
            })}\n\n`);

            // Continue stream with tool results
            const continuedStream = await responsesService.continueStreamWithToolResults(chatSessionId, toolResults);
            
            // Process continued stream
            for await (const continueChunk of continuedStream) {
              const continueDelta = continueChunk.choices[0]?.delta;
              
              if (continueDelta?.content) {
                res.write(`data: ${JSON.stringify({
                  type: 'content',
                  content: continueDelta.content,
                  sessionId: chatSessionId
                })}\n\n`);
              }

              if (continueChunk.choices[0]?.finish_reason === 'stop') {
                res.write(`data: ${JSON.stringify({
                  type: 'stream_complete',
                  sessionId: chatSessionId
                })}\n\n`);
                break;
              }
            }
          } catch (toolError) {
            res.write(`data: ${JSON.stringify({
              type: 'error',
              error: 'Tool execution failed: ' + toolError.message,
              sessionId: chatSessionId
            })}\n\n`);
          }
          break;
        }

        if (chunk.choices[0]?.finish_reason === 'stop') {
          res.write(`data: ${JSON.stringify({
            type: 'stream_complete',
            sessionId: chatSessionId
          })}\n\n`);
          break;
        }
      }

      responsesService.closeSession(chatSessionId);
    } catch (responsesError) {
      console.error('Fallback to Eliza due to responses error:', responsesError);
      
      // Fallback to Eliza if responsesService fails
      try {
        const { agents } = await getElizaAgent();
        const agent = agents[0]; // fixed ID agent

        // Send fallback session info
        const fallbackSessionId = `eliza_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        res.write(`data: ${JSON.stringify({ 
          type: 'session_started', 
          sessionId: fallbackSessionId,
          fallback: true 
        })}\n\n`);

        // Get response from Eliza
        const elizaResponse = await agent.respond({
          input: message,
          userId: userId || 'anon',
          sessionId: sessionId || 'default',
        });

        // Split the response into chunks to simulate streaming
        const chunks = elizaResponse.split(/(?<=[.!?])\s+/);
        
        for (const chunk of chunks) {
          // Add a small delay to simulate streaming
          await new Promise(resolve => setTimeout(resolve, 50));
          
          res.write(`data: ${JSON.stringify({
            type: 'content',
            content: chunk + ' ',
            sessionId: fallbackSessionId
          })}\n\n`);
        }

        // Send completion
        res.write(`data: ${JSON.stringify({
          type: 'stream_complete',
          sessionId: fallbackSessionId
        })}\n\n`);
      } catch (elizaError) {
        console.error('Eliza fallback error:', elizaError);
        res.write(`data: ${JSON.stringify({
          type: 'error',
          error: 'All fallback methods failed: ' + elizaError.message
        })}\n\n`);
      }
    }

    res.end();
  } catch (error) {
    console.error('Fallback streaming error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to process streaming request' });
    } else {
      res.write(`data: ${JSON.stringify({
        type: 'error',
        error: error.message
      })}\n\n`);
      res.end();
    }
  }
});

// GET /eliza/agent/:id - get metadata about agent
router.get('/agent/:id', async (req, res) => {
  try {
    const { agents } = await getElizaAgent();
    const agent = agents.find(a => a.agentId === req.params.id);

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    res.json({
      id: agent.agentId,
      name: agent.character.name,
      description: agent.character.description,
    });
  } catch (error) {
    console.error('Eliza /agent/:id error:', error);
    res.status(500).json({ error: 'Failed to get agent info' });
  }
});

export default router;
