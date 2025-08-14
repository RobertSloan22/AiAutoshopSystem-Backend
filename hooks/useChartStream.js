import { useState, useEffect, useCallback, useRef } from 'react';

export const useChartStream = (apiBaseUrl = '/api') => {
  const [visualizations, setVisualizations] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [streamStatus, setStreamStatus] = useState('idle'); // 'idle', 'connecting', 'streaming', 'completed', 'error'
  const [currentMessage, setCurrentMessage] = useState('');
  const eventSourceRef = useRef(null);

  // Clean up event source on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  const startChartAnalysis = useCallback(async (question, vehicleContext = null, customerContext = null) => {
    try {
      setIsGenerating(true);
      setError(null);
      setVisualizations([]);
      setCurrentMessage('');
      setStreamStatus('connecting');

      // Close any existing connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      // Make the initial request to start streaming
      const response = await fetch(`${apiBaseUrl}/chat/analyze/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question,
          vehicleContext,
          customerContext,
          includeVisualization: true
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      setStreamStatus('streaming');

      // Create EventSource-like reader for the stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const processChunk = (chunk) => {
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        lines.forEach(line => {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              handleStreamEvent(data);
            } catch (e) {
              console.error('Error parsing SSE data:', e, line);
            }
          }
        });
      };

      const handleStreamEvent = (data) => {
        switch (data.type) {
          case 'session_started':
            console.log('Analysis session started:', data.sessionId);
            break;

          case 'content':
            setCurrentMessage(prev => prev + data.content);
            break;

          case 'tools_executing':
            console.log('Tools executing:', data.tools);
            break;

          case 'code_execution':
            console.log('Python code executed:', data.code);
            break;

          case 'visualization_ready':
            setVisualizations(prev => [...prev, ...data.visualizations]);
            break;

          case 'analysis_complete':
            setStreamStatus('completed');
            setIsGenerating(false);
            console.log('Analysis completed:', data.summary);
            break;

          case 'error':
            setError(data.error);
            setStreamStatus('error');
            setIsGenerating(false);
            break;

          default:
            console.log('Unknown stream event:', data);
        }
      };

      // Read the stream
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        processChunk(chunk);
      }

      if (streamStatus !== 'completed' && streamStatus !== 'error') {
        setStreamStatus('completed');
        setIsGenerating(false);
      }

    } catch (err) {
      console.error('Chart analysis error:', err);
      setError(err.message);
      setStreamStatus('error');
      setIsGenerating(false);
    }
  }, [apiBaseUrl, streamStatus]);

  const generateChartFromMessage = useCallback(async (message, vehicleContext = null, customerContext = null) => {
    return startChartAnalysis(message, vehicleContext, customerContext);
  }, [startChartAnalysis]);

  const clearCharts = useCallback(() => {
    setVisualizations([]);
    setCurrentMessage('');
    setError(null);
    setStreamStatus('idle');
    setIsGenerating(false);
  }, []);

  const stopGeneration = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsGenerating(false);
    setStreamStatus('idle');
  }, []);

  return {
    // State
    visualizations,
    isGenerating,
    error,
    streamStatus,
    currentMessage,
    
    // Actions
    generateChartFromMessage,
    startChartAnalysis,
    clearCharts,
    stopGeneration,
    
    // Status helpers
    hasCharts: visualizations.length > 0,
    isStreaming: streamStatus === 'streaming',
    isCompleted: streamStatus === 'completed',
    hasError: streamStatus === 'error' || !!error
  };
};