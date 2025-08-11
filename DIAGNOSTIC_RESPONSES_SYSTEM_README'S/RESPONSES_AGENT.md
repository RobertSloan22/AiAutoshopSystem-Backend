# AI Responses Agent System - Comprehensive Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [API Endpoints](#api-endpoints)
4. [Frontend Integration Guide](#frontend-integration-guide)
5. [Chart and Plot Rendering](#chart-and-plot-rendering)
6. [Streaming Implementation](#streaming-implementation)
7. [Error Handling](#error-handling)
8. [Security Considerations](#security-considerations)
9. [Performance Optimization](#performance-optimization)
10. [Complete Implementation Examples](#complete-implementation-examples)

## System Overview

The AI Responses Agent System is a sophisticated backend service that provides AI-powered automotive diagnostic assistance with real-time data visualization capabilities. It integrates OpenAI's GPT models with specialized tools for OBD2 diagnostics and Python-based data analysis and visualization.

### Key Features
- **Real-time streaming responses** via Server-Sent Events (SSE)
- **Dynamic chart/plot generation** using Python's matplotlib/seaborn
- **OBD2 vehicle diagnostics** integration
- **Multi-model fallback system** for reliability
- **Session management** for conversation context
- **Tool execution** for extended capabilities

### Core Components
1. **ResponsesAPIService** (`/services/responsesService.js`) - Main service orchestrator
2. **PythonExecutionService** (`/services/pythonExecutionService.js`) - Python code execution and plot generation
3. **MCPService** (`/services/mcpService.js`) - Model Control Protocol integration
4. **API Routes** - RESTful and streaming endpoints

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend Application                   │
├─────────────────────────────────────────────────────────────┤
│                     API Layer (Express.js)                    │
├─────────────┬────────────────┬─────────────────┬────────────┤
│ Responses   │ Python         │ MCP             │ OBD2       │
│ Service     │ Execution      │ Service         │ Service    │
├─────────────┴────────────────┴─────────────────┴────────────┤
│                        OpenAI API                             │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow
1. Frontend sends request to API endpoint
2. ResponsesAPIService creates session and initiates OpenAI stream
3. OpenAI may invoke tools (Python execution, OBD2, etc.)
4. Tool results are processed and returned to OpenAI
5. Final response (including charts) is streamed to frontend
6. Frontend renders text and visual content

## API Endpoints

### 1. Streaming Chat Endpoint
**POST** `/api/chat/stream`

Creates a real-time streaming session with the AI agent.

```javascript
// Request
{
  "message": "Analyze my engine performance and create a chart",
  "vehicleContext": {
    "year": "2020",
    "make": "Toyota",
    "model": "Camry",
    "vin": "1234567890"
  },
  "customerContext": {
    "name": "John Doe",
    "dtcCode": "P0301"
  }
}
```

**Response**: Server-Sent Events stream
```
event: session_started
data: {"sessionId":"session_1234567890_abc123def"}

event: content
data: {"content":"I'll analyze your engine performance"}

event: tool_call_progress
data: {"tool":"execute_python_code","status":"executing"}

event: tool_calls_completed
data: {"results":[{"tool":"execute_python_code","plots":[{"path":"/tmp/plot.png","data":"base64..."}]}]}

event: content
data: {"content":"Here's the analysis with a performance chart..."}

event: stream_complete
data: {"message":"Stream completed successfully"}
```

### 2. Non-Streaming Chat Endpoint
**POST** `/api/chat`

For simple request-response without streaming.

```javascript
// Request
{
  "message": "What does DTC code P0301 mean?",
  "vehicleContext": { /* ... */ }
}

// Response
{
  "response": "DTC P0301 indicates a misfire in cylinder 1...",
  "toolCalls": [],
  "sessionId": "session_1234567890_abc123def"
}
```

### 3. Direct Python Execution
**POST** `/api/execute/python`

Execute Python code directly for custom analysis.

```javascript
// Request
{
  "code": "import matplotlib.pyplot as plt\nimport numpy as np\n\nx = np.linspace(0, 10, 100)\ny = np.sin(x)\n\nplt.plot(x, y)\nplt.title('Sine Wave')\nplt.show()",
  "save_plots": true,
  "plot_filename": "sine_wave_analysis"
}

// Response
{
  "success": true,
  "output": "Plot saved successfully",
  "plots_data": [
    {
      "path": "/tmp/sine_wave_analysis.png",
      "data": "data:image/png;base64,iVBORw0KGgoAAAANS..."
    }
  ],
  "execution_id": "exec_1234567890"
}
```

### 4. Health Check
**GET** `/api/health`

```javascript
// Response
{
  "status": "ok",
  "timestamp": "2024-01-10T12:00:00.000Z",
  "openai_configured": true,
  "mcp_server_url": "http://localhost:3700",
  "python_execution": true
}
```

## Frontend Integration Guide

### Basic Setup

```javascript
// services/aiResponseService.js
class AIResponseService {
  constructor() {
    this.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
  }

  async createStreamingChat(message, vehicleContext = {}, customerContext = {}) {
    const response = await fetch(`${this.baseURL}/api/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        vehicleContext,
        customerContext
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.body.getReader();
  }

  async processStream(reader, callbacks) {
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('event:')) {
          const event = line.slice(6).trim();
          const dataLine = lines[lines.indexOf(line) + 1];
          
          if (dataLine && dataLine.startsWith('data:')) {
            const data = JSON.parse(dataLine.slice(5).trim());
            
            if (callbacks[event]) {
              callbacks[event](data);
            }
          }
        }
      }
    }
  }
}

export default AIResponseService;
```

### React Component Implementation

```jsx
// components/AIChat.jsx
import React, { useState, useRef, useEffect } from 'react';
import AIResponseService from '../services/aiResponseService';
import ChartDisplay from './ChartDisplay';
import MessageList from './MessageList';

const AIChat = ({ vehicleContext, customerContext }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [charts, setCharts] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const currentMessageRef = useRef('');
  const aiService = new AIResponseService();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;

    const userMessage = input;
    setInput('');
    setIsStreaming(true);
    
    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    
    // Initialize assistant message
    const assistantMessageId = Date.now();
    setMessages(prev => [...prev, { 
      id: assistantMessageId,
      role: 'assistant', 
      content: '', 
      isStreaming: true 
    }]);
    
    currentMessageRef.current = '';

    try {
      const reader = await aiService.createStreamingChat(
        userMessage,
        vehicleContext,
        customerContext
      );

      await aiService.processStream(reader, {
        session_started: (data) => {
          setSessionId(data.sessionId);
        },
        
        content: (data) => {
          currentMessageRef.current += data.content;
          setMessages(prev => prev.map(msg => 
            msg.id === assistantMessageId 
              ? { ...msg, content: currentMessageRef.current }
              : msg
          ));
        },
        
        tool_call_progress: (data) => {
          console.log('Tool executing:', data.tool, data.status);
        },
        
        tool_calls_completed: (data) => {
          // Process any plots from tool results
          data.results.forEach(result => {
            if (result.plots && result.plots.length > 0) {
              setCharts(prev => [...prev, ...result.plots]);
            }
          });
        },
        
        stream_complete: () => {
          setMessages(prev => prev.map(msg => 
            msg.id === assistantMessageId 
              ? { ...msg, isStreaming: false }
              : msg
          ));
          setIsStreaming(false);
        },
        
        error: (data) => {
          console.error('Stream error:', data);
          setMessages(prev => prev.map(msg => 
            msg.id === assistantMessageId 
              ? { 
                  ...msg, 
                  content: `Error: ${data.message}`, 
                  isStreaming: false,
                  error: true 
                }
              : msg
          ));
          setIsStreaming(false);
        }
      });
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? { 
              ...msg, 
              content: `Error: ${error.message}`, 
              isStreaming: false,
              error: true 
            }
          : msg
      ));
      setIsStreaming(false);
    }
  };

  return (
    <div className="ai-chat-container">
      <div className="chat-header">
        <h2>AI Diagnostic Assistant</h2>
        {sessionId && <span className="session-id">Session: {sessionId}</span>}
      </div>
      
      <MessageList messages={messages} />
      
      {charts.length > 0 && (
        <ChartDisplay charts={charts} onClear={() => setCharts([])} />
      )}
      
      <form onSubmit={handleSubmit} className="chat-input-form">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your vehicle diagnostics..."
          disabled={isStreaming}
          className="chat-input"
        />
        <button type="submit" disabled={isStreaming} className="send-button">
          {isStreaming ? 'Processing...' : 'Send'}
        </button>
      </form>
    </div>
  );
};

export default AIChat;
```

## Chart and Plot Rendering

### Chart Display Component

```jsx
// components/ChartDisplay.jsx
import React, { useState } from 'react';

const ChartDisplay = ({ charts, onClear }) => {
  const [selectedChart, setSelectedChart] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  const downloadChart = (chartData, filename) => {
    const link = document.createElement('a');
    link.href = chartData;
    link.download = filename || 'chart.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const ChartModal = ({ chart, onClose }) => (
    <div className="chart-modal-overlay" onClick={onClose}>
      <div className="chart-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="chart-modal-header">
          <h3>Chart Details</h3>
          <button onClick={onClose} className="close-button">×</button>
        </div>
        <div className="chart-modal-body">
          <div 
            className="chart-zoom-container"
            style={{ transform: `scale(${zoomLevel})` }}
          >
            <img 
              src={chart.data} 
              alt="Diagnostic Chart"
              className="modal-chart-image"
            />
          </div>
          <div className="chart-controls">
            <button onClick={() => setZoomLevel(z => Math.max(0.5, z - 0.1))}>
              Zoom Out
            </button>
            <span>{Math.round(zoomLevel * 100)}%</span>
            <button onClick={() => setZoomLevel(z => Math.min(3, z + 0.1))}>
              Zoom In
            </button>
            <button onClick={() => downloadChart(chart.data, chart.path)}>
              Download
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="chart-display-container">
      <div className="chart-header">
        <h3>Generated Charts ({charts.length})</h3>
        <button onClick={onClear} className="clear-charts-button">
          Clear All
        </button>
      </div>
      
      <div className="charts-grid">
        {charts.map((chart, index) => (
          <div key={index} className="chart-item">
            <img 
              src={chart.data} 
              alt={`Chart ${index + 1}`}
              onClick={() => setSelectedChart(chart)}
              className="chart-thumbnail"
            />
            <div className="chart-actions">
              <button 
                onClick={() => downloadChart(chart.data, chart.path)}
                className="download-button"
              >
                Download
              </button>
            </div>
          </div>
        ))}
      </div>
      
      {selectedChart && (
        <ChartModal 
          chart={selectedChart} 
          onClose={() => setSelectedChart(null)} 
        />
      )}
    </div>
  );
};

export default ChartDisplay;
```

### Styling for Charts

```css
/* styles/charts.css */
.chart-display-container {
  margin: 20px 0;
  padding: 15px;
  background: #f5f5f5;
  border-radius: 8px;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.charts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 15px;
}

.chart-item {
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  transition: transform 0.2s;
}

.chart-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.15);
}

.chart-thumbnail {
  width: 100%;
  height: auto;
  cursor: pointer;
}

.chart-actions {
  padding: 10px;
  display: flex;
  justify-content: center;
}

.download-button {
  padding: 5px 15px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.download-button:hover {
  background: #0056b3;
}

/* Modal Styles */
.chart-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.chart-modal-content {
  background: white;
  border-radius: 8px;
  max-width: 90vw;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.chart-modal-header {
  padding: 15px;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chart-modal-body {
  padding: 20px;
  overflow: auto;
}

.chart-zoom-container {
  display: flex;
  justify-content: center;
  align-items: center;
  transition: transform 0.2s;
  transform-origin: center;
}

.modal-chart-image {
  max-width: 100%;
  height: auto;
}

.chart-controls {
  margin-top: 15px;
  display: flex;
  justify-content: center;
  gap: 10px;
  align-items: center;
}

.chart-controls button {
  padding: 5px 10px;
  background: #f0f0f0;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  cursor: pointer;
}

.chart-controls button:hover {
  background: #e0e0e0;
}
```

## Streaming Implementation

### Advanced Streaming Handler

```javascript
// utils/streamHandler.js
export class StreamHandler {
  constructor() {
    this.decoder = new TextDecoder();
    this.buffer = '';
    this.eventHandlers = {};
  }

  registerHandler(event, handler) {
    this.eventHandlers[event] = handler;
  }

  async processChunk(chunk) {
    this.buffer += this.decoder.decode(chunk, { stream: true });
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    let i = 0;
    while (i < lines.length) {
      const line = lines[i].trim();
      
      if (line.startsWith('event:')) {
        const event = line.slice(6).trim();
        const nextLine = lines[i + 1];
        
        if (nextLine && nextLine.startsWith('data:')) {
          try {
            const data = JSON.parse(nextLine.slice(5).trim());
            
            if (this.eventHandlers[event]) {
              await this.eventHandlers[event](data);
            }
            
            i += 2; // Skip both event and data lines
            continue;
          } catch (error) {
            console.error('Error parsing SSE data:', error);
          }
        }
      }
      
      i++;
    }
  }

  reset() {
    this.buffer = '';
  }
}

// Usage in React Hook
export function useAIStream() {
  const [messages, setMessages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const streamHandlerRef = useRef(null);

  useEffect(() => {
    streamHandlerRef.current = new StreamHandler();
    
    // Register event handlers
    streamHandlerRef.current.registerHandler('session_started', (data) => {
      console.log('Session started:', data.sessionId);
    });
    
    streamHandlerRef.current.registerHandler('content', (data) => {
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'assistant' && last.isStreaming) {
          return [
            ...prev.slice(0, -1),
            { ...last, content: last.content + data.content }
          ];
        }
        return prev;
      });
    });
    
    streamHandlerRef.current.registerHandler('stream_complete', () => {
      setIsStreaming(false);
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last && last.isStreaming) {
          return [
            ...prev.slice(0, -1),
            { ...last, isStreaming: false }
          ];
        }
        return prev;
      });
    });
    
    streamHandlerRef.current.registerHandler('error', (data) => {
      setError(data.message);
      setIsStreaming(false);
    });
    
    return () => {
      streamHandlerRef.current = null;
    };
  }, []);

  const sendMessage = async (message, context = {}) => {
    setIsStreaming(true);
    setError(null);
    
    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: message }]);
    
    // Add placeholder for assistant
    setMessages(prev => [...prev, { 
      role: 'assistant', 
      content: '', 
      isStreaming: true 
    }]);

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, ...context })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        await streamHandlerRef.current.processChunk(value);
      }
    } catch (err) {
      setError(err.message);
      setIsStreaming(false);
    }
  };

  return { messages, isStreaming, error, sendMessage };
}
```

## Error Handling

### Comprehensive Error Management

```javascript
// utils/errorHandler.js
export class APIError extends Error {
  constructor(message, status, details = {}) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.details = details;
  }
}

export const errorHandler = {
  handleStreamError: (error) => {
    if (error.name === 'AbortError') {
      return { type: 'cancelled', message: 'Request was cancelled' };
    }
    
    if (error.message.includes('NetworkError')) {
      return { type: 'network', message: 'Network connection lost' };
    }
    
    if (error.status === 429) {
      return { type: 'rate_limit', message: 'Too many requests. Please try again later.' };
    }
    
    if (error.status === 500) {
      return { type: 'server_error', message: 'Server error. Please try again.' };
    }
    
    return { type: 'unknown', message: error.message || 'An unexpected error occurred' };
  },

  createRetryStrategy: (maxRetries = 3, baseDelay = 1000) => {
    return async (fn, ...args) => {
      let lastError;
      
      for (let i = 0; i < maxRetries; i++) {
        try {
          return await fn(...args);
        } catch (error) {
          lastError = error;
          
          if (error.status === 429 || error.status >= 500) {
            const delay = baseDelay * Math.pow(2, i);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          
          throw error;
        }
      }
      
      throw lastError;
    };
  }
};

// React Error Boundary for Chart Components
export class ChartErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Chart rendering error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="chart-error">
          <h3>Unable to display chart</h3>
          <p>{this.state.error?.message || 'An error occurred while rendering the chart'}</p>
          <button onClick={() => this.setState({ hasError: false, error: null })}>
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

### Network Resilience

```javascript
// services/networkService.js
export class NetworkService {
  constructor() {
    this.isOnline = navigator.onLine;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));
  }

  handleOnline() {
    this.isOnline = true;
    this.reconnectAttempts = 0;
    this.emit('connection-restored');
  }

  handleOffline() {
    this.isOnline = false;
    this.emit('connection-lost');
  }

  async fetchWithRetry(url, options = {}, retries = 3) {
    if (!this.isOnline) {
      throw new Error('No internet connection');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok && retries > 0) {
        await this.delay(this.reconnectDelay);
        return this.fetchWithRetry(url, options, retries - 1);
      }

      return response;
    } catch (error) {
      clearTimeout(timeout);

      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }

      if (retries > 0 && this.isOnline) {
        await this.delay(this.reconnectDelay);
        return this.fetchWithRetry(url, options, retries - 1);
      }

      throw error;
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  emit(event) {
    window.dispatchEvent(new CustomEvent(`network-${event}`));
  }
}
```

## Security Considerations

### Frontend Security Best Practices

```javascript
// utils/security.js
export const security = {
  // Sanitize HTML content if rendering any user-generated content
  sanitizeHTML: (html) => {
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
  },

  // Validate image data before rendering
  validateImageData: (base64Data) => {
    const validImagePattern = /^data:image\/(png|jpeg|jpg|gif|webp);base64,/;
    return validImagePattern.test(base64Data);
  },

  // Secure storage for sensitive data
  secureStorage: {
    set: (key, value) => {
      try {
        const encrypted = btoa(JSON.stringify(value));
        sessionStorage.setItem(key, encrypted);
      } catch (error) {
        console.error('Storage error:', error);
      }
    },
    
    get: (key) => {
      try {
        const encrypted = sessionStorage.getItem(key);
        if (!encrypted) return null;
        return JSON.parse(atob(encrypted));
      } catch (error) {
        console.error('Retrieval error:', error);
        return null;
      }
    },
    
    remove: (key) => {
      sessionStorage.removeItem(key);
    }
  },

  // Content Security Policy headers (configure on server)
  cspHeaders: {
    'Content-Security-Policy': [
      "default-src 'self'",
      "img-src 'self' data: https:",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "connect-src 'self' http://localhost:* ws://localhost:*"
    ].join('; ')
  }
};

// Secure Chart Component
export const SecureChart = ({ chartData }) => {
  const [isValid, setIsValid] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (chartData && chartData.data) {
      if (security.validateImageData(chartData.data)) {
        setIsValid(true);
      } else {
        setError('Invalid image data');
      }
    }
  }, [chartData]);

  if (error) {
    return <div className="chart-error">{error}</div>;
  }

  if (!isValid) {
    return <div className="chart-loading">Validating chart...</div>;
  }

  return (
    <img 
      src={chartData.data} 
      alt="Diagnostic Chart"
      onError={() => setError('Failed to load chart')}
    />
  );
};
```

## Performance Optimization

### Lazy Loading and Code Splitting

```javascript
// components/LazyChartDisplay.jsx
import React, { lazy, Suspense } from 'react';

const ChartDisplay = lazy(() => import('./ChartDisplay'));

export const LazyChartDisplay = (props) => (
  <Suspense fallback={<div className="chart-loading">Loading charts...</div>}>
    <ChartDisplay {...props} />
  </Suspense>
);

// Performance monitoring
export const performanceMonitor = {
  measureStreamLatency: () => {
    const marks = {};
    
    return {
      mark: (name) => {
        marks[name] = performance.now();
      },
      
      measure: (startMark, endMark) => {
        if (marks[startMark] && marks[endMark]) {
          return marks[endMark] - marks[startMark];
        }
        return null;
      },
      
      getMetrics: () => {
        return {
          firstByte: marks.firstByte - marks.start,
          complete: marks.complete - marks.start,
          renderTime: marks.rendered - marks.complete
        };
      }
    };
  },

  // Optimize chart rendering
  optimizeChartData: (base64Data) => {
    // Implement compression/optimization if needed
    return base64Data;
  },

  // Debounce user input
  debounce: (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
};
```

### Caching Strategy

```javascript
// utils/cache.js
export class ChartCache {
  constructor(maxSize = 50) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  set(key, value) {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, {
      data: value,
      timestamp: Date.now()
    });
  }

  get(key, maxAge = 3600000) { // 1 hour default
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() - item.timestamp > maxAge) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }

  clear() {
    this.cache.clear();
  }

  preload(charts) {
    charts.forEach((chart, index) => {
      const img = new Image();
      img.src = chart.data;
      this.set(`preload_${index}`, chart);
    });
  }
}
```

## Complete Implementation Examples

### Full-Featured Chat Application

```jsx
// App.jsx
import React, { useState, useEffect } from 'react';
import AIChat from './components/AIChat';
import VehicleSelector from './components/VehicleSelector';
import DiagnosticDashboard from './components/DiagnosticDashboard';
import { NetworkService } from './services/networkService';
import { ChartCache } from './utils/cache';
import './styles/app.css';

function App() {
  const [vehicleContext, setVehicleContext] = useState({});
  const [customerContext, setCustomerContext] = useState({});
  const [networkStatus, setNetworkStatus] = useState('online');
  const [chartCache] = useState(new ChartCache());

  useEffect(() => {
    const network = new NetworkService();
    
    window.addEventListener('network-connection-lost', () => {
      setNetworkStatus('offline');
    });
    
    window.addEventListener('network-connection-restored', () => {
      setNetworkStatus('online');
    });

    return () => {
      window.removeEventListener('network-connection-lost');
      window.removeEventListener('network-connection-restored');
    };
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>AI Automotive Diagnostic System</h1>
        <div className={`network-status ${networkStatus}`}>
          {networkStatus === 'online' ? '● Connected' : '● Offline'}
        </div>
      </header>

      <div className="app-content">
        <aside className="sidebar">
          <VehicleSelector 
            onSelect={setVehicleContext}
            currentVehicle={vehicleContext}
          />
          
          <DiagnosticDashboard 
            vehicleContext={vehicleContext}
            customerContext={customerContext}
          />
        </aside>

        <main className="main-content">
          <AIChat 
            vehicleContext={vehicleContext}
            customerContext={customerContext}
            chartCache={chartCache}
          />
        </main>
      </div>
    </div>
  );
}

export default App;
```

### Production-Ready Service Class

```javascript
// services/AIResponseService.js
export class AIResponseService {
  constructor(config = {}) {
    this.baseURL = config.baseURL || process.env.REACT_APP_API_URL;
    this.apiKey = config.apiKey || process.env.REACT_APP_API_KEY;
    this.timeout = config.timeout || 30000;
    this.retryAttempts = config.retryAttempts || 3;
    this.cache = new Map();
  }

  async createStreamingSession(message, context = {}) {
    const headers = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(`${this.baseURL}/api/chat/stream`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message,
        ...context
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new APIError(
        error.message || 'Failed to create streaming session',
        response.status,
        error
      );
    }

    return new StreamProcessor(response.body.getReader());
  }

  async executePythonCode(code, options = {}) {
    const response = await this.fetchWithRetry('/api/execute/python', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        code,
        ...options
      })
    });

    const result = await response.json();
    
    // Cache successful plot results
    if (result.success && result.plots_data) {
      result.plots_data.forEach(plot => {
        this.cache.set(plot.path, plot);
      });
    }

    return result;
  }

  async fetchWithRetry(endpoint, options, attempts = this.retryAttempts) {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        ...options,
        signal: AbortSignal.timeout(this.timeout)
      });

      if (!response.ok && attempts > 1) {
        await this.delay(1000 * (this.retryAttempts - attempts + 1));
        return this.fetchWithRetry(endpoint, options, attempts - 1);
      }

      return response;
    } catch (error) {
      if (attempts > 1 && error.name !== 'AbortError') {
        await this.delay(1000 * (this.retryAttempts - attempts + 1));
        return this.fetchWithRetry(endpoint, options, attempts - 1);
      }
      throw error;
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getCachedChart(path) {
    return this.cache.get(path);
  }

  clearCache() {
    this.cache.clear();
  }
}

// Stream processor class for handling SSE
class StreamProcessor {
  constructor(reader) {
    this.reader = reader;
    this.decoder = new TextDecoder();
    this.buffer = '';
  }

  async *getEvents() {
    try {
      while (true) {
        const { done, value } = await this.reader.read();
        if (done) break;

        this.buffer += this.decoder.decode(value, { stream: true });
        const lines = this.buffer.split('\n');
        this.buffer = lines.pop() || '';

        for (const line of lines) {
          const event = this.parseSSELine(line);
          if (event) {
            yield event;
          }
        }
      }
    } finally {
      this.reader.releaseLock();
    }
  }

  parseSSELine(line) {
    if (line.startsWith('event:')) {
      return { type: 'event', data: line.slice(6).trim() };
    }
    if (line.startsWith('data:')) {
      try {
        return { type: 'data', data: JSON.parse(line.slice(5).trim()) };
      } catch {
        return { type: 'data', data: line.slice(5).trim() };
      }
    }
    return null;
  }
}
```

## Testing Guide

### Unit Tests for Chart Components

```javascript
// __tests__/ChartDisplay.test.jsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ChartDisplay from '../components/ChartDisplay';

describe('ChartDisplay', () => {
  const mockCharts = [
    {
      path: '/tmp/test_chart_1.png',
      data: 'data:image/png;base64,iVBORw0KGgoAAAANS...'
    },
    {
      path: '/tmp/test_chart_2.png',
      data: 'data:image/png;base64,iVBORw0KGgoAAAANS...'
    }
  ];

  test('renders charts correctly', () => {
    render(<ChartDisplay charts={mockCharts} />);
    
    const images = screen.getAllByRole('img');
    expect(images).toHaveLength(2);
  });

  test('handles download functionality', () => {
    const createElementSpy = jest.spyOn(document, 'createElement');
    render(<ChartDisplay charts={mockCharts} />);
    
    const downloadButtons = screen.getAllByText('Download');
    fireEvent.click(downloadButtons[0]);
    
    expect(createElementSpy).toHaveBeenCalledWith('a');
  });

  test('opens modal on chart click', () => {
    render(<ChartDisplay charts={mockCharts} />);
    
    const images = screen.getAllByRole('img');
    fireEvent.click(images[0]);
    
    expect(screen.getByText('Chart Details')).toBeInTheDocument();
  });

  test('clears all charts', () => {
    const onClear = jest.fn();
    render(<ChartDisplay charts={mockCharts} onClear={onClear} />);
    
    fireEvent.click(screen.getByText('Clear All'));
    expect(onClear).toHaveBeenCalled();
  });
});

// Integration test for streaming
describe('AI Chat Integration', () => {
  test('handles streaming response with charts', async () => {
    // Mock fetch
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        body: {
          getReader: () => ({
            read: jest.fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  'event: session_started\ndata: {"sessionId":"test123"}\n\n'
                )
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  'event: content\ndata: {"content":"Analyzing..."}\n\n'
                )
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  'event: tool_calls_completed\ndata: {"results":[{"plots":[{"data":"base64..."}]}]}\n\n'
                )
              })
              .mockResolvedValueOnce({ done: true })
          })
        }
      })
    );

    render(<AIChat />);
    
    const input = screen.getByPlaceholderText(/ask about/i);
    const sendButton = screen.getByText('Send');
    
    fireEvent.change(input, { target: { value: 'Create a performance chart' } });
    fireEvent.click(sendButton);
    
    await waitFor(() => {
      expect(screen.getByText(/Analyzing/i)).toBeInTheDocument();
    });
  });
});
```

## Troubleshooting

### Common Issues and Solutions

1. **Charts not displaying**
   - Verify base64 data format
   - Check Content Security Policy
   - Ensure proper CORS headers
   - Validate image MIME types

2. **Streaming connection drops**
   - Implement reconnection logic
   - Add heartbeat mechanism
   - Handle network transitions
   - Use exponential backoff

3. **Performance issues**
   - Implement virtual scrolling for many charts
   - Use lazy loading
   - Compress large images
   - Cache frequently accessed data

4. **Memory leaks**
   - Clean up event listeners
   - Cancel ongoing requests
   - Clear unused chart data
   - Implement proper cleanup in useEffect

## Best Practices Summary

1. **Always validate and sanitize** image data before rendering
2. **Implement proper error boundaries** for chart components
3. **Use progressive enhancement** - basic functionality should work without charts
4. **Cache charts appropriately** to improve performance
5. **Handle network failures gracefully** with offline support
6. **Optimize bundle size** with code splitting
7. **Monitor performance** and implement analytics
8. **Test thoroughly** including edge cases and error scenarios
9. **Document your implementation** for team collaboration
10. **Keep security in mind** - validate all data from the backend

## Conclusion

This comprehensive guide provides everything needed to build a robust frontend that properly integrates with the AI Responses Agent System. The implementation examples are production-ready and include best practices for security, performance, and user experience.

Remember to:
- Start with basic functionality and progressively enhance
- Test thoroughly in different network conditions
- Monitor performance and user experience
- Keep the implementation maintainable and well-documented

For additional support or questions, refer to the API documentation or contact the backend team.