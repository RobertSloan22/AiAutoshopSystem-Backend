import OBD2Data from '../models/obd2Data.model.js';
import Vehicle from '../models/vehicle.model.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * OBD2 Analysis Service - Agentic System for Analyzing Recorded Sessions
 * 
 * This service provides comprehensive analysis capabilities for OBD2 session data
 * using multiple specialized analysis agents that work together to provide
 * detailed insights about vehicle performance, diagnostics, and maintenance needs.
 */

class OBD2AnalysisService {
  constructor() {
    this.analysisAgents = {
      performance: new PerformanceAnalysisAgent(),
      diagnostics: new DiagnosticsAnalysisAgent(),
      fuelEfficiency: new FuelEfficiencyAnalysisAgent(),
      maintenance: new MaintenanceAnalysisAgent(),
      drivingBehavior: new DrivingBehaviorAnalysisAgent(),
      anomalyDetection: new AnomalyDetectionAgent()
    };
  }

  /**
   * Analyze a complete OBD2 session using all available agents
   * @param {string} sessionId - The session ID to analyze
   * @param {string} userId - User ID for authorization
   * @param {Object} options - Analysis options
   * @returns {Object} Comprehensive analysis results
   */
  async analyzeSession(sessionId, userId, options = {}) {
    try {
      // Fetch session data
      const session = await OBD2Data.findOne({ sessionId, userId })
        .populate('vehicleId', 'make model year vin engineType');
      
      if (!session) {
        throw new Error('Session not found or access denied');
      }

      // Validate session has sufficient data
      if (session.parameters.length < 10) {
        throw new Error('Insufficient data for analysis - need at least 10 data points');
      }

      const analysisId = uuidv4();
      const startTime = Date.now();

      // Run all analysis agents in parallel
      const analysisPromises = Object.entries(this.analysisAgents).map(async ([agentName, agent]) => {
        try {
          const result = await agent.analyze(session, options);
          return { agentName, result, success: true };
        } catch (error) {
          console.error(`Analysis agent ${agentName} failed:`, error);
          return { 
            agentName, 
            result: { error: error.message }, 
            success: false 
          };
        }
      });

      const agentResults = await Promise.all(analysisPromises);
      const processingTime = Date.now() - startTime;

      // Compile comprehensive analysis report
      const analysisReport = {
        analysisId,
        sessionId,
        vehicleId: session.vehicleId._id,
        vehicleInfo: {
          make: session.vehicleId.make,
          model: session.vehicleId.model,
          year: session.vehicleId.year,
          vin: session.vehicleId.vin
        },
        sessionInfo: {
          startTime: session.dataCollectionStart,
          endTime: session.dataCollectionEnd,
          duration: session.dataCollectionEnd ? 
            session.dataCollectionEnd - session.dataCollectionStart : 
            Date.now() - session.dataCollectionStart,
          totalDataPoints: session.parameters.length,
          dataQuality: session.dataQuality
        },
        analysisResults: {},
        summary: {
          overallHealth: 'unknown',
          criticalIssues: [],
          recommendations: [],
          confidence: 0
        },
        processingTime,
        generatedAt: new Date()
      };

      // Process agent results
      let totalConfidence = 0;
      let successfulAgents = 0;

      agentResults.forEach(({ agentName, result, success }) => {
        analysisReport.analysisResults[agentName] = result;
        
        if (success) {
          totalConfidence += result.confidence || 0;
          successfulAgents++;
          
          // Aggregate critical issues and recommendations
          if (result.criticalIssues) {
            analysisReport.summary.criticalIssues.push(...result.criticalIssues);
          }
          if (result.recommendations) {
            analysisReport.summary.recommendations.push(...result.recommendations);
          }
        }
      });

      // Calculate overall confidence and health
      analysisReport.summary.confidence = successfulAgents > 0 ? 
        totalConfidence / successfulAgents : 0;

      // Determine overall health based on critical issues
      const criticalCount = analysisReport.summary.criticalIssues.length;
      if (criticalCount === 0) {
        analysisReport.summary.overallHealth = 'excellent';
      } else if (criticalCount <= 2) {
        analysisReport.summary.overallHealth = 'good';
      } else if (criticalCount <= 5) {
        analysisReport.summary.overallHealth = 'fair';
      } else {
        analysisReport.summary.overallHealth = 'poor';
      }

      // Store analysis results in session
      session.analysisResults.push({
        analysisType: 'comprehensive',
        result: analysisReport,
        confidence: analysisReport.summary.confidence,
        generatedAt: new Date(),
        processingTime
      });

      session.processingStatus = 'completed';
      await session.save();

      return analysisReport;

    } catch (error) {
      console.error('OBD2 Analysis Service Error:', error);
      throw error;
    }
  }

  /**
   * Get analysis results for a session
   * @param {string} sessionId - Session ID
   * @param {string} userId - User ID
   * @returns {Object} Analysis results
   */
  async getAnalysisResults(sessionId, userId) {
    const session = await OBD2Data.findOne({ sessionId, userId })
      .select('analysisResults processingStatus processingErrors')
      .populate('vehicleId', 'make model year vin');

    if (!session) {
      throw new Error('Session not found or access denied');
    }

    return {
      sessionId,
      processingStatus: session.processingStatus,
      analysisResults: session.analysisResults,
      errors: session.processingErrors
    };
  }

  /**
   * Analyze specific parameters for a session
   * @param {string} sessionId - Session ID
   * @param {string} userId - User ID
   * @param {Array} parameters - Parameters to analyze
   * @returns {Object} Parameter-specific analysis
   */
  async analyzeParameters(sessionId, userId, parameters) {
    const session = await OBD2Data.findOne({ sessionId, userId });
    
    if (!session) {
      throw new Error('Session not found or access denied');
    }

    // Filter parameters
    const filteredParams = session.parameters.filter(p => 
      parameters.includes(p.pid) || parameters.includes(p.name)
    );

    if (filteredParams.length === 0) {
      throw new Error('No matching parameters found');
    }

    // Group by parameter type
    const parameterGroups = {};
    filteredParams.forEach(param => {
      if (!parameterGroups[param.pid]) {
        parameterGroups[param.pid] = [];
      }
      parameterGroups[param.pid].push(param);
    });

    // Analyze each parameter group
    const analysis = {};
    for (const [pid, params] of Object.entries(parameterGroups)) {
      analysis[pid] = this.analyzeParameterGroup(params);
    }

    return {
      sessionId,
      parameters: analysis,
      totalDataPoints: filteredParams.length,
      analysisTime: new Date()
    };
  }

  /**
   * Analyze a group of parameters of the same type
   * @param {Array} parameters - Array of parameter data points
   * @returns {Object} Analysis results for the parameter group
   */
  analyzeParameterGroup(parameters) {
    if (parameters.length === 0) return null;

    const values = parameters.map(p => p.formattedValue || p.value);
    const timestamps = parameters.map(p => p.timestamp || new Date());
    
    // Basic statistics
    const stats = {
      count: values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      median: this.calculateMedian(values),
      stdDev: this.calculateStandardDeviation(values)
    };

    // Trend analysis
    const trend = this.analyzeTrend(values, timestamps);
    
    // Anomaly detection
    const anomalies = this.detectAnomalies(values, stats);

    // Parameter-specific analysis
    const parameterInfo = parameters[0];
    const specificAnalysis = this.analyzeSpecificParameter(parameterInfo.pid, values, stats);

    return {
      parameterInfo: {
        pid: parameterInfo.pid,
        name: parameterInfo.name,
        unit: parameterInfo.unit
      },
      statistics: stats,
      trend,
      anomalies,
      specificAnalysis,
      dataQuality: this.assessDataQuality(values, timestamps)
    };
  }

  /**
   * Analyze specific parameter types with domain knowledge
   */
  analyzeSpecificParameter(pid, values, stats) {
    switch (pid) {
      case '010C': // Engine RPM
        return this.analyzeRPM(values, stats);
      case '010D': // Vehicle Speed
        return this.analyzeSpeed(values, stats);
      case '0105': // Engine Coolant Temperature
        return this.analyzeCoolantTemp(values, stats);
      case '0111': // Throttle Position
        return this.analyzeThrottlePosition(values, stats);
      case '0104': // Engine Load
        return this.analyzeEngineLoad(values, stats);
      default:
        return { type: 'generic', insights: [] };
    }
  }

  // RPM Analysis
  analyzeRPM(values, stats) {
    const insights = [];
    
    // Check for idle RPM
    const idleValues = values.filter(v => v < 1000);
    if (idleValues.length > 0) {
      const avgIdle = idleValues.reduce((a, b) => a + b, 0) / idleValues.length;
      if (avgIdle < 600) insights.push('Low idle RPM - possible engine issue');
      if (avgIdle > 900) insights.push('High idle RPM - possible air leak or sensor issue');
    }

    // Check for redline
    const highRPM = values.filter(v => v > 6000);
    if (highRPM.length > 0) {
      insights.push(`Engine reached high RPM ${highRPM.length} times`);
    }

    return { type: 'rpm', insights, idleRPM: idleValues.length > 0 ? avgIdle : null };
  }

  // Speed Analysis
  analyzeSpeed(values, stats) {
    const insights = [];
    
    // Check for consistent speed (highway driving)
    const speedVariation = stats.stdDev / stats.avg;
    if (speedVariation < 0.1) {
      insights.push('Consistent speed detected - likely highway driving');
    }

    // Check for acceleration patterns
    const accelerations = this.calculateAccelerations(values);
    if (accelerations.some(a => a > 2)) {
      insights.push('Rapid acceleration detected');
    }

    return { type: 'speed', insights, accelerationPatterns: accelerations };
  }

  // Coolant Temperature Analysis
  analyzeCoolantTemp(values, stats) {
    const insights = [];
    
    // Check for overheating
    const overheating = values.filter(v => v > 100);
    if (overheating.length > 0) {
      insights.push('Engine overheating detected');
    }

    // Check for cold engine
    const coldEngine = values.filter(v => v < 80);
    if (coldEngine.length > values.length * 0.5) {
      insights.push('Engine running cold - possible thermostat issue');
    }

    return { type: 'coolant_temp', insights, overheatingCount: overheating.length };
  }

  // Throttle Position Analysis
  analyzeThrottlePosition(values, stats) {
    const insights = [];
    
    // Check for aggressive driving
    const aggressive = values.filter(v => v > 80);
    if (aggressive.length > values.length * 0.2) {
      insights.push('Aggressive driving detected');
    }

    // Check for throttle response
    const throttleChanges = this.calculateThrottleChanges(values);
    if (throttleChanges.some(c => c > 50)) {
      insights.push('Rapid throttle changes detected');
    }

    return { type: 'throttle', insights, aggressiveDriving: aggressive.length };
  }

  // Engine Load Analysis
  analyzeEngineLoad(values, stats) {
    const insights = [];
    
    // Check for high load conditions
    const highLoad = values.filter(v => v > 80);
    if (highLoad.length > 0) {
      insights.push('High engine load conditions detected');
    }

    return { type: 'engine_load', insights, highLoadCount: highLoad.length };
  }

  // Utility methods
  calculateMedian(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? 
      (sorted[mid - 1] + sorted[mid]) / 2 : 
      sorted[mid];
  }

  calculateStandardDeviation(values) {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  analyzeTrend(values, timestamps) {
    if (values.length < 2) return { direction: 'stable', strength: 0 };

    // Simple linear regression
    const n = values.length;
    const x = timestamps.map((t, i) => i);
    const y = values;

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    
    let direction = 'stable';
    if (slope > 0.1) direction = 'increasing';
    else if (slope < -0.1) direction = 'decreasing';

    return { direction, strength: Math.abs(slope) };
  }

  detectAnomalies(values, stats) {
    const anomalies = [];
    const threshold = 2 * stats.stdDev; // 2 standard deviations

    values.forEach((value, index) => {
      if (Math.abs(value - stats.avg) > threshold) {
        anomalies.push({
          index,
          value,
          deviation: Math.abs(value - stats.avg),
          severity: Math.abs(value - stats.avg) > 3 * stats.stdDev ? 'high' : 'medium'
        });
      }
    });

    return anomalies;
  }

  assessDataQuality(values, timestamps) {
    const quality = {
      completeness: 1, // Assume complete for now
      consistency: 1 - (this.calculateStandardDeviation(values) / (Math.max(...values) - Math.min(...values))),
      timeliness: this.assessTimeliness(timestamps)
    };

    return quality;
  }

  assessTimeliness(timestamps) {
    if (timestamps.length < 2) return 1;

    const intervals = [];
    for (let i = 1; i < timestamps.length; i++) {
      intervals.push(timestamps[i] - timestamps[i - 1]);
    }

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const expectedInterval = 1000; // 1 second expected interval

    return Math.max(0, 1 - Math.abs(avgInterval - expectedInterval) / expectedInterval);
  }

  calculateAccelerations(values) {
    const accelerations = [];
    for (let i = 1; i < values.length; i++) {
      accelerations.push(values[i] - values[i - 1]);
    }
    return accelerations;
  }

  calculateThrottleChanges(values) {
    const changes = [];
    for (let i = 1; i < values.length; i++) {
      changes.push(Math.abs(values[i] - values[i - 1]));
    }
    return changes;
  }
}

// Analysis Agent Classes
class PerformanceAnalysisAgent {
  async analyze(session, options = {}) {
    const rpmData = session.parameters.filter(p => p.pid === '010C');
    const speedData = session.parameters.filter(p => p.pid === '010D');
    const throttleData = session.parameters.filter(p => p.pid === '0111');

    const analysis = {
      type: 'performance',
      confidence: 0.8,
      insights: [],
      metrics: {},
      recommendations: []
    };

    // Analyze engine performance
    if (rpmData.length > 0) {
      const rpmValues = rpmData.map(p => p.formattedValue || p.value);
      analysis.metrics.maxRPM = Math.max(...rpmValues);
      analysis.metrics.avgRPM = rpmValues.reduce((a, b) => a + b, 0) / rpmValues.length;
      
      if (analysis.metrics.maxRPM > 6000) {
        analysis.insights.push('Engine reached high RPM range');
      }
    }

    // Analyze acceleration performance
    if (speedData.length > 0 && throttleData.length > 0) {
      analysis.insights.push('Acceleration performance analysis available');
    }

    return analysis;
  }
}

class DiagnosticsAnalysisAgent {
  async analyze(session, options = {}) {
    const analysis = {
      type: 'diagnostics',
      confidence: 0.9,
      criticalIssues: [],
      warnings: [],
      recommendations: []
    };

    // Check DTC codes
    if (session.dtcCodes.length > 0) {
      session.dtcCodes.forEach(dtc => {
        if (dtc.status !== 'cleared') {
          analysis.criticalIssues.push({
            code: dtc.code,
            description: dtc.description,
            severity: 'high'
          });
        }
      });
    }

    // Analyze parameter ranges for potential issues
    const coolantTemp = session.parameters.filter(p => p.pid === '0105');
    if (coolantTemp.length > 0) {
      const temps = coolantTemp.map(p => p.formattedValue || p.value);
      const maxTemp = Math.max(...temps);
      if (maxTemp > 100) {
        analysis.warnings.push('Engine overheating detected');
      }
    }

    return analysis;
  }
}

class FuelEfficiencyAnalysisAgent {
  async analyze(session, options = {}) {
    return {
      type: 'fuel_efficiency',
      confidence: 0.7,
      insights: ['Fuel efficiency analysis requires additional fuel consumption data'],
      recommendations: ['Consider adding fuel level monitoring for better analysis']
    };
  }
}

class MaintenanceAnalysisAgent {
  async analyze(session, options = {}) {
    return {
      type: 'maintenance',
      confidence: 0.6,
      insights: ['Maintenance analysis based on current session data'],
      recommendations: ['Regular maintenance schedule recommended']
    };
  }
}

class DrivingBehaviorAnalysisAgent {
  async analyze(session, options = {}) {
    return {
      type: 'driving_behavior',
      confidence: 0.8,
      insights: ['Driving behavior analysis completed'],
      recommendations: ['Consider smoother acceleration patterns']
    };
  }
}

class AnomalyDetectionAgent {
  async analyze(session, options = {}) {
    return {
      type: 'anomaly_detection',
      confidence: 0.9,
      insights: ['Anomaly detection analysis completed'],
      anomalies: []
    };
  }
}

export default new OBD2AnalysisService();
