// usePythonExecution.js - React hook for Python code execution
import { useState, useCallback, useRef } from 'react';
import { pythonAPI } from '../utils/pythonAPI.js';

export const usePythonExecution = () => {
  const [isExecuting, setIsExecuting] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [executionHistory, setExecutionHistory] = useState([]);
  const abortControllerRef = useRef(null);

  const executeCode = useCallback(async (code, options = {}) => {
    if (!code.trim()) {
      setError('Code cannot be empty');
      return null;
    }

    setIsExecuting(true);
    setError(null);
    setResults(null);

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();

    const executionStart = Date.now();
    
    try {
      const result = await pythonAPI.executeCode(code, {
        ...options,
        signal: abortControllerRef.current.signal
      });

      const executionTime = Date.now() - executionStart;
      
      const executionRecord = {
        id: Date.now(),
        code,
        result,
        executionTime,
        timestamp: new Date().toISOString(),
        options
      };

      setResults(result);
      setExecutionHistory(prev => [executionRecord, ...prev.slice(0, 9)]); // Keep last 10
      
      return result;
    } catch (err) {
      if (err.name === 'AbortError') {
        setError('Execution was cancelled');
      } else {
        setError(err.message);
      }
      return null;
    } finally {
      setIsExecuting(false);
      abortControllerRef.current = null;
    }
  }, []);

  const cancelExecution = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  const clearResults = useCallback(() => {
    setResults(null);
    setError(null);
  }, []);

  const clearHistory = useCallback(() => {
    setExecutionHistory([]);
  }, []);

  const executeTemplate = useCallback(async (templateType, params = {}) => {
    const code = pythonAPI.generateCode(templateType, params);
    return await executeCode(code, { 
      plot_filename: templateType,
      ...params 
    });
  }, [executeCode]);

  return {
    // State
    isExecuting,
    results,
    error,
    executionHistory,
    
    // Actions
    executeCode,
    executeTemplate,
    cancelExecution,
    clearResults,
    clearHistory,
    
    // Helpers
    hasResults: !!results,
    hasError: !!error,
    hasPlots: !!(results?.plots_data?.length),
    canExecute: !isExecuting
  };
};

export const useAIAssistant = () => {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [context, setContext] = useState({
    vehicleContext: {
      year: '',
      make: '',
      model: '',
      vin: ''
    },
    customerContext: {}
  });

  const sendMessage = useCallback(async (message) => {
    if (!message.trim()) return;

    const userMessage = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      const response = await pythonAPI.sendToAssistant(
        [...messages, userMessage],
        context
      );

      let assistantMessage = {
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        toolCalls: [],
        plots: []
      };

      // Parse response
      if (response.choices && response.choices[0]) {
        const choice = response.choices[0];
        assistantMessage.content = choice.message.content || '';
        
        if (choice.message.tool_calls) {
          assistantMessage.toolCalls = choice.message.tool_calls;
          
          // Extract plots from Python executions
          choice.message.tool_calls.forEach(toolCall => {
            if (toolCall.function.name === 'execute_python_code') {
              try {
                const result = JSON.parse(toolCall.function.result || '{}');
                if (result.plots) {
                  assistantMessage.plots = [...assistantMessage.plots, ...result.plots];
                }
              } catch (e) {
                console.error('Error parsing tool result:', e);
              }
            }
          });
        }
      }

      setMessages(prev => [...prev, assistantMessage]);
      return assistantMessage;
    } catch (err) {
      setError(err.message);
      const errorMessage = {
        role: 'assistant',
        content: `I apologize, but I encountered an error: ${err.message}`,
        timestamp: new Date().toISOString(),
        isError: true
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, context]);

  const streamMessage = useCallback(async (message, onChunk) => {
    if (!message.trim()) return;

    const userMessage = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    let assistantMessage = {
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      toolCalls: [],
      plots: []
    };

    try {
      await pythonAPI.streamFromAssistant(
        [...messages, userMessage],
        context,
        (chunk) => {
          switch (chunk.type) {
            case 'content':
              assistantMessage.content += chunk.content;
              onChunk?.(assistantMessage);
              break;
            case 'tool_calls_started':
              assistantMessage.toolCalls = chunk.toolCalls || [];
              onChunk?.(assistantMessage);
              break;
            case 'tool_calls_completed':
              // Process tool results for plots
              if (chunk.results) {
                chunk.results.forEach(result => {
                  try {
                    const parsed = JSON.parse(result.content);
                    if (parsed.plots) {
                      assistantMessage.plots = [...assistantMessage.plots, ...parsed.plots];
                    }
                  } catch (e) {
                    // Ignore parsing errors
                  }
                });
              }
              onChunk?.(assistantMessage);
              break;
            case 'stream_complete':
              setMessages(prev => [...prev, assistantMessage]);
              onChunk?.(assistantMessage);
              break;
            case 'error':
              throw new Error(chunk.error);
          }
        }
      );
    } catch (err) {
      setError(err.message);
      const errorMessage = {
        role: 'assistant',
        content: `I apologize, but I encountered an error: ${err.message}`,
        timestamp: new Date().toISOString(),
        isError: true
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, context]);

  const updateContext = useCallback((newContext) => {
    setContext(prev => ({
      ...prev,
      ...newContext
    }));
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    // State
    messages,
    isLoading,
    error,
    context,
    
    // Actions
    sendMessage,
    streamMessage,
    updateContext,
    clearMessages,
    
    // Helpers
    hasMessages: messages.length > 0,
    lastMessage: messages[messages.length - 1],
    canSend: !isLoading
  };
};

export default usePythonExecution;