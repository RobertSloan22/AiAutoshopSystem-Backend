import React from 'react';

interface SearchResult {
    title: string;
    link: string;
    source: string;
    thumbnail: string;
  }
  
  interface ImageSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    searchResults: SearchResult[];
    onSelectImage: (image: SearchResult) => void;
    onSaveImage?: (image: SearchResult) => Promise<void>;
  }
  
  export const ImageSearchModal: React.FC<ImageSearchModalProps> = ({
    isOpen,
    onClose,
    searchResults,
    onSelectImage,
    onSaveImage
  }) => {
    if (!isOpen) return null;
  
    const handleImageSelect = async (result: SearchResult) => {
      try {
        if (onSaveImage) {
          await onSaveImage(result);
        }
        onSelectImage(result);
      } catch (error) {
        console.error('Error saving image:', error);
      }
    };
  
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-gray-900 rounded-lg w-[80vw] max-w-4xl max-h-[80vh] overflow-hidden border border-gray-700">
          <div className="p-4 border-b border-gray-700 flex justify-between items-center">
            <h2 className="text-2xl font-bold text-white">Search Results</h2>
            <button onClick={onClose} className="text-white hover:text-white">
              ✕
            </button>
          </div>
          <div className="p-4 overflow-y-auto max-h-[calc(80vh-100px)]">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {searchResults.map((result, index) => (
                <div 
                  key={index}
                  className="border border-gray-700 rounded-lg p-2 cursor-pointer hover:border-blue-500 bg-gray-800 bg-opacity-50"
                  onClick={() => handleImageSelect(result)}
                >
                  <img 
                    src={result.link} 
                    alt={result.title}
                    className="w-full h-full "
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = result.thumbnail;
                    }}
                  />
                  <p className="text-xl text-white truncate">{result.title}</p>
                  <p className="text-xl text-white truncate">Source: {result.source}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

interface ImageModalProps {
  open: boolean;
  onClose: () => void;
  children?: React.ReactNode;
}

export const Imagemodal: React.FC<ImageModalProps> = ({
  open,
  onClose,
  children
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center pt-10 z-50">
      <div className="bg-gray-900 rounded-lg p-6 w-[90vw] h-[85vh] relative border border-gray-700">
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 text-gray-400 hover:text-white z-[60] text-3xl"
        >
          ✕
        </button>
        <div className="h-full overflow-auto">
          {children}
        </div>
      </div>
    </div>
  );
};


