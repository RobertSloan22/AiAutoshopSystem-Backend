import mongoose from 'mongoose';
import DiagnosticSession from '../models/diagnosticSession.model.js';

/**
 * OBD2 Data Access Service for Responses API
 * Provides tool access to OBD2 session data for AI analysis
 */
class OBD2DataAccessService {
  constructor() {
    // Access models that are registered in obd2.routes.js
    // These models are created when the routes file loads
    this.DiagnosticSession = DiagnosticSession;
  }

  // Get OBD2DataPoint model dynamically (it's registered in obd2.routes.js)
  get OBD2DataPoint() {
    const model = mongoose.models.OBD2DataPoint || mongoose.connection.models.OBD2DataPoint;
    if (!model) {
      throw new Error('OBD2DataPoint model not found. Make sure obd2.routes.js is loaded first.');
    }
    return model;
  }

  /**
   * Get tool definition for OpenAI Responses API
   */
  getToolDefinition() {
    return {
      type: 'function',
      function: {
        name: 'get_obd2_session_data',
        description: 'Retrieve OBD2 diagnostic session summary including statistics, DTCs, and metadata. Returns aggregated statistics rather than raw data points to avoid context overflow. Use Python tool with this data to create visualizations.',
        parameters: {
          type: 'object',
          properties: {
            sessionId: {
              type: 'string',
              description: 'The MongoDB ObjectId of the OBD2 diagnostic session (24-character hex string)'
            },
            includeSampleData: {
              type: 'boolean',
              description: 'Whether to include a small sample of data points (max 50) for reference. Default false to keep context small.',
              default: false
            }
          },
          required: ['sessionId']
        }
      }
    };
  }

  /**
   * Execute the tool - retrieve OBD2 session data
   */
  async executeTool(toolName, parameters) {
    if (toolName !== 'get_obd2_session_data') {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    try {
      const { sessionId, includeSampleData = false } = parameters;

      // Validate sessionId format
      if (!sessionId || !mongoose.Types.ObjectId.isValid(sessionId)) {
        return {
          success: false,
          error: 'Invalid session ID format. Must be a 24-character MongoDB ObjectId hex string.',
          sessionId
        };
      }

      console.log(`📊 OBD2 DATA ACCESS: Fetching session ${sessionId} (summary mode)`);

      // Get session metadata
      const session = await this.DiagnosticSession.findById(sessionId).lean();
      if (!session) {
        return {
          success: false,
          error: 'Session not found',
          sessionId
        };
      }

      const result = {
        success: true,
        sessionId: session._id.toString(),
        sessionInfo: {
          sessionName: session.sessionName,
          startTime: session.startTime,
          endTime: session.endTime,
          duration: session.duration,
          status: session.status,
          dataPointCount: session.dataPointCount || 0,
          vehicleInfo: session.vehicleInfo || {},
          dtcCodes: session.dtcCodes || [],
          selectedPids: session.selectedPids || [],
          affectedSystems: session.affectedSystems,
          focusAreas: session.focusAreas || [],
          tags: session.tags || []
        }
      };

      // Calculate comprehensive statistics if data exists
      if (session.dataPointCount > 0) {
        console.log(`📊 OBD2 DATA ACCESS: Calculating statistics for ${session.dataPointCount} data points`);

        // Fetch ALL data points to calculate accurate statistics
        const allDataPoints = await this.OBD2DataPoint.find({
          sessionId: new mongoose.Types.ObjectId(sessionId)
        })
          .sort({ timestamp: 1 })
          .lean();

        // Get available parameters from data
        const availableParams = new Set();
        allDataPoints.forEach(dp => {
          Object.keys(dp).forEach(key => {
            if (!['_id', 'sessionId', 'timestamp', 'createdAt', 'updatedAt', '__v', 'rawData'].includes(key)) {
              if (dp[key] !== null && dp[key] !== undefined) {
                availableParams.add(key);
              }
            }
          });
        });

        result.availableParameters = Array.from(availableParams);
        result.statistics = this.calculateStatistics(allDataPoints);

        // Include small sample of data points if requested (for context)
        if (includeSampleData) {
          const sampleSize = Math.min(50, allDataPoints.length);
          const step = Math.max(1, Math.floor(allDataPoints.length / sampleSize));
          result.sampleDataPoints = allDataPoints.filter((_, index) => index % step === 0).slice(0, sampleSize);
          result.sampleDataPointsCount = result.sampleDataPoints.length;
        }

        result.dataAnalysisNote = 'Full data access available via Python code. Use execute_python_code tool to query MongoDB directly for detailed analysis and visualizations.';
      }

      // Include auto-analysis summary if available (without plots to save tokens)
      if (session.autoAnalysis) {
        result.autoAnalysis = {
          status: session.autoAnalysis.status,
          hasSummary: !!session.autoAnalysis.result,
          hasPlots: session.autoAnalysis.plots?.length > 0,
          plotCount: session.autoAnalysis.plots?.length || 0,
          completedAt: session.autoAnalysis.completedAt,
          summary: session.autoAnalysis.result ?
            session.autoAnalysis.result.substring(0, 500) + '...' : // Truncate to first 500 chars
            null
        };
      }

      console.log(`✅ OBD2 DATA ACCESS: Retrieved summary with ${result.availableParameters?.length || 0} parameters`);

      return result;

    } catch (error) {
      console.error('❌ OBD2 DATA ACCESS ERROR:', error);
      return {
        success: false,
        error: error.message,
        tool: 'get_obd2_session_data'
      };
    }
  }

  /**
   * Calculate summary statistics for common parameters
   */
  calculateStatistics(dataPoints) {
    if (!dataPoints || dataPoints.length === 0) return {};

    const stats = {};
    const params = ['rpm', 'speed', 'engineTemp', 'throttlePosition', 'engineLoad', 'maf', 'map', 'batteryVoltage'];

    params.forEach(param => {
      const values = dataPoints
        .map(dp => dp[param])
        .filter(v => v !== null && v !== undefined && !isNaN(v) && isFinite(v));

      if (values.length > 0) {
        stats[param] = {
          min: Math.min(...values),
          max: Math.max(...values),
          avg: values.reduce((a, b) => a + b, 0) / values.length,
          count: values.length
        };
      }
    });

    return stats;
  }
}

export default OBD2DataAccessService;
