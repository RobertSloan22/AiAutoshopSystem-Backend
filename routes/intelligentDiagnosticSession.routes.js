import express from 'express';
import axios from 'axios';
import IntelligentDiagnosticSession from '../models/intelligentDiagnosticSession.model.js';
import DiagnosticSession from '../models/diagnosticSession.model.js';
import Analysis from '../models/analysis.model.js';

const router = express.Router();

// Helper function for logging
const logRequest = (method, endpoint, data = {}) => {
  console.log(`[IDS ROUTE] ${new Date().toISOString()} - ${method.toUpperCase()} ${endpoint}`, data);
};

// Create new IDS
router.post('/', async (req, res) => {
  try {
    const { forceNew } = req.query;
    logRequest('POST', '/api/ids', { ...req.body, forceNew });
    
    const {
      userId,
      vehicleId,
      vin,
      vehicleInfo
    } = req.body;

    if (!vin) {
      return res.status(400).json({ error: 'VIN is required' });
    }

    // If forceNew is true, always create a new IDS
    if (forceNew === 'true') {
      console.log(`🆕 Force creating new IDS for VIN: ${vin}`);
      const newIDS = new IntelligentDiagnosticSession({
        userId: userId || null,
        vehicleId: vehicleId || null,
        vin: vin,
        vehicleInfo: vehicleInfo || {},
        currentStage: 'inspection',
        stages: [{
          stage: 'inspection',
          status: 'in-progress',
          startTime: new Date()
        }],
        overallStatus: 'active'
      });

      const savedIDS = await newIDS.save();
      logRequest('POST', '/api/ids', { success: true, idsId: savedIDS.idsId, forceNew: true });
      
      return res.status(201).json({
        success: true,
        ids: savedIDS,
        isNew: true
      });
    }

    // Check for most recent IDS regardless of status (including completed)
    const mostRecentIDS = await IntelligentDiagnosticSession.findOne({ vin })
      .sort({ createdAt: -1 });
    
    // If most recent exists, check if it's truly active (not completed)
    if (mostRecentIDS) {
      // Check both overallStatus and actual stage completion state for consistency
      const allStagesCompleted = mostRecentIDS.areAllStagesCompleted();
      const isActuallyCompleted = mostRecentIDS.overallStatus === 'completed' || allStagesCompleted;
      
      // If IDS is active and not all stages are completed, return it
      if (mostRecentIDS.overallStatus === 'active' && !allStagesCompleted) {
        // Ensure state consistency before returning
        await mostRecentIDS.ensureConsistentState();
        logRequest('GET', '/api/ids', { message: 'Returning existing active IDS', idsId: mostRecentIDS.idsId });
        return res.json({
          success: true,
          ids: mostRecentIDS,
          isNew: false
        });
      }
      
      // If IDS is marked as completed or all stages are completed, create a new one
      if (isActuallyCompleted || mostRecentIDS.overallStatus === 'paused') {
        console.log(`🆕 Most recent IDS is ${mostRecentIDS.overallStatus}${allStagesCompleted ? ' (all stages completed)' : ''}, creating new IDS for VIN: ${vin}`);
      }
    }

    // Create new IDS with initial inspection stage
    const newIDS = new IntelligentDiagnosticSession({
      userId: userId || null,
      vehicleId: vehicleId || null,
      vin: vin,
      vehicleInfo: vehicleInfo || {},
      currentStage: 'inspection',
      stages: [{
        stage: 'inspection',
        status: 'in-progress',
        startTime: new Date()
      }],
      overallStatus: 'active'
    });

    const savedIDS = await newIDS.save();
    
    logRequest('POST', '/api/ids', { success: true, idsId: savedIDS.idsId });
    
    res.status(201).json({
      success: true,
      ids: savedIDS,
      isNew: true
    });
  } catch (error) {
    console.error('❌ Failed to create IDS:', error);
    res.status(500).json({ error: 'Failed to create Intelligent Diagnostic Session', message: error.message });
  }
});

// Get IDS by ID (summary mode - same as list view)
router.get('/:idsId', async (req, res) => {
  try {
    const { idsId } = req.params;
    logRequest('GET', `/api/ids/${idsId}`);

    const ids = await IntelligentDiagnosticSession.findOne({ idsId })
      .populate('linkedLiveDataSessions')
      .populate('stages.liveDataSessionIds');

    if (!ids) {
      return res.status(404).json({ error: 'IDS not found' });
    }

    res.json({
      success: true,
      ids
    });
  } catch (error) {
    console.error('❌ Failed to get IDS:', error);
    res.status(500).json({ error: 'Failed to get IDS', message: error.message });
  }
});

// Get full IDS details with all populated data
router.get('/:idsId/full', async (req, res) => {
  try {
    const { idsId } = req.params;
    logRequest('GET', `/api/ids/${idsId}/full`);

    const ids = await IntelligentDiagnosticSession.findOne({ idsId })
      .populate('linkedLiveDataSessions')
      .populate('stages.liveDataSessionIds');

    if (!ids) {
      return res.status(404).json({ error: 'IDS not found' });
    }

    res.json({
      success: true,
      ids
    });
  } catch (error) {
    console.error('❌ Failed to get full IDS details:', error);
    res.status(500).json({ error: 'Failed to get full IDS details', message: error.message });
  }
});

// Get full stage details including analysis results, reports, freeze frames
router.get('/:idsId/stage/:stageName/details', async (req, res) => {
  try {
    const { idsId, stageName } = req.params;
    logRequest('GET', `/api/ids/${idsId}/stage/${stageName}/details`);

    const validStages = ['inspection', 'analysis-repair', 'verification-testdriving'];
    if (!validStages.includes(stageName)) {
      return res.status(400).json({ error: 'Invalid stage name' });
    }

    const ids = await IntelligentDiagnosticSession.findOne({ idsId })
      .populate('stages.liveDataSessionIds');

    if (!ids) {
      return res.status(404).json({ error: 'IDS not found' });
    }

    const stage = ids.getStage(stageName);
    if (!stage) {
      return res.status(404).json({ error: 'Stage not found' });
    }

    // Return full stage data
    res.json({
      success: true,
      stage,
      idsId: ids.idsId,
      vin: ids.vin
    });
  } catch (error) {
    console.error('❌ Failed to get stage details:', error);
    res.status(500).json({ error: 'Failed to get stage details', message: error.message });
  }
});

// Get most recent IDS for vehicle
router.get('/vehicle/:vin', async (req, res) => {
  try {
    const { vin } = req.params;
    const { includeCompleted } = req.query;
    logRequest('GET', `/api/ids/vehicle/${vin}`, { includeCompleted });

    let ids;
    if (includeCompleted === 'true') {
      // Get most recent regardless of status
      ids = await IntelligentDiagnosticSession.findOne({ vin })
        .sort({ createdAt: -1 })
        .populate('linkedLiveDataSessions')
        .populate('stages.liveDataSessionIds');
    } else {
      // Get most recent active or paused
      ids = await IntelligentDiagnosticSession.findMostRecentForVehicle(vin)
        .populate('linkedLiveDataSessions')
        .populate('stages.liveDataSessionIds');
    }

    if (!ids) {
      return res.status(404).json({ 
        success: false,
        error: 'No IDS found for this vehicle',
        vin 
      });
    }

    res.json({
      success: true,
      ids
    });
  } catch (error) {
    console.error('❌ Failed to get IDS for vehicle:', error);
    res.status(500).json({ error: 'Failed to get IDS for vehicle', message: error.message });
  }
});

// Get all IDS entries for a vehicle (with pagination and summary mode)
router.get('/vehicle/:vin/all', async (req, res) => {
  try {
    const { vin } = req.params;
    const { page = '1', limit = '20', summary = 'true' } = req.query;
    
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10))); // Max 100, min 1
    const isSummary = summary === 'true' || summary === true;
    
    logRequest('GET', `/api/ids/vehicle/${vin}/all`, { page: pageNum, limit: limitNum, summary: isSummary });

    // Get total count first
    const total = await IntelligentDiagnosticSession.countDocuments({ vin });
    
    // Build query with pagination
    let query = IntelligentDiagnosticSession.find({ vin })
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    // Only populate heavy data when not in summary mode
    if (!isSummary) {
      query = query
        .populate('linkedLiveDataSessions')
        .populate('stages.liveDataSessionIds');
    }

    const allIDS = await query;

    // Transform response to exclude heavy fields when in summary mode
    const transformedIDS = allIDS.map(ids => {
      const idsObj = ids.toObject();
      
      if (isSummary) {
        // Remove heavy fields from stages
        if (idsObj.stages && Array.isArray(idsObj.stages)) {
          idsObj.stages = idsObj.stages.map(stage => {
            const stageObj = { ...stage };
            // Keep analysisId but remove analysisResults
            if (stageObj.analysisResults) {
              delete stageObj.analysisResults;
            }
            // Keep report existence flag but remove full report
            if (stageObj.stageReport) {
              stageObj.hasStageReport = true;
              delete stageObj.stageReport;
            } else {
              stageObj.hasStageReport = false;
            }
            // Keep freeze frame count but remove data
            if (stageObj.freezeFrameData && Array.isArray(stageObj.freezeFrameData)) {
              stageObj.freezeFrameCount = stageObj.freezeFrameData.length;
              delete stageObj.freezeFrameData;
            }
            // Keep session IDs but don't populate
            if (stageObj.liveDataSessionIds && Array.isArray(stageObj.liveDataSessionIds)) {
              // Already just IDs if not populated
              stageObj.liveDataSessionCount = stageObj.liveDataSessionIds.length;
            }
            return stageObj;
          });
        }
        
        // Keep linked session IDs but don't populate
        if (idsObj.linkedLiveDataSessions && Array.isArray(idsObj.linkedLiveDataSessions)) {
          idsObj.linkedLiveDataSessionCount = idsObj.linkedLiveDataSessions.length;
          // If populated, extract IDs; otherwise already IDs
          idsObj.linkedLiveDataSessions = idsObj.linkedLiveDataSessions.map(s => 
            typeof s === 'object' && s._id ? s._id.toString() : s.toString()
          );
        }
      }
      
      return idsObj;
    });

    // Log status breakdown for debugging
    const statusBreakdown = transformedIDS.reduce((acc, ids) => {
      const status = ids.overallStatus || 'unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
    console.log(`📊 Found ${transformedIDS.length} IDS entries (page ${pageNum}) for VIN ${vin}:`, statusBreakdown);

    const hasMore = (pageNum * limitNum) < total;

    res.json({
      success: true,
      idsList: transformedIDS,
      count: transformedIDS.length,
      total,
      page: pageNum,
      limit: limitNum,
      hasMore
    });
  } catch (error) {
    console.error('❌ Failed to get all IDS for vehicle:', error);
    res.status(500).json({ error: 'Failed to get all IDS for vehicle', message: error.message });
  }
});

// Start a stage
router.put('/:idsId/stage/:stageName/start', async (req, res) => {
  try {
    const { idsId, stageName } = req.params;
    const { allowSkipStages } = req.query;
    logRequest('PUT', `/api/ids/${idsId}/stage/${stageName}/start`, { allowSkipStages });

    const validStages = ['inspection', 'analysis-repair', 'verification-testdriving'];
    if (!validStages.includes(stageName)) {
      return res.status(400).json({ error: 'Invalid stage name' });
    }

    const ids = await IntelligentDiagnosticSession.findOne({ idsId });
    if (!ids) {
      return res.status(404).json({ error: 'IDS not found' });
    }

    // Use the new startStage method which handles validation and single-stage enforcement atomically
    const allowSkip = allowSkipStages === 'true' || allowSkipStages === true;
    await ids.startStage(stageName, allowSkip);

    // Ensure state consistency
    await ids.ensureConsistentState();

    res.json({
      success: true,
      ids,
      stage: ids.getStage(stageName)
    });
  } catch (error) {
    console.error('❌ Failed to start stage:', error);
    // Check if it's a validation error
    if (error.message && error.message.includes('Cannot start')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to start stage', message: error.message });
  }
});

// Update stage data without completing (for auto-collection of diagnostic data)
router.put('/:idsId/stage/:stageName/data', async (req, res) => {
  try {
    const { idsId, stageName } = req.params;
    const { dtcScanResults, readinessMonitorStatus, freezeFrameData, notes, supportedPids, vehicleInfo } = req.body;
    logRequest('PUT', `/api/ids/${idsId}/stage/${stageName}/data`, { 
      hasDtcResults: !!dtcScanResults,
      hasReadiness: !!readinessMonitorStatus,
      hasFreezeFrame: !!freezeFrameData,
      hasSupportedPids: !!supportedPids,
      hasVehicleInfo: !!vehicleInfo
    });

    const validStages = ['inspection', 'analysis-repair', 'verification-testdriving'];
    if (!validStages.includes(stageName)) {
      return res.status(400).json({ error: 'Invalid stage name' });
    }

    const ids = await IntelligentDiagnosticSession.findOne({ idsId });
    if (!ids) {
      return res.status(404).json({ error: 'IDS not found' });
    }

    // Update stage data without changing status or endTime
    const updates = {};

    if (dtcScanResults) updates.dtcScanResults = dtcScanResults;
    if (readinessMonitorStatus) updates.readinessMonitorStatus = readinessMonitorStatus;
    if (freezeFrameData) updates.freezeFrameData = freezeFrameData;
    if (notes) updates.notes = notes;

    // Store supportedPids and vehicleInfo in metadata if provided
    if (supportedPids || vehicleInfo) {
      const stage = ids.getStage(stageName);
      const currentMetadata = stage?.metadata || {};
      const updatedMetadata = { ...currentMetadata };
      
      if (supportedPids) {
        updatedMetadata.supportedPids = supportedPids;
      }
      if (vehicleInfo) {
        updatedMetadata.vehicleInfo = vehicleInfo;
      }
      
      updates.metadata = updatedMetadata;
    }

    await ids.updateStage(stageName, updates);
    await ids.save();

    res.json({
      success: true,
      ids,
      stage: ids.getStage(stageName)
    });
  } catch (error) {
    console.error('❌ Failed to update stage data:', error);
    res.status(500).json({ error: 'Failed to update stage data', message: error.message });
  }
});

// Complete a stage
router.put('/:idsId/stage/:stageName/complete', async (req, res) => {
  try {
    const { idsId, stageName } = req.params;
    const { dtcScanResults, readinessMonitorStatus, freezeFrameData, notes } = req.body;
    logRequest('PUT', `/api/ids/${idsId}/stage/${stageName}/complete`, { 
      hasDtcResults: !!dtcScanResults,
      hasReadiness: !!readinessMonitorStatus,
      hasFreezeFrame: !!freezeFrameData
    });

    const ids = await IntelligentDiagnosticSession.findOne({ idsId });
    if (!ids) {
      return res.status(404).json({ error: 'IDS not found' });
    }

    // Update stage with completion data
    const updates = {
      status: 'completed',
      endTime: new Date()
    };

    if (dtcScanResults) updates.dtcScanResults = dtcScanResults;
    if (readinessMonitorStatus) updates.readinessMonitorStatus = readinessMonitorStatus;
    if (freezeFrameData) updates.freezeFrameData = freezeFrameData;
    if (notes) updates.notes = notes;

    await ids.updateStage(stageName, updates);
    
    // Ensure state consistency (this will check if all stages are completed and update overallStatus)
    await ids.ensureConsistentState();
    
    // Log if IDS was marked as completed
    if (ids.overallStatus === 'completed') {
      console.log(`✅ IDS ${idsId} marked as completed - all stages finished`);
    }

    res.json({
      success: true,
      ids,
      stage: ids.getStage(stageName)
    });
  } catch (error) {
    console.error('❌ Failed to complete stage:', error);
    res.status(500).json({ error: 'Failed to complete stage', message: error.message });
  }
});

// Explicitly close/complete an IDS (for edge cases or manual closure)
router.put('/:idsId/close', async (req, res) => {
  try {
    const { idsId } = req.params;
    logRequest('PUT', `/api/ids/${idsId}/close`);

    const ids = await IntelligentDiagnosticSession.findOne({ idsId });
    if (!ids) {
      return res.status(404).json({ error: 'IDS not found' });
    }

    // Mark as completed
    ids.overallStatus = 'completed';
    
    // Ensure all stages are marked as completed if they're not already
    const stageOrder = ['inspection', 'analysis-repair', 'verification-testdriving'];
    let needsSave = false;
    
    stageOrder.forEach(stageName => {
      const stage = ids.getStage(stageName);
      if (stage && stage.status !== 'completed') {
        stage.status = 'completed';
        if (!stage.endTime) {
          stage.endTime = new Date();
        }
        needsSave = true;
      }
    });
    
    if (needsSave || ids.overallStatus !== 'completed') {
      await ids.save();
    }
    
    // Ensure state consistency
    await ids.ensureConsistentState();

    console.log(`✅ IDS ${idsId} explicitly closed/completed`);

    res.json({
      success: true,
      ids,
      message: 'IDS has been closed and marked as completed'
    });
  } catch (error) {
    console.error('❌ Failed to close IDS:', error);
    res.status(500).json({ error: 'Failed to close IDS', message: error.message });
  }
});

// Link live data session to IDS stage
router.post('/:idsId/stage/:stageName/link-session', async (req, res) => {
  try {
    const { idsId, stageName } = req.params;
    const { sessionId } = req.body;
    logRequest('POST', `/api/ids/${idsId}/stage/${stageName}/link-session`, { sessionId });

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    // Verify session exists
    const session = await DiagnosticSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const ids = await IntelligentDiagnosticSession.findOne({ idsId });
    if (!ids) {
      return res.status(404).json({ error: 'IDS not found' });
    }

    // Link session to stage and IDS
    await ids.linkSession(sessionId, stageName);

    // Also update the DiagnosticSession to reference the IDS
    await DiagnosticSession.findByIdAndUpdate(sessionId, {
      $set: {
        idsId: idsId,
        idsStage: stageName
      }
    });

    res.json({
      success: true,
      ids,
      stage: ids.getStage(stageName)
    });
  } catch (error) {
    console.error('❌ Failed to link session:', error);
    res.status(500).json({ error: 'Failed to link session', message: error.message });
  }
});

// Associate analysis results with stage
router.post('/:idsId/stage/:stageName/analysis', async (req, res) => {
  try {
    const { idsId, stageName } = req.params;
    const { analysisId, analysisResults } = req.body;
    logRequest('POST', `/api/ids/${idsId}/stage/${stageName}/analysis`, { analysisId });

    if (!analysisId) {
      return res.status(400).json({ error: 'analysisId is required' });
    }

    // Verify analysis exists
    const analysis = await Analysis.findOne({ analysisId });
    if (!analysis) {
      return res.status(404).json({ error: 'Analysis not found' });
    }

    const ids = await IntelligentDiagnosticSession.findOne({ idsId });
    if (!ids) {
      return res.status(404).json({ error: 'IDS not found' });
    }

    // Associate analysis with stage
    await ids.associateAnalysis(analysisId, analysisResults || analysis, stageName);

    // Also update the Analysis to reference the IDS
    await Analysis.findOneAndUpdate({ analysisId }, {
      $set: {
        idsId: idsId,
        idsStage: stageName
      }
    });

    res.json({
      success: true,
      ids,
      stage: ids.getStage(stageName)
    });
  } catch (error) {
    console.error('❌ Failed to associate analysis:', error);
    res.status(500).json({ error: 'Failed to associate analysis', message: error.message });
  }
});

// Update stage analysis results (PUT for updates, POST for new associations)
router.put('/:idsId/stage/:stageName/analysis', async (req, res) => {
  try {
    const { idsId, stageName } = req.params;
    const { analysisResults, analysisId } = req.body;
    logRequest('PUT', `/api/ids/${idsId}/stage/${stageName}/analysis`, { analysisId: analysisId || 'new' });

    const ids = await IntelligentDiagnosticSession.findOne({ idsId });
    if (!ids) {
      return res.status(404).json({ error: 'IDS not found' });
    }

    const stage = ids.getStage(stageName);
    if (!stage) {
      return res.status(404).json({ error: 'Stage not found' });
    }

    // Update stage with analysis data
    const updates = {};
    if (analysisResults !== undefined) {
      updates.analysisResults = analysisResults;
    }
    if (analysisId !== undefined) {
      updates.analysisId = analysisId;
    }

    await ids.updateStage(stageName, updates);
    await ids.save();

    res.json({
      success: true,
      ids,
      stage: ids.getStage(stageName)
    });
  } catch (error) {
    console.error('❌ Failed to update stage analysis:', error);
    res.status(500).json({ error: 'Failed to update stage analysis', message: error.message });
  }
});

// Update stage metadata
router.put('/:idsId/stage/:stageName/metadata', async (req, res) => {
  try {
    const { idsId, stageName } = req.params;
    const { metadata } = req.body;
    logRequest('PUT', `/api/ids/${idsId}/stage/${stageName}/metadata`);

    if (!metadata || typeof metadata !== 'object') {
      return res.status(400).json({ error: 'metadata object is required' });
    }

    const ids = await IntelligentDiagnosticSession.findOne({ idsId });
    if (!ids) {
      return res.status(404).json({ error: 'IDS not found' });
    }

    const stage = ids.getStage(stageName);
    if (!stage) {
      return res.status(404).json({ error: 'Stage not found' });
    }

    // Merge new metadata with existing metadata
    const currentMetadata = stage.metadata || {};
    const updatedMetadata = { ...currentMetadata, ...metadata };

    await ids.updateStage(stageName, { metadata: updatedMetadata });
    await ids.save();

    res.json({
      success: true,
      ids,
      stage: ids.getStage(stageName)
    });
  } catch (error) {
    console.error('❌ Failed to update stage metadata:', error);
    res.status(500).json({ error: 'Failed to update stage metadata', message: error.message });
  }
});

// Add live data session ID to stage
router.post('/:idsId/stage/:stageName/live-data-session', async (req, res) => {
  try {
    const { idsId, stageName } = req.params;
    const { sessionId } = req.body;
    logRequest('POST', `/api/ids/${idsId}/stage/${stageName}/live-data-session`, { sessionId });

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const ids = await IntelligentDiagnosticSession.findOne({ idsId });
    if (!ids) {
      return res.status(404).json({ error: 'IDS not found' });
    }

    const stage = ids.getStage(stageName);
    if (!stage) {
      return res.status(404).json({ error: 'Stage not found' });
    }

    // Add session ID to stage if not already present
    const currentSessionIds = stage.liveDataSessionIds || [];
    if (!currentSessionIds.includes(sessionId)) {
      currentSessionIds.push(sessionId);
      await ids.updateStage(stageName, { liveDataSessionIds: currentSessionIds });
      await ids.save();
    }

    res.json({
      success: true,
      ids,
      stage: ids.getStage(stageName)
    });
  } catch (error) {
    console.error('❌ Failed to add live data session to stage:', error);
    res.status(500).json({ error: 'Failed to add live data session to stage', message: error.message });
  }
});

// Record workflow event for a stage (used by frontend WorkflowEventBus)
router.post('/:idsId/stage/:stageName/workflow-event', async (req, res) => {
  try {
    const { idsId, stageName } = req.params;
    const {
      workflowStage,
      eventType,
      from,
      to,
      message,
      data,
      timestamp
    } = req.body || {};

    logRequest('POST', `/api/ids/${idsId}/stage/${stageName}/workflow-event`, {
      workflowStage,
      eventType
    });

    const ids = await IntelligentDiagnosticSession.findOne({ idsId });
    if (!ids) {
      return res.status(404).json({ error: 'IDS not found' });
    }

    const stage = ids.getStage(stageName);
    if (!stage) {
      return res.status(404).json({ error: 'Stage not found' });
    }

    const existingMetadata = stage.metadata || {};
    const existingEvents = Array.isArray(existingMetadata.workflowEvents)
      ? existingMetadata.workflowEvents
      : [];

    const eventEntry = {
      workflowStage: workflowStage || stageName,
      eventType,
      from,
      to,
      message,
      data,
      timestamp: timestamp || new Date().toISOString()
    };

    const newMetadata = {
      ...existingMetadata,
      lastWorkflowStage: eventEntry.workflowStage,
      lastEventType: eventType,
      workflowEvents: [...existingEvents, eventEntry]
    };

    await ids.updateStage(stageName, { metadata: newMetadata });

    res.json({
      success: true,
      ids,
      stage: ids.getStage(stageName)
    });
  } catch (error) {
    console.error('❌ Failed to record workflow event:', error);
    res.status(500).json({ error: 'Failed to record workflow event', message: error.message });
  }
});

// Save AI guided steps for a stage
router.post('/:idsId/stage/:stageName/ai-steps', async (req, res) => {
  try {
    const { idsId, stageName } = req.params;
    const { aiSteps, metadata } = req.body || {};

    logRequest('POST', `/api/ids/${idsId}/stage/${stageName}/ai-steps`, {
      stepsCount: Array.isArray(aiSteps) ? aiSteps.length : 0
    });

    if (!Array.isArray(aiSteps) || aiSteps.length === 0) {
      return res.status(400).json({ error: 'aiSteps array is required' });
    }

    const ids = await IntelligentDiagnosticSession.findOne({ idsId });
    if (!ids) {
      return res.status(404).json({ error: 'IDS not found' });
    }

    const stage = ids.getStage(stageName);
    if (!stage) {
      return res.status(404).json({ error: 'Stage not found' });
    }

    const existingMetadata = stage.metadata || {};

    const newMetadata = {
      ...existingMetadata,
      aiSteps,
      aiStepsMeta: {
        ...(existingMetadata.aiStepsMeta || {}),
        ...(metadata || {})
      }
    };

    await ids.updateStage(stageName, { metadata: newMetadata });

    res.json({
      success: true,
      ids,
      stage: ids.getStage(stageName)
    });
  } catch (error) {
    console.error('❌ Failed to save AI steps for IDS stage:', error);
    res.status(500).json({ error: 'Failed to save AI steps for IDS stage', message: error.message });
  }
});

// Save diagnostic report metadata for a stage
router.post('/:idsId/stage/:stageName/diagnostic-report', async (req, res) => {
  try {
    const { idsId, stageName } = req.params;
    const {
      sessionId,
      reportContent,
      summary,
      activitySummary,
      analysisResults,
      recommendations,
      aiDiagnosticSteps,
      dtcCodes,
      timestamp
    } = req.body || {};

    logRequest('POST', `/api/ids/${idsId}/stage/${stageName}/diagnostic-report`, {
      sessionId,
      hasSummary: !!summary
    });

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const ids = await IntelligentDiagnosticSession.findOne({ idsId });
    if (!ids) {
      return res.status(404).json({ error: 'IDS not found' });
    }

    const stage = ids.getStage(stageName);
    if (!stage) {
      return res.status(404).json({ error: 'Stage not found' });
    }

    const existingMetadata = stage.metadata || {};
    const existingReports = Array.isArray(existingMetadata.diagnosticReports)
      ? existingMetadata.diagnosticReports
      : [];

    const reportEntry = {
      sessionId,
      reportContent,
      summary,
      activitySummary,
      analysisResults,
      recommendations,
      aiDiagnosticSteps,
      dtcCodes,
      timestamp: timestamp || new Date().toISOString()
    };

    const newMetadata = {
      ...existingMetadata,
      lastDiagnosticReport: reportEntry,
      diagnosticReports: [...existingReports, reportEntry]
    };

    await ids.updateStage(stageName, { metadata: newMetadata });

    res.json({
      success: true,
      ids,
      stage: ids.getStage(stageName)
    });
  } catch (error) {
    console.error('❌ Failed to save diagnostic report for IDS stage:', error);
    res.status(500).json({ error: 'Failed to save diagnostic report for IDS stage', message: error.message });
  }
});

// Generate stage report
router.post('/:idsId/stage/:stageName/generate-report', async (req, res) => {
  try {
    const { idsId, stageName } = req.params;
    logRequest('POST', `/api/ids/${idsId}/stage/${stageName}/generate-report`);

    const ids = await IntelligentDiagnosticSession.findOne({ idsId })
      .populate('stages.liveDataSessionIds');
    
    if (!ids) {
      return res.status(404).json({ error: 'IDS not found' });
    }

    const stage = ids.getStage(stageName);
    if (!stage) {
      return res.status(404).json({ error: 'Stage not found' });
    }

    // Extract plots, calculate time saved, and determine next stage
    console.log(`[IDS REPORT] Starting report generation for stage: ${stageName}`);
    const plots = await extractStagePlots(stage, stage.analysisId);
    console.log(`[IDS REPORT] Extracted ${plots.length} plot(s)`);
    const timeSaved = calculateTimeSaved(stage, stageName);
    console.log(`[IDS REPORT] Time saved calculation: ${JSON.stringify(timeSaved)}`);
    const nextStage = determineNextStage(stageName, ids);
    console.log(`[IDS REPORT] Next stage: ${nextStage ? nextStage.displayName : 'None'}`);

    // Build AI prompt with all context
    const prompt = buildStageReportPrompt(ids, stage, stageName, plots, timeSaved, nextStage);
    console.log(`[IDS REPORT] Prompt built, length: ${prompt.length} characters`);

    // Prepare vehicle context for the AI
    const vehicleContext = {
      make: ids.vehicleInfo?.make,
      model: ids.vehicleInfo?.model,
      year: ids.vehicleInfo?.year,
      vin: ids.vin,
      engine: ids.vehicleInfo?.engine,
      transmission: ids.vehicleInfo?.transmission,
      fuelType: ids.vehicleInfo?.fuelType
    };

    let aiReport = '';

    try {
      // Determine base URL for internal API call
      // Try to use the request's protocol and host if available, otherwise use environment variable or localhost
      // eslint-disable-next-line no-undef
      const env = process.env || {};
      let baseUrl = env.API_BASE_URL;
      if (!baseUrl && req) {
        const protocol = req.protocol || 'http';
        const host = req.get('host') || `localhost:${env.PORT || 3000}`;
        baseUrl = `${protocol}://${host}`;
      }
      if (!baseUrl) {
        baseUrl = `http://localhost:${env.PORT || 3000}`;
      }
      const streamUrl = `${baseUrl}/api/responses/chat/stream`;

      console.log(`[IDS REPORT] Calling AI service at: ${streamUrl}`);

      // Call the streaming API
      const response = await axios.post(streamUrl, {
        message: prompt,
        vehicleContext: vehicleContext,
        customerContext: {
          idsId: ids.idsId,
          stageName: stageName,
          stageStatus: stage.status
        },
        includeVisualization: false // We're handling plots separately
      }, {
        responseType: 'stream',
        timeout: 120000 // 2 minute timeout
      });

      // Handle SSE streaming response
      aiReport = await new Promise((resolve, reject) => {
        let fullReport = '';
        let buffer = '';
        let streamComplete = false;
        let hasError = false;

        response.data.on('data', (chunk) => {
          if (hasError) return; // Don't process more data if we already have an error
          
          buffer += chunk.toString();
          
          // Process complete SSE events
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer
          
          for (const line of lines) {
            if (line.trim() === '') continue; // Skip empty lines
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.substring(6));
                
                if (data.type === 'content' && data.content) {
                  fullReport += data.content;
                } else if (data.type === 'analysis_complete' || data.type === 'stream_complete') {
                  // Mark stream as complete, but wait for 'end' event to resolve
                  streamComplete = true;
                  console.log('[IDS REPORT] Stream completion event received');
                } else if (data.type === 'error') {
                  hasError = true;
                  reject(new Error(data.error || 'AI service error'));
                  return;
                }
              } catch (parseError) {
                // Ignore parse errors for non-JSON lines (like comments or empty data lines)
                if (line.includes('error') || line.includes('Error')) {
                  console.warn('[IDS REPORT] SSE parse error on line:', line.substring(0, 100), parseError.message);
                }
              }
            }
          }
        });

        response.data.on('end', () => {
          console.log('[IDS REPORT] Stream ended. Content length:', fullReport.length, 'Stream complete flag:', streamComplete);
          // If we have content, resolve with it; otherwise reject
          if (fullReport && fullReport.trim().length > 0) {
            resolve(fullReport);
          } else {
            reject(new Error('No content received from AI service'));
          }
        });

        response.data.on('error', (error) => {
          console.error('[IDS REPORT] Stream error:', error);
          hasError = true;
          reject(error);
        });
      });

      // If we got a report from AI, use it
      if (aiReport && aiReport.trim().length > 100) {
        // Embed plots into the report if available
        let finalReport = aiReport;
        
        if (plots.length > 0) {
          // Add plot section if not already included
          if (!finalReport.toLowerCase().includes('visualization') && !finalReport.includes('![')) {
            finalReport += '\n\n## Visualizations\n\n';
            plots.forEach((plot, idx) => {
              const plotTitle = plot.description || plot.filename || `Visualization ${idx + 1}`;
              // Ensure base64 data is properly formatted
              const base64Data = plot.base64.startsWith('data:') 
                ? plot.base64 
                : `data:${plot.mimeType || 'image/png'};base64,${plot.base64}`;
              finalReport += `\n### ${plotTitle}\n\n![${plotTitle}](${base64Data})\n\n`;
            });
          }
        }

        // Save AI-generated report to stage
        await ids.updateStage(stageName, { stageReport: finalReport });
        await ids.save();

        return res.json({
          success: true,
          report: finalReport,
          stage: ids.getStage(stageName),
          method: 'ai_generated',
          timeSaved: timeSaved,
          nextStage: nextStage
        });
      } else {
        throw new Error('AI report too short or empty');
      }

    } catch (aiError) {
      console.warn('[IDS REPORT] AI service failed, using fallback:', aiError.message);
      console.warn('[IDS REPORT] Error details:', {
        message: aiError.message,
        code: aiError.code,
        response: aiError.response?.status,
        responseData: aiError.response?.data
      });
      
      // Fallback to simple report generation
      const fallbackReport = generateStageReport(ids, stage, stageName);
      
      // Add time saved and next stage info to fallback report
      let enhancedReport = fallbackReport;
      enhancedReport += `\n\n## Time Analysis\n\n`;
      enhancedReport += `- **Actual Duration**: ${timeSaved.actualTime} minutes\n`;
      enhancedReport += `- **Estimated Manual Time**: ${timeSaved.estimatedManualTime} minutes\n`;
      enhancedReport += `- **Time Saved**: ${timeSaved.timeSaved} minutes (${timeSaved.percentageSaved}%)\n\n`;
      
      if (nextStage) {
        enhancedReport += `## Next Steps\n\n`;
        enhancedReport += `- **Next Stage**: ${nextStage.displayName}\n`;
        enhancedReport += `- **Status**: ${nextStage.status}\n`;
        enhancedReport += `- **Description**: ${nextStage.description}\n\n`;
      }

      // Save fallback report
      await ids.updateStage(stageName, { stageReport: enhancedReport });
      await ids.save();

      return res.json({
        success: true,
        report: enhancedReport,
        stage: ids.getStage(stageName),
        method: 'fallback',
        timeSaved: timeSaved,
        nextStage: nextStage,
        warning: 'AI service unavailable, used fallback report'
      });
    }
  } catch (error) {
    console.error('❌ Failed to generate stage report:', error);
    console.error('❌ Error stack:', error.stack);
    
    // Ensure we always send a response, even if something goes wrong
    if (!res.headersSent) {
      // eslint-disable-next-line no-undef
      const isDev = process.env.NODE_ENV === 'development';
      res.status(500).json({ 
        error: 'Failed to generate stage report', 
        message: error.message,
        details: isDev ? error.stack : undefined
      });
    }
  }
});

// Get complete IDS report
router.get('/:idsId/report', async (req, res) => {
  try {
    const { idsId } = req.params;
    logRequest('GET', `/api/ids/${idsId}/report`);

    const ids = await IntelligentDiagnosticSession.findOne({ idsId })
      .populate('linkedLiveDataSessions')
      .populate('stages.liveDataSessionIds');

    if (!ids) {
      return res.status(404).json({ error: 'IDS not found' });
    }

    // Generate complete report
    const report = generateCompleteReport(ids);

    res.json({
      success: true,
      report,
      ids
    });
  } catch (error) {
    console.error('❌ Failed to get IDS report:', error);
    res.status(500).json({ error: 'Failed to get IDS report', message: error.message });
  }
});

// Helper function to extract plots from stage analysis
async function extractStagePlots(stage, analysisId) {
  const plots = [];
  
  try {
    // First, try to get plots from Analysis document if analysisId exists
    if (analysisId) {
      const analysis = await Analysis.findOne({ analysisId });
      if (analysis && analysis.plots && analysis.plots.length > 0) {
        for (const plot of analysis.plots) {
          if (plot.base64) {
            plots.push({
              base64: plot.base64,
              filename: plot.filename || 'analysis_plot.png',
              description: plot.description || 'Analysis visualization',
              mimeType: plot.mimeType || 'image/png'
            });
          }
        }
      }
    }
    
    // Also check stage.analysisResults for plots
    if (stage.analysisResults && typeof stage.analysisResults === 'object') {
      if (Array.isArray(stage.analysisResults.plots)) {
        for (const plot of stage.analysisResults.plots) {
          const plotData = plot.base64 || plot.data;
          if (plotData) {
            plots.push({
              base64: plotData,
              filename: plot.filename || plot.title || 'stage_plot.png',
              description: plot.description || plot.title || 'Stage visualization',
              mimeType: plot.mimeType || 'image/png'
            });
          }
        }
      }
    }
  } catch (error) {
    console.error('Error extracting stage plots:', error);
  }
  
  return plots;
}

// Helper function to calculate time saved
function calculateTimeSaved(stage, stageName) {
  if (!stage.startTime || !stage.endTime) {
    return {
      estimatedManualTime: 0,
      actualTime: 0,
      timeSaved: 0,
      percentageSaved: 0
    };
  }
  
  const actualTimeMs = new Date(stage.endTime) - new Date(stage.startTime);
  const actualTimeMinutes = actualTimeMs / (1000 * 60);
  
  // Industry-standard manual diagnostic time estimates (in minutes)
  const manualTimeRanges = {
    'inspection': { min: 30, max: 60 },
    'analysis-repair': { min: 45, max: 120 },
    'verification-testdriving': { min: 15, max: 30 }
  };
  
  const range = manualTimeRanges[stageName] || { min: 30, max: 60 };
  
  // Calculate complexity factors
  let complexityMultiplier = 1.0;
  
  // More DTCs = more complex
  if (stage.dtcScanResults && stage.dtcScanResults.length > 0) {
    complexityMultiplier += stage.dtcScanResults.length * 0.1;
  }
  
  // Advanced analysis = more complex
  if (stage.analysisResults && typeof stage.analysisResults === 'object') {
    if (stage.analysisResults.plots && stage.analysisResults.plots.length > 0) {
      complexityMultiplier += stage.analysisResults.plots.length * 0.15;
    }
    if (stage.analysisId) {
      complexityMultiplier += 0.2; // Advanced analysis adds complexity
    }
  }
  
  // Multiple live data sessions = more complex
  if (stage.liveDataSessionIds && stage.liveDataSessionIds.length > 1) {
    complexityMultiplier += (stage.liveDataSessionIds.length - 1) * 0.1;
  }
  
  // Calculate estimated manual time based on complexity
  const baseManualTime = (range.min + range.max) / 2;
  const estimatedManualTime = baseManualTime * Math.min(complexityMultiplier, 2.0); // Cap at 2x
  
  const timeSaved = Math.max(0, estimatedManualTime - actualTimeMinutes);
  const percentageSaved = estimatedManualTime > 0 
    ? (timeSaved / estimatedManualTime) * 100 
    : 0;
  
  return {
    estimatedManualTime: Math.round(estimatedManualTime * 10) / 10,
    actualTime: Math.round(actualTimeMinutes * 10) / 10,
    timeSaved: Math.round(timeSaved * 10) / 10,
    percentageSaved: Math.round(percentageSaved * 10) / 10
  };
}

// Helper function to determine next stage
function determineNextStage(stageName, ids) {
  const stageOrder = ['inspection', 'analysis-repair', 'verification-testdriving'];
  const currentIndex = stageOrder.indexOf(stageName);
  
  if (currentIndex === -1) {
    return null;
  }
  
  // If current stage is completed, return next stage
  const currentStage = ids.stages.find(s => s.stage === stageName);
  if (currentStage && currentStage.status === 'completed') {
    if (currentIndex < stageOrder.length - 1) {
      const nextStageName = stageOrder[currentIndex + 1];
      const nextStage = ids.stages.find(s => s.stage === nextStageName);
      
      return {
        stage: nextStageName,
        displayName: nextStageName === 'inspection' ? 'Inspection' :
                     nextStageName === 'analysis-repair' ? 'Analysis & Repair' :
                     'Verification & Test Driving',
        status: nextStage ? nextStage.status : 'not-started',
        description: nextStageName === 'inspection' ? 
          'Initial vehicle inspection and DTC scanning' :
          nextStageName === 'analysis-repair' ?
          'Detailed analysis of diagnostic data and repair recommendations' :
          'Verification of repairs and test driving validation'
      };
    } else {
      return {
        stage: 'completed',
        displayName: 'Session Complete',
        status: 'completed',
        description: 'All diagnostic stages have been completed'
      };
    }
  }
  
  return null;
}

// Helper function to build AI prompt for report generation
function buildStageReportPrompt(ids, stage, stageName, plots, timeSaved, nextStage) {
  const stageDisplayName = stageName === 'inspection' ? 'Inspection' :
                          stageName === 'analysis-repair' ? 'Analysis & Repair' :
                          'Verification & Test Driving';
  
  let prompt = `You are generating a comprehensive diagnostic stage report for an automotive Intelligent Diagnostic Session (IDS). 

## Your Task
Generate a professional, detailed markdown report for the ${stageDisplayName} stage. The report should be well-structured, informative, and suitable for automotive technicians and service managers.

## Required Report Sections

1. **Executive Summary** (2-3 paragraphs)
   - Brief overview of the stage activities
   - Key findings and outcomes
   - Overall stage status

2. **Stage Activity Details**
   - DTC codes found and analyzed (if any)
   - Freeze frame data summary (if available)
   - Readiness monitor status (if available)
   - Live data sessions conducted
   - Analysis performed and key insights

3. **Time Analysis**
   - Stage duration: ${timeSaved.actualTime} minutes
   - Estimated manual diagnostic time: ${timeSaved.estimatedManualTime} minutes
   - Time saved: ${timeSaved.timeSaved} minutes (${timeSaved.percentageSaved}% reduction)
   - Efficiency metrics and benefits

4. **Visualizations**
   - Reference and describe the provided analysis plots/visualizations
   - Explain what each visualization shows
   - Include insights from the visual data
   ${plots.length > 0 ? `- You have ${plots.length} visualization(s) available to reference` : '- No visualizations available for this stage'}

5. **Recommendations & Next Steps**
   ${nextStage ? `- Next stage: ${nextStage.displayName} (${nextStage.status})` : '- All stages completed'}
   ${nextStage ? `- ${nextStage.description}` : ''}
   - Recommended actions for the technician
   - Important considerations for the next phase

## Stage Data

**Vehicle Information:**
- Make: ${ids.vehicleInfo?.make || 'N/A'}
- Model: ${ids.vehicleInfo?.model || 'N/A'}
- Year: ${ids.vehicleInfo?.year || 'N/A'}
- VIN: ${ids.vin}
- Engine: ${ids.vehicleInfo?.engine || 'N/A'}
- Transmission: ${ids.vehicleInfo?.transmission || 'N/A'}

**Stage Information:**
- Stage: ${stageDisplayName}
- Status: ${stage.status}
- Start Time: ${stage.startTime ? new Date(stage.startTime).toLocaleString() : 'N/A'}
- End Time: ${stage.endTime ? new Date(stage.endTime).toLocaleString() : 'N/A'}
- Duration: ${timeSaved.actualTime} minutes

**DTC Codes:** ${stage.dtcScanResults && stage.dtcScanResults.length > 0 ? stage.dtcScanResults.join(', ') : 'None found'}

**Live Data Sessions:** ${stage.liveDataSessionIds ? stage.liveDataSessionIds.length : 0} session(s)

**Analysis Results:** ${stage.analysisResults ? (typeof stage.analysisResults === 'string' ? stage.analysisResults.substring(0, 500) + '...' : 'Available (see structured data)') : 'None'}

${stage.freezeFrameData && stage.freezeFrameData.length > 0 ? `**Freeze Frame Data:** ${stage.freezeFrameData.length} record(s) captured\n` : ''}
${stage.readinessMonitorStatus ? `**Readiness Monitors:** Status available\n` : ''}

${stage.metadata?.aiSteps && stage.metadata.aiSteps.length > 0 ? `**AI-Guided Steps:** ${stage.metadata.aiSteps.length} step(s) executed\n` : ''}
${stage.metadata?.workflowEvents && stage.metadata.workflowEvents.length > 0 ? `**Workflow Events:** ${stage.metadata.workflowEvents.length} event(s) recorded\n` : ''}

## Formatting Requirements

- Use proper markdown formatting
- Include headers (##) for major sections
- Use bullet points and lists where appropriate
- ${plots.length > 0 ? 'When referencing visualizations, describe them clearly and explain their significance. The plots are embedded as base64 images in the context.' : ''}
- Be professional and technical but accessible
- Focus on actionable insights for technicians
- Highlight time savings and efficiency gains

## Important Notes

- This report will be saved and displayed to technicians
- Emphasize the value of the automated diagnostic process
- Be specific about findings and recommendations
- Include any safety concerns or urgent issues if present

Generate the complete report now in markdown format:`;

  return prompt;
}

// Helper function to generate stage report (fallback - simple version)
function generateStageReport(ids, stage, stageName) {
  let report = `# ${stageName.charAt(0).toUpperCase() + stageName.slice(1).replace('-', ' ')} Stage Report\n\n`;
  report += `**Stage Status**: ${stage.status}\n`;
  report += `**Start Time**: ${stage.startTime ? new Date(stage.startTime).toLocaleString() : 'N/A'}\n`;
  report += `**End Time**: ${stage.endTime ? new Date(stage.endTime).toLocaleString() : 'N/A'}\n\n`;

  // Vehicle Information
  report += `## Vehicle Information\n\n`;
  report += `- **Make**: ${ids.vehicleInfo?.make || 'N/A'}\n`;
  report += `- **Model**: ${ids.vehicleInfo?.model || 'N/A'}\n`;
  report += `- **Year**: ${ids.vehicleInfo?.year || 'N/A'}\n`;
  report += `- **VIN**: ${ids.vin}\n\n`;

  // Stage-specific content
  if (stageName === 'inspection') {
    if (stage.dtcScanResults && stage.dtcScanResults.length > 0) {
      report += `## DTC Scan Results\n\n`;
      report += `Found ${stage.dtcScanResults.length} diagnostic trouble code(s):\n`;
      stage.dtcScanResults.forEach(dtc => {
        report += `- ${dtc}\n`;
      });
      report += `\n`;
    }

    if (stage.readinessMonitorStatus) {
      report += `## Readiness Monitor Status\n\n`;
      report += `\`\`\`json\n${JSON.stringify(stage.readinessMonitorStatus, null, 2)}\n\`\`\`\n\n`;
    }

    if (stage.freezeFrameData && stage.freezeFrameData.length > 0) {
      report += `## Freeze Frame Data\n\n`;
      report += `Captured ${stage.freezeFrameData.length} freeze frame record(s).\n\n`;
    }
  }

  // Live Data Sessions
  if (stage.liveDataSessionIds && stage.liveDataSessionIds.length > 0) {
    report += `## Live Data Sessions\n\n`;
    report += `This stage includes ${stage.liveDataSessionIds.length} live data session(s).\n\n`;
  }

  // Analysis Results
  if (stage.analysisResults) {
    report += `## Analysis Results\n\n`;
    if (typeof stage.analysisResults === 'string') {
      report += stage.analysisResults;
    } else {
      report += `\`\`\`json\n${JSON.stringify(stage.analysisResults, null, 2)}\n\`\`\`\n`;
    }
    report += `\n`;
  }

  // Notes
  if (stage.notes) {
    report += `## Notes\n\n${stage.notes}\n\n`;
  }

  return report;
}

// Helper function to generate complete IDS report
function generateCompleteReport(ids) {
  let report = `# Intelligent Diagnostic Session Report\n\n`;
  report += `**IDS ID**: ${ids.idsId}\n`;
  report += `**Status**: ${ids.overallStatus}\n`;
  report += `**Current Stage**: ${ids.currentStage}\n`;
  report += `**Created**: ${new Date(ids.createdAt).toLocaleString()}\n`;
  report += `**Last Updated**: ${new Date(ids.updatedAt).toLocaleString()}\n\n`;

  // Vehicle Information
  report += `## Vehicle Information\n\n`;
  report += `- **Make**: ${ids.vehicleInfo?.make || 'N/A'}\n`;
  report += `- **Model**: ${ids.vehicleInfo?.model || 'N/A'}\n`;
  report += `- **Year**: ${ids.vehicleInfo?.year || 'N/A'}\n`;
  report += `- **VIN**: ${ids.vin}\n`;
  report += `- **Engine**: ${ids.vehicleInfo?.engine || 'N/A'}\n`;
  report += `- **Transmission**: ${ids.vehicleInfo?.transmission || 'N/A'}\n`;
  report += `- **Fuel Type**: ${ids.vehicleInfo?.fuelType || 'N/A'}\n\n`;

  // Stage Reports
  report += `## Stage Reports\n\n`;
  
  ids.stages.forEach(stage => {
    if (stage.stageReport) {
      report += stage.stageReport;
      report += `\n---\n\n`;
    } else {
      report += `### ${stage.stage.charAt(0).toUpperCase() + stage.stage.slice(1).replace('-', ' ')} Stage\n\n`;
      report += `**Status**: ${stage.status}\n\n`;
    }
  });

  // Summary
  report += `## Summary\n\n`;
  const completedStages = ids.stages.filter(s => s.status === 'completed').length;
  report += `- **Total Stages**: ${ids.stages.length}\n`;
  report += `- **Completed Stages**: ${completedStages}\n`;
  report += `- **Total Live Data Sessions**: ${ids.linkedLiveDataSessions?.length || 0}\n\n`;

  return report;
}

export default router;

