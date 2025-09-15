// Add this to your existing frontend-app/src/services/api.js file

// Image Analysis API endpoints
export const imageAnalysisAPI = {
  // Get all image analyses with pagination and filters
  getAll: async (params = {}) => {
    const { page = 1, limit = 10, conversationId, userId } = params;
    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...(conversationId && { conversationId }),
      ...(userId && { userId })
    });
    
    try {
      const response = await api.get(`/api/imageanalysis?${queryParams}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching image analyses:', error);
      throw error;
    }
  },

  // Get a single image analysis by ID
  getById: async (id) => {
    try {
      const response = await api.get(`/api/imageanalysis/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching image analysis:', error);
      throw error;
    }
  },

  // Get all analyses for a specific conversation
  getByConversation: async (conversationId) => {
    try {
      const response = await api.get(`/api/imageanalysis/conversation/${conversationId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching conversation analyses:', error);
      throw error;
    }
  },

  // Delete an image analysis
  delete: async (id) => {
    try {
      const response = await api.delete(`/api/imageanalysis/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting image analysis:', error);
      throw error;
    }
  },

  // Stream analyses in real-time (if needed)
  streamAnalyses: (conversationId, onData, onError) => {
    const eventSource = new EventSource(
      `/api/imageanalysis/stream?conversationId=${conversationId}`,
      { withCredentials: true }
    );

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onData(data);
      } catch (err) {
        console.error('Error parsing stream data:', err);
      }
    };

    eventSource.onerror = (error) => {
      console.error('Stream error:', error);
      onError?.(error);
      eventSource.close();
    };

    // Return cleanup function
    return () => {
      eventSource.close();
    };
  }
};

// Utility function to format image analysis data for display
export const formatImageAnalysis = (analysis) => {
  return {
    id: analysis._id,
    imageUrl: analysis.imageUrl,
    prompt: analysis.prompt,
    explanation: analysis.explanation,
    responseId: analysis.responseId,
    conversationId: analysis.conversationId,
    userId: analysis.userId,
    timestamp: new Date(analysis.timestamp),
    formattedDate: new Date(analysis.timestamp).toLocaleString(),
    metadata: analysis.metadata || {}
  };
};

// Helper to build image analysis filters
export const buildImageAnalysisFilters = (filters = {}) => {
  const validFilters = {};
  
  if (filters.conversationId) {
    validFilters.conversationId = filters.conversationId;
  }
  
  if (filters.userId) {
    validFilters.userId = filters.userId;
  }
  
  if (filters.startDate || filters.endDate) {
    validFilters.dateRange = {
      ...(filters.startDate && { start: filters.startDate }),
      ...(filters.endDate && { end: filters.endDate })
    };
  }
  
  return validFilters;
};