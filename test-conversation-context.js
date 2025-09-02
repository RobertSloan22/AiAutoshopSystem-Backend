#!/usr/bin/env node

// Simple test script to validate conversation context persistence
import axios from 'axios';

const BASE_URL = 'http://localhost:5000/api/responses';
const conversationId = `test_conversation_${Date.now()}`;

async function testConversationContext() {
  console.log('🧪 Testing conversation context persistence...');
  console.log(`Using conversation ID: ${conversationId}`);

  try {
    // First message
    console.log('\n📤 Sending first message...');
    const response1 = await axios.post(`${BASE_URL}/chat`, {
      message: "My name is John and I drive a 2018 Toyota Camry. Remember this information.",
      conversationId: conversationId,
      vehicleContext: {
        year: 2018,
        make: "Toyota",
        model: "Camry"
      },
      customerContext: {
        name: "John"
      }
    });

    console.log('✅ First response:', response1.data.response?.substring(0, 100) + '...');

    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Second message - test if AI remembers the name and car
    console.log('\n📤 Sending second message (testing context)...');
    const response2 = await axios.post(`${BASE_URL}/chat`, {
      message: "What car do I drive and what's my name?",
      conversationId: conversationId
    });

    console.log('✅ Second response:', response2.data.response?.substring(0, 200) + '...');

    // Check if the response mentions John and Toyota Camry
    const response2Text = response2.data.response?.toLowerCase() || '';
    const remembersName = response2Text.includes('john');
    const remembersCarBrand = response2Text.includes('toyota');
    const remembersCarModel = response2Text.includes('camry');
    const remembersYear = response2Text.includes('2018');

    console.log('\n🔍 Context Memory Check:');
    console.log(`  Name (John): ${remembersName ? '✅' : '❌'}`);
    console.log(`  Car Brand (Toyota): ${remembersCarBrand ? '✅' : '❌'}`);
    console.log(`  Car Model (Camry): ${remembersCarModel ? '✅' : '❌'}`);
    console.log(`  Car Year (2018): ${remembersYear ? '✅' : '❌'}`);

    const contextWorking = remembersName && remembersCarBrand && remembersCarModel;
    
    if (contextWorking) {
      console.log('\n🎉 SUCCESS: Conversation context is working! AI remembered the information.');
    } else {
      console.log('\n❌ FAILED: Conversation context is not working. AI did not remember the information.');
    }

    // Test conversation history retrieval
    console.log('\n📖 Testing conversation history retrieval...');
    try {
      const historyResponse = await axios.get(`${BASE_URL}/conversation/${conversationId}`);
      console.log(`✅ Retrieved conversation history with ${historyResponse.data.messageCount} messages`);
      console.log(`   Last updated: ${new Date(historyResponse.data.lastUpdated).toLocaleString()}`);
    } catch (historyError) {
      console.log('❌ Failed to retrieve conversation history:', historyError.message);
    }

    // Clean up - delete conversation history
    console.log('\n🧹 Cleaning up conversation history...');
    try {
      await axios.delete(`${BASE_URL}/conversation/${conversationId}`);
      console.log('✅ Conversation history cleaned up successfully');
    } catch (cleanupError) {
      console.log('❌ Failed to cleanup conversation history:', cleanupError.message);
    }

    return contextWorking;

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    return false;
  }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  testConversationContext()
    .then(success => {
      console.log(`\n🏁 Test ${success ? 'PASSED' : 'FAILED'}`);
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test error:', error);
      process.exit(1);
    });
}

export default testConversationContext;