// frontend/hooks/useOBD2LiveData.js - React hooks for real-time OBD2 data without WebSockets

import { useState, useEffect, useRef, useCallback } from 'react';

// Configuration
const DEFAULT_POLLING_INTERVAL = 1000; // 1 second
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 2000; // 2 seconds

// =====================================================
// Hook 1: Server-Sent Events (SSE) Implementation
// =====================================================

export function useOBD2SSE(sessionId, options = {}) {
  const [data, setData] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [error, setError] = useState(null);
  const eventSourceRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const maxDataPoints = options.maxDataPoints || 100;

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!sessionId) return;

    cleanup();
    setConnectionStatus('connecting');

    try {
      const eventSource = new EventSource(`/api/obd2/sessions/${sessionId}/stream`);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setConnectionStatus('connected');
        setError(null);
        reconnectAttemptsRef.current = 0;
        console.log(`✅ SSE connected to session ${sessionId}`);
      };

      eventSource.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'data') {
            setData(prev => {
              const updated = [...prev, message];
              return updated.slice(-maxDataPoints);
            });
          } else if (message.type === 'connected') {
            console.log(`🔌 SSE session connected: ${message.sessionId}`);
          }
        } catch (err) {
          console.error('❌ Failed to parse SSE message:', err);
        }
      };

      eventSource.onerror = (err) => {
        console.error('❌ SSE error:', err);
        setConnectionStatus('disconnected');
        setError('Connection lost');

        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttemptsRef.current++;
          console.log(`🔄 Attempting SSE reconnect ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS}`);\n          setTimeout(connect, RECONNECT_DELAY * reconnectAttemptsRef.current);
        } else {
          setError('Max reconnection attempts reached');
        }
      };

    } catch (err) {
      setError(err.message);
      setConnectionStatus('error');
    }
  }, [sessionId, cleanup, maxDataPoints]);

  useEffect(() => {
    connect();
    return cleanup;
  }, [connect, cleanup]);

  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    connect();
  }, [connect]);

  return {
    data,
    connectionStatus,
    error,
    reconnect,
    clearData: () => setData([])
  };
}

// =====================================================
// Hook 2: Smart Polling Implementation
// =====================================================

export function useOBD2Polling(sessionId, options = {}) {
  const [data, setData] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [error, setError] = useState(null);
  const [isPolling, setIsPolling] = useState(true);
  
  const lastTimestampRef = useRef(0);
  const pollingIntervalRef = useRef(options.interval || DEFAULT_POLLING_INTERVAL);
  const timeoutRef = useRef(null);
  const maxDataPoints = options.maxDataPoints || 100;
  const adaptive = options.adaptive !== false; // Adaptive polling enabled by default

  const poll = useCallback(async () => {
    if (!sessionId || !isPolling) return;

    try {
      setConnectionStatus('connected');
      
      const response = await fetch(
        `/api/obd2/sessions/${sessionId}/updates?since=${lastTimestampRef.current}&limit=50`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.data && result.data.length > 0) {
        setData(prev => {
          const combined = [...prev, ...result.data];
          return combined.slice(-maxDataPoints);
        });
        
        lastTimestampRef.current = result.data[result.data.length - 1].timestamp;
        
        // Adaptive polling: speed up when data is flowing
        if (adaptive) {
          pollingIntervalRef.current = Math.max(500, DEFAULT_POLLING_INTERVAL * 0.8);
        }
      } else {
        // Adaptive polling: slow down when no new data
        if (adaptive) {
          pollingIntervalRef.current = Math.min(5000, pollingIntervalRef.current * 1.2);
        }
      }

      setError(null);

    } catch (err) {
      console.error('❌ Polling error:', err);
      setError(err.message);
      setConnectionStatus('error');
      
      // Back off on error
      pollingIntervalRef.current = Math.min(10000, pollingIntervalRef.current * 2);
    }

    // Schedule next poll
    if (isPolling) {
      timeoutRef.current = setTimeout(poll, pollingIntervalRef.current);
    }
  }, [sessionId, isPolling, maxDataPoints, adaptive]);

  useEffect(() => {
    if (sessionId && isPolling) {
      poll();
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [poll, sessionId, isPolling]);

  const startPolling = useCallback(() => {
    setIsPolling(true);
  }, []);

  const stopPolling = useCallback(() => {
    setIsPolling(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  return {
    data,
    connectionStatus,
    error,
    isPolling,
    startPolling,
    stopPolling,
    clearData: () => setData([]),
    currentInterval: pollingIntervalRef.current
  };
}

// =====================================================
// Hook 3: Long Polling Implementation
// =====================================================

export function useOBD2LongPolling(sessionId, options = {}) {
  const [data, setData] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [error, setError] = useState(null);
  const [isActive, setIsActive] = useState(true);
  
  const lastTimestampRef = useRef(0);
  const maxDataPoints = options.maxDataPoints || 100;
  
  const longPoll = useCallback(async () => {
    if (!sessionId || !isActive) return;

    try {
      setConnectionStatus('connected');
      
      const response = await fetch(
        `/api/obd2/sessions/${sessionId}/long-poll?lastTimestamp=${lastTimestampRef.current}`,
        {
          signal: AbortSignal.timeout(35000) // 35 second timeout
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.type === 'data' && result.data.length > 0) {
        setData(prev => {
          const combined = [...prev, ...result.data];
          return combined.slice(-maxDataPoints);
        });
        
        lastTimestampRef.current = result.data[result.data.length - 1].timestamp;
      }

      setError(null);

      // Continue long polling
      if (isActive) {
        setTimeout(longPoll, 100); // Brief delay before next long poll
      }

    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('❌ Long polling error:', err);
        setError(err.message);
        setConnectionStatus('error');
        
        // Retry after delay
        if (isActive) {
          setTimeout(longPoll, RECONNECT_DELAY);
        }
      }
    }
  }, [sessionId, isActive, maxDataPoints]);

  useEffect(() => {
    if (sessionId && isActive) {
      longPoll();
    }
  }, [longPoll, sessionId, isActive]);

  const start = useCallback(() => setIsActive(true), []);
  const stop = useCallback(() => setIsActive(false), []);

  return {
    data,
    connectionStatus,
    error,
    isActive,
    start,
    stop,
    clearData: () => setData([])
  };
}

// =====================================================
// Hook 4: Unified Hook with Fallback Strategy
// =====================================================

export function useOBD2LiveData(sessionId, options = {}) {
  const method = options.method || 'polling';
  const fallbackEnabled = options.fallback !== false;
  
  const sseResult = useOBD2SSE(sessionId, { 
    ...options,
    enabled: method === 'sse' || fallbackEnabled
  });
  
  const pollingResult = useOBD2Polling(sessionId, {
    ...options,
    enabled: method === 'polling' || (fallbackEnabled && sseResult.connectionStatus === 'error')
  });
  
  const longPollingResult = useOBD2LongPolling(sessionId, {
    ...options,
    enabled: method === 'long-polling'
  });

  // Choose active method based on strategy
  const activeResult = useMemo(() => {
    switch (method) {
      case 'sse':
        return fallbackEnabled && sseResult.connectionStatus === 'error' ? pollingResult : sseResult;
      case 'long-polling':
        return longPollingResult;
      case 'polling':
      default:
        return pollingResult;
    }
  }, [method, fallbackEnabled, sseResult, pollingResult, longPollingResult]);

  return {
    ...activeResult,
    activeMethod: method,
    allMethods: {
      sse: sseResult,
      polling: pollingResult,
      longPolling: longPollingResult
    }
  };
}

// =====================================================
// Hook 5: Historical Data Hook
// =====================================================

export function useOBD2HistoricalData(sessionId, options = {}) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const fetchData = useCallback(async (startTime, endTime, limit = 1000) => {
    if (!sessionId) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        startTime: startTime.toString(),
        limit: limit.toString()
      });
      
      if (endTime) {
        params.append('endTime', endTime.toString());
      }

      const response = await fetch(`/api/obd2/sessions/${sessionId}/range?${params}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      setData(result.data || []);
      
    } catch (err) {
      setError(err.message);
      console.error('❌ Failed to fetch historical data:', err);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  const fetchAggregated = useCallback(async (interval = 'minute', limit = 100) => {
    if (!sessionId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/obd2/sessions/${sessionId}/aggregated?interval=${interval}&limit=${limit}`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      setData(result.data || []);
      
    } catch (err) {
      setError(err.message);
      console.error('❌ Failed to fetch aggregated data:', err);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  return {
    data,
    loading,
    error,
    fetchData,
    fetchAggregated,
    clearData: () => setData([])
  };
}

// =====================================================
// Hook 6: Session Statistics Hook
// =====================================================

export function useOBD2SessionStats(sessionId, options = {}) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const refreshInterval = options.refreshInterval || 5000; // 5 seconds
  
  const fetchStats = useCallback(async () => {
    if (!sessionId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/obd2/sessions/${sessionId}/stats`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      setStats(result);
      
    } catch (err) {
      setError(err.message);
      console.error('❌ Failed to fetch session stats:', err);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (sessionId) {
      fetchStats();
      
      const interval = setInterval(fetchStats, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchStats, sessionId, refreshInterval]);

  return {
    stats,
    loading,
    error,
    refresh: fetchStats
  };
}