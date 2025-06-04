# Eliza API Integration Guide

This document provides a comprehensive guide for integrating with the Eliza AI system through our server's API endpoints. The integration is designed with multiple fallback mechanisms to ensure reliability.

## Architecture Overview

```
Frontend → Backend Server → Eliza System (Port 3000)
```

Our backend server acts as a router between your frontend application and the Eliza system running on port 3000. This architecture provides several benefits:

1. **Single entry point** - Your frontend only needs to connect to one server endpoint
2. **Multiple fallback layers** - If one connection method fails, alternative paths are automatically used
3. **Connection management** - The server maintains conversation state even if direct connections fail
4. **Consistent interfaces** - Same API patterns regardless of which system handles the request

## Available Endpoints

### 1. Direct Eliza Proxy Routes

These endpoints connect directly to the Eliza system running on port 3000, with the backend server acting as a proxy:

#### Get All Available Agents

```
GET /api/eliza-direct/agents
```

**Response:**
```json
{
  "agents": [
    {
      "id": "eliza-0000-0000-0000-000000000000",
      "name": "Eliza",
      "clients": []
    }
  ]
}
```

#### Send a Message to an Agent

```
POST /api/eliza-direct/agent/:agentId/message
```

**Parameters:**
- `agentId`: The agent ID (use "eliza-0000-0000-0000-000000000000")

**Request Body:**
```json
{
  "message": "Hello, how can you help me with my car?",
  "conversationId": "optional-conversation-id",
  "userId": "optional-user-id",
  "sessionId": "optional-session-id"
}
```

**Response:**
```json
{
  "response": {
    "content": "I can help diagnose car problems and suggest maintenance...",
    "conversationId": "conversation-id",
    "messageId": "message-id"
  },
  "conversationId": "conversation-id"
}
```

#### Start a New Conversation

```
POST /api/eliza-direct/agent/:agentId/conversations
```

**Parameters:**
- `agentId`: The agent ID (use "eliza-0000-0000-0000-000000000000")

**Request Body:**
```json
{
  "initialMessage": "Hello, I need help with my car"  // Optional
}
```

**Response:**
```json
{
  "conversationId": "new-conversation-id",
  "initialResponse": {
    // Response object if an initial message was provided
  }
}
```

#### Get Conversation History

```
GET /api/eliza-direct/agent/:agentId/conversations/:conversationId
```

**Parameters:**
- `agentId`: The agent ID
- `conversationId`: The conversation ID to retrieve

**Response:**
```json
{
  "conversationId": "conversation-id",
  "messages": [
    {
      "role": "user",
      "content": "Hello, I need help with my car",
      "timestamp": "2025-05-21T14:30:00.000Z"
    },
    {
      "role": "assistant",
      "content": "I can help diagnose car problems...",
      "timestamp": "2025-05-21T14:30:05.000Z"
    }
  ]
}
```

#### Text-Based Streaming with Eliza (with Fallback)

```
POST /api/eliza-direct/stream/:agentId
```

**Parameters:**
- `agentId`: The agent ID (use "eliza-0000-0000-0000-000000000000")

**Request Body:**
```json
{
  "message": "What could cause my engine to overheat?",
  "conversationId": "optional-conversation-id",
  "userId": "optional-user-id",
  "sessionId": "optional-session-id"
}
```

**Response:**
Server-Sent Events (SSE) stream with the following event types:

- `session_started` - Indicates the start of a streaming session
- `thinking` - Indicates the system is processing the request
- `content` - Contains chunks of the response content
- `stream_complete` - Indicates the end of the stream
- `error` - Contains error information if something goes wrong

### 2. Fallback Streaming Routes

If the direct connection to Eliza fails, or if you prefer a more robust fallback mechanism, use:

```
POST /api/eliza/fallback-stream
```

**Request Body:**
```json
{
  "message": "What could cause my engine to overheat?",
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

This endpoint implements a multi-layered fallback system:
1. First tries OpenAI streaming with the most capable model
2. Falls back to simpler models if the primary model fails
3. As a last resort, falls back to Eliza with simulated streaming

## Implementation Examples

### React Component for Eliza Direct Communication

```jsx
import React, { useState, useEffect, useRef } from 'react';

function ElizaDirectChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  
  const AGENT_ID = 'eliza-0000-0000-0000-000000000000';
  const messagesEndRef = useRef(null);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Initialize conversation on component mount
  useEffect(() => {
    async function initConversation() {
      try {
        const response = await fetch(`/api/eliza-direct/agent/${AGENT_ID}/conversations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        
        if (!response.ok) throw new Error('Failed to start conversation');
        
        const data = await response.json();
        setConversationId(data.conversationId);
        setSessionId(`session_${Date.now()}`);
      } catch (error) {
        console.error('Error initializing conversation:', error);
      }
    }
    
    initConversation();
  }, []);
  
  // Handle form submission to send message
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || !conversationId) return;
    
    const userMessage = input;
    setInput('');
    setIsLoading(true);
    
    // Add user message to chat
    setMessages(prev => [...prev, { 
      role: 'user', 
      content: userMessage 
    }]);
    
    try {
      // Use streaming endpoint for better UX
      const eventSource = new EventSource(
        `/api/eliza-direct/stream/${AGENT_ID}?_=${Date.now()}`
      );
      
      let responseText = '';
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          switch(data.type) {
            case 'session_started':
              console.log('Session started:', data.sessionId);
              break;
              
            case 'thinking':
              // Show thinking indicator
              break;
              
            case 'content':
              responseText += data.content;
              setMessages(prev => {
                const newMessages = [...prev];
                // Update or add the assistant message
                const assistantIndex = newMessages.findIndex(
                  msg => msg.role === 'assistant' && msg.isPartial
                );
                
                if (assistantIndex >= 0) {
                  newMessages[assistantIndex].content = responseText;
                } else {
                  newMessages.push({ 
                    role: 'assistant', 
                    content: responseText,
                    isPartial: true 
                  });
                }
                return newMessages;
              });
              break;
              
            case 'stream_complete':
              // Mark message as complete
              setMessages(prev => {
                const newMessages = [...prev];
                const assistantIndex = newMessages.findIndex(
                  msg => msg.role === 'assistant' && msg.isPartial
                );
                
                if (assistantIndex >= 0) {
                  newMessages[assistantIndex].isPartial = false;
                }
                return newMessages;
              });
              setIsLoading(false);
              eventSource.close();
              break;
              
            case 'error':
              console.error('Stream error:', data.error);
              setMessages(prev => [...prev, { 
                role: 'error', 
                content: `Error: ${data.error}` 
              }]);
              setIsLoading(false);
              eventSource.close();
              break;
          }
        } catch (error) {
          console.error('Error parsing event data:', error);
        }
      };
      
      eventSource.onerror = (error) => {
        console.error('EventSource error:', error);
        setMessages(prev => [...prev, { 
          role: 'error', 
          content: 'Connection error. Please try again.' 
        }]);
        setIsLoading(false);
        eventSource.close();
      };
      
      // POST the message
      await fetch(`/api/eliza-direct/agent/${AGENT_ID}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          conversationId,
          sessionId
        })
      });
      
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, { 
        role: 'error', 
        content: 'Error sending message. Please try again.' 
      }]);
      setIsLoading(false);
    }
  };
  
  return (
    <div className="eliza-chat">
      <div className="messages-container">
        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.role}`}>
            {msg.content}
            {msg.isPartial && <span className="cursor"></span>}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      <form onSubmit={handleSubmit} className="input-form">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type a message..."
          disabled={isLoading || !conversationId}
        />
        <button 
          type="submit" 
          disabled={isLoading || !input.trim() || !conversationId}
        >
          Send
        </button>
      </form>
    </div>
  );
}

export default ElizaDirectChat;
```

### React Component for Fallback Streaming

```jsx
import React, { useState, useEffect, useRef } from 'react';

function ElizaFallbackChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const messagesEndRef = useRef(null);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    const userMessage = input;
    setInput('');
    setIsLoading(true);
    
    // Add user message to chat
    setMessages(prev => [...prev, { 
      role: 'user', 
      content: userMessage 
    }]);
    
    try {
      const response = await fetch('/api/eliza/fallback-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          vehicleContext: {
            year: "2015",
            make: "Honda",
            model: "Civic"
          }
        })
      });
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      let responseText = '';
      
      // Process the SSE stream
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              
              switch (data.type) {
                case 'session_started':
                  console.log('Session started:', data.sessionId);
                  break;
                  
                case 'content':
                  responseText += data.content;
                  setMessages(prev => {
                    const newMessages = [...prev];
                    const assistantIndex = newMessages.findIndex(
                      msg => msg.role === 'assistant' && msg.isPartial
                    );
                    
                    if (assistantIndex >= 0) {
                      newMessages[assistantIndex].content = responseText;
                    } else {
                      newMessages.push({ 
                        role: 'assistant', 
                        content: responseText,
                        isPartial: true 
                      });
                    }
                    return newMessages;
                  });
                  break;
                  
                case 'stream_complete':
                  setMessages(prev => {
                    const newMessages = [...prev];
                    const assistantIndex = newMessages.findIndex(
                      msg => msg.role === 'assistant' && msg.isPartial
                    );
                    
                    if (assistantIndex >= 0) {
                      newMessages[assistantIndex].isPartial = false;
                    }
                    return newMessages;
                  });
                  setIsLoading(false);
                  break;
                  
                case 'error':
                  console.error('Stream error:', data.error);
                  setMessages(prev => [...prev, { 
                    role: 'error', 
                    content: `Error: ${data.error}` 
                  }]);
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
      setMessages(prev => [...prev, { 
        role: 'error', 
        content: 'Connection error. Please try again.' 
      }]);
      setIsLoading(false);
    }
  };
  
  return (
    <div className="eliza-fallback-chat">
      <div className="messages-container">
        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.role}`}>
            {msg.content}
            {msg.isPartial && <span className="cursor"></span>}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      <form onSubmit={handleSubmit} className="input-form">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type a message..."
          disabled={isLoading}
        />
        <button 
          type="submit" 
          disabled={isLoading || !input.trim()}
        >
          Send
        </button>
      </form>
    </div>
  );
}

export default ElizaFallbackChat;
```

## Fallback Mechanism Details

Our implementation includes multiple fallback layers to ensure reliable communication:

### Eliza Direct Communication
- Primary path: Direct proxy to the Eliza system on port 3000
- Client maintains connection with the backend, which forwards to Eliza
- Automatic session tracking and conversation management
- Simulated streaming for better user experience

### OpenAI-Based Fallback
- If Eliza is unavailable, routes to OpenAI models
- Primary model: `gpt-4o-mini` with full tool support
- Fallback models: `gpt-3.5-turbo`, `claude-3-haiku-20240307`
- Full streaming support with event-based updates

### Final Fallback
- Simple text-based response mechanism
- Works when all other options fail
- Guarantees a response even in degraded conditions

## Error Handling

The system provides robust error handling:

1. **Transparent errors** - All errors are returned with clear messages
2. **Auto recovery** - The system tries multiple fallback paths automatically
3. **Session preservation** - Conversation context is maintained across fallbacks
4. **Graceful degradation** - Features are reduced rather than failing completely

## Production Considerations

When deploying to production, consider:

1. **Rate limiting** - Implement rate limiting to prevent abuse
2. **Authentication** - Add proper authentication for all endpoints
3. **Logging** - Enable comprehensive logging for debugging
4. **Monitoring** - Set up alerts for Eliza service availability
5. **Load balancing** - Consider load balancing for high-traffic scenarios

## Troubleshooting

Common issues and solutions:

### Connection Failures
- Check if the Eliza service is running on port 3000
- Verify network connectivity between the server and Eliza
- Check for firewall rules blocking the connection

### Streaming Issues
- Ensure the client supports Server-Sent Events (SSE)
- Implement reconnection logic with exponential backoff
- Check for proxy servers that might buffer streaming responses

### Response Timeouts
- Increase timeout settings in the proxy configuration
- Consider implementing client-side timeout handling
- Check for long-running processes in the Eliza system

## Support

For additional help or to report issues, please contact the development team or file an issue in the project repository.