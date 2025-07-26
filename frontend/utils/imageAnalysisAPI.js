// API Helper Functions for Image Analysis Search
// Centralized API calls with error handling and response formatting

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

class ImageAnalysisAPI {
  /**
   * Search image analyses by conversation ID
   * @param {string} conversationId - The conversation ID to search for
   * @param {Object} options - Additional options
   * @param {string} options.userId - Filter by user ID
   * @returns {Promise<Object>} Search results
   */
  static async searchByConversation(conversationId, options = {}) {
    try {
      const params = new URLSearchParams();
      if (options.userId) params.append('userId', options.userId);

      const response = await fetch(`${API_BASE}/openai/image-analysis/${conversationId}?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch conversation analyses');
      }

      return {
        success: true,
        data: data.analyses || [],
        count: data.analyses?.length || 0
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        data: []
      };
    }
  }

  /**
   * Search image analyses by image URL
   * @param {string} imageUrl - The image URL to search for
   * @param {Object} options - Additional options
   * @param {string} options.prompt - Filter by specific prompt
   * @returns {Promise<Object>} Search results
   */
  static async searchByImage(imageUrl, options = {}) {
    try {
      const params = new URLSearchParams({ imageUrl });
      if (options.prompt) params.append('prompt', options.prompt);

      const response = await fetch(`${API_BASE}/openai/image-analysis/by-image?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch image analyses');
      }

      return {
        success: true,
        data: data.analyses || [],
        count: data.analyses?.length || 0
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        data: []
      };
    }
  }

  /**
   * Search annotated analyses by original conversation ID
   * @param {string} originalConversationId - The original conversation ID
   * @param {Object} options - Additional options
   * @param {string} options.userId - Filter by user ID
   * @param {number} options.limit - Limit number of results (max 50)
   * @returns {Promise<Object>} Search results
   */
  static async searchAnnotated(originalConversationId, options = {}) {
    try {
      const params = new URLSearchParams({
        limit: (options.limit || 10).toString()
      });
      if (options.userId) params.append('userId', options.userId);

      const response = await fetch(`${API_BASE}/openai/annotated-analyses/${originalConversationId}?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch annotated analyses');
      }

      return {
        success: true,
        data: data.analyses || [],
        count: data.count || 0,
        hasMore: data.hasMore || false
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        data: []
      };
    }
  }

  /**
   * Delete an image analysis
   * @param {string} analysisId - The analysis ID to delete
   * @param {Object} options - Additional options
   * @param {string} options.userId - User ID for ownership verification
   * @param {boolean} options.isAnnotated - Whether this is an annotated analysis
   * @returns {Promise<Object>} Delete result
   */
  static async deleteAnalysis(analysisId, options = {}) {
    try {
      const endpoint = options.isAnnotated 
        ? `${API_BASE}/openai/annotated-analysis/${analysisId}`
        : `${API_BASE}/openai/image-analysis/${analysisId}`;
      
      const params = options.userId ? `?userId=${options.userId}` : '';
      const response = await fetch(`${endpoint}${params}`, { 
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete analysis');
      }

      return {
        success: true,
        deletedId: analysisId,
        message: data.message
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get analysis details by ID
   * @param {string} analysisId - The analysis ID
   * @param {Object} options - Additional options
   * @param {boolean} options.isAnnotated - Whether this is an annotated analysis
   * @returns {Promise<Object>} Analysis details
   */
  static async getAnalysisById(analysisId, options = {}) {
    try {
      // Note: This would require a new endpoint in the backend
      // For now, this is a placeholder showing the expected interface
      const endpoint = options.isAnnotated 
        ? `${API_BASE}/openai/annotated-analysis/${analysisId}`
        : `${API_BASE}/openai/image-analysis/${analysisId}`;

      const response = await fetch(endpoint);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch analysis details');
      }

      return {
        success: true,
        data: data.analysis
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }

  /**
   * Export analysis data to different formats
   * @param {Array} analyses - Array of analyses to export
   * @param {string} format - Export format ('json', 'csv', 'pdf')
   * @returns {Promise<Object>} Export result
   */
  static async exportAnalyses(analyses, format = 'json') {
    try {
      switch (format.toLowerCase()) {
        case 'json':
          return this.exportToJSON(analyses);
        case 'csv':
          return this.exportToCSV(analyses);
        case 'pdf':
          return this.exportToPDF(analyses);
        default:
          throw new Error('Unsupported export format');
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Export analyses to JSON format
   * @private
   */
  static exportToJSON(analyses) {
    const exportData = {
      exportDate: new Date().toISOString(),
      count: analyses.length,
      analyses: analyses.map(analysis => ({
        id: analysis.id,
        conversationId: analysis.conversationId,
        prompt: analysis.prompt,
        explanation: analysis.explanation,
        createdAt: analysis.createdAt,
        metadata: analysis.metadata
      }))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `image-analyses-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);

    return {
      success: true,
      message: 'JSON export completed'
    };
  }

  /**
   * Export analyses to CSV format
   * @private
   */
  static exportToCSV(analyses) {
    const headers = ['ID', 'Conversation ID', 'Prompt', 'Explanation', 'Created At', 'Type'];
    const csvData = [
      headers.join(','),
      ...analyses.map(analysis => [
        analysis.id,
        analysis.conversationId,
        `"${(analysis.prompt || '').replace(/"/g, '""')}"`,
        `"${(analysis.explanation || '').replace(/"/g, '""')}"`,
        analysis.createdAt,
        analysis.metadata?.type || 'regular'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `image-analyses-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    return {
      success: true,
      message: 'CSV export completed'
    };
  }

  /**
   * Export analyses to PDF format (requires additional PDF library)
   * @private
   */
  static exportToPDF(analyses) {
    // This would require a PDF generation library like jsPDF
    // For now, return a placeholder
    return {
      success: false,
      error: 'PDF export not implemented. Please install jsPDF library.'
    };
  }

  /**
   * Batch operations on multiple analyses
   * @param {Array} analysisIds - Array of analysis IDs
   * @param {string} operation - Operation to perform ('delete', 'export')
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Batch operation result
   */
  static async batchOperation(analysisIds, operation, options = {}) {
    const results = {
      success: [],
      failed: [],
      total: analysisIds.length
    };

    for (const id of analysisIds) {
      try {
        let result;
        switch (operation) {
          case 'delete':
            result = await this.deleteAnalysis(id, options);
            break;
          default:
            throw new Error(`Unsupported batch operation: ${operation}`);
        }

        if (result.success) {
          results.success.push(id);
        } else {
          results.failed.push({ id, error: result.error });
        }
      } catch (error) {
        results.failed.push({ id, error: error.message });
      }
    }

    return {
      success: results.failed.length === 0,
      results,
      message: `Batch ${operation}: ${results.success.length} succeeded, ${results.failed.length} failed`
    };
  }

  /**
   * Search analyses with advanced filters
   * @param {Object} filters - Search filters
   * @param {string} filters.searchType - Type of search ('conversation', 'image', 'annotated')
   * @param {string} filters.query - Search query
   * @param {string} filters.userId - User ID filter
   * @param {string} filters.analysisType - Analysis type filter
   * @param {Object} filters.dateRange - Date range filter
   * @param {string} filters.sortBy - Sort criteria
   * @param {number} filters.limit - Result limit
   * @returns {Promise<Object>} Advanced search results
   */
  static async advancedSearch(filters) {
    try {
      let result;
      const options = {
        userId: filters.userId,
        limit: filters.limit
      };

      switch (filters.searchType) {
        case 'conversation':
          result = await this.searchByConversation(filters.query, options);
          break;
        case 'image':
          result = await this.searchByImage(filters.query, {
            prompt: filters.prompt,
            ...options
          });
          break;
        case 'annotated':
          result = await this.searchAnnotated(filters.query, options);
          break;
        default:
          throw new Error('Invalid search type');
      }

      if (!result.success) {
        return result;
      }

      // Apply client-side filters
      let filteredData = result.data;

      // Filter by analysis type
      if (filters.analysisType && filters.analysisType !== 'all') {
        filteredData = filteredData.filter(analysis => {
          const metadata = analysis.metadata || {};
          switch (filters.analysisType) {
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
      if (filters.dateRange) {
        const { start, end } = filters.dateRange;
        if (start || end) {
          filteredData = filteredData.filter(analysis => {
            const date = new Date(analysis.createdAt);
            const startDate = start ? new Date(start) : null;
            const endDate = end ? new Date(end) : null;
            
            if (startDate && date < startDate) return false;
            if (endDate && date > endDate) return false;
            return true;
          });
        }
      }

      // Sort results
      if (filters.sortBy) {
        filteredData.sort((a, b) => {
          const dateA = new Date(a.createdAt);
          const dateB = new Date(b.createdAt);

          switch (filters.sortBy) {
            case 'oldest':
              return dateA - dateB;
            case 'newest':
            default:
              return dateB - dateA;
          }
        });
      }

      return {
        ...result,
        data: filteredData,
        count: filteredData.length,
        filtered: filteredData.length !== result.data.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        data: []
      };
    }
  }
}

// Utility functions for formatting and validation
export const AnalysisUtils = {
  /**
   * Format date for display
   */
  formatDate: (dateString) => {
    return new Date(dateString).toLocaleString();
  },

  /**
   * Get analysis type badge info
   */
  getAnalysisTypeBadge: (analysis) => {
    const metadata = analysis.metadata || {};
    const type = metadata.type;

    if (type === 'annotated_analysis') {
      return { label: 'Annotated', class: 'badge-warning' };
    } else if (type === 'batch_annotated_analysis') {
      return { label: 'Batch', class: 'badge-info' };
    } else if (analysis.prompt?.includes('ANNOTATED:')) {
      return { label: 'Annotated', class: 'badge-warning' };
    }
    
    return { label: 'Regular', class: 'badge-primary' };
  },

  /**
   * Validate conversation ID format
   */
  isValidConversationId: (id) => {
    return typeof id === 'string' && id.length > 10;
  },

  /**
   * Validate image URL format
   */
  isValidImageUrl: (url) => {
    return typeof url === 'string' && (
      url.startsWith('http') || 
      url.startsWith('data:image/')
    );
  },

  /**
   * Truncate text for display
   */
  truncateText: (text, maxLength = 150) => {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  },

  /**
   * Calculate relative time
   */
  getRelativeTime: (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    
    return date.toLocaleDateString();
  }
};

export default ImageAnalysisAPI;