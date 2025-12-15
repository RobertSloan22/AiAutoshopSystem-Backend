import express from 'express';
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
    logRequest('POST', '/api/ids', req.body);
    
    const {
      userId,
      vehicleId,
      vin,
      vehicleInfo
    } = req.body;

    if (!vin) {
      return res.status(400).json({ error: 'VIN is required' });
    }

    // Check if there's an active IDS for this vehicle
    const existingIDS = await IntelligentDiagnosticSession.findMostRecentForVehicle(vin);
    
    if (existingIDS && existingIDS.overallStatus === 'active') {
      logRequest('GET', '/api/ids', { message: 'Returning existing active IDS', idsId: existingIDS.idsId });
      return res.json({
        success: true,
        ids: existingIDS,
        isNew: false
      });
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

// Get IDS by ID
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

// Get all IDS entries for a vehicle
router.get('/vehicle/:vin/all', async (req, res) => {
  try {
    const { vin } = req.params;
    logRequest('GET', `/api/ids/vehicle/${vin}/all`);

    const allIDS = await IntelligentDiagnosticSession.find({ vin })
      .sort({ createdAt: -1 })
      .populate('linkedLiveDataSessions')
      .populate('stages.liveDataSessionIds');

    res.json({
      success: true,
      idsList: allIDS,
      count: allIDS.length
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
    logRequest('PUT', `/api/ids/${idsId}/stage/${stageName}/start`);

    const validStages = ['inspection', 'analysis-repair', 'verification-testdriving'];
    if (!validStages.includes(stageName)) {
      return res.status(400).json({ error: 'Invalid stage name' });
    }

    const ids = await IntelligentDiagnosticSession.findOne({ idsId });
    if (!ids) {
      return res.status(404).json({ error: 'IDS not found' });
    }

    // Update or create stage
    await ids.updateStage(stageName, {
      status: 'in-progress',
      startTime: new Date()
    });

    // Update current stage
    ids.currentStage = stageName;
    await ids.save();

    res.json({
      success: true,
      ids,
      stage: ids.getStage(stageName)
    });
  } catch (error) {
    console.error('❌ Failed to start stage:', error);
    res.status(500).json({ error: 'Failed to start stage', message: error.message });
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
    await ids.save();

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

    // Generate report (simplified - can be enhanced with report service)
    const report = generateStageReport(ids, stage, stageName);

    // Save report to stage
    await ids.updateStage(stageName, { stageReport: report });
    await ids.save();

    res.json({
      success: true,
      report,
      stage: ids.getStage(stageName)
    });
  } catch (error) {
    console.error('❌ Failed to generate stage report:', error);
    res.status(500).json({ error: 'Failed to generate stage report', message: error.message });
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

// Helper function to generate stage report
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

