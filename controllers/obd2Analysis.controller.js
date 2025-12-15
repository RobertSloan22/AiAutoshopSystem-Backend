import obd2AnalysisService from '../services/obd2AnalysisService.js';
import OBD2Data from '../models/obd2Data.model.js';

/**
 * OBD2 Analysis Controller
 * 
 * Provides API endpoints for triggering and retrieving analysis results
 * for recorded OBD2 sessions using the agentic analysis system.
 */

/**
 * Analyze a complete OBD2 session
 * POST /api/obd2/sessions/:sessionId/analyze
 */
export const analyzeSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { analysisType = 'comprehensive', options = {} } = req.body;
    const userId = req.user._id;

    // Validate session exists and user has access
    const session = await OBD2Data.findOne({ sessionId, userId });
    if (!session) {
      return res.status(404).json({ 
        error: 'Session not found or access denied' 
      });
    }

    // Check if session has sufficient data
    if (session.parameters.length < 10) {
      return res.status(400).json({
        error: 'Insufficient data for analysis',
        details: 'Session must have at least 10 data points for meaningful analysis',
        currentDataPoints: session.parameters.length
      });
    }

    // Trigger analysis
    const analysisResult = await obd2AnalysisService.analyzeSession(
      sessionId, 
      userId, 
      { analysisType, ...options }
    );

    res.json({
      success: true,
      message: 'Session analysis completed successfully',
      data: analysisResult
    });

  } catch (error) {
    console.error('Error analyzing session:', error);
    res.status(500).json({ 
      error: 'Failed to analyze session', 
      details: error.message 
    });
  }
};

/**
 * Get analysis results for a session
 * GET /api/obd2/sessions/:sessionId/analysis
 */
export const getAnalysisResults = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user._id;

    const results = await obd2AnalysisService.getAnalysisResults(sessionId, userId);

    res.json({
      success: true,
      data: results
    });

  } catch (error) {
    console.error('Error getting analysis results:', error);
    res.status(500).json({ 
      error: 'Failed to get analysis results', 
      details: error.message 
    });
  }
};

/**
 * Analyze specific parameters for a session
 * POST /api/obd2/sessions/:sessionId/analyze-parameters
 */
export const analyzeParameters = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { parameters, analysisOptions = {} } = req.body;
    const userId = req.user._id;

    if (!parameters || !Array.isArray(parameters) || parameters.length === 0) {
      return res.status(400).json({
        error: 'Invalid parameters',
        details: 'Parameters must be a non-empty array of parameter IDs or names'
      });
    }

    const analysisResult = await obd2AnalysisService.analyzeParameters(
      sessionId, 
      userId, 
      parameters
    );

    res.json({
      success: true,
      message: 'Parameter analysis completed successfully',
      data: analysisResult
    });

  } catch (error) {
    console.error('Error analyzing parameters:', error);
    res.status(500).json({ 
      error: 'Failed to analyze parameters', 
      details: error.message 
    });
  }
};

/**
 * Get analysis summary for a vehicle
 * GET /api/obd2/vehicles/:vehicleId/analysis-summary
 */
export const getVehicleAnalysisSummary = async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const { limit = 10, startDate, endDate } = req.query;
    const userId = req.user._id;

    // Build query
    const query = { vehicleId, userId };
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Get recent sessions with analysis results
    const sessions = await OBD2Data.find(query)
      .select('sessionId analysisResults processingStatus createdAt dataCollectionStart dataCollectionEnd')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    // Compile summary
    const summary = {
      vehicleId,
      totalSessions: sessions.length,
      analyzedSessions: sessions.filter(s => s.analysisResults.length > 0).length,
      recentAnalysis: [],
      overallHealth: 'unknown',
      criticalIssues: [],
      recommendations: []
    };

    // Process recent analysis results
    sessions.forEach(session => {
      if (session.analysisResults.length > 0) {
        const latestAnalysis = session.analysisResults[session.analysisResults.length - 1];
        summary.recentAnalysis.push({
          sessionId: session.sessionId,
          analysisType: latestAnalysis.analysisType,
          confidence: latestAnalysis.confidence,
          generatedAt: latestAnalysis.generatedAt,
          processingTime: latestAnalysis.processingTime
        });

        // Aggregate critical issues and recommendations
        if (latestAnalysis.result && latestAnalysis.result.summary) {
          if (latestAnalysis.result.summary.criticalIssues) {
            summary.criticalIssues.push(...latestAnalysis.result.summary.criticalIssues);
          }
          if (latestAnalysis.result.summary.recommendations) {
            summary.recommendations.push(...latestAnalysis.result.summary.recommendations);
          }
        }
      }
    });

    // Determine overall health
    const criticalCount = summary.criticalIssues.length;
    if (criticalCount === 0) {
      summary.overallHealth = 'excellent';
    } else if (criticalCount <= 2) {
      summary.overallHealth = 'good';
    } else if (criticalCount <= 5) {
      summary.overallHealth = 'fair';
    } else {
      summary.overallHealth = 'poor';
    }

    res.json({
      success: true,
      data: summary
    });

  } catch (error) {
    console.error('Error getting vehicle analysis summary:', error);
    res.status(500).json({ 
      error: 'Failed to get vehicle analysis summary', 
      details: error.message 
    });
  }
};

/**
 * Get detailed analysis for a specific analysis result
 * GET /api/obd2/sessions/:sessionId/analysis/:analysisId
 */
export const getDetailedAnalysis = async (req, res) => {
  try {
    const { sessionId, analysisId } = req.params;
    const userId = req.user._id;

    const session = await OBD2Data.findOne({ sessionId, userId });
    if (!session) {
      return res.status(404).json({ 
        error: 'Session not found or access denied' 
      });
    }

    const analysis = session.analysisResults.find(a => 
      a._id.toString() === analysisId || a.analysisId === analysisId
    );

    if (!analysis) {
      return res.status(404).json({ 
        error: 'Analysis result not found' 
      });
    }

    res.json({
      success: true,
      data: {
        sessionId,
        analysisId,
        analysis
      }
    });

  } catch (error) {
    console.error('Error getting detailed analysis:', error);
    res.status(500).json({ 
      error: 'Failed to get detailed analysis', 
      details: error.message 
    });
  }
};

/**
 * Export analysis results
 * GET /api/obd2/sessions/:sessionId/analysis/export
 */
export const exportAnalysisResults = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { format = 'json' } = req.query;
    const userId = req.user._id;

    const results = await obd2AnalysisService.getAnalysisResults(sessionId, userId);

    if (format === 'csv') {
      // Convert to CSV format
      const csv = convertAnalysisToCSV(results);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=analysis_${sessionId}.csv`);
      res.send(csv);
    } else {
      // Return JSON
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=analysis_${sessionId}.json`);
      res.json({
        success: true,
        exportDate: new Date(),
        sessionId,
        data: results
      });
    }

  } catch (error) {
    console.error('Error exporting analysis results:', error);
    res.status(500).json({ 
      error: 'Failed to export analysis results', 
      details: error.message 
    });
  }
};

/**
 * Get analysis statistics
 * GET /api/obd2/analysis/statistics
 */
export const getAnalysisStatistics = async (req, res) => {
  try {
    const { startDate, endDate, vehicleId } = req.query;
    const userId = req.user._id;

    // Build query
    const query = { userId };
    if (vehicleId) query.vehicleId = vehicleId;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Get analysis statistics
    const stats = await OBD2Data.aggregate([
      { $match: query },
      {
        $project: {
          hasAnalysis: { $gt: [{ $size: '$analysisResults' }, 0] },
          analysisCount: { $size: '$analysisResults' },
          processingStatus: 1,
          createdAt: 1
        }
      },
      {
        $group: {
          _id: null,
          totalSessions: { $sum: 1 },
          analyzedSessions: { $sum: { $cond: ['$hasAnalysis', 1, 0] } },
          totalAnalyses: { $sum: '$analysisCount' },
          processingStatus: {
            $push: {
              status: '$processingStatus',
              date: '$createdAt'
            }
          }
        }
      }
    ]);

    const result = stats[0] || {
      totalSessions: 0,
      analyzedSessions: 0,
      totalAnalyses: 0,
      processingStatus: []
    };

    // Calculate success rate
    const processingStatuses = result.processingStatus || [];
    const completed = processingStatuses.filter(s => s.status === 'completed').length;
    const failed = processingStatuses.filter(s => s.status === 'failed').length;
    const successRate = processingStatuses.length > 0 ? 
      completed / processingStatuses.length : 0;

    res.json({
      success: true,
      data: {
        ...result,
        successRate,
        analysisRate: result.totalSessions > 0 ? 
          result.analyzedSessions / result.totalSessions : 0,
        averageAnalysesPerSession: result.analyzedSessions > 0 ? 
          result.totalAnalyses / result.analyzedSessions : 0
      }
    });

  } catch (error) {
    console.error('Error getting analysis statistics:', error);
    res.status(500).json({ 
      error: 'Failed to get analysis statistics', 
      details: error.message 
    });
  }
};

/**
 * Helper function to convert analysis results to CSV
 */
const convertAnalysisToCSV = (results) => {
  const headers = [
    'Session ID',
    'Analysis Type',
    'Confidence',
    'Generated At',
    'Processing Time',
    'Overall Health',
    'Critical Issues Count',
    'Recommendations Count'
  ];

  const rows = [];
  
  if (results.analysisResults) {
    results.analysisResults.forEach(analysis => {
      const row = [
        results.sessionId,
        analysis.analysisType,
        analysis.confidence || 0,
        analysis.generatedAt || '',
        analysis.processingTime || 0,
        analysis.result?.summary?.overallHealth || 'unknown',
        analysis.result?.summary?.criticalIssues?.length || 0,
        analysis.result?.summary?.recommendations?.length || 0
      ];
      rows.push(row);
    });
  }

  return [headers, ...rows].map(row => row.join(',')).join('\n');
};
