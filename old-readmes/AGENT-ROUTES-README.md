# Agent Routes API Documentation

This document provides detailed information on how to interact with the `agent.routes.js` API, which serves as a relay between frontend applications and OpenAI's realtime services.

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [WebSocket Integration](#websocket-integration)
4. [REST API Endpoints](#rest-api-endpoints)
5. [WebRTC Communication](#webrtc-communication)
6. [Error Handling](#error-handling)
7. [Client Implementation Guide](#client-implementation-guide)

## Overview

The Agent Routes module provides a comprehensive backend API for interacting with OpenAI's realtime and chat completion services. It facilitates:

- Creation and management of realtime sessions
- WebRTC signaling and connection establishment
- Socket.io realtime status updates and notifications
- Regular chat completions (non-streaming)

The system is designed to handle both WebRTC connections for voice/audio and standard API requests for text chat.

## Authentication

All requests should include:

- User identification in one of two ways:
  - Query parameter: `?userId=<user_id>`
  - HTTP header: `user-id: <user_id>`

This user ID is used for:
- Tracking session ownership
- Directing socket notifications to the correct client
- Access control for session management

## WebSocket Integration

The service uses Socket.io for realtime communication with clients. When implementing a client, connect to the Socket.io server and listen for the following events:

### Connection Events

```javascript
// Connect to Socket.io server
const socket = io(BACKEND_URL, {
  query: { userId: "your-user-id" }
});

// Listen for connection status
socket.on("connection_status", (data) => {
  console.log(`Connection status: ${data.status}`);
});

// Listen for online users
socket.on("getOnlineUsers", (userIds) => {
  console.log("Online users:", userIds);
});
```

### Session Status Events

```javascript
// Listen for session creation/updates
socket.on("session_status", (data) => {
  console.log(`Session ${data.sessionId} status: ${data.status}`);
  // Possible statuses: creating, created, error, terminated
});

// Listen for WebRTC connection status
socket.on("webrtc_status", (data) => {
  console.log(`WebRTC status: ${data.status} for model ${data.model}`);
  // Possible statuses: connecting, connected, error
});
```

### Room/Session Management

```javascript
// Join a specific session (for multi-user functionality)
socket.emit("join_session", { sessionId: "session-id" });

// Leave a session
socket.emit("leave_session", { sessionId: "session-id" });

// Listen for users joining/leaving
socket.on("user_joined", (data) => {
  console.log(`User ${data.userId} joined session ${data.sessionId}`);
});

socket.on("user_left", (data) => {
  console.log(`User ${data.userId} left session ${data.sessionId}`);
});
```

### WebRTC Signaling

```javascript
// Send WebRTC signal to another user
socket.emit("webrtc_signal", {
  signal: {}, // Your WebRTC signal data
  sessionId: "session-id",
  receiverId: "receiver-user-id"
});

// Listen for incoming WebRTC signals
socket.on("webrtc_signal", (data) => {
  // Process received signal from data.senderId
  console.log(`Received signal from ${data.senderId} for session ${data.sessionId}`);
});
```

### Error Events

```javascript
socket.on("error", (data) => {
  console.error(`Error: ${data.message}`);
});
```

## REST API Endpoints

### Session Management

#### Create Session

```
POST /api/agent/v1/realtime/sessions
Content-Type: application/json
user-id: <your-user-id>

{
  "model": "gpt-4o-realtime-preview-2024-12-17"
}
```

Response:
```json
{
  "id": "sess_123456",
  "model": "gpt-4o-realtime-preview-2024-12-17",
  "created_at": "2025-05-10T12:00:00Z",
  "expires_at": "2025-05-10T13:00:00Z"
}
```

#### List Active Sessions

```
GET /api/agent/sessions?userId=<your-user-id>
```

Response:
```json
{
  "sessions": [
    {
      "id": "sess_123456",
      "userId": "user123",
      "model": "gpt-4o-realtime-preview-2024-12-17",
      "createdAt": "2025-05-10T12:00:00Z",
      "lastActive": "2025-05-10T12:05:00Z"
    }
  ],
  "count": 1
}
```

#### Terminate Session

```
DELETE /api/agent/sessions/<session-id>?userId=<your-user-id>
```

Response:
```json
{
  "success": true,
  "message": "Session terminated successfully"
}
```

#### Health Check

```
GET /api/agent/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2025-05-10T12:00:00Z",
  "activeSessions": 5
}
```

### Chat Completions

```
POST /api/agent/chat/completions
Content-Type: application/json

{
  "model": "gpt-4o",
  "messages": [
    { "role": "system", "content": "You are a helpful assistant." },
    { "role": "user", "content": "Hello, how are you?" }
  ]
}
```

Response: Standard OpenAI chat completion response.

## WebRTC Communication

### Establishing a WebRTC Connection

1. Create a session (see [Create Session](#create-session))
2. Create a WebRTC peer connection and generate an SDP offer
3. Send the SDP offer to the agent API:

```
POST /api/agent/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17
Content-Type: application/sdp
user-id: <your-user-id>

v=0
o=- 12345 12345 IN IP4 0.0.0.0
s=-
t=0 0
...
```

4. The API will return an SDP answer that should be set as the remote description on your peer connection.

Alternatively, you can include the SDP in a JSON body:

```
POST /api/agent/v1/realtime/sessions
Content-Type: application/json
user-id: <your-user-id>

{
  "model": "gpt-4o-realtime-preview-2024-12-17",
  "sdp": "v=0\no=- 12345 12345 IN IP4 0.0.0.0\ns=-\nt=0 0\n..."
}
```

## Error Handling

The API implements several error handling mechanisms:

1. **Retry Mechanism**: API calls to OpenAI are automatically retried up to 3 times with exponential backoff.
2. **Socket Notifications**: Errors are broadcast via Socket.io to the relevant client.
3. **HTTP Error Responses**: Detailed error information is provided in the HTTP response body.
4. **Logging**: All requests and errors are logged with unique request IDs for troubleshooting.

Error Response Format:
```json
{
  "error": "Error type or message",
  "message": "Detailed error message",
  "details": "Additional error details (if available)"
}
```

## Client Implementation Guide

### Basic Implementation Steps

1. **Initialize Socket.io Connection**:
```javascript
const socket = io(BACKEND_URL, {
  query: { userId: "your-user-id" }
});
```

2. **Create a Session**:
```javascript
const response = await fetch(`${BACKEND_URL}/api/agent/v1/realtime/sessions`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'user-id': 'your-user-id'
  },
  body: JSON.stringify({
    model: 'gpt-4o-realtime-preview-2024-12-17'
  })
});
const session = await response.json();
```

3. **Setup WebRTC Connection**:
```javascript
// Create peer connection
const pc = new RTCPeerConnection({
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
});

// Create data channel for text chat (optional)
const dataChannel = pc.createDataChannel('chat');
dataChannel.onmessage = (event) => {
  console.log('Received message:', event.data);
};

// Handle ICE candidates
pc.onicecandidate = (event) => {
  if (event.candidate === null) {
    // ICE gathering complete, send the offer
    sendOfferToAgent(pc.localDescription);
  }
};

// Create and set local description
const offer = await pc.createOffer();
await pc.setLocalDescription(offer);

// Function to send the offer to the agent
async function sendOfferToAgent(sdp) {
  const response = await fetch(`${BACKEND_URL}/api/agent/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/sdp',
      'user-id': 'your-user-id'
    },
    body: sdp.sdp
  });
  
  const answerSdp = await response.text();
  const answer = new RTCSessionDescription({
    type: 'answer',
    sdp: answerSdp
  });
  
  await pc.setRemoteDescription(answer);
}
```

4. **Send and Receive Audio**:
```javascript
// Get user media
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

// Add tracks to peer connection
stream.getAudioTracks().forEach(track => {
  pc.addTrack(track, stream);
});

// Handle remote tracks
pc.ontrack = (event) => {
  const remoteAudio = document.createElement('audio');
  remoteAudio.srcObject = event.streams[0];
  remoteAudio.autoplay = true;
  document.body.appendChild(remoteAudio);
};
```

5. **Cleanup on Session End**:
```javascript
async function endSession(sessionId) {
  // Leave the session in Socket.io
  socket.emit('leave_session', { sessionId });
  
  // Terminate the session on the server
  await fetch(`${BACKEND_URL}/api/agent/sessions/${sessionId}`, {
    method: 'DELETE',
    headers: {
      'user-id': 'your-user-id'
    }
  });
  
  // Close the peer connection
  pc.close();
}
```

### Example: Integrating with React

```jsx
import React, { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';

function AgentChat({ userId }) {
  const [sessionId, setSessionId] = useState(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const socketRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const dataChannelRef = useRef(null);
  
  useEffect(() => {
    // Initialize Socket.io
    socketRef.current = io(process.env.REACT_APP_BACKEND_URL, {
      query: { userId }
    });
    
    // Listen for connection status
    socketRef.current.on('connection_status', (data) => {
      console.log(`Socket connection status: ${data.status}`);
    });
    
    // Listen for session status
    socketRef.current.on('session_status', (data) => {
      if (data.status === 'created') {
        setSessionId(data.sessionId);
      }
    });
    
    // Listen for WebRTC status
    socketRef.current.on('webrtc_status', (data) => {
      if (data.status === 'connected') {
        setConnected(true);
      } else if (data.status === 'error') {
        setConnected(false);
      }
    });
    
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
    };
  }, [userId]);
  
  const startSession = async () => {
    try {
      // Create session
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/agent/v1/realtime/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-id': userId
        },
        body: JSON.stringify({
          model: 'gpt-4o-realtime-preview-2024-12-17'
        })
      });
      
      const session = await response.json();
      
      // Join the session room
      socketRef.current.emit('join_session', { sessionId: session.id });
      
      // Setup WebRTC connection
      setupWebRTC(session.id);
    } catch (error) {
      console.error('Failed to start session:', error);
    }
  };
  
  const setupWebRTC = async (sessionId) => {
    // Create peer connection
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    peerConnectionRef.current = pc;
    
    // Create data channel
    const dataChannel = pc.createDataChannel('chat');
    dataChannelRef.current = dataChannel;
    
    dataChannel.onopen = () => {
      console.log('Data channel open');
    };
    
    dataChannel.onmessage = (event) => {
      setMessages(prev => [...prev, { role: 'assistant', content: event.data }]);
    };
    
    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate === null) {
        // ICE gathering complete, send the offer
        sendOfferToAgent(pc.localDescription, sessionId);
      }
    };
    
    // Get user media and add tracks
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getAudioTracks().forEach(track => {
        pc.addTrack(track, stream);
      });
    } catch (error) {
      console.error('Failed to get user media:', error);
    }
    
    // Handle remote tracks
    pc.ontrack = (event) => {
      const remoteAudio = document.getElementById('remote-audio');
      if (remoteAudio) {
        remoteAudio.srcObject = event.streams[0];
      }
    };
    
    // Create and set local description
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
  };
  
  const sendOfferToAgent = async (sdp, sessionId) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/agent/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/sdp',
          'user-id': userId
        },
        body: sdp.sdp
      });
      
      const answerSdp = await response.text();
      const answer = new RTCSessionDescription({
        type: 'answer',
        sdp: answerSdp
      });
      
      await peerConnectionRef.current.setRemoteDescription(answer);
    } catch (error) {
      console.error('Failed to send offer:', error);
    }
  };
  
  const sendMessage = () => {
    if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
      const message = document.getElementById('message-input').value;
      dataChannelRef.current.send(message);
      setMessages(prev => [...prev, { role: 'user', content: message }]);
      document.getElementById('message-input').value = '';
    }
  };
  
  const endSession = async () => {
    if (sessionId) {
      try {
        // Leave the session in Socket.io
        socketRef.current.emit('leave_session', { sessionId });
        
        // Terminate the session on the server
        await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/agent/sessions/${sessionId}`, {
          method: 'DELETE',
          headers: {
            'user-id': userId
          }
        });
        
        // Close the peer connection
        if (peerConnectionRef.current) {
          peerConnectionRef.current.close();
          peerConnectionRef.current = null;
        }
        
        setSessionId(null);
        setConnected(false);
      } catch (error) {
        console.error('Failed to end session:', error);
      }
    }
  };
  
  return (
    <div className="agent-chat">
      <div className="controls">
        {!sessionId ? (
          <button onClick={startSession}>Start Session</button>
        ) : (
          <button onClick={endSession}>End Session</button>
        )}
      </div>
      
      <div className="status">
        Connection Status: {connected ? 'Connected' : 'Disconnected'}
      </div>
      
      <audio id="remote-audio" autoPlay />
      
      <div className="messages">
        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.role}`}>
            {msg.content}
          </div>
        ))}
      </div>
      
      <div className="input">
        <input id="message-input" type="text" disabled={!connected} />
        <button onClick={sendMessage} disabled={!connected}>Send</button>
      </div>
    </div>
  );
}

export default AgentChat;
```

This documentation provides a comprehensive guide to integrating with the agent.routes.js API. For specific implementation details or troubleshooting, please refer to the codebase or contact the development team.