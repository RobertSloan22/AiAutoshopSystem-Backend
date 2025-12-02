// routes/obd2.routes.js - HTTP-based OBD2 diagnostic routes

import express from 'express';
import mongoose from 'mongoose';
import OpenAI from 'openai';
import crypto from 'crypto';
import DiagnosticSession from '../models/diagnosticSession.model.js';
import Analysis from '../models/analysis.model.js';
import obd2RealtimeService from '../services/OBD2RealtimeService.js';
import OBD2AnalysisService from '../services/obd2AnalysisService.js';
import PythonExecutionService from '../services/pythonExecutionService.js';
import obd2AnalyticsPackService from '../services/obd2AnalyticsPackService.js';
// import ResponsesAPIService from '../services/responsesService.js'; // Reserved for future use

// Secure Code Interpreter imports
import OpenAIInterface from '../obd2-code-interpreter/core/OpenAIInterface.js';
import OBD2DataAccessAgent from '../obd2-code-interpreter/agents/OBD2DataAccessAgent.js';
import OBD2AnalysisAgent from '../obd2-code-interpreter/agents/OBD2AnalysisAgent.js';
import OBD2DataAccessTool from '../obd2-code-interpreter/tools/OBD2DataAccessTool.js';
import IntervalAnalysisService from '../services/intervalAnalysisService.js';
// Note: OBD2DataPoint model is defined below in this file (line 207)

const router = express.Router();

// Initialize analysis service
const analysisService = new OBD2AnalysisService();

// Initialize Python execution service for visualizations
const pythonService = new PythonExecutionService();

// Initialize responses service for enhanced analysis with visuals
// const responsesService = new ResponsesAPIService(); // Reserved for future use

// MongoDB Schemas for OBD2 data (alternative to PostgreSQL)

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
const OBD2DataPoint = mongoose.model('OBD2DataPoint', OBD2DataPointSchema);
const DTCEvent = mongoose.model('DTCEvent', DTCEventSchema);
const SharedSession = mongoose.model('SharedSession', SharedSessionSchema);

// Initialize OpenAI interface for secure analysis (moved here for early initialization)
const secureOpenAIInterface = new OpenAIInterface(process.env.OPENAI_API_KEY);

// Declare interval analysis service variable
let intervalAnalysisService = null;

// Initialize interval analysis service
const initializeIntervalAnalysisService = () => {
  if (!intervalAnalysisService) {
    intervalAnalysisService = new IntervalAnalysisService(
      OBD2DataPoint,
      DiagnosticSession,
      secureOpenAIInterface
    );
    console.log('✅ Interval Analysis Service initialized');
  }
  return intervalAnalysisService;
};

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
    const {
      userId,
      vehicleId,
      sessionName,
      vehicleInfo,
      sessionNotes,
      tags,
      selectedPids = [],
      dtcCodes = [],
      affectedSystems,
      focusAreas = [],
      metadata,
      pidConfiguration
    } = req.body;

    const session = new DiagnosticSession({
      userId: userId || null,
      vehicleId: vehicleId || null,
      sessionName: sessionName || null,
      startTime: new Date(),
      vehicleInfo: vehicleInfo || {},
      sessionNotes: sessionNotes || null,
      tags: tags || [],
      selectedPids,
      dtcCodes,
      affectedSystems: affectedSystems || null,
      focusAreas,
      metadata: metadata || null,
      pidConfiguration: pidConfiguration || null
    });

    const savedSession = await session.save();

    // ENABLED: Interval analysis for real-time monitoring (30s and 3min intervals)
    const intervalService = initializeIntervalAnalysisService();
    intervalService.startIntervalAnalysis(savedSession._id.toString()).catch(err => {
      console.error(`⚠️  Failed to start interval analysis for session ${savedSession._id}:`, err);
    });

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

    // ENABLED: Stop interval analysis for this session
    const intervalService = initializeIntervalAnalysisService();
    intervalService.stopIntervalAnalysis(sessionId);
    console.log(`🛑 Stopped interval analysis for session ${sessionId}`);

    // Force flush any buffered data
    await dataAggregator.forceFlush(sessionId);

    // CRITICAL: Wait for data to be committed to database before proceeding
    // This ensures analysis can access the data immediately after session end
    let dataCommitted = false;
    let retryCount = 0;
    const maxRetries = 5;
    const retryDelay = 200; // 200ms between retries

    while (!dataCommitted && retryCount < maxRetries) {
      // Check if data points exist in database
      const dataPointCount = await OBD2DataPoint.countDocuments({ 
        sessionId: new mongoose.Types.ObjectId(sessionId) 
      });
      
      if (dataPointCount > 0) {
        dataCommitted = true;
        console.log(`✅ Data committed: ${dataPointCount} data points found for session ${sessionId}`);
      } else {
        retryCount++;
        if (retryCount < maxRetries) {
          console.log(`⏳ Waiting for data commit (attempt ${retryCount}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }

    const endTime = new Date();
    const session = await DiagnosticSession.findById(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status !== 'active') {
      return res.status(400).json({ error: 'Session is not active' });
    }

    const duration = Math.floor((endTime - session.startTime) / 1000);

    // Get actual data point count from database
    const actualDataPointCount = await OBD2DataPoint.countDocuments({ 
      sessionId: new mongoose.Types.ObjectId(sessionId) 
    });

    const updatedSession = await DiagnosticSession.findByIdAndUpdate(
      sessionId,
      {
        endTime,
        duration,
        status: 'completed',
        dataPointCount: actualDataPointCount, // Use actual count from database
        updatedAt: new Date()
      },
      { new: true }
    );

    // End any associated sharing sessions
    await SharedSession.updateMany(
      { diagnosticSessionId: sessionId },
      { isActive: false }
    );

    // Trigger automatic analysis in background (non-blocking)
    // Only trigger if there's actual data to analyze
    if (actualDataPointCount > 0) {
      console.log(`🤖 Triggering automatic analysis for session ${sessionId}...`);

      // Initialize auto-analysis status
      await DiagnosticSession.findByIdAndUpdate(sessionId, {
        'autoAnalysis.status': 'pending'
      });

      // Run analysis in background (don't await)
      runAutoAnalysis(sessionId).catch(err => {
        console.error(`🤖 Background auto-analysis failed for session ${sessionId}:`, err);
      });
    } else {
      console.log(`⚠️  Skipping auto-analysis for session ${sessionId} - no data points`);
    }

    res.json({
      success: true,
      session: {
        sessionId: updatedSession._id,
        endTime: updatedSession.endTime,
        duration: updatedSession.duration,
        dataPointCount: updatedSession.dataPointCount,
        status: updatedSession.status,
        autoAnalysisTriggered: actualDataPointCount > 0
      }
    });

    console.log(`📊 OBD2 diagnostic session ended: ${sessionId} (${actualDataPointCount} data points)`);
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

// Get session status (lightweight endpoint for polling)
router.get('/sessions/:sessionId/status', async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({ error: 'Invalid session ID format' });
    }

    const session = await DiagnosticSession.findById(sessionId).lean();

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const computedDuration = session.duration ??
      (session.endTime && session.startTime
        ? Math.floor((session.endTime.getTime() - session.startTime.getTime()) / 1000)
        : null);

    res.json({
      sessionId: session._id.toString(),
      status: session.status,
      startTime: session.startTime,
      endTime: session.endTime,
      duration: computedDuration,
      dataPointCount: session.dataPointCount || 0,
      selectedPids: session.selectedPids || [],
      dtcCodes: session.dtcCodes || [],
      affectedSystems: session.affectedSystems || null,
      focusAreas: session.focusAreas || [],
      analysisTimestamp: session.analysisTimestamp,
      analysisType: session.analysisType,
      tags: session.tags || [],
      sessionNotes: session.sessionNotes || null,
      metadata: session.metadata || session.analysisMetadata || null,
      updatedAt: session.updatedAt
    });
  } catch (error) {
    console.error('❌ Failed to fetch session status:', error);
    res.status(500).json({ error: 'Failed to fetch session status' });
  }
});

// Get interval analysis results for a session
router.get('/sessions/:sessionId/interval-analysis', async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({ error: 'Invalid session ID format' });
    }

    const intervalService = initializeIntervalAnalysisService();
    const results = await intervalService.getIntervalAnalysisResults(sessionId);

    if (results.error) {
      return res.status(404).json({ error: results.error });
    }

    res.json({
      success: true,
      sessionId: results.sessionId,
      intervalAnalysis: results.intervalAnalysis,
      autoAnalysis: results.autoAnalysis,
      availableIntervals: Object.keys(results.intervalAnalysis || {}),
      message: Object.keys(results.intervalAnalysis || {}).length === 0
        ? 'No interval analysis results yet. Analysis runs at 15s, 60s, 2min, and 3min during active sessions.'
        : undefined
    });
  } catch (error) {
    console.error('❌ Failed to fetch interval analysis:', error);
    res.status(500).json({ error: 'Failed to fetch interval analysis results' });
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

    // Parse parameters filter (comma-separated list)
    const parameterList = parameters ? parameters.split(',').map(p => p.trim()) : null;
    const requiredFields = ['_id', 'sessionId', 'timestamp']; // Always include these

    // Convert string sessionId to MongoDB ObjectId for query
    let query = { sessionId: new mongoose.Types.ObjectId(sessionId) };

    // Add time range filters
    if (startTime || endTime) {
      query.timestamp = {};
      if (startTime) query.timestamp.$gte = new Date(startTime);
      if (endTime) query.timestamp.$lte = new Date(endTime);
    }

    // Helper function to filter data points by parameters
    const filterParameters = (dataPoint) => {
      if (!parameterList) return dataPoint;
      
      const filtered = {};
      // Always include required fields
      requiredFields.forEach(field => {
        if (dataPoint[field] !== undefined) {
          filtered[field] = dataPoint[field];
        }
      });
      // Include requested parameters
      parameterList.forEach(param => {
        if (dataPoint[param] !== undefined) {
          filtered[param] = dataPoint[param];
        }
      });
      return filtered;
    };

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

      let transformedData = result.map(item => ({
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

      // Filter by parameters if specified
      if (parameterList) {
        transformedData = transformedData.map(item => ({
          time_bucket: item.time_bucket,
          data: filterParameters(item.data)
        }));
      }

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

      // Filter by parameters if specified
      const filteredData = parameterList 
        ? dataPoints.map(filterParameters)
        : dataPoints;

      res.json({
        data: filteredData,
        count: filteredData.length,
        aggregated: false
      });
    }

  } catch (error) {
    console.error('❌ Failed to fetch session data:', error);
    res.status(500).json({ error: 'Failed to fetch session data' });
  }
});

// Update diagnostic session configuration/metadata
router.patch('/sessions/:sessionId/config', async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({ error: 'Invalid session ID format' });
    }

    const {
      selectedPids,
      configuredPids,
      dtcCodes,
      affectedSystems,
      focusAreas,
      analysisResults,
      analysisTimestamp,
      analysisType,
      visualizations,
      metadata,
      sessionNotes,
      tags,
      pidConfiguration,
      dataPointCount,
      status
    } = req.body || {};

    const updates = {};

    if (Array.isArray(selectedPids)) {
      updates.selectedPids = selectedPids;
    } else if (Array.isArray(configuredPids)) {
      updates.selectedPids = configuredPids;
    }

    if (Array.isArray(dtcCodes)) {
      updates.dtcCodes = dtcCodes;
    }

    if (affectedSystems !== undefined) {
      updates.affectedSystems = affectedSystems;
    }

    if (Array.isArray(focusAreas)) {
      updates.focusAreas = focusAreas;
    }

    if (analysisResults !== undefined) {
      updates.analysisResults = analysisResults;
    }

    if (analysisTimestamp) {
      updates.analysisTimestamp = new Date(analysisTimestamp);
    }

    if (analysisType !== undefined) {
      updates.analysisType = analysisType;
    }

    if (visualizations !== undefined) {
      updates.analysisVisualizations = Array.isArray(visualizations) ? visualizations : [visualizations];
    }

    if (metadata !== undefined) {
      updates.metadata = metadata;
      updates.analysisMetadata = metadata;
    }

    if (sessionNotes !== undefined) {
      updates.sessionNotes = sessionNotes;
    }

    if (Array.isArray(tags)) {
      updates.tags = tags;
    }

    if (pidConfiguration !== undefined) {
      updates.pidConfiguration = pidConfiguration;
    }

    if (typeof dataPointCount === 'number' && !Number.isNaN(dataPointCount)) {
      updates.dataPointCount = dataPointCount;
    }

    if (status && ['active', 'completed', 'paused', 'error', 'cancelled'].includes(status)) {
      updates.status = status;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields provided for update' });
    }

    updates.updatedAt = new Date();

    const updatedSession = await DiagnosticSession.findByIdAndUpdate(
      sessionId,
      { $set: updates },
      { new: true, lean: true }
    );

    if (!updatedSession) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({
      success: true,
      session: {
        sessionId: updatedSession._id.toString(),
        status: updatedSession.status,
        selectedPids: updatedSession.selectedPids || [],
        dtcCodes: updatedSession.dtcCodes || [],
        affectedSystems: updatedSession.affectedSystems || null,
        focusAreas: updatedSession.focusAreas || [],
        analysisTimestamp: updatedSession.analysisTimestamp || null,
        analysisType: updatedSession.analysisType || null,
        dataPointCount: updatedSession.dataPointCount || 0,
        tags: updatedSession.tags || [],
        sessionNotes: updatedSession.sessionNotes || null
      }
    });
  } catch (error) {
    console.error('❌ Failed to update session configuration:', error);
    res.status(500).json({ error: 'Failed to update session configuration' });
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

// Helper function to generate comprehensive analysis with visualizations, anomaly detection, DTC analysis, and health scoring
// eslint-disable-next-line no-unused-vars
async function performEnhancedAnalysis(sessionId, session, dataPoints, dtcCodes = [], analysisType = 'comprehensive', includeVisualization = true) {
  const results = {
    visualizations: [],
    anomalies: { inRange: [], outOfRange: [], critical: [] },
    dtcAnalysis: {},
    correlations: {},
    healthScores: {},
    comprehensiveReport: {}
  };

  console.log(`🔍 Starting enhanced analysis for session ${sessionId}`);
  console.log(`📊 Data points: ${dataPoints.length}, DTC codes: ${dtcCodes.length}`);

  // STEP 1: Generate initial visualizations of the data
  if (includeVisualization && dataPoints.length > 0) {
    console.log('📈 STEP 1: Generating initial data visualizations...');
    
    try {
      // Prepare data for visualization
      const visualizationData = dataPoints.map(dp => ({
        timestamp: dp.timestamp,
        rpm: dp.rpm,
        speed: dp.speed,
        engineTemp: dp.engineTemp,
        throttlePosition: dp.throttlePosition,
        engineLoad: dp.engineLoad,
        maf: dp.maf,
        map: dp.map,
        fuelTrimShortB1: dp.fuelTrimShortB1,
        fuelTrimLongB1: dp.fuelTrimLongB1,
        o2B1S1Voltage: dp.o2B1S1Voltage,
        batteryVoltage: dp.batteryVoltage
      }));

      // Generate comprehensive visualization Python code
      const visualizationCode = `
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from datetime import datetime
import matplotlib.patches as mpatches
import warnings
warnings.filterwarnings('ignore')

# Set professional styling
plt.style.use('seaborn-v0_8-darkgrid')
sns.set_palette("husl")

# data variable will be loaded from JSON file automatically
df = pd.DataFrame(data)

# Convert timestamp to datetime
df['timestamp'] = pd.to_datetime(df['timestamp'])
df = df.sort_values('timestamp')

# Create comprehensive dashboard
fig = plt.figure(figsize=(20, 14))
fig.suptitle('OBD2 Session Data Overview\\nInitial Visualization', fontsize=18, fontweight='bold', y=0.98)

# Plot 1: Engine RPM and Speed
ax1 = plt.subplot(3, 2, 1)
ax1_twin = ax1.twinx()
line1 = ax1.plot(df['timestamp'], df['rpm'], label='RPM', color='#2E86AB', linewidth=2)
line2 = ax1_twin.plot(df['timestamp'], df['speed'], label='Speed (km/h)', color='#A23B72', linewidth=2)
ax1.set_xlabel('Time', fontsize=10)
ax1.set_ylabel('RPM', fontsize=10, color='#2E86AB')
ax1_twin.set_ylabel('Speed (km/h)', fontsize=10, color='#A23B72')
ax1.set_title('Engine RPM and Vehicle Speed', fontsize=12, fontweight='bold')
ax1.grid(True, alpha=0.3)
ax1.legend(loc='upper left')
ax1_twin.legend(loc='upper right')

# Plot 2: Engine Temperature
ax2 = plt.subplot(3, 2, 2)
ax2.plot(df['timestamp'], df['engineTemp'], label='Engine Temp', color='#F18F01', linewidth=2)
ax2.axhline(y=180, color='green', linestyle='--', alpha=0.5, label='Normal Min (180°F)')
ax2.axhline(y=220, color='green', linestyle='--', alpha=0.5, label='Normal Max (220°F)')
ax2.axhline(y=240, color='red', linestyle='--', alpha=0.5, label='Critical (240°F)')
ax2.fill_between(df['timestamp'], 180, 220, alpha=0.1, color='green', label='Normal Range')
ax2.set_xlabel('Time', fontsize=10)
ax2.set_ylabel('Temperature (°F)', fontsize=10)
ax2.set_title('Engine Temperature', fontsize=12, fontweight='bold')
ax2.legend(loc='best')
ax2.grid(True, alpha=0.3)

# Plot 3: Throttle Position and Engine Load
ax3 = plt.subplot(3, 2, 3)
ax3_twin = ax3.twinx()
line3 = ax3.plot(df['timestamp'], df['throttlePosition'], label='Throttle %', color='#C73E1D', linewidth=2)
line4 = ax3_twin.plot(df['timestamp'], df['engineLoad'], label='Engine Load %', color='#6A994E', linewidth=2)
ax3.set_xlabel('Time', fontsize=10)
ax3.set_ylabel('Throttle Position (%)', fontsize=10, color='#C73E1D')
ax3_twin.set_ylabel('Engine Load (%)', fontsize=10, color='#6A994E')
ax3.set_title('Throttle Position and Engine Load', fontsize=12, fontweight='bold')
ax3.grid(True, alpha=0.3)
ax3.legend(loc='upper left')
ax3_twin.legend(loc='upper right')

# Plot 4: Air Flow (MAF/MAP)
ax4 = plt.subplot(3, 2, 4)
if 'maf' in df.columns and df['maf'].notna().any():
    ax4.plot(df['timestamp'], df['maf'], label='MAF (g/s)', color='#06A77D', linewidth=2)
if 'map' in df.columns and df['map'].notna().any():
    ax4_twin = ax4.twinx()
    ax4_twin.plot(df['timestamp'], df['map'], label='MAP (kPa)', color='#F77F00', linewidth=2)
    ax4_twin.set_ylabel('MAP (kPa)', fontsize=10, color='#F77F00')
    ax4_twin.legend(loc='upper right')
ax4.set_xlabel('Time', fontsize=10)
ax4.set_ylabel('MAF (g/s)', fontsize=10, color='#06A77D')
ax4.set_title('Mass Air Flow and Manifold Pressure', fontsize=12, fontweight='bold')
ax4.legend(loc='upper left')
ax4.grid(True, alpha=0.3)

# Plot 5: Fuel Trims
ax5 = plt.subplot(3, 2, 5)
if 'fuelTrimShortB1' in df.columns and df['fuelTrimShortB1'].notna().any():
    ax5.plot(df['timestamp'], df['fuelTrimShortB1'], label='Short Term FT B1', color='#E63946', linewidth=2, alpha=0.7)
if 'fuelTrimLongB1' in df.columns and df['fuelTrimLongB1'].notna().any():
    ax5.plot(df['timestamp'], df['fuelTrimLongB1'], label='Long Term FT B1', color='#457B9D', linewidth=2, alpha=0.7)
ax5.axhline(y=-10, color='orange', linestyle='--', alpha=0.5)
ax5.axhline(y=10, color='orange', linestyle='--', alpha=0.5)
ax5.fill_between(df['timestamp'], -10, 10, alpha=0.1, color='green', label='Normal Range (±10%)')
ax5.set_xlabel('Time', fontsize=10)
ax5.set_ylabel('Fuel Trim (%)', fontsize=10)
ax5.set_title('Fuel Trim Analysis', fontsize=12, fontweight='bold')
ax5.legend(loc='best')
ax5.grid(True, alpha=0.3)

# Plot 6: Battery Voltage
ax6 = plt.subplot(3, 2, 6)
if 'batteryVoltage' in df.columns and df['batteryVoltage'].notna().any():
    ax6.plot(df['timestamp'], df['batteryVoltage'], label='Battery Voltage', color='#7209B7', linewidth=2)
    ax6.axhline(y=12.6, color='green', linestyle='--', alpha=0.5, label='Normal Min (12.6V)')
    ax6.axhline(y=14.5, color='green', linestyle='--', alpha=0.5, label='Normal Max (14.5V)')
    ax6.fill_between(df['timestamp'], 12.6, 14.5, alpha=0.1, color='green', label='Normal Range')
ax6.set_xlabel('Time', fontsize=10)
ax6.set_ylabel('Voltage (V)', fontsize=10)
ax6.set_title('Battery Voltage', fontsize=12, fontweight='bold')
ax6.legend(loc='best')
ax6.grid(True, alpha=0.3)

plt.tight_layout(rect=[0, 0, 1, 0.96])

# Save the plot
plot_filename = f'obd2_initial_visualization_{sessionId}_{int(pd.Timestamp.now().timestamp())}.png'
plt.savefig(plot_filename, dpi=150, bbox_inches='tight')
plt.close()

print(f"✅ Initial visualization saved as {plot_filename}")
print(f"📊 Visualized {len(df)} data points")
print(f"📈 Generated 6 comprehensive charts")
`;

      const vizResult = await pythonService.executeCode(visualizationCode, {
        save_plots: true,
        plot_filename: `obd2_initial_visualization_${sessionId}`,
        data: { data: visualizationData }
      });

      if (vizResult.success && vizResult.plots && vizResult.plots.length > 0) {
        results.visualizations.push({
          type: 'initial_overview',
          plots: vizResult.plots,
          description: 'Initial comprehensive data visualization showing all key parameters'
        });
        console.log(`✅ Generated ${vizResult.plots.length} initial visualization(s)`);
      }
    } catch (error) {
      console.error('⚠️ Failed to generate initial visualizations:', error);
    }
  }

  // STEP 2: Check for anomalies and range violations
  console.log('🔍 STEP 2: Checking for anomalies and range violations...');
  
  const pidMetadata = analysisService.pidMetadata || {};
  const rangeViolations = [];
  const inRangeParams = [];
  const criticalIssues = [];

  // Check each parameter against its normal range
  for (const [pidName, metadata] of Object.entries(pidMetadata)) {
    const values = dataPoints
      .map(dp => dp[pidName])
      .filter(v => v !== null && v !== undefined && !isNaN(v) && isFinite(v));

    if (values.length === 0) continue;

    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const normalRange = metadata.normalRange || metadata.operatingRange;
    const criticalThresholds = metadata.criticalThresholds;

    if (normalRange) {
      const isInRange = avg >= normalRange.min && avg <= normalRange.max;
      const hasOutliers = min < normalRange.min || max > normalRange.max;

      if (isInRange && !hasOutliers) {
        inRangeParams.push({
          parameter: pidName,
          average: avg,
          min: min,
          max: max,
          status: 'normal'
        });
      } else {
        const severity = criticalThresholds && (min < criticalThresholds.min || max > criticalThresholds.max) 
          ? 'critical' 
          : 'warning';
        
        rangeViolations.push({
          parameter: pidName,
          average: avg,
          min: min,
          max: max,
          normalRange: normalRange,
          status: severity,
          category: metadata.category,
          unit: metadata.unit
        });

        if (severity === 'critical') {
          criticalIssues.push({
            parameter: pidName,
            value: avg,
            normalRange: normalRange,
            category: metadata.category
          });
        }
      }
    }
  }

  results.anomalies = {
    inRange: inRangeParams,
    outOfRange: rangeViolations,
    critical: criticalIssues
  };

  console.log(`✅ Anomaly check complete: ${inRangeParams.length} in range, ${rangeViolations.length} out of range, ${criticalIssues.length} critical`);

  // STEP 3: Analyze DTC-related data and find correlations
  if (dtcCodes.length > 0) {
    console.log(`🔧 STEP 3: Analyzing DTC-related data for codes: ${dtcCodes.join(', ')}...`);
    
    // DTC to PID mapping (common diagnostic relationships)
    const dtcToPidMapping = {
      'P0171': ['fuelTrimLongB1', 'fuelTrimShortB1', 'maf', 'o2B1S1Voltage'], // System too lean
      'P0172': ['fuelTrimLongB1', 'fuelTrimShortB1', 'maf', 'o2B1S1Voltage'], // System too rich
      'P0300': ['rpm', 'engineLoad', 'maf', 'map'], // Random misfire
      'P0420': ['o2B1S1Voltage', 'o2B1S2Voltage', 'catalystTempB1S1'], // Catalyst efficiency
      'P0128': ['engineTemp', 'intakeTemp', 'coolantTemp'], // Coolant thermostat
      'P0131': ['o2B1S1Voltage', 'fuelTrimShortB1'], // O2 sensor low voltage
      'P0132': ['o2B1S1Voltage', 'fuelTrimShortB1'], // O2 sensor high voltage
      'P0174': ['fuelTrimLongB2', 'fuelTrimShortB2', 'maf', 'o2B2S1Voltage'], // Bank 2 too lean
      'P0175': ['fuelTrimLongB2', 'fuelTrimShortB2', 'maf', 'o2B2S1Voltage'], // Bank 2 too rich
    };

    const dtcAnalysis = {};
    
    for (const dtcCode of dtcCodes) {
      const relatedPids = dtcToPidMapping[dtcCode] || [];
      const dtcData = {};

      for (const pidName of relatedPids) {
        const values = dataPoints
          .map(dp => dp[pidName])
          .filter(v => v !== null && v !== undefined && !isNaN(v) && isFinite(v));

        if (values.length > 0) {
          const avg = values.reduce((a, b) => a + b, 0) / values.length;
          const min = Math.min(...values);
          const max = Math.max(...values);
          const stdDev = Math.sqrt(values.reduce((sq, n) => sq + Math.pow(n - avg, 2), 0) / values.length);

          dtcData[pidName] = {
            average: avg,
            min: min,
            max: max,
            stdDev: stdDev,
            sampleCount: values.length
          };
        }
      }

      // Find correlations between related PIDs for this DTC
      const correlations = {};
      if (relatedPids.length > 1) {
        for (let i = 0; i < relatedPids.length; i++) {
          for (let j = i + 1; j < relatedPids.length; j++) {
            const pid1 = relatedPids[i];
            const pid2 = relatedPids[j];
            const values1 = dataPoints.map(dp => dp[pid1]).filter(v => v !== null && !isNaN(v));
            const values2 = dataPoints.map(dp => dp[pid2]).filter(v => v !== null && !isNaN(v));

            if (values1.length > 10 && values2.length > 10) {
              // Calculate correlation coefficient using analysis service method
              const correlation = analysisService.calculateCorrelation(values1, values2);
              correlations[`${pid1}_${pid2}`] = correlation;
            }
          }
        }
      }

      dtcAnalysis[dtcCode] = {
        relatedPids: relatedPids,
        pidData: dtcData,
        correlations: correlations,
        analysis: `DTC ${dtcCode} analysis: ${relatedPids.length} related parameters analyzed`
      };
    }

    results.dtcAnalysis = dtcAnalysis;
    console.log(`✅ DTC analysis complete for ${dtcCodes.length} codes`);
  }

  // STEP 4: Calculate vehicle system health scores
  console.log('🏥 STEP 4: Calculating vehicle system health scores...');
  
  const systemScores = {
    engine: 100,
    fuel: 100,
    emissions: 100,
    cooling: 100,
    electrical: 100,
    overall: 100
  };

  // Calculate scores based on range violations and critical issues
  const systemMapping = {
    engine: ['rpm', 'engineLoad', 'throttlePosition'],
    fuel: ['fuelTrimShortB1', 'fuelTrimLongB1', 'fuelPressure', 'maf'],
    emissions: ['o2B1S1Voltage', 'o2B1S2Voltage', 'catalystTempB1S1'],
    cooling: ['engineTemp', 'intakeTemp'],
    electrical: ['batteryVoltage']
  };

  for (const [system, pids] of Object.entries(systemMapping)) {
    let violations = 0;
    let criticalCount = 0;

    for (const pid of pids) {
      const violation = rangeViolations.find(v => v.parameter === pid);
      if (violation) {
        violations++;
        if (violation.status === 'critical') criticalCount++;
      }
    }

    // Deduct points: -10 for warning, -25 for critical
    let score = 100;
    score -= violations * 10;
    score -= criticalCount * 15;
    score = Math.max(0, score);

    systemScores[system] = Math.round(score);
  }

  // Calculate overall score (weighted average)
  systemScores.overall = Math.round(
    (systemScores.engine * 0.3 +
     systemScores.fuel * 0.25 +
     systemScores.emissions * 0.2 +
     systemScores.cooling * 0.15 +
     systemScores.electrical * 0.1)
  );

  // If DTCs present, reduce overall score
  if (dtcCodes.length > 0) {
    systemScores.overall = Math.max(0, systemScores.overall - (dtcCodes.length * 10));
  }

  results.healthScores = systemScores;
  console.log(`✅ Health scores calculated: Overall: ${systemScores.overall}/100`);

  // STEP 5: Generate comprehensive report
  console.log('📋 STEP 5: Generating comprehensive analysis report...');
  
  results.comprehensiveReport = {
    sessionInfo: {
      sessionId: sessionId,
      duration: session.duration,
      dataPointCount: dataPoints.length,
      startTime: session.startTime,
      endTime: session.endTime
    },
    summary: {
      totalParameters: Object.keys(pidMetadata).length,
      parametersInRange: inRangeParams.length,
      parametersOutOfRange: rangeViolations.length,
      criticalIssues: criticalIssues.length,
      dtcCodes: dtcCodes.length
    },
    healthScores: systemScores,
    anomalies: results.anomalies,
    dtcAnalysis: results.dtcAnalysis,
    recommendations: generateRecommendations(systemScores, rangeViolations, criticalIssues, dtcCodes)
  };

  console.log('✅ Enhanced analysis complete!');
  return results;
}

// Helper function to generate recommendations
function generateRecommendations(healthScores, rangeViolations, criticalIssues, dtcCodes) {
  const recommendations = [];

  if (healthScores.overall < 70) {
    recommendations.push({
      priority: 'high',
      action: 'Schedule comprehensive diagnostic inspection',
      reason: 'Multiple systems showing degraded performance'
    });
  }

  if (criticalIssues.length > 0) {
    recommendations.push({
      priority: 'critical',
      action: 'Address critical parameter violations immediately',
      reason: `${criticalIssues.length} critical parameter(s) out of safe range`,
      affectedParameters: criticalIssues.map(i => i.parameter)
    });
  }

  if (dtcCodes.length > 0) {
    recommendations.push({
      priority: 'high',
      action: 'Diagnose and repair DTC codes',
      reason: `${dtcCodes.length} diagnostic trouble code(s) detected`,
      dtcCodes: dtcCodes
    });
  }

  if (healthScores.fuel < 80) {
    recommendations.push({
      priority: 'medium',
      action: 'Inspect fuel system components',
      reason: 'Fuel system health score below optimal'
    });
  }

  if (healthScores.emissions < 80) {
    recommendations.push({
      priority: 'medium',
      action: 'Check emission control systems',
      reason: 'Emission system health score below optimal'
    });
  }

  return recommendations;
}

// Analyze a diagnostic session with enhanced visual generation
router.post('/sessions/:sessionId/analyze', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const {
      analysisType = 'comprehensive',
      timeRange,
      includeVisualization = true,
      vehicleContext = {},
      customerContext = {}
    } = req.body;

    console.log(`🔍 Analyzing OBD2 session: ${sessionId}, type: ${analysisType}, visuals: ${includeVisualization}`);

    // Validate sessionId format
    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid session ID format',
        sessionId
      });
    }

    // First, get basic session info for context
    const session = await DiagnosticSession.findById(sessionId).lean();
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
        sessionId
      });
    }

    // CRITICAL: If session was just completed, wait for data to be fully committed
    // This handles race conditions where analysis is called immediately after session end
    const sessionJustEnded = session.status === 'completed' && 
                           session.endTime && 
                           (Date.now() - new Date(session.endTime).getTime()) < 10000; // Within 10 seconds

    // CRITICAL: Force flush any buffered data points before checking for data
    // This ensures all data is committed to the database before analysis
    // Try flushing with both string and ObjectId formats to handle any format variations
    console.log(`🔄 Flushing buffered data for session ${sessionId} before analysis...`);
    await dataAggregator.forceFlush(sessionId);
    // Also try with string format in case buffer uses different format
    await dataAggregator.forceFlush(sessionId.toString());
    
    // Small delay to ensure flush completes
    await new Promise(resolve => setTimeout(resolve, 200));

    // Verify data points actually exist in the database with retry logic for recently ended sessions
    let sampleDataPoints = [];
    let retryCount = 0;
    const maxRetries = sessionJustEnded ? 10 : 3; // More retries if session just ended
    const retryDelay = sessionJustEnded ? 500 : 300; // Longer delay if session just ended

    while (sampleDataPoints.length === 0 && retryCount < maxRetries) {
      sampleDataPoints = await OBD2DataPoint.find({ 
        sessionId: new mongoose.Types.ObjectId(sessionId) 
      })
        .sort({ timestamp: 1 })
        .limit(10)
        .lean();

      if (sampleDataPoints.length === 0 && retryCount < maxRetries - 1) {
        retryCount++;
        console.log(`⏳ Waiting for data commit (attempt ${retryCount}/${maxRetries}) for session ${sessionId}...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      } else {
        break;
      }
    }

    // Get actual data point count from database
    const actualDataPointCount = await OBD2DataPoint.countDocuments({ 
      sessionId: new mongoose.Types.ObjectId(sessionId) 
    });

    // Update session dataPointCount if it's incorrect (handles race conditions)
    if (actualDataPointCount > 0 && session.dataPointCount !== actualDataPointCount) {
      await DiagnosticSession.findByIdAndUpdate(sessionId, {
        dataPointCount: actualDataPointCount
      });
      console.log(`📊 Updated session dataPointCount from ${session.dataPointCount} to ${actualDataPointCount}`);
    }

    // Verify session has data to analyze
    if (actualDataPointCount === 0) {
      // Check if there's data in the buffer that wasn't flushed
      // Try both string and ObjectId formats for sessionId, and check all buffer keys
      const sessionIdStr = sessionId.toString();
      const sessionIdObj = new mongoose.Types.ObjectId(sessionId);
      const sessionIdObjStr = sessionIdObj.toString();
      
      // Check all buffer keys to find matching sessionId (handles format variations)
      let bufferKey = null;
      let bufferHasData = false;
      
      // Check direct matches first
      if (dataAggregator.buffer.has(sessionIdStr)) {
        const bufferData = dataAggregator.buffer.get(sessionIdStr);
        if (bufferData && bufferData.length > 0) {
          bufferKey = sessionIdStr;
          bufferHasData = true;
        }
      } else if (dataAggregator.buffer.has(sessionIdObjStr)) {
        const bufferData = dataAggregator.buffer.get(sessionIdObjStr);
        if (bufferData && bufferData.length > 0) {
          bufferKey = sessionIdObjStr;
          bufferHasData = true;
        }
      } else {
        // Check all buffer keys for a match (handles any format variations)
        for (const key of dataAggregator.buffer.keys()) {
          const keyStr = key.toString();
          const bufferData = dataAggregator.buffer.get(key);
          if (bufferData && bufferData.length > 0 && 
              (keyStr === sessionIdStr || keyStr === sessionIdObjStr || 
               new mongoose.Types.ObjectId(keyStr).toString() === sessionIdObjStr)) {
            bufferKey = key;
            bufferHasData = true;
            break;
          }
        }
      }
      
      console.warn(`⚠️ No data found for session ${sessionId}. Buffer has data: ${bufferHasData}, Session status: ${session.status}, Just ended: ${sessionJustEnded}`);
      
      // If buffer has data, try one more flush and wait
      if (bufferHasData && bufferKey) {
        console.log(`🔄 Buffer contains data (${dataAggregator.buffer.get(bufferKey).length} points), performing additional flush...`);
        await dataAggregator.forceFlush(bufferKey);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Re-check data count
        const retryDataPointCount = await OBD2DataPoint.countDocuments({ 
          sessionId: new mongoose.Types.ObjectId(sessionId) 
        });
        
        if (retryDataPointCount > 0) {
          console.log(`✅ Data found after additional flush: ${retryDataPointCount} data points`);
          // Update actualDataPointCount to use the newly found data
          actualDataPointCount = retryDataPointCount;
          // Re-fetch sample data points
          sampleDataPoints = await OBD2DataPoint.find({ 
            sessionId: new mongoose.Types.ObjectId(sessionId) 
          })
            .sort({ timestamp: 1 })
            .limit(10)
            .lean();
        } else {
          return res.status(400).json({
            success: false,
            error: 'No data available for analysis',
            message: 'Session has no data points. The session may have been created but no OBD2 data was recorded. Please ensure data recording was active during the session.',
            sessionId,
            dataPointCount: 0,
            sessionJustEnded,
            sessionStatus: session.status,
            sessionDuration: session.duration
          });
        }
      } else {
        return res.status(400).json({
          success: false,
          error: 'No data available for analysis',
          message: sessionJustEnded 
            ? 'Session was just ended but data is not yet available. Please wait a moment and try again.'
            : 'Session has no data points. Please collect OBD2 data first.',
          sessionId,
          dataPointCount: actualDataPointCount,
          sessionJustEnded,
          sessionStatus: session.status
        });
      }
    }

    console.log(`✅ Found ${sampleDataPoints.length} sample data points and ${actualDataPointCount} total data points for analysis`);

    // Fetch ALL data points for comprehensive analysis
    let query = { sessionId: new mongoose.Types.ObjectId(sessionId) };
    if (timeRange?.start || timeRange?.end) {
      query.timestamp = {};
      if (timeRange.start) query.timestamp.$gte = new Date(timeRange.start);
      if (timeRange.end) query.timestamp.$lte = new Date(timeRange.end);
    }
    
    const allDataPoints = await OBD2DataPoint.find(query).sort({ timestamp: 1 }).lean();
    console.log(`📊 Fetched ${allDataPoints.length} data points for enhanced analysis`);

    // Get DTC codes from session
    const dtcCodes = session.dtcCodes || [];

    // Perform enhanced analysis with visualizations, anomaly detection, DTC analysis, and health scoring
    const enhancedAnalysis = await performEnhancedAnalysis(
      sessionId,
      session,
      allDataPoints,
      dtcCodes,
      analysisType,
      includeVisualization
    );

    // Prepare enhanced vehicle context
    const enhancedVehicleContext = {
      ...vehicleContext,
      sessionId: sessionId,
      sessionName: session.sessionName,
      startTime: session.startTime,
      endTime: session.endTime,
      duration: session.duration,
      dataPointCount: session.dataPointCount,
      vehicleInfo: session.vehicleInfo || {}
    };

    // Also run the standard analysis service for additional insights
    const analysisResult = await analysisService.executeTool('analyze_obd2_session', {
      sessionId,
      analysisType,
      timeRange
    });

    // Generate comprehensive AI response based on enhanced analysis
    let fullResponse = '';
    let plotResults = enhancedAnalysis.visualizations.flatMap(v => v.plots || []);

    // Build comprehensive response with enhanced analysis results
    fullResponse = `# Comprehensive OBD2 Diagnostic Analysis Report\n\n`;
    fullResponse += `**Analysis Type**: ${analysisType}\n`;
    fullResponse += `**Session Duration**: ${Math.floor((session.duration || 0) / 60)} minutes\n`;
    fullResponse += `**Data Points Analyzed**: ${allDataPoints.length}\n\n`;

    // Add health scores
    if (enhancedAnalysis.healthScores) {
      fullResponse += `## Vehicle System Health Scores\n\n`;
      fullResponse += `- **Overall Health**: ${enhancedAnalysis.healthScores.overall}/100\n`;
      fullResponse += `- **Engine System**: ${enhancedAnalysis.healthScores.engine}/100\n`;
      fullResponse += `- **Fuel System**: ${enhancedAnalysis.healthScores.fuel}/100\n`;
      fullResponse += `- **Emissions System**: ${enhancedAnalysis.healthScores.emissions}/100\n`;
      fullResponse += `- **Cooling System**: ${enhancedAnalysis.healthScores.cooling}/100\n`;
      fullResponse += `- **Electrical System**: ${enhancedAnalysis.healthScores.electrical}/100\n\n`;
    }

    // Add anomaly detection results
    if (enhancedAnalysis.anomalies) {
      fullResponse += `## Parameter Range Analysis\n\n`;
      fullResponse += `- **Parameters in Normal Range**: ${enhancedAnalysis.anomalies.inRange.length}\n`;
      fullResponse += `- **Parameters Out of Range**: ${enhancedAnalysis.anomalies.outOfRange.length}\n`;
      fullResponse += `- **Critical Issues**: ${enhancedAnalysis.anomalies.critical.length}\n\n`;

      if (enhancedAnalysis.anomalies.outOfRange.length > 0) {
        fullResponse += `### Out of Range Parameters:\n`;
        enhancedAnalysis.anomalies.outOfRange.slice(0, 10).forEach(violation => {
          fullResponse += `- **${violation.parameter}**: Average ${violation.average.toFixed(2)} ${violation.unit || ''} (Normal: ${violation.normalRange.min}-${violation.normalRange.max}) - ${violation.status.toUpperCase()}\n`;
        });
        fullResponse += `\n`;
      }

      if (enhancedAnalysis.anomalies.critical.length > 0) {
        fullResponse += `### ⚠️ Critical Issues Requiring Immediate Attention:\n`;
        enhancedAnalysis.anomalies.critical.forEach(issue => {
          fullResponse += `- **${issue.parameter}** (${issue.category}): Value ${issue.value.toFixed(2)} outside safe range\n`;
        });
        fullResponse += `\n`;
      }
    }

    // Add DTC analysis
    if (dtcCodes.length > 0 && enhancedAnalysis.dtcAnalysis) {
      fullResponse += `## DTC Code Analysis\n\n`;
      fullResponse += `**Detected DTC Codes**: ${dtcCodes.join(', ')}\n\n`;

      for (const [dtcCode, dtcData] of Object.entries(enhancedAnalysis.dtcAnalysis)) {
        fullResponse += `### DTC ${dtcCode}\n`;
        fullResponse += `${dtcData.analysis}\n`;
        if (Object.keys(dtcData.pidData).length > 0) {
          fullResponse += `**Related Parameter Values:**\n`;
          for (const [pid, data] of Object.entries(dtcData.pidData)) {
            fullResponse += `- ${pid}: Avg ${data.average.toFixed(2)}, Range ${data.min.toFixed(2)}-${data.max.toFixed(2)}\n`;
          }
        }
        if (Object.keys(dtcData.correlations).length > 0) {
          fullResponse += `**Parameter Correlations:**\n`;
          for (const [corrKey, corrValue] of Object.entries(dtcData.correlations)) {
            const strength = Math.abs(corrValue) > 0.7 ? 'strong' : Math.abs(corrValue) > 0.5 ? 'moderate' : 'weak';
            fullResponse += `- ${corrKey}: ${(corrValue * 100).toFixed(1)}% (${strength})\n`;
          }
        }
        fullResponse += `\n`;
      }
    }

    // Add standard analysis results if available
    if (analysisResult.success && analysisResult.analysis) {
        const analysis = analysisResult.analysis;

        if (analysis.sessionInfo) {
        fullResponse += `## Session Information\n\n`;
          fullResponse += `- Duration: ${Math.floor(analysis.sessionInfo.duration / 60)} minutes\n`;
          fullResponse += `- Data Points: ${analysis.sessionInfo.dataPoints}\n`;
          fullResponse += `- Status: ${analysis.sessionInfo.status}\n\n`;
        }

        if (analysis.summary) {
          fullResponse += `**Summary:**\n${JSON.stringify(analysis.summary, null, 2)}\n\n`;
          
          // Add PID discovery information if available
          if (analysis.summary.pidDiscovery) {
            const pidDiscovery = analysis.summary.pidDiscovery;
            fullResponse += `**Discovered PIDs:** ${pidDiscovery.totalPIDs} parameters found\n`;
            fullResponse += `- Available PIDs: ${pidDiscovery.availablePIDs.join(', ')}\n\n`;
          }
          
          // Add PID analysis summary if available
          if (analysis.summary.pidAnalysis) {
            const pidAnalysis = analysis.summary.pidAnalysis;
            const pidCount = Object.keys(pidAnalysis).length;
            fullResponse += `**PID Analysis:** Comprehensive analysis performed on ${pidCount} parameters\n`;
            
            // Count issues by category
            const issuesByCategory = {};
            Object.values(pidAnalysis).forEach(pid => {
              if (pid.thresholdAnalysis?.status === 'critical' || pid.thresholdAnalysis?.status === 'warning') {
                const category = pid.category || 'unknown';
                issuesByCategory[category] = (issuesByCategory[category] || 0) + 1;
              }
            });
            
            if (Object.keys(issuesByCategory).length > 0) {
              fullResponse += `- Issues detected in: ${Object.keys(issuesByCategory).join(', ')}\n`;
            }
            fullResponse += `\n`;
          }
        }

        if (analysis.detailed) {
          fullResponse += `**Detailed Analysis:**\n${JSON.stringify(analysis.detailed, null, 2)}\n\n`;
        }

        if (analysis.anomalies) {
          fullResponse += `**Anomalies Detected:**\n`;
          fullResponse += `- Total Anomalies: ${analysis.anomalies.count || 0}\n`;
          
          // Add grouped anomaly information if available
          if (analysis.anomalies.bySeverity) {
            const bySeverity = analysis.anomalies.bySeverity;
            if (bySeverity.critical?.length > 0) {
              fullResponse += `- Critical: ${bySeverity.critical.length}\n`;
            }
            if (bySeverity.high?.length > 0) {
              fullResponse += `- High: ${bySeverity.high.length}\n`;
            }
            if (bySeverity.warning?.length > 0) {
              fullResponse += `- Warnings: ${bySeverity.warning.length}\n`;
            }
          }
          
          if (analysis.anomalies.byCategory) {
            const categories = Object.keys(analysis.anomalies.byCategory);
            if (categories.length > 0) {
              fullResponse += `- Affected Categories: ${categories.join(', ')}\n`;
            }
          }
          
          fullResponse += `\n${JSON.stringify(analysis.anomalies, null, 2)}\n\n`;
        }

        if (analysis.performance) {
          fullResponse += `**Performance Metrics:**\n${JSON.stringify(analysis.performance, null, 2)}\n\n`;
        }

        if (analysis.fuelEconomy) {
          fullResponse += `**Fuel Economy:**\n${JSON.stringify(analysis.fuelEconomy, null, 2)}\n\n`;
        }

        if (analysis.emissions) {
          fullResponse += `**Emissions Analysis:**\n${JSON.stringify(analysis.emissions, null, 2)}\n\n`;
        }
      }

      if (analysisResult.recommendations && analysisResult.recommendations.length > 0) {
        fullResponse += `## Additional Recommendations\n\n`;
        analysisResult.recommendations.forEach((rec, index) => {
          const recommendationText = typeof rec === 'string' ? rec : rec.message || rec.description || JSON.stringify(rec);
          fullResponse += `${index + 1}. ${recommendationText}\n`;
        });
        fullResponse += `\n`;
      }

    // Add recommendations from enhanced analysis
    if (enhancedAnalysis.comprehensiveReport?.recommendations) {
      fullResponse += `## Diagnostic Recommendations\n\n`;
      enhancedAnalysis.comprehensiveReport.recommendations.forEach((rec, index) => {
        fullResponse += `${index + 1}. **[${rec.priority.toUpperCase()}]** ${rec.action}\n`;
        fullResponse += `   Reason: ${rec.reason}\n`;
        if (rec.affectedParameters) {
          fullResponse += `   Affected Parameters: ${rec.affectedParameters.join(', ')}\n`;
        }
        if (rec.dtcCodes) {
          fullResponse += `   DTC Codes: ${rec.dtcCodes.join(', ')}\n`;
        }
        fullResponse += `\n`;
      });
    }

    // Add summary
    if (enhancedAnalysis.comprehensiveReport?.summary) {
      fullResponse += `## Analysis Summary\n\n`;
      const summary = enhancedAnalysis.comprehensiveReport.summary;
      fullResponse += `- Total Parameters Analyzed: ${summary.totalParameters}\n`;
      fullResponse += `- Parameters in Normal Range: ${summary.parametersInRange}\n`;
      fullResponse += `- Parameters Out of Range: ${summary.parametersOutOfRange}\n`;
      fullResponse += `- Critical Issues Found: ${summary.criticalIssues}\n`;
      if (summary.dtcCodes > 0) {
        fullResponse += `- DTC Codes Detected: ${summary.dtcCodes}\n`;
      }
      fullResponse += `\n`;
    }

    if (!analysisResult.success) {
      fullResponse += `\n⚠️ Standard analysis service returned: ${analysisResult.message || 'Unknown error'}\n`;
      fullResponse += `Enhanced analysis results are still available above.\n`;
    }

    // Prepare the enhanced response with all analysis results
    const response = {
      success: true,
      sessionId,
      analysisType,
      timestamp: new Date().toISOString(),
      analysis: {
        response: fullResponse,
        sessionInfo: {
          id: session._id,
          vehicleId: session.vehicleId,
          startTime: session.startTime,
          endTime: session.endTime,
          duration: session.duration,
          dataPointCount: session.dataPointCount,
          status: session.status
        }
      },
      // Include enhanced analysis results
      enhancedAnalysis: {
        healthScores: enhancedAnalysis.healthScores,
        anomalies: enhancedAnalysis.anomalies,
        dtcAnalysis: enhancedAnalysis.dtcAnalysis,
        comprehensiveReport: enhancedAnalysis.comprehensiveReport
      }
    };

    // Add raw plot data if available from analysis service
    if (analysisResult.plotData) {
      response.plotData = analysisResult.plotData;
      console.log(`✅ Including raw plot data for session ${sessionId}`);
    }

    // Add PID discovery and analysis data to response
    if (analysisResult.analysis?.summary?.pidDiscovery) {
      response.pidDiscovery = analysisResult.analysis.summary.pidDiscovery;
      console.log(`✅ Including PID discovery data: ${response.pidDiscovery.totalPIDs} PIDs found`);
    }

    if (analysisResult.analysis?.summary?.pidAnalysis) {
      response.pidAnalysis = analysisResult.analysis.summary.pidAnalysis;
      const pidCount = Object.keys(response.pidAnalysis).length;
      console.log(`✅ Including PID analysis data: ${pidCount} PIDs analyzed`);
    }

    // Add visualizations from enhanced analysis
    if (includeVisualization && plotResults.length > 0) {
      response.visualizations = plotResults.map((plot, index) => ({
        imageId: plot.imageId || `plot_${sessionId}_${index}_${Date.now()}`,
        url: plot.url || plot.path || `/api/images/plots/${plot.imageId || `plot_${sessionId}_${index}`}.png`,
        thumbnailUrl: plot.thumbnailUrl || plot.url || plot.path,
        data: plot.data || plot.base64, // Base64 encoded image data
        path: plot.path || plot.filename,
        type: plot.type || 'chart',
        description: plot.description || 'OBD2 diagnostic visualization'
      }));

      console.log(`✅ Added ${response.visualizations.length} visualization(s) to response`);
    } else if (includeVisualization) {
      console.warn('⚠️ No visualizations generated despite includeVisualization=true');
    }

    // Add context information
    if (vehicleContext || customerContext) {
      response.context = {
        vehicle: enhancedVehicleContext,
        customer: customerContext
      };
    }

    // Persist analysis results to database (both session and Analysis collection)
    let analysisId = null;
    const analysisStartTime = Date.now();

    try {
      // Generate unique analysis ID
      analysisId = Analysis.generateAnalysisId();

      // Create Analysis document with comprehensive data
      const analysisDoc = new Analysis({
        analysisId: analysisId,
        sessionId: sessionId,
        analysisType: analysisType,
        timestamp: new Date(),
        status: 'completed',
        duration: (Date.now() - analysisStartTime) / 1000,
        result: fullResponse,
        structuredData: {
          summary: enhancedAnalysis.comprehensiveReport?.summary || null,
          anomalies: enhancedAnalysis.anomalies || null,
          healthScores: enhancedAnalysis.healthScores || null,
          recommendations: enhancedAnalysis.comprehensiveReport?.recommendations || [],
          statistics: analysisResult.analysis?.summary || null
        },
        plots: plotResults.map(plot => ({
          filename: plot.filename || plot.path || `plot_${Date.now()}.png`,
          base64: plot.data || plot.base64,
          mimeType: plot.mimeType || 'image/png',
          description: plot.description || 'OBD2 diagnostic visualization'
        })),
        context: {
          dataPointCount: actualDataPointCount,
          timeRange: {
            start: session.startTime,
            end: session.endTime
          },
          dtcCodes: dtcCodes,
          vehicleInfo: enhancedVehicleContext,
          customerContext: customerContext
        },
        modelInfo: {
          model: 'o3-mini',
          reasoningEffort: 'medium'
        },
        tags: [analysisType, ...(dtcCodes.length > 0 ? ['has_dtc'] : []), ...(enhancedAnalysis.anomalies?.critical?.length > 0 ? ['critical_issues'] : [])]
      });

      await analysisDoc.save();
      console.log(`✅ Analysis saved with ID: ${analysisId}`);

      // Also update DiagnosticSession for backwards compatibility
      await DiagnosticSession.findByIdAndUpdate(sessionId, {
        $set: {
          analysisResults: response.analysis,
          analysisVisualizations: response.visualizations || [],
          analysisPlotData: response.plotData || null,
          analysisTimestamp: new Date(),
          analysisType: analysisType,
          analysisMetadata: {
            dataPointsAnalyzed: session.dataPointCount,
            visualizationsGenerated: (response.visualizations || []).length,
            hasPlotData: !!response.plotData,
            analysisVersion: '1.0',
            analysisId: analysisId  // Link to Analysis document
          }
        }
      });
      console.log(`✅ Analysis results persisted for session ${sessionId} (${(response.visualizations || []).length} visualizations, analysisId: ${analysisId})`);
    } catch (persistError) {
      console.error('⚠️ Failed to persist analysis results:', persistError);
      // Don't fail the request, just log the error
    }

    // Add analysisId to response
    response.analysisId = analysisId;
    response.analysisUrl = analysisId ? `/api/obd2/analysis/${analysisId}` : null;

    res.json(response);

  } catch (error) {
    console.error('❌ Enhanced session analysis failed:', error);
    res.status(500).json({
      success: false,
      error: 'Enhanced session analysis failed',
      message: error.message,
      sessionId: req.params.sessionId
    });
  }
});

// Get previously generated analysis results (from session - backwards compatibility)
router.get('/sessions/:sessionId/analysis', async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Validate sessionId format
    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid session ID format',
        sessionId
      });
    }

    // Get session with analysis results
    const session = await DiagnosticSession.findById(sessionId).lean();

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
        sessionId
      });
    }

    // Check if analysis exists
    if (!session.analysisResults) {
      return res.status(404).json({
        success: false,
        error: 'No analysis results available for this session',
        message: 'Run POST /api/obd2/sessions/:sessionId/analyze first',
        sessionId
      });
    }

    // Return stored analysis
    res.json({
      success: true,
      sessionId,
      analysisId: session.analysisMetadata?.analysisId || null,
      analysisType: session.analysisType,
      analysisTimestamp: session.analysisTimestamp,
      analysis: session.analysisResults,
      visualizations: session.analysisVisualizations || [],  // Include cached visualizations
      plotData: session.analysisPlotData || null,  // Include raw plot data
      metadata: session.analysisMetadata
    });

  } catch (error) {
    console.error('❌ Failed to get analysis results:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get analysis results',
      message: error.message
    });
  }
});

// =====================================================
// NEW: Analysis-centric routes (retrieve by analysis ID)
// =====================================================

// Get analysis by analysis ID (recommended way)
router.get('/analysis/:analysisId', async (req, res) => {
  try {
    const { analysisId } = req.params;

    // Find analysis by analysisId
    const analysis = await Analysis.findOne({ analysisId, isDeleted: false }).lean();

    if (!analysis) {
      return res.status(404).json({
        success: false,
        error: 'Analysis not found',
        message: 'No analysis found with the provided ID',
        analysisId
      });
    }

    // Format response for frontend
    const response = {
      success: true,
      analysisId: analysis.analysisId,
      sessionId: analysis.sessionId.toString(),
      analysisType: analysis.analysisType,
      status: analysis.status,
      timestamp: analysis.timestamp,
      duration: analysis.duration,

      // Analysis results
      result: analysis.result,
      structuredData: analysis.structuredData,

      // Visualizations with base64 data
      plots: analysis.plots.map(plot => ({
        filename: plot.filename,
        data: plot.base64,
        base64: plot.base64,
        mimeType: plot.mimeType,
        description: plot.description,
        generatedAt: plot.generatedAt
      })),

      // Context information
      context: analysis.context,

      // Model info
      modelInfo: analysis.modelInfo,

      // Tags and metadata
      tags: analysis.tags,
      notes: analysis.notes,

      // URLs for convenience
      analysisUrl: `/api/obd2/analysis/${analysis.analysisId}`,
      sessionUrl: `/api/obd2/sessions/${analysis.sessionId}`,

      // Timestamps
      createdAt: analysis.createdAt,
      updatedAt: analysis.updatedAt
    };

    console.log(`✅ Retrieved analysis ${analysisId} with ${analysis.plots.length} plot(s)`);
    res.json(response);

  } catch (error) {
    console.error('❌ Failed to retrieve analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve analysis',
      message: error.message,
      analysisId: req.params.analysisId
    });
  }
});

// Get all analyses for a session
router.get('/sessions/:sessionId/analyses', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { limit = 10, offset = 0, includeDeleted = false } = req.query;

    // Validate sessionId format
    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid session ID format',
        sessionId
      });
    }

    // Build query
    const query = {
      sessionId: new mongoose.Types.ObjectId(sessionId)
    };

    if (!includeDeleted) {
      query.isDeleted = false;
    }

    // Get analyses
    const analyses = await Analysis.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .select('-plots.base64')  // Exclude base64 data for list view (too large)
      .lean();

    const total = await Analysis.countDocuments(query);

    // Format response
    const formattedAnalyses = analyses.map(analysis => ({
      analysisId: analysis.analysisId,
      analysisType: analysis.analysisType,
      status: analysis.status,
      timestamp: analysis.timestamp,
      duration: analysis.duration,
      plotCount: analysis.plots?.length || 0,
      hasRecommendations: (analysis.structuredData?.recommendations?.length || 0) > 0,
      healthScore: analysis.structuredData?.healthScores?.overall || null,
      tags: analysis.tags,
      analysisUrl: `/api/obd2/analysis/${analysis.analysisId}`,
      createdAt: analysis.createdAt
    }));

    res.json({
      success: true,
      sessionId,
      analyses: formattedAnalyses,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    console.error('❌ Failed to retrieve analyses:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve analyses',
      message: error.message
    });
  }
});

// Get only plots from an analysis (useful for gallery/preview)
router.get('/analysis/:analysisId/plots', async (req, res) => {
  try {
    const { analysisId } = req.params;

    const analysis = await Analysis.findOne({ analysisId, isDeleted: false })
      .select('analysisId plots')
      .lean();

    if (!analysis) {
      return res.status(404).json({
        success: false,
        error: 'Analysis not found',
        analysisId
      });
    }

    res.json({
      success: true,
      analysisId: analysis.analysisId,
      plots: analysis.plots.map(plot => ({
        filename: plot.filename,
        data: plot.base64,
        mimeType: plot.mimeType,
        description: plot.description,
        generatedAt: plot.generatedAt
      })),
      plotCount: analysis.plots.length
    });

  } catch (error) {
    console.error('❌ Failed to retrieve plots:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve plots',
      message: error.message
    });
  }
});

// Delete analysis (soft delete)
router.delete('/analysis/:analysisId', async (req, res) => {
  try {
    const { analysisId } = req.params;

    const analysis = await Analysis.findOneAndUpdate(
      { analysisId, isDeleted: false },
      { $set: { isDeleted: true, updatedAt: new Date() } },
      { new: true }
    );

    if (!analysis) {
      return res.status(404).json({
        success: false,
        error: 'Analysis not found',
        analysisId
      });
    }

    res.json({
      success: true,
      message: 'Analysis deleted successfully',
      analysisId
    });

  } catch (error) {
    console.error('❌ Failed to delete analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete analysis',
      message: error.message
    });
  }
});

// Streaming analysis endpoint with real-time visual generation
router.post('/sessions/:sessionId/analyze/stream', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const {
      analysisType = 'comprehensive',
      includeVisualization = true,
      vehicleContext = {},
      customerContext = {},
      timeRange
    } = req.body;

    console.log(`🔍 Streaming analysis for OBD2 session: ${sessionId}, type: ${analysisType}`);

    // Get session info for context
    const session = await DiagnosticSession.findById(sessionId).lean();
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
        sessionId
      });
    }

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Prepare enhanced vehicle context
    const enhancedVehicleContext = {
      ...vehicleContext,
      sessionId: sessionId,
      sessionName: session.sessionName,
      startTime: session.startTime,
      endTime: session.endTime,
      duration: session.duration,
      dataPointCount: session.dataPointCount,
      vehicleInfo: session.vehicleInfo || {}
    };

    // Create analysis question
    const analysisQuestions = {
      'summary': `Provide a comprehensive summary analysis of OBD2 session ${sessionId}. Include key metrics, performance indicators, and any notable findings.`,
      'comprehensive': `Perform a comprehensive analysis of OBD2 session ${sessionId}. Include engine health, fuel system analysis, emission system status, performance metrics, and generate relevant visualizations.`,
      'performance': `Analyze the performance metrics for OBD2 session ${sessionId}. Focus on engine performance, acceleration patterns, and efficiency metrics with visualizations.`,
      'diagnostics': `Run diagnostic analysis on OBD2 session ${sessionId}. Check for error codes, system health, and provide diagnostic recommendations with supporting charts.`,
      'fuel_efficiency': `Analyze fuel efficiency for OBD2 session ${sessionId}. Calculate fuel economy metrics and create visualizations showing consumption patterns.`,
      'maintenance': `Provide maintenance analysis for OBD2 session ${sessionId}. Identify maintenance needs, component health, and create maintenance schedules with supporting data.`,
      'driving_behavior': `Analyze driving behavior patterns from OBD2 session ${sessionId}. Include acceleration, braking, speed patterns, and efficiency metrics with visualizations.`
    };

    const question = analysisQuestions[analysisType] || analysisQuestions['comprehensive'];

    // Send session start info
    res.write(`data: ${JSON.stringify({
      type: 'analysis_started',
      sessionId,
      analysisType,
      question,
      timestamp: new Date().toISOString()
    })}\n\n`);

    // Use direct OBD2 analysis for streaming response
    const analysisResult = await analysisService.executeTool('analyze_obd2_session', {
      sessionId,
      analysisType,
      timeRange
    });

    // Stream the analysis results
    let fullResponse = '';

    if (analysisResult.success) {
      // Stream session info first
      res.write(`data: ${JSON.stringify({
        type: 'content',
        content: `**Session Analysis Started**\n\n`,
        sessionId
      })}\n\n`);

      if (analysisResult.analysis?.sessionInfo) {
        const sessionInfo = analysisResult.analysis.sessionInfo;
        const sessionText = `**Session Information:**\n- Duration: ${Math.floor(sessionInfo.duration / 60)} minutes\n- Data Points: ${sessionInfo.dataPoints}\n- Status: ${sessionInfo.status}\n\n`;

        res.write(`data: ${JSON.stringify({
          type: 'content',
          content: sessionText,
          sessionId
        })}\n\n`);

        fullResponse += sessionText;
      }

      // Stream analysis sections
      const analysis = analysisResult.analysis;
      const sections = [
        { key: 'summary', title: 'Summary' },
        { key: 'detailed', title: 'Detailed Analysis' },
        { key: 'anomalies', title: 'Anomalies Detected' },
        { key: 'performance', title: 'Performance Metrics' },
        { key: 'fuelEconomy', title: 'Fuel Economy' },
        { key: 'emissions', title: 'Emissions Analysis' }
      ];

      for (const section of sections) {
        if (analysis[section.key]) {
          const sectionText = `**${section.title}:**\n${JSON.stringify(analysis[section.key], null, 2)}\n\n`;

          res.write(`data: ${JSON.stringify({
            type: 'content',
            content: sectionText,
            sessionId
          })}\n\n`);

          fullResponse += sectionText;
        }
      }

      // Stream recommendations
      if (analysisResult.recommendations && analysisResult.recommendations.length > 0) {
        let recommendationsText = `**Recommendations:**\n`;
        analysisResult.recommendations.forEach((rec, index) => {
          recommendationsText += `${index + 1}. ${rec}\n`;
        });
        recommendationsText += `\n`;

        res.write(`data: ${JSON.stringify({
          type: 'content',
          content: recommendationsText,
          sessionId
        })}\n\n`);

        fullResponse += recommendationsText;
      }

      // Send placeholder visualization if requested
      if (includeVisualization) {
        const placeholderPlot = {
          imageId: `plot_${sessionId}_${Date.now()}`,
          url: `/api/images/plots/placeholder_${sessionId}.png`,
          data: null,
          type: 'chart'
        };

        res.write(`data: ${JSON.stringify({
          type: 'visualization',
          visualization: placeholderPlot,
          sessionId
        })}\n\n`);
      }
    } else {
      const errorText = `Analysis failed: ${analysisResult.message || 'Unknown error'}`;
      res.write(`data: ${JSON.stringify({
        type: 'content',
        content: errorText,
        sessionId
      })}\n\n`);
      fullResponse = errorText;
    }

    // Send completion event with context and full response
    res.write(`data: ${JSON.stringify({
      type: 'analysis_completed',
      sessionId,
      analysisType,
      timestamp: new Date().toISOString(),
      ...(Object.keys(enhancedVehicleContext).length > 0 || Object.keys(customerContext).length > 0 ? {
        context: {
          vehicle: enhancedVehicleContext,
          customer: customerContext
        }
      } : {}),
      fullResponse: fullResponse || null
    })}\n\n`);

    // End the stream
    res.write(`data: ${JSON.stringify({
      type: 'stream_end',
      sessionId
    })}\n\n`);

    // Cleanup on client disconnect
    req.on('close', () => {
      console.log(`Streaming analysis ended for session ${sessionId}`);
    });

  } catch (error) {
    console.error('❌ Streaming analysis failed:', error);

    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Streaming analysis failed',
        message: error.message,
        sessionId: req.params.sessionId
      });
    } else {
      res.write(`data: ${JSON.stringify({
        type: 'error',
        error: error.message,
        sessionId: req.params.sessionId
      })}\n\n`);
    }
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

// Get discovered PIDs for a session
router.get('/sessions/:sessionId/pids', async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid session ID format',
        sessionId
      });
    }

    // Get data points for PID discovery
    const dataPoints = await OBD2DataPoint.find({
      sessionId: new mongoose.Types.ObjectId(sessionId)
    })
      .sort({ timestamp: 1 })
      .limit(1000) // Sample for discovery
      .lean();

    if (dataPoints.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No data points found for this session',
        sessionId
      });
    }

    // Use analysis service to discover PIDs
    const availablePIDs = analysisService.discoverAvailablePIDs(dataPoints);

    res.json({
      success: true,
      sessionId,
      pidDiscovery: {
        totalPIDs: Object.keys(availablePIDs).length,
        availablePIDs: Object.keys(availablePIDs),
        pidDetails: availablePIDs,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Failed to get discovered PIDs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get discovered PIDs',
      message: error.message
    });
  }
});

// Get PID-specific analysis for a session
router.get('/sessions/:sessionId/pids/:pidName/analysis', async (req, res) => {
  try {
    const { sessionId, pidName } = req.params;

    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid session ID format',
        sessionId
      });
    }

    // Get data points
    const dataPoints = await OBD2DataPoint.find({
      sessionId: new mongoose.Types.ObjectId(sessionId)
    })
      .sort({ timestamp: 1 })
      .lean();

    if (dataPoints.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No data points found for this session',
        sessionId
      });
    }

    // Discover PIDs and get analysis
    const availablePIDs = analysisService.discoverAvailablePIDs(dataPoints);
    
    // Case-insensitive PID name matching
    const pidNameLower = pidName.toLowerCase();
    let pidInfo = null;
    let actualPIDName = pidName; // Use requested name by default, will update if case-insensitive match found
    
    // First try exact match
    if (availablePIDs[pidName]) {
      pidInfo = availablePIDs[pidName];
      actualPIDName = pidName;
    } else {
      // Try case-insensitive match
      for (const availablePID of Object.keys(availablePIDs)) {
        if (availablePID.toLowerCase() === pidNameLower) {
          pidInfo = availablePIDs[availablePID];
          actualPIDName = availablePID; // Use the actual field name from database
          break;
        }
      }
    }
    
    if (!pidInfo) {
      return res.status(404).json({
        success: false,
        error: `PID '${pidName}' not found in session data`,
        sessionId,
        requestedPID: pidName,
        availablePIDs: Object.keys(availablePIDs),
        suggestion: `Available PIDs include: ${Object.keys(availablePIDs).slice(0, 10).join(', ')}${Object.keys(availablePIDs).length > 10 ? '...' : ''}`
      });
    }

    const metadata = pidInfo.metadata;

    // Get values for this PID using the actual field name from database
    const values = dataPoints
      .map(dp => {
        const val = dp[actualPIDName];
        return (typeof val === 'number' && !isNaN(val) && isFinite(val)) ? val : null;
      })
      .filter(v => v !== null);

    if (values.length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient data for analysis',
        sessionId,
        pidName,
        sampleCount: values.length
      });
    }

    // Perform comprehensive PID analysis
    const pidAnalysis = {
      pidName: actualPIDName, // Use actual PID name from database
      category: metadata.category,
      unit: metadata.unit,
      diagnosticSignificance: metadata.diagnosticSignificance,
      dataQuality: pidInfo.dataQuality,
      statistics: pidInfo.statistics,
      thresholdAnalysis: analysisService.analyzePIDThresholds(values, metadata),
      trendAnalysis: analysisService.analyzePIDTrend(values, dataPoints),
      stabilityAnalysis: analysisService.analyzePIDStability(values),
      correlationAnalysis: analysisService.analyzePIDCorrelations(actualPIDName, values, dataPoints, availablePIDs, metadata)
    };

    res.json({
      success: true,
      sessionId,
      pidName: actualPIDName, // Return the actual PID name from database (may differ from requested if case-insensitive match)
      requestedPID: pidName, // Include requested PID name for reference
      analysis: pidAnalysis,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Failed to get PID analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get PID analysis',
      message: error.message
    });
  }
});

// Get PID correlations for a session
router.get('/sessions/:sessionId/correlations', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { pid1, pid2 } = req.query;

    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid session ID format',
        sessionId
      });
    }

    // Get data points
    const dataPoints = await OBD2DataPoint.find({
      sessionId: new mongoose.Types.ObjectId(sessionId)
    })
      .sort({ timestamp: 1 })
      .limit(1000)
      .lean();

    if (dataPoints.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No data points found for this session',
        sessionId
      });
    }

    // Discover PIDs
    const availablePIDs = analysisService.discoverAvailablePIDs(dataPoints);

    if (pid1 && pid2) {
      // Get correlation between two specific PIDs
      const pid1Info = availablePIDs[pid1];
      const pid2Info = availablePIDs[pid2];

      if (!pid1Info || !pid2Info) {
        return res.status(404).json({
          success: false,
          error: 'One or both PIDs not found',
          pid1: pid1Info ? 'found' : 'not found',
          pid2: pid2Info ? 'found' : 'not found',
          availablePIDs: Object.keys(availablePIDs)
        });
      }

      const values1 = dataPoints.map(dp => dp[pid1]).filter(v => v !== null && typeof v === 'number' && isFinite(v));
      const values2 = dataPoints.map(dp => dp[pid2]).filter(v => v !== null && typeof v === 'number' && isFinite(v));

      if (values1.length < 10 || values2.length < 10) {
        return res.status(400).json({
          success: false,
          error: 'Insufficient data for correlation analysis',
          pid1Samples: values1.length,
          pid2Samples: values2.length
        });
      }

      const correlation = analysisService.calculateCorrelation(values1, values2);
      const metadata1 = pid1Info.metadata;

      res.json({
        success: true,
        sessionId,
        correlation: {
          pid1: pid1,
          pid2: pid2,
          correlation: correlation,
          strength: Math.abs(correlation) > 0.7 ? 'strong' : 
                   Math.abs(correlation) > 0.5 ? 'moderate' : 'weak',
          direction: correlation > 0 ? 'positive' : 'negative',
          diagnosticNote: analysisService.getCorrelationDiagnosticNote(pid1, pid2, correlation, metadata1)
        },
        timestamp: new Date().toISOString()
      });
    } else {
      // Get all correlations for significant PIDs
      const correlations = {};
      const significantPIDs = Object.keys(availablePIDs).filter(pid => 
        availablePIDs[pid].metadata?.diagnosticSignificance === 'critical' || 
        availablePIDs[pid].metadata?.diagnosticSignificance === 'high'
      );

      for (const pidName of significantPIDs) {
        const pidInfo = availablePIDs[pidName];
        const metadata = pidInfo.metadata;
        const values = dataPoints
          .map(dp => dp[pidName])
          .filter(v => v !== null && typeof v === 'number' && isFinite(v));

        if (values.length >= 10 && metadata.relatedPIDs) {
          const pidCorrelations = analysisService.analyzePIDCorrelations(
            pidName, 
            values, 
            dataPoints, 
            availablePIDs, 
            metadata
          );
          
          if (Object.keys(pidCorrelations).length > 0) {
            correlations[pidName] = pidCorrelations;
          }
        }
      }

      res.json({
        success: true,
        sessionId,
        correlations: correlations,
        totalCorrelations: Object.keys(correlations).length,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('❌ Failed to get PID correlations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get PID correlations',
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

// =====================================================
// Analytics Pack & Code Interpreter Endpoints
// =====================================================

/**
 * GET /sessions/:sessionId/analytics-pack/overview
 * Get session overview with KPIs and pack metadata
 */
router.get('/sessions/:sessionId/analytics-pack/overview', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const overview = await obd2AnalyticsPackService.getSessionOverview(sessionId);
    res.json({ success: true, ...overview });
  } catch (error) {
    console.error('Failed to get session overview:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /sessions/:sessionId/analytics-pack/query
 * Query timeseries data from pack
 */
router.post('/sessions/:sessionId/analytics-pack/query', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { signals, fromMs, toMs } = req.body;
    
    if (!signals || !Array.isArray(signals)) {
      return res.status(400).json({ success: false, error: 'signals array required' });
    }
    
    const result = await obd2AnalyticsPackService.queryTimeseries(
      sessionId,
      signals,
      fromMs || 0,
      toMs || Date.now()
    );
    
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Failed to query timeseries:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /sessions/:sessionId/analytics-pack/build
 * Build analytics pack for a session
 */
router.post('/sessions/:sessionId/analytics-pack/build', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const pack = await obd2AnalyticsPackService.buildPack(sessionId);
    res.json({ success: true, ...pack });
  } catch (error) {
    console.error('Failed to build pack:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /sessions/:sessionId/analytics-pack/upload
 * Upload pack to OpenAI Files for Code Interpreter
 */
router.post('/sessions/:sessionId/analytics-pack/upload', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const uploadResult = await obd2AnalyticsPackService.uploadPackToOpenAI(sessionId);
    res.json({ success: true, ...uploadResult });
  } catch (error) {
    console.error('Failed to upload pack:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /sessions/:sessionId/analytics-pack/code-interpreter
 * Run Code Interpreter analysis on pack
 */
router.post('/sessions/:sessionId/analytics-pack/code-interpreter', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { task, model = 'gpt-4o' } = req.body;
    
    if (!task) {
      return res.status(400).json({ success: false, error: 'task required' });
    }
    
    // Upload pack first
    const { parquetFileId, summaryFileId } = await obd2AnalyticsPackService.uploadPackToOpenAI(sessionId);
    
    // Create OpenAI client
    /* global process */
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    // Run Code Interpreter
    const instructions = `You are analyzing OBD2 vehicle diagnostic data. 
Load the attached files:
- timeseries.parquet: Contains time-series data with columns for various vehicle parameters (RPM, speed, engineTemp, etc.)
- summary.json: Contains session metadata and KPIs

Task: ${task}

Instructions:
1. Load timeseries.parquet using pandas or polars
2. Read summary.json for context
3. Perform the requested analysis
4. Generate visualizations if requested
5. Provide a concise markdown summary with key findings
6. Include a JSON block with key metrics/flags

Use appropriate libraries: pandas, polars, matplotlib, seaborn, numpy, scipy.`;

    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: instructions
        },
        {
          role: 'user',
          content: task,
          attachments: [
            { file_id: parquetFileId, tools: [{ type: 'code_interpreter' }] },
            { file_id: summaryFileId, tools: [{ type: 'code_interpreter' }] }
          ]
        }
      ],
      tools: [{ type: 'code_interpreter' }]
    });

    res.json({
      success: true,
      sessionId,
      result: response.choices[0].message,
      fileIds: { parquetFileId, summaryFileId }
    });
  } catch (error) {
    console.error('Failed to run Code Interpreter:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// SECURE CODE INTERPRETER ROUTES (NEW - PARALLEL TO EXISTING SYSTEM)
// ============================================================================

// OpenAI interface for secure analysis (initialized earlier in file with models)
// const secureOpenAIInterface is already defined above

// Interval analysis service (initialized earlier in file with models)
// intervalAnalysisService is initialized via initializeIntervalAnalysisService()

/**
 * Helper function to extract plots from agent's preserved plot storage
 * NOTE: Plots are now stored in agent.generatedPlots to prevent context overflow
 */
function extractPlotsFromAgent(agent) {
  const plots = [];

  // Use the new generatedPlots array that preserves plots after truncation
  const sourcePlots = agent.generatedPlots || [];

  if (sourcePlots.length > 0) {
    // Add unique IDs and ensure required fields for each plot
    const enhancedPlots = sourcePlots.map(plot => {
      // Generate unique ID if not present
      const plotId = plot.id || crypto.randomUUID();

      // Ensure both 'base64' and 'data' fields are present for compatibility
      const imageData = plot.base64 || plot.data;

      return {
        id: plotId,
        filename: plot.filename,
        base64: imageData,  // Original field name
        data: imageData,     // Alternative field name for frontend compatibility
        mimeType: plot.mimeType || 'image/png',
        path: plot.path,     // Optional: container path for debugging
        timestamp: new Date().toISOString()
      };
    });

    plots.push(...enhancedPlots);
  }

  return plots;
}

/**
 * Background function to automatically analyze a session after it ends
 * This runs asynchronously and stores results in the session document
 */
async function runAutoAnalysis(sessionId) {
  const startTime = Date.now();

  try {
    console.log(`🤖 [AUTO-ANALYSIS] Starting automatic analysis for session ${sessionId}`);

    // Update status to processing
    await DiagnosticSession.findByIdAndUpdate(sessionId, {
      'autoAnalysis.status': 'processing',
      'autoAnalysis.startedAt': new Date()
    });

    // Step 1: Load data into Docker container
    console.log(`🤖 [AUTO-ANALYSIS] Loading OBD2 data...`);
    const dataAccessTool = new OBD2DataAccessTool(OBD2DataPoint, DiagnosticSession);
    const dataContextRaw = await dataAccessTool.run({ sessionId });

    // Check for errors
    const dataResult = JSON.parse(dataContextRaw);
    if (!dataResult.success) {
      throw new Error(dataResult.error || 'Failed to load OBD2 data');
    }

    // Step 2: Run comprehensive analysis with o3-mini
    console.log(`🤖 [AUTO-ANALYSIS] Running AI analysis...`);
    const analysisAgent = new OBD2AnalysisAgent(secureOpenAIInterface, 'medium');
    analysisAgent.addContext(dataContextRaw);

    const question = `Analyze this OBD2 session data and look for any potential signs of trouble or anomalies.

CRITICAL FIRST STEP - DATA ANALYSIS:
Before creating visualizations, you MUST analyze the actual data values and check for violations:

1. Load the CSV and calculate statistics for ALL critical parameters:
   - Fuel trims (Short/Long Term B1 & B2): Check if ANY values exceed ±10% (normal range)
   - O2 sensor voltages: Check oscillation patterns and if values stay within 0.1-0.9V
   - Engine temperature: Check if exceeds 220°F or stays below 180°F
   - Battery voltage: Check if outside 12.0-14.5V range
   - MAF, MAP, RPM: Check for anomalies or extreme values

2. For EACH parameter that violates normal ranges, you MUST report:
   - Parameter name and what range it violated
   - Specific values that exceeded limits (min, max, average)
   - Percentage of time spent out of range
   - Timestamps or time periods when violations occurred

3. Explicitly state if fuel trims exceed ±10% - this is CRITICAL for diagnosing lean/rich conditions

After analyzing the data, create MULTIPLE comprehensive visualizations (3-5 separate plot files):

VISUALIZATION 1: "Engine Performance Dashboard" (6-panel layout)
- RPM over time with normal range indicators
- Engine temperature with safe/warning/critical zones (180-220°F normal)
- Throttle position vs engine load correlation
- Speed profile over time
- Engine efficiency metrics
- Power output estimation

VISUALIZATION 2: "Fuel System Analysis" (4-panel layout)
- Short-term fuel trim (Bank 1 & 2) with ±10% normal range CLEARLY MARKED
- Long-term fuel trim trends with ±10% normal range CLEARLY MARKED
- Fuel pressure and rate over time
- Air-fuel ratio analysis (using O2 sensors and MAF)
** If fuel trims exceed ±10%, highlight these areas on the plot **

VISUALIZATION 3: "Emissions & O2 Sensors" (4-panel layout)
- O2 sensor voltage patterns (should oscillate 0.1-0.9V)
- Catalyst efficiency indicators
- Exhaust gas temperature trends (if available)
- Emissions system health score

VISUALIZATION 4: "System Health Heatmap" (multi-panel)
- Parameter correlation heatmap
- Health score gauges for each system (engine, fuel, emissions, cooling, electrical)
- Timeline of parameter deviations from normal
- Anomaly detection visualization

VISUALIZATION 5: "Diagnostic Summary & Alerts" (dashboard style)
- Key metrics summary with gauges
- Alert timeline (any out-of-range parameters)
- Predictive maintenance indicators
- Overall vehicle health score (0-100)

IMPORTANT: Generate each visualization as a SEPARATE PNG file with descriptive filenames.
Use matplotlib/seaborn with professional styling.
Each plot should be comprehensive and information-dense.

Then provide a detailed diagnostic summary including:
- Overall vehicle health status (0-100 score)
- System-by-system health assessment (engine, fuel, emissions, cooling, electrical)
- **CRITICAL FINDINGS SECTION**: List ALL parameters that exceeded normal ranges with specific values
  * MUST include fuel trim violations if present (e.g., "Fuel Trim Short Term B1 exceeded +10% limit, reaching +15.3% at timestamp X")
  * Be explicit about what the visualization shows vs. what is healthy
- Any concerning patterns or anomalies detected (be specific with values and timestamps)
- Critical issues that need immediate attention
- Maintenance recommendations based on the actual violations found
- Performance optimization suggestions

ALIGNMENT REQUIREMENT: Your text analysis MUST mention every issue that is visible in the visualizations.
If the visualization shows fuel trims exceeding ±10%, your text MUST explicitly state this with specific values.

Focus on actionable insights with specific data points, values, and timestamps.`;

    const analysisResult = await analysisAgent.task(question);

    // Extract plots
    const plots = extractPlotsFromAgent(analysisAgent);
    console.log(`🤖 [AUTO-ANALYSIS] Generated ${plots.length} visualization(s)`);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // Store results in session
    await DiagnosticSession.findByIdAndUpdate(sessionId, {
      'autoAnalysis.status': 'completed',
      'autoAnalysis.completedAt': new Date(),
      'autoAnalysis.result': analysisResult,
      'autoAnalysis.plots': plots,
      'autoAnalysis.duration': parseFloat(duration),
      'aiSummary': analysisResult // Also store in main aiSummary field for backwards compatibility
    });

    console.log(`🤖 [AUTO-ANALYSIS] ✅ Analysis completed in ${duration}s`);

  } catch (error) {
    console.error(`🤖 [AUTO-ANALYSIS] ❌ Error:`, error);

    // Store error in session
    await DiagnosticSession.findByIdAndUpdate(sessionId, {
      'autoAnalysis.status': 'failed',
      'autoAnalysis.completedAt': new Date(),
      'autoAnalysis.error': error.message,
      'autoAnalysis.duration': ((Date.now() - startTime) / 1000).toFixed(2)
    });
  }
}

/**
 * NEW ROUTE: Secure analysis using Docker-based code interpreter
 * Runs alongside existing /analyze endpoint
 */
router.post('/sessions/:sessionId/analyze/secure', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { question, reasoningEffort = 'medium' } = req.body;

    if (!question) {
      return res.status(400).json({
        success: false,
        error: 'question is required'
      });
    }

    console.log(`🔒 [SECURE] OBD2 Analysis for session ${sessionId}`);
    console.log(`🔒 [SECURE] Question: ${question}`);
    console.log(`🔒 [SECURE] Reasoning effort: ${reasoningEffort}`);

    const startTime = Date.now();

    // Step 1: Directly load data into Docker container
    console.log('🔒 [SECURE] Step 1/2: Retrieving OBD2 data from MongoDB...');
    const dataAccessTool = new OBD2DataAccessTool(OBD2DataPoint, DiagnosticSession);
    const dataContextRaw = await dataAccessTool.run({ sessionId });

    // Parse the result to check for errors
    let dataContext;
    try {
      const dataResult = JSON.parse(dataContextRaw);
      if (!dataResult.success) {
        throw new Error(dataResult.error || 'Failed to load OBD2 data');
      }
      dataContext = dataContextRaw;
      console.log('🔒 [SECURE] ✅ Data retrieved and prepared');
    } catch (parseError) {
      // If it's not JSON, treat it as a string message (backward compatibility)
      if (dataContextRaw.startsWith('Error:')) {
        throw new Error(dataContextRaw);
      }
      dataContext = dataContextRaw;
      console.log('🔒 [SECURE] ✅ Data retrieved and prepared');
    }

    // Step 2: Analysis Agent generates code and performs analysis
    console.log('🔒 [SECURE] Step 2/2: Analyzing data with o3-mini...');
    const analysisAgent = new OBD2AnalysisAgent(secureOpenAIInterface, reasoningEffort);

    // Add data context to analysis agent
    analysisAgent.addContext(dataContext);

    // Perform analysis
    const analysisResult = await analysisAgent.task(question);

    // Extract plots from agent's message history
    const plots = extractPlotsFromAgent(analysisAgent);
    console.log(`📊 Extracted ${plots.length} plot(s) from analysis`);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`🔒 [SECURE] ✅ Analysis complete in ${duration}s`);

    res.json({
      success: true,
      sessionId,
      question,
      analysis: analysisResult,
      plots: plots,
      method: 'secure_docker_execution',
      model: 'o3-mini',
      reasoningEffort,
      duration: `${duration}s`,
      system: 'new_secure_interpreter'
    });

  } catch (error) {
    console.error('🔒 [SECURE] ❌ Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      system: 'new_secure_interpreter'
    });
  }
});

/**
 * NEW ROUTE: Streaming version for real-time analysis updates
 * Runs alongside existing analysis endpoints
 */
router.post('/sessions/:sessionId/analyze/secure/stream', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { question, reasoningEffort = 'medium' } = req.body;

    if (!question) {
      return res.status(400).json({
        success: false,
        error: 'question is required'
      });
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    const sendEvent = (event, data) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    console.log(`🔒 [SECURE STREAM] Starting analysis for session ${sessionId}`);

    sendEvent('status', {
      message: 'Starting secure analysis...',
      step: '1/3',
      system: 'secure_interpreter'
    });

    // Step 1: Get data
    sendEvent('status', {
      message: 'Retrieving OBD2 data from MongoDB...',
      step: '1/3'
    });

    const dataAccessTool = new OBD2DataAccessTool(OBD2DataPoint, DiagnosticSession);
    const dataContextRaw = await dataAccessTool.run({ sessionId });

    // Parse the result to check for errors
    let dataContext;
    try {
      const dataResult = JSON.parse(dataContextRaw);
      if (!dataResult.success) {
        throw new Error(dataResult.error || 'Failed to load OBD2 data');
      }
      dataContext = dataContextRaw;
    } catch (parseError) {
      // If it's not JSON, treat it as a string message (backward compatibility)
      if (dataContextRaw.startsWith('Error:')) {
        throw new Error(dataContextRaw);
      }
      dataContext = dataContextRaw;
    }

    sendEvent('data_ready', {
      message: 'Data prepared and loaded into Docker container',
      step: '2/3'
    });

    // Step 2: Analyze
    sendEvent('status', {
      message: `Analyzing with o3-mini (${reasoningEffort} reasoning)...`,
      step: '3/3'
    });

    const analysisAgent = new OBD2AnalysisAgent(secureOpenAIInterface, reasoningEffort);
    analysisAgent.addContext(dataContext);

    const analysisResult = await analysisAgent.task(question);

    // Extract plots from agent's message history
    const plots = extractPlotsFromAgent(analysisAgent);
    console.log(`📊 Extracted ${plots.length} plot(s) from streaming analysis`);

    sendEvent('complete', {
      sessionId,
      question,
      analysis: analysisResult,
      plots: plots,
      model: 'o3-mini',
      reasoningEffort,
      system: 'secure_interpreter'
    });

    res.end();

  } catch (error) {
    console.error('🔒 [SECURE STREAM] ❌ Error:', error);
    res.write(`event: error\ndata: ${JSON.stringify({
      error: error.message,
      system: 'secure_interpreter'
    })}\n\n`);
    res.end();
  }
});

/**
 * NEW ROUTE: Get automatic analysis results
 * Returns the auto-analysis that was triggered when the session ended
 */
router.get('/sessions/:sessionId/auto-analysis', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await DiagnosticSession.findById(sessionId).lean();

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    // Return auto-analysis data if available
    if (!session.autoAnalysis || !session.autoAnalysis.status) {
      return res.json({
        success: true,
        status: 'not_started',
        message: 'Auto-analysis was not triggered for this session'
      });
    }

    const response = {
      success: true,
      status: session.autoAnalysis.status,
      sessionId: sessionId,
      sessionName: session.sessionName,
      dataPointCount: session.dataPointCount
    };

    // Add timing information if available
    if (session.autoAnalysis.startedAt) {
      response.startedAt = session.autoAnalysis.startedAt;
    }
    if (session.autoAnalysis.completedAt) {
      response.completedAt = session.autoAnalysis.completedAt;
    }
    if (session.autoAnalysis.duration) {
      response.duration = `${session.autoAnalysis.duration}s`;
    }

    // Add results if completed
    if (session.autoAnalysis.status === 'completed') {
      response.analysis = session.autoAnalysis.result;
      response.plots = session.autoAnalysis.plots || [];
      response.plotCount = (session.autoAnalysis.plots || []).length;
    }

    // Add error if failed
    if (session.autoAnalysis.status === 'failed') {
      response.error = session.autoAnalysis.error;
    }

    // Add progress message for pending/processing
    if (session.autoAnalysis.status === 'pending') {
      response.message = 'Auto-analysis is queued and will start shortly';
    } else if (session.autoAnalysis.status === 'processing') {
      response.message = 'Auto-analysis is currently running';
      // Calculate elapsed time if started
      if (session.autoAnalysis.startedAt) {
        const elapsed = Math.floor((Date.now() - new Date(session.autoAnalysis.startedAt).getTime()) / 1000);
        response.elapsedSeconds = elapsed;
        response.message = `Auto-analysis is running (${elapsed}s elapsed)`;
      }
    }

    res.json(response);

  } catch (error) {
    console.error('❌ Error fetching auto-analysis:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * NEW ROUTE: Manually trigger auto-analysis for a session
 * Useful if auto-analysis failed or wasn't triggered automatically
 */
router.post('/sessions/:sessionId/auto-analysis/trigger', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await DiagnosticSession.findById(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    // Check if session has data
    const dataPointCount = await OBD2DataPoint.countDocuments({
      sessionId: new mongoose.Types.ObjectId(sessionId)
    });

    if (dataPointCount === 0) {
      return res.status(400).json({
        success: false,
        error: 'Session has no data points to analyze'
      });
    }

    // Check if analysis is already running
    if (session.autoAnalysis && session.autoAnalysis.status === 'processing') {
      return res.status(409).json({
        success: false,
        error: 'Auto-analysis is already running for this session',
        status: 'processing'
      });
    }

    // Initialize auto-analysis status
    await DiagnosticSession.findByIdAndUpdate(sessionId, {
      'autoAnalysis.status': 'pending'
    });

    // Trigger analysis in background
    console.log(`🤖 Manually triggering auto-analysis for session ${sessionId}...`);
    runAutoAnalysis(sessionId).catch(err => {
      console.error(`🤖 Manual auto-analysis failed for session ${sessionId}:`, err);
    });

    res.json({
      success: true,
      message: 'Auto-analysis triggered successfully',
      sessionId: sessionId,
      status: 'pending'
    });

  } catch (error) {
    console.error('❌ Error triggering auto-analysis:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * NEW ROUTE: Health check for secure interpreter system
 */
router.get('/secure-interpreter/health', async (req, res) => {
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    // Check Docker container
    const { stdout } = await execAsync('docker ps --filter name=obd2_sandbox --format "{{.Status}}"');
    const containerRunning = stdout.includes('Up');

    // Check Python in container
    let pythonVersion = null;
    if (containerRunning) {
      try {
        const { stdout: pyVersion } = await execAsync('docker exec obd2_sandbox python --version');
        pythonVersion = pyVersion.trim();
      } catch (e) {
        pythonVersion = 'Error checking version';
      }
    }

    res.json({
      success: true,
      system: 'secure_code_interpreter',
      status: {
        dockerContainer: containerRunning ? 'running' : 'stopped',
        containerName: 'obd2_sandbox',
        pythonVersion,
        models: {
          dataAccess: 'gpt-4o',
          analysis: 'o3-mini'
        }
      },
      routes: {
        analysis: '/api/obd2/sessions/:sessionId/analyze/secure',
        streaming: '/api/obd2/sessions/:sessionId/analyze/secure/stream',
        health: '/api/obd2/secure-interpreter/health'
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      system: 'secure_code_interpreter'
    });
  }
});

// ============================================================================
// END SECURE CODE INTERPRETER ROUTES
// ============================================================================

export default router;
