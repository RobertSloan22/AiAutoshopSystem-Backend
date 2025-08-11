import axios from 'axios';

const API_URL = 'http://localhost:5000/api/integrated-research';

// Test the health endpoint
async function testHealthCheck() {
  try {
    console.log('Testing health check endpoint...');
    const response = await axios.get(`${API_URL}/health`);
    console.log('Health check response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Health check error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

// Test the regular research endpoint
async function testResearch(query) {
  try {
    console.log(`Testing research endpoint with query: "${query}"...`);
    const response = await axios.post(`${API_URL}/research`, { query });
    console.log('Research response summary:', {
      success: response.data.success,
      query: response.data.query,
      reportSummary: response.data.result?.report?.shortSummary,
      numSearches: response.data.result?.searchPlan?.searches?.length
    });
    return response.data;
  } catch (error) {
    console.error('Research error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

// Run the tests
async function runTests() {
  try {
    // First test health check
    await testHealthCheck();
    
    // Then test research with a simple query
    const testQuery = 'What are the latest advances in electric vehicle technology?';
    await testResearch(testQuery);
    
    console.log('All tests completed successfully!');
  } catch (error) {
    console.error('Test failed:', error.message);
    process.exit(1);
  }
}

runTests();