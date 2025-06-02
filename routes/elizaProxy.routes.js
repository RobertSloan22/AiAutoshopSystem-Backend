import express from 'express';
import axios from 'axios';
import { createProxyMiddleware } from 'http-proxy-middleware';

const router = express.Router();
const ELIZA_API_URL = 'http://localhost:3000';

// Session management for conversation tracking
const elizaConversations = new Map();

/**
 * Get all available Eliza agents
 */
router.get('/agents', async (req, res) => {
  try {
    const response = await axios.get(`${ELIZA_API_URL}/agents`);
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching Eliza agents:', error);
    res.status(502).json({
      error: 'Failed to communicate with Eliza service',
      message: error.message
    });
  }
});

/**
 * Get agent info by ID
 */
router.get('/agent/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    const response = await axios.get(`${ELIZA_API_URL}/agent/${agentId}`);
    res.json(response.data);
  } catch (error) {
    console.error(`Error fetching Eliza agent ${req.params.agentId}:`, error);
    res.status(502).json({
      error: 'Failed to communicate with Eliza service',
      message: error.message
    });
  }
});

/**
 * Send a message to an agent
 */
router.post('/agent/:agentId/message', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { message, conversationId, userId, sessionId } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Track conversations for potential fallbacks
    if (conversationId) {
      if (!elizaConversations.has(conversationId)) {
        elizaConversations.set(conversationId, []);
      }
      
      elizaConversations.get(conversationId).push({
        role: 'user',
        content: message,
        timestamp: new Date().toISOString()
      });
    }

    const payload = {
      message,
      conversationId,
      userId: userId || 'anon',
      sessionId: sessionId || 'default'
    };

    const response = await axios.post(
      `${ELIZA_API_URL}/agent/${agentId}/message`, 
      payload
    );

    // Track the assistant's response
    if (conversationId && response.data.response) {
      elizaConversations.get(conversationId).push({
        role: 'assistant',
        content: response.data.response.content,
        timestamp: new Date().toISOString()
      });
      
      // Trim conversation history to prevent memory issues (keep last 50 messages)
      if (elizaConversations.get(conversationId).length > 50) {
        elizaConversations.set(
          conversationId,
          elizaConversations.get(conversationId).slice(-50)
        );
      }
    }

    res.json(response.data);
  } catch (error) {
    console.error(`Error sending message to Eliza agent ${req.params.agentId}:`, error);
    res.status(502).json({
      error: 'Failed to communicate with Eliza service',
      message: error.message
    });
  }
});

/**
 * Start a new conversation with an agent
 */
router.post('/agent/:agentId/conversations', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { initialMessage } = req.body;

    const response = await axios.post(
      `${ELIZA_API_URL}/agent/${agentId}/conversations`, 
      { initialMessage }
    );

    // Track new conversation
    if (response.data.conversationId) {
      elizaConversations.set(response.data.conversationId, []);
      
      // If there was an initial message and response, track both
      if (initialMessage && response.data.initialResponse) {
        elizaConversations.get(response.data.conversationId).push(
          { 
            role: 'user', 
            content: initialMessage,
            timestamp: new Date().toISOString()
          },
          { 
            role: 'assistant', 
            content: response.data.initialResponse.content,
            timestamp: new Date().toISOString()
          }
        );
      }
    }

    res.json(response.data);
  } catch (error) {
    console.error(`Error starting conversation with Eliza agent ${req.params.agentId}:`, error);
    res.status(502).json({
      error: 'Failed to communicate with Eliza service',
      message: error.message
    });
  }
});

/**
 * Get conversation history
 */
router.get('/agent/:agentId/conversations/:conversationId', async (req, res) => {
  try {
    const { agentId, conversationId } = req.params;
    
    // Try to get conversation from Eliza service first
    try {
      const response = await axios.get(
        `${ELIZA_API_URL}/agent/${agentId}/conversations/${conversationId}`
      );
      res.json(response.data);
    } catch (elizaError) {
      // If Eliza service fails, fall back to our locally tracked conversation history
      if (elizaConversations.has(conversationId)) {
        res.json({
          conversationId,
          messages: elizaConversations.get(conversationId),
          fallback: true
        });
      } else {
        // If we don't have a local copy either, report the error
        throw elizaError;
      }
    }
  } catch (error) {
    console.error(`Error fetching conversation history from Eliza:`, error);
    res.status(502).json({
      error: 'Failed to retrieve conversation history',
      message: error.message
    });
  }
});

/**
 * Text-based streaming endpoint with fallback capabilities
 */
router.post('/stream/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { message, conversationId, userId, sessionId } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Set headers for Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Generate a session ID if none provided
    const streamSessionId = sessionId || `eliza_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Send session started event
    res.write(`data: ${JSON.stringify({ 
      type: 'session_started', 
      sessionId: streamSessionId,
      conversationId
    })}\n\n`);

    // Send thinking event
    res.write(`data: ${JSON.stringify({ 
      type: 'thinking',
      sessionId: streamSessionId 
    })}\n\n`);

    // Track in conversation history if we have a conversationId
    if (conversationId) {
      if (!elizaConversations.has(conversationId)) {
        elizaConversations.set(conversationId, []);
      }
      
      elizaConversations.get(conversationId).push({
        role: 'user',
        content: message,
        timestamp: new Date().toISOString()
      });
    }

    try {
      // Request data from Eliza
      const response = await axios.post(
        `${ELIZA_API_URL}/agent/${agentId}/message`,
        {
          message,
          conversationId,
          userId: userId || 'anon',
          sessionId: streamSessionId
        }
      );

      if (response.data && response.data.response) {
        const elizaResponse = response.data.response.content;
        
        // Track in conversation history
        if (conversationId) {
          elizaConversations.get(conversationId).push({
            role: 'assistant',
            content: elizaResponse,
            timestamp: new Date().toISOString()
          });
        }

        // Split response into chunks and simulate streaming
        const chunks = elizaResponse.split(/(?<=[.!?])\s+/);
        
        for (const chunk of chunks) {
          // Add a small delay to simulate streaming
          await new Promise(resolve => setTimeout(resolve, 50));
          
          res.write(`data: ${JSON.stringify({
            type: 'content',
            content: chunk + ' ',
            sessionId: streamSessionId
          })}\n\n`);
        }

        // Stream complete
        res.write(`data: ${JSON.stringify({
          type: 'stream_complete',
          sessionId: streamSessionId,
          conversationId: response.data.conversationId || conversationId
        })}\n\n`);
      } else {
        throw new Error('Invalid response from Eliza service');
      }
    } catch (error) {
      console.error('Error in Eliza communication:', error);
      res.write(`data: ${JSON.stringify({
        type: 'error',
        error: 'Failed to communicate with Eliza service: ' + error.message,
        sessionId: streamSessionId
      })}\n\n`);
    }

    res.end();
  } catch (error) {
    console.error('Streaming error:', error);
    
    if (!res.headersSent) {
      res.status(500).json({ error: 'Streaming error: ' + error.message });
    } else {
      res.write(`data: ${JSON.stringify({
        type: 'error',
        error: error.message
      })}\n\n`);
      res.end();
    }
  }
});

/**
 * Cleanup old conversations (call periodically)
 */
function cleanupOldConversations(maxAgeMs = 24 * 60 * 60 * 1000) { // 24 hours
  const now = Date.now();
  
  for (const [conversationId, messages] of elizaConversations.entries()) {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      const lastTimestamp = new Date(lastMessage.timestamp).getTime();
      
      if (now - lastTimestamp > maxAgeMs) {
        elizaConversations.delete(conversationId);
      }
    } else {
      // If empty conversation, delete it
      elizaConversations.delete(conversationId);
    }
  }
}

// Cleanup old conversations every hour
setInterval(cleanupOldConversations, 60 * 60 * 1000);

export default router;