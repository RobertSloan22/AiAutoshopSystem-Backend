/**
 * OBD2 Analysis System Usage Example
 * 
 * This example demonstrates how to use the OBD2 Analysis System
 * to analyze recorded sessions and retrieve insights.
 */

import axios from 'axios';

// Configuration
const API_BASE_URL = 'http://localhost:3000/api';
const AUTH_TOKEN = 'your-jwt-token-here'; // Replace with actual JWT token

// Create axios instance with authentication
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Authorization': `Bearer ${AUTH_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

/**
 * Example 1: Analyze a complete OBD2 session
 */
async function analyzeCompleteSession(sessionId) {
  try {
    console.log(`Analyzing session: ${sessionId}`);
    
    const response = await api.post(`/obd2/sessions/${sessionId}/analyze`, {
      analysisType: 'comprehensive',
      options: {
        includePredictions: true,
        detailedMetrics: true
      }
    });

    console.log('Analysis completed successfully!');
    console.log('Overall Health:', response.data.data.summary.overallHealth);
    console.log('Confidence:', response.data.data.summary.confidence);
    console.log('Critical Issues:', response.data.data.summary.criticalIssues.length);
    console.log('Recommendations:', response.data.data.summary.recommendations.length);

    return response.data.data;
  } catch (error) {
    console.error('Error analyzing session:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Example 2: Analyze specific parameters
 */
async function analyzeSpecificParameters(sessionId, parameters) {
  try {
    console.log(`Analyzing parameters for session: ${sessionId}`);
    console.log('Parameters:', parameters);
    
    const response = await api.post(`/obd2/sessions/${sessionId}/analyze-parameters`, {
      parameters: parameters,
      analysisOptions: {
        includeTrends: true,
        detectAnomalies: true
      }
    });

    console.log('Parameter analysis completed!');
    console.log('Total data points:', response.data.data.totalDataPoints);
    
    // Display results for each parameter
    Object.entries(response.data.data.parameters).forEach(([pid, analysis]) => {
      console.log(`\nParameter ${pid} (${analysis.parameterInfo.name}):`);
      console.log(`  Average: ${analysis.statistics.avg}`);
      console.log(`  Min: ${analysis.statistics.min}`);
      console.log(`  Max: ${analysis.statistics.max}`);
      console.log(`  Trend: ${analysis.trend.direction}`);
      console.log(`  Anomalies: ${analysis.anomalies.length}`);
    });

    return response.data.data;
  } catch (error) {
    console.error('Error analyzing parameters:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Example 3: Get analysis results
 */
async function getAnalysisResults(sessionId) {
  try {
    console.log(`Getting analysis results for session: ${sessionId}`);
    
    const response = await api.get(`/obd2/sessions/${sessionId}/analysis`);

    console.log('Analysis results retrieved!');
    console.log('Processing Status:', response.data.data.processingStatus);
    console.log('Total Analyses:', response.data.data.analysisResults.length);
    
    // Display each analysis result
    response.data.data.analysisResults.forEach((analysis, index) => {
      console.log(`\nAnalysis ${index + 1}:`);
      console.log(`  Type: ${analysis.analysisType}`);
      console.log(`  Confidence: ${analysis.confidence}`);
      console.log(`  Generated: ${analysis.generatedAt}`);
      console.log(`  Processing Time: ${analysis.processingTime}ms`);
    });

    return response.data.data;
  } catch (error) {
    console.error('Error getting analysis results:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Example 4: Get dashboard data
 */
async function getDashboardData(timeRange = '30d', vehicleId = null) {
  try {
    console.log(`Getting dashboard data for time range: ${timeRange}`);
    
    const params = { timeRange, includePredictions: true };
    if (vehicleId) params.vehicleId = vehicleId;
    
    const response = await api.get('/analysis/dashboard', { params });

    console.log('Dashboard data retrieved!');
    console.log('Total Sessions:', response.data.data.overview.totalSessions);
    console.log('Analyzed Sessions:', response.data.data.overview.analyzedSessions);
    console.log('Analysis Rate:', response.data.data.overview.analysisRate);
    console.log('Active Alerts:', response.data.data.overview.activeAlerts);
    console.log('Average Confidence:', response.data.data.overview.averageConfidence);
    
    // Display health distribution
    console.log('\nHealth Distribution:');
    Object.entries(response.data.data.overview.healthDistribution).forEach(([health, count]) => {
      console.log(`  ${health}: ${count}`);
    });

    return response.data.data;
  } catch (error) {
    console.error('Error getting dashboard data:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Example 5: Get vehicle analysis summary
 */
async function getVehicleAnalysisSummary(vehicleId, timeRange = '30d') {
  try {
    console.log(`Getting vehicle analysis summary for vehicle: ${vehicleId}`);
    
    const response = await api.get(`/analysis/vehicles/${vehicleId}`, {
      params: { timeRange }
    });

    console.log('Vehicle analysis retrieved!');
    console.log('Vehicle Info:', response.data.data.vehicle.vehicleInfo);
    console.log('Total Sessions:', response.data.data.vehicle.sessions.length);
    console.log('Total Analyses:', response.data.data.vehicle.totalAnalyses);
    console.log('Health Score:', response.data.data.vehicle.healthScore);
    console.log('Critical Issues:', response.data.data.vehicle.criticalIssues);
    
    // Display recent analysis
    if (response.data.data.vehicle.lastAnalysis) {
      console.log('\nLast Analysis:');
      console.log(`  Type: ${response.data.data.vehicle.lastAnalysis.analysisType}`);
      console.log(`  Confidence: ${response.data.data.vehicle.lastAnalysis.confidence}`);
      console.log(`  Generated: ${response.data.data.vehicle.lastAnalysis.generatedAt}`);
    }

    return response.data.data;
  } catch (error) {
    console.error('Error getting vehicle analysis:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Example 6: Get alerts and recommendations
 */
async function getAlertsAndRecommendations(timeRange = '30d', severity = null) {
  try {
    console.log(`Getting alerts and recommendations for time range: ${timeRange}`);
    
    // Get alerts
    const alertsParams = { timeRange };
    if (severity) alertsParams.severity = severity;
    
    const alertsResponse = await api.get('/analysis/alerts', { params: alertsParams });
    
    // Get recommendations
    const recommendationsResponse = await api.get('/analysis/recommendations', {
      params: { timeRange, priority: 'high' }
    });

    console.log('Alerts and recommendations retrieved!');
    
    // Display alerts
    console.log('\nAlerts:');
    console.log(`  Critical: ${alertsResponse.data.data.critical.length}`);
    console.log(`  Warning: ${alertsResponse.data.data.warning.length}`);
    console.log(`  Info: ${alertsResponse.data.data.info.length}`);
    console.log(`  Recent: ${alertsResponse.data.data.recent.length}`);
    
    // Display recent critical alerts
    if (alertsResponse.data.data.critical.length > 0) {
      console.log('\nRecent Critical Alerts:');
      alertsResponse.data.data.critical.slice(0, 3).forEach((alert, index) => {
        console.log(`  ${index + 1}. ${alert.issue.code}: ${alert.issue.description}`);
        console.log(`     Session: ${alert.sessionId}, Time: ${alert.timestamp}`);
      });
    }
    
    // Display recommendations
    console.log('\nRecommendations:');
    recommendationsResponse.data.data.forEach((rec, index) => {
      console.log(`  ${index + 1}. ${rec.title} (${rec.priority})`);
      console.log(`     ${rec.description}`);
      console.log(`     Action: ${rec.action}`);
    });

    return {
      alerts: alertsResponse.data.data,
      recommendations: recommendationsResponse.data.data
    };
  } catch (error) {
    console.error('Error getting alerts and recommendations:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Example 7: Export analysis data
 */
async function exportAnalysisData(sessionId, format = 'json') {
  try {
    console.log(`Exporting analysis data for session: ${sessionId}`);
    
    const response = await api.get(`/obd2/sessions/${sessionId}/analysis/export`, {
      params: { format },
      responseType: format === 'csv' ? 'text' : 'json'
    });

    console.log('Analysis data exported successfully!');
    
    if (format === 'csv') {
      console.log('CSV data length:', response.data.length);
      console.log('First 200 characters:', response.data.substring(0, 200));
    } else {
      console.log('JSON export completed');
      console.log('Export date:', response.data.exportDate);
      console.log('Session ID:', response.data.sessionId);
    }

    return response.data;
  } catch (error) {
    console.error('Error exporting analysis data:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Main example function
 */
async function runExamples() {
  try {
    console.log('=== OBD2 Analysis System Examples ===\n');

    // Example session ID (replace with actual session ID)
    const sessionId = '68c0325677c57849e57c7718';
    const vehicleId = 'your-vehicle-id'; // Replace with actual vehicle ID

    // 1. Analyze complete session
    console.log('1. Analyzing complete session...');
    await analyzeCompleteSession(sessionId);
    console.log('\n' + '='.repeat(50) + '\n');

    // 2. Analyze specific parameters
    console.log('2. Analyzing specific parameters...');
    await analyzeSpecificParameters(sessionId, ['010C', '010D', '0105', '0111']);
    console.log('\n' + '='.repeat(50) + '\n');

    // 3. Get analysis results
    console.log('3. Getting analysis results...');
    await getAnalysisResults(sessionId);
    console.log('\n' + '='.repeat(50) + '\n');

    // 4. Get dashboard data
    console.log('4. Getting dashboard data...');
    await getDashboardData('30d');
    console.log('\n' + '='.repeat(50) + '\n');

    // 5. Get vehicle analysis summary
    console.log('5. Getting vehicle analysis summary...');
    await getVehicleAnalysisSummary(vehicleId, '30d');
    console.log('\n' + '='.repeat(50) + '\n');

    // 6. Get alerts and recommendations
    console.log('6. Getting alerts and recommendations...');
    await getAlertsAndRecommendations('30d', 'critical');
    console.log('\n' + '='.repeat(50) + '\n');

    // 7. Export analysis data
    console.log('7. Exporting analysis data...');
    await exportAnalysisData(sessionId, 'json');
    console.log('\n' + '='.repeat(50) + '\n');

    console.log('All examples completed successfully!');

  } catch (error) {
    console.error('Example execution failed:', error.message);
  }
}

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runExamples();
}

export {
  analyzeCompleteSession,
  analyzeSpecificParameters,
  getAnalysisResults,
  getDashboardData,
  getVehicleAnalysisSummary,
  getAlertsAndRecommendations,
  exportAnalysisData
};
