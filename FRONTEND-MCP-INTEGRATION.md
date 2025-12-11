# Frontend MCP Integration Guide

## Overview

This guide explains how to integrate your frontend application with the MCP-enhanced OBD2 analysis system. The frontend can access both real-time vehicle data and enhanced diagnostic capabilities through the new experimental endpoints.

## Architecture Overview

```
Frontend Application
    ↓ HTTP/WebSocket
Backend API Server
    ↓ MCP Protocol
ELM327 MCP Server
    ↓ OBD2 Protocol  
ELM327 Adapter → Vehicle
```

## Integration Points

### 1. **Enhanced Analysis API**
### 2. **Live Vehicle Status**
### 3. **Real-time Data Streaming**
### 4. **Error Handling & Fallback**

---

## 1. Enhanced Analysis API Integration

### Basic Implementation

```javascript
// Enhanced analysis with real-time data
async function performMCPAnalysis(sessionId, question, options = {}) {
  const response = await fetch(`/api/obd2/sessions/${sessionId}/analyze/secure/experimental`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({
      question,
      reasoningEffort: options.reasoningEffort || 'medium',
      includeRealtimeData: options.includeRealtime ?? true,
      realtimeDuration: options.duration || 30,
      enableLiveComparison: options.enableComparison ?? true,
      mcpConfig: options.mcpConfig || {}
    })
  });

  if (!response.ok) {
    throw new Error(`Analysis failed: ${response.statusText}`);
  }

  return await response.json();
}

// Usage example
try {
  const result = await performMCPAnalysis('session_123', 'Analyze engine performance issues', {
    includeRealtime: true,
    duration: 45,
    reasoningEffort: 'high'
  });
  
  console.log('Analysis:', result.analysis);
  console.log('Live comparison:', result.liveDataComparison);
  console.log('Plots:', result.plots);
} catch (error) {
  console.error('MCP analysis failed:', error);
  // Fallback to regular analysis
}
```

### React Component Example

```jsx
import React, { useState, useCallback } from 'react';

const MCPAnalysisComponent = ({ sessionId }) => {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [liveDataAvailable, setLiveDataAvailable] = useState(false);
  const [error, setError] = useState(null);

  const performAnalysis = useCallback(async (question, useRealtime = true) => {
    setLoading(true);
    setError(null);

    try {
      const result = await performMCPAnalysis(sessionId, question, {
        includeRealtime: useRealtime,
        duration: 30,
        enableComparison: true
      });

      setAnalysis(result);
      setLiveDataAvailable(result.metadata?.liveDataCollected || false);
    } catch (err) {
      setError(err.message);
      // Could fallback to regular analysis here
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  return (
    <div className="mcp-analysis-container">
      <div className="analysis-controls">
        <input 
          type="text" 
          placeholder="Ask a diagnostic question..."
          onKeyDown={(e) => e.key === 'Enter' && performAnalysis(e.target.value)}
        />
        <button 
          onClick={() => performAnalysis('Comprehensive vehicle analysis')}
          disabled={loading}
        >
          {loading ? 'Analyzing...' : 'Analyze with Live Data'}
        </button>
      </div>

      {error && (
        <div className="error-banner">
          <strong>MCP Error:</strong> {error}
          <small>Analysis may have fallen back to historical data only.</small>
        </div>
      )}

      {analysis && (
        <div className="analysis-results">
          <div className="metadata">
            <span className={`status ${liveDataAvailable ? 'live' : 'historical'}`}>
              {liveDataAvailable ? '🟢 Live Data' : '🟡 Historical Only'}
            </span>
            <span>Model: {analysis.metadata?.model}</span>
            <span>Duration: {analysis.metadata?.duration_ms}ms</span>
          </div>

          <div className="analysis-content">
            <pre>{analysis.analysis}</pre>
          </div>

          {analysis.liveDataComparison && (
            <LiveComparisonComponent data={analysis.liveDataComparison} />
          )}

          {analysis.plots?.length > 0 && (
            <PlotsComponent plots={analysis.plots} />
          )}
        </div>
      )}
    </div>
  );
};
```

---

## 2. Live Vehicle Status Integration

### Real-time Status Component

```jsx
import React, { useState, useEffect } from 'react';

const LiveVehicleStatus = ({ refreshInterval = 10000 }) => {
  const [status, setStatus] = useState(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);

  const checkLiveStatus = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/obd2/live/status');
      const data = await response.json();
      
      setStatus(data.vehicleStatus);
      setConnected(data.success && data.vehicleStatus?.connection?.connected);
    } catch (error) {
      console.error('Status check failed:', error);
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkLiveStatus();
    const interval = setInterval(checkLiveStatus, refreshInterval);
    return () => clearInterval(interval);
  }, [checkLiveStatus, refreshInterval]);

  return (
    <div className="live-status-widget">
      <div className="status-header">
        <h3>Live Vehicle Connection</h3>
        <div className={`connection-indicator ${connected ? 'connected' : 'disconnected'}`}>
          {connected ? '🟢 Connected' : '🔴 Disconnected'}
        </div>
      </div>

      {status && connected && (
        <div className="status-details">
          <div className="connection-info">
            <p><strong>Protocol:</strong> {status.connection?.protocol}</p>
            <p><strong>Response Time:</strong> {status.connection?.response_time_ms}ms</p>
            <p><strong>Quality:</strong> {status.connection?.connection_quality}</p>
          </div>

          {status.realtime_data?.summary && (
            <div className="realtime-preview">
              <h4>Current Data Preview</h4>
              <p>PIDs Available: {status.realtime_data.summary.pid_count}</p>
              <p>Sample Rate: {status.realtime_data.summary.sample_count} readings</p>
            </div>
          )}

          {status.diagnostics && (
            <div className="diagnostic-summary">
              <h4>Active Issues</h4>
              {status.diagnostics.total_count > 0 ? (
                <p className="dtc-warning">
                  ⚠️ {status.diagnostics.total_count} diagnostic trouble codes found
                </p>
              ) : (
                <p className="no-dtcs">✅ No diagnostic codes detected</p>
              )}
            </div>
          )}
        </div>
      )}

      <button onClick={checkLiveStatus} disabled={loading}>
        {loading ? 'Checking...' : 'Refresh Status'}
      </button>
    </div>
  );
};
```

### Status Dashboard Hook

```javascript
// Custom hook for vehicle status
export const useVehicleStatus = (refreshInterval = 10000) => {
  const [status, setStatus] = useState({
    connected: false,
    data: null,
    lastUpdate: null,
    error: null
  });

  const checkStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/obd2/live/status');
      const result = await response.json();
      
      setStatus({
        connected: result.success && result.vehicleStatus?.connection?.connected,
        data: result.vehicleStatus,
        lastUpdate: new Date(),
        error: null
      });
    } catch (error) {
      setStatus(prev => ({
        ...prev,
        connected: false,
        error: error.message
      }));
    }
  }, []);

  useEffect(() => {
    checkStatus();
    if (refreshInterval > 0) {
      const interval = setInterval(checkStatus, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [checkStatus, refreshInterval]);

  return { ...status, refresh: checkStatus };
};
```

---

## 3. Real-time Data Streaming

### WebSocket Integration Enhancement

```javascript
// Enhanced WebSocket service for MCP data
class MCPWebSocketService {
  constructor(baseUrl = 'ws://localhost:5005') {
    this.baseUrl = baseUrl;
    this.socket = null;
    this.eventHandlers = new Map();
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.socket = new WebSocket(`${this.baseUrl}/obd2-realtime`);
      
      this.socket.onopen = () => {
        console.log('MCP WebSocket connected');
        resolve();
      };
      
      this.socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      };
      
      this.socket.onerror = reject;
      this.socket.onclose = () => {
        console.log('MCP WebSocket disconnected');
        // Auto-reconnect logic could go here
      };
    });
  }

  handleMessage(data) {
    const { type, payload } = data;
    
    switch (type) {
      case 'mcp-realtime-data':
        this.emit('realtimeData', payload);
        break;
      case 'mcp-diagnostic-alert':
        this.emit('diagnosticAlert', payload);
        break;
      case 'mcp-analysis-update':
        this.emit('analysisUpdate', payload);
        break;
      case 'mcp-connection-status':
        this.emit('connectionStatus', payload);
        break;
      default:
        console.log('Unknown MCP message type:', type);
    }
  }

  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(handler);
  }

  emit(event, data) {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach(handler => handler(data));
  }

  requestLiveData(sessionId, pids, duration = 30) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({
        type: 'request-live-data',
        sessionId,
        pids,
        duration
      }));
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}

// Usage in React component
const RealtimeDataComponent = ({ sessionId }) => {
  const [liveData, setLiveData] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const wsService = useRef(new MCPWebSocketService());

  useEffect(() => {
    const service = wsService.current;
    
    service.connect().then(() => {
      service.on('realtimeData', (data) => {
        setLiveData(prev => [...prev.slice(-99), data]); // Keep last 100 readings
      });
      
      service.on('diagnosticAlert', (alert) => {
        setAlerts(prev => [alert, ...prev.slice(0, 9)]); // Keep last 10 alerts
      });
    });

    return () => service.disconnect();
  }, []);

  return (
    <div className="realtime-dashboard">
      {alerts.length > 0 && (
        <div className="alert-panel">
          {alerts.map((alert, i) => (
            <div key={i} className={`alert ${alert.severity}`}>
              {alert.message}
            </div>
          ))}
        </div>
      )}
      
      <RealtimeChart data={liveData} />
    </div>
  );
};
```

---

## 4. Error Handling & Fallback Strategy

### Comprehensive Error Handling

```javascript
// MCP Error Handler
class MCPErrorHandler {
  static handleAnalysisError(error, fallbackFn) {
    console.error('MCP Analysis Error:', error);
    
    // Categorize errors
    if (error.message.includes('MCP functionality not available')) {
      return this.handleMCPUnavailable(fallbackFn);
    } else if (error.message.includes('ELM327')) {
      return this.handleAdapterError(fallbackFn);
    } else if (error.message.includes('timeout')) {
      return this.handleTimeout(fallbackFn);
    } else {
      return this.handleGenericError(error, fallbackFn);
    }
  }

  static handleMCPUnavailable(fallbackFn) {
    return {
      error: 'Live vehicle data not available',
      suggestion: 'Analysis will use historical data only',
      action: fallbackFn
    };
  }

  static handleAdapterError(fallbackFn) {
    return {
      error: 'ELM327 adapter connection failed',
      suggestion: 'Check vehicle connection and try again',
      troubleshooting: [
        'Ensure vehicle ignition is ON',
        'Check ELM327 adapter pairing',
        'Verify OBD2 port accessibility'
      ],
      action: fallbackFn
    };
  }

  static handleTimeout(fallbackFn) {
    return {
      error: 'Vehicle communication timeout',
      suggestion: 'Try with shorter data collection period',
      action: fallbackFn
    };
  }

  static handleGenericError(error, fallbackFn) {
    return {
      error: error.message,
      suggestion: 'Falling back to historical analysis',
      action: fallbackFn
    };
  }
}

// Enhanced analysis component with error handling
const EnhancedAnalysisComponent = ({ sessionId }) => {
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [fallbackUsed, setFallbackUsed] = useState(false);

  const performAnalysisWithFallback = async (question) => {
    try {
      // Try MCP analysis first
      const mcpResult = await performMCPAnalysis(sessionId, question);
      setResult(mcpResult);
      setFallbackUsed(false);
    } catch (mcpError) {
      // Handle error and potentially fallback
      const errorInfo = MCPErrorHandler.handleAnalysisError(mcpError, async () => {
        try {
          // Fallback to regular analysis
          const regularResult = await performRegularAnalysis(sessionId, question);
          setResult({
            ...regularResult,
            metadata: {
              ...regularResult.metadata,
              fallback_reason: mcpError.message,
              analysis_type: 'historical_only'
            }
          });
          setFallbackUsed(true);
        } catch (fallbackError) {
          setError({
            primary: mcpError.message,
            fallback: fallbackError.message
          });
        }
      });

      setError(errorInfo);
      
      // Execute fallback if available
      if (errorInfo.action) {
        await errorInfo.action();
      }
    }
  };

  return (
    <div>
      {error && (
        <ErrorBanner 
          error={error} 
          onRetry={() => performAnalysisWithFallback(lastQuestion)}
        />
      )}
      
      {fallbackUsed && (
        <FallbackNotice message="Analysis completed using historical data only" />
      )}
      
      {result && <AnalysisResults data={result} />}
    </div>
  );
};
```

---

## 5. UI Components Library

### Error Banner Component

```jsx
const ErrorBanner = ({ error, onRetry, onDismiss }) => (
  <div className="error-banner mcp-error">
    <div className="error-content">
      <h4>⚠️ Live Data Integration Issue</h4>
      <p><strong>Issue:</strong> {error.error}</p>
      <p><strong>Solution:</strong> {error.suggestion}</p>
      
      {error.troubleshooting && (
        <details>
          <summary>Troubleshooting Steps</summary>
          <ul>
            {error.troubleshooting.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
    
    <div className="error-actions">
      <button onClick={onRetry}>Retry</button>
      <button onClick={onDismiss} className="secondary">Dismiss</button>
    </div>
  </div>
);
```

### Live Data Comparison Component

```jsx
const LiveComparisonComponent = ({ data }) => {
  if (!data?.findings) return null;

  return (
    <div className="live-comparison">
      <h4>🔍 Live vs Historical Comparison</h4>
      
      <div className="comparison-summary">
        <span>Duration: {data.comparison_duration}s</span>
        <span>Findings: {data.findings?.length || 0}</span>
        <span>Session: {data.session_id}</span>
      </div>

      <div className="findings-list">
        {data.findings.map((finding, i) => (
          <div key={i} className={`finding ${finding.type}`}>
            {finding.type === 'safety_alert' && (
              <div className="safety-alert">
                <strong>🚨 Safety Alert:</strong> {finding.message}
                <small>Current: {finding.current_value}, Threshold: {finding.threshold}</small>
              </div>
            )}
            
            {finding.type === 'comparison' && (
              <div className="comparison-item">
                <strong>{finding.description}:</strong> {finding.analysis}
                <small>Confidence: {finding.confidence}</small>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
```

---

## 6. Configuration & Settings

### Frontend Configuration

```javascript
// config/mcp-frontend.js
export const MCP_CONFIG = {
  // API endpoints
  endpoints: {
    analysis: '/api/obd2/sessions/:sessionId/analyze/secure/experimental',
    liveStatus: '/api/obd2/live/status',
    websocket: 'ws://localhost:5005/obd2-realtime'
  },

  // Default settings
  defaults: {
    realtimeDuration: 30,
    reasoningEffort: 'medium',
    includeRealtimeData: true,
    enableLiveComparison: true,
    statusRefreshInterval: 10000
  },

  // UI settings
  ui: {
    showLiveIndicator: true,
    enableSafetyAlerts: true,
    autoRetryOnFailure: true,
    maxRetryAttempts: 2
  },

  // Feature flags
  features: {
    realtimeStreaming: true,
    liveComparison: true,
    safetyMonitoring: true,
    fallbackAnalysis: true
  }
};
```

---

## 7. Testing Integration

### Frontend Testing

```javascript
// Test MCP integration
describe('MCP Integration', () => {
  test('should fallback gracefully when MCP unavailable', async () => {
    // Mock MCP failure
    fetchMock.mockRejectOnce(new Error('MCP functionality not available'));
    fetchMock.mockResolveOnce({ /* regular analysis response */ });

    const result = await performAnalysisWithFallback('session_123', 'test question');
    
    expect(result.metadata.analysis_type).toBe('historical_only');
    expect(result.metadata.fallback_reason).toContain('MCP functionality not available');
  });

  test('should handle live data successfully', async () => {
    fetchMock.mockResolveOnce({
      json: () => ({
        success: true,
        liveDataComparison: { findings: [] },
        metadata: { liveDataCollected: true }
      })
    });

    const result = await performMCPAnalysis('session_123', 'test question');
    
    expect(result.metadata.liveDataCollected).toBe(true);
  });
});
```

---

## 8. Performance Considerations

### Optimization Tips

```javascript
// Debounced live status checks
const useDebouncedLiveStatus = (delay = 1000) => {
  const [status, setStatus] = useState(null);
  const debouncedCheck = useMemo(
    () => debounce(async () => {
      const result = await fetch('/api/obd2/live/status');
      setStatus(await result.json());
    }, delay),
    [delay]
  );

  return { status, check: debouncedCheck };
};

// Cached analysis results
const analysisCache = new Map();
const getCachedAnalysis = (sessionId, question) => {
  const key = `${sessionId}:${question}`;
  return analysisCache.get(key);
};
```

---

## Summary

This integration provides:

✅ **Enhanced Analysis UI** with real-time data capabilities  
✅ **Live Vehicle Status** monitoring and connection management  
✅ **Real-time Data Streaming** through WebSocket enhancement  
✅ **Robust Error Handling** with automatic fallback to historical analysis  
✅ **Performance Optimizations** with caching and debouncing  
✅ **Comprehensive Testing** patterns for MCP functionality  

The frontend can now seamlessly integrate live vehicle data while maintaining compatibility with your existing historical analysis system.