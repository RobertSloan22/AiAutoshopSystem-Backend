import EventEmitter from 'events';
import obd2AnalysisService from './obd2AnalysisService.js';

/**
 * Real-Time Analysis Service
 * 
 * Provides real-time analysis capabilities for live OBD2 sessions
 * using streaming data analysis and continuous monitoring.
 */

class RealTimeAnalysisService extends EventEmitter {
  constructor() {
    super();
    this.activeSessions = new Map();
    this.analysisIntervals = new Map();
    this.config = {
      analysisInterval: 30000, // 30 seconds
      minDataPoints: 10,
      anomalyThreshold: 2.0,
      performanceWindow: 300000 // 5 minutes
    };
  }

  /**
   * Start real-time analysis for a session
   * @param {string} sessionId - Session ID
   * @param {string} userId - User ID
   * @param {Object} options - Analysis options
   */
  async startRealTimeAnalysis(sessionId, userId, options = {}) {
    try {
      // Check if analysis is already running
      if (this.activeSessions.has(sessionId)) {
        console.log(`Real-time analysis already running for session ${sessionId}`);
        return;
      }

      // Initialize session tracking
      this.activeSessions.set(sessionId, {
        userId,
        startTime: Date.now(),
        lastAnalysis: null,
        dataBuffer: [],
        options: { ...this.config, ...options }
      });

      // Start periodic analysis
      const intervalId = setInterval(async () => {
        await this.performRealTimeAnalysis(sessionId);
      }, this.config.analysisInterval);

      this.analysisIntervals.set(sessionId, intervalId);

      console.log(`Started real-time analysis for session ${sessionId}`);
      this.emit('analysisStarted', { sessionId, userId });

    } catch (error) {
      console.error(`Error starting real-time analysis for session ${sessionId}:`, error);
      this.emit('analysisError', { sessionId, error: error.message });
    }
  }

  /**
   * Stop real-time analysis for a session
   * @param {string} sessionId - Session ID
   */
  stopRealTimeAnalysis(sessionId) {
    try {
      // Clear interval
      const intervalId = this.analysisIntervals.get(sessionId);
      if (intervalId) {
        clearInterval(intervalId);
        this.analysisIntervals.delete(sessionId);
      }

      // Remove session tracking
      this.activeSessions.delete(sessionId);

      console.log(`Stopped real-time analysis for session ${sessionId}`);
      this.emit('analysisStopped', { sessionId });

    } catch (error) {
      console.error(`Error stopping real-time analysis for session ${sessionId}:`, error);
    }
  }

  /**
   * Add new data point to real-time analysis
   * @param {string} sessionId - Session ID
   * @param {Object} dataPoint - New data point
   */
  addDataPoint(sessionId, dataPoint) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    // Add to data buffer
    session.dataBuffer.push({
      ...dataPoint,
      timestamp: new Date()
    });

    // Keep only recent data (performance window)
    const cutoff = Date.now() - session.options.performanceWindow;
    session.dataBuffer = session.dataBuffer.filter(dp => dp.timestamp.getTime() > cutoff);

    // Emit data point event
    this.emit('dataPointAdded', { sessionId, dataPoint });

    // Check for immediate analysis triggers
    this.checkAnalysisTriggers(sessionId, dataPoint);
  }

  /**
   * Perform real-time analysis for a session
   * @param {string} sessionId - Session ID
   */
  async performRealTimeAnalysis(sessionId) {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) return;

      // Check if we have enough data
      if (session.dataBuffer.length < session.options.minDataPoints) {
        return;
      }

      // Perform streaming analysis
      const analysisResult = await this.performStreamingAnalysis(sessionId, session.dataBuffer);

      // Update session tracking
      session.lastAnalysis = {
        timestamp: new Date(),
        result: analysisResult
      };

      // Emit analysis result
      this.emit('analysisCompleted', { sessionId, result: analysisResult });

    } catch (error) {
      console.error(`Error in real-time analysis for session ${sessionId}:`, error);
      this.emit('analysisError', { sessionId, error: error.message });
    }
  }

  /**
   * Perform streaming analysis on data buffer
   * @param {string} sessionId - Session ID
   * @param {Array} dataBuffer - Data buffer
   * @returns {Object} Analysis result
   */
  async performStreamingAnalysis(sessionId, dataBuffer) {
    const analysis = {
      sessionId,
      timestamp: new Date(),
      dataPoints: dataBuffer.length,
      insights: [],
      alerts: [],
      metrics: {},
      confidence: 0
    };

    // Group data by parameter type
    const parameterGroups = this.groupDataByParameter(dataBuffer);

    // Analyze each parameter group
    for (const [pid, data] of Object.entries(parameterGroups)) {
      const paramAnalysis = this.analyzeParameterStream(pid, data);
      analysis.insights.push(...paramAnalysis.insights);
      analysis.alerts.push(...paramAnalysis.alerts);
      analysis.metrics[pid] = paramAnalysis.metrics;
    }

    // Calculate overall confidence
    analysis.confidence = this.calculateStreamingConfidence(analysis);

    // Check for critical alerts
    const criticalAlerts = analysis.alerts.filter(alert => alert.severity === 'critical');
    if (criticalAlerts.length > 0) {
      this.emit('criticalAlert', { sessionId, alerts: criticalAlerts });
    }

    return analysis;
  }

  /**
   * Group data by parameter type
   * @param {Array} dataBuffer - Data buffer
   * @returns {Object} Grouped data
   */
  groupDataByParameter(dataBuffer) {
    const groups = {};
    
    dataBuffer.forEach(dataPoint => {
      if (dataPoint.parameters) {
        dataPoint.parameters.forEach(param => {
          if (!groups[param.pid]) {
            groups[param.pid] = [];
          }
          groups[param.pid].push({
            value: param.formattedValue || param.value,
            timestamp: dataPoint.timestamp,
            unit: param.unit
          });
        });
      }
    });

    return groups;
  }

  /**
   * Analyze a stream of parameter data
   * @param {string} pid - Parameter ID
   * @param {Array} data - Parameter data stream
   * @returns {Object} Analysis result
   */
  analyzeParameterStream(pid, data) {
    const result = {
      insights: [],
      alerts: [],
      metrics: {}
    };

    if (data.length === 0) return result;

    const values = data.map(d => d.value);
    const timestamps = data.map(d => d.timestamp);

    // Calculate basic metrics
    result.metrics = {
      count: values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      trend: this.calculateTrend(values, timestamps),
      volatility: this.calculateVolatility(values)
    };

    // Parameter-specific analysis
    switch (pid) {
      case '010C': // Engine RPM
        this.analyzeRPMStream(values, result);
        break;
      case '010D': // Vehicle Speed
        this.analyzeSpeedStream(values, result);
        break;
      case '0105': // Engine Coolant Temperature
        this.analyzeCoolantTempStream(values, result);
        break;
      case '0111': // Throttle Position
        this.analyzeThrottleStream(values, result);
        break;
      default:
        this.analyzeGenericStream(values, result);
    }

    return result;
  }

  /**
   * Analyze RPM stream
   */
  analyzeRPMStream(values, result) {
    const avgRPM = result.metrics.avg;
    const maxRPM = result.metrics.max;

    // Check for idle RPM
    const idleValues = values.filter(v => v < 1000);
    if (idleValues.length > 0) {
      const avgIdle = idleValues.reduce((a, b) => a + b, 0) / idleValues.length;
      if (avgIdle < 600) {
        result.alerts.push({
          type: 'low_idle_rpm',
          severity: 'warning',
          message: 'Low idle RPM detected',
          value: avgIdle
        });
      }
    }

    // Check for high RPM
    if (maxRPM > 6000) {
      result.insights.push('High RPM range reached');
    }

    // Check for RPM stability
    if (result.metrics.volatility > 0.2) {
      result.alerts.push({
        type: 'unstable_rpm',
        severity: 'warning',
        message: 'Unstable RPM detected',
        volatility: result.metrics.volatility
      });
    }
  }

  /**
   * Analyze speed stream
   */
  analyzeSpeedStream(values, result) {
    const avgSpeed = result.metrics.avg;
    const maxSpeed = result.metrics.max;

    // Check for consistent speed (highway driving)
    if (result.metrics.volatility < 0.1 && avgSpeed > 50) {
      result.insights.push('Consistent highway driving detected');
    }

    // Check for rapid acceleration
    const accelerations = this.calculateAccelerations(values);
    const rapidAcceleration = accelerations.filter(a => a > 2);
    if (rapidAcceleration.length > 0) {
      result.alerts.push({
        type: 'rapid_acceleration',
        severity: 'info',
        message: 'Rapid acceleration detected',
        count: rapidAcceleration.length
      });
    }
  }

  /**
   * Analyze coolant temperature stream
   */
  analyzeCoolantTempStream(values, result) {
    const maxTemp = result.metrics.max;
    const avgTemp = result.metrics.avg;

    // Check for overheating
    if (maxTemp > 100) {
      result.alerts.push({
        type: 'overheating',
        severity: 'critical',
        message: 'Engine overheating detected',
        temperature: maxTemp
      });
    }

    // Check for cold engine
    const coldValues = values.filter(v => v < 80);
    if (coldValues.length > values.length * 0.5) {
      result.alerts.push({
        type: 'cold_engine',
        severity: 'warning',
        message: 'Engine running cold',
        percentage: (coldValues.length / values.length) * 100
      });
    }
  }

  /**
   * Analyze throttle position stream
   */
  analyzeThrottleStream(values, result) {
    const avgThrottle = result.metrics.avg;
    const maxThrottle = result.metrics.max;

    // Check for aggressive driving
    const aggressiveValues = values.filter(v => v > 80);
    if (aggressiveValues.length > values.length * 0.2) {
      result.alerts.push({
        type: 'aggressive_driving',
        severity: 'info',
        message: 'Aggressive driving detected',
        percentage: (aggressiveValues.length / values.length) * 100
      });
    }

    // Check for throttle response
    const throttleChanges = this.calculateThrottleChanges(values);
    const rapidChanges = throttleChanges.filter(c => c > 50);
    if (rapidChanges.length > 0) {
      result.insights.push('Rapid throttle changes detected');
    }
  }

  /**
   * Analyze generic parameter stream
   */
  analyzeGenericStream(values, result) {
    // Check for anomalies
    const anomalies = this.detectAnomalies(values, result.metrics);
    if (anomalies.length > 0) {
      result.alerts.push({
        type: 'anomaly',
        severity: 'warning',
        message: 'Data anomalies detected',
        count: anomalies.length
      });
    }
  }

  /**
   * Check for analysis triggers
   */
  checkAnalysisTriggers(sessionId, dataPoint) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    // Check for critical values
    if (dataPoint.parameters) {
      dataPoint.parameters.forEach(param => {
        switch (param.pid) {
          case '0105': // Coolant temperature
            if (param.formattedValue > 100) {
              this.emit('criticalValue', {
                sessionId,
                parameter: param,
                message: 'Critical coolant temperature detected'
              });
            }
            break;
          case '010C': // RPM
            if (param.formattedValue > 7000) {
              this.emit('criticalValue', {
                sessionId,
                parameter: param,
                message: 'Critical RPM detected'
              });
            }
            break;
        }
      });
    }
  }

  /**
   * Calculate trend for a data stream
   */
  calculateTrend(values, timestamps) {
    if (values.length < 2) return 'stable';

    const n = values.length;
    const x = timestamps.map((t, i) => i);
    const y = values;

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    
    if (slope > 0.1) return 'increasing';
    if (slope < -0.1) return 'decreasing';
    return 'stable';
  }

  /**
   * Calculate volatility for a data stream
   */
  calculateVolatility(values) {
    if (values.length < 2) return 0;

    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    return avg > 0 ? stdDev / avg : 0;
  }

  /**
   * Calculate accelerations from speed values
   */
  calculateAccelerations(values) {
    const accelerations = [];
    for (let i = 1; i < values.length; i++) {
      accelerations.push(values[i] - values[i - 1]);
    }
    return accelerations;
  }

  /**
   * Calculate throttle changes
   */
  calculateThrottleChanges(values) {
    const changes = [];
    for (let i = 1; i < values.length; i++) {
      changes.push(Math.abs(values[i] - values[i - 1]));
    }
    return changes;
  }

  /**
   * Detect anomalies in data stream
   */
  detectAnomalies(values, metrics) {
    const anomalies = [];
    const threshold = this.config.anomalyThreshold * metrics.volatility;

    values.forEach((value, index) => {
      if (Math.abs(value - metrics.avg) > threshold) {
        anomalies.push({
          index,
          value,
          deviation: Math.abs(value - metrics.avg)
        });
      }
    });

    return anomalies;
  }

  /**
   * Calculate streaming confidence
   */
  calculateStreamingConfidence(analysis) {
    let confidence = 0.5; // Base confidence

    // Increase confidence based on data points
    if (analysis.dataPoints > 50) confidence += 0.2;
    else if (analysis.dataPoints > 20) confidence += 0.1;

    // Decrease confidence based on alerts
    const criticalAlerts = analysis.alerts.filter(a => a.severity === 'critical').length;
    const warningAlerts = analysis.alerts.filter(a => a.severity === 'warning').length;
    
    confidence -= criticalAlerts * 0.1;
    confidence -= warningAlerts * 0.05;

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Get active sessions
   */
  getActiveSessions() {
    return Array.from(this.activeSessions.keys());
  }

  /**
   * Get session status
   */
  getSessionStatus(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return null;

    return {
      sessionId,
      active: true,
      startTime: session.startTime,
      lastAnalysis: session.lastAnalysis,
      dataPoints: session.dataBuffer.length,
      options: session.options
    };
  }

  /**
   * Cleanup inactive sessions
   */
  cleanupInactiveSessions() {
    const now = Date.now();
    const inactiveThreshold = 300000; // 5 minutes

    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (now - session.startTime > inactiveThreshold) {
        this.stopRealTimeAnalysis(sessionId);
      }
    }
  }
}

// Create singleton instance
const realTimeAnalysisService = new RealTimeAnalysisService();

// Cleanup inactive sessions every 5 minutes
setInterval(() => {
  realTimeAnalysisService.cleanupInactiveSessions();
}, 300000);

export default realTimeAnalysisService;
