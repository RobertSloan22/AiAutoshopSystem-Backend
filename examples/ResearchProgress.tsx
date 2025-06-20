import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';

// Define types for our progress tracking
interface ResearchProgress {
  [agentId: string]: {
    current: number;
    total: number;
    percentage: number;
  };
}

interface ResearchMessage {
  timestamp: string;
  message: string;
  agentId: string;
  status: 'starting' | 'in_progress' | 'complete' | 'error';
}

interface Question {
  id: string;
  question: string;
  category: string;
  completed?: boolean;
  findings?: string;
}

interface ResearchProgressProps {
  researchId: string;
  socketUrl?: string;
}

/**
 * ResearchProgress Component
 * 
 * This component connects to the Socket.IO server and displays real-time
 * progress of the multi-agent research system.
 */
const ResearchProgress: React.FC<ResearchProgressProps> = ({ 
  researchId,
  socketUrl = 'http://localhost:5000'
}) => {
  const [progress, setProgress] = useState<ResearchProgress>({});
  const [messages, setMessages] = useState<ResearchMessage[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [overallStatus, setOverallStatus] = useState<string>('pending');
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    // Connect to Socket.IO server
    const socket = io(socketUrl);
    
    // Listen for research agent status updates
    socket.on('research_agent_status', (data) => {
      if (data.sessionId === researchId) {
        console.log('Research status update:', data);
        
        // Update progress data for this agent
        if (data.progress) {
          setProgress(prev => ({
            ...prev,
            [data.agentId]: data.progress
          }));
        }
        
        // Update overall status
        if (data.status === 'complete' && data.agentId === 'main') {
          setOverallStatus('completed');
        } else if (data.status === 'error') {
          setOverallStatus('error');
          setError(data.message);
        } else if (data.status === 'starting') {
          setOverallStatus('in-progress');
        }
        
        // Add to message log
        setMessages(prev => [...prev, {
          timestamp: data.timestamp || new Date().toISOString(),
          message: data.message,
          agentId: data.agentId,
          status: data.status
        }]);
        
        // Update questions if available
        if (data.questions) {
          setQuestions(data.questions);
        }
        
        // Update completion status of questions
        if (data.agentId !== 'main' && data.agentId !== 'decomposer' && 
            data.message && data.message.startsWith('Completed:')) {
          const questionText = data.message.replace('Completed: ', '');
          setQuestions(prev => prev.map(q => 
            q.question === questionText ? { ...q, completed: true } : q
          ));
        }
      }
    });
    
    // Listen for research status updates (from routes)
    socket.on('research_status_update', (data) => {
      if (data.researchId === researchId) {
        console.log('Research status update from API:', data);
        
        setOverallStatus(data.status);
        
        if (data.status === 'failed' && data.error) {
          setError(data.error);
        }
        
        setMessages(prev => [...prev, {
          timestamp: data.timestamp || new Date().toISOString(),
          message: data.message,
          agentId: 'api',
          status: data.status === 'in-progress' ? 'in_progress' : 
                 data.status === 'completed' ? 'complete' : 
                 data.status === 'failed' ? 'error' : 'starting'
        }]);
      }
    });
    
    // Clean up on unmount
    return () => {
      socket.disconnect();
    };
  }, [researchId, socketUrl]);
  
  // Calculate overall progress percentage
  const calculateOverallProgress = () => {
    if (Object.keys(progress).length === 0) return 0;
    
    // Sum of all percentages divided by number of agents
    const sum = Object.values(progress).reduce((acc, curr) => acc + curr.percentage, 0);
    return Math.round(sum / Object.keys(progress).length);
  };
  
  return (
    <div className="research-progress">
      <h3>Research Progress</h3>
      
      {/* Overall progress */}
      <div className="overall-progress">
        <h4>Overall Progress: {overallStatus}</h4>
        <div className="progress-bar">
          <div 
            className="progress-bar-fill" 
            style={{ width: `${calculateOverallProgress()}%` }}
          />
          <span>{calculateOverallProgress()}%</span>
        </div>
        
        {error && (
          <div className="error-message">
            Error: {error}
          </div>
        )}
      </div>
      
      {/* Agent-specific progress */}
      <div className="agent-progress">
        <h4>Agent Progress</h4>
        {Object.entries(progress).map(([agentId, data]) => (
          <div key={agentId} className="agent-progress-item">
            <h5>{agentId}</h5>
            <div className="progress-bar">
              <div 
                className="progress-bar-fill" 
                style={{ width: `${data.percentage}%` }}
              />
              <span>{data.current}/{data.total} ({data.percentage}%)</span>
            </div>
          </div>
        ))}
      </div>
      
      {/* Research questions */}
      {questions.length > 0 && (
        <div className="research-questions">
          <h4>Research Questions</h4>
          <ul>
            {questions.map((question) => (
              <li key={question.id} className={question.completed ? 'completed' : ''}>
                <strong>{question.category}:</strong> {question.question}
                {question.completed && <span className="check">✓</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Activity log */}
      <div className="research-log">
        <h4>Activity Log</h4>
        {messages.map((msg, i) => (
          <div key={i} className={`log-entry log-${msg.status}`}>
            <time>{new Date(msg.timestamp).toLocaleTimeString()}</time>
            <span className="agent">{msg.agentId}</span>
            <span className="message">{msg.message}</span>
          </div>
        ))}
      </div>
      
      <style jsx>{`
        .research-progress {
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          font-family: system-ui, -apple-system, sans-serif;
        }
        
        h3, h4, h5 {
          margin-top: 0;
          margin-bottom: 10px;
        }
        
        .progress-bar {
          height: 20px;
          background-color: #f0f0f0;
          border-radius: 10px;
          margin-bottom: 15px;
          overflow: hidden;
          position: relative;
        }
        
        .progress-bar-fill {
          height: 100%;
          background-color: #4caf50;
          transition: width 0.3s ease;
        }
        
        .progress-bar span {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          color: #333;
          font-size: 12px;
          font-weight: bold;
        }
        
        .agent-progress-item {
          margin-bottom: 15px;
        }
        
        .research-questions ul {
          padding-left: 20px;
        }
        
        .research-questions li {
          margin-bottom: 8px;
          transition: opacity 0.3s ease;
        }
        
        .research-questions li.completed {
          opacity: 0.7;
        }
        
        .check {
          color: #4caf50;
          margin-left: 5px;
        }
        
        .research-log {
          margin-top: 20px;
          max-height: 300px;
          overflow-y: auto;
          border: 1px solid #eee;
          padding: 10px;
          border-radius: 5px;
        }
        
        .log-entry {
          padding: 5px;
          border-bottom: 1px solid #f0f0f0;
          font-size: 14px;
        }
        
        .log-entry time {
          color: #666;
          margin-right: 10px;
          font-size: 12px;
        }
        
        .log-entry .agent {
          background: #e0e0e0;
          padding: 2px 5px;
          border-radius: 3px;
          margin-right: 10px;
          font-size: 12px;
        }
        
        .log-entry.log-starting {
          background-color: #e3f2fd;
        }
        
        .log-entry.log-in_progress {
          background-color: #f1f8e9;
        }
        
        .log-entry.log-complete {
          background-color: #e8f5e9;
        }
        
        .log-entry.log-error {
          background-color: #ffebee;
        }
        
        .error-message {
          color: #d32f2f;
          background-color: #ffebee;
          padding: 10px;
          border-radius: 4px;
          margin-bottom: 15px;
        }
      `}</style>
    </div>
  );
};

export default ResearchProgress;