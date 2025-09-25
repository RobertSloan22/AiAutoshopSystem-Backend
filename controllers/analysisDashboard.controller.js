import analysisDashboardService from '../services/analysisDashboardService.js';

/**
 * Analysis Dashboard Controller
 * 
 * Provides API endpoints for the analysis dashboard including
 * overview data, trends, alerts, and recommendations.
 */

/**
 * Get comprehensive dashboard data
 * GET /api/analysis/dashboard
 */
export const getDashboardData = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      timeRange = '30d',
      vehicleId = null,
      includePredictions = true
    } = req.query;

    const dashboardData = await analysisDashboardService.getDashboardData(userId, {
      timeRange,
      vehicleId,
      includePredictions: includePredictions === 'true'
    });

    res.json({
      success: true,
      data: dashboardData
    });

  } catch (error) {
    console.error('Error getting dashboard data:', error);
    res.status(500).json({
      error: 'Failed to get dashboard data',
      details: error.message
    });
  }
};

/**
 * Get overview statistics
 * GET /api/analysis/overview
 */
export const getOverview = async (req, res) => {
  try {
    const userId = req.user._id;
    const { timeRange = '30d', vehicleId = null } = req.query;

    const dashboardData = await analysisDashboardService.getDashboardData(userId, {
      timeRange,
      vehicleId,
      includePredictions: false
    });

    res.json({
      success: true,
      data: dashboardData.overview
    });

  } catch (error) {
    console.error('Error getting overview:', error);
    res.status(500).json({
      error: 'Failed to get overview',
      details: error.message
    });
  }
};

/**
 * Get trend analysis
 * GET /api/analysis/trends
 */
export const getTrends = async (req, res) => {
  try {
    const userId = req.user._id;
    const { timeRange = '30d', vehicleId = null } = req.query;

    const dashboardData = await analysisDashboardService.getDashboardData(userId, {
      timeRange,
      vehicleId,
      includePredictions: false
    });

    res.json({
      success: true,
      data: dashboardData.trends
    });

  } catch (error) {
    console.error('Error getting trends:', error);
    res.status(500).json({
      error: 'Failed to get trends',
      details: error.message
    });
  }
};

/**
 * Get vehicle summary
 * GET /api/analysis/vehicles
 */
export const getVehicleSummary = async (req, res) => {
  try {
    const userId = req.user._id;
    const { timeRange = '30d' } = req.query;

    const dashboardData = await analysisDashboardService.getDashboardData(userId, {
      timeRange,
      includePredictions: false
    });

    res.json({
      success: true,
      data: dashboardData.vehicles
    });

  } catch (error) {
    console.error('Error getting vehicle summary:', error);
    res.status(500).json({
      error: 'Failed to get vehicle summary',
      details: error.message
    });
  }
};

/**
 * Get alerts summary
 * GET /api/analysis/alerts
 */
export const getAlerts = async (req, res) => {
  try {
    const userId = req.user._id;
    const { timeRange = '30d', vehicleId = null, severity = null } = req.query;

    const dashboardData = await analysisDashboardService.getDashboardData(userId, {
      timeRange,
      vehicleId,
      includePredictions: false
    });

    let alerts = dashboardData.alerts;

    // Filter by severity if specified
    if (severity) {
      alerts = {
        ...alerts,
        [severity]: alerts[severity] || []
      };
    }

    res.json({
      success: true,
      data: alerts
    });

  } catch (error) {
    console.error('Error getting alerts:', error);
    res.status(500).json({
      error: 'Failed to get alerts',
      details: error.message
    });
  }
};

/**
 * Get performance metrics
 * GET /api/analysis/performance
 */
export const getPerformanceMetrics = async (req, res) => {
  try {
    const userId = req.user._id;
    const { timeRange = '30d', vehicleId = null } = req.query;

    const dashboardData = await analysisDashboardService.getDashboardData(userId, {
      timeRange,
      vehicleId,
      includePredictions: false
    });

    res.json({
      success: true,
      data: dashboardData.performance
    });

  } catch (error) {
    console.error('Error getting performance metrics:', error);
    res.status(500).json({
      error: 'Failed to get performance metrics',
      details: error.message
    });
  }
};

/**
 * Get recommendations
 * GET /api/analysis/recommendations
 */
export const getRecommendations = async (req, res) => {
  try {
    const userId = req.user._id;
    const { timeRange = '30d', vehicleId = null, priority = null } = req.query;

    const dashboardData = await analysisDashboardService.getDashboardData(userId, {
      timeRange,
      vehicleId,
      includePredictions: false
    });

    let recommendations = dashboardData.recommendations;

    // Filter by priority if specified
    if (priority) {
      recommendations = recommendations.filter(rec => rec.priority === priority);
    }

    res.json({
      success: true,
      data: recommendations
    });

  } catch (error) {
    console.error('Error getting recommendations:', error);
    res.status(500).json({
      error: 'Failed to get recommendations',
      details: error.message
    });
  }
};

/**
 * Get predictions
 * GET /api/analysis/predictions
 */
export const getPredictions = async (req, res) => {
  try {
    const userId = req.user._id;
    const { timeRange = '30d', vehicleId = null } = req.query;

    const dashboardData = await analysisDashboardService.getDashboardData(userId, {
      timeRange,
      vehicleId,
      includePredictions: true
    });

    res.json({
      success: true,
      data: dashboardData.predictions
    });

  } catch (error) {
    console.error('Error getting predictions:', error);
    res.status(500).json({
      error: 'Failed to get predictions',
      details: error.message
    });
  }
};

/**
 * Get specific vehicle analysis
 * GET /api/analysis/vehicles/:vehicleId
 */
export const getVehicleAnalysis = async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const userId = req.user._id;
    const { timeRange = '30d' } = req.query;

    const dashboardData = await analysisDashboardService.getDashboardData(userId, {
      timeRange,
      vehicleId,
      includePredictions: true
    });

    // Get vehicle-specific data
    const vehicleData = dashboardData.vehicles.find(v => v.vehicleId === vehicleId);
    if (!vehicleData) {
      return res.status(404).json({
        error: 'Vehicle not found or no analysis data available'
      });
    }

    res.json({
      success: true,
      data: {
        vehicle: vehicleData,
        trends: dashboardData.trends,
        alerts: dashboardData.alerts,
        recommendations: dashboardData.recommendations.filter(rec => 
          rec.details && rec.details.some(detail => detail.vehicleId === vehicleId)
        ),
        predictions: dashboardData.predictions
      }
    });

  } catch (error) {
    console.error('Error getting vehicle analysis:', error);
    res.status(500).json({
      error: 'Failed to get vehicle analysis',
      details: error.message
    });
  }
};

/**
 * Export dashboard data
 * GET /api/analysis/export
 */
export const exportDashboardData = async (req, res) => {
  try {
    const userId = req.user._id;
    const { format = 'json', timeRange = '30d', vehicleId = null } = req.query;

    const dashboardData = await analysisDashboardService.getDashboardData(userId, {
      timeRange,
      vehicleId,
      includePredictions: true
    });

    if (format === 'csv') {
      // Convert to CSV format
      const csv = convertDashboardToCSV(dashboardData);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=dashboard_${timeRange}.csv`);
      res.send(csv);
    } else {
      // Return JSON
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=dashboard_${timeRange}.json`);
      res.json({
        success: true,
        exportDate: new Date(),
        timeRange,
        vehicleId,
        data: dashboardData
      });
    }

  } catch (error) {
    console.error('Error exporting dashboard data:', error);
    res.status(500).json({
      error: 'Failed to export dashboard data',
      details: error.message
    });
  }
};

/**
 * Clear dashboard cache
 * POST /api/analysis/cache/clear
 */
export const clearCache = async (req, res) => {
  try {
    analysisDashboardService.clearCache();

    res.json({
      success: true,
      message: 'Dashboard cache cleared successfully'
    });

  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(500).json({
      error: 'Failed to clear cache',
      details: error.message
    });
  }
};

/**
 * Get cache statistics
 * GET /api/analysis/cache/stats
 */
export const getCacheStats = async (req, res) => {
  try {
    const stats = analysisDashboardService.getCacheStats();

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Error getting cache stats:', error);
    res.status(500).json({
      error: 'Failed to get cache stats',
      details: error.message
    });
  }
};

/**
 * Helper function to convert dashboard data to CSV
 */
const convertDashboardToCSV = (dashboardData) => {
  const headers = [
    'Date',
    'Total Sessions',
    'Analyzed Sessions',
    'Analysis Rate',
    'Active Alerts',
    'Average Confidence',
    'Health Distribution'
  ];

  const rows = [];

  // Add overview data
  if (dashboardData.overview) {
    const overview = dashboardData.overview;
    rows.push([
      new Date().toISOString().split('T')[0],
      overview.totalSessions,
      overview.analyzedSessions,
      overview.analysisRate,
      overview.activeAlerts,
      overview.averageConfidence,
      JSON.stringify(overview.healthDistribution)
    ]);
  }

  // Add trend data
  if (dashboardData.trends && dashboardData.trends.sessionsOverTime) {
    dashboardData.trends.sessionsOverTime.forEach(trend => {
      rows.push([
        trend.date,
        trend.sessions,
        trend.analyses,
        trend.analyses / trend.sessions,
        '', // Active alerts not available in trend data
        '', // Average confidence not available in trend data
        '' // Health distribution not available in trend data
      ]);
    });
  }

  return [headers, ...rows].map(row => row.join(',')).join('\n');
};
