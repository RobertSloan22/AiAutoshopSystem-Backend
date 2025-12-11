import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5005';
const API_BASE = `${BASE_URL}/api/obd2`;

// Test data for comprehensive report
const sampleReport = {
  summary: "Test comprehensive diagnostic report for engine performance issues",
  activitySummary: "Session recorded 450 data points over 15 minutes with continuous monitoring",
  analysisResults: "Analysis indicates cylinder 1 misfire pattern and lean fuel condition",
  recommendations: [
    "Replace spark plug in cylinder 1",
    "Check ignition coil for cylinder 1", 
    "Verify fuel injector operation"
  ],
  keyFindings: [
    "Cylinder 1 misfire confirmed via RPM variation",
    "Fuel trim indicates lean condition",
    "O2 sensor shows delayed response"
  ],
  priority: "high",
  sessionStartTime: "2025-11-18T10:00:00.000Z",
  sessionEndTime: "2025-11-18T10:15:00.000Z",
  dataPointsCount: 450,
  sessionDuration: 900,
  vehicleId: "test-vehicle-456",
  vehicleMake: "Toyota",
  vehicleModel: "Camry", 
  vehicleYear: 2020,
  vin: "4T1B11HK5KU123456",
  mileage: 45000,
  licensePlate: "TEST-123",
  customerId: "test-customer-789",
  customerName: "Test User",
  dtcCodes: ["P0301", "P0302"],
  pendingDtcCodes: ["P0303"],
  permanentDtcCodes: [],
  priorityDtcCodes: ["P0301"],
  aiDiagnosticSteps: [
    {
      id: "step-1",
      title: "Visual Inspection", 
      description: "Inspect spark plugs and ignition coils for wear and damage",
      priority: 1,
      category: "inspection",
      estimatedTime: "15-20 minutes",
      tools: ["Flashlight", "Basic Hand Tools"],
      difficulty: "easy",
      order: 1
    }
  ],
  analysisType: "misfire",
  focusAreas: ["rpm", "fuelTrim", "o2Sensor"],
  monitoredPIDs: ["rpm", "speed", "engineTemp", "fuelTrimShortB1"],
  analysisTimestamp: "2025-11-18T10:20:00.000Z",
  technician: "Test Technician",
  location: "Service Bay 1",
  reportVersion: "1.0"
};

async function testEndpoints() {
  console.log('🧪 Testing Comprehensive Reports API Endpoints\n');
  
  let sessionId = null;
  let reportId = null;
  
  try {
    // First, create a valid diagnostic session
    console.log('0️⃣  Creating a test diagnostic session...');
    const createSessionResponse = await fetch(`${API_BASE}/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: 'test-user-123',
        vehicleId: 'test-vehicle-456',
        sessionName: 'Test Comprehensive Report Session'
      })
    });
    
    const sessionResult = await createSessionResponse.json();
    console.log('   Status:', createSessionResponse.status);
    
    if (sessionResult.success && sessionResult.session) {
      sessionId = sessionResult.session._id;
      console.log('   ✅ Test session created with ID:', sessionId);
    } else {
      console.log('   ❌ Failed to create test session, using fallback ObjectId');
      // Use a valid ObjectId format for testing
      sessionId = new (await import('mongoose')).Types.ObjectId().toString();
    }
    
    console.log('\n');
  } catch (error) {
    console.log('   ⚠️  Session creation failed, using valid ObjectId format for testing');
    sessionId = new (await import('mongoose')).Types.ObjectId().toString();
    console.log('   Using ObjectId:', sessionId);
    console.log('\n');
  }
  
  try {
    // Test 1: Save comprehensive report
    console.log('1️⃣  Testing POST /api/obd2/sessions/:sessionId/reports');
    const saveResponse = await fetch(`${API_BASE}/sessions/${sessionId}/reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(sampleReport)
    });
    
    const saveResult = await saveResponse.json();
    console.log('   Status:', saveResponse.status);
    console.log('   Response:', JSON.stringify(saveResult, null, 2));
    
    if (saveResult.success) {
      reportId = saveResult.reportId;
      console.log('   ✅ Report saved successfully with ID:', reportId);
    } else {
      console.log('   ❌ Failed to save report');
      return;
    }
    
    console.log('\n');
    
    // Test 2: Get latest report
    console.log('2️⃣  Testing GET /api/obd2/sessions/:sessionId/reports/latest');
    const latestResponse = await fetch(`${API_BASE}/sessions/${sessionId}/reports/latest`);
    const latestResult = await latestResponse.json();
    
    console.log('   Status:', latestResponse.status);
    console.log('   Response keys:', Object.keys(latestResult));
    
    if (latestResult.success) {
      console.log('   ✅ Latest report retrieved successfully');
      console.log('   Report ID:', latestResult.report.reportId);
      console.log('   Summary length:', latestResult.report.summary.length);
    } else {
      console.log('   ❌ Failed to get latest report');
    }
    
    console.log('\n');
    
    // Test 3: Get all reports for session
    console.log('3️⃣  Testing GET /api/obd2/sessions/:sessionId/reports');
    const allResponse = await fetch(`${API_BASE}/sessions/${sessionId}/reports?limit=10&offset=0`);
    const allResult = await allResponse.json();
    
    console.log('   Status:', allResponse.status);
    console.log('   Response keys:', Object.keys(allResult));
    
    if (allResult.success) {
      console.log('   ✅ All reports retrieved successfully');
      console.log('   Total reports:', allResult.total);
      console.log('   Reports returned:', allResult.reports.length);
    } else {
      console.log('   ❌ Failed to get all reports');
    }
    
    console.log('\n');
    
    // Test 4: Get specific report by ID
    if (reportId) {
      console.log('4️⃣  Testing GET /api/obd2/reports/:reportId');
      const reportResponse = await fetch(`${API_BASE}/reports/${reportId}`);
      const reportResult = await reportResponse.json();
      
      console.log('   Status:', reportResponse.status);
      console.log('   Response keys:', Object.keys(reportResult));
      
      if (reportResult.success) {
        console.log('   ✅ Specific report retrieved successfully');
        console.log('   Report ID:', reportResult.report.reportId);
      } else {
        console.log('   ❌ Failed to get specific report');
      }
      
      console.log('\n');
    }
    
    // Test 5: Error handling - invalid session
    console.log('5️⃣  Testing error handling with invalid session ID');
    const errorResponse = await fetch(`${API_BASE}/sessions/invalid-session-id/reports/latest`);
    const errorResult = await errorResponse.json();
    
    console.log('   Status:', errorResponse.status);
    console.log('   Response:', JSON.stringify(errorResult, null, 2));
    
    if (errorResponse.status === 404 && !errorResult.success) {
      console.log('   ✅ Error handling works correctly');
    } else {
      console.log('   ❌ Error handling may have issues');
    }
    
    console.log('\n');
    
    // Test 6: Validation error - missing required fields
    console.log('6️⃣  Testing validation with missing required fields');
    const invalidReport = { summary: "Test" }; // Missing dtcCodes
    const validationResponse = await fetch(`${API_BASE}/sessions/${sessionId}/reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(invalidReport)
    });
    
    const validationResult = await validationResponse.json();
    console.log('   Status:', validationResponse.status);
    console.log('   Response:', JSON.stringify(validationResult, null, 2));
    
    if (validationResponse.status === 400 && !validationResult.success) {
      console.log('   ✅ Validation works correctly');
    } else {
      console.log('   ❌ Validation may have issues');
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error('   Make sure the server is running on port 5005');
  }
}

// Run tests
testEndpoints();