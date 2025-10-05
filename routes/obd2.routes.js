// routes/obd2.routes.js - HTTP-based OBD2 diagnostic routes

import express from 'express';
import mongoose from 'mongoose';
import obd2RealtimeService from '../services/OBD2RealtimeService.js';
import OBD2AnalysisService from '../services/obd2AnalysisService.js';

const router = express.Router();

// Initialize analysis service
const analysisService = new OBD2AnalysisService();

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

// Schema for Session Sharing (HTTP-based)
const SharedSessionSchema = new mongoose.Schema({
  shareCode: { type: String, unique: true, index: true }, // 6-character code
  diagnosticSessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DiagnosticSession',
    required: true
  },
  hostUserId: String, // Host user identifier
  connectedClients: [{
    clientId: String,
    lastSeen: { type: Date, default: Date.now }
  }],
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

// HTTP-Based Session Management Routes

// Start a new diagnostic session
router.post('/sessions', async (req, res) => {
  try {
    const { userId, vehicleId, sessionName, vehicleInfo, sessionNotes, tags } = req.body;

    const session = new DiagnosticSession({
      userId: userId || null,
      vehicleId: vehicleId || null,
      sessionName: sessionName || null,
      startTime: new Date(),
      vehicleInfo: vehicleInfo || {},
      sessionNotes: sessionNotes || null,
      tags: tags || []
    });

    const savedSession = await session.save();

    res.status(201).json({
      success: true,
      session: {
        sessionId: savedSession._id,
        startTime: savedSession.startTime,
        status: savedSession.status
      }
    });

    console.log(`📊 New OBD2 diagnostic session started: ${savedSession._id}`);
  } catch (error) {
    console.error('❌ Failed to start session:', error);
    res.status(500).json({ error: 'Failed to start diagnostic session' });
  }
});

// End a diagnostic session
router.put('/sessions/:sessionId/end', async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Force flush any buffered data
    await dataAggregator.forceFlush(sessionId);

    const endTime = new Date();
    const session = await DiagnosticSession.findById(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status !== 'active') {
      return res.status(400).json({ error: 'Session is not active' });
    }

    const duration = Math.floor((endTime - session.startTime) / 1000);

    const updatedSession = await DiagnosticSession.findByIdAndUpdate(
      sessionId,
      {
        endTime,
        duration,
        status: 'completed',
        updatedAt: new Date()
      },
      { new: true }
    );

    // End any associated sharing sessions
    await SharedSession.updateMany(
      { diagnosticSessionId: sessionId },
      { isActive: false }
    );

    res.json({
      success: true,
      session: {
        sessionId: updatedSession._id,
        endTime: updatedSession.endTime,
        duration: updatedSession.duration,
        dataPointCount: updatedSession.dataPointCount,
        status: updatedSession.status
      }
    });

    console.log(`📊 OBD2 diagnostic session ended: ${sessionId}`);
  } catch (error) {
    console.error('❌ Failed to end session:', error);
    res.status(500).json({ error: 'Failed to end diagnostic session' });
  }
});

// Update session status
router.put('/sessions/:sessionId/status', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { status } = req.body;

    if (!['active', 'paused', 'error', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const updatedSession = await DiagnosticSession.findByIdAndUpdate(
      sessionId,
      { status, updatedAt: new Date() },
      { new: true }
    );

    if (!updatedSession) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({
      success: true,
      session: {
        sessionId: updatedSession._id,
        status: updatedSession.status
      }
    });
  } catch (error) {
    console.error('❌ Failed to update session status:', error);
    res.status(500).json({ error: 'Failed to update session status' });
  }
});

// Create sharing session
router.post('/sessions/:sessionId/share', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { hostUserId } = req.body;

    // Validate session exists and is active
    const session = await DiagnosticSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status !== 'active') {
      return res.status(400).json({ error: 'Can only share active sessions' });
    }

    // Generate unique 6-character code
    const shareCode = generateShareCode();

    const sharedSession = new SharedSession({
      shareCode,
      diagnosticSessionId: sessionId,
      hostUserId: hostUserId || null
    });

    await sharedSession.save();

    res.status(201).json({
      success: true,
      shareCode,
      sessionId,
      expiresAt: sharedSession.createdAt
    });

    console.log(`🔗 Share session created: ${shareCode} for diagnostic session: ${sessionId}`);
  } catch (error) {
    console.error('❌ Failed to create share session:', error);
    res.status(500).json({ error: 'Failed to create sharing session' });
  }
});

// Join sharing session
router.post('/share/:shareCode/join', async (req, res) => {
  try {
    const { shareCode } = req.params;
    const { clientId } = req.body;

    const sharedSession = await SharedSession.findOne({
      shareCode,
      isActive: true
    }).populate('diagnosticSessionId');

    if (!sharedSession) {
      return res.status(404).json({ error: 'Share code not found or expired' });
    }

    // Add client to the sharing session
    await SharedSession.findOneAndUpdate(
      { shareCode },
      {
        $addToSet: {
          connectedClients: {
            clientId: clientId || `client_${Date.now()}`,
            lastSeen: new Date()
          }
        }
      }
    );

    res.json({
      success: true,
      shareCode,
      sessionId: sharedSession.diagnosticSessionId._id,
      sessionInfo: {
        sessionName: sharedSession.diagnosticSessionId.sessionName,
        startTime: sharedSession.diagnosticSessionId.startTime,
        vehicleInfo: sharedSession.diagnosticSessionId.vehicleInfo,
        status: sharedSession.diagnosticSessionId.status
      }
    });

    console.log(`👥 Client joined share session: ${shareCode}`);
  } catch (error) {
    console.error('❌ Failed to join share session:', error);
    res.status(500).json({ error: 'Failed to join sharing session' });
  }
});

// Update client activity in sharing session
router.put('/share/:shareCode/ping', async (req, res) => {
  try {
    const { shareCode } = req.params;
    const { clientId } = req.body;

    const result = await SharedSession.findOneAndUpdate(
      {
        shareCode,
        isActive: true,
        'connectedClients.clientId': clientId
      },
      {
        $set: { 'connectedClients.$.lastSeen': new Date() }
      }
    );

    if (!result) {
      return res.status(404).json({ error: 'Share session or client not found' });
    }

    res.json({ success: true, timestamp: new Date() });
  } catch (error) {
    console.error('❌ Failed to update client activity:', error);
    res.status(500).json({ error: 'Failed to update client activity' });
  }
});

// Get active session for a user (helper endpoint)
router.get('/sessions/active', async (req, res) => {
  try {
    const { userId } = req.query;

    let query = { status: 'active' };
    if (userId) {
      query.userId = userId;
    }

    const activeSessions = await DiagnosticSession
      .find(query)
      .sort({ startTime: -1 })
      .limit(10)
      .lean();

    // Map MongoDB _id to id for frontend compatibility
    const mappedActiveSessions = activeSessions.map(session => ({
      ...session,
      id: session._id.toString()
    }));

    res.json({
      activeSessions: mappedActiveSessions,
      count: mappedActiveSessions.length,
      message: mappedActiveSessions.length === 0 ? 'No active sessions found. Create one using POST /api/obd2/sessions' : undefined
    });
  } catch (error) {
    console.error('❌ Failed to fetch active sessions:', error);
    res.status(500).json({ error: 'Failed to fetch active sessions' });
  }
});

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

    // Map MongoDB _id to id for frontend compatibility
    const mappedSessions = sessions.map(session => ({
      ...session,
      id: session._id.toString()
    }));

    const total = await DiagnosticSession.countDocuments(query);

    res.json({
      sessions: mappedSessions,
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

    // Map MongoDB _id to id for frontend compatibility
    const mappedSession = {
      ...session,
      id: session._id.toString()
    };

    res.json({ session: mappedSession });
  } catch (error) {
    console.error('❌ Failed to fetch session:', error);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

// Get session data points with filtering and aggregation
router.get('/sessions/:sessionId/data', async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Validate sessionId parameter
    if (!sessionId || sessionId === 'undefined' || sessionId === 'null') {
      return res.status(400).json({
        error: 'Invalid session ID',
        message: 'You must provide a valid session ID',
        received: sessionId
      });
    }

    // Validate MongoDB ObjectId format
    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({
        error: 'Invalid session ID format',
        message: 'Session ID must be a valid MongoDB ObjectId',
        received: sessionId
      });
    }

    const {
      startTime,
      endTime,
      interval = '1 minute',
      parameters,
      limit = 1000,
      aggregate = 'false'
    } = req.query;

    // Convert string sessionId to MongoDB ObjectId for query
    let query = { sessionId: new mongoose.Types.ObjectId(sessionId) };

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

    // Validate sessionId parameter
    if (!sessionId || sessionId === 'undefined' || sessionId === 'null') {
      return res.status(400).json({
        error: 'Invalid session ID',
        message: 'You must create a session first using POST /api/obd2/sessions',
        received: sessionId
      });
    }

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

    // Validate sessionId parameter
    if (!sessionId || sessionId === 'undefined' || sessionId === 'null') {
      return res.status(400).json({
        error: 'Invalid session ID',
        message: 'You must create a session first using POST /api/obd2/sessions',
        received: sessionId
      });
    }

    // Validate session exists
    const session = await DiagnosticSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
        message: 'The specified session does not exist. Create a new session first.',
        sessionId
      });
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

// =====================================================
// OBD2 Data Analysis Endpoints
// =====================================================

// Analyze a diagnostic session
router.post('/sessions/:sessionId/analyze', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { analysisType = 'summary', timeRange } = req.body;

    console.log(`🔍 Analyzing OBD2 session: ${sessionId}, type: ${analysisType}`);

    const result = await analysisService.executeTool('analyze_obd2_session', {
      sessionId,
      analysisType,
      timeRange
    });

    res.json({
      success: true,
      sessionId,
      analysisType,
      timestamp: new Date().toISOString(),
      result
    });

  } catch (error) {
    console.error('❌ Session analysis failed:', error);
    res.status(500).json({
      success: false,
      error: 'Session analysis failed',
      message: error.message
    });
  }
});

// Compare multiple sessions
router.post('/sessions/compare', async (req, res) => {
  try {
    const { sessionIds, metrics = ['all'] } = req.body;

    if (!sessionIds || sessionIds.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'At least two session IDs required for comparison'
      });
    }

    console.log(`🔍 Comparing OBD2 sessions: ${sessionIds.join(', ')}`);

    const result = await analysisService.executeTool('compare_obd2_sessions', {
      sessionIds,
      metrics
    });

    res.json({
      success: true,
      sessionIds,
      metrics,
      timestamp: new Date().toISOString(),
      result
    });

  } catch (error) {
    console.error('❌ Session comparison failed:', error);
    res.status(500).json({
      success: false,
      error: 'Session comparison failed',
      message: error.message
    });
  }
});

// Get diagnostic recommendations
router.post('/sessions/:sessionId/recommendations', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { dtcCodes = [], symptoms = [] } = req.body;

    console.log(`🔍 Getting diagnostic recommendations for session: ${sessionId}`);

    const result = await analysisService.executeTool('get_obd2_diagnostic_recommendations', {
      sessionId,
      dtcCodes,
      symptoms
    });

    res.json({
      success: true,
      sessionId,
      timestamp: new Date().toISOString(),
      result
    });

  } catch (error) {
    console.error('❌ Diagnostic recommendations failed:', error);
    res.status(500).json({
      success: false,
      error: 'Diagnostic recommendations failed',
      message: error.message
    });
  }
});

// Calculate fuel economy metrics
router.post('/sessions/:sessionId/fuel-economy', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { unit = 'mpg' } = req.body;

    console.log(`🔍 Calculating fuel economy for session: ${sessionId}`);

    const result = await analysisService.executeTool('calculate_fuel_economy_metrics', {
      sessionId,
      unit
    });

    res.json({
      success: true,
      sessionId,
      unit,
      timestamp: new Date().toISOString(),
      result
    });

  } catch (error) {
    console.error('❌ Fuel economy calculation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Fuel economy calculation failed',
      message: error.message
    });
  }
});

// Detect anomalies in session data
router.post('/sessions/:sessionId/anomalies', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { sensitivity = 'medium', parameters } = req.body;

    console.log(`🔍 Detecting anomalies in session: ${sessionId}`);

    const result = await analysisService.executeTool('detect_obd2_anomalies', {
      sessionId,
      sensitivity,
      parameters
    });

    res.json({
      success: true,
      sessionId,
      sensitivity,
      timestamp: new Date().toISOString(),
      result
    });

  } catch (error) {
    console.error('❌ Anomaly detection failed:', error);
    res.status(500).json({
      success: false,
      error: 'Anomaly detection failed',
      message: error.message
    });
  }
});

// Generate comprehensive health report
router.post('/sessions/:sessionId/health-report', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { includeHistory = true, reportFormat = 'summary' } = req.body;

    console.log(`🔍 Generating health report for session: ${sessionId}`);

    const result = await analysisService.executeTool('generate_obd2_health_report', {
      sessionId,
      includeHistory,
      reportFormat
    });

    res.json({
      success: true,
      sessionId,
      reportFormat,
      timestamp: new Date().toISOString(),
      result
    });

  } catch (error) {
    console.error('❌ Health report generation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Health report generation failed',
      message: error.message
    });
  }
});

// Get available analysis tools
router.get('/analysis/tools', (req, res) => {
  try {
    const tools = analysisService.getToolDefinitions();

    res.json({
      success: true,
      availableTools: tools.map(tool => ({
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters
      })),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Failed to get analysis tools:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get analysis tools',
      message: error.message
    });
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