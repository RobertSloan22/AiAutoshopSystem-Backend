import React, { useState, useEffect } from 'react';
import './ChartDisplay.css';

const ChartDisplay = ({ 
  visualizations = [], 
  isLoading = false, 
  error = null,
  onChartClick = null 
}) => {
  const [expandedChart, setExpandedChart] = useState(null);

  const handleChartClick = (chart, index) => {
    if (onChartClick) {
      onChartClick(chart, index);
    } else {
      setExpandedChart(expandedChart === index ? null : index);
    }
  };

  const renderChart = (chart, index) => {
    const imageData = chart.data || chart.url;
    
    return (
      <div 
        key={chart.imageId || index} 
        className={`chart-container ${expandedChart === index ? 'expanded' : ''}`}
        onClick={() => handleChartClick(chart, index)}
      >
        <div className="chart-header">
          <span className="chart-title">Chart {index + 1}</span>
          <button 
            className="chart-expand-btn"
            onClick={(e) => {
              e.stopPropagation();
              setExpandedChart(expandedChart === index ? null : index);
            }}
          >
            {expandedChart === index ? '−' : '+'}
          </button>
        </div>
        
        <div className="chart-image-container">
          {imageData ? (
            <img 
              src={imageData.startsWith('data:') ? imageData : `data:image/png;base64,${imageData}`}
              alt={`Chart ${index + 1}`}
              className="chart-image"
              onError={(e) => {
                console.error('Failed to load chart image:', e);
                e.target.style.display = 'none';
              }}
            />
          ) : (
            <div className="chart-placeholder">
              <div className="placeholder-icon">📊</div>
              <div className="placeholder-text">Chart loading...</div>
            </div>
          )}
        </div>
        
        {chart.path && (
          <div className="chart-metadata">
            <small>Path: {chart.path}</small>
          </div>
        )}
      </div>
    );
  };

  if (error) {
    return (
      <div className="chart-display error">
        <div className="error-icon">⚠️</div>
        <div className="error-message">
          Failed to load chart: {error}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="chart-display loading">
        <div className="loading-spinner"></div>
        <div className="loading-text">Generating chart...</div>
      </div>
    );
  }

  if (!visualizations || visualizations.length === 0) {
    return null;
  }

  return (
    <div className="chart-display">
      <div className="chart-header-main">
        <h3>Generated Charts ({visualizations.length})</h3>
      </div>
      
      <div className="charts-grid">
        {visualizations.map((chart, index) => renderChart(chart, index))}
      </div>
      
      {expandedChart !== null && (
        <div 
          className="chart-overlay"
          onClick={() => setExpandedChart(null)}
        >
          <div 
            className="chart-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="chart-modal-header">
              <h4>Chart {expandedChart + 1}</h4>
              <button 
                className="close-btn"
                onClick={() => setExpandedChart(null)}
              >
                ×
              </button>
            </div>
            <div className="chart-modal-content">
              {visualizations[expandedChart] && (
                <img 
                  src={
                    visualizations[expandedChart].data?.startsWith('data:') 
                      ? visualizations[expandedChart].data 
                      : `data:image/png;base64,${visualizations[expandedChart].data}`
                  }
                  alt={`Chart ${expandedChart + 1} - Expanded`}
                  className="chart-modal-image"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChartDisplay;