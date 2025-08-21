import React, { useState, useRef, useEffect } from 'react';
import ChartDisplay from './ChartDisplay';
import { useChartStream } from '../hooks/useChartStream';
import './ChatWithCharts.css';

const ChatWithCharts = ({ 
  vehicleContext = null, 
  customerContext = null,
  apiBaseUrl = '/api',
  onMessageSent = null,
  placeholder = "Ask me to generate a chart or analyze data..."
}) => {
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const inputRef = useRef(null);
  const chatContainerRef = useRef(null);

  const {
    visualizations,
    isGenerating,
    error,
    streamStatus,
    currentMessage,
    generateChartFromMessage,
    clearCharts,
    stopGeneration,
    hasCharts,
    isStreaming
  } = useChartStream(apiBaseUrl);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory, currentMessage, visualizations]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim() || isGenerating) return;

    const userMessage = message.trim();
    setMessage('');

    // Add user message to chat history
    setChatHistory(prev => [...prev, {
      id: Date.now(),
      type: 'user',
      content: userMessage,
      timestamp: new Date()
    }]);

    // Notify parent component
    if (onMessageSent) {
      onMessageSent(userMessage);
    }

    try {
      // Start chart generation
      await generateChartFromMessage(userMessage, vehicleContext, customerContext);
    } catch (error) {
      console.error('Error generating chart:', error);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const addAssistantMessage = (content, charts = []) => {
    setChatHistory(prev => [...prev, {
      id: Date.now(),
      type: 'assistant',
      content: content,
      charts: charts,
      timestamp: new Date()
    }]);
  };

  // Add assistant message when streaming completes
  useEffect(() => {
    if (streamStatus === 'completed' && currentMessage) {
      addAssistantMessage(currentMessage, visualizations);
    }
  }, [streamStatus, currentMessage, visualizations]);

  const renderMessage = (msg) => {
    return (
      <div key={msg.id} className={`message ${msg.type}`}>
        <div className="message-header">
          <span className="message-sender">
            {msg.type === 'user' ? 'You' : 'AI Assistant'}
          </span>
          <span className="message-time">
            {msg.timestamp.toLocaleTimeString()}
          </span>
        </div>
        
        <div className="message-content">
          {msg.content}
        </div>
        
        {msg.charts && msg.charts.length > 0 && (
          <ChartDisplay 
            visualizations={msg.charts}
            isLoading={false}
            error={null}
          />
        )}
      </div>
    );
  };

  return (
    <div className="chat-with-charts">
      <div className="chat-header">
        <h3>AI Chart Assistant</h3>
        <div className="chat-controls">
          {isGenerating && (
            <button 
              onClick={stopGeneration}
              className="stop-btn"
              title="Stop generation"
            >
              ⏹️ Stop
            </button>
          )}
          {(hasCharts || chatHistory.length > 0) && (
            <button 
              onClick={() => {
                clearCharts();
                setChatHistory([]);
              }}
              className="clear-btn"
              title="Clear chat"
            >
              🗑️ Clear
            </button>
          )}
        </div>
      </div>

      <div 
        ref={chatContainerRef}
        className="chat-container"
      >
        {chatHistory.map(renderMessage)}
        
        {/* Show current streaming message */}
        {isStreaming && currentMessage && (
          <div className="message assistant streaming">
            <div className="message-header">
              <span className="message-sender">AI Assistant</span>
              <span className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </span>
            </div>
            <div className="message-content">
              {currentMessage}
            </div>
          </div>
        )}
        
        {/* Show charts while streaming */}
        {isStreaming && visualizations.length > 0 && (
          <div className="streaming-charts">
            <ChartDisplay 
              visualizations={visualizations}
              isLoading={false}
              error={null}
            />
          </div>
        )}
        
        {/* Show loading state */}
        {isGenerating && !currentMessage && visualizations.length === 0 && (
          <div className="message assistant">
            <div className="message-header">
              <span className="message-sender">AI Assistant</span>
              <span className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </span>
            </div>
            <div className="message-content">
              <div className="loading-text">
                {streamStatus === 'connecting' ? 'Connecting...' : 'Analyzing and generating charts...'}
              </div>
            </div>
          </div>
        )}
        
        {/* Show error */}
        {error && (
          <div className="message error">
            <div className="message-header">
              <span className="message-sender">Error</span>
            </div>
            <div className="message-content">
              ⚠️ {error}
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="chat-input-form">
        <div className="input-container">
          <textarea
            ref={inputRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            className="chat-input"
            rows="1"
            disabled={isGenerating}
          />
          <button 
            type="submit" 
            disabled={!message.trim() || isGenerating}
            className="send-btn"
          >
            {isGenerating ? (
              <span className="loading-spinner small"></span>
            ) : (
              '📊 Generate'
            )}
          </button>
        </div>
        
        {vehicleContext && (
          <div className="context-info">
            🚗 Vehicle: {vehicleContext.make} {vehicleContext.model} {vehicleContext.year}
          </div>
        )}
      </form>
    </div>
  );
};

export default ChatWithCharts;