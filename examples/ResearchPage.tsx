import React, { useState } from 'react';
import ResearchProgress from './ResearchProgress';

/**
 * ResearchPage Component
 * 
 * Example of how to integrate the ResearchProgress component
 * with a form to submit research queries.
 */
const ResearchPage: React.FC = () => {
  const [query, setQuery] = useState<string>('');
  const [researchId, setResearchId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Submit the research query to the API
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!query.trim()) {
      setError('Please enter a research query');
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch('/api/multiagent-research', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create research request');
      }
      
      const data = await response.json();
      setResearchId(data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="research-page">
      <h2>Automotive Research</h2>
      
      {!researchId ? (
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="query">Research Question</label>
            <textarea
              id="query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter your automotive research question here..."
              rows={4}
              disabled={isLoading}
            />
          </div>
          
          {error && <div className="error-message">{error}</div>}
          
          <button 
            type="submit" 
            disabled={isLoading}
            className="submit-button"
          >
            {isLoading ? 'Submitting...' : 'Start Research'}
          </button>
        </form>
      ) : (
        <div className="research-results">
          <div className="research-info">
            <h3>Research in Progress</h3>
            <p>Research ID: {researchId}</p>
            <p>Query: {query}</p>
            <button 
              className="view-results-button"
              onClick={() => {
                window.open(`/research/${researchId}`, '_blank');
              }}
            >
              View Full Results
            </button>
            <button 
              className="new-research-button"
              onClick={() => {
                setResearchId(null);
                setQuery('');
              }}
            >
              New Research
            </button>
          </div>
          
          <ResearchProgress researchId={researchId} />
        </div>
      )}
      
      <style jsx>{`
        .research-page {
          max-width: 1000px;
          margin: 0 auto;
          padding: 20px;
          font-family: system-ui, -apple-system, sans-serif;
        }
        
        .form-group {
          margin-bottom: 20px;
        }
        
        label {
          display: block;
          margin-bottom: 8px;
          font-weight: 500;
        }
        
        textarea {
          width: 100%;
          padding: 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 16px;
          font-family: inherit;
        }
        
        .error-message {
          color: #d32f2f;
          background-color: #ffebee;
          padding: 10px;
          border-radius: 4px;
          margin-bottom: 15px;
        }
        
        button {
          padding: 12px 24px;
          background-color: #2196f3;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 16px;
          cursor: pointer;
          transition: background-color 0.3s;
        }
        
        button:hover {
          background-color: #1976d2;
        }
        
        button:disabled {
          background-color: #cccccc;
          cursor: not-allowed;
        }
        
        .research-info {
          margin-bottom: 30px;
          padding: 15px;
          background-color: #f5f5f5;
          border-radius: 4px;
        }
        
        .research-info p {
          margin: 5px 0;
        }
        
        .view-results-button,
        .new-research-button {
          margin-right: 10px;
          margin-top: 10px;
        }
        
        .new-research-button {
          background-color: #757575;
        }
        
        .new-research-button:hover {
          background-color: #616161;
        }
      `}</style>
    </div>
  );
};

export default ResearchPage;