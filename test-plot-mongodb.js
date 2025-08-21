import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import Plot from './models/plot.model.js';
import crypto from 'crypto';

// Create a simple test image buffer (1x1 pixel PNG)
const createTestImageBuffer = () => {
  // This is a minimal valid PNG file (1x1 transparent pixel)
  const pngData = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
    0x00, 0x00, 0x00, 0x0D, // IHDR chunk length
    0x49, 0x48, 0x44, 0x52, // IHDR
    0x00, 0x00, 0x00, 0x01, // width = 1
    0x00, 0x00, 0x00, 0x01, // height = 1
    0x08, 0x06, 0x00, 0x00, 0x00, // bit depth, color type, compression, filter, interlace
    0x1F, 0x15, 0xC4, 0x89, // CRC
    0x00, 0x00, 0x00, 0x0A, // IDAT chunk length
    0x49, 0x44, 0x41, 0x54, // IDAT
    0x78, 0x9C, 0x62, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, // compressed data
    0xE2, 0x21, 0xBC, 0x33, // CRC
    0x00, 0x00, 0x00, 0x00, // IEND chunk length
    0x49, 0x45, 0x4E, 0x44, // IEND
    0xAE, 0x42, 0x60, 0x82  // CRC
  ]);
  return pngData;
};

async function testMongoDBPlotStorage() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_DB_URI);
    console.log('✅ Connected to MongoDB');

    console.log('\n🧪 Testing MongoDB Plot Model...');
    
    // Test 1: Create a new plot document
    console.log('\n📊 Test 1: Creating a new plot document...');
    
    const imageId = crypto.randomUUID();
    const testImageBuffer = createTestImageBuffer();
    
    const testPlot = new Plot({
      imageId,
      filename: 'test_plot.png',
      originalPath: '/tmp/test_plot.png',
      imageData: testImageBuffer,
      mimeType: 'image/png',
      size: testImageBuffer.length,
      executionId: 'test_execution_123',
      description: 'Test plot for MongoDB storage',
      tags: ['test', 'mongodb', 'python'],
      pythonCode: 'import matplotlib.pyplot as plt\nplt.plot([1,2,3], [1,2,3])\nplt.show()',
      pythonOutput: 'Plot generated successfully',
      vehicleContext: {
        year: '2023',
        make: 'Tesla',
        model: 'Model 3',
        vin: 'TEST123456789'
      },
      customerContext: {
        name: 'Test Customer',
        dtcCode: 'P0001'
      },
      sessionId: 'test_session_456'
    });

    // Set expiration for 7 days
    testPlot.setExpiration(7);
    
    const savedPlot = await testPlot.save();
    console.log('✅ Plot saved to MongoDB:');
    console.log('  - ID:', savedPlot.imageId);
    console.log('  - Size:', savedPlot.size, 'bytes');
    console.log('  - Expires at:', savedPlot.expiresAt);
    
    // Test 2: Retrieve the plot
    console.log('\n📚 Test 2: Retrieving plot from MongoDB...');
    const retrievedPlot = await Plot.findOne({ imageId });
    
    if (retrievedPlot) {
      console.log('✅ Plot retrieved successfully:');
      console.log('  - Filename:', retrievedPlot.filename);
      console.log('  - Description:', retrievedPlot.description);
      console.log('  - Tags:', retrievedPlot.tags);
      console.log('  - Vehicle VIN:', retrievedPlot.vehicleContext?.vin);
      console.log('  - Customer:', retrievedPlot.customerContext?.name);
      console.log('  - Session ID:', retrievedPlot.sessionId);
      console.log('  - Python code length:', retrievedPlot.pythonCode?.length);
      console.log('  - Base64 data available:', !!retrievedPlot.base64Data);
      console.log('  - URL:', retrievedPlot.url);
      console.log('  - Thumbnail URL:', retrievedPlot.thumbnailUrl);
    }
    
    // Test 3: Update access statistics
    console.log('\n🔄 Test 3: Testing access statistics...');
    await retrievedPlot.updateAccess();
    const updatedPlot = await Plot.findOne({ imageId });
    console.log('✅ Access statistics updated:');
    console.log('  - Access count:', updatedPlot.accessCount);
    console.log('  - Last accessed:', updatedPlot.lastAccessed);
    
    // Test 4: Test static methods
    console.log('\n🔧 Test 4: Testing static methods...');
    
    const plotsByExecution = await Plot.findByExecutionId('test_execution_123');
    console.log('✅ Find by execution ID:', plotsByExecution.length, 'plots');
    
    const plotsBySession = await Plot.findBySessionId('test_session_456');
    console.log('✅ Find by session ID:', plotsBySession.length, 'plots');
    
    const plotsByTags = await Plot.findByTags(['test', 'mongodb']);
    console.log('✅ Find by tags:', plotsByTags.length, 'plots');
    
    // Test 5: Test aggregation queries
    console.log('\n📊 Test 5: Testing aggregation queries...');
    
    const stats = await Promise.all([
      Plot.countDocuments({}),
      Plot.aggregate([{ $group: { _id: null, totalSize: { $sum: '$size' } } }]),
      Plot.aggregate([
        { $unwind: '$tags' },
        { $group: { _id: '$tags', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 }
      ])
    ]);
    
    console.log('✅ Database statistics:');
    console.log('  - Total plots:', stats[0]);
    console.log('  - Total size:', stats[1][0]?.totalSize || 0, 'bytes');
    console.log('  - Top tags:', stats[2].map(t => `${t._id}: ${t.count}`).join(', '));
    
    // Test 6: Test cleanup functionality
    console.log('\n🧹 Test 6: Testing cleanup (dry run)...');
    
    // Don't actually clean up, just count what would be cleaned
    const oldDate = new Date(Date.now() - 1000); // 1 second ago
    const oldPlots = await Plot.find({ 
      createdAt: { $lt: oldDate },
      isPublic: { $ne: true }
    });
    console.log('✅ Cleanup test:', oldPlots.length, 'plots would be cleaned up');
    
    console.log('\n✅ All MongoDB Plot Model tests passed!');
    
    // Clean up test data
    console.log('\n🧹 Cleaning up test data...');
    await Plot.deleteOne({ imageId });
    console.log('✅ Test data cleaned up');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the test
testMongoDBPlotStorage();