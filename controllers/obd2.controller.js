import OBD2Data from '../models/obd2Data.model.js';
import Vehicle from '../models/vehicle.model.js';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import obd2WebSocketService from '../services/obd2WebSocketService.js';

// FastAgent integration URL
const FASTAGENT_URL = process.env.FASTAGENT_URL || 'http://localhost:8001';

// OBD2 parameter mappings
const OBD2_PARAMETERS = {
  '010C': { name: 'Engine RPM', unit: 'RPM', multiplier: 0.25 },
  '010D': { name: 'Vehicle Speed', unit: 'km/h', multiplier: 1 },
  '0105': { name: 'Engine Coolant Temperature', unit: '°C', offset: -40 },
  '010F': { name: 'Intake Air Temperature', unit: '°C', offset: -40 },
  '0111': { name: 'Throttle Position', unit: '%', multiplier: 0.39 },
  '010B': { name: 'Intake Manifold Pressure', unit: 'kPa', multiplier: 1 },
  '0104': { name: 'Engine Load', unit: '%', multiplier: 0.39 },
  '012F': { name: 'Fuel Level', unit: '%', multiplier: 0.39 },
  '0121': { name: 'Distance with MIL', unit: 'km', multiplier: 1 },
  '0131': { name: 'Time since engine start', unit: 'seconds', multiplier: 1 }
};

// Start OBD2 data collection session
export const startOBD2Session = async (req, res) => {
  try {
    const { vehicleId, adapterInfo } = req.body;
    const userId = req.user._id;

    // Validate vehicle exists and belongs to user
    const vehicle = await Vehicle.findOne({ _id: vehicleId, userId });
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found or access denied' });
    }

    const sessionId = uuidv4();
    
    // Create new OBD2 data session
    const obd2Session = new OBD2Data({
      vehicleId,
      vin: vehicle.vin,
      sessionId,
      userId,
      adapterInfo: adapterInfo || { type: 'bluetooth' },
      dataCollectionStart: new Date(),
      processingStatus: 'pending'
    });

    await obd2Session.save();

    res.status(201).json({
      success: true,
      sessionId,
      message: 'OBD2 session started successfully',
      data: {
        sessionId,
        vehicleId,
        startTime: obd2Session.dataCollectionStart
      }
    });

  } catch (error) {
    console.error('Error starting OBD2 session:', error);
    res.status(500).json({ error: 'Failed to start OBD2 session', details: error.message });
  }
};

// End OBD2 data collection session
export const endOBD2Session = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user._id;

    const session = await OBD2Data.findOne({ sessionId, userId });
    if (!session) {
      return res.status(404).json({ error: 'Session not found or access denied' });
    }

    session.dataCollectionEnd = new Date();
    session.processingStatus = 'completed';
    await session.save();

    res.json({
      success: true,
      message: 'OBD2 session ended successfully',
      data: {
        sessionId,
        duration: session.dataCollectionEnd - session.dataCollectionStart,
        totalDataPoints: session.totalDataPoints
      }
    });

  } catch (error) {
    console.error('Error ending OBD2 session:', error);
    res.status(500).json({ error: 'Failed to end OBD2 session' });
  }
};

// Process raw OBD2 parameter data
const processOBD2Parameter = (pid, rawValue) => {
  const paramInfo = OBD2_PARAMETERS[pid];
  if (!paramInfo) return null;

  let formattedValue = rawValue;
  
  // Apply transformations based on OBD2 spec
  if (paramInfo.multiplier) {
    formattedValue = rawValue * paramInfo.multiplier;
  }
  if (paramInfo.offset) {
    formattedValue = rawValue + paramInfo.offset;
  }

  return {
    pid,
    name: paramInfo.name,
    value: rawValue,
    unit: paramInfo.unit,
    formattedValue: Math.round(formattedValue * 100) / 100 // Round to 2 decimal places
  };
};

// Ingest single OBD2 data point
export const ingestOBD2Data = async (req, res) => {
  try {
    const { sessionId, parameters, dtcCodes, location, rawData } = req.body;
    const userId = req.user._id;

    // Find active session
    const session = await OBD2Data.findOne({ sessionId, userId });
    if (!session) {
      return res.status(404).json({ error: 'Session not found or access denied' });
    }

    // Process parameters
    const processedParameters = [];
    const vehicleState = {};

    if (parameters && Array.isArray(parameters)) {
      parameters.forEach(param => {
        const processed = processOBD2Parameter(param.pid, param.value);
        if (processed) {
          processedParameters.push(processed);
          
          // Update vehicle state with key parameters
          switch (processed.pid) {
            case '010C': vehicleState.rpm = processed.formattedValue; break;
            case '010D': vehicleState.speed = processed.formattedValue; break;
            case '0105': vehicleState.coolantTemp = processed.formattedValue; break;
            case '0104': vehicleState.engineLoad = processed.formattedValue; break;
            case '012F': vehicleState.fuelLevel = processed.formattedValue; break;
          }
        }
      });
    }

    // Add parameters to session
    session.parameters.push(...processedParameters);
    
    // Update vehicle state
    if (Object.keys(vehicleState).length > 0) {
      session.vehicleState = { ...session.vehicleState, ...vehicleState };
      session.vehicleState.engineRunning = vehicleState.rpm > 0;
    }

    // Add DTC codes if present
    if (dtcCodes && Array.isArray(dtcCodes)) {
      dtcCodes.forEach(dtc => {
        session.dtcCodes.push({
          code: dtc.code,
          description: dtc.description || `DTC Code: ${dtc.code}`,
          status: dtc.status || 'confirmed'
        });
      });
    }

    // Add location if available
    if (location) {
      session.location = {
        ...location,
        timestamp: new Date()
      };
    }

    // Store raw data for debugging
    if (rawData) {
      session.rawData = typeof rawData === 'string' ? rawData : JSON.stringify(rawData);
    }

    await session.save();

    // Broadcast data to WebSocket clients
    obd2WebSocketService.broadcastOBD2Data(sessionId, {
      parameters: processedParameters,
      vehicleState: session.vehicleState,
      dtcCodes: dtcCodes || [],
      location: session.location,
      timestamp: new Date()
    });

    // Broadcast vehicle state update if changed
    if (Object.keys(vehicleState).length > 0) {
      obd2WebSocketService.broadcastVehicleState(sessionId, session.vehicleState);
    }

    // Broadcast DTC updates if new codes
    if (dtcCodes && dtcCodes.length > 0) {
      obd2WebSocketService.broadcastDTCUpdate(sessionId, session.dtcCodes);
    }

    res.json({
      success: true,
      message: 'OBD2 data ingested successfully',
      data: {
        sessionId,
        parametersProcessed: processedParameters.length,
        dtcCodesAdded: dtcCodes ? dtcCodes.length : 0,
        totalDataPoints: session.totalDataPoints
      }
    });

  } catch (error) {
    console.error('Error ingesting OBD2 data:', error);
    res.status(500).json({ error: 'Failed to ingest OBD2 data', details: error.message });
  }
};

// Bulk ingest multiple OBD2 data points
export const bulkIngestOBD2Data = async (req, res) => {
  try {
    const { sessionId, dataPoints } = req.body;
    const userId = req.user._id;

    if (!Array.isArray(dataPoints) || dataPoints.length === 0) {
      return res.status(400).json({ error: 'Invalid data points array' });
    }

    const session = await OBD2Data.findOne({ sessionId, userId });
    if (!session) {
      return res.status(404).json({ error: 'Session not found or access denied' });
    }

    let totalProcessed = 0;
    let totalDTCs = 0;

    // Process each data point
    for (const dataPoint of dataPoints) {
      const { parameters, dtcCodes, timestamp } = dataPoint;
      
      if (parameters && Array.isArray(parameters)) {
        parameters.forEach(param => {
          const processed = processOBD2Parameter(param.pid, param.value);
          if (processed) {
            processed.timestamp = timestamp ? new Date(timestamp) : new Date();
            session.parameters.push(processed);
            totalProcessed++;
          }
        });
      }

      if (dtcCodes && Array.isArray(dtcCodes)) {
        dtcCodes.forEach(dtc => {
          session.dtcCodes.push({
            code: dtc.code,
            description: dtc.description || `DTC Code: ${dtc.code}`,
            status: dtc.status || 'confirmed',
            detectedAt: timestamp ? new Date(timestamp) : new Date()
          });
          totalDTCs++;
        });
      }
    }

    await session.save();

    res.json({
      success: true,
      message: 'Bulk OBD2 data ingested successfully',
      data: {
        sessionId,
        dataPointsProcessed: dataPoints.length,
        parametersProcessed: totalProcessed,
        dtcCodesAdded: totalDTCs,
        totalDataPoints: session.totalDataPoints
      }
    });

  } catch (error) {
    console.error('Error bulk ingesting OBD2 data:', error);
    res.status(500).json({ error: 'Failed to bulk ingest OBD2 data' });
  }
};

// Get OBD2 data history for a vehicle
export const getOBD2DataHistory = async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const { startDate, endDate, limit = 50, page = 1 } = req.query;
    const userId = req.user._id;

    // Validate vehicle access
    const vehicle = await Vehicle.findOne({ _id: vehicleId, userId });
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found or access denied' });
    }

    // Build query
    const query = { vehicleId, userId };
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;
    
    const [data, total] = await Promise.all([
      OBD2Data.find(query)
        .select('-rawData -parameters') // Exclude large fields for list view
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('vehicleId', 'make model year vin'),
      OBD2Data.countDocuments(query)
    ]);

    res.json({
      success: true,
      data,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching OBD2 history:', error);
    res.status(500).json({ error: 'Failed to fetch OBD2 history' });
  }
};

// Get current vehicle state
export const getVehicleCurrentState = async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const userId = req.user._id;

    // Get most recent data for this vehicle
    const latestData = await OBD2Data.findOne({ vehicleId, userId })
      .sort({ createdAt: -1 })
      .select('vehicleState parameters dtcCodes createdAt processingStatus');

    if (!latestData) {
      return res.status(404).json({ error: 'No OBD2 data found for this vehicle' });
    }

    // Get latest parameter values
    const latestParameters = {};
    latestData.parameters.forEach(param => {
      if (!latestParameters[param.pid] || param.timestamp > latestParameters[param.pid].timestamp) {
        latestParameters[param.pid] = param;
      }
    });

    res.json({
      success: true,
      data: {
        vehicleId,
        vehicleState: latestData.vehicleState,
        latestParameters: Object.values(latestParameters),
        activeDTCs: latestData.dtcCodes.filter(dtc => dtc.status !== 'cleared'),
        lastUpdated: latestData.createdAt,
        processingStatus: latestData.processingStatus
      }
    });

  } catch (error) {
    console.error('Error fetching vehicle current state:', error);
    res.status(500).json({ error: 'Failed to fetch vehicle current state' });
  }
};

// Trigger data analysis using FastAgent
export const triggerDataAnalysis = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { analysisType = 'general', options = {} } = req.body;
    const userId = req.user._id;

    const session = await OBD2Data.findOne({ sessionId, userId })
      .populate('vehicleId', 'make model year vin');
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found or access denied' });
    }

    // Prepare data for FastAgent analysis
    const analysisData = {
      vehicleInfo: {
        make: session.vehicleId.make,
        model: session.vehicleId.model,
        year: session.vehicleId.year,
        vin: session.vehicleId.vin
      },
      sessionData: {
        sessionId,
        dataCollectionStart: session.dataCollectionStart,
        dataCollectionEnd: session.dataCollectionEnd,
        totalDataPoints: session.totalDataPoints
      },
      parameters: session.parameters,
      vehicleState: session.vehicleState,
      dtcCodes: session.dtcCodes,
      analysisType,
      options
    };

    // Mark session as processing
    session.processingStatus = 'processing';
    await session.save();

    try {
      // Send to FastAgent for analysis
      const response = await axios.post(`${FASTAGENT_URL}/analysis`, {
        analysis_type: analysisType,
        data: analysisData,
        options
      }, {
        timeout: 60000 // 60 second timeout
      });

      // Store analysis results
      session.analysisResults.push({
        analysisType,
        result: response.data.result,
        confidence: response.data.confidence || 1,
        processingTime: response.data.processing_time
      });

      session.processingStatus = 'completed';
      await session.save();

      // Broadcast analysis results to WebSocket clients
      obd2WebSocketService.broadcastAnalysisResult(sessionId, {
        analysisType,
        result: response.data.result,
        confidence: response.data.confidence,
        processingTime: response.data.processing_time,
        timestamp: new Date()
      });

      res.json({
        success: true,
        message: 'Analysis completed successfully',
        data: {
          sessionId,
          analysisType,
          result: response.data.result,
          confidence: response.data.confidence,
          processingTime: response.data.processing_time
        }
      });

    } catch (analysisError) {
      console.error('FastAgent analysis error:', analysisError);
      
      session.processingStatus = 'failed';
      session.processingErrors.push({
        error: analysisError.message,
        severity: 'high'
      });
      await session.save();

      res.status(502).json({ 
        error: 'Analysis service unavailable', 
        details: analysisError.message 
      });
    }

  } catch (error) {
    console.error('Error triggering data analysis:', error);
    res.status(500).json({ error: 'Failed to trigger data analysis' });
  }
};

// Get analysis results
export const getAnalysisResults = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user._id;

    const session = await OBD2Data.findOne({ sessionId, userId })
      .select('analysisResults processingStatus processingErrors')
      .populate('vehicleId', 'make model year vin');

    if (!session) {
      return res.status(404).json({ error: 'Session not found or access denied' });
    }

    res.json({
      success: true,
      data: {
        sessionId,
        processingStatus: session.processingStatus,
        analysisResults: session.analysisResults,
        errors: session.processingErrors
      }
    });

  } catch (error) {
    console.error('Error getting analysis results:', error);
    res.status(500).json({ error: 'Failed to get analysis results' });
  }
};

// Get DTC history for a vehicle
export const getDTCHistory = async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const { limit = 50 } = req.query;
    const userId = req.user._id;

    const dtcHistory = await OBD2Data.getDTCHistory(vehicleId, parseInt(limit));
    
    res.json({
      success: true,
      data: dtcHistory
    });

  } catch (error) {
    console.error('Error fetching DTC history:', error);
    res.status(500).json({ error: 'Failed to fetch DTC history' });
  }
};

// Clear DTC codes (mark as cleared)
export const clearDTCCodes = async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const { codes } = req.body; // Array of DTC codes to clear
    const userId = req.user._id;

    const result = await OBD2Data.updateMany(
      { 
        vehicleId, 
        userId,
        'dtcCodes.code': { $in: codes },
        'dtcCodes.status': { $ne: 'cleared' }
      },
      { 
        $set: { 
          'dtcCodes.$[elem].status': 'cleared',
          'dtcCodes.$[elem].clearedAt': new Date()
        } 
      },
      { 
        arrayFilters: [{ 'elem.code': { $in: codes } }] 
      }
    );

    res.json({
      success: true,
      message: `${result.modifiedCount} DTC codes marked as cleared`,
      data: { codesCleared: codes, modifiedCount: result.modifiedCount }
    });

  } catch (error) {
    console.error('Error clearing DTC codes:', error);
    res.status(500).json({ error: 'Failed to clear DTC codes' });
  }
};

// Stream OBD2 data (WebSocket handling done in separate service)
export const streamOBD2Data = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user._id;

    const session = await OBD2Data.findOne({ sessionId, userId });
    if (!session) {
      return res.status(404).json({ error: 'Session not found or access denied' });
    }

    // Return WebSocket connection info
    res.json({
      success: true,
      message: 'Connect to WebSocket for real-time data streaming',
      websocket: {
        url: `${req.protocol === 'https' ? 'wss' : 'ws'}://${req.get('host')}/ws/obd2/${sessionId}`,
        sessionId,
        protocols: ['obd2-stream']
      }
    });

  } catch (error) {
    console.error('Error setting up OBD2 stream:', error);
    res.status(500).json({ error: 'Failed to set up OBD2 stream' });
  }
};

// Get data quality report
export const getDataQualityReport = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user._id;

    const session = await OBD2Data.findOne({ sessionId, userId });
    if (!session) {
      return res.status(404).json({ error: 'Session not found or access denied' });
    }

    // Calculate quality metrics
    const report = {
      sessionId,
      dataQuality: session.dataQuality,
      summary: {
        totalParameters: session.parameters.length,
        uniqueParameters: [...new Set(session.parameters.map(p => p.pid))].length,
        dtcCount: session.dtcCodes.length,
        collectionDuration: session.dataCollectionEnd ? 
          session.dataCollectionEnd - session.dataCollectionStart : 
          Date.now() - session.dataCollectionStart,
        avgParametersPerMinute: session.parameters.length / 
          ((session.dataCollectionEnd || Date.now()) - session.dataCollectionStart) * 60000
      },
      errors: session.processingErrors
    };

    res.json({
      success: true,
      data: report
    });

  } catch (error) {
    console.error('Error generating data quality report:', error);
    res.status(500).json({ error: 'Failed to generate data quality report' });
  }
};

// Export OBD2 data
export const exportOBD2Data = async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const { format = 'json', startDate, endDate } = req.query;
    const userId = req.user._id;

    const query = { vehicleId, userId };
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const data = await OBD2Data.find(query)
      .populate('vehicleId', 'make model year vin')
      .sort({ createdAt: -1 });

    if (format === 'csv') {
      // Convert to CSV format
      const csv = convertToCSV(data);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=obd2_data_${vehicleId}.csv`);
      res.send(csv);
    } else {
      // Return JSON
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=obd2_data_${vehicleId}.json`);
      res.json({
        success: true,
        exportDate: new Date(),
        vehicleId,
        recordCount: data.length,
        data
      });
    }

  } catch (error) {
    console.error('Error exporting OBD2 data:', error);
    res.status(500).json({ error: 'Failed to export OBD2 data' });
  }
};

// Helper function to convert data to CSV
const convertToCSV = (data) => {
  const headers = ['Session ID', 'Timestamp', 'Parameter', 'Value', 'Unit', 'Vehicle State'];
  const rows = [];

  data.forEach(session => {
    session.parameters.forEach(param => {
      rows.push([
        session.sessionId,
        param.timestamp || session.createdAt,
        param.name,
        param.formattedValue || param.value,
        param.unit,
        JSON.stringify(session.vehicleState)
      ]);
    });
  });

  return [headers, ...rows].map(row => row.join(',')).join('\n');
};