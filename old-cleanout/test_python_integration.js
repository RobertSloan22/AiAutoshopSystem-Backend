// Quick test to verify Python integration works with OpenAI API
import fetch from 'node-fetch';

async function testPythonIntegration() {
  console.log('Testing Python integration with OpenAI API...');

  try {
    const response = await fetch('http://localhost:3000/api/responses/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'Calculate the average of these numbers: [10, 20, 30, 40, 50] and create a simple bar chart',
        vehicleContext: {
          year: '2023',
          make: 'Test',
          model: 'Vehicle'
        }
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    console.log('✅ Request sent successfully');
    console.log('🔄 Processing response...');

    // Simple response reader for testing
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        // Keep the last incomplete line in the buffer
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              switch (data.type) {
                case 'session_started':
                  console.log(`📡 Session started: ${data.sessionId}`);
                  break;
                case 'content':
                  process.stdout.write(data.content);
                  break;
                case 'tool_calls_started':
                  console.log('\n🐍 Python code execution started...');
                  break;
                case 'tool_calls_completed':
                  console.log('\n✅ Python code execution completed');
                  break;
                case 'stream_complete':
                  console.log('\n🎉 Stream completed successfully!');
                  break;
                case 'error':
                  console.error('\n❌ Error:', data.error);
                  break;
              }
            } catch (e) {
              // Skip invalid JSON lines
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    console.log('\n✅ Test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testPythonIntegration();