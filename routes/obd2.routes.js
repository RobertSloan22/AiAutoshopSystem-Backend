// routes/obd2.routes.js - Add this new route file to your existing routes folder

import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import mongoose from 'mongoose';

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

// Create models
const DiagnosticSession = mongoose.model('DiagnosticSession', DiagnosticSessionSchema);
const OBD2DataPoint = mongoose.model('OBD2DataPoint', OBD2DataPointSchema);
const DTCEvent = mongoose.model('DTCEvent', DTCEventSchema);

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

// Initialize WebSocket for OBD2 streaming
export function initializeOBD2WebSocket(server) {
  const io = new SocketIOServer(server, {
    cors: {
      origin: function(origin, callback) {
        // Use the same CORS logic as your main server
        callback(null, true); // This will be handled by your main CORS middleware
      },
      methods: ["GET", "POST"]
    },
    path: '/obd2-socket.io' // Use a specific path to avoid conflicts
  });

  const obd2Namespace = io.of('/obd2');

  obd2Namespace.on('connection', (socket) => {
    console.log(`🔌 OBD2 Client connected: ${socket.id}`);
    
    let currentSessionId = null;

    // Handle session start
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

    // Handle real-time data streaming
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

        // Add to aggregation buffer
        dataAggregator.addDataPoint(currentSessionId, dataPoint);

        // Broadcast to other connected clients for this session
        socket.broadcast.emit(`session-data-${currentSessionId}`, dataPoint);

        // Send acknowledgment
        socket.emit('data-received', { timestamp: dataPoint.timestamp });

      } catch (error) {
        console.error('❌ Failed to process OBD2 data:', error);
        socket.emit('error', { message: 'Failed to process data point' });
      }
    });

    // Handle session end
    socket.on('end-session', async () => {
      if (!currentSessionId) {
        socket.emit('error', { message: 'No active session to end' });
        return;
      }

      try {
        // Force flush any remaining buffered data
        await dataAggregator.forceFlush(currentSessionId);

        // Update session end time and calculate duration
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

        console.log(`📊 OBD2 diagnostic session ended: ${currentSessionId} (${updatedSession.dataPointCount} data points)`);
        currentSessionId = null;

      } catch (error) {
        console.error('❌ Failed to end session:', error);
        socket.emit('error', { message: 'Failed to end diagnostic session' });
      }
    });

    socket.on('disconnect', async () => {
      console.log(`🔌 OBD2 Client disconnected: ${socket.id}`);
      
      // Auto-end session if client disconnects
      if (currentSessionId) {
        try {
          await dataAggregator.forceFlush(currentSessionId);
          await DiagnosticSession.findByIdAndUpdate(currentSessionId, {
            endTime: new Date(),
            duration: Math.floor((Date.now() - new Date().getTime()) / 1000),
            status: 'completed',
            updatedAt: new Date()
          });
          
          console.log(`📊 Auto-ended OBD2 session due to disconnect: ${currentSessionId}`);
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

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    // Check MongoDB connection
    const isConnected = mongoose.connection.readyState === 1;
    
    res.json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      database: isConnected ? 'connected' : 'disconnected',
      service: 'obd2'
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'unhealthy', 
      timestamp: new Date().toISOString(),
      database: 'error',
      error: error.message,
      service: 'obd2'
    });
  }
});

export default router;