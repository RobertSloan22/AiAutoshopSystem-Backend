import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import './ResearchReportViewer.css'; // You'll need to create this CSS file

const ResearchReportViewer = ({ researchId }) => {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('report');

  useEffect(() => {
    const fetchReport = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`/api/research-results/${researchId}`);
        setReport(response.data.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load research report');
      } finally {
        setLoading(false);
      }
    };

    if (researchId) {
      fetchReport();
    }
  }, [researchId]);

  if (loading) return <div className="research-loading">Loading research report...</div>;
  if (error) return <div className="research-error">Error: {error}</div>;
  if (!report) return <div className="research-not-found">No report found</div>;

  return (
    <div className="research-report-container">
      <header className="research-header">
        <h1 className="research-title">{report.query}</h1>
        {report.summary && (
          <div className="research-summary">
            <p>{report.summary}</p>
          </div>
        )}
        <div className="research-metadata">
          <span className="research-date">
            {new Date(report.createdAt).toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </span>
          {report.tags && report.tags.length > 0 && (
            <div className="research-tags">
              {report.tags.map(tag => (
                <span key={tag} className="research-tag">{tag}</span>
              ))}
            </div>
          )}
        </div>
      </header>

      <nav className="research-tabs">
        <button 
          className={`tab-button ${activeTab === 'report' ? 'active' : ''}`}
          onClick={() => setActiveTab('report')}
        >
          Report
        </button>
        <button 
          className={`tab-button ${activeTab === 'search-plan' ? 'active' : ''}`}
          onClick={() => setActiveTab('search-plan')}
        >
          Research Approach
        </button>
        <button 
          className={`tab-button ${activeTab === 'search-results' ? 'active' : ''}`}
          onClick={() => setActiveTab('search-results')}
        >
          Sources
        </button>
        {report.followUpQuestions && report.followUpQuestions.length > 0 && (
          <button 
            className={`tab-button ${activeTab === 'questions' ? 'active' : ''}`}
            onClick={() => setActiveTab('questions')}
          >
            Follow-up Questions
          </button>
        )}
      </nav>

      <div className="research-content">
        {activeTab === 'report' && (
          <div className="report-view">
            {report.fullMarkdown ? (
              <div className="markdown-content">
                <ReactMarkdown>{report.fullMarkdown}</ReactMarkdown>
              </div>
            ) : report.reportSections && report.reportSections.length > 0 ? (
              <div className="section-content">
                {report.reportSections.map((section, index) => (
                  <div key={index} className={`section level-${section.level}`} id={section.id}>
                    <h{section.level} className="section-title">{section.title}</h{section.level}>
                    <div className="section-body">{section.content}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-report">No detailed report available</div>
            )}
          </div>
        )}

        {activeTab === 'search-plan' && report.searchPlan && (
          <div className="search-plan-view">
            <h2>{report.searchPlan.title}</h2>
            <div className="search-queries">
              {report.searchPlan.searches.map((search, index) => (
                <div key={index} className="search-query-item">
                  <div className="search-query">"{search.query}"</div>
                  <div className="search-reason">{search.reason}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'search-results' && report.searchResults && (
          <div className="search-results-view">
            <h2>{report.searchResults.title}</h2>
            <div className="search-results-list">
              {report.searchResults.results.map((result) => (
                <div key={result.id} className="search-result-item">
                  <div className="result-number">Source {result.id}</div>
                  <div className="result-content">{result.content}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'questions' && report.followUpQuestions && (
          <div className="questions-view">
            <h2>Follow-up Questions</h2>
            <ul className="questions-list">
              {report.followUpQuestions.map((question, index) => (
                <li key={index} className="question-item">
                  <button className="question-button" onClick={() => alert(`New search for: ${question}`)}>
                    {question}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResearchReportViewer;