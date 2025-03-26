import React, { useState, useRef, useEffect } from 'react';
import { X, ExternalLink, Save, Database, Trash2 } from 'react-feather';
import axiosInstance from '../../utils/axiosConfig.js';
import { toast } from 'react-hot-toast';
import { Imagemodal } from './Imagemodal';

interface ImageSearchResult {
  title: string;
  imageUrl: string;
  thumbnailUrl: string;
  source: string;
  link: string;
}

declare global {
  interface Window {
    electron?: any;
  }
}

const getImageUrl = (url: string) => {
  if (!url) return '';
  
  try {
    // Clean the URL
    const cleanUrl = url.trim().replace(/\s+/g, '');
    
    // Handle different URL formats
    if (cleanUrl.startsWith('data:')) {
      return cleanUrl; // Return as-is if it's a base64 image
    }

    // Check if URL is already a proxy URL to prevent double-proxying
    if (cleanUrl.includes('/proxy-image?url=')) {
      // Extract the original URL from the proxy URL
      const originalUrl = new URLSearchParams(cleanUrl.split('?')[1]).get('url');
      return originalUrl || cleanUrl;
    }
    
    // Always use proxy in electron environment
    if (window.electron && !cleanUrl.startsWith('data:')) {
      // Ensure the URL is properly encoded only once
      const encodedUrl = encodeURIComponent(cleanUrl);
      return `${axiosInstance.defaults.baseURL}/proxy-image?url=${encodedUrl}`;
    }
    
    return cleanUrl;
  } catch (error) {
    console.error('Error processing image URL:', error);
    return '';
  }
};

interface ImageSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImageSelect: (imageUrl: string) => void;
  searchQuery: string;
}

interface SavedImage extends ImageSearchResult {
  timestamp?: string;
  _id?: string;  // Add _id field for MongoDB documents
}

export const ImageSearchModal: React.FC<ImageSearchModalProps> = ({
  isOpen,
  onClose,
  onImageSelect,
  searchQuery
}) => {
  const [images, setImages] = useState<ImageSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchImages = async () => {
    if (!searchQuery) return;

    setLoading(true);
    setError(null);

    try {
      const response = await axiosInstance.post('/api/serper/images', {
        query: searchQuery
      });

      if (response.data && Array.isArray(response.data.images)) {
        setImages(response.data.images);
      } else {
        setError('No images found');
      }
    } catch (error) {
      console.error('Error searching images:', error);
      setError('Failed to search for images');
      toast.error('Failed to search for images');
    } finally {
      setLoading(false);
    }
  };

  const handleImageClick = (image: ImageSearchResult) => {
    const imageUrl = image.imageUrl || image.thumbnailUrl;
    if (imageUrl) {
      onImageSelect(imageUrl);
      onClose();
    } else {
      toast.error('Invalid image URL');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-gray-800 rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-white">Image Search Results</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : error ? (
          <div className="text-red-500 text-center">{error}</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {images.map((image, index) => (
              <div
                key={index}
                className="bg-gray-900 rounded-lg p-2 cursor-pointer hover:bg-gray-800"
                onClick={() => handleImageClick(image)}
              >
                <div className="relative w-full h-48">
                  <img
                    src={image.thumbnailUrl || image.imageUrl}
                    alt={image.title}
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="mt-2 text-white text-sm truncate">
                  {image.title}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
