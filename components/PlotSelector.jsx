import React, { useState, useEffect } from 'react';
import './PlotSelector.css';

const PlotSelector = ({ onPlotSelect, filters = {} }) => {
  const [plots, setPlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPlot, setSelectedPlot] = useState(null);
  const [pagination, setPagination] = useState({
    limit: 20,
    offset: 0,
    total: 0,
    hasMore: false
  });

  const fetchPlots = async (offset = 0) => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams({
        limit: pagination.limit,
        offset: offset,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        ...filters
      });

      const response = await fetch(`/api/plots?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch plots');
      }

      const data = await response.json();
      
      if (offset === 0) {
        setPlots(data.plots);
      } else {
        setPlots(prev => [...prev, ...data.plots]);
      }
      
      setPagination(data.pagination);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching plots:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlots(0);
  }, [filters]);

  const handlePlotSelect = (plot) => {
    setSelectedPlot(plot);
    if (onPlotSelect) {
      onPlotSelect(plot);
    }
  };

  const loadMore = () => {
    if (pagination.hasMore && !loading) {
      fetchPlots(pagination.offset + pagination.limit);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading && plots.length === 0) {
    return (
      <div className="plot-selector loading">
        <div className="loading-spinner">Loading plots...</div>
      </div>
    );
  }

  if (error && plots.length === 0) {
    return (
      <div className="plot-selector error">
        <div className="error-message">
          Error loading plots: {error}
          <button onClick={() => fetchPlots(0)} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="plot-selector">
      <div className="plot-selector-header">
        <h3>Select a Plot</h3>
        <div className="plot-count">
          {pagination.total} plot{pagination.total !== 1 ? 's' : ''} available
        </div>
      </div>

      {plots.length === 0 ? (
        <div className="no-plots">
          <p>No plots found</p>
        </div>
      ) : (
        <>
          <div className="plots-grid">
            {plots.map((plot) => (
              <div
                key={plot.id}
                className={`plot-card ${selectedPlot?.id === plot.id ? 'selected' : ''}`}
                onClick={() => handlePlotSelect(plot)}
              >
                <div className="plot-thumbnail">
                  <img
                    src={plot.thumbnailUrl || plot.url}
                    alt={plot.description || plot.filename}
                    loading="lazy"
                    onError={(e) => {
                      e.target.src = '/api/plots/' + plot.id + '/thumbnail';
                    }}
                  />
                </div>
                
                <div className="plot-info">
                  <div className="plot-title">
                    {plot.description || plot.filename}
                  </div>
                  
                  <div className="plot-metadata">
                    <div className="metadata-row">
                      <span className="label">Created:</span>
                      <span className="value">{formatDate(plot.createdAt)}</span>
                    </div>
                    
                    <div className="metadata-row">
                      <span className="label">Size:</span>
                      <span className="value">{formatFileSize(plot.size)}</span>
                    </div>
                    
                    {plot.tags && plot.tags.length > 0 && (
                      <div className="metadata-row">
                        <span className="label">Tags:</span>
                        <div className="tags">
                          {plot.tags.slice(0, 3).map((tag, index) => (
                            <span key={index} className="tag">
                              {tag}
                            </span>
                          ))}
                          {plot.tags.length > 3 && (
                            <span className="tag-more">+{plot.tags.length - 3}</span>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {plot.executionId && (
                      <div className="metadata-row">
                        <span className="label">Execution ID:</span>
                        <span className="value execution-id">
                          {plot.executionId.slice(0, 8)}...
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {pagination.hasMore && (
            <div className="load-more-container">
              <button
                onClick={loadMore}
                disabled={loading}
                className="load-more-button"
              >
                {loading ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </>
      )}

      {selectedPlot && (
        <div className="selected-plot-info">
          <h4>Selected Plot Details</h4>
          <div className="selected-details">
            <p><strong>ID:</strong> {selectedPlot.id}</p>
            <p><strong>Filename:</strong> {selectedPlot.filename}</p>
            <p><strong>Description:</strong> {selectedPlot.description || 'No description'}</p>
            <p><strong>Created:</strong> {formatDate(selectedPlot.createdAt)}</p>
            {selectedPlot.accessCount > 0 && (
              <p><strong>Access Count:</strong> {selectedPlot.accessCount}</p>
            )}
            {selectedPlot.vehicleContext?.vin && (
              <p><strong>Vehicle:</strong> {selectedPlot.vehicleContext.vin}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PlotSelector;