# Eliza Routes & Fallback Streaming System

This document provides detailed information on how to interact with the Eliza API routes and the fallback streaming system.

## Overview

The Eliza routes provide a robust fallback mechanism for the frontend when real-time chat connections fail or are unavailable. The system is designed with multiple layers of fallback, ensuring users can always communicate with the AI assistant regardless of network conditions or service availability.

## API Endpoints

### 1. Regular Message Endpoint

```
POST /api/eliza/message
```

This endpoint provides a simple, non-streaming response from the Eliza agent.

#### Request Body

```json
{
  "message": "Your message here",
  "userId": "optional-user-id",
  "sessionId": "optional-session-id"
}
```

#### Response

```json
{
  "response": "Eliza's response message"
}
```

#### Example Usage

```javascript
// Using fetch
fetch('/api/eliza/message', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    message: "How can I diagnose a P0420 code on my Toyota?",
    userId: "user123",
    sessionId: "session456"
  }),
})
.then(response => response.json())
.then(data => console.log(data.response));
```

### 2. Fallback Streaming Endpoint

```
POST /api/eliza/fallback-stream
```

This endpoint provides a streaming response using Server-Sent Events (SSE). It has multiple fallback layers:

1. First tries the primary OpenAI model with tools
2. If that fails, tries fallback models without tools
3. As a last resort, falls back to the Eliza agent with simulated streaming

#### Request Body

```json
{
  "message": "Your message here",
  "userId": "optional-user-id",
  "sessionId": "optional-session-id",
  "vehicleContext": {
    "year": "2010",
    "make": "Toyota",
    "model": "Corolla",
    "vin": "optional-vin"
  },
  "customerContext": {
    "name": "Optional Customer Name",
    "dtcCode": "Optional DTC Code"
  }
}
```

#### SSE Events

The stream sends different event types:

1. `session_started` - Sent when a session begins
2. `content` - Text content chunks from the AI response
3. `tool_call_progress` - Progress updates when tools are being called
4. `tool_calls_started` - Sent when tool calls begin processing
5. `tool_calls_completed` - Sent when tool calls finish processing
6. `stream_complete` - Sent when the response is complete
7. `error` - Sent if an error occurs

#### Example Usage

```javascript
// Creating an EventSource connection
const eventSource = new EventSource('/api/eliza/fallback-stream');

// Processing received events
const handleFallbackStream = (eventSource, messageText) => {
  // Create the request body
  const requestBody = JSON.stringify({
    message: messageText,
    userId: "user123",
    sessionId: "session456",
    vehicleContext: {
      year: "2015",
      make: "Honda", 
      model: "Civic",
      vin: "1HGCR2F53FA123456"
    },
    customerContext: {
      name: "John Doe",
      dtcCode: "P0420"
    }
  });

  // Set up event listeners for the stream
  let sessionId = null;
  let responseText = '';
  
  // Create POST request with event stream response
  fetch('/api/eliza/fallback-stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: requestBody
  }).then(response => {
    // Handle SSE response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    function processStream({ done, value }) {
      if (done) return;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.substring(6));
            
            switch (data.type) {
              case 'session_started':
                sessionId = data.sessionId;
                console.log(`Session started: ${sessionId}`);
                if (data.fallback) {
                  console.log('Using fallback mode');
                }
                break;
                
              case 'content':
                responseText += data.content;
                // Update UI with new content
                updateResponseUI(responseText);
                break;
                
              case 'tool_call_progress':
                console.log('Tool call in progress:', data.toolCall);
                // Show tool usage in UI
                updateToolCallUI(data.toolCall);
                break;
                
              case 'tool_calls_started':
                console.log('Processing tools:', data.toolCalls);
                break;
                
              case 'tool_calls_completed':
                console.log('Tool calls completed:', data.results);
                break;
                
              case 'stream_complete':
                console.log('Response complete');
                // Finalize UI
                finalizeResponseUI(responseText);
                break;
                
              case 'error':
                console.error('Error:', data.error);
                // Show error in UI
                showErrorUI(data.error);
                break;
            }
          } catch (e) {
            console.error('Error parsing SSE data:', e);
          }
        }
      }
      
      // Continue reading
      return reader.read().then(processStream);
    }
    
    return reader.read().then(processStream);
  }).catch(error => {
    console.error('Fetch error:', error);
    showErrorUI('Failed to connect to the server');
  });
};
```

### 3. Agent Info Endpoint

```
GET /api/eliza/agent/:id
```

Retrieves information about a specific agent by ID.

#### Response

```json
{
  "id": "agent-id",
  "name": "Agent Name",
  "description": "Agent Description"
}
```

## Fallback Mechanism Details

The fallback system works in multiple layers to ensure reliability:

### Layer 1: Primary Model with Tools
- Uses `gpt-4o-mini` with full tool support
- Provides the richest interaction experience
- Maintains full context and tool state

### Layer 2: Fallback Models without Tools
- First tries `gpt-3.5-turbo`
- Then tries `claude-3-haiku-20240307`
- Maintains the same conversation context
- Disables complex tool interactions

### Layer 3: Eliza Agent Fallback
- Last resort if all API models fail
- Uses the local Eliza agent
- Simulates streaming by chunking the response
- Provides a basic conversational experience

### Error Handling
- Each layer catches errors and attempts the next fallback
- Session context is preserved when possible
- Clear error messages are provided if all fallbacks fail

## Implementation Notes

### Vehicle Context

The system accepts vehicle context information to provide more relevant responses:

```json
{
  "vehicleContext": {
    "year": "2018",
    "make": "BMW",
    "model": "X5",
    "vin": "WBA7E4C57JB000000"
  }
}
```

### Customer Context

Customer information can be provided to personalize responses:

```json
{
  "customerContext": {
    "name": "Jane Smith",
    "dtcCode": "P0456"
  }
}
```

### Session Management

- Sessions are automatically created and managed
- Session IDs are returned in the initial response
- The system will cleanup old sessions after 30 minutes of inactivity
- You can provide your own sessionId for continuity

## Troubleshooting

### Connection Issues
- If the SSE connection fails, try reconnecting with exponential backoff
- Check network connectivity and firewall settings
- Verify the server is running and accessible

### Response Timeout
- Default timeout is 2 minutes for tool-using responses
- Consider implementing client-side timeout handling

### Server Errors
- Check server logs for detailed error information
- The system will return error events through the stream
- Error events include detailed messages to help debugging

## Example Implementation

Here's a complete React component example for using the fallback streaming endpoint:

```jsx
import React, { useState, useEffect, useRef } from 'react';

function ChatComponent() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentResponse, setCurrentResponse] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [error, setError] = useState(null);
  
  const messageEndRef = useRef(null);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    // Add user message to chat
    setMessages(prev => [...prev, { role: 'user', content: input }]);
    setIsLoading(true);
    setCurrentResponse('');
    setError(null);
    
    const userMessage = input;
    setInput('');
    
    try {
      const response = await fetch('/api/eliza/fallback-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          sessionId: sessionId,
          vehicleContext: {
            year: "2020",
            make: "Honda",
            model: "Civic"
          }
        })
      });
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      let isDone = false;
      while (!isDone) {
        const { value, done } = await reader.read();
        isDone = done;
        
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              
              switch (data.type) {
                case 'session_started':
                  setSessionId(data.sessionId);
                  console.log(`Session started: ${data.sessionId}`);
                  break;
                  
                case 'content':
                  setCurrentResponse(prev => prev + data.content);
                  break;
                  
                case 'stream_complete':
                  console.log('Response complete');
                  setIsLoading(false);
                  break;
                  
                case 'error':
                  console.error('Stream error:', data.error);
                  setError(data.error);
                  setIsLoading(false);
                  break;
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Fetch error:', error);
      setError('Failed to connect to the server');
      setIsLoading(false);
    }
  };
  
  // Add complete assistant message to chat history when done
  useEffect(() => {
    if (!isLoading && currentResponse && !error) {
      setMessages(prev => [...prev, { role: 'assistant', content: currentResponse }]);
      setCurrentResponse('');
    }
  }, [isLoading, currentResponse, error]);
  
  return (
    <div className="chat-container">
      <div className="messages">
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            {msg.content}
          </div>
        ))}
        
        {currentResponse && (
          <div className="message assistant">
            {currentResponse}
          </div>
        )}
        
        {error && (
          <div className="message error">
            Error: {error}
          </div>
        )}
        
        <div ref={messageEndRef} />
      </div>
      
      <form onSubmit={handleSubmit} className="input-form">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading || !input.trim()}>
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </form>
    </div>
  );
}

export default ChatComponent;
```

## Security Considerations

- The API endpoints should be properly authenticated in production
- Sanitize all user inputs to prevent injection attacks
- Consider rate limiting to prevent abuse
- API keys are managed server-side and not exposed to clients

## Performance Optimization

- Use connection pooling for database connections
- Implement client-side caching when appropriate
- Consider using a CDN for static assets
- Implement proper error handling and retry logic