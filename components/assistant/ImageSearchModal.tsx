import React from 'react';
import { X, Save } from 'lucide-react';
import { Button } from '../ui/button';

export interface ImageResult {
    title: string;
    imageUrl: string;
    thumbnailUrl: string;
    source: string;
    link: string;
}

interface ImageSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    searchResults: ImageResult[];
    onImageClick: (image: ImageResult) => void;
    onSaveImage: (image: ImageResult) => Promise<void>;
}

export const ImageSearchModal: React.FC<ImageSearchModalProps> = ({
    isOpen,
    onClose,
    searchResults,
    onImageClick,
    onSaveImage
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
            <div className="bg-gray-800 rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-2xl font-bold text-white">Image Search Results</h3>
                    <button 
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {searchResults.map((image, index) => (
                        <div key={index} className="relative group">
                            <img
                                src={image.thumbnailUrl}
                                alt={image.title}
                                className="w-full h-40 object-cover rounded-lg cursor-pointer"
                                onClick={() => onImageClick(image)}
                            />
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-opacity flex items-center justify-center opacity-0 group-hover:opacity-100">
                                <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onSaveImage(image);
                                    }}
                                    className="flex items-center gap-2"
                                >
                                    <Save size={16} />
                                    Save
                                </Button>
                            </div>
                            <p className="text-sm text-gray-300 mt-1 truncate">{image.title}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}; 