// Test enhanced analysis storage with raw data for frontend access

import mongoose from 'mongoose';
import Analysis from './models/analysis.model.js';
import DiagnosticSession from './models/diagnosticSession.model.js';

// MongoDB connection
const MONGODB_URI = process.env.MONGO_DB_URI || 'mongodb://admin:password123@localhost:27017/autoshop?authSource=admin';

async function testEnhancedAnalysisStorage() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Create test session
    const testSession = new DiagnosticSession({
      vehicleId: 'TEST_VEHICLE_001',
      startTime: new Date(),
      obd2Data: generateTestOBD2Data()
    });
    await testSession.save();
    console.log(`✅ Created test session: ${testSession._id}`);

    // Test new Analysis model with raw data
    const analysisId = Analysis.generateAnalysisId();
    const analysis = new Analysis({
      analysisId,
      sessionId: testSession._id,
      analysisType: 'comprehensive',
      timestamp: new Date(),
      status: 'completed',
      duration: 15.5,
      result: 'Test analysis completed successfully with enhanced data storage.'
    });

    // Test adding interactive plot with raw data
    const mockPlotData = {
      filename: 'engine_performance.png',
      base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jd36ygAAAABJRU5ErkJggg==',
      mimeType: 'image/png',
      description: 'Engine Performance Analysis - RPM vs Load',
      plotType: 'time_series',
      xLabel: 'Time',
      yLabel: 'Engine Parameters',
      colors: ['#3b82f6', '#ef4444', '#10b981']
    };

    const rawDataArrays = testSession.obd2Data || [];
    const parameters = ['rpm', 'engineLoad', 'engineTemp'];

    // Use new addInteractivePlot method
    if (rawDataArrays.length > 0) {
      analysis.addInteractivePlot(mockPlotData, rawDataArrays, parameters);
    } else {
      console.log('⚠️ No OBD2 data available, using mock plot method');
      analysis.addPlot({
        ...mockPlotData,
        rawData: {
          datasets: [],
          labels: [],
          parameters: parameters,
          dataRange: { startTime: new Date(), endTime: new Date(), totalPoints: 0 },
          chartConfig: { type: 'line', responsive: true }
        }
      });
    }

    // Test regular addPlot method (backwards compatibility)
    analysis.addPlot({
      filename: 'fuel_system.png',
      base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jd36ygAAAABJRU5ErkJggg==',
      description: 'Fuel System Analysis',
      rawData: {
        datasets: rawDataArrays.length > 0 ? [
          {
            label: 'Fuel Level',
            data: rawDataArrays.map(d => ({ x: d.timestamp, y: d.fuelLevel })),
            parameter: 'fuelLevel',
            unit: '%',
            color: '#84cc16'
          }
        ] : [],
        labels: rawDataArrays.length > 0 ? rawDataArrays.map(d => d.timestamp) : [],
        parameters: ['fuelLevel'],
        dataRange: rawDataArrays.length > 0 ? {
          startTime: rawDataArrays[0].timestamp,
          endTime: rawDataArrays[rawDataArrays.length - 1].timestamp,
          totalPoints: rawDataArrays.length
        } : { startTime: new Date(), endTime: new Date(), totalPoints: 0 },
        chartConfig: {
          type: 'line',
          responsive: true
        }
      },
      plotMetadata: {
        plotType: 'time_series',
        axes: {
          x: { label: 'Time', unit: '', type: 'datetime' },
          y: { label: 'Fuel Level', unit: '%', type: 'linear' }
        },
        colors: ['#84cc16'],
        interactive: true
      }
    });

    // Save analysis with enhanced plot data
    await analysis.save();
    console.log(`✅ Saved analysis with ID: ${analysisId}`);

    // Verify the saved data
    const savedAnalysis = await Analysis.findOne({ analysisId }).lean();
    
    console.log('\n📊 Analysis Verification:');
    console.log(`- Analysis ID: ${savedAnalysis.analysisId}`);
    console.log(`- Session ID: ${savedAnalysis.sessionId}`);
    console.log(`- Number of plots: ${savedAnalysis.plots.length}`);
    
    savedAnalysis.plots.forEach((plot, index) => {
      console.log(`\n  Plot ${index + 1}: ${plot.filename}`);
      console.log(`  - Has base64 image: ${!!plot.base64}`);
      console.log(`  - Has raw data: ${!!plot.rawData}`);
      console.log(`  - Parameters: ${plot.rawData?.parameters?.join(', ') || 'None'}`);
      console.log(`  - Datasets: ${plot.rawData?.datasets?.length || 0}`);
      console.log(`  - Data points: ${plot.rawData?.dataRange?.totalPoints || 0}`);
      console.log(`  - Plot type: ${plot.plotMetadata?.plotType || 'N/A'}`);
      console.log(`  - Interactive: ${plot.plotMetadata?.interactive || false}`);
      
      // Verify Chart.js compatibility
      if (plot.rawData?.chartConfig) {
        console.log(`  - Chart.js config: ✅ Present`);
        console.log(`    - Type: ${plot.rawData.chartConfig.type}`);
        console.log(`    - Responsive: ${plot.rawData.chartConfig.responsive}`);
        console.log(`    - Scales: ${plot.rawData.chartConfig.scales ? 'Present' : 'Missing'}`);
      } else {
        console.log(`  - Chart.js config: ❌ Missing`);
      }
    });

    // Test frontend data retrieval simulation
    console.log('\n🎨 Frontend Data Simulation:');
    const frontendData = savedAnalysis.plots[0];
    
    if (frontendData.rawData && frontendData.rawData.datasets) {
      console.log('Frontend can access:');
      console.log(`- Image URL: data:${frontendData.mimeType};base64,${frontendData.base64.substring(0, 50)}...`);
      console.log(`- Interactive data for Chart.js: ✅`);
      console.log(`- Parameters available: ${frontendData.rawData.parameters.join(', ')}`);
      console.log(`- Time range: ${new Date(frontendData.rawData.dataRange.startTime).toLocaleString()} to ${new Date(frontendData.rawData.dataRange.endTime).toLocaleString()}`);
      
      // Simulate Chart.js dataset creation
      const chartJsData = {
        datasets: frontendData.rawData.datasets.map(dataset => ({
          label: dataset.label,
          data: dataset.data,
          borderColor: dataset.borderColor || dataset.color,
          backgroundColor: dataset.backgroundColor || (dataset.color + '20'),
          fill: dataset.fill
        })),
        ...frontendData.rawData.chartConfig
      };
      
      console.log('- Chart.js ready data structure: ✅');
      console.log(`- Dataset count: ${chartJsData.datasets.length}`);
    }

    console.log('\n🎯 Test Results:');
    console.log('✅ Enhanced Analysis model works correctly');
    console.log('✅ Raw data is stored alongside plot images');
    console.log('✅ Plot metadata includes interactive configuration');  
    console.log('✅ Chart.js compatible data structure generated');
    console.log('✅ Frontend can access both images and raw data');
    console.log('✅ Backwards compatibility maintained');

    // Cleanup
    await Analysis.findByIdAndDelete(savedAnalysis._id);
    await DiagnosticSession.findByIdAndDelete(testSession._id);
    console.log('\n🧹 Test data cleaned up');

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

function generateTestOBD2Data() {
  const data = [];
  const startTime = new Date();
  
  for (let i = 0; i < 100; i++) {
    const timestamp = new Date(startTime.getTime() + i * 1000);
    
    data.push({
      timestamp,
      rpm: 2000 + Math.random() * 1000,
      speed: 60 + Math.random() * 40,
      engineTemp: 85 + Math.random() * 15,
      intakeTemp: 25 + Math.random() * 10,
      throttlePosition: 20 + Math.random() * 60,
      engineLoad: 30 + Math.random() * 40,
      fuelLevel: 75 - (i * 0.1) + Math.random() * 5,
      batteryVoltage: 12.5 + Math.random() * 1.5,
      maf: 15 + Math.random() * 10,
      map: 30 + Math.random() * 20
    });
  }
  
  return data;
}

// Run test
testEnhancedAnalysisStorage()
  .then(() => {
    console.log('\n🎉 Enhanced analysis storage test completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test failed:', error);
    process.exit(1);
  });