import OBD2Data from '../models/obd2Data.model.js';
import Vehicle from '../models/vehicle.model.js';
import PythonExecutionService from './pythonExecutionService.js';
import mongoose from 'mongoose';

/**
 * Analysis Dashboard Service
 * 
 * Provides comprehensive dashboard data and insights for OBD2 analysis results
 * including trends, comparisons, and predictive analytics.
 */

class AnalysisDashboardService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 300000; // 5 minutes
    this.pythonService = new PythonExecutionService();
  }

  /**
   * Get comprehensive dashboard data for a user
   * @param {string} userId - User ID
   * @param {Object} options - Dashboard options
   * @returns {Object} Dashboard data
   */
  async getDashboardData(userId, options = {}) {
    const {
      timeRange = '30d',
      vehicleId = null,
      includePredictions = true
    } = options;

    const cacheKey = `dashboard_${userId}_${timeRange}_${vehicleId || 'all'}`;
    
    // Check cache
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    try {
      // Calculate date range
      const dateRange = this.calculateDateRange(timeRange);
      
      // Get sessions from both old and new models
      let sessions = [];
      
      try {
        // Try to get data from new DiagnosticSession model first
        const DiagnosticSession = mongoose.model('DiagnosticSession');
        const sessionQuery = { userId };
        if (vehicleId) sessionQuery.vehicleId = vehicleId;
        if (dateRange.start) sessionQuery.startTime = { $gte: dateRange.start };
        if (dateRange.end) {
          sessionQuery.startTime = { 
            ...(sessionQuery.startTime || {}), 
            $lte: dateRange.end 
          };
        }
        
        const diagnosticSessions = await DiagnosticSession.find(sessionQuery)
          .sort({ startTime: -1 })
          .limit(1000);
          
        // Convert DiagnosticSession format to compatible format
        sessions = diagnosticSessions.map(session => ({
          _id: session._id,
          sessionId: session._id.toString(),
          userId: session.userId,
          vehicleId: session.vehicleId,
          createdAt: session.startTime,
          analysisResults: [], // Will be populated separately
          dataQuality: {
            completeness: session.dataQualityScore || 1.0,
            consistency: 1.0,
            timeliness: 1.0
          },
          processingStatus: session.status === 'completed' ? 'completed' : 'pending'
        }));
        
        console.log(`Found ${sessions.length} diagnostic sessions`);
        
      } catch (modelError) {
        console.log('DiagnosticSession model not available, trying legacy OBD2Data...');
        
        // Fallback to legacy OBD2Data model
        const query = { userId };
        if (vehicleId) query.vehicleId = vehicleId;
        if (dateRange.start) query.createdAt = { $gte: dateRange.start };
        if (dateRange.end) query.createdAt = { $lte: dateRange.end };

        sessions = await OBD2Data.find(query)
          .populate('vehicleId', 'make model year vin')
          .sort({ createdAt: -1 })
          .limit(1000);
      }
      
      // Enrich sessions with Python analysis results
      await this.enrichSessionsWithAnalysis(sessions);

      // Process dashboard data
      const dashboardData = {
        overview: await this.generateOverview(sessions),
        trends: await this.generateTrends(sessions, timeRange),
        vehicles: await this.generateVehicleSummary(sessions),
        alerts: await this.generateAlerts(sessions),
        performance: await this.generatePerformanceMetrics(sessions),
        recommendations: await this.generateRecommendations(sessions),
        predictions: includePredictions ? await this.generatePredictions(sessions) : null,
        
        // Enhanced Python analysis features
        pythonAnalysis: this.getPythonAnalysisSummary(sessions),
        enhancedVehicles: await this.generateEnhancedVehicleSummary(sessions),
        
        generatedAt: new Date()
      };

      // Cache result
      this.cache.set(cacheKey, {
        data: dashboardData,
        timestamp: Date.now()
      });

      return dashboardData;

    } catch (error) {
      console.error('Error generating dashboard data:', error);
      throw error;
    }
  }

  /**
   * Generate overview statistics
   */
  async generateOverview(sessions) {
    const totalSessions = sessions.length;
    const analyzedSessions = sessions.filter(s => s.analysisResults.length > 0).length;
    const activeAlerts = this.countActiveAlerts(sessions);
    const avgConfidence = this.calculateAverageConfidence(sessions);

    // Calculate health distribution
    const healthDistribution = this.calculateHealthDistribution(sessions);

    return {
      totalSessions,
      analyzedSessions,
      analysisRate: totalSessions > 0 ? analyzedSessions / totalSessions : 0,
      activeAlerts,
      averageConfidence: avgConfidence,
      healthDistribution,
      lastAnalysis: this.getLastAnalysis(sessions)
    };
  }

  /**
   * Generate trend analysis
   */
  async generateTrends(sessions, timeRange) {
    const trends = {
      sessionsOverTime: this.calculateSessionsOverTime(sessions),
      analysisQualityOverTime: this.calculateAnalysisQualityOverTime(sessions),
      parameterTrends: this.calculateParameterTrends(sessions),
      alertTrends: this.calculateAlertTrends(sessions)
    };

    return trends;
  }

  /**
   * Generate vehicle summary
   */
  async generateVehicleSummary(sessions) {
    const vehicleMap = new Map();

    sessions.forEach(session => {
      if (!session.vehicleId) return;

      const vehicleId = session.vehicleId._id.toString();
      if (!vehicleMap.has(vehicleId)) {
        vehicleMap.set(vehicleId, {
          vehicleId,
          vehicleInfo: session.vehicleId,
          sessions: [],
          totalAnalyses: 0,
          lastAnalysis: null,
          healthScore: 0,
          criticalIssues: 0
        });
      }

      const vehicle = vehicleMap.get(vehicleId);
      vehicle.sessions.push(session);
      vehicle.totalAnalyses += session.analysisResults.length;

      if (session.analysisResults.length > 0) {
        const latestAnalysis = session.analysisResults[session.analysisResults.length - 1];
        if (!vehicle.lastAnalysis || latestAnalysis.generatedAt > vehicle.lastAnalysis.generatedAt) {
          vehicle.lastAnalysis = latestAnalysis;
        }

        // Update health score and critical issues
        if (latestAnalysis.result && latestAnalysis.result.summary) {
          const summary = latestAnalysis.result.summary;
          if (summary.overallHealth) {
            vehicle.healthScore = this.healthScoreToNumber(summary.overallHealth);
          }
          if (summary.criticalIssues) {
            vehicle.criticalIssues += summary.criticalIssues.length;
          }
        }
      }
    });

    return Array.from(vehicleMap.values());
  }

  /**
   * Generate alerts summary
   */
  async generateAlerts(sessions) {
    const alerts = {
      critical: [],
      warning: [],
      info: [],
      recent: [],
      byType: {}
    };

    sessions.forEach(session => {
      session.analysisResults.forEach(analysis => {
        if (analysis.result && analysis.result.summary) {
          const summary = analysis.result.summary;
          
          if (summary.criticalIssues) {
            summary.criticalIssues.forEach(issue => {
              alerts.critical.push({
                sessionId: session.sessionId,
                vehicleId: session.vehicleId._id,
                issue,
                timestamp: analysis.generatedAt
              });
            });
          }

          if (summary.recommendations) {
            summary.recommendations.forEach(rec => {
              alerts.info.push({
                sessionId: session.sessionId,
                vehicleId: session.vehicleId._id,
                recommendation: rec,
                timestamp: analysis.generatedAt
              });
            });
          }
        }
      });
    });

    // Sort by timestamp
    alerts.critical.sort((a, b) => b.timestamp - a.timestamp);
    alerts.warning.sort((a, b) => b.timestamp - a.timestamp);
    alerts.info.sort((a, b) => b.timestamp - a.timestamp);

    // Get recent alerts (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    alerts.recent = [...alerts.critical, ...alerts.warning, ...alerts.info]
      .filter(alert => alert.timestamp > oneDayAgo)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 20);

    return alerts;
  }

  /**
   * Generate performance metrics
   */
  async generatePerformanceMetrics(sessions) {
    const metrics = {
      analysisPerformance: this.calculateAnalysisPerformance(sessions),
      dataQuality: this.calculateDataQualityMetrics(sessions),
      systemHealth: this.calculateSystemHealth(sessions)
    };

    return metrics;
  }

  /**
   * Generate recommendations
   */
  async generateRecommendations(sessions) {
    const recommendations = [];

    // Analyze patterns across all sessions
    const allIssues = this.extractAllIssues(sessions);
    const allRecommendations = this.extractAllRecommendations(sessions);

    // Generate priority recommendations
    if (allIssues.length > 0) {
      recommendations.push({
        type: 'critical',
        title: 'Address Critical Issues',
        description: `Found ${allIssues.length} critical issues across your vehicles`,
        priority: 'high',
        action: 'Review and address critical issues immediately'
      });
    }

    // Generate maintenance recommendations
    const maintenanceNeeds = this.analyzeMaintenanceNeeds(sessions);
    if (maintenanceNeeds.length > 0) {
      recommendations.push({
        type: 'maintenance',
        title: 'Scheduled Maintenance',
        description: 'Consider scheduling maintenance based on analysis results',
        priority: 'medium',
        action: 'Schedule maintenance appointments',
        details: maintenanceNeeds
      });
    }

    // Generate data quality recommendations
    const dataQualityIssues = this.analyzeDataQuality(sessions);
    if (dataQualityIssues.length > 0) {
      recommendations.push({
        type: 'data_quality',
        title: 'Improve Data Quality',
        description: 'Some sessions have data quality issues',
        priority: 'low',
        action: 'Check OBD2 adapter connection and data collection settings',
        details: dataQualityIssues
      });
    }

    return recommendations;
  }

  /**
   * Generate predictions
   */
  async generatePredictions(sessions) {
    const predictions = {
      maintenanceSchedule: this.predictMaintenanceSchedule(sessions),
      performanceTrends: this.predictPerformanceTrends(sessions),
      riskAssessment: this.assessRisks(sessions)
    };

    return predictions;
  }

  // Helper methods
  calculateDateRange(timeRange) {
    const now = new Date();
    const ranges = {
      '7d': { start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
      '30d': { start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
      '90d': { start: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) },
      '1y': { start: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000) }
    };

    return ranges[timeRange] || ranges['30d'];
  }

  countActiveAlerts(sessions) {
    let count = 0;
    sessions.forEach(session => {
      session.analysisResults.forEach(analysis => {
        if (analysis.result && analysis.result.summary && analysis.result.summary.criticalIssues) {
          count += analysis.result.summary.criticalIssues.length;
        }
      });
    });
    return count;
  }

  calculateAverageConfidence(sessions) {
    let totalConfidence = 0;
    let count = 0;

    sessions.forEach(session => {
      session.analysisResults.forEach(analysis => {
        if (analysis.confidence) {
          totalConfidence += analysis.confidence;
          count++;
        }
      });
    });

    return count > 0 ? totalConfidence / count : 0;
  }

  calculateHealthDistribution(sessions) {
    const distribution = {
      excellent: 0,
      good: 0,
      fair: 0,
      poor: 0,
      unknown: 0
    };

    sessions.forEach(session => {
      session.analysisResults.forEach(analysis => {
        if (analysis.result && analysis.result.summary && analysis.result.summary.overallHealth) {
          const health = analysis.result.summary.overallHealth;
          if (distribution.hasOwnProperty(health)) {
            distribution[health]++;
          }
        }
      });
    });

    return distribution;
  }

  getLastAnalysis(sessions) {
    let lastAnalysis = null;
    let lastTime = 0;

    sessions.forEach(session => {
      session.analysisResults.forEach(analysis => {
        if (analysis.generatedAt && analysis.generatedAt.getTime() > lastTime) {
          lastAnalysis = analysis;
          lastTime = analysis.generatedAt.getTime();
        }
      });
    });

    return lastAnalysis;
  }

  calculateSessionsOverTime(sessions) {
    const timeSeries = {};
    
    sessions.forEach(session => {
      const date = session.createdAt.toISOString().split('T')[0];
      if (!timeSeries[date]) {
        timeSeries[date] = { sessions: 0, analyses: 0 };
      }
      timeSeries[date].sessions++;
      timeSeries[date].analyses += session.analysisResults.length;
    });

    return Object.entries(timeSeries)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  calculateAnalysisQualityOverTime(sessions) {
    const timeSeries = {};
    
    sessions.forEach(session => {
      const date = session.createdAt.toISOString().split('T')[0];
      if (!timeSeries[date]) {
        timeSeries[date] = { confidence: [], dataQuality: [] };
      }
      
      session.analysisResults.forEach(analysis => {
        if (analysis.confidence) {
          timeSeries[date].confidence.push(analysis.confidence);
        }
        if (analysis.result && analysis.result.sessionInfo && analysis.result.sessionInfo.dataQuality) {
          timeSeries[date].dataQuality.push(analysis.result.sessionInfo.dataQuality.completeness || 0);
        }
      });
    });

    return Object.entries(timeSeries)
      .map(([date, data]) => ({
        date,
        avgConfidence: data.confidence.length > 0 ? 
          data.confidence.reduce((a, b) => a + b, 0) / data.confidence.length : 0,
        avgDataQuality: data.dataQuality.length > 0 ? 
          data.dataQuality.reduce((a, b) => a + b, 0) / data.dataQuality.length : 0
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  calculateParameterTrends(sessions) {
    // This would analyze parameter trends across sessions
    // For now, return a placeholder
    return {
      rpm: { trend: 'stable', volatility: 0.1 },
      speed: { trend: 'increasing', volatility: 0.2 },
      coolantTemp: { trend: 'stable', volatility: 0.05 }
    };
  }

  calculateAlertTrends(sessions) {
    // This would analyze alert trends across sessions
    // For now, return a placeholder
    return {
      critical: { trend: 'decreasing', count: 0 },
      warning: { trend: 'stable', count: 0 },
      info: { trend: 'increasing', count: 0 }
    };
  }

  healthScoreToNumber(health) {
    const scores = {
      'excellent': 4,
      'good': 3,
      'fair': 2,
      'poor': 1,
      'unknown': 0
    };
    return scores[health] || 0;
  }

  calculateAnalysisPerformance(sessions) {
    const totalAnalyses = sessions.reduce((sum, s) => sum + s.analysisResults.length, 0);
    const avgProcessingTime = this.calculateAverageProcessingTime(sessions);
    const successRate = this.calculateAnalysisSuccessRate(sessions);

    return {
      totalAnalyses,
      averageProcessingTime: avgProcessingTime,
      successRate
    };
  }

  calculateAverageProcessingTime(sessions) {
    let totalTime = 0;
    let count = 0;

    sessions.forEach(session => {
      session.analysisResults.forEach(analysis => {
        if (analysis.processingTime) {
          totalTime += analysis.processingTime;
          count++;
        }
      });
    });

    return count > 0 ? totalTime / count : 0;
  }

  calculateAnalysisSuccessRate(sessions) {
    let total = 0;
    let successful = 0;

    sessions.forEach(session => {
      total++;
      if (session.processingStatus === 'completed') {
        successful++;
      }
    });

    return total > 0 ? successful / total : 0;
  }

  calculateDataQualityMetrics(sessions) {
    const metrics = {
      averageCompleteness: 0,
      averageConsistency: 0,
      averageTimeliness: 0,
      totalSessions: sessions.length
    };

    let completenessSum = 0;
    let consistencySum = 0;
    let timelinessSum = 0;
    let count = 0;

    sessions.forEach(session => {
      if (session.dataQuality) {
        if (session.dataQuality.completeness) {
          completenessSum += session.dataQuality.completeness;
        }
        if (session.dataQuality.consistency) {
          consistencySum += session.dataQuality.consistency;
        }
        if (session.dataQuality.timeliness) {
          timelinessSum += session.dataQuality.timeliness;
        }
        count++;
      }
    });

    if (count > 0) {
      metrics.averageCompleteness = completenessSum / count;
      metrics.averageConsistency = consistencySum / count;
      metrics.averageTimeliness = timelinessSum / count;
    }

    return metrics;
  }

  calculateSystemHealth(sessions) {
    const health = {
      overall: 'good',
      issues: [],
      recommendations: []
    };

    // Analyze system health based on various factors
    const dataQuality = this.calculateDataQualityMetrics(sessions);
    const analysisPerformance = this.calculateAnalysisPerformance(sessions);

    if (dataQuality.averageCompleteness < 0.8) {
      health.issues.push('Low data completeness');
    }

    if (analysisPerformance.successRate < 0.9) {
      health.issues.push('Analysis success rate below threshold');
    }

    if (health.issues.length > 2) {
      health.overall = 'poor';
    } else if (health.issues.length > 0) {
      health.overall = 'fair';
    }

    return health;
  }

  extractAllIssues(sessions) {
    const issues = [];
    sessions.forEach(session => {
      session.analysisResults.forEach(analysis => {
        if (analysis.result && analysis.result.summary && analysis.result.summary.criticalIssues) {
          issues.push(...analysis.result.summary.criticalIssues);
        }
      });
    });
    return issues;
  }

  extractAllRecommendations(sessions) {
    const recommendations = [];
    sessions.forEach(session => {
      session.analysisResults.forEach(analysis => {
        if (analysis.result && analysis.result.summary && analysis.result.summary.recommendations) {
          recommendations.push(...analysis.result.summary.recommendations);
        }
      });
    });
    return recommendations;
  }

  analyzeMaintenanceNeeds(sessions) {
    // This would analyze maintenance needs based on analysis results
    // For now, return a placeholder
    return [
      'Oil change recommended',
      'Air filter inspection needed',
      'Brake system check suggested'
    ];
  }

  analyzeDataQuality(sessions) {
    const issues = [];
    sessions.forEach(session => {
      if (session.dataQuality && session.dataQuality.completeness < 0.8) {
        issues.push(`Session ${session.sessionId} has low data completeness`);
      }
    });
    return issues;
  }

  predictMaintenanceSchedule(sessions) {
    // This would predict maintenance schedule based on analysis results
    // For now, return a placeholder
    return {
      nextOilChange: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      nextInspection: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      riskFactors: ['High mileage', 'Frequent high RPM usage']
    };
  }

  predictPerformanceTrends(sessions) {
    // This would predict performance trends based on historical data
    // For now, return a placeholder
    return {
      fuelEfficiency: { trend: 'stable', confidence: 0.7 },
      engineHealth: { trend: 'declining', confidence: 0.8 },
      overallPerformance: { trend: 'stable', confidence: 0.6 }
    };
  }

  assessRisks(sessions) {
    // This would assess risks based on analysis results
    // For now, return a placeholder
    return {
      engineFailure: { probability: 0.1, factors: ['High temperature readings'] },
      transmissionIssues: { probability: 0.05, factors: [] },
      brakeSystemIssues: { probability: 0.02, factors: [] }
    };
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  /**
   * Enrich sessions with Python analysis results
   * @param {Array} sessions - Session objects to enrich
   */
  async enrichSessionsWithAnalysis(sessions) {
    try {
      for (const session of sessions) {
        // Get Python analysis results for this session
        const analysisResults = await this.pythonService.getSessionAnalysisResults(session.sessionId);
        session.analysisResults = analysisResults || [];
        
        // Get associated plots
        session.plots = [];
        for (const result of analysisResults) {
          if (result.executionId) {
            const plots = await this.pythonService.getPlotsByExecutionId(result.executionId);
            session.plots.push(...plots);
          }
        }
      }
      console.log(`Enriched ${sessions.length} sessions with analysis results`);
    } catch (error) {
      console.error('Error enriching sessions with analysis:', error);
    }
  }

  /**
   * Trigger Python analysis for sessions without recent analysis
   * @param {Array} sessionIds - Session IDs to analyze
   * @param {string} analysisType - Type of analysis to perform
   * @returns {Promise<Object>} Analysis trigger results
   */
  async triggerAnalysisForSessions(sessionIds, analysisType = 'comprehensive') {
    const results = {
      triggered: 0,
      failed: 0,
      skipped: 0,
      errors: []
    };

    for (const sessionId of sessionIds) {
      try {
        // Check if session has recent analysis
        const analysisResults = await this.pythonService.getSessionAnalysisResults(sessionId);
        const hasRecentAnalysis = analysisResults.some(result => {
          const analysisAge = Date.now() - new Date(result.generatedAt).getTime();
          return analysisAge < 24 * 60 * 60 * 1000; // Less than 24 hours old
        });

        if (hasRecentAnalysis) {
          results.skipped++;
          continue;
        }

        // Trigger analysis
        const analysisResult = await this.pythonService.analyzeOBD2Session(sessionId, {
          analysisType,
          generatePlots: true,
          saveResults: true
        });

        if (analysisResult.success) {
          results.triggered++;
        } else {
          results.failed++;
          results.errors.push({ sessionId, error: analysisResult.error });
        }

      } catch (error) {
        results.failed++;
        results.errors.push({ sessionId, error: error.message });
      }
    }

    return results;
  }

  /**
   * Get Python analysis summary for dashboard
   * @param {Array} sessions - Sessions with analysis results
   * @returns {Object} Python analysis summary
   */
  getPythonAnalysisSummary(sessions) {
    const summary = {
      totalSessions: sessions.length,
      analyzedSessions: 0,
      analysisTypes: {},
      healthDistribution: {
        excellent: 0,
        good: 0,
        fair: 0,
        poor: 0,
        unknown: 0
      },
      recentAnalyses: 0,
      plotsGenerated: 0
    };

    sessions.forEach(session => {
      if (session.analysisResults && session.analysisResults.length > 0) {
        summary.analyzedSessions++;

        session.analysisResults.forEach(result => {
          // Count analysis types
          if (result.analysisType) {
            summary.analysisTypes[result.analysisType] = (summary.analysisTypes[result.analysisType] || 0) + 1;
          }

          // Check health status from comprehensive analysis
          if (result.result && result.result.overall_health) {
            const health = result.result.overall_health;
            if (summary.healthDistribution.hasOwnProperty(health)) {
              summary.healthDistribution[health]++;
            }
          }

          // Count recent analyses (last 24 hours)
          const analysisAge = Date.now() - new Date(result.generatedAt).getTime();
          if (analysisAge < 24 * 60 * 60 * 1000) {
            summary.recentAnalyses++;
          }
        });

        // Count plots
        if (session.plots) {
          summary.plotsGenerated += session.plots.length;
        }
      }
    });

    return summary;
  }

  /**
   * Enhanced vehicle summary with Python analysis results
   * @param {Array} sessions - Sessions with analysis results
   * @returns {Array} Enhanced vehicle summary
   */
  async generateEnhancedVehicleSummary(sessions) {
    const vehicleMap = new Map();

    sessions.forEach(session => {
      if (!session.vehicleId) return;

      const vehicleId = session.vehicleId._id ? session.vehicleId._id.toString() : session.vehicleId.toString();
      if (!vehicleMap.has(vehicleId)) {
        vehicleMap.set(vehicleId, {
          vehicleId,
          vehicleInfo: session.vehicleId,
          sessions: [],
          totalAnalyses: 0,
          analysisTypes: new Set(),
          lastAnalysis: null,
          healthTrend: [],
          criticalIssues: 0,
          plotsGenerated: 0,
          pythonAnalysisAvailable: false
        });
      }

      const vehicle = vehicleMap.get(vehicleId);
      vehicle.sessions.push(session);

      if (session.analysisResults && session.analysisResults.length > 0) {
        vehicle.pythonAnalysisAvailable = true;
        vehicle.totalAnalyses += session.analysisResults.length;

        session.analysisResults.forEach(result => {
          vehicle.analysisTypes.add(result.analysisType);

          if (!vehicle.lastAnalysis || new Date(result.generatedAt) > new Date(vehicle.lastAnalysis.generatedAt)) {
            vehicle.lastAnalysis = result;
          }

          // Track health trend
          if (result.result && result.result.overall_health) {
            vehicle.healthTrend.push({
              date: result.generatedAt,
              health: result.result.overall_health
            });
          }

          // Count critical issues
          if (result.result && result.result.diagnostics && result.result.diagnostics.issues) {
            vehicle.criticalIssues += result.result.diagnostics.issues.length;
          }
        });

        // Count plots
        if (session.plots) {
          vehicle.plotsGenerated += session.plots.length;
        }
      }

      // Convert Set to Array for JSON serialization
      vehicle.analysisTypes = Array.from(vehicle.analysisTypes);
    });

    return Array.from(vehicleMap.values());
  }
}

export default new AnalysisDashboardService();
