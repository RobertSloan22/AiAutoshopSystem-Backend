import React, { useState, useEffect } from 'react';
import axios from 'axios';

// Example API service for image analysis
const imageAnalysisAPI = {
  // Get all image analyses with pagination
  getAll: async (page = 1, limit = 10, filters = {}) => {
    const params = new URLSearchParams({
      page,
      limit,
      ...filters
    });
    const response = await axios.get(`/api/imageanalysis?${params}`);
    return response.data;
  },

  // Get image analysis by ID
  getById: async (id) => {
    const response = await axios.get(`/api/imageanalysis/${id}`);
    return response.data;
  },

  // Get analyses by conversation ID
  getByConversation: async (conversationId) => {
    const response = await axios.get(`/api/imageanalysis/conversation/${conversationId}`);
    return response.data;
  },

  // Delete image analysis
  delete: async (id) => {
    const response = await axios.delete(`/api/imageanalysis/${id}`);
    return response.data;
  }
};

// Main component to display image analyses
export const ImageAnalysisList = () => {
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  });

  // Fetch analyses on component mount and when page changes
  useEffect(() => {
    fetchAnalyses();
  }, [pagination.page]);

  const fetchAnalyses = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await imageAnalysisAPI.getAll(pagination.page, pagination.limit);
      
      if (result.success) {
        setAnalyses(result.data);
        setPagination(result.pagination);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch image analyses');
      console.error('Error fetching analyses:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this analysis?')) {
      return;
    }

    try {
      await imageAnalysisAPI.delete(id);
      // Refresh the list after deletion
      fetchAnalyses();
    } catch (err) {
      console.error('Error deleting analysis:', err);
      alert('Failed to delete analysis');
    }
  };

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">Error: {error}</p>
        <button 
          onClick={fetchAnalyses}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold mb-4">Image Analyses</h2>
      
      {analyses.length === 0 ? (
        <p className="text-gray-500">No image analyses found.</p>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {analyses.map((analysis) => (
              <ImageAnalysisCard 
                key={analysis._id} 
                analysis={analysis} 
                onDelete={handleDelete}
              />
            ))}
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex justify-center items-center space-x-2 mt-6">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              
              <span className="px-4">
                Page {pagination.page} of {pagination.pages}
              </span>
              
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.pages}
                className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
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

// Individual analysis card component
const ImageAnalysisCard = ({ analysis, onDelete }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
      {/* Image */}
      {analysis.imageUrl && (
        <img 
          src={analysis.imageUrl} 
          alt="Analysis" 
          className="w-full h-48 object-cover rounded mb-3"
        />
      )}

      {/* Prompt */}
      <div className="mb-2">
        <h3 className="font-semibold text-sm text-gray-600">Prompt:</h3>
        <p className="text-sm">{analysis.prompt}</p>
      </div>

      {/* Explanation (truncated) */}
      <div className="mb-3">
        <h3 className="font-semibold text-sm text-gray-600">Analysis:</h3>
        <p className={`text-sm ${!expanded && 'line-clamp-3'}`}>
          {analysis.explanation}
        </p>
        {analysis.explanation.length > 150 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-blue-600 text-sm hover:underline mt-1"
          >
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>

      {/* Metadata */}
      <div className="text-xs text-gray-500 space-y-1">
        <p>Response ID: {analysis.responseId}</p>
        <p>Conversation: {analysis.conversationId}</p>
        <p>Date: {new Date(analysis.timestamp).toLocaleString()}</p>
      </div>

      {/* Actions */}
      <div className="mt-3 flex justify-end">
        <button
          onClick={() => onDelete(analysis._id)}
          className="text-red-600 text-sm hover:text-red-800"
        >
          Delete
        </button>
      </div>
    </div>
  );
};

// Example usage with conversation filtering
export const ConversationImageAnalyses = ({ conversationId }) => {
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (conversationId) {
      fetchConversationAnalyses();
    }
  }, [conversationId]);

  const fetchConversationAnalyses = async () => {
    try {
      setLoading(true);
      const result = await imageAnalysisAPI.getByConversation(conversationId);
      if (result.success) {
        setAnalyses(result.data);
      }
    } catch (err) {
      console.error('Error fetching conversation analyses:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading analyses...</div>;
  }

  return (
    <div className="space-y-3">
      <h3 className="font-semibold">Image Analyses in this Conversation</h3>
      {analyses.length === 0 ? (
        <p className="text-gray-500 text-sm">No image analyses in this conversation.</p>
      ) : (
        analyses.map((analysis) => (
          <div key={analysis._id} className="border rounded p-3">
            {analysis.imageUrl && (
              <img 
                src={analysis.imageUrl} 
                alt="Analysis" 
                className="w-full max-w-xs h-32 object-cover rounded mb-2"
              />
            )}
            <p className="text-sm font-medium">{analysis.prompt}</p>
            <p className="text-sm text-gray-600 mt-1">{analysis.explanation}</p>
            <p className="text-xs text-gray-400 mt-2">
              {new Date(analysis.timestamp).toLocaleString()}
            </p>
          </div>
        ))
      )}
    </div>
  );
};