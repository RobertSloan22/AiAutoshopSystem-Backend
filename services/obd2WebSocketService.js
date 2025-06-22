import { WebSocketServer } from 'ws';
import OBD2Data from '../models/obd2Data.model.js';
import jwt from 'jsonwebtoken';
import { promisify } from 'util';

class OBD2WebSocketService {
  constructor() {
    this.wss = null;
    this.clients = new Map(); // sessionId -> Set of WebSocket connections
    this.sessionData = new Map(); // sessionId -> latest data
  }

  initialize(server) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws/obd2',
      verifyClient: this.verifyClient.bind(this)
    });

    this.wss.on('connection', this.handleConnection.bind(this));
    console.log('OBD2 WebSocket service initialized');
  }

  async verifyClient(info) {
    try {
      const url = new URL(info.req.url, 'http://localhost');
      const token = url.searchParams.get('token');
      const sessionId = url.searchParams.get('sessionId');

      if (!token || !sessionId) {
        console.log('WebSocket connection rejected: Missing token or sessionId');
        return false;
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (!decoded.userId) {
        console.log('WebSocket connection rejected: Invalid token');
        return false;
      }

      // Verify session exists and belongs to user
      const session = await OBD2Data.findOne({ 
        sessionId, 
        userId: decoded.userId 
      });

      if (!session) {
        console.log('WebSocket connection rejected: Session not found or access denied');
        return false;
      }

      // Store verification data for connection handler
      info.req.verifiedUser = decoded;
      info.req.sessionId = sessionId;
      
      return true;
    } catch (error) {
      console.error('WebSocket verification error:', error);
      return false;
    }
  }

  handleConnection(ws, req) {
    const userId = req.verifiedUser.userId;
    const sessionId = req.sessionId;
    
    console.log(`OBD2 WebSocket connected: User ${userId}, Session ${sessionId}`);

    // Add client to session group
    if (!this.clients.has(sessionId)) {
      this.clients.set(sessionId, new Set());
    }
    this.clients.get(sessionId).add(ws);

    // Store connection metadata
    ws.userId = userId;
    ws.sessionId = sessionId;
    ws.isAlive = true;

    // Send welcome message
    this.sendToClient(ws, {
      type: 'connected',
      sessionId,
      message: 'Connected to OBD2 data stream',
      timestamp: Date.now()
    });

    // Send latest data if available
    if (this.sessionData.has(sessionId)) {
      this.sendToClient(ws, {
        type: 'latest_data',
        data: this.sessionData.get(sessionId),
        timestamp: Date.now()
      });
    }

    // Handle incoming messages
    ws.on('message', (data) => {
      this.handleMessage(ws, data);
    });

    // Handle connection close
    ws.on('close', () => {
      this.handleDisconnection(ws);
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error(`WebSocket error for session ${sessionId}:`, error);
      this.handleDisconnection(ws);
    });

    // Set up ping/pong for connection health
    ws.on('pong', () => {
      ws.isAlive = true;
    });
  }

  handleMessage(ws, data) {
    try {
      const message = JSON.parse(data);
      const { sessionId } = ws;

      switch (message.type) {
        case 'ping':
          this.sendToClient(ws, { type: 'pong', timestamp: Date.now() });
          break;

        case 'subscribe_analysis':
          // Client wants to receive analysis updates
          ws.subscribeAnalysis = true;
          this.sendToClient(ws, { 
            type: 'subscription_confirmed', 
            subscription: 'analysis',
            timestamp: Date.now() 
          });
          break;

        case 'unsubscribe_analysis':
          ws.subscribeAnalysis = false;
          this.sendToClient(ws, { 
            type: 'subscription_cancelled', 
            subscription: 'analysis',
            timestamp: Date.now() 
          });
          break;

        case 'request_latest_data':
          if (this.sessionData.has(sessionId)) {
            this.sendToClient(ws, {
              type: 'latest_data',
              data: this.sessionData.get(sessionId),
              timestamp: Date.now()
            });
          }
          break;

        default:
          console.log(`Unknown message type: ${message.type}`);
          this.sendToClient(ws, { 
            type: 'error', 
            message: `Unknown message type: ${message.type}`,
            timestamp: Date.now()
          });
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
      this.sendToClient(ws, { 
        type: 'error', 
        message: 'Invalid message format',
        timestamp: Date.now()
      });
    }
  }

  handleDisconnection(ws) {
    const { sessionId } = ws;
    console.log(`OBD2 WebSocket disconnected: Session ${sessionId}`);

    // Remove client from session group
    if (this.clients.has(sessionId)) {
      this.clients.get(sessionId).delete(ws);
      
      // Clean up empty session groups
      if (this.clients.get(sessionId).size === 0) {
        this.clients.delete(sessionId);
      }
    }
  }

  // Broadcast new OBD2 data to connected clients for a session
  broadcastOBD2Data(sessionId, data) {
    if (!this.clients.has(sessionId)) {
      return;
    }

    // Store latest data
    this.sessionData.set(sessionId, data);

    const message = {
      type: 'obd2_data',
      sessionId,
      data,
      timestamp: Date.now()
    };

    // Send to all connected clients for this session
    const sessionClients = this.clients.get(sessionId);
    sessionClients.forEach(ws => {
      if (ws.readyState === ws.OPEN) {
        this.sendToClient(ws, message);
      }
    });
  }

  // Broadcast analysis results to subscribed clients
  broadcastAnalysisResult(sessionId, analysisResult) {
    if (!this.clients.has(sessionId)) {
      return;
    }

    const message = {
      type: 'analysis_result',
      sessionId,
      result: analysisResult,
      timestamp: Date.now()
    };

    // Send to subscribed clients only
    const sessionClients = this.clients.get(sessionId);
    sessionClients.forEach(ws => {
      if (ws.readyState === ws.OPEN && ws.subscribeAnalysis) {
        this.sendToClient(ws, message);
      }
    });
  }

  // Send vehicle state updates
  broadcastVehicleState(sessionId, vehicleState) {
    if (!this.clients.has(sessionId)) {
      return;
    }

    const message = {
      type: 'vehicle_state',
      sessionId,
      state: vehicleState,
      timestamp: Date.now()
    };

    // Send to all connected clients for this session
    const sessionClients = this.clients.get(sessionId);
    sessionClients.forEach(ws => {
      if (ws.readyState === ws.OPEN) {
        this.sendToClient(ws, message);
      }
    });
  }

  // Send DTC code updates
  broadcastDTCUpdate(sessionId, dtcCodes) {
    if (!this.clients.has(sessionId)) {
      return;
    }

    const message = {
      type: 'dtc_update',
      sessionId,
      dtcCodes,
      timestamp: Date.now()
    };

    // Send to all connected clients for this session
    const sessionClients = this.clients.get(sessionId);
    sessionClients.forEach(ws => {
      if (ws.readyState === ws.OPEN) {
        this.sendToClient(ws, message);
      }
    });
  }

  // Utility method to send message to a specific client
  sendToClient(ws, message) {
    try {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(message));
      }
    } catch (error) {
      console.error('Error sending WebSocket message:', error);
    }
  }

  // Health check for connections
  startHealthCheck() {
    setInterval(() => {
      this.wss.clients.forEach(ws => {
        if (!ws.isAlive) {
          console.log(`Terminating dead WebSocket connection for session ${ws.sessionId}`);
          ws.terminate();
          return;
        }

        ws.isAlive = false;
        ws.ping();
      });
    }, 30000); // Check every 30 seconds
  }

  // Get connection statistics
  getStats() {
    const stats = {
      totalSessions: this.clients.size,
      totalConnections: 0,
      activeSessions: Array.from(this.clients.keys()),
      sessionsWithData: this.sessionData.size
    };

    this.clients.forEach(clientSet => {
      stats.totalConnections += clientSet.size;
    });

    return stats;
  }

  // Clean up old session data (call periodically)
  cleanupOldSessions(maxAgeHours = 24) {
    const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000);
    
    for (const [sessionId, data] of this.sessionData.entries()) {
      if (data.timestamp < cutoffTime && !this.clients.has(sessionId)) {
        this.sessionData.delete(sessionId);
        console.log(`Cleaned up old session data: ${sessionId}`);
      }
    }
  }
}

// Create singleton instance
const obd2WebSocketService = new OBD2WebSocketService();

export default obd2WebSocketService;