import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';
import { Separator } from './ui/separator';
import { Search, Send, X, Plug, PlugZap, Loader2, Clock, User, Database } from 'lucide-react';
import { cn } from '../lib/utils';
import ResearchResults from '../pages/dashboard/pythoncomponent/ResearchResults';
import { useResearchAgent, ResearchAgentState } from '../hooks/useResearchAgent';
// WebSocketStatusIndicator component integrated below
import { ErrorBoundary } from 'react-error-boundary';
import ConnectionErrorFallback from './ConnectionErrorFallback';
import { getResearchAgentUrl } from '../utils/apiConfig';
import '../app/src/app/components/layout/TopBarStyles.css';
import { useTranscript } from '../app/src/app/contexts/TranscriptContext';

// API service functions for research results
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const researchResultsAPI = {
  // Get all research results with pagination and filtering
  getAll: async (params = {}) => {
    const queryString = new URLSearchParams({
      page: 1,
      limit: 10,
      format: 'full',
      ...params
    }).toString();
    
    const response = await fetch(`${API_BASE_URL}/api/research-results?${queryString}`);
    if (!response.ok) throw new Error('Failed to fetch research results');
    return response.json();
  },
  
  // Get specific research result by ID
  getById: async (id) => {
    const response = await fetch(`${API_BASE_URL}/api/research-results/${id}`);
    if (!response.ok) throw new Error('Failed to fetch research result');
    return response.json();
  },
  
  // Get results by client ID
  getByClient: async (clientId, params = {}) => {
    const queryString = new URLSearchParams({
      page: 1,
      limit: 10,
      ...params
    }).toString();
    
    const response = await fetch(`${API_BASE_URL}/api/research-results/client/${clientId}?${queryString}`);
    if (!response.ok) throw new Error('Failed to fetch client research results');
    return response.json();
  },
  
  // Get recent research results
  getRecent: async (count = 5) => {
    const response = await fetch(`${API_BASE_URL}/api/research-results/recent/${count}`);
    if (!response.ok) throw new Error('Failed to fetch recent research results');
    return response.json();
  },
  
  // Search research results
  search: async (query, params = {}) => {
    const queryString = new URLSearchParams({
      page: 1,
      limit: 10,
      ...params
    }).toString();
    
    const response = await fetch(`${API_BASE_URL}/api/research-results/search/${encodeURIComponent(query)}?${queryString}`);
    if (!response.ok) throw new Error('Failed to search research results');
    return response.json();
  },
  
  // Get research statistics
  getStats: async () => {
    const response = await fetch(`${API_BASE_URL}/api/research-results/stats`);
    if (!response.ok) throw new Error('Failed to fetch research statistics');
    return response.json();
  }
};

// Connection status badge component
export const ConnectionStatusBadge: React.FC<{
  isConnected: boolean;
  error?: string | null;
}> = ({ isConnected, error }) => {
  return (
    <span className={cn(
      "inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-200",
      "font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      isConnected 
        ? "bg-slate-900 text-emerald-300 border-emerald-500/30 shadow-sm shadow-emerald-500/20" 
        : "bg-slate-900 text-red-300 border-red-500/30 shadow-sm shadow-red-500/20"
    )}>
      <div className={cn(
        "w-2 h-2 rounded-full mr-2 transition-all duration-200",
        isConnected ? "bg-emerald-400 shadow-sm shadow-emerald-400/50" : "bg-red-400 shadow-sm shadow-red-400/50"
      )} />
      {isConnected ? "Connected" : "Disconnected"}
      {!isConnected && error && <span className="ml-1 text-xs opacity-75">({error})</span>}
    </span>
  );
};

// Connection status alert component
export const ConnectionAlert: React.FC<{
  error: string | null;
  onReconnect: () => void;
}> = ({ error, onReconnect }) => {
  if (!error) return null;
  
  return (
    <div className="p-4 bg-gradient-to-r from-red-900/90 to-red-800/90 border border-red-700/50 rounded-lg text-white flex justify-between items-center backdrop-blur-sm shadow-lg">
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
        <span className="font-medium text-sm">{error || "Server connection lost. Please check if your Agent is running."}</span>
      </div>
      <button
        onClick={onReconnect}
        className="modern-btn danger compact"
        style={{
          fontSize: '0.75rem',
          padding: '6px 12px',
          minWidth: 'auto',
          height: 'auto'
        }}
      >
        Reconnect
      </button>
    </div>
  );
};

// Research agent connect button component - can be used independently
export const ResearchAgentConnectButton: React.FC<{
  isConnected: boolean;
  isConnecting: boolean;
  onClick: () => void;
  compact?: boolean;
}> = ({ isConnected, isConnecting, onClick, compact = false }) => {
  return (
    <button
      onClick={onClick}
      disabled={isConnecting}
      className={cn(
        "modern-btn transition-all duration-200",
        isConnected ? "success" : "primary",
        isConnecting && "disabled",
        "hover:scale-105 active:scale-95"
      )}
      style={{
        fontSize: compact ? '0.75rem' : '0.875rem',
        padding: compact ? '8px 12px' : '12px 20px',
        minWidth: 'auto',
        height: 'auto',
        gap: '8px',
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        fontWeight: '600',
        boxShadow: isConnected 
          ? '0 4px 12px rgba(16, 185, 129, 0.25)' 
          : '0 4px 12px rgba(59, 130, 246, 0.25)',
      }}
    >
      {isConnecting ? (
        <>
          <div className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full"></div>
          {!compact && <span>Connecting...</span>}
        </>
      ) : isConnected ? (
        <>
          <PlugZap className="h-4 w-4 text-emerald-300" />
          <span>{!compact ? "Research Agent Connected" : "Connected"}</span>
        </>
      ) : (
        <>
          <Plug className="h-4 w-4 text-blue-300" />
          <span>{!compact ? "Connect to Research Agent" : "Connect"}</span>
        </>
      )}
    </button>
  );
};

// Message component for displaying individual messages
export const ResearchMessage: React.FC<{
  type: string;
  content?: string;
  message?: string;
  result?: any;
  showAddToTranscript?: boolean;
  onAddToTranscript?: (messageId: string, role: "user" | "assistant", text: string, options: any) => void;
}> = ({ type, content, message, result, showAddToTranscript = false, onAddToTranscript }) => {
  
  const handleAddToTranscript = () => {
    if (!onAddToTranscript) return;
    
    const messageId = `fastmcp-manual-${type}-${Date.now()}`;
    let text = "";
    let options: any = {
      source: "research",
      contentType: type
    };

    switch (type) {
      case 'error':
        text = `❌ Error: ${message}`;
        options.contentType = "error";
        break;
      case 'tool_result':
        text = "🔧 Tool Result";
        options.contentType = "tool-result";
        options.data = result;
        break;
      case 'response':
        text = content || "";
        options.contentType = "research-response";
        break;
      case 'chat':
        text = content || "";
        options.contentType = "text";
        break;
      case 'connection_ready':
        text = `✅ ${message}`;
        options.contentType = "connection-status";
        break;
    }

    onAddToTranscript(messageId, "assistant", text, options);
  };

  const getMessageIcon = () => {
    switch (type) {
      case 'error': return '🚨';
      case 'tool_result': return '🔧';
      case 'response': return '🤖';
      case 'chat': return '💬';
      case 'connection_ready': return '✅';
      default: return '📝';
    }
  };

  const getMessageStyles = () => {
    switch (type) {
      case 'error':
        return {
          container: "bg-slate-900/90 border-l-4 border-red-500 shadow-lg shadow-red-500/10",
          text: "text-red-200",
          accent: "text-red-400"
        };
      case 'tool_result':
        return {
          container: "bg-slate-900/90 border-l-4 border-blue-500 shadow-lg shadow-blue-500/10",
          text: "text-blue-200",
          accent: "text-blue-400"
        };
      case 'response':
        return {
          container: "bg-slate-900/90 border-l-4 border-emerald-500 shadow-lg shadow-emerald-500/10",
          text: "text-emerald-200",
          accent: "text-emerald-400"
        };
      case 'chat':
        return {
          container: "bg-slate-900/90 border-l-4 border-slate-500 shadow-lg shadow-slate-500/10",
          text: "text-slate-200",
          accent: "text-slate-400"
        };
      case 'connection_ready':
        return {
          container: "bg-slate-900/90 border-l-4 border-emerald-500 shadow-lg shadow-emerald-500/10",
          text: "text-emerald-200",
          accent: "text-emerald-400"
        };
      default:
        return {
          container: "bg-slate-900/90 border-l-4 border-slate-500 shadow-lg shadow-slate-500/10",
          text: "text-slate-200",
          accent: "text-slate-400"
        };
    }
  };

  const styles = getMessageStyles();

  return (
    <div
      className={cn(
        "p-4 rounded-lg relative group transition-all duration-200 hover:scale-[1.02] backdrop-blur-sm",
        "border border-slate-700/50",
        styles.container
      )}
    >
      {showAddToTranscript && (
        <button
          onClick={handleAddToTranscript}
          className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-200 bg-blue-600/90 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded-md font-medium shadow-lg hover:scale-105 active:scale-95"
          title="Add to Transcript"
        >
          + Transcript
        </button>
      )}
      
      <div className="flex items-start gap-3">
        <span className="text-lg flex-shrink-0 mt-0.5">{getMessageIcon()}</span>
        <div className="flex-1 min-w-0">
          {type === 'error' && (
            <p className={cn("font-medium leading-relaxed", styles.text)} style={{ fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
              {message}
            </p>
          )}
          {type === 'tool_result' && (
            <div className="space-y-2">
              <h4 className={cn("text-sm font-semibold", styles.accent)}>Tool Result:</h4>
              <pre className={cn("text-sm whitespace-pre-wrap font-mono p-3 bg-slate-800/50 rounded-md border border-slate-600/30 overflow-x-auto", styles.text)}>
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
          {type === 'response' && (
            <p className={cn("font-medium leading-relaxed", styles.text)} style={{ fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
              {content}
            </p>
          )}
          {type === 'chat' && (
            <p className={cn("font-medium leading-relaxed", styles.text)} style={{ fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
              {content}
            </p>
          )}
          {type === 'connection_ready' && (
            <p className={cn("font-medium leading-relaxed", styles.text)} style={{ fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
              {message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// Message list component
export const ResearchMessageList: React.FC<{
  messages: ResearchAgentState['messages'];
  showTranscriptButtons?: boolean;
  onAddToTranscript?: (messageId: string, role: "user" | "assistant", text: string, options: any) => void;
}> = ({ messages, showTranscriptButtons = false, onAddToTranscript }) => {
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
      {messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-center py-16">
          <div className="relative mb-8">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600/20 to-blue-700/20 flex items-center justify-center border border-blue-500/30 shadow-lg shadow-blue-500/10">
              <Search className="h-10 w-10 text-blue-400" />
            </div>
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-slate-700 rounded-full flex items-center justify-center border-2 border-slate-600">
              <div className="w-2 h-2 bg-slate-500 rounded-full" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-slate-200 mb-3" style={{ fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
            Ready for Research
          </h3>
          <p className="text-slate-400 max-w-lg mb-8 leading-relaxed" style={{ fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
            Connect to the Research Agent to unlock powerful AI-driven research capabilities. Ask questions, conduct deep analysis, and get comprehensive insights.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl w-full">
            <div className="bg-slate-800/30 border border-slate-700/30 rounded-lg p-4 text-left">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center">
                  <Search className="h-4 w-4 text-emerald-400" />
                </div>
                <h4 className="font-semibold text-slate-300">Research Topics</h4>
              </div>
              <p className="text-sm text-slate-400">Dive deep into any subject with comprehensive analysis and multiple sources</p>
            </div>
            <div className="bg-slate-800/30 border border-slate-700/30 rounded-lg p-4 text-left">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                  <Send className="h-4 w-4 text-blue-400" />
                </div>
                <h4 className="font-semibold text-slate-300">Ask Questions</h4>
              </div>
              <p className="text-sm text-slate-400">Get detailed answers and explanations from advanced AI research tools</p>
            </div>
          </div>
        </div>
      ) : (
        messages.map((msg, index) => (
          <ResearchMessage 
            key={index}
            type={msg.type}
            content={msg.content}
            message={msg.message}
            result={msg.result}
            showAddToTranscript={showTranscriptButtons}
            onAddToTranscript={onAddToTranscript}
          />
        ))
      )}

    </div>
  );
};

// Research input component
export const ResearchInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onResearch: () => void;
  disabled?: boolean;
}> = ({ value, onChange, onSend, onResearch, disabled = false }) => {
  return (
    <div className="p-6 bg-gradient-to-r from-slate-900/60 to-slate-900/40 border-t border-slate-700/50 backdrop-blur-sm">
      <div className="flex gap-3 items-end">
        <div className="flex-1 relative">
          <div className="relative">
            <Input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onSend();
                }
              }}
              placeholder="Ask a question or enter a research topic..."
              className={cn(
                "bg-slate-800/90 border-slate-600/50 text-slate-100 placeholder-slate-400",
                "focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/25 focus:bg-slate-800",
                "transition-all duration-200 h-14 px-4 pr-12 text-sm font-medium rounded-xl",
                "hover:border-slate-500/60 hover:bg-slate-800/95",
                "shadow-lg shadow-black/20",
                disabled && "opacity-50 cursor-not-allowed"
              )}
              style={{ fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}
              disabled={disabled}
            />
            {value.trim() && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onSend}
            disabled={disabled || !value.trim()}
            className={cn(
              "modern-btn primary transition-all duration-200",
              "hover:scale-105 active:scale-95 hover:shadow-lg",
              "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100",
              "hidden sm:flex" // Hide on mobile, show on small screens and up
            )}
            style={{
              padding: '12px 20px',
              fontSize: '0.875rem',
              fontWeight: '600',
              minWidth: 'auto',
              height: '56px',
              gap: '8px',
              fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
              boxShadow: !disabled && value.trim() ? '0 6px 20px rgba(59, 130, 246, 0.3)' : '0 2px 8px rgba(0, 0, 0, 0.2)',
              borderRadius: '12px'
            }}
          >
            <Send className="h-4 w-4" />
            <span>Send</span>
          </button>
          <button
            onClick={onResearch}
            disabled={disabled || !value.trim()}
            className={cn(
              "modern-btn success transition-all duration-200",
              "hover:scale-105 active:scale-95 hover:shadow-lg",
              "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
            )}
            style={{
              padding: '12px 20px',
              fontSize: '0.875rem',
              fontWeight: '600',
              minWidth: 'auto',
              height: '56px',
              gap: '8px',
              fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
              boxShadow: !disabled && value.trim() ? '0 6px 20px rgba(16, 185, 129, 0.3)' : '0 2px 8px rgba(0, 0, 0, 0.2)',
              borderRadius: '12px'
            }}
          >
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">Research</span>
          </button>
          {/* Mobile Send Button */}
          <button
            onClick={onSend}
            disabled={disabled || !value.trim()}
            className={cn(
              "modern-btn primary transition-all duration-200",
              "hover:scale-105 active:scale-95 hover:shadow-lg",
              "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100",
              "sm:hidden flex" // Show only on mobile
            )}
            style={{
              padding: '12px',
              fontSize: '0.875rem',
              fontWeight: '600',
              minWidth: '56px',
              height: '56px',
              gap: '8px',
              fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
              boxShadow: !disabled && value.trim() ? '0 6px 20px rgba(59, 130, 246, 0.3)' : '0 2px 8px rgba(0, 0, 0, 0.2)',
              borderRadius: '12px'
            }}
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

// MongoDB Research Results Display Component
export const MongoResearchResultsDisplay: React.FC<{
  results: any[];
  loading: boolean;
  error?: string | null;
}> = ({ results, loading, error }) => {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
        <p className="text-slate-400">Loading research results...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-4 text-red-200">
        <p className="font-medium">Error loading results:</p>
        <p className="text-sm opacity-75">{error}</p>
      </div>
    );
  }
  
  if (!results.length) {
    return (
      <div className="text-center py-8">
        <Database className="h-12 w-12 text-slate-600 mx-auto mb-4" />
        <p className="text-slate-400">No research results found</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {results.map((result, index) => (
        <div key={result.id || index} className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h3 className="font-medium text-slate-200 mb-1">{result.query}</h3>
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(result.createdAt).toLocaleDateString()}
                </div>
                {result.status && (
                  <span className={cn(
                    "px-2 py-1 rounded text-xs font-medium",
                    result.status === 'completed' ? "bg-green-900/30 text-green-300" :
                    result.status === 'failed' ? "bg-red-900/30 text-red-300" :
                    "bg-yellow-900/30 text-yellow-300"
                  )}>
                    {result.status}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          {result.summary && (
            <div className="mb-3 p-3 bg-slate-900/50 rounded border border-slate-600/30">
              <p className="text-sm text-slate-300">{result.summary}</p>
            </div>
          )}
          
          {result.fullMarkdown && (
            <div className="mt-3">
              <ResearchResults 
                results={{
                  message: result.fullMarkdown,
                  files: []
                }}
              />
            </div>
          )}
          
          {result.followUpQuestions && result.followUpQuestions.length > 0 && (
            <div className="mt-3 p-3 bg-blue-900/20 border border-blue-700/30 rounded">
              <h4 className="text-sm font-medium text-blue-300 mb-2">Follow-up Questions:</h4>
              <ul className="text-sm text-slate-300 space-y-1">
                {result.followUpQuestions.map((question, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5">•</span>
                    {question}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// Research Results Panel component
export const ResearchResultsPanel: React.FC<{
  show: boolean;
  results: string | null;
  onClose: () => void;
  onAddToTranscript?: (messageId: string, role: "user" | "assistant", text: string, options: any) => void;
}> = ({ show, results, onClose, onAddToTranscript }) => {
  const [mongoResults, setMongoResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statsData, setStatsData] = useState<any>(null);
  
  // Fetch recent research results on component mount
  useEffect(() => {
    if (show) {
      fetchRecentResults();
      fetchStats();
    }
  }, [show]);
  
  const fetchRecentResults = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await researchResultsAPI.getRecent(10);
      if (response.success) {
        setMongoResults(response.data);
      } else {
        setError('Failed to load research results');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load research results');
    } finally {
      setLoading(false);
    }
  };
  
  const fetchStats = async () => {
    try {
      const response = await researchResultsAPI.getStats();
      if (response.success) {
        setStatsData(response.data);
      }
    } catch (err) {
      console.warn('Failed to load stats:', err);
    }
  };
  
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      fetchRecentResults();
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      const response = await researchResultsAPI.search(searchQuery);
      if (response.success) {
        setMongoResults(response.data);
      } else {
        setError('Search failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  if (!show) return null;
  
  const handleAddResultsToTranscript = () => {
    if (!onAddToTranscript || (!results && !mongoResults.length)) return;
    
    const resultMessageId = `fastmcp-results-panel-${Date.now()}`;
    onAddToTranscript(resultMessageId, "assistant", "📊 Research Results", {
      source: "research-data",
      contentType: "research-data",
      data: {
        results: results,
        mongoResults: mongoResults,
        isProcessing: false,
        timestamp: new Date().toISOString()
      }
    });
    
    // Show confirmation
    console.log("Research results added to transcript");
  };
  
  return (
    <div className="flex-1 flex flex-col bg-slate-900/95 backdrop-blur-sm rounded-lg shadow-2xl border border-slate-700/50 overflow-hidden ml-6">
      <Card className="flex flex-col h-full w-full bg-transparent border-none">
        <div className="p-6 bg-slate-800/80 border-b border-slate-700/50 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center">
              <Search className="h-4 w-4 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-100" style={{ fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
              Research Results
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {onAddToTranscript && (
              <button
                onClick={handleAddResultsToTranscript}
                className="modern-btn primary compact transition-all duration-200 hover:scale-105 active:scale-95"
                style={{
                  fontSize: '0.75rem',
                  padding: '6px 12px',
                  minWidth: 'auto',
                  height: 'auto',
                  gap: '6px',
                  fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
                  fontWeight: '600'
                }}
                title="Add results to transcript"
              >
                + Transcript
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded-lg transition-all duration-200 hover:scale-110 active:scale-95"
              title="Close results panel"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        
        {/* Search Bar */}
        <div className="p-4 bg-slate-800/50 border-b border-slate-700/30">
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search research results..."
              className="flex-1 bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-400"
            />
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-blue-600/80 hover:bg-blue-600 text-white rounded-lg text-sm transition-colors"
            >
              <Search className="h-4 w-4" />
            </button>
            <button
              onClick={fetchRecentResults}
              className="px-3 py-2 bg-slate-600/80 hover:bg-slate-600 text-slate-200 rounded-lg text-sm transition-colors"
              title="Refresh"
            >
              <Database className="h-4 w-4" />
            </button>
          </div>
        </div>
        
        {/* Statistics */}
        {statsData && (
          <div className="p-4 bg-slate-800/30 border-b border-slate-700/30">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div className="text-center">
                <div className="text-lg font-bold text-slate-200">{statsData.total || 0}</div>
                <div className="text-slate-400">Total Results</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-slate-200">{statsData.last24Hours || 0}</div>
                <div className="text-slate-400">Last 24h</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-slate-200">{statsData.topTags?.length || 0}</div>
                <div className="text-slate-400">Active Tags</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-slate-200">{statsData.topUsers?.length || 0}</div>
                <div className="text-slate-400">Active Users</div>
              </div>
            </div>
          </div>
        )}
        
        <div className="flex-1 overflow-auto p-6 custom-scrollbar">
          {/* Current Research Results (if any) */}
          {results && (
            <div className="mb-6">
              <h3 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2">
                <PlugZap className="h-5 w-5 text-emerald-400" />
                Current Research
              </h3>
              <div className="bg-gradient-to-r from-slate-800/50 to-slate-800/30 rounded-lg border border-slate-700/50 p-6 shadow-lg">
                <div className="bg-slate-800/30 rounded-lg border border-slate-700/30 p-4">
                  <ResearchResults 
                    results={{
                      message: results || "",
                      files: []
                    }}
                  />
                </div>
              </div>
            </div>
          )}
          
          {/* MongoDB Research Results */}
          <div>
            <h3 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2">
              <Database className="h-5 w-5 text-blue-400" />
              Saved Research Results
            </h3>
            <MongoResearchResultsDisplay 
              results={mongoResults}
              loading={loading}
              error={error}
            />
          </div>
        </div>
      </Card>
    </div>
  );
};

// Complete Research Interface - combines all components
export const ResearchAgentInterface: React.FC<{
  customHeader?: React.ReactNode;
  customControls?: React.ReactNode;
  showResults?: boolean;  // Control results panel visibility from parent
  onResultsClose?: () => void;  // Allow parent to handle results closing
}> = ({ 
  customHeader,
  customControls,
  showResults: externalShowResults,
  onResultsClose
}) => {
  const [
    { messages, isConnected, connectionError, researchResult, showResults: internalShowResults, isConnecting },
    { sendChatMessage, startResearch, reconnect, closeResults, setResearchQuery }
  ] = useResearchAgent({ standalone: true });

  const [inputValue, setInputValue] = React.useState('');
  const { addTranscriptMessage } = useTranscript();
  
  // Determine if we should use external or internal control for results panel
  const effectiveShowResults = typeof externalShowResults !== 'undefined' ? externalShowResults : internalShowResults;
  const handleCloseResults = () => {
    if (onResultsClose) {
      onResultsClose();
    } else {
      closeResults();
    }
  };
  
  const handleSendMessage = () => {
    if (inputValue.trim()) {
      // Add user message to transcript
      const userMessageId = `fastmcp-user-${Date.now()}`;
      addTranscriptMessage(userMessageId, "user", inputValue, {
        source: "research",
        contentType: "text"
      });

      sendChatMessage(inputValue);
      setInputValue('');
    }
  };
  
  const handleStartResearch = () => {
    if (inputValue.trim()) {
      // Add research query to transcript
      const queryMessageId = `fastmcp-research-${Date.now()}`;
      addTranscriptMessage(queryMessageId, "user", `🔍 Research Query: ${inputValue}`, {
        source: "research",
        contentType: "research-query"
      });

      // Add research progress message
      const progressMessageId = `fastmcp-progress-${Date.now()}`;
      addTranscriptMessage(progressMessageId, "assistant", "Research in Progress - Collecting data", {
        source: "research",
        contentType: "research-progress",
        data: {
          status: "processing",
          progress: 0
        }
      });

      setResearchQuery(inputValue);
      startResearch(inputValue);
      setInputValue('');
    }
  };

  // Track the last processed message count to avoid re-processing old messages
  const [lastProcessedMessageCount, setLastProcessedMessageCount] = React.useState(0);

  // Effect to monitor research messages and add them to transcript
  React.useEffect(() => {
    if (messages.length > lastProcessedMessageCount) {
      // Process only new messages
      const newMessages = messages.slice(lastProcessedMessageCount);
      
      newMessages.forEach((message) => {
        // Add various message types to transcript
        if (message.type === 'response' && message.content) {
          const responseMessageId = `fastmcp-response-${Date.now()}-${Math.random()}`;
          addTranscriptMessage(responseMessageId, "assistant", message.content, {
            source: "research",
            contentType: "research-response"
          });
        } else if (message.type === 'tool_result' && message.result) {
          const resultMessageId = `fastmcp-tool-result-${Date.now()}-${Math.random()}`;
          addTranscriptMessage(resultMessageId, "assistant", "🔧 Tool Result", {
            source: "research",
            contentType: "tool-result",
            data: message.result
          });
        } else if (message.type === 'error' && message.message) {
          const errorMessageId = `fastmcp-error-${Date.now()}-${Math.random()}`;
          addTranscriptMessage(errorMessageId, "assistant", `❌ Error: ${message.message}`, {
            source: "research",
            contentType: "error"
          });
        } else if (message.type === 'connection_ready' && message.message) {
          const connectionMessageId = `fastmcp-connection-${Date.now()}-${Math.random()}`;
          addTranscriptMessage(connectionMessageId, "assistant", `✅ ${message.message}`, {
            source: "research",
            contentType: "connection-status"
          });
        }
      });

      setLastProcessedMessageCount(messages.length);
    }
  }, [messages, addTranscriptMessage, lastProcessedMessageCount]);

  // Effect to monitor research results and add them to transcript
  React.useEffect(() => {
    if (researchResult) {
      const resultMessageId = `fastmcp-research-result-${Date.now()}`;
      addTranscriptMessage(resultMessageId, "assistant", "📊 Research Results Available", {
        source: "research",
        contentType: "research-complete",
        data: {
          results: researchResult
        }
      });

      // Also add the detailed results as a separate message
      const detailedResultId = `fastmcp-detailed-result-${Date.now()}`;
      addTranscriptMessage(detailedResultId, "assistant", researchResult, {
        source: "research-data",
        contentType: "research-data",
        data: {
          isProcessing: false,
          results: researchResult
        }
      });
    }
  }, [researchResult, addTranscriptMessage]);

  // Effect to monitor connection status changes
  React.useEffect(() => {
    if (connectionError) {
      const errorMessageId = `fastmcp-connection-error-${Date.now()}`;
      addTranscriptMessage(errorMessageId, "assistant", `🔌 Connection Error: ${connectionError}`, {
        source: "research",
        contentType: "connection-status"
      });
    } else if (isConnected) {
      const connectedMessageId = `fastmcp-connected-${Date.now()}`;
      addTranscriptMessage(connectedMessageId, "assistant", "🔌 Research Agent connected and ready", {
        source: "research",
        contentType: "connection-status"
      });
    }
  }, [isConnected, connectionError, addTranscriptMessage]);

  return (
    <ErrorBoundary 
      FallbackComponent={props => (
        <ConnectionErrorFallback {...props} wsUrl={getResearchAgentUrl()} />
      )}
      onReset={() => reconnect()}
    >
      <div className="flex h-full w-[100vq] gap-4">
        <div className="flex-1 flex flex-col bg-slate-900/90 backdrop-blur-sm border border-slate-700/50 rounded-xl shadow-2xl overflow-hidden">
          <Card className="flex flex-col h-full border-none bg-transparent">
            {customHeader || (
              <div className="p-6 bg-slate-800/90 border-b border-slate-700/50 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-lg">
                    <Search className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-100" style={{ fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
                      FastMCP Agent
                    </h2>
                    <p className="text-sm text-slate-400 mt-0.5">Research & Analysis Interface</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <ConnectionStatusBadge 
                    isConnected={isConnected}
                    error={connectionError}
                  />
                  {customControls || (
                    <ResearchAgentConnectButton 
                      isConnected={isConnected}
                      isConnecting={isConnecting}
                      onClick={reconnect}
                      compact
                    />
                  )}
                </div>
              </div>
            )}
            
            {connectionError && !isConnected && (
              <div className="mx-6 mt-4">
                <ConnectionAlert error={connectionError} onReconnect={reconnect} />
              </div>
            )}
            
            <ResearchMessageList 
              messages={messages}
              showTranscriptButtons={true}
              onAddToTranscript={addTranscriptMessage}
            />
            
            {!isConnected ? (
              <div className="p-6 bg-slate-900/50 border-t border-slate-700/50 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-4">
                  <div className="flex items-center gap-3 text-slate-400">
                    <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
                    <span className="text-sm font-medium">Not connected to Research Agent</span>
                  </div>
                  <ResearchAgentConnectButton 
                    isConnected={isConnected}
                    isConnecting={isConnecting}
                    onClick={reconnect}
                    compact={false}
                  />
                </div>
              </div>
            ) : (
              <ResearchInput
                value={inputValue}
                onChange={setInputValue}
                onSend={handleSendMessage}
                onResearch={handleStartResearch}
                disabled={!isConnected}
              />
            )}
          </Card>
        </div>
        
        {effectiveShowResults && (
          <div className="hidden xl:block w-96 flex-shrink-0">
            <ResearchResultsPanel
              show={effectiveShowResults}
              results={researchResult}
              onClose={handleCloseResults}
              onAddToTranscript={addTranscriptMessage}
            />
          </div>
        )}
        
        {/* Mobile/Tablet Results Modal */}
        {effectiveShowResults && (
          <div className="xl:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900/95 backdrop-blur-sm rounded-xl shadow-2xl border border-slate-700/50 w-full max-w-4xl max-h-[90vh] flex flex-col">
              <div className="p-4 bg-slate-800/80 border-b border-slate-700/50 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center">
                    <Search className="h-3 w-3 text-emerald-400" />
                  </div>
                  <h2 className="text-lg font-bold text-slate-100" style={{ fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
                    Research Results
                  </h2>
                </div>
                <button
                  onClick={handleCloseResults}
                  className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded-lg transition-all duration-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-auto p-4">
                <div className="bg-slate-800/30 rounded-lg border border-slate-700/30 p-4">
                  <ResearchResults 
                    results={{
                      message: researchResult || "",
                      files: []
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};

// Minimal standalone connect button using the hook
export const StandaloneConnectButton: React.FC = () => {
  const { addTranscriptMessage } = useTranscript();
  
  const [
    { isConnected, isConnecting },
    { reconnect }
  ] = useResearchAgent({ 
    standalone: false,
    onConnect: () => {
      console.log('Research agent connected');
      const connectMessageId = `fastmcp-standalone-connect-${Date.now()}`;
      addTranscriptMessage(connectMessageId, "assistant", "🔌 Research Agent connected via standalone button", {
        source: "research",
        contentType: "connection-status"
      });
    },
    onDisconnect: () => {
      console.log('Research agent disconnected');
      const disconnectMessageId = `fastmcp-standalone-disconnect-${Date.now()}`;
      addTranscriptMessage(disconnectMessageId, "assistant", "🔌 Research Agent disconnected", {
        source: "research",
        contentType: "connection-status"
      });
    },
    onError: (error) => {
      console.error('Research agent error:', error);
      const errorMessageId = `fastmcp-standalone-error-${Date.now()}`;
      addTranscriptMessage(errorMessageId, "assistant", `🔌 Research Agent Error: ${error}`, {
        source: "research",
        contentType: "connection-status"
      });
    }
  });

  const toggleConnection = () => {
    reconnect();
  };

  return (
    <div className="inline-flex">
      <ResearchAgentConnectButton
        isConnected={isConnected}
        isConnecting={isConnecting}
        onClick={toggleConnection}
        compact={true}
      />
    </div>
  );
}; 

export const ResearchAgentComponents = () => {
  const { addTranscriptMessage } = useTranscript();

  // Add initial component load message
  React.useEffect(() => {
    const loadMessageId = `fastmcp-load-${Date.now()}`;
    addTranscriptMessage(loadMessageId, "assistant", "🔬 Research Agent Interface Loaded", {
      source: "research",
      contentType: "system-status",
      data: {
        component: "ResearchAgentComponents",
        timestamp: new Date().toISOString()
      }
    });
  }, [addTranscriptMessage]);

  return (
    <div className="h-full w-full p-1 sm:p-2 lg:p-4">
      <div className="h-full w-full bg-gradient-to-br from-slate-950/80 via-slate-900/60 to-slate-950/80 rounded-lg p-2 sm:p-3 lg:p-4">
        <ResearchAgentInterface />
      </div>
      <style>{`
        @media (max-width: 640px) {
          .research-mobile-optimized {
            padding: 0.5rem;
          }
          .research-mobile-optimized .modern-btn {
            padding: 8px 12px;
            font-size: 0.75rem;
            height: 44px;
          }
          .research-mobile-optimized input {
            height: 44px;
            font-size: 0.875rem;
          }
        }
        
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(148, 163, 184, 0.3) transparent;
        }
        
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(51, 65, 85, 0.1);
          border-radius: 3px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.3);
          border-radius: 3px;
          transition: background 0.2s ease;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(148, 163, 184, 0.5);
        }
        
        /* Enhanced animations */
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .fade-in-up {
          animation: fadeInUp 0.3s ease-out;
        }
        
        /* Pulse animation for loading states */
        @keyframes gentlePulse {
          0%, 100% {
            opacity: 0.8;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.02);
          }
        }
        
        .gentle-pulse {
          animation: gentlePulse 2s ease-in-out infinite;
        }
        
        /* Smooth hover transitions */
        .hover-lift {
          transition: all 0.2s ease;
        }
        
        .hover-lift:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
        }
      `}</style>
    </div>
  );
};