import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import Plot from './models/plot.model.js';
import PythonExecutionService from './services/pythonExecutionService.js';

// Test the MongoDB plot storage system
async function testPlotStorage() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_DB_URI);
    console.log('✅ Connected to MongoDB');

    console.log('\n🧪 Testing MongoDB Plot Storage System...');
    
    // Initialize Python service
    const pythonService = new PythonExecutionService();
    
    // Test 1: Create a simple plot with Python code
    console.log('\n📊 Test 1: Creating a simple matplotlib plot...');
    const testCode = `
import matplotlib.pyplot as plt
import numpy as np

# Create sample data
x = np.linspace(0, 10, 100)
y = np.sin(x)

# Create plot
plt.figure(figsize=(10, 6))
plt.plot(x, y, 'b-', linewidth=2, label='sin(x)')
plt.title('Test Plot - Sine Wave')
plt.xlabel('X-axis')
plt.ylabel('Y-axis')
plt.legend()
plt.grid(True, alpha=0.3)

# Show plot (will be saved automatically)
plt.show()
print("Test plot generated successfully!")
`;

    const result = await pythonService.executeCode(testCode, {
      save_plots: true,
      plot_filename: 'test_sine_wave',
      sessionId: 'test_session_123',
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
      pythonCode: testCode
    });

    console.log('📝 Python execution result:', {
      success: result.success,
      plotsGenerated: result.plots?.length || 0,
      error: result.error
    });

    if (result.success && result.plots?.length > 0) {
      const plotId = result.plots[0].imageId;
      console.log('🆔 Generated plot ID:', plotId);
      
      // Test 2: Retrieve plot from MongoDB
      console.log('\n📚 Test 2: Retrieving plot from MongoDB...');
      const plotFromDB = await Plot.findOne({ imageId: plotId });
      
      if (plotFromDB) {
        console.log('✅ Plot found in MongoDB:');
        console.log('  - ID:', plotFromDB.imageId);
        console.log('  - Filename:', plotFromDB.filename);
        console.log('  - Size:', plotFromDB.size, 'bytes');
        console.log('  - Execution ID:', plotFromDB.executionId);
        console.log('  - Session ID:', plotFromDB.sessionId);
        console.log('  - Vehicle:', plotFromDB.vehicleContext?.year, plotFromDB.vehicleContext?.make, plotFromDB.vehicleContext?.model);
        console.log('  - Customer:', plotFromDB.customerContext?.name);
        console.log('  - Tags:', plotFromDB.tags);
        console.log('  - Created:', plotFromDB.createdAt);
        console.log('  - Has Python code:', !!plotFromDB.pythonCode);
        console.log('  - Base64 data length:', plotFromDB.base64Data?.length || 0);
      } else {
        console.log('❌ Plot not found in MongoDB');
      }
      
      // Test 3: Test plot service methods
      console.log('\n🔧 Test 3: Testing plot service methods...');
      const retrievedPlot = await pythonService.getPlotFromDB(plotId);
      if (retrievedPlot) {
        console.log('✅ Plot service retrieval works');
        console.log('  - Access count:', retrievedPlot.accessCount);
      }
      
      // Test 4: Test API URLs
      console.log('\n🌐 Test 4: Generated API URLs:');
      console.log('  - Plot URL:', `/api/plots/${plotId}`);
      console.log('  - Thumbnail URL:', `/api/plots/${plotId}/thumbnail`);
      console.log('  - Info URL:', `/api/plots/${plotId}/info`);
      console.log('  - Base64 URL:', `/api/plots/${plotId}/base64`);
      
      // Test 5: Query plots by context
      console.log('\n🔍 Test 5: Testing context-based queries...');
      
      const plotsBySession = await Plot.findBySessionId('test_session_123');
      console.log('  - Plots by session ID:', plotsBySession.length);
      
      const plotsByTag = await Plot.findByTags(['python']);
      console.log('  - Plots by tag "python":', plotsByTag.length);
      
      const plotsByVin = await Plot.find({ 'vehicleContext.vin': 'TEST123456789' });
      console.log('  - Plots by VIN:', plotsByVin.length);
      
      // Test 6: Statistics
      console.log('\n📊 Test 6: Plot statistics...');
      const totalPlots = await Plot.countDocuments({});
      const totalSize = await Plot.aggregate([
        { $group: { _id: null, totalSize: { $sum: '$size' } } }
      ]);
      console.log('  - Total plots in database:', totalPlots);
      console.log('  - Total storage used:', totalSize[0]?.totalSize || 0, 'bytes');
      
    } else {
      console.log('❌ Python execution failed or no plots generated');
    }
    
    console.log('\n✅ MongoDB Plot Storage System test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the test
testPlotStorage();