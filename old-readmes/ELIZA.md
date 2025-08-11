# Eliza API Proxy Server Integration Guide

This guide provides detailed instructions for setting up a Node.js proxy server to handle Eliza API calls with proper CORS configuration, along with frontend code to connect through the proxy to the Eliza system.

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Proxy Server Setup](#proxy-server-setup)
3. [Frontend Integration](#frontend-integration)
4. [CORS Configuration](#cors-configuration)
5. [API Headers Configuration](#api-headers-configuration)
6. [Testing](#testing)
7. [Troubleshooting](#troubleshooting)

## Architecture Overview

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   Frontend  │ ---> │ Proxy Server│ ---> │ Eliza API   │
│  (Client)   │      │  (Node.js)  │      │  (Backend)  │
└─────────────┘      └─────────────┘      └─────────────┘
```

The proxy server acts as an intermediary between your frontend application and the Eliza API, handling CORS issues and providing additional security layers.

## Proxy Server Setup

### 1. Create Proxy Server Directory

```bash
mkdir eliza-proxy-server
cd eliza-proxy-server
npm init -y
```

### 2. Install Dependencies

```bash
npm install express cors dotenv helmet morgan http-proxy-middleware
npm install --save-dev nodemon @types/express @types/cors @types/node typescript
```

### 3. TypeScript Configuration

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 4. Proxy Server Code

Create `src/index.ts`:

```typescript
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createProxyMiddleware } from 'http-proxy-middleware';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PROXY_PORT || 3001;
const ELIZA_API_URL = process.env.ELIZA_API_URL || 'http://localhost:3000';
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];

// Middleware
app.use(morgan('combined'));
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS Configuration
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-Agent-ID',
    'X-Session-ID'
  ],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
  maxAge: 86400 // 24 hours
};

app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request ID middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  req.headers['x-request-id'] = req.headers['x-request-id'] ||
    `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  res.setHeader('X-Request-ID', req.headers['x-request-id']);
  next();
});

// API Key validation middleware (optional)
const validateApiKey = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'];

  if (process.env.REQUIRE_API_KEY === 'true' && apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  next();
};

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    proxy: {
      port: PORT,
      targetUrl: ELIZA_API_URL
    }
  });
});

// Proxy configuration for Eliza API
const elizaProxyOptions = {
  target: ELIZA_API_URL,
  changeOrigin: true,
  pathRewrite: {
    '^/api/eliza': '' // Remove /api/eliza prefix when forwarding
  },
  onProxyReq: (proxyReq: any, req: Request, res: Response) => {
    // Forward custom headers
    if (req.headers['x-agent-id']) {
      proxyReq.setHeader('X-Agent-ID', req.headers['x-agent-id']);
    }
    if (req.headers['x-session-id']) {
      proxyReq.setHeader('X-Session-ID', req.headers['x-session-id']);
    }

    // Log proxy request
    console.log(`[PROXY] ${req.method} ${req.path} -> ${ELIZA_API_URL}${req.path}`);
  },
  onProxyRes: (proxyRes: any, req: Request, res: Response) => {
    // Add CORS headers to proxy response
    proxyRes.headers['Access-Control-Allow-Origin'] = req.headers.origin || '*';
    proxyRes.headers['Access-Control-Allow-Credentials'] = 'true';

    // Log proxy response
    console.log(`[PROXY] Response ${proxyRes.statusCode} for ${req.method} ${req.path}`);
  },
  onError: (err: Error, req: Request, res: Response) => {
    console.error('[PROXY] Error:', err);
    res.status(502).json({
      error: 'Proxy error',
      message: err.message,
      timestamp: new Date().toISOString()
    });
  }
};

// Apply proxy middleware
app.use('/api/eliza', validateApiKey, createProxyMiddleware(elizaProxyOptions));

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err.stack);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Proxy server running on http://localhost:${PORT}`);
  console.log(`📡 Proxying to Eliza API at ${ELIZA_API_URL}`);
  console.log(`🔒 CORS enabled for origins: ${ALLOWED_ORIGINS.join(', ')}`);
});
```

### 5. Environment Configuration

Create `.env`:

```env
# Proxy Server Configuration
PROXY_PORT=3001
NODE_ENV=development

# Eliza API Configuration
ELIZA_API_URL=http://localhost:3000

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,https://yourdomain.com

# Security
REQUIRE_API_KEY=false
API_KEY=your-secret-api-key-here

# Logging
LOG_LEVEL=info
```

### 6. Package.json Scripts

Update `package.json`:

```json
{
  "name": "eliza-proxy-server",
  "version": "1.0.0",
  "description": "Proxy server for Eliza API with CORS support",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "nodemon --exec ts-node src/index.ts",
    "lint": "eslint src/**/*.ts",
    "test": "jest"
  },
  "keywords": ["proxy", "eliza", "api", "cors"],
  "author": "Your Name",
  "license": "MIT"
}
```

## Frontend Integration

### 1. React Frontend Example

Create `ElizaClient.tsx`:

```typescript
import React, { useState, useEffect, useRef } from 'react';
import axios, { AxiosInstance } from 'axios';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ElizaClientConfig {
  proxyUrl: string;
  apiKey?: string;
  agentId: string;
  sessionId?: string;
}

class ElizaService {
  private client: AxiosInstance;
  private config: ElizaClientConfig;

  constructor(config: ElizaClientConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: `${config.proxyUrl}/api/eliza`,
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey && { 'X-API-Key': config.apiKey }),
        'X-Agent-ID': config.agentId,
        ...(config.sessionId && { 'X-Session-ID': config.sessionId }),
      },
      withCredentials: true,
      timeout: 30000,
    });

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        console.log('Request:', config.method?.toUpperCase(), config.url);
        return config;
      },
      (error) => {
        console.error('Request error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        console.log('Response:', response.status, response.data);
        return response;
      },
      (error) => {
        console.error('Response error:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  async sendMessage(message: string): Promise<any> {
    try {
      const response = await this.client.post('/chat', {
        message,
        timestamp: new Date().toISOString(),
      });
      return response.data;
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  }

  async getHistory(limit: number = 50): Promise<Message[]> {
    try {
      const response = await this.client.get('/history', {
        params: { limit },
      });
      return response.data;
    } catch (error) {
      console.error('Failed to get history:', error);
      throw error;
    }
  }

  async startSession(): Promise<string> {
    try {
      const response = await this.client.post('/session/start');
      return response.data.sessionId;
    } catch (error) {
      console.error('Failed to start session:', error);
      throw error;
    }
  }

  async endSession(): Promise<void> {
    try {
      await this.client.post('/session/end');
    } catch (error) {
      console.error('Failed to end session:', error);
      throw error;
    }
  }
}

export const ElizaChat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  const elizaServiceRef = useRef<ElizaService | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initialize Eliza service
    const config: ElizaClientConfig = {
      proxyUrl: process.env.REACT_APP_PROXY_URL || 'http://localhost:3001',
      apiKey: process.env.REACT_APP_API_KEY,
      agentId: process.env.REACT_APP_AGENT_ID || 'default-agent',
      sessionId: localStorage.getItem('eliza-session-id') || undefined,
    };

    elizaServiceRef.current = new ElizaService(config);

    // Start session if needed
    const initSession = async () => {
      try {
        if (!config.sessionId) {
          const sessionId = await elizaServiceRef.current.startSession();
          localStorage.setItem('eliza-session-id', sessionId);
        }

        // Load history
        const history = await elizaServiceRef.current.getHistory();
        setMessages(history);
        setConnected(true);
      } catch (err) {
        setError('Failed to connect to Eliza');
        console.error(err);
      }
    };

    initSession();

    // Cleanup on unmount
    return () => {
      if (elizaServiceRef.current) {
        elizaServiceRef.current.endSession().catch(console.error);
      }
    };
  }, []);

  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim() || loading || !elizaServiceRef.current) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const response = await elizaServiceRef.current.sendMessage(userMessage.content);

      const assistantMessage: Message = {
        id: response.id || `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.message || response.content,
        timestamp: new Date(response.timestamp || Date.now()),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send message');
      console.error('Send message error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="eliza-chat-container">
      <div className="chat-header">
        <h2>Eliza Chat</h2>
        <span className={`connection-status ${connected ? 'connected' : 'disconnected'}`}>
          {connected ? '● Connected' : '○ Disconnected'}
        </span>
      </div>

      <div className="messages-container">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`message ${message.role}`}
          >
            <div className="message-content">{message.content}</div>
            <div className="message-timestamp">
              {new Date(message.timestamp).toLocaleTimeString()}
            </div>
          </div>
        ))}
        {loading && (
          <div className="message assistant loading">
            <div className="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="input-container">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type your message..."
          disabled={loading || !connected}
          rows={2}
        />
        <button
          onClick={handleSendMessage}
          disabled={loading || !connected || !input.trim()}
        >
          {loading ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
};

// CSS Styles
const styles = `
.eliza-chat-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  max-width: 800px;
  margin: 0 auto;
  background: #f5f5f5;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: #2c3e50;
  color: white;
}

.connection-status {
  font-size: 0.9rem;
}

.connection-status.connected {
  color: #2ecc71;
}

.connection-status.disconnected {
  color: #e74c3c;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  background: white;
}

.message {
  margin-bottom: 1rem;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  max-width: 70%;
}

.message.user {
  background: #3498db;
  color: white;
  margin-left: auto;
  text-align: right;
}

.message.assistant {
  background: #ecf0f1;
  color: #2c3e50;
}

.message-content {
  font-size: 1rem;
  line-height: 1.4;
}

.message-timestamp {
  font-size: 0.8rem;
  opacity: 0.7;
  margin-top: 0.25rem;
}

.typing-indicator {
  display: flex;
  gap: 4px;
}

.typing-indicator span {
  width: 8px;
  height: 8px;
  background: #7f8c8d;
  border-radius: 50%;
  animation: typing 1.4s infinite;
}

.typing-indicator span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-indicator span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing {
  0%, 60%, 100% {
    opacity: 0.2;
  }
  30% {
    opacity: 1;
  }
}

.error-message {
  background: #e74c3c;
  color: white;
  padding: 0.5rem 1rem;
  margin: 0.5rem 1rem;
  border-radius: 4px;
}

.input-container {
  display: flex;
  gap: 0.5rem;
  padding: 1rem;
  background: #ecf0f1;
  border-top: 1px solid #bdc3c7;
}

.input-container textarea {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #bdc3c7;
  border-radius: 4px;
  resize: none;
  font-family: inherit;
}

.input-container button {
  padding: 0.5rem 1.5rem;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}

.input-container button:hover:not(:disabled) {
  background: #2980b9;
}

.input-container button:disabled {
  background: #95a5a6;
  cursor: not-allowed;
}
`;
```

### 2. Vue.js Frontend Example

Create `ElizaChat.vue`:

```vue
<template>
  <div class="eliza-chat-container">
    <div class="chat-header">
      <h2>Eliza Chat</h2>
      <span :class="['connection-status', connected ? 'connected' : 'disconnected']">
        {{ connected ? '● Connected' : '○ Disconnected' }}
      </span>
    </div>

    <div class="messages-container" ref="messagesContainer">
      <div
        v-for="message in messages"
        :key="message.id"
        :class="['message', message.role]"
      >
        <div class="message-content">{{ message.content }}</div>
        <div class="message-timestamp">
          {{ formatTimestamp(message.timestamp) }}
        </div>
      </div>

      <div v-if="loading" class="message assistant loading">
        <div class="typing-indicator">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    </div>

    <div v-if="error" class="error-message">
      {{ error }}
    </div>

    <div class="input-container">
      <textarea
        v-model="input"
        @keypress.enter.prevent="handleSendMessage"
        placeholder="Type your message..."
        :disabled="loading || !connected"
        rows="2"
      />
      <button
        @click="handleSendMessage"
        :disabled="loading || !connected || !input.trim()"
      >
        {{ loading ? 'Sending...' : 'Send' }}
      </button>
    </div>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  name: 'ElizaChat',
  data() {
    return {
      messages: [],
      input: '',
      loading: false,
      error: null,
      connected: false,
      elizaService: null,
    };
  },
  mounted() {
    this.initializeElizaService();
  },
  beforeUnmount() {
    if (this.elizaService) {
      this.elizaService.endSession().catch(console.error);
    }
  },
  methods: {
    initializeElizaService() {
      const config = {
        proxyUrl: process.env.VUE_APP_PROXY_URL || 'http://localhost:3001',
        apiKey: process.env.VUE_APP_API_KEY,
        agentId: process.env.VUE_APP_AGENT_ID || 'default-agent',
        sessionId: localStorage.getItem('eliza-session-id') || undefined,
      };

      this.elizaService = this.createElizaService(config);
      this.initSession();
    },

    createElizaService(config) {
      const client = axios.create({
        baseURL: `${config.proxyUrl}/api/eliza`,
        headers: {
          'Content-Type': 'application/json',
          ...(config.apiKey && { 'X-API-Key': config.apiKey }),
          'X-Agent-ID': config.agentId,
          ...(config.sessionId && { 'X-Session-ID': config.sessionId }),
        },
        withCredentials: true,
        timeout: 30000,
      });

      return {
        client,
        config,
        sendMessage: async (message) => {
          const response = await client.post('/chat', {
            message,
            timestamp: new Date().toISOString(),
          });
          return response.data;
        },
        getHistory: async (limit = 50) => {
          const response = await client.get('/history', { params: { limit } });
          return response.data;
        },
        startSession: async () => {
          const response = await client.post('/session/start');
          return response.data.sessionId;
        },
        endSession: async () => {
          await client.post('/session/end');
        },
      };
    },

    async initSession() {
      try {
        if (!this.elizaService.config.sessionId) {
          const sessionId = await this.elizaService.startSession();
          localStorage.setItem('eliza-session-id', sessionId);
        }

        const history = await this.elizaService.getHistory();
        this.messages = history;
        this.connected = true;
      } catch (err) {
        this.error = 'Failed to connect to Eliza';
        console.error(err);
      }
    },

    async handleSendMessage() {
      if (!this.input.trim() || this.loading || !this.elizaService) return;

      const userMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: this.input.trim(),
        timestamp: new Date(),
      };

      this.messages.push(userMessage);
      this.input = '';
      this.loading = true;
      this.error = null;

      try {
        const response = await this.elizaService.sendMessage(userMessage.content);

        const assistantMessage = {
          id: response.id || `assistant-${Date.now()}`,
          role: 'assistant',
          content: response.message || response.content,
          timestamp: new Date(response.timestamp || Date.now()),
        };

        this.messages.push(assistantMessage);
        this.scrollToBottom();
      } catch (err) {
        this.error = err.response?.data?.error || 'Failed to send message';
        console.error('Send message error:', err);
      } finally {
        this.loading = false;
      }
    },

    formatTimestamp(timestamp) {
      return new Date(timestamp).toLocaleTimeString();
    },

    scrollToBottom() {
      this.$nextTick(() => {
        const container = this.$refs.messagesContainer;
        container.scrollTop = container.scrollHeight;
      });
    },
  },
};
</script>

<style scoped>
/* Same CSS as React example */
</style>
```

### 3. Vanilla JavaScript Example

Create `eliza-client.js`:

```javascript
class ElizaClient {
  constructor(config) {
    this.config = {
      proxyUrl: 'http://localhost:3001',
      apiKey: null,
      agentId: 'default-agent',
      sessionId: null,
      ...config
    };

    this.messages = [];
    this.connected = false;
    this.loading = false;

    this.initializeClient();
  }

  initializeClient() {
    // Set up default headers
    this.headers = {
      'Content-Type': 'application/json',
      'X-Agent-ID': this.config.agentId,
    };

    if (this.config.apiKey) {
      this.headers['X-API-Key'] = this.config.apiKey;
    }

    if (this.config.sessionId) {
      this.headers['X-Session-ID'] = this.config.sessionId;
    }
  }

  async request(endpoint, options = {}) {
    const url = `${this.config.proxyUrl}/api/eliza${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.headers,
          ...options.headers,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Request failed:', error);
      throw error;
    }
  }

  async startSession() {
    try {
      const response = await this.request('/session/start', {
        method: 'POST',
      });

      this.config.sessionId = response.sessionId;
      this.headers['X-Session-ID'] = response.sessionId;
      localStorage.setItem('eliza-session-id', response.sessionId);

      return response.sessionId;
    } catch (error) {
      console.error('Failed to start session:', error);
      throw error;
    }
  }

  async sendMessage(message) {
    try {
      const response = await this.request('/chat', {
        method: 'POST',
        body: JSON.stringify({
          message,
          timestamp: new Date().toISOString(),
        }),
      });

      return response;
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  }

  async getHistory(limit = 50) {
    try {
      const response = await this.request(`/history?limit=${limit}`, {
        method: 'GET',
      });

      return response;
    } catch (error) {
      console.error('Failed to get history:', error);
      throw error;
    }
  }

  async endSession() {
    try {
      await this.request('/session/end', {
        method: 'POST',
      });

      localStorage.removeItem('eliza-session-id');
    } catch (error) {
      console.error('Failed to end session:', error);
      throw error;
    }
  }
}

// Usage example
document.addEventListener('DOMContentLoaded', async () => {
  const client = new ElizaClient({
    proxyUrl: 'http://localhost:3001',
    apiKey: 'your-api-key',
    agentId: 'my-agent',
    sessionId: localStorage.getItem('eliza-session-id'),
  });

  // Initialize session
  if (!client.config.sessionId) {
    await client.startSession();
  }

  // Get chat history
  const history = await client.getHistory();
  console.log('Chat history:', history);

  // Send a message
  const messageInput = document.getElementById('message-input');
  const sendButton = document.getElementById('send-button');
  const messagesContainer = document.getElementById('messages');

  sendButton.addEventListener('click', async () => {
    const message = messageInput.value.trim();
    if (!message) return;

    // Add user message to UI
    const userMessageEl = document.createElement('div');
    userMessageEl.className = 'message user';
    userMessageEl.textContent = message;
    messagesContainer.appendChild(userMessageEl);

    // Clear input
    messageInput.value = '';

    try {
      // Send message to Eliza
      const response = await client.sendMessage(message);

      // Add assistant message to UI
      const assistantMessageEl = document.createElement('div');
      assistantMessageEl.className = 'message assistant';
      assistantMessageEl.textContent = response.message || response.content;
      messagesContainer.appendChild(assistantMessageEl);

      // Scroll to bottom
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    } catch (error) {
      console.error('Failed to send message:', error);
      // Show error to user
      const errorEl = document.createElement('div');
      errorEl.className = 'error';
      errorEl.textContent = 'Failed to send message. Please try again.';
      messagesContainer.appendChild(errorEl);
    }
  });

  // Handle Enter key
  messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendButton.click();
    }
  });
});
```

## CORS Configuration

### Understanding CORS Headers

The proxy server handles CORS by:

1. **Allowing specific origins**: Use the `ALLOWED_ORIGINS` environment variable
2. **Credentials support**: Enabled with `credentials: true`
3. **Custom headers**: Allowing agent ID, session ID, and API key headers
4. **Preflight requests**: Automatically handled by the cors middleware

### Security Best Practices

1. **Origin Validation**: Always specify allowed origins in production
2. **API Key Management**: Use environment variables for sensitive data
3. **Rate Limiting**: Add rate limiting middleware for production

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});

app.use('/api/eliza', limiter);
```

## API Headers Configuration

### Required Headers

1. **Content-Type**: Always set to `application/json`
2. **X-Agent-ID**: Identifies the agent/character to use
3. **X-Session-ID**: Maintains conversation context
4. **X-API-Key**: Optional authentication

### Custom Headers

You can add custom headers for:
- Request tracking: `X-Request-ID`
- Client identification: `X-Client-Version`
- Feature flags: `X-Feature-Flags`

## Testing

### 1. Test the Proxy Server

```bash
# Health check
curl http://localhost:3001/health

# Test CORS
curl -H "Origin: http://localhost:3000" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type,X-Agent-ID" \
     -X OPTIONS \
     http://localhost:3001/api/eliza/chat

# Send a message
curl -X POST http://localhost:3001/api/eliza/chat \
     -H "Content-Type: application/json" \
     -H "X-Agent-ID: test-agent" \
     -d '{"message": "Hello, Eliza!"}'
```

### 2. Integration Tests

Create `tests/proxy.test.js`:

```javascript
const request = require('supertest');
const app = require('../src/index');

describe('Proxy Server', () => {
  test('Health check returns OK', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  test('CORS headers are set correctly', async () => {
    const response = await request(app)
      .options('/api/eliza/chat')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'POST');

    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  test('Proxy forwards requests to Eliza API', async () => {
    const response = await request(app)
      .post('/api/eliza/chat')
      .set('X-Agent-ID', 'test-agent')
      .send({ message: 'Test message' });

    expect(response.status).toBeLessThan(500);
  });
});
```

## Troubleshooting

### Common Issues

1. **CORS Errors**
   - Check `ALLOWED_ORIGINS` includes your frontend URL
   - Ensure credentials are properly configured
   - Verify preflight requests are handled

2. **Connection Refused**
   - Verify Eliza API is running on the correct port
   - Check proxy server logs for errors
   - Ensure firewall allows connections

3. **Session Issues**
   - Check localStorage for session ID
   - Verify session endpoint is working
   - Look for session expiration issues

4. **Authentication Failures**
   - Verify API key is correct
   - Check header names match expectations
   - Look for typos in environment variables

### Debug Mode

Enable debug logging:

```typescript
// Add to proxy server
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`[DEBUG] ${req.method} ${req.path}`);
    console.log('[DEBUG] Headers:', req.headers);
    console.log('[DEBUG] Body:', req.body);
    next();
  });
}
```

### Monitoring

Add monitoring for production:

```typescript
import prometheus from 'prom-client';

const register = new prometheus.Registry();
const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});

app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    end({
      method: req.method,
      route: req.route?.path || req.path,
      status: res.statusCode,
    });
  });
  next();
});

app.get('/metrics', (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(register.metrics());
});
```

## Production Deployment

### 1. Environment Variables

Create `.env.production`:

```env
NODE_ENV=production
PROXY_PORT=3001
ELIZA_API_URL=https://api.eliza.production.com
ALLOWED_ORIGINS=https://app.yourdomain.com,https://www.yourdomain.com
REQUIRE_API_KEY=true
API_KEY=your-production-api-key
LOG_LEVEL=error
```

### 2. Docker Deployment

Create `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3001

CMD ["node", "dist/index.js"]
```

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  proxy:
    build: .
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PROXY_PORT=3001
      - ELIZA_API_URL=${ELIZA_API_URL}
      - ALLOWED_ORIGINS=${ALLOWED_ORIGINS}
      - API_KEY=${API_KEY}
    restart: unless-stopped
    networks:
      - eliza-network

networks:
  eliza-network:
    driver: bridge
```

### 3. Security Checklist

- [ ] Use HTTPS in production
- [ ] Enable rate limiting
- [ ] Implement API key rotation
- [ ] Add request logging and monitoring
- [ ] Set up error alerting
- [ ] Use environment variables for secrets
- [ ] Implement request validation
- [ ] Add security headers (helmet)
- [ ] Set up DDoS protection
- [ ] Implement proper error handling

## Conclusion

This guide provides a comprehensive setup for proxying Eliza API calls with proper CORS configuration. The proxy server acts as a secure intermediary, handling authentication, CORS, and request forwarding while providing a clean interface for frontend applications.

Remember to:
1. Always use environment variables for sensitive data
2. Implement proper error handling
3. Add monitoring and logging for production
4. Keep dependencies updated
5. Follow security best practices

For additional support or questions, please refer to the Eliza documentation or create an issue in the project repositor