import fetch from 'node-fetch';

// Set the base URL for your API
const baseUrl = 'http://localhost:5000/api';

async function testJokeRoute() {
  try {
    console.log('Testing GET /api/functions/get_joke...');
    const response = await fetch(`${baseUrl}/functions/get_joke`);
    const data = await response.json();
    
    if (response.ok && data.joke) {
      console.log('✅ Joke route test passed');
      console.log(`Joke: ${data.joke}`);
    } else {
      console.log('❌ Joke route test failed');
      console.log(data);
    }
  } catch (error) {
    console.error('❌ Joke route test error:', error.message);
  }
}

async function testWeatherRoute() {
  try {
    console.log('Testing GET /api/functions/get_weather...');
    const location = 'New York';
    const response = await fetch(`${baseUrl}/functions/get_weather?location=${encodeURIComponent(location)}`);
    const data = await response.json();
    
    if (response.ok && data.temperature !== undefined) {
      console.log('✅ Weather route test passed');
      console.log(`Temperature in ${location}: ${data.temperature}°C`);
    } else {
      console.log('❌ Weather route test failed');
      console.log(data);
    }
  } catch (error) {
    console.error('❌ Weather route test error:', error.message);
  }
}

async function testVectorStoreListRoute() {
  try {
    console.log('Testing GET /api/vector_stores/list_files...');
    const vectorStoreId = 'your_vector_store_id'; // Replace with a valid ID
    const response = await fetch(`${baseUrl}/vector_stores/list_files?vector_store_id=${vectorStoreId}`);
    
    console.log(`Status: ${response.status}`);
    
    if (response.ok) {
      console.log('✅ Vector store list route is accessible');
    } else {
      console.log('❌ Vector store list route returned an error (this might be expected if the ID is invalid)');
    }
  } catch (error) {
    console.error('❌ Vector store list route test error:', error.message);
  }
}

async function testHealthRoute() {
  try {
    console.log('Testing GET /api/health...');
    const response = await fetch(`${baseUrl}/health`);
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Health route test passed');
      console.log('API Status:', data.status);
      console.log('OpenAI API Key Status:', data.openaiApiKeyStatus);
      console.log('Available Routes:', data.routes.length);
    } else {
      console.log('❌ Health route test failed');
      console.log(data);
    }
  } catch (error) {
    console.error('❌ Health route test error:', error.message);
  }
}

async function runTests() {
  console.log('🔍 Starting API routes tests...');
  
  // First check health endpoint
  await testHealthRoute();
  console.log('\n--------------------------\n');
  
  await testJokeRoute();
  console.log('\n--------------------------\n');
  
  await testWeatherRoute();
  console.log('\n--------------------------\n');
  
  await testVectorStoreListRoute();
  console.log('\n--------------------------\n');
  
  console.log('🏁 API routes tests completed.');
}

runTests().catch(console.error);