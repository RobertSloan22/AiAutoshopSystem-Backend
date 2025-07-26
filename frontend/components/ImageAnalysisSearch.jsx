import React, { useState, useEffect, useCallback } from 'react';
import { Search, Filter, Clock, Image, MessageSquare, Eye, Download, Trash2, RefreshCw } from 'lucide-react';

const ImageAnalysisSearch = ({ userId = null, onAnalysisSelect = null }) => {
  const [searchMode, setSearchMode] = useState('conversation'); // 'conversation', 'image', 'annotated'
  const [searchQuery, setSearchQuery] = useState('');
  const [promptFilter, setPromptFilter] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [limit, setLimit] = useState(10);
  const [hasMore, setHasMore] = useState(false);

  // Advanced filters
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [analysisType, setAnalysisType] = useState('all'); // 'all', 'regular', 'annotated', 'batch'
  const [sortBy, setSortBy] = useState('newest'); // 'newest', 'oldest', 'relevance'

  const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  // Search by conversation ID
  const searchByConversation = useCallback(async (conversationId) => {
    if (!conversationId.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (userId) params.append('userId', userId);

      const response = await fetch(`${API_BASE}/openai/image-analysis/${conversationId}?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch conversation analyses');
      }

      setResults(data.analyses || []);
      setHasMore(false); // Conversation search doesn't support pagination
    } catch (err) {
      setError(err.message);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [userId, API_BASE]);

  // Search by image URL
  const searchByImage = useCallback(async (imageUrl, prompt = '') => {
    if (!imageUrl.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ imageUrl });
      if (prompt.trim()) params.append('prompt', prompt);

      const response = await fetch(`${API_BASE}/openai/image-analysis/by-image?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch image analyses');
      }

      setResults(data.analyses || []);
      setHasMore(false); // Image search returns max 5 results
    } catch (err) {
      setError(err.message);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [API_BASE]);

  // Search annotated analyses
  const searchAnnotated = useCallback(async (originalConversationId) => {
    if (!originalConversationId.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ limit: limit.toString() });
      if (userId) params.append('userId', userId);

      const response = await fetch(`${API_BASE}/openai/annotated-analyses/${originalConversationId}?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch annotated analyses');
      }

      setResults(data.analyses || []);
      setHasMore(data.hasMore || false);
    } catch (err) {
      setError(err.message);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [userId, limit, API_BASE]);

  // Handle search execution
  const executeSearch = useCallback(() => {
    if (!searchQuery.trim()) {
      setError('Please enter a search query');
      return;
    }

    switch (searchMode) {
      case 'conversation':
        searchByConversation(searchQuery);
        break;
      case 'image':
        searchByImage(searchQuery, promptFilter);
        break;
      case 'annotated':
        searchAnnotated(searchQuery);
        break;
      default:
        setError('Invalid search mode');
    }
  }, [searchMode, searchQuery, promptFilter, searchByConversation, searchByImage, searchAnnotated]);

  // Apply client-side filters and sorting
  const filteredAndSortedResults = useCallback(() => {
    let filtered = [...results];

    // Filter by analysis type
    if (analysisType !== 'all') {
      filtered = filtered.filter(analysis => {
        const metadata = analysis.metadata || {};
        switch (analysisType) {
          case 'regular':
            return !metadata.type || metadata.type === 'regular';
          case 'annotated':
            return metadata.type === 'annotated_analysis';
          case 'batch':
            return metadata.type === 'batch_annotated_analysis';
          default:
            return true;
        }
      });
    }

    // Filter by date range
    if (dateRange.start || dateRange.end) {
      filtered = filtered.filter(analysis => {
        const date = new Date(analysis.createdAt);
        const start = dateRange.start ? new Date(dateRange.start) : null;
        const end = dateRange.end ? new Date(dateRange.end) : null;
        
        if (start && date < start) return false;
        if (end && date > end) return false;
        return true;
      });
    }

    // Sort results
    filtered.sort((a, b) => {
      const dateA = new Date(a.createdAt);
      const dateB = new Date(b.createdAt);

      switch (sortBy) {
        case 'oldest':
          return dateA - dateB;
        case 'newest':
        default:
          return dateB - dateA;
      }
    });

    return filtered;
  }, [results, analysisType, dateRange, sortBy]);

  // Delete analysis
  const deleteAnalysis = async (analysisId, isAnnotated = false) => {
    if (!window.confirm('Are you sure you want to delete this analysis?')) return;

    try {
      const endpoint = isAnnotated 
        ? `${API_BASE}/openai/annotated-analysis/${analysisId}`
        : `${API_BASE}/openai/image-analysis/${analysisId}`;
      
      const params = userId ? `?userId=${userId}` : '';
      const response = await fetch(`${endpoint}${params}`, { method: 'DELETE' });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete analysis');
      }

      // Remove from results
      setResults(prev => prev.filter(item => item.id !== analysisId));
      
      if (selectedAnalysis?.id === analysisId) {
        setSelectedAnalysis(null);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  // Get analysis type badge
  const getAnalysisTypeBadge = (analysis) => {
    const metadata = analysis.metadata || {};
    const type = metadata.type;

    if (type === 'annotated_analysis') {
      return <span className="badge badge-warning">Annotated</span>;
    } else if (type === 'batch_annotated_analysis') {
      return <span className="badge badge-info">Batch</span>;
    } else if (analysis.prompt?.includes('ANNOTATED:')) {
      return <span className="badge badge-warning">Annotated</span>;
    }
    
    return <span className="badge badge-primary">Regular</span>;
  };

  return (
    <div className="image-analysis-search">
      <div className="search-header">
        <h2>Search Image Analyses</h2>
        
        {/* Search Mode Tabs */}
        <div className="search-modes">
          <button 
            className={`mode-tab ${searchMode === 'conversation' ? 'active' : ''}`}
            onClick={() => setSearchMode('conversation')}
          >
            <MessageSquare size={16} />
            By Conversation
          </button>
          <button 
            className={`mode-tab ${searchMode === 'image' ? 'active' : ''}`}
            onClick={() => setSearchMode('image')}
          >
            <Image size={16} />
            By Image
          </button>
          <button 
            className={`mode-tab ${searchMode === 'annotated' ? 'active' : ''}`}
            onClick={() => setSearchMode('annotated')}
          >
            <Eye size={16} />
            Annotated
          </button>
        </div>

        {/* Search Input */}
        <div className="search-input-group">
          <div className="search-field">
            <Search size={20} />
            <input
              type="text"
              placeholder={
                searchMode === 'conversation' ? 'Enter conversation ID...' :
                searchMode === 'image' ? 'Enter image URL or data URI...' :
                'Enter original conversation ID...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && executeSearch()}
            />
          </div>

          {/* Prompt filter for image search */}
          {searchMode === 'image' && (
            <div className="search-field">
              <input
                type="text"
                placeholder="Filter by prompt (optional)..."
                value={promptFilter}
                onChange={(e) => setPromptFilter(e.target.value)}
              />
            </div>
          )}

          <button onClick={executeSearch} disabled={loading} className="search-btn">
            {loading ? <RefreshCw className="spinning" size={16} /> : <Search size={16} />}
            Search
          </button>

          <button 
            onClick={() => setShowFilters(!showFilters)} 
            className="filter-btn"
          >
            <Filter size={16} />
            Filters
          </button>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="filters-panel">
            <div className="filter-group">
              <label>Analysis Type:</label>
              <select value={analysisType} onChange={(e) => setAnalysisType(e.target.value)}>
                <option value="all">All Types</option>
                <option value="regular">Regular</option>
                <option value="annotated">Annotated</option>
                <option value="batch">Batch</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Sort By:</label>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Date Range:</label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                placeholder="Start date"
              />
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                placeholder="End date"
              />
            </div>

            {searchMode === 'annotated' && (
              <div className="filter-group">
                <label>Results Limit:</label>
                <select value={limit} onChange={(e) => setLimit(parseInt(e.target.value))}>
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Results */}
      <div className="search-results">
        {loading && (
          <div className="loading-state">
            <RefreshCw className="spinning" size={24} />
            <p>Searching analyses...</p>
          </div>
        )}

        {!loading && results.length === 0 && searchQuery && (
          <div className="empty-state">
            <p>No analyses found for your search criteria.</p>
          </div>
        )}

        {!loading && filteredAndSortedResults().length > 0 && (
          <div className="results-list">
            <div className="results-header">
              <span>{filteredAndSortedResults().length} analyses found</span>
              {hasMore && <span className="has-more">More results available</span>}
            </div>

            {filteredAndSortedResults().map((analysis) => (
              <div 
                key={analysis.id} 
                className={`analysis-card ${selectedAnalysis?.id === analysis.id ? 'selected' : ''}`}
                onClick={() => setSelectedAnalysis(analysis)}
              >
                <div className="card-header">
                  <div className="card-title">
                    {getAnalysisTypeBadge(analysis)}
                    <span className="conversation-id">
                      {analysis.conversationId?.substring(0, 12)}...
                    </span>
                    <Clock size={14} />
                    <span className="timestamp">{formatDate(analysis.createdAt)}</span>
                  </div>
                  
                  <div className="card-actions">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onAnalysisSelect && onAnalysisSelect(analysis);
                      }}
                      className="action-btn"
                      title="View Analysis"
                    >
                      <Eye size={16} />
                    </button>
                    
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteAnalysis(analysis.id, analysis.metadata?.type?.includes('annotated'));
                      }}
                      className="action-btn delete-btn"
                      title="Delete Analysis"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="card-content">
                  <div className="prompt-preview">
                    <strong>Prompt:</strong> {analysis.prompt?.substring(0, 100)}
                    {analysis.prompt?.length > 100 && '...'}
                  </div>
                  
                  <div className="explanation-preview">
                    <strong>Analysis:</strong> {analysis.explanation?.substring(0, 150)}
                    {analysis.explanation?.length > 150 && '...'}
                  </div>

                  {analysis.metadata?.imageCount && (
                    <div className="batch-info">
                      <span className="batch-count">{analysis.metadata.imageCount} images</span>
                    </div>
                  )}
                </div>

                {analysis.imageUrl && !analysis.imageUrl.startsWith('BATCH:') && (
                  <div className="image-preview">
                    <img 
                      src={analysis.imageUrl} 
                      alt="Analysis preview" 
                      style={{ maxWidth: '100px', maxHeight: '100px', objectFit: 'cover' }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Selected Analysis Detail Modal */}
      {selectedAnalysis && (
        <div className="analysis-modal-overlay" onClick={() => setSelectedAnalysis(null)}>
          <div className="analysis-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Analysis Details</h3>
              <button onClick={() => setSelectedAnalysis(null)} className="close-btn">×</button>
            </div>
            
            <div className="modal-content">
              <div className="detail-section">
                <h4>Information</h4>
                <p><strong>ID:</strong> {selectedAnalysis.id}</p>
                <p><strong>Conversation ID:</strong> {selectedAnalysis.conversationId}</p>
                <p><strong>Response ID:</strong> {selectedAnalysis.responseId}</p>
                <p><strong>Created:</strong> {formatDate(selectedAnalysis.createdAt)}</p>
                <p><strong>Type:</strong> {getAnalysisTypeBadge(selectedAnalysis)}</p>
              </div>

              <div className="detail-section">
                <h4>Prompt</h4>
                <p className="detail-text">{selectedAnalysis.prompt}</p>
              </div>

              <div className="detail-section">
                <h4>Analysis</h4>
                <p className="detail-text">{selectedAnalysis.explanation}</p>
              </div>

              {selectedAnalysis.imageUrl && !selectedAnalysis.imageUrl.startsWith('BATCH:') && (
                <div className="detail-section">
                  <h4>Image</h4>
                  <img 
                    src={selectedAnalysis.imageUrl} 
                    alt="Analysis image" 
                    style={{ maxWidth: '100%', height: 'auto' }}
                  />
                </div>
              )}

              {selectedAnalysis.metadata && (
                <div className="detail-section">
                  <h4>Metadata</h4>
                  <pre className="metadata-json">
                    {JSON.stringify(selectedAnalysis.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .image-analysis-search {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .search-header h2 {
          margin-bottom: 20px;
          color: #333;
        }

        .search-modes {
          display: flex;
          gap: 10px;
          margin-bottom: 20px;
        }

        .mode-tab {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          border: 2px solid #e1e5e9;
          background: white;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .mode-tab:hover {
          border-color: #007bff;
          background: #f8f9fa;
        }

        .mode-tab.active {
          border-color: #007bff;
          background: #007bff;
          color: white;
        }

        .search-input-group {
          display: flex;
          gap: 10px;
          margin-bottom: 20px;
          align-items: center;
        }

        .search-field {
          position: relative;
          flex: 1;
        }

        .search-field svg {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #6c757d;
        }

        .search-field input {
          width: 100%;
          padding: 12px 12px 12px 40px;
          border: 2px solid #e1e5e9;
          border-radius: 8px;
          font-size: 14px;
        }

        .search-field input:focus {
          outline: none;
          border-color: #007bff;
        }

        .search-btn, .filter-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 20px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          font-weight: 500;
        }

        .search-btn {
          background: #007bff;
          color: white;
        }

        .search-btn:hover {
          background: #0056b3;
        }

        .search-btn:disabled {
          background: #6c757d;
          cursor: not-allowed;
        }

        .filter-btn {
          background: #6c757d;
          color: white;
        }

        .filter-btn:hover {
          background: #545b62;
        }

        .filters-panel {
          display: flex;
          gap: 20px;
          padding: 20px;
          background: #f8f9fa;
          border-radius: 8px;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }

        .filter-group {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .filter-group label {
          font-size: 12px;
          font-weight: 600;
          color: #495057;
          text-transform: uppercase;
        }

        .filter-group select,
        .filter-group input {
          padding: 8px 12px;
          border: 1px solid #ced4da;
          border-radius: 4px;
          font-size: 14px;
        }

        .error-message {
          padding: 12px 16px;
          background: #f8d7da;
          color: #721c24;
          border: 1px solid #f5c6cb;
          border-radius: 8px;
          margin-bottom: 20px;
        }

        .loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 40px;
          color: #6c757d;
        }

        .empty-state {
          text-align: center;
          padding: 40px;
          color: #6c757d;
        }

        .results-header {
          display: flex;
          justify-content: between;
          align-items: center;
          padding: 10px 0;
          border-bottom: 1px solid #e1e5e9;
          margin-bottom: 20px;
        }

        .has-more {
          font-size: 12px;
          color: #007bff;
          font-weight: 500;
        }

        .analysis-card {
          border: 1px solid #e1e5e9;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .analysis-card:hover {
          border-color: #007bff;
          box-shadow: 0 2px 8px rgba(0,123,255,0.1);
        }

        .analysis-card.selected {
          border-color: #007bff;
          background: #f8f9ff;
        }

        .card-header {
          display: flex;
          justify-content: between;
          align-items: center;
          margin-bottom: 12px;
        }

        .card-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          color: #6c757d;
        }

        .card-actions {
          display: flex;
          gap: 8px;
        }

        .action-btn {
          padding: 6px;
          border: none;
          background: #f8f9fa;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .action-btn:hover {
          background: #e9ecef;
        }

        .delete-btn:hover {
          background: #f8d7da;
          color: #721c24;
        }

        .card-content {
          font-size: 14px;
        }

        .prompt-preview,
        .explanation-preview {
          margin-bottom: 8px;
        }

        .batch-info {
          color: #007bff;
          font-size: 12px;
          font-weight: 500;
        }

        .image-preview {
          margin-top: 12px;
        }

        .badge {
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .badge-primary {
          background: #007bff;
          color: white;
        }

        .badge-warning {
          background: #ffc107;
          color: #212529;
        }

        .badge-info {
          background: #17a2b8;
          color: white;
        }

        .analysis-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .analysis-modal {
          background: white;
          border-radius: 12px;
          max-width: 800px;
          max-height: 90vh;
          overflow-y: auto;
          margin: 20px;
        }

        .modal-header {
          display: flex;
          justify-content: between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid #e1e5e9;
        }

        .close-btn {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #6c757d;
        }

        .modal-content {
          padding: 24px;
        }

        .detail-section {
          margin-bottom: 24px;
        }

        .detail-section h4 {
          margin-bottom: 8px;
          color: #495057;
        }

        .detail-text {
          line-height: 1.6;
          color: #333;
        }

        .metadata-json {
          background: #f8f9fa;
          padding: 12px;
          border-radius: 4px;
          font-size: 12px;
          overflow-x: auto;
        }

        .spinning {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
          .search-input-group {
            flex-direction: column;
          }
          
          .filters-panel {
            flex-direction: column;
          }
          
          .card-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
          }
        }
      `}</style>
    </div>
  );
};

export default ImageAnalysisSearch;