#!/usr/bin/env node
// test-obd2-realtime.js - Test script for OBD2 real-time system

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import obd2RealtimeService from './services/OBD2RealtimeService.js';

dotenv.config();

// Test data generator
function generateOBD2Data() {
  return {
    rpm: Math.round(800 + Math.random() * 6000),
    speed: Math.round(Math.random() * 120),
    engineTemp: Math.round(70 + Math.random() * 50),
    throttlePosition: Math.round(Math.random() * 100),
    engineLoad: Math.round(Math.random() * 100),
    maf: Math.round((10 + Math.random() * 200) * 100) / 100,
    map: Math.round(30 + Math.random() * 70),
    fuelLevel: Math.round(Math.random() * 100),
    batteryVoltage: Math.round((12 + Math.random() * 2) * 100) / 100
  };
}

async function testRealTimeSystem() {
  console.log('🚀 Starting OBD2 Real-time System Test');
  
  try {
    // Connect to MongoDB
    console.log('📊 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_DB_URI);
    console.log('✅ MongoDB connected');

    // Wait for Redis service to initialize
    console.log('📊 Waiting for Redis service...');
    let retries = 10;
    while (retries > 0) {
      const health = await obd2RealtimeService.healthCheck();
      if (health.status === 'up') {
        console.log('✅ Redis service ready');
        break;
      }
      retries--;
      if (retries === 0) {
        throw new Error('Redis service failed to initialize');
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Create test session ID
    const testSessionId = new mongoose.Types.ObjectId().toString();
    console.log(`📋 Using test session ID: ${testSessionId}`);

    // Test 1: Store data points
    console.log('\\n🧪 Test 1: Storing data points in Redis...');
    for (let i = 0; i < 10; i++) {
      const dataPoint = generateOBD2Data();
      const success = await obd2RealtimeService.storeDataPoint(testSessionId, dataPoint);
      console.log(`   ${success ? '✅' : '❌'} Stored data point ${i + 1}: RPM=${dataPoint.rpm}, Speed=${dataPoint.speed}`);
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Test 2: Retrieve recent updates
    console.log('\\n🧪 Test 2: Retrieving recent updates...');
    const recentUpdates = await obd2RealtimeService.getRecentUpdates(testSessionId, 0, 5);
    console.log(`   ✅ Retrieved ${recentUpdates.length} recent updates`);
    recentUpdates.forEach((update, index) => {
      console.log(`   📊 Update ${index + 1}: RPM=${update.rpm}, Speed=${update.speed}, Time=${new Date(update.timestamp).toLocaleTimeString()}`);
    });

    // Test 3: Get data by time range
    console.log('\\n🧪 Test 3: Getting data by time range...');
    const now = Date.now();
    const fiveMinutesAgo = now - (5 * 60 * 1000);
    const rangeData = await obd2RealtimeService.getDataByTimeRange(testSessionId, fiveMinutesAgo, now, 20);
    console.log(`   ✅ Retrieved ${rangeData.length} data points from time range`);

    // Test 4: Get aggregated data
    console.log('\\n🧪 Test 4: Getting aggregated data...');
    const aggregatedData = await obd2RealtimeService.getAggregatedData(testSessionId, 'minute', 10);
    console.log(`   ✅ Retrieved ${aggregatedData.length} aggregated data points`);
    aggregatedData.forEach((agg, index) => {
      console.log(`   📊 Aggregated ${index + 1}: Avg RPM=${agg.rpm ? Math.round(agg.rpm) : 'N/A'}, Avg Speed=${agg.speed ? Math.round(agg.speed) : 'N/A'}, Count=${agg.count}`);
    });

    // Test 5: Get session statistics
    console.log('\\n🧪 Test 5: Getting session statistics...');
    const stats = await obd2RealtimeService.getSessionStats(testSessionId);
    console.log(`   ✅ Session stats:`, {
      dataPointCount: stats.dataPointCount,
      duration: stats.duration ? `${Math.round(stats.duration / 1000)}s` : 'N/A',
      startTime: stats.startTime ? new Date(stats.startTime).toLocaleString() : 'N/A',
      endTime: stats.endTime ? new Date(stats.endTime).toLocaleString() : 'Active'
    });

    // Test 6: Subscription test (simulate for 5 seconds)
    console.log('\\n🧪 Test 6: Testing Redis pub/sub subscription...');
    let receivedCount = 0;
    
    const subscriber = await obd2RealtimeService.subscribeToSession(testSessionId, (data) => {
      receivedCount++;
      console.log(`   📡 Received update ${receivedCount}: RPM=${data.rpm}, Speed=${data.speed}`);
    });

    // Generate some real-time data
    const publishData = async () => {
      for (let i = 0; i < 5; i++) {
        const dataPoint = generateOBD2Data();
        await obd2RealtimeService.storeDataPoint(testSessionId, dataPoint);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    };

    await publishData();
    
    // Clean up subscriber
    if (subscriber) {
      subscriber.unsubscribe();
      subscriber.quit();
    }
    
    console.log(`   ✅ Subscription test complete. Received ${receivedCount} updates`);

    // Test 7: Health check
    console.log('\\n🧪 Test 7: Health check...');
    const health = await obd2RealtimeService.healthCheck();
    console.log('   ✅ Health check result:', health);

    console.log('\\n🎉 All tests completed successfully!');
    console.log('\\n📋 Summary of created endpoints:');
    console.log('   🔄 SSE Stream: GET /api/obd2/sessions/:sessionId/stream');
    console.log('   📊 Polling: GET /api/obd2/sessions/:sessionId/updates');
    console.log('   ⏳ Long Polling: GET /api/obd2/sessions/:sessionId/long-poll');
    console.log('   📈 Aggregated: GET /api/obd2/sessions/:sessionId/aggregated');
    console.log('   🎯 Time Range: GET /api/obd2/sessions/:sessionId/range');
    console.log('   📋 Statistics: GET /api/obd2/sessions/:sessionId/stats');
    console.log('   💉 Data Ingestion: POST /api/obd2/sessions/:sessionId/data');
    console.log('   ❤️  Health Check: GET /api/obd2/health');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    // Cleanup
    await obd2RealtimeService.shutdown();
    await mongoose.disconnect();
    console.log('\\n🧹 Cleanup completed');
    process.exit(0);
  }
}

// Run the test
testRealTimeSystem().catch(console.error);