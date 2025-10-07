#!/usr/bin/env node

/**
 * OBD2 Analysis System Setup Script
 * 
 * This script helps set up the OBD2 Analysis System by:
 * 1. Verifying dependencies
 * 2. Checking database connections
 * 3. Creating necessary indexes
 * 4. Running initial tests
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const config = {
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-autoshop',
  requiredEnvVars: [
    'MONGODB_URI',
    'JWT_SECRET',
    'PORT'
  ],
  analysisConfig: {
    analysisInterval: 30000,
    minDataPoints: 10,
    anomalyThreshold: 2.0,
    performanceWindow: 300000
  }
};

/**
 * Check if all required environment variables are set
 */
function checkEnvironmentVariables() {
  console.log('🔍 Checking environment variables...');
  
  const missing = config.requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(envVar => console.error(`   - ${envVar}`));
    console.error('\nPlease set these variables in your .env file');
    return false;
  }
  
  console.log('✅ All required environment variables are set');
  return true;
}

/**
 * Test database connection
 */
async function testDatabaseConnection() {
  console.log('🔍 Testing database connection...');
  
  try {
    await mongoose.connect(config.mongoUri);
    console.log('✅ Database connection successful');
    
    // Test if we can access the OBD2Data collection
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    const obd2Collection = collections.find(col => col.name === 'obd2_data');
    
    if (obd2Collection) {
      console.log('✅ OBD2 data collection found');
    } else {
      console.log('⚠️  OBD2 data collection not found (this is normal for new installations)');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

/**
 * Create necessary database indexes
 */
async function createIndexes() {
  console.log('🔍 Creating database indexes...');
  
  try {
    const db = mongoose.connection.db;
    const obd2Collection = db.collection('obd2_data');
    
    // Create indexes for better performance
    const indexes = [
      { vehicleId: 1, sessionId: 1 },
      { userId: 1, createdAt: -1 },
      { 'parameters.timestamp': -1 },
      { processingStatus: 1, createdAt: -1 },
      { 'dtcCodes.code': 1 },
      { sessionId: 1 },
      { vehicleId: 1, userId: 1 }
    ];
    
    for (const index of indexes) {
      try {
        await obd2Collection.createIndex(index);
        console.log(`✅ Created index: ${JSON.stringify(index)}`);
      } catch (error) {
        if (error.code === 85) {
          console.log(`ℹ️  Index already exists: ${JSON.stringify(index)}`);
        } else {
          console.warn(`⚠️  Could not create index ${JSON.stringify(index)}: ${error.message}`);
        }
      }
    }
    
    return true;
  } catch (error) {
    console.error('❌ Failed to create indexes:', error.message);
    return false;
  }
}

/**
 * Test analysis service functionality
 */
async function testAnalysisService() {
  console.log('🔍 Testing analysis service...');
  
  try {
    // Import the analysis service
    const { default: obd2AnalysisService } = await import('../services/obd2AnalysisService.js');
    
    // Test basic functionality
    console.log('✅ Analysis service imported successfully');
    
    // Test parameter analysis
    const testParameters = [
      { pid: '010C', name: 'Engine RPM', value: 2500, unit: 'RPM', formattedValue: 2500 },
      { pid: '010D', name: 'Vehicle Speed', value: 60, unit: 'km/h', formattedValue: 60 },
      { pid: '0105', name: 'Engine Coolant Temperature', value: 90, unit: '°C', formattedValue: 90 }
    ];
    
    const analysis = obd2AnalysisService.analyzeParameterGroup(testParameters);
    
    if (analysis && analysis.statistics) {
      console.log('✅ Parameter analysis test passed');
      console.log(`   - Analyzed ${analysis.statistics.count} parameters`);
      console.log(`   - Average value: ${analysis.statistics.avg}`);
    } else {
      console.warn('⚠️  Parameter analysis test failed');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Analysis service test failed:', error.message);
    return false;
  }
}

/**
 * Test real-time analysis service
 */
async function testRealTimeAnalysisService() {
  console.log('🔍 Testing real-time analysis service...');
  
  try {
    // Import the real-time analysis service
    const { default: realTimeAnalysisService } = await import('../services/realTimeAnalysisService.js');
    
    console.log('✅ Real-time analysis service imported successfully');
    
    // Test basic functionality
    const testSessionId = 'test-session-' + Date.now();
    const testUserId = 'test-user';
    
    // Start analysis
    await realTimeAnalysisService.startRealTimeAnalysis(testSessionId, testUserId);
    console.log('✅ Real-time analysis started successfully');
    
    // Add test data
    const testDataPoint = {
      parameters: [
        { pid: '010C', name: 'Engine RPM', value: 2000, unit: 'RPM', formattedValue: 2000 }
      ],
      timestamp: new Date()
    };
    
    realTimeAnalysisService.addDataPoint(testSessionId, testDataPoint);
    console.log('✅ Test data point added successfully');
    
    // Stop analysis
    realTimeAnalysisService.stopRealTimeAnalysis(testSessionId);
    console.log('✅ Real-time analysis stopped successfully');
    
    return true;
  } catch (error) {
    console.error('❌ Real-time analysis service test failed:', error.message);
    return false;
  }
}

/**
 * Test dashboard service
 */
async function testDashboardService() {
  console.log('🔍 Testing dashboard service...');
  
  try {
    // Import the dashboard service
    const { default: analysisDashboardService } = await import('../services/analysisDashboardService.js');
    
    console.log('✅ Dashboard service imported successfully');
    
    // Test cache functionality
    const cacheStats = analysisDashboardService.getCacheStats();
    console.log(`✅ Cache system working (${cacheStats.size} items cached)`);
    
    // Test cache clear
    analysisDashboardService.clearCache();
    const clearedStats = analysisDashboardService.getCacheStats();
    console.log(`✅ Cache clear test passed (${clearedStats.size} items remaining)`);
    
    return true;
  } catch (error) {
    console.error('❌ Dashboard service test failed:', error.message);
    return false;
  }
}

/**
 * Display setup summary
 */
function displaySetupSummary(results) {
  console.log('\n' + '='.repeat(60));
  console.log('📊 OBD2 Analysis System Setup Summary');
  console.log('='.repeat(60));
  
  const totalTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter(result => result).length;
  
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${totalTests - passedTests}`);
  
  console.log('\nTest Results:');
  Object.entries(results).forEach(([test, passed]) => {
    console.log(`  ${passed ? '✅' : '❌'} ${test}`);
  });
  
  if (passedTests === totalTests) {
    console.log('\n🎉 All tests passed! The OBD2 Analysis System is ready to use.');
    console.log('\nNext steps:');
    console.log('1. Start your server: npm start');
    console.log('2. Test the API endpoints using the examples in /examples/');
    console.log('3. Check the API documentation at /api-docs');
  } else {
    console.log('\n⚠️  Some tests failed. Please check the errors above and try again.');
  }
  
  console.log('\nConfiguration:');
  console.log(`  Analysis Interval: ${config.analysisConfig.analysisInterval}ms`);
  console.log(`  Min Data Points: ${config.analysisConfig.minDataPoints}`);
  console.log(`  Anomaly Threshold: ${config.analysisConfig.anomalyThreshold}`);
  console.log(`  Performance Window: ${config.analysisConfig.performanceWindow}ms`);
}

/**
 * Main setup function
 */
async function setup() {
  console.log('🚀 OBD2 Analysis System Setup');
  console.log('='.repeat(40));
  
  const results = {};
  
  // Run all tests
  results.environmentVariables = checkEnvironmentVariables();
  
  if (results.environmentVariables) {
    results.databaseConnection = await testDatabaseConnection();
    
    if (results.databaseConnection) {
      results.indexes = await createIndexes();
      results.analysisService = await testAnalysisService();
      results.realTimeAnalysis = await testRealTimeAnalysisService();
      results.dashboardService = await testDashboardService();
    }
  }
  
  // Display summary
  displaySetupSummary(results);
  
  // Close database connection
  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
    console.log('\n🔌 Database connection closed');
  }
  
  // Exit with appropriate code
  const allPassed = Object.values(results).every(result => result);
  process.exit(allPassed ? 0 : 1);
}

// Run setup if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setup().catch(error => {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  });
}

export { setup, config };
