import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import './ResearchReportList.css';

const ResearchReportList = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchReports();
  }, [page]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/research-results', {
        params: {
          page,
          limit: 10,
          format: 'summary', // Get summary format for list view
          search: searchQuery || undefined
        }
      });
      
      setReports(response.data.data);
      setTotalPages(response.data.pagination.pages);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load research reports');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1); // Reset to first page
    fetchReports();
  };

  return (
    <div className="research-list-container">
      <h1 className="list-title">Research Reports</h1>
      
      <div className="search-bar">
        <form onSubmit={handleSearch}>
          <input
            type="text"
            placeholder="Search reports..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          <button type="submit" className="search-button">Search</button>
        </form>
      </div>
      
      {loading ? (
        <div className="loading">Loading reports...</div>
      ) : error ? (
        <div className="error">Error: {error}</div>
      ) : (
        <>
          <div className="reports-grid">
            {reports.length > 0 ? (
              reports.map((report) => (
                <Link 
                  to={`/reports/${report.id}`} 
                  key={report.id} 
                  className="report-card"
                >
                  <h2 className="report-query">{report.query}</h2>
                  {report.summary && (
                    <p className="report-summary">{report.summary.substring(0, 150)}...</p>
                  )}
                  <div className="report-meta">
                    <span className="report-date">
                      {new Date(report.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </span>
                    {report.tags && report.tags.length > 0 && (
                      <div className="report-tags">
                        {report.tags.map(tag => (
                          <span key={tag} className="report-tag">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
              ))
            ) : (
              <div className="no-reports">No research reports found</div>
            )}
          </div>
          
          {totalPages > 1 && (
            <div className="pagination">
              <button 
                onClick={() => setPage(prev => Math.max(prev - 1, 1))} 
                disabled={page === 1}
                className="page-button"
              >
                Previous
              </button>
              <span className="page-info">
                Page {page} of {totalPages}
              </span>
              <button 
                onClick={() => setPage(prev => Math.min(prev + 1, totalPages))} 
                disabled={page === totalPages}
                className="page-button"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ResearchReportList;