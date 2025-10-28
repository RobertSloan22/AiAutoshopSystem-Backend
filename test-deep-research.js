#!/usr/bin/env node

import dotenv from 'dotenv';
import axios from 'axios';

// Load environment variables
dotenv.config();

const BASE_URL = 'http://localhost:5005';

async function testDeepResearch() {
    console.log('🔬 Testing Deep Research Service Integration...\n');

    try {
        // Test 1: Health Check
        console.log('1. Testing health check...');
        const healthResponse = await axios.get(`${BASE_URL}/api/deep-research/health`);
        console.log('✅ Health check result:', healthResponse.data);
        console.log();

        // Test 2: Quick Research
        console.log('2. Testing quick research...');
        const quickResearchResponse = await axios.post(`${BASE_URL}/api/deep-research/quick`, {
            query: "What is OBD2 protocol?",
            options: { timeout: 30000 }
        });
        console.log('✅ Quick research completed:', quickResearchResponse.data.success);
        if (quickResearchResponse.data.research) {
            console.log('Research preview:', quickResearchResponse.data.research.substring(0, 200) + '...');
        }
        console.log();

        // Test 3: DTC Code Research
        console.log('3. Testing DTC code research...');
        const dtcResponse = await axios.post(`${BASE_URL}/api/deep-research/dtc-codes`, {
            dtcCodes: ['P0171', 'P0174'],
            vehicleInfo: {
                year: '2018',
                make: 'Toyota',
                model: 'Camry',
                engine: '2.5L 4-cylinder'
            }
        });
        console.log('✅ DTC research completed:', dtcResponse.data.success);
        if (dtcResponse.data.research) {
            console.log('DTC research preview:', dtcResponse.data.research.substring(0, 200) + '...');
        }
        console.log();

        // Test 4: Parts Compatibility
        console.log('4. Testing parts compatibility research...');
        const partsResponse = await axios.post(`${BASE_URL}/api/deep-research/parts-compatibility`, {
            partQuery: "brake pads front",
            vehicleInfo: {
                year: '2020',
                make: 'Honda',
                model: 'Civic'
            }
        });
        console.log('✅ Parts compatibility research completed:', partsResponse.data.success);
        if (partsResponse.data.research) {
            console.log('Parts research preview:', partsResponse.data.research.substring(0, 200) + '...');
        }
        console.log();

        console.log('🎉 All deep research tests completed successfully!');

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
        
        if (error.response?.status === 500 && error.response?.data?.message) {
            console.log('\n💡 Troubleshooting tips:');
            console.log('- Make sure your OpenAI API key is set in .env file');
            console.log('- Verify the server is running on port 5005');
            console.log('- Check that @openai/agents package is properly installed');
        }
    }
}

// Check if server is running first
async function checkServer() {
    try {
        await axios.get(`${BASE_URL}/health`);
        return true;
    } catch (error) {
        console.log('❌ Server is not running on', BASE_URL);
        console.log('Please start the server with: npm start');
        return false;
    }
}

// Main execution
(async () => {
    const serverRunning = await checkServer();
    if (serverRunning) {
        await testDeepResearch();
    }
})();