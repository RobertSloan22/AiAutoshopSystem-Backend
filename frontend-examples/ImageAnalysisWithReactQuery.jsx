import React from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';

// React Query hooks for image analysis
export const useImageAnalyses = (page = 1, limit = 10, filters = {}) => {
  return useQuery(
    ['imageAnalyses', page, limit, filters],
    async () => {
      const params = new URLSearchParams({
        page,
        limit,
        ...filters
      });
      const { data } = await axios.get(`/api/imageanalysis?${params}`);
      return data;
    },
    {
      keepPreviousData: true, // Keep previous page data while fetching new page
      staleTime: 5 * 60 * 1000, // Consider data stale after 5 minutes
    }
  );
};

export const useImageAnalysisByConversation = (conversationId) => {
  return useQuery(
    ['imageAnalyses', 'conversation', conversationId],
    async () => {
      const { data } = await axios.get(`/api/imageanalysis/conversation/${conversationId}`);
      return data;
    },
    {
      enabled: !!conversationId, // Only fetch if conversationId exists
    }
  );
};

export const useDeleteImageAnalysis = () => {
  const queryClient = useQueryClient();
  
  return useMutation(
    async (id) => {
      const { data } = await axios.delete(`/api/imageanalysis/${id}`);
      return data;
    },
    {
      onSuccess: () => {
        // Invalidate and refetch image analyses queries
        queryClient.invalidateQueries('imageAnalyses');
      },
    }
  );
};

// Component using React Query
export const ImageAnalysisListWithReactQuery = () => {
  const [page, setPage] = React.useState(1);
  const { data, isLoading, isError, error } = useImageAnalyses(page, 10);
  const deleteMutation = useDeleteImageAnalysis();

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this analysis?')) {
      try {
        await deleteMutation.mutateAsync(id);
        // Show success toast if you have a toast library
        // toast.success('Analysis deleted successfully');
      } catch (err) {
        // Show error toast
        // toast.error('Failed to delete analysis');
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">Error: {error?.message || 'Failed to load analyses'}</p>
      </div>
    );
  }

  const analyses = data?.data || [];
  const pagination = data?.pagination || {};

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
                isDeleting={deleteMutation.isLoading}
              />
            ))}
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex justify-center items-center space-x-2 mt-6">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              
              <span className="px-4">
                Page {page} of {pagination.pages}
              </span>
              
              <button
                onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                disabled={page === pagination.pages}
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

// Simplified card component
const ImageAnalysisCard = ({ analysis, onDelete, isDeleting }) => {
  return (
    <div className="border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
      {analysis.imageUrl && (
        <img 
          src={analysis.imageUrl} 
          alt="Analysis" 
          className="w-full h-48 object-cover rounded mb-3"
        />
      )}

      <div className="mb-2">
        <h3 className="font-semibold text-sm text-gray-600">Prompt:</h3>
        <p className="text-sm line-clamp-2">{analysis.prompt}</p>
      </div>

      <div className="mb-3">
        <h3 className="font-semibold text-sm text-gray-600">Analysis:</h3>
        <p className="text-sm line-clamp-3">{analysis.explanation}</p>
      </div>

      <div className="mt-3 flex justify-between items-center">
        <span className="text-xs text-gray-500">
          {new Date(analysis.timestamp).toLocaleDateString()}
        </span>
        <button
          onClick={() => onDelete(analysis._id)}
          disabled={isDeleting}
          className="text-red-600 text-sm hover:text-red-800 disabled:opacity-50"
        >
          {isDeleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </div>
  );
};