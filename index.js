const express = require('express');
const cors = require('cors');
const { Agent, Runner, tool } = require('@openai/agents');
const { RealtimeAgent, RealtimeSession } = require('@openai/agents-realtime');
const { z } = require('zod');
const WebSocket = require('ws');
const http = require('http');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());

// Store active sessions
const activeSessions = new Map();

// Define diagnostic tools
const obd2ScanTool = tool({
  name: 'obd2_scan',
  description: 'Perform OBD2 diagnostic scan on vehicle',
  parameters: z.object({
    vehicleId: z.string(),
    includeFreeze: z.boolean().optional()
  }),
  execute: async (input) => {
    try {
      // Call your existing OBD2 service
      const response = await fetch('http://127.0.0.1:4000/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      });
      
      if (!response.ok) {
        return `OBD2 service unavailable. Status: ${response.status}`;
      }
      
      const data = await response.json();
      return `OBD2 Scan Results for ${input.vehicleId}:\n${JSON.stringify(data, null, 2)}`;
    } catch (error) {
      return `OBD2 scan failed: ${error.message}`;
    }
  }
});

const vehicleLookupTool = tool({
  name: 'vehicle_lookup',
  description: 'Look up vehicle information by VIN or make/model/year',
  parameters: z.object({
    vin: z.string().optional(),
    make: z.string().optional(),
    model: z.string().optional(),
    year: z.number().optional()
  }),
  execute: async (input) => {
    try {
      // Simulate vehicle lookup - replace with your actual service
      const vehicleData = {
        vin: input.vin || 'N/A',
        make: input.make || 'Unknown',
        model: input.model || 'Unknown',
        year: input.year || 'Unknown',
        engine: '2.0L 4-cylinder',
        transmission: 'Automatic',
        commonIssues: ['Check engine light', 'Transmission slip', 'AC issues']
      };
      
      return `Vehicle Information:\n${JSON.stringify(vehicleData, null, 2)}`;
    } catch (error) {
      return `Vehicle lookup failed: ${error.message}`;
    }
  }
});

// Create agents
const createTextAgent = () => new Agent({
  name: 'Diagnostic Assistant',
  instructions: `You are an expert automotive diagnostic assistant for an auto repair shop. 
  You help technicians diagnose vehicle problems by:
  1. Analyzing OBD2 diagnostic trouble codes
  2. Providing repair recommendations
  3. Looking up vehicle-specific information
  4. Suggesting parts and labor estimates
  
  Always be professional, accurate, and safety-focused in your responses.
  When providing diagnostic codes, always explain what they mean and potential causes.
  Include estimated repair times and difficulty levels when possible.`,
  tools: [obd2ScanTool, vehicleLookupTool]
});

const createRealtimeAgent = () => new RealtimeAgent({
  name: 'Voice Diagnostic Assistant',
  instructions: `You are a voice-activated automotive diagnostic assistant for technicians.
  Speak clearly and concisely. Help technicians with hands-free diagnostic assistance 
  while they work on vehicles. 
  
  Key behaviors:
  - Keep responses under 30 seconds when possible
  - Use technical terms but explain them briefly
  - Ask follow-up questions to narrow down issues
  - Prioritize safety warnings when relevant
  - Suggest next steps clearly`,
  tools: [obd2ScanTool, vehicleLookupTool]
});

// Text-based diagnostic endpoint
app.post('/api/agent/diagnose', async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    console.log(`[${sessionId || 'anonymous'}] Diagnostic request: ${message}`);

    const agent = createTextAgent();
    const result = await Runner.run(agent, message);

    const response = {
      response: result.finalOutput,
      sessionId: sessionId || Date.now().toString(),
      timestamp: new Date().toISOString(),
      toolsUsed: result.toolsUsed || []
    };

    console.log(`[${response.sessionId}] Response generated`);
    res.json(response);

  } catch (error) {
    console.error('Diagnostic error:', error);
    res.status(500).json({ 
      error: 'Diagnostic failed',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Realtime session creation endpoint
app.post('/api/agent/realtime/session', async (req, res) => {
  try {
    const { sessionId } = req.body;
    const id = sessionId || Date.now().toString();

    // Create realtime session
    const agent = createRealtimeAgent();
    const session = new RealtimeSession({
      agent,
      apiKey: process.env.OPENAI_API_KEY
    });

    // Store session
    activeSessions.set(id, {
      session,
      agent,
      createdAt: new Date(),
      lastActivity: new Date()
    });

    console.log(`Realtime session created: ${id}`);

    res.json({
      sessionId: id,
      status: 'created',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Session creation error:', error);
    res.status(500).json({ 
      error: 'Session creation failed',
      message: error.message 
    });
  }
});

// Get session status
app.get('/api/agent/realtime/session/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const sessionData = activeSessions.get(sessionId);

  if (!sessionData) {
    return res.status(404).json({ error: 'Session not found' });
  }

  res.json({
    sessionId,
    status: 'active',
    createdAt: sessionData.createdAt,
    lastActivity: sessionData.lastActivity
  });
});

// Delete session
app.delete('/api/agent/realtime/session/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const sessionData = activeSessions.get(sessionId);

  if (sessionData && sessionData.session) {
    try {
      await sessionData.session.disconnect();
    } catch (error) {
      console.error('Error disconnecting session:', error);
    }
  }

  activeSessions.delete(sessionId);
  console.log(`Session deleted: ${sessionId}`);

  res.json({ message: 'Session deleted', sessionId });
});

// WebSocket handling for realtime voice
wss.on('connection', (ws, req) => {
  let sessionId = null;
  let sessionData = null;

  console.log('WebSocket connection established');

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());

      switch (data.type) {
        case 'session.create':
          sessionId = data.sessionId || Date.now().toString();
          sessionData = activeSessions.get(sessionId);
          
          if (!sessionData) {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Session not found. Create session first via POST /api/agent/realtime/session'
            }));
            return;
          }

          ws.send(JSON.stringify({
            type: 'session.created',
            sessionId
          }));
          break;

        case 'audio.input':
          if (!sessionData) {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'No active session'
            }));
            return;
          }

          // Forward audio to OpenAI Realtime API
          // This would need proper WebSocket connection to OpenAI
          sessionData.lastActivity = new Date();
          
          // For now, acknowledge audio received
          ws.send(JSON.stringify({
            type: 'audio.received',
            timestamp: new Date().toISOString()
          }));
          break;

        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;

        default:
          ws.send(JSON.stringify({
            type: 'error',
            message: `Unknown message type: ${data.type}`
          }));
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Invalid message format'
      }));
    }
  });

  ws.on('close', () => {
    console.log(`WebSocket connection closed for session: ${sessionId}`);
    if (sessionId && sessionData) {
      // Keep session active for potential reconnection
      sessionData.lastActivity = new Date();
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Health check
app.get('/api/agent/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    activeSessions: activeSessions.size,
    openaiKey: !!process.env.OPENAI_API_KEY
  });
});

// Cleanup inactive sessions every 30 minutes
setInterval(() => {
  const now = new Date();
  const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

  for (const [sessionId, sessionData] of activeSessions.entries()) {
    if (sessionData.lastActivity < thirtyMinutesAgo) {
      console.log(`Cleaning up inactive session: ${sessionId}`);
      if (sessionData.session) {
        sessionData.session.disconnect().catch(console.error);
      }
      activeSessions.delete(sessionId);
    }
  }
}, 30 * 60 * 1000);

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`🤖 OpenAI Agents server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/agent/health`);
  console.log(`💬 Text API: POST http://localhost:${PORT}/api/agent/diagnose`);
  console.log(`🎤 Voice WebSocket: ws://localhost:${PORT}`);
});

module.exports = { app, server };
