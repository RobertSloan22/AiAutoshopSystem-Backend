// AIAssistantWithPython.js - Enhanced AI Assistant with Python capabilities
import React, { useState, useRef, useEffect } from 'react';

const AIAssistantWithPython = () => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [vehicleContext, setVehicleContext] = useState({
    year: '',
    make: '',
    model: '',
    vin: ''
  });
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  // Python execution tool definition
  const pythonTool = {
    type: 'function',
    function: {
      name: 'execute_python_code',
      description: 'Execute Python code with access to data analysis libraries (pandas, numpy, matplotlib, seaborn). Can perform calculations, data analysis, and generate plots.',
      parameters: {
        type: 'object',
        properties: {
          code: {
            type: 'string',
            description: 'The Python code to execute. Can include imports, calculations, data analysis, and plot generation.'
          },
          save_plots: {
            type: 'boolean',
            description: 'Whether to save any generated plots as PNG files',
            default: true
          },
          plot_filename: {
            type: 'string',
            description: 'Optional filename for saved plots (without extension). If not provided, a unique name will be generated.'
          }
        },
        required: ['code']
      }
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || loading) return;

    const userMessage = {
      role: 'user',
      content: inputMessage,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setLoading(true);

    try {
      const response = await fetch('/api/turn_response', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: [
            ...messages,
            userMessage
          ].map(msg => ({
            role: msg.role,
            content: msg.content
          })),
          tools: [pythonTool],
          vehicleContext: vehicleContext
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Handle the response - could be streaming or direct
      let assistantMessage = {
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        toolCalls: [],
        plots: []
      };

      if (data.choices && data.choices[0]) {
        assistantMessage.content = data.choices[0].message.content || '';
        
        // Handle tool calls if present
        if (data.choices[0].message.tool_calls) {
          assistantMessage.toolCalls = data.choices[0].message.tool_calls;
          
          // Extract Python execution results and plots
          data.choices[0].message.tool_calls.forEach(toolCall => {
            if (toolCall.function.name === 'execute_python_code') {
              try {
                const result = JSON.parse(toolCall.function.result || '{}');
                if (result.plots) {
                  assistantMessage.plots = [...assistantMessage.plots, ...result.plots];
                }
              } catch (e) {
                console.error('Error parsing tool call result:', e);
              }
            }
          });
        }
      } else if (typeof data === 'string') {
        assistantMessage.content = data;
      } else {
        assistantMessage.content = JSON.stringify(data);
      }

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = {
        role: 'assistant',
        content: `I apologize, but I encountered an error: ${error.message}. Please try again.`,
        timestamp: new Date().toISOString(),
        isError: true
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const quickPrompts = [
    "Analyze the fuel efficiency of my vehicle using sample OBD2 data",
    "Create a diagnostic chart showing engine performance metrics",
    "Calculate the correlation between RPM and fuel consumption",
    "Generate a statistical analysis of engine temperature patterns",
    "Show me a visualization of vehicle speed vs engine load",
    "Perform a mathematical analysis of my DTC codes frequency"
  ];

  const renderMessage = (message, index) => {
    const isUser = message.role === 'user';
    const isError = message.isError;
    
    return (
      <div key={index} className={`message ${isUser ? 'user' : 'assistant'} ${isError ? 'error' : ''}`}>
        <div className="message-header">
          <strong>{isUser ? 'You' : 'AI Assistant'}</strong>
          <span className="timestamp">
            {new Date(message.timestamp).toLocaleTimeString()}
          </span>
        </div>
        
        <div className="message-content">
          <div className="text-content">
            {message.content}
          </div>
          
          {/* Show Python code if it was executed */}
          {message.toolCalls && message.toolCalls.length > 0 && (
            <div className="tool-calls">
              {message.toolCalls.map((toolCall, i) => {
                if (toolCall.function.name === 'execute_python_code') {
                  try {
                    const args = JSON.parse(toolCall.function.arguments || '{}');
                    return (
                      <div key={i} className="python-execution">
                        <h5>🐍 Python Code Executed:</h5>
                        <pre className="code-block">{args.code}</pre>
                      </div>
                    );
                  } catch (e) {
                    return null;
                  }
                }
                return null;
              })}
            </div>
          )}
          
          {/* Show generated plots */}
          {message.plots && message.plots.length > 0 && (
            <div className="plots-container">
              <h5>📊 Generated Visualizations:</h5>
              {message.plots.map((plot, i) => (
                <div key={i} className="plot-item">
                  <img 
                    src={plot.data} 
                    alt={`Generated plot ${i + 1}`}
                    className="plot-image"
                  />
                  <p className="plot-caption">Plot {i + 1}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="ai-assistant">
      {/* Vehicle Context Input */}
      <div className="vehicle-context">
        <h3>🚗 Vehicle Information</h3>
        <div className="context-inputs">
          <input
            type="text"
            placeholder="Year"
            value={vehicleContext.year}
            onChange={(e) => setVehicleContext(prev => ({...prev, year: e.target.value}))}
          />
          <input
            type="text"
            placeholder="Make"
            value={vehicleContext.make}
            onChange={(e) => setVehicleContext(prev => ({...prev, make: e.target.value}))}
          />
          <input
            type="text"
            placeholder="Model"
            value={vehicleContext.model}
            onChange={(e) => setVehicleContext(prev => ({...prev, model: e.target.value}))}
          />
          <input
            type="text"
            placeholder="VIN"
            value={vehicleContext.vin}
            onChange={(e) => setVehicleContext(prev => ({...prev, vin: e.target.value}))}
          />
        </div>
      </div>

      {/* Quick Prompts */}
      <div className="quick-prompts">
        <h4>💡 Quick Analysis Prompts:</h4>
        <div className="prompt-buttons">
          {quickPrompts.map((prompt, index) => (
            <button
              key={index}
              onClick={() => setInputMessage(prompt)}
              className="prompt-btn"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Messages */}
      <div className="messages-container">
        {messages.length === 0 && (
          <div className="welcome-message">
            <h4>🤖 AI Automotive Assistant with Python Analysis</h4>
            <p>I can help you with vehicle diagnostics and create data visualizations using Python. Try asking me to:</p>
            <ul>
              <li>Analyze OBD2 sensor data</li>
              <li>Create performance charts</li>
              <li>Calculate fuel efficiency metrics</li>
              <li>Generate statistical reports</li>
              <li>Visualize diagnostic patterns</li>
            </ul>
          </div>
        )}
        
        {messages.map(renderMessage)}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="input-container">
        <div className="input-area">
          <textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Ask me to analyze data, create visualizations, or perform calculations..."
            rows={3}
            disabled={loading}
          />
          <button 
            onClick={sendMessage} 
            disabled={loading || !inputMessage.trim()}
            className="send-btn"
          >
            {loading ? '🔄' : '📤'} {loading ? 'Processing...' : 'Send'}
          </button>
        </div>
      </div>

      <style jsx>{`
        .ai-assistant {
          max-width: 1000px;
          margin: 20px auto;
          padding: 20px;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          height: 80vh;
          display: flex;
          flex-direction: column;
        }

        .vehicle-context {
          background: #f8f9fa;
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 20px;
        }

        .context-inputs {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 10px;
          margin-top: 10px;
        }

        .context-inputs input {
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
        }

        .quick-prompts {
          background: #e3f2fd;
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 20px;
        }

        .prompt-buttons {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 10px;
        }

        .prompt-btn {
          padding: 8px 12px;
          background: #1976d2;
          color: white;
          border: none;
          border-radius: 20px;
          cursor: pointer;
          font-size: 12px;
          transition: background 0.2s;
        }

        .prompt-btn:hover {
          background: #1565c0;
        }

        .messages-container {
          flex: 1;
          overflow-y: auto;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 20px;
          background: white;
          margin-bottom: 20px;
        }

        .welcome-message {
          text-align: center;
          color: #666;
          padding: 40px 20px;
        }

        .welcome-message ul {
          text-align: left;
          max-width: 400px;
          margin: 20px auto;
        }

        .message {
          margin-bottom: 20px;
          padding: 15px;
          border-radius: 12px;
          max-width: 80%;
        }

        .message.user {
          background: #e3f2fd;
          margin-left: auto;
          border-bottom-right-radius: 4px;
        }

        .message.assistant {
          background: #f5f5f5;
          margin-right: auto;
          border-bottom-left-radius: 4px;
        }

        .message.error {
          background: #ffebee;
          border: 1px solid #ffcdd2;
        }

        .message-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          font-size: 12px;
        }

        .timestamp {
          color: #666;
        }

        .message-content {
          line-height: 1.5;
        }

        .tool-calls {
          margin-top: 15px;
          padding-top: 15px;
          border-top: 1px solid #e0e0e0;
        }

        .python-execution h5 {
          margin: 0 0 8px 0;
          color: #1976d2;
        }

        .code-block {
          background: #263238;
          color: #fff;
          padding: 12px;
          border-radius: 4px;
          font-family: 'Courier New', monospace;
          font-size: 12px;
          overflow-x: auto;
          white-space: pre-wrap;
        }

        .plots-container {
          margin-top: 15px;
          padding-top: 15px;
          border-top: 1px solid #e0e0e0;
        }

        .plots-container h5 {
          margin: 0 0 12px 0;
          color: #1976d2;
        }

        .plot-item {
          margin-bottom: 15px;
          text-align: center;
        }

        .plot-image {
          max-width: 100%;
          height: auto;
          border: 1px solid #ddd;
          border-radius: 4px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        .plot-caption {
          margin: 8px 0 0 0;
          font-size: 12px;
          color: #666;
        }

        .input-container {
          background: #f8f9fa;
          padding: 15px;
          border-radius: 8px;
        }

        .input-area {
          display: flex;
          gap: 12px;
          align-items: flex-end;
        }

        .input-area textarea {
          flex: 1;
          padding: 12px;
          border: 1px solid #ddd;
          border-radius: 8px;
          font-family: inherit;
          font-size: 14px;
          resize: vertical;
          min-height: 60px;
        }

        .send-btn {
          padding: 12px 20px;
          background: #4caf50;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: bold;
          white-space: nowrap;
          transition: background 0.2s;
        }

        .send-btn:hover:not(:disabled) {
          background: #45a049;
        }

        .send-btn:disabled {
          background: #cccccc;
          cursor: not-allowed;
        }

        h3, h4, h5 {
          margin-top: 0;
          color: #333;
        }
      `}</style>
    </div>
  );
};

export default AIAssistantWithPython;