// routes/obd2.routes.js - Add this new route file to your existing routes folder

import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import mongoose from 'mongoose';
import obd2RealtimeService from '../services/OBD2RealtimeService.js';

const router = express.Router();

// MongoDB Schemas for OBD2 data (alternative to PostgreSQL)
const DiagnosticSessionSchema = new mongoose.Schema({
  userId: { type: String, index: true },
  vehicleId: { type: String, index: true },
  sessionName: String,
  startTime: { type: Date, required: true, index: true },
  endTime: Date,
  duration: Number, // Duration in seconds
  status: { 
    type: String, 
    enum: ['active', 'completed', 'paused', 'error', 'cancelled'],
    default: 'active',
    index: true
  },
  dataPointCount: { type: Number, default: 0 },
  
  // Session metadata
  sessionType: { type: String, default: 'diagnostic' },
  locationStart: mongoose.Schema.Types.Mixed, // GPS coordinates
  locationEnd: mongoose.Schema.Types.Mixed,
  weatherConditions: mongoose.Schema.Types.Mixed,
  drivingConditions: String,
  sessionNotes: String,
  tags: [String],
  
  // Vehicle information snapshot
  vehicleInfo: mongoose.Schema.Types.Mixed,
  
  // Session statistics
  sessionStats: mongoose.Schema.Types.Mixed,
  
  // Data quality metrics
  dataQualityScore: Number,
  missingDataPercentage: Number,
  errorCount: { type: Number, default: 0 }
}, {
  timestamps: true
});

const OBD2DataPointSchema = new mongoose.Schema({
  sessionId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'DiagnosticSession',
    required: true,
    index: true
  },
  timestamp: { type: Date, required: true, index: true },
  
  // Core engine parameters
  rpm: Number,
  speed: Number,
  engineTemp: Number,
  intakeTemp: Number,
  ambientTemp: Number,
  
  // Throttle and load
  throttlePosition: Number,
  engineLoad: Number,
  absoluteLoad: Number,
  relativeThrottlePosition: Number,
  
  // Fuel system
  fuelLevel: Number,
  fuelRate: Number,
  fuelPressure: Number,
  fuelRailPressure: Number,
  fuelTrimShortB1: Number,
  fuelTrimLongB1: Number,
  fuelTrimShortB2: Number,
  fuelTrimLongB2: Number,
  ethanolFuelPercent: Number,
  
  // Air flow and pressure
  maf: Number, // Mass air flow
  map: Number, // Manifold absolute pressure
  barometricPressure: Number,
  vaporPressure: Number,
  
  // Electrical
  batteryVoltage: Number,
  
  // Oxygen sensors
  o2B1S1Voltage: Number,
  o2B1S2Voltage: Number,
  o2B1S3Voltage: Number,
  o2B1S4Voltage: Number,
  o2B2S1Voltage: Number,
  o2B2S2Voltage: Number,
  o2B2S3Voltage: Number,
  o2B2S4Voltage: Number,
  
  // Wide-range O2 sensors
  o2B1S1WR: mongoose.Schema.Types.Mixed,
  o2B1S2WR: mongoose.Schema.Types.Mixed,
  o2B1S3WR: mongoose.Schema.Types.Mixed,
  o2B1S4WR: mongoose.Schema.Types.Mixed,
  o2B2S1WR: mongoose.Schema.Types.Mixed,
  o2B2S2WR: mongoose.Schema.Types.Mixed,
  o2B2S3WR: mongoose.Schema.Types.Mixed,
  o2B2S4WR: mongoose.Schema.Types.Mixed,
  
  // Timing and ignition
  timingAdvance: Number,
  
  // Emissions and EGR
  egrError: Number,
  commandedEGR: Number,
  secondaryAirStatus: String,
  
  // Variable valve timing
  vvtB1: Number,
  vvtB2: Number,
  
  // Runtime and distance
  runtime: Number,
  distanceMIL: Number,
  distanceClear: Number,
  
  // Catalyst temperatures
  catalystTempB1S1: Number,
  catalystTempB1S2: Number,
  catalystTempB2S1: Number,
  catalystTempB2S2: Number,
  
  // Additional accelerator positions
  acceleratorPosD: Number,
  acceleratorPosE: Number,
  acceleratorPosF: Number,
  
  // Diesel-specific parameters
  turboPressureA: Number,
  turboPressureB: Number,
  chargeAirCoolerTemp: Number,
  dpfTemperature: Number,
  dpfPressure: Number,
  egtBank1: [Number],
  egtBank2: [Number],
  
  // Secondary O2 trim
  shortTermSecondaryO2B1: Number,
  longTermSecondaryO2B1: Number,
  shortTermSecondaryO2B2: Number,
  longTermSecondaryO2B2: Number,
  
  // Calculated/derived fields
  calculatedLoad: Number,
  fuelSystemStatus: String,
  fuelType: String,
  
  // Raw data backup
  rawData: mongoose.Schema.Types.Mixed,
  
  // Data quality flags
  dataQuality: { type: Number, default: 100 },
  isInterpolated: { type: Boolean, default: false }
}, {
  timestamps: true
});

const DTCEventSchema = new mongoose.Schema({
  sessionId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'DiagnosticSession',
    required: true,
    index: true
  },
  vehicleId: String,
  timestamp: { type: Date, required: true, index: true },
  
  dtcCode: { type: String, required: true, index: true },
  dtcStatus: { 
    type: String, 
    enum: ['active', 'pending', 'permanent', 'cleared'],
    required: true,
    index: true
  },
  dtcDescription: String,
  dtcCategory: String,
  severity: String,
  
  // Freeze frame data
  freezeFrameData: mongoose.Schema.Types.Mixed,
  
  // Troubleshooting information
  possibleCauses: [String],
  repairSuggestions: [String]
}, {
  timestamps: true
});

// Create compound indexes for better query performance
DiagnosticSessionSchema.index({ userId: 1, startTime: -1 });
DiagnosticSessionSchema.index({ vehicleId: 1, startTime: -1 });
DiagnosticSessionSchema.index({ status: 1, startTime: -1 });
OBD2DataPointSchema.index({ sessionId: 1, timestamp: -1 });
DTCEventSchema.index({ sessionId: 1, timestamp: -1 });
DTCEventSchema.index({ dtcCode: 1, dtcStatus: 1 });

// New Schema for Session Sharing
const SharedSessionSchema = new mongoose.Schema({
  shareCode: { type: String, unique: true, index: true }, // 6-character code
  diagnosticSessionId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'DiagnosticSession',
    required: true
  },
  hostSocketId: String, // Tablet's socket ID
  clientSocketIds: [String], // Office computers connected
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now, expires: 86400 } // 24 hour expiry
});

// Create models
const DiagnosticSession = mongoose.model('DiagnosticSession', DiagnosticSessionSchema);
const OBD2DataPoint = mongoose.model('OBD2DataPoint', OBD2DataPointSchema);
const DTCEvent = mongoose.model('DTCEvent', DTCEventSchema);
const SharedSession = mongoose.model('SharedSession', SharedSessionSchema);

// Data aggregation class for efficient storage
class DataAggregator {
  constructor() {
    this.buffer = new Map();
    this.bufferSize = 10;
    this.flushInterval = 5000;
    
    setInterval(() => this.flushAllBuffers(), this.flushInterval);
  }

  addDataPoint(sessionId, dataPoint) {
    if (!this.buffer.has(sessionId)) {
      this.buffer.set(sessionId, []);
    }

    const sessionBuffer = this.buffer.get(sessionId);
    sessionBuffer.push(dataPoint);

    if (sessionBuffer.length >= this.bufferSize) {
      this.flushBuffer(sessionId);
    }
  }

  async flushBuffer(sessionId) {
    const dataPoints = this.buffer.get(sessionId);
    if (!dataPoints || dataPoints.length === 0) return;

    try {
      // Batch insert data points
      await OBD2DataPoint.insertMany(dataPoints);

      // Update session data point count
      await DiagnosticSession.findByIdAndUpdate(sessionId, {
        $inc: { dataPointCount: dataPoints.length },
        $set: { updatedAt: new Date() }
      });

      // Clear buffer
      this.buffer.set(sessionId, []);
      
      console.log(`✅ Flushed ${dataPoints.length} data points for session ${sessionId}`);
    } catch (error) {
      console.error(`❌ Failed to flush buffer for session ${sessionId}:`, error);
    }
  }

  async flushAllBuffers() {
    const sessionIds = Array.from(this.buffer.keys());
    await Promise.all(sessionIds.map(id => this.flushBuffer(id)));
  }

  async forceFlush(sessionId) {
    if (sessionId) {
      await this.flushBuffer(sessionId);
    } else {
      await this.flushAllBuffers();
    }
  }
}

const dataAggregator = new DataAggregator();

// Helper function to generate share codes
function generateShareCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Enhanced WebSocket initialization
export function initializeOBD2WebSocket(server) {
  // Create dedicated Socket.IO instance for OBD2 with unique path
  const io = new SocketIOServer(server, {
    cors: {
      origin: function(origin, callback) {
        callback(null, true);
      },
      methods: ["GET", "POST"]
    },
    path: '/obd2-socket.io',
    transports: ['websocket', 'polling'],
    allowEIO3: true,
    pingTimeout: 60000,
    pingInterval: 25000,
    upgradeTimeout: 30000,
    allowUpgrades: true,
    cookie: false,
    serveClient: false
  });

  const obd2Namespace = io.of('/obd2');

  // Store active sharing sessions
  const activeSharingSessions = new Map();

  // Add connection error handling
  io.engine.on("connection_error", (err) => {
    console.error("🚨 OBD2 Socket.IO connection error:", {
      code: err.code,
      message: err.message,
      context: err.context,
      req: err.req?.url
    });
  });

  obd2Namespace.on('connection', (socket) => {
    console.log(`🔌 OBD2 Client connected: ${socket.id}`);
    console.log(`🌐 Origin: ${socket.handshake.headers.origin}`);
    console.log(`📡 Transport: ${socket.conn.transport.name}`);
    
    let currentSessionId = null;
    let currentShareCode = null;
    let isHost = false;

    // Existing session start handler
    socket.on('start-session', async (data) => {
      try {
        const session = new DiagnosticSession({
          userId: data.userId || null,
          vehicleId: data.vehicleId || null,
          sessionName: data.sessionName || null,
          startTime: new Date(),
          vehicleInfo: data.vehicleInfo || {},
          sessionNotes: data.sessionNotes || null,
          tags: data.tags || []
        });

        const savedSession = await session.save();
        currentSessionId = savedSession._id;
        
        socket.emit('session-started', {
          sessionId: currentSessionId,
          startTime: savedSession.startTime
        });

        console.log(`📊 New OBD2 diagnostic session started: ${currentSessionId}`);
      } catch (error) {
        console.error('❌ Failed to start session:', error);
        socket.emit('error', { message: 'Failed to start diagnostic session' });
      }
    });

    // NEW: Create sharing session (for tablet)
    socket.on('create-share-session', async (data) => {
      if (!currentSessionId) {
        socket.emit('error', { message: 'No active diagnostic session to share' });
        return;
      }

      try {
        // Generate unique 6-character code
        const shareCode = generateShareCode();
        
        const sharedSession = new SharedSession({
          shareCode,
          diagnosticSessionId: currentSessionId,
          hostSocketId: socket.id
        });

        await sharedSession.save();
        
        currentShareCode = shareCode;
        isHost = true;
        
        // Store in memory for quick access
        activeSharingSessions.set(shareCode, {
          hostSocketId: socket.id,
          clientSocketIds: new Set(),
          diagnosticSessionId: currentSessionId
        });

        socket.emit('share-session-created', {
          shareCode,
          sessionId: currentSessionId
        });

        console.log(`🔗 Share session created: ${shareCode} for diagnostic session: ${currentSessionId}`);
      } catch (error) {
        console.error('❌ Failed to create share session:', error);
        socket.emit('error', { message: 'Failed to create sharing session' });
      }
    });

    // NEW: Join sharing session (for office computer)
    socket.on('join-share-session', async (data) => {
      const { shareCode } = data;
      
      try {
        const sharedSession = await SharedSession.findOne({ 
          shareCode, 
          isActive: true 
        }).populate('diagnosticSessionId');

        if (!sharedSession) {
          socket.emit('error', { message: 'Share code not found or expired' });
          return;
        }

        // Add client to the sharing session
        const sharingSession = activeSharingSessions.get(shareCode);
        if (sharingSession) {
          sharingSession.clientSocketIds.add(socket.id);
          
          // Update database
          await SharedSession.findOneAndUpdate(
            { shareCode },
            { $addToSet: { clientSocketIds: socket.id } }
          );

          socket.emit('share-session-joined', {
            shareCode,
            sessionId: sharedSession.diagnosticSessionId._id,
            sessionInfo: sharedSession.diagnosticSessionId
          });

          // Notify host about new client
          const hostSocket = obd2Namespace.sockets.get(sharingSession.hostSocketId);
          if (hostSocket) {
            hostSocket.emit('client-joined-share', {
              clientSocketId: socket.id,
              clientCount: sharingSession.clientSocketIds.size
            });
          }

          console.log(`👥 Client ${socket.id} joined share session: ${shareCode}`);
        } else {
          socket.emit('error', { message: 'Sharing session not active' });
        }
      } catch (error) {
        console.error('❌ Failed to join share session:', error);
        socket.emit('error', { message: 'Failed to join sharing session' });
      }
    });

    // Enhanced OBD2 data handler with sharing
    socket.on('obd2-data', async (data) => {
      if (!currentSessionId) {
        socket.emit('error', { message: 'No active session. Please start a session first.' });
        return;
      }

      try {
        const dataPoint = {
          sessionId: currentSessionId,
          timestamp: new Date(data.timestamp || Date.now()),
          ...data
        };

        // Add to aggregation buffer (existing functionality)
        dataAggregator.addDataPoint(currentSessionId, dataPoint);

        // NEW: Store in Redis for real-time access
        await obd2RealtimeService.storeDataPoint(currentSessionId, dataPoint);

        // NEW: Share data with connected clients if this is a host
        if (isHost && currentShareCode) {
          const sharingSession = activeSharingSessions.get(currentShareCode);
          if (sharingSession) {
            // Send to all connected clients
            sharingSession.clientSocketIds.forEach(clientSocketId => {
              const clientSocket = obd2Namespace.sockets.get(clientSocketId);
              if (clientSocket) {
                clientSocket.emit('shared-obd2-data', {
                  shareCode: currentShareCode,
                  data: dataPoint,
                  timestamp: dataPoint.timestamp
                });
              }
            });
          }
        }

        // Send acknowledgment
        socket.emit('data-received', { timestamp: dataPoint.timestamp });

      } catch (error) {
        console.error('❌ Failed to process OBD2 data:', error);
        socket.emit('error', { message: 'Failed to process data point' });
      }
    });

    socket.on('end-session', async () => {
      if (!currentSessionId) {
        socket.emit('error', { message: 'No active session to end' });
        return;
      }

      try {
        await dataAggregator.forceFlush(currentSessionId);

        const endTime = new Date();
        const session = await DiagnosticSession.findById(currentSessionId);
        const duration = Math.floor((endTime - session.startTime) / 1000);

        const updatedSession = await DiagnosticSession.findByIdAndUpdate(
          currentSessionId,
          {
            endTime,
            duration,
            status: 'completed',
            updatedAt: new Date()
          },
          { new: true }
        );

        socket.emit('session-ended', {
          sessionId: currentSessionId,
          endTime: updatedSession.endTime,
          duration: updatedSession.duration,
          dataPointCount: updatedSession.dataPointCount
        });

        // End sharing session if active
        if (currentShareCode) {
          await SharedSession.findOneAndUpdate(
            { shareCode: currentShareCode },
            { isActive: false }
          );
          activeSharingSessions.delete(currentShareCode);
        }

        console.log(`📊 OBD2 diagnostic session ended: ${currentSessionId}`);
        currentSessionId = null;
        currentShareCode = null;
        isHost = false;

      } catch (error) {
        console.error('❌ Failed to end session:', error);
        socket.emit('error', { message: 'Failed to end diagnostic session' });
      }
    });

    // Enhanced disconnect handler
    socket.on('disconnect', async () => {
      console.log(`🔌 OBD2 Client disconnected: ${socket.id}`);
      
      // Handle sharing session cleanup
      if (isHost && currentShareCode) {
        // Host disconnected - notify all clients
        const sharingSession = activeSharingSessions.get(currentShareCode);
        if (sharingSession) {
          sharingSession.clientSocketIds.forEach(clientSocketId => {
            const clientSocket = obd2Namespace.sockets.get(clientSocketId);
            if (clientSocket) {
              clientSocket.emit('host-disconnected', {
                shareCode: currentShareCode
              });
            }
          });
          
          // Mark sharing session as inactive
          await SharedSession.findOneAndUpdate(
            { shareCode: currentShareCode },
            { isActive: false }
          );
          
          activeSharingSessions.delete(currentShareCode);
        }
      } else if (currentShareCode) {
        // Client disconnected - remove from sharing session
        const sharingSession = activeSharingSessions.get(currentShareCode);
        if (sharingSession) {
          sharingSession.clientSocketIds.delete(socket.id);
          
          // Notify host
          const hostSocket = obd2Namespace.sockets.get(sharingSession.hostSocketId);
          if (hostSocket) {
            hostSocket.emit('client-left-share', {
              clientSocketId: socket.id,
              clientCount: sharingSession.clientSocketIds.size
            });
          }
        }
      }
      
      // Auto-end diagnostic session if host disconnects (existing functionality)
      if (currentSessionId && isHost) {
        try {
          await dataAggregator.forceFlush(currentSessionId);
          await DiagnosticSession.findByIdAndUpdate(currentSessionId, {
            endTime: new Date(),
            status: 'completed',
            updatedAt: new Date()
          });
          
          console.log(`📊 Auto-ended OBD2 session due to host disconnect: ${currentSessionId}`);
        } catch (error) {
          console.error('❌ Failed to auto-end session:', error);
        }
      }
    });
  });

  return obd2Namespace;
}

// REST API Routes

// Get all sessions for a user
router.get('/sessions', async (req, res) => {
  try {
    const { userId, limit = 50, offset = 0 } = req.query;
    
    let query = {};
    if (userId) {
      query.userId = userId;
    }
    
    const sessions = await DiagnosticSession
      .find(query)
      .sort({ startTime: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .lean();

    const total = await DiagnosticSession.countDocuments(query);
    
    res.json({
      sessions,
      total
    });
  } catch (error) {
    console.error('❌ Failed to fetch sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// Get specific session details
router.get('/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const session = await DiagnosticSession.findById(sessionId).lean();

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({ session });
  } catch (error) {
    console.error('❌ Failed to fetch session:', error);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

// Get session data points with filtering and aggregation
router.get('/sessions/:sessionId/data', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { 
      startTime, 
      endTime, 
      interval = '1 minute',
      parameters,
      limit = 1000,
      aggregate = 'false'
    } = req.query;

    let query = { sessionId };

    // Add time range filters
    if (startTime || endTime) {
      query.timestamp = {};
      if (startTime) query.timestamp.$gte = new Date(startTime);
      if (endTime) query.timestamp.$lte = new Date(endTime);
    }

    if (aggregate === 'true') {
      // MongoDB aggregation for time-series data
      const pipeline = [
        { $match: query },
        {
          $group: {
            _id: {
              $dateTrunc: {
                date: "$timestamp",
                unit: interval.includes('minute') ? 'minute' : 
                      interval.includes('hour') ? 'hour' : 'minute'
              }
            },
            rpm: { $avg: "$rpm" },
            speed: { $avg: "$speed" },
            engineTemp: { $avg: "$engineTemp" },
            throttlePosition: { $avg: "$throttlePosition" },
            engineLoad: { $avg: "$engineLoad" },
            maf: { $avg: "$maf" },
            map: { $avg: "$map" },
            count: { $sum: 1 }
          }
        },
        { $sort: { "_id": 1 } },
        { $limit: parseInt(limit) }
      ];

      const result = await OBD2DataPoint.aggregate(pipeline);
      
      const transformedData = result.map(item => ({
        time_bucket: item._id,
        data: {
          rpm: item.rpm,
          speed: item.speed,
          engineTemp: item.engineTemp,
          throttlePosition: item.throttlePosition,
          engineLoad: item.engineLoad,
          maf: item.maf,
          map: item.map
        }
      }));

      res.json({
        data: transformedData,
        count: transformedData.length,
        aggregated: true
      });

    } else {
      // Raw data
      const dataPoints = await OBD2DataPoint
        .find(query)
        .sort({ timestamp: 1 })
        .limit(parseInt(limit))
        .lean();

      res.json({
        data: dataPoints,
        count: dataPoints.length,
        aggregated: false
      });
    }

  } catch (error) {
    console.error('❌ Failed to fetch session data:', error);
    res.status(500).json({ error: 'Failed to fetch session data' });
  }
});

// Delete session
router.delete('/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    // Delete all associated data points first
    await OBD2DataPoint.deleteMany({ sessionId });
    await DTCEvent.deleteMany({ sessionId });
    
    // Delete the session
    const result = await DiagnosticSession.findByIdAndDelete(sessionId);

    if (!result) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({ message: 'Session deleted successfully' });
  } catch (error) {
    console.error('❌ Failed to delete session:', error);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

// NEW REST API Routes for sharing

// Check if share code exists
router.get('/share/:shareCode', async (req, res) => {
  try {
    const { shareCode } = req.params;
    
    const sharedSession = await SharedSession.findOne({ 
      shareCode, 
      isActive: true 
    }).populate('diagnosticSessionId');

    if (!sharedSession) {
      return res.status(404).json({ error: 'Share code not found or expired' });
    }

    res.json({
      shareCode,
      sessionId: sharedSession.diagnosticSessionId._id,
      sessionInfo: {
        sessionName: sharedSession.diagnosticSessionId.sessionName,
        startTime: sharedSession.diagnosticSessionId.startTime,
        vehicleInfo: sharedSession.diagnosticSessionId.vehicleInfo
      },
      isActive: sharedSession.isActive
    });
  } catch (error) {
    console.error('❌ Failed to check share code:', error);
    res.status(500).json({ error: 'Failed to check share code' });
  }
});

// Get active sharing sessions for a diagnostic session
router.get('/sessions/:sessionId/sharing', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const sharingSessions = await SharedSession.find({
      diagnosticSessionId: sessionId,
      isActive: true
    });

    res.json({ sharingSessions });
  } catch (error) {
    console.error('❌ Failed to fetch sharing sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sharing sessions' });
  }
});

// End sharing session
router.delete('/share/:shareCode', async (req, res) => {
  try {
    const { shareCode } = req.params;
    
    const result = await SharedSession.findOneAndUpdate(
      { shareCode },
      { isActive: false }
    );

    if (!result) {
      return res.status(404).json({ error: 'Share code not found' });
    }

    res.json({ message: 'Sharing session ended successfully' });
  } catch (error) {
    console.error('❌ Failed to end sharing session:', error);
    res.status(500).json({ error: 'Failed to end sharing session' });
  }
});

// =====================================================
// NEW: Real-time endpoints without WebSockets
// =====================================================

// Server-Sent Events endpoint for real-time updates
router.get('/sessions/:sessionId/stream', async (req, res) => {
  const { sessionId } = req.params;
  
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // Send initial data
  res.write(`data: ${JSON.stringify({ type: 'connected', sessionId, timestamp: Date.now() })}\n\n`);

  // Subscribe to Redis updates
  const subscriber = await obd2RealtimeService.subscribeToSession(sessionId, (data) => {
    res.write(`data: ${JSON.stringify({ type: 'data', ...data })}\n\n`);
  });

  // Heartbeat to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(`: heartbeat ${Date.now()}\n\n`);
  }, 30000);

  // Cleanup on client disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    if (subscriber) {
      subscriber.unsubscribe();
      subscriber.quit();
    }
  });

  req.on('aborted', () => {
    clearInterval(heartbeat);
    if (subscriber) {
      subscriber.unsubscribe();
      subscriber.quit();
    }
  });
});

// Polling endpoint for real-time updates
router.get('/sessions/:sessionId/updates', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { since = '0', limit = '50' } = req.query;
    
    const updates = await obd2RealtimeService.getRecentUpdates(
      sessionId, 
      parseInt(since), 
      parseInt(limit)
    );
    
    res.json({
      data: updates,
      timestamp: Date.now(),
      hasMore: updates.length === parseInt(limit)
    });
  } catch (error) {
    console.error('❌ Failed to get updates:', error);
    res.status(500).json({ error: 'Failed to get updates' });
  }
});

// Long polling endpoint
router.get('/sessions/:sessionId/long-poll', async (req, res) => {
  const { sessionId } = req.params;
  const { lastTimestamp = '0' } = req.query;
  const timeout = 30000; // 30 second timeout
  const startTime = Date.now();
  
  const checkForUpdates = async () => {
    try {
      const updates = await obd2RealtimeService.getRecentUpdates(
        sessionId, 
        parseInt(lastTimestamp),
        10
      );
      
      if (updates.length > 0) {
        return res.json({ 
          data: updates, 
          timestamp: Date.now(),
          type: 'data'
        });
      }
      
      // If no data and timeout not reached, check again
      if (Date.now() - startTime < timeout) {
        setTimeout(checkForUpdates, 1000);
      } else {
        // Timeout - return empty response
        res.json({ 
          data: [], 
          timestamp: Date.now(),
          type: 'timeout'
        });
      }
    } catch (error) {
      res.status(500).json({ error: 'Long polling error', message: error.message });
    }
  };
  
  checkForUpdates();
});

// Get aggregated data for charts
router.get('/sessions/:sessionId/aggregated', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { interval = 'minute', limit = '100' } = req.query;
    
    const data = await obd2RealtimeService.getAggregatedData(
      sessionId,
      interval,
      parseInt(limit)
    );
    
    res.json({
      data,
      interval,
      count: data.length
    });
  } catch (error) {
    console.error('❌ Failed to get aggregated data:', error);
    res.status(500).json({ error: 'Failed to get aggregated data' });
  }
});

// Get data by time range with Redis caching
router.get('/sessions/:sessionId/range', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { startTime, endTime, limit = '1000' } = req.query;
    
    if (!startTime) {
      return res.status(400).json({ error: 'startTime parameter is required' });
    }
    
    const data = await obd2RealtimeService.getDataByTimeRange(
      sessionId,
      parseInt(startTime),
      endTime ? parseInt(endTime) : Date.now(),
      parseInt(limit)
    );
    
    res.json({
      data,
      count: data.length,
      startTime: parseInt(startTime),
      endTime: endTime ? parseInt(endTime) : Date.now()
    });
  } catch (error) {
    console.error('❌ Failed to get data by range:', error);
    res.status(500).json({ error: 'Failed to get data by range' });
  }
});

// Get session statistics
router.get('/sessions/:sessionId/stats', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const stats = await obd2RealtimeService.getSessionStats(sessionId);
    
    if (!stats) {
      return res.status(404).json({ error: 'Session not found or no data available' });
    }
    
    res.json(stats);
  } catch (error) {
    console.error('❌ Failed to get session stats:', error);
    res.status(500).json({ error: 'Failed to get session stats' });
  }
});

// Enhanced data ingestion endpoint for external OBD2 devices
router.post('/sessions/:sessionId/data', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const dataPoint = req.body;
    
    // Validate session exists
    const session = await DiagnosticSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Store in MongoDB (existing functionality)
    const obd2DataPoint = new OBD2DataPoint({
      sessionId,
      timestamp: new Date(dataPoint.timestamp || Date.now()),
      ...dataPoint
    });
    
    await obd2DataPoint.save();
    
    // Store in Redis for real-time access
    await obd2RealtimeService.storeDataPoint(sessionId, {
      ...dataPoint,
      timestamp: obd2DataPoint.timestamp.getTime()
    });
    
    // Update session data point count
    await DiagnosticSession.findByIdAndUpdate(sessionId, {
      $inc: { dataPointCount: 1 },
      $set: { updatedAt: new Date() }
    });
    
    res.json({ 
      success: true, 
      timestamp: obd2DataPoint.timestamp,
      dataPointId: obd2DataPoint._id
    });
    
  } catch (error) {
    console.error('❌ Failed to store data point:', error);
    res.status(500).json({ error: 'Failed to store data point' });
  }
});

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    // Check MongoDB connection
    const isConnected = mongoose.connection.readyState === 1;
    
    // Check Redis connection
    const redisHealth = await obd2RealtimeService.healthCheck();
    
    const overall = isConnected && redisHealth.status === 'up' ? 'healthy' : 'unhealthy';
    
    res.json({ 
      status: overall, 
      timestamp: new Date().toISOString(),
      database: isConnected ? 'connected' : 'disconnected',
      redis: redisHealth,
      service: 'obd2'
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'unhealthy', 
      timestamp: new Date().toISOString(),
      database: 'error',
      redis: { status: 'down', error: error.message },
      error: error.message,
      service: 'obd2'
    });
  }
});

export default router;