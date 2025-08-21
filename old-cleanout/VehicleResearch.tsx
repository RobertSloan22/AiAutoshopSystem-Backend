// src/components/VehicleResearch.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useCustomer } from '../../context/CustomerContext';
import axiosInstance from '../../utils/axiosConfig';
import { toast } from 'react-hot-toast';
import { Button } from '../ui/button';
import { useResearch, ResearchResponse, EnhancedPart } from '../../context/ResearchContext';
import { ImageSearchModal } from './ImageSearchModal';
import { Imagemodal } from './Imagemodal';
import { Save, Search, ExternalLink, Trash2, Upload } from 'lucide-react';
import { CustomerContextDisplay } from "../../components/customer/CustomerContextDisplay";
import { AppointmentsPage } from "../../components/assistant/AppointmentsPage";
import { App } from '../../app/src/app/App';
import { TranscriptProvider } from '../../app/src/app/contexts/TranscriptContext';
import { EventProvider } from '../../app/src/app/contexts/EventContext';

import { VerticalLinearStepper } from '../dtc/Stepper';
//This is the component for researching vehicle data and dtc information, that will collect images related to the dtc 

//Type Interface's 
interface CustomModalProps {
  isOpen?: boolean;
}

//Type Interface's 
interface CustomModalProps {
  isOpen?: boolean;
}

// ... existing code ...


// ... existing code ...
interface DetailedResearchResponse {
  title: string;
  category: string;
  detailedDescription: string;
  additionalSteps?: string[];
  warnings?: string[];
  expertTips?: string[];
  relatedIssues?: string[];
  estimatedTime?: string;
  requiredExpertise?: string;
  specificTools?: string[];
  componentLocation?: string;
  oemPartNumbers?: string[];
  torqueSpecifications?: string[];
  serviceManualReferences?: string[];
  additionalResources?: Array<{
    title: string;
    url?: string;
    description: string;
    documentNumber?: string;
    pageNumbers?: string;
    publicationDate?: string;
    publisher?: string;
  }>;
  manufacturerSpecificInfo?: string;
  commonFailurePatterns?: string[];
  url?: string;
  fileType?: string;
  thumbnail?: string;
  sourceUrl?: string;
  link?: string;
}

// Update schema for diagnostic steps to match new backend
interface DiagnosticStep {
  step: string;
  details: string;
  componentLocation: string;
  connectorInfo: string;
  tools: string[];
  expectedReadings?: string;
  normalValueRanges: string;
  factoryServiceManualRef: string;
  notes: string;
  diagnosticImages?: string[];
  waveformPatterns?: string;
  specialPrecautions?: string;
}

// Update schema for possible causes to match new backend
interface PossibleCause {
  cause: string;
  likelihood: string;
  explanation: string;
  modelSpecificNotes: string;
  commonSymptomsForThisCause: string[];
  technicalBackground?: string;
  failureRate?: string;
  vehicleSubsystemAffected?: string;
}

// Update schema for recommended fixes to match new backend
interface RecommendedFix {
  fix: string;
  difficulty: "Easy" | "Moderate" | "Complex";
  estimatedCost: string;
  professionalOnly: boolean;
  parts: string[] | EnhancedPart[];
  oemPartNumbers: string[];
  torqueSpecs: string;
  laborHours: string;
  specialTools: string[];
  procedureOverview: string;
  commonPitfalls?: string[];
  postRepairVerification?: string;
  warrantyConsiderations?: string;
}

// Update schema for technical notes to match new backend
interface TechnicalNotes {
  commonIssues: string[];
  serviceIntervals: string;
  recalls: string;
  tsbs: string;
  manufacturerSpecificNotes: string;
  knownGoodValues: string;
  systemDiagrams?: string[];
  preventativeMaintenance?: string[];
}

// Update schema for references to match new backend
interface Reference {
  source: string;
  documentNumber: string;
  url: string;
  type: string;
  relevance: string;
  pageNumbers: string;
  publicationDate?: string;
  publisher?: string;
}

interface DiagramAnnotation {
  x: number;
  y: number;
  text: string;
}



interface DetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  loading: boolean;
  data: DetailedResearchResponse | null;
}


interface VehicleResearchProps {
  initialResults: ResearchResponse;
}

interface ImageResult {
  title: string;
  imageUrl: string;
  thumbnailUrl: string;
  source: string;
  link: string;
}


interface ImageSearchResult extends ImageResult {
  originalUrl: string;
  relevanceScore: number;
  contentType: string;
  _id: string;
  timestamp: string;
}

interface ImageSearchError {
  response?: {
    data?: {
      message?: string;
    };
  };
  message?: string;
}

interface ImageModalProps {
  isOpen?: boolean;
}

// Add new interface for saved images
interface SavedImage {
  title: string;
  imageUrl: string;
  thumbnailUrl: string;
  source: string;
  link: string;
  timestamp?: string;
  explanation?: string;
  _id: string;
  originalUrl?: string;
  conversationId?: string;
}

interface SearchResultImage {
  title?: string;
  link?: string;
  imageUrl?: string;
  thumbnail?: string;
  thumbnailUrl?: string;
  source?: string;
}

const getImageUrl = (url: string | undefined) => {
  if (!url) return '';
  
  try {
    // Clean the URL
    const cleanUrl = url.trim().replace(/\s+/g, '');
    
    // Handle different URL formats
    if (cleanUrl.startsWith('data:')) {
      return cleanUrl; // Return as-is if it's a base64 image
    }
    
    // Always use proxy in electron environment
    if (window.electron && !cleanUrl.startsWith('data:')) {
      // Check if baseURL has "/api" already
      const baseUrl = axiosInstance.defaults.baseURL || '';
      const proxyPath = baseUrl.includes('/api') ? '/proxy-image' : '/api/proxy-image';
      const proxyUrl = `${baseUrl}${proxyPath}?url=${encodeURIComponent(cleanUrl)}`;
      console.log('Using proxy URL:', proxyUrl);
      return proxyUrl;
    }
    
    return cleanUrl;
  } catch (error) {
    console.error('Error processing image URL:', error);
    return '/placeholder-image.png'; // Return fallback image path on error
  }
};

// Add this helper for image error handling
const handleImageError = (event: React.SyntheticEvent<HTMLImageElement, Event>) => {
  const img = event.currentTarget;
  
  // Check if we're already using the fallback to prevent loops
  if (img.src.includes('placeholder-image.png')) {
    return; // Already showing fallback, don't process further
  }
  
  // Set fallback image for broken images
  img.onerror = null; // Prevent infinite error loop
  img.src = '/placeholder-image.png'; // Replace with your fallback image path
  
  console.error('Image failed to load:', img.src);
  
  // Add styling to indicate broken image
  img.style.opacity = '0.5';
  img.style.border = '1px dashed #ff0000';
  
  // Add a small caption below the image container
  const parent = img.parentElement;
  if (parent) {
    // Check if we already added a caption
    const existingCaption = parent.querySelector('[data-image-error-caption]');
    if (!existingCaption) {
      const caption = document.createElement('div');
      caption.textContent = 'Image unavailable';
      caption.style.color = '#ff0000';
      caption.style.fontSize = '12px';
      caption.style.textAlign = 'center';
      caption.setAttribute('data-image-error-caption', 'true');
      parent.appendChild(caption);
    }
  }
};

//Main Data Modal 
const DetailModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  loading: boolean;
  data: DetailedResearchResponse | null;
}> = ({ isOpen, onClose, loading, data }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-5 z-50 flex items-center justify-center">
      <div className="bg-gray-800 rounded-lg p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-2xl font-bold text-white">{data?.title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-blue-800 p-4 rounded-lg">
              <h4 className="text-blue-400 text-3xl mb-2">Detailed Description</h4>
              <p className="text-white text-2xl">{data?.detailedDescription}</p>
            </div>
            
            {/* Component Location */}
            {data?.componentLocation && (
              <div className="bg-blue-900 p-4 rounded-lg">
                <h4 className="text-blue-400 text-3xl mb-2">Component Location</h4>
                <p className="text-white text-2xl">{data.componentLocation}</p>
              </div>
            )}
            
            {/* Service Manual References */}
            {data?.serviceManualReferences && data.serviceManualReferences.length > 0 && (
              <div className="bg-blue-900 p-4 rounded-lg">
                <h4 className="text-blue-400 text-3xl mb-2">Service Manual References</h4>
                <ul className="list-disc list-inside text-white space-y-2">
                  {data.serviceManualReferences.map((ref, index) => (
                    <li key={index} className="text-2xl">{ref}</li>
                  ))}
                </ul>
              </div>
            )}

            {data?.additionalSteps && (
              <div className="bg-yellow-900 p-4 rounded-lg">
                <h4 className="text-blue-400 text-3xl mb-2">Additional Steps</h4>
                <ul className="list-disc list-inside text-white space-y-2">
                  {data.additionalSteps.map((step, index) => (
                    <li key={index} className="text-2xl">
                      {step}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Torque Specifications */}
            {data?.torqueSpecifications && data.torqueSpecifications.length > 0 && (
              <div className="bg-yellow-900 p-4 rounded-lg">
                <h4 className="text-blue-400 text-3xl mb-2">Torque Specifications</h4>
                <ul className="list-disc list-inside text-white space-y-2">
                  {data.torqueSpecifications.map((spec, index) => (
                    <li key={index} className="text-2xl">{spec}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* OEM Part Numbers */}
            {data?.oemPartNumbers && data.oemPartNumbers.length > 0 && (
              <div className="bg-yellow-900 p-4 rounded-lg">
                <h4 className="text-blue-400 text-3xl mb-2">OEM Part Numbers</h4>
                <ul className="list-disc list-inside text-white space-y-2">
                  {data.oemPartNumbers.map((part, index) => (
                    <li key={index} className="text-2xl">{part}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Specific Tools */}
            {data?.specificTools && data.specificTools.length > 0 && (
              <div className="bg-yellow-900 p-4 rounded-lg">
                <h4 className="text-blue-400 text-3xl mb-2">Specific Tools Required</h4>
                <ul className="list-disc list-inside text-white space-y-2">
                  {data.specificTools.map((tool, index) => (
                    <li key={index} className="text-2xl">{tool}</li>
                  ))}
                </ul>
              </div>
            )}

            {data?.warnings && (
              <div className="bg-red-900 bg-opacity-50 p-4 rounded-lg">
                <h4 className="text-red-400 text-3xl mb-2">Important Warnings</h4>
                <ul className="list-disc list-inside text-white space-y-2">
                  {data.warnings.map((warning, index) => (
                    <li key={index} className="text-2xl">
                      {warning}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data?.expertTips && (
              <div className="bg-green-900 bg-opacity-50 p-4 rounded-lg">
                <h4 className="text-green-400 text-3xl mb-2">Expert Tips</h4>
                <ul className="list-disc list-inside text-white space-y-2">
                  {data.expertTips.map((tip, index) => (
                    <li key={index} className="text-2xl">
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Manufacturer Specific Info */}
            {data?.manufacturerSpecificInfo && (
              <div className="bg-green-900 bg-opacity-50 p-4 rounded-lg">
                <h4 className="text-green-400 text-3xl mb-2">Manufacturer Specific Information</h4>
                <p className="text-white text-2xl">{data.manufacturerSpecificInfo}</p>
              </div>
            )}
            
            {/* Common Failure Patterns */}
            {data?.commonFailurePatterns && data.commonFailurePatterns.length > 0 && (
              <div className="bg-red-900 bg-opacity-50 p-4 rounded-lg">
                <h4 className="text-red-400 text-3xl mb-2">Common Failure Patterns</h4>
                <ul className="list-disc list-inside text-white space-y-2">
                  {data.commonFailurePatterns.map((pattern, index) => (
                    <li key={index} className="text-2xl">{pattern}</li>
                  ))}
                </ul>
              </div>
            )}

            {data?.additionalResources && (
              <div className="bg-gray-800 p-4 rounded-lg">
                <h4 className="text-blue-400 text-xl mb-2">Additional Resources</h4>
                <div className="space-y-3">
                  {data.additionalResources.map((resource, index) => (
                    <div key={index} className="border-l-4 border-blue-500 pl-4">
                      <h5 className="text-white text-lg font-semibold">{resource.title}</h5>
                      <p className="text-gray-300">{resource.description}</p>
                      
                      {/* Document number if available */}
                      {resource.documentNumber && (
                        <p className="text-gray-300">Document #: {resource.documentNumber}</p>
                      )}
                      
                      {/* Page numbers if available */}
                      {resource.pageNumbers && (
                        <p className="text-gray-300">Pages: {resource.pageNumbers}</p>
                      )}
                      
                      {resource.url && (
                        <a
                          href={resource.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300"
                        >
                          Learn More →
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data?.estimatedTime && (
              <div className="mt-4 text-gray-300">
                <span className="text-blue-400">Estimated Time:</span> {data.estimatedTime}
              </div>
            )}

            {data?.requiredExpertise && (
              <div className="mt-2 text-gray-300">
                <span className="text-blue-400">Required Expertise:</span> {data.requiredExpertise}
              </div>
            )}
          </div>
          
        )}
      </div>
    </div>
  );
};

// New interface for drag and drop
interface DropZoneProps {
  onImageUpload: (file: File) => void;
}

// New component for drag and drop functionality
const DropZone: React.FC<DropZoneProps> = ({ onImageUpload }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        onImageUpload(file);
      } else {
        toast.error('Please upload an image file');
      }
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.type.startsWith('image/')) {
        onImageUpload(file);
      } else {
        toast.error('Please upload an image file');
      }
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
        isDragging ? 'border-blue-500 bg-blue-900 bg-opacity-20' : 'border-gray-600'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleButtonClick}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInput}
        className="hidden"
        accept="image/*"
      />
      <Upload className="mx-auto h-10 w-10 text-gray-400" />
      <p className="mt-2 text-xl font-bold text-gray-400">
        {isDragging ? 'Drop image here' : 'Drag & drop an image or click to upload'}
      </p>
      <p className="text-xl text-gray-500">
        Supported formats: JPG, PNG, GIF
      </p>
    </div>
  );
};

// Update the props interface to reflect that onAskQuestion doesn't return a value
const TechnicalQuestionInput: React.FC<{
  onAskQuestion: (question: string, dtcCode?: string) => Promise<void>;
  isLoading: boolean;
}> = ({ onAskQuestion, isLoading }) => {
  const [question, setQuestion] = useState('');
  const [dtcCode, setDtcCode] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    
    setAnswer(null);
    try {
      await onAskQuestion(question, dtcCode || undefined);
      // Remove the setAnswer(result) since onAskQuestion doesn't return a value
    } catch (error) {
      console.error('Error asking question:', error);
    }
  };

  return (
    <div className="bg-gray-800 bg-opacity-50 rounded-lg p-4">
      <h3 className="text-2xl font-bold text-yellow-300 mb-3">Ask Technical Questions</h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-white text-lg mb-1">DTC Code (Optional)</label>
          <input
            type="text"
            value={dtcCode}
            onChange={(e) => setDtcCode(e.target.value)}
            placeholder="e.g. P0300"
            className="w-full p-2 bg-gray-700 text-white rounded-lg text-lg"
          />
        </div>
        <div>
          <label className="block text-white text-lg mb-1">Technical Question</label>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask about specifications, procedures, TSBs, etc."
            className="w-full p-2 bg-gray-700 text-white rounded-lg text-lg min-h-[100px]"
            disabled={isLoading}
          />
        </div>
        <button
          type="submit"
          disabled={isLoading || !question.trim()}
          className="w-full p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:bg-blue-800 disabled:opacity-50"
        >
          {isLoading ? 'Getting Answer...' : 'Ask Question'}
        </button>
      </form>
      
      {answer && (
        <div className="mt-4 bg-blue-900 bg-opacity-70 p-4 rounded-lg">
          <h4 className="text-xl font-bold text-blue-300 mb-2">Answer:</h4>
          <div className="text-white text-lg whitespace-pre-wrap">{answer}</div>
        </div>
      )}
    </div>
  );
};

const VehicleResearch: React.FC<VehicleResearchProps> = ({ initialResults }): JSX.Element => {
  const { selectedCustomer, selectedVehicle } = useCustomer();
  const {
    problem,
    setProblem,
    researchData,
    setResearchData,
    detailedData,
  
    isLoading,
    setIsLoading
  } = useResearch();

  // State management
  const [activeTab, setActiveTab] = useState('diagnostic');
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedDetailKey, setSelectedDetailKey] = useState<string | null>(null);
  const [currentDetailData, setCurrentDetailData] = useState<DetailedResearchResponse | null>(null);
  const [vehicleImages, setVehicleImages] = useState<ImageResult[]>([]);
  const [problemImages, setProblemImages] = useState<ImageResult[]>([]);
  const [diagnosticImages, setDiagnosticImages] = useState<Record<number, ImageResult[]>>({});
  const [selectedDiagram, setSelectedDiagram] = useState<{
    url: string;
    title: string;
    thumbnail?: string;
    sourceUrl?: string;
    fileType: string;
    link?: string;
    pendingExplanation?: boolean;
    conversationId?: string;
  } | null>(null);
  const [isImageSearchModalOpen, setIsImageSearchModalOpen] = useState(false);
  const [showLogViewer, setShowLogViewer] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [modalImages, setModalImages] = useState<ImageResult[]>([]);
  const [selectedImage, setSelectedImage] = useState<{url: string, title: string} | null>(null);
  const [searchResults, setSearchResults] = useState<ImageSearchResult[]>([]);
  const [partPricing, setPartPricing] = useState<string | null>(null);
  const [savedImages, setSavedImages] = useState<SavedImage[]>([]);
  const [customImageSearch, setCustomImageSearch] = useState('');
  const [showSavedImages, setShowSavedImages] = useState(false);
  const [hasInitiatedResearch, setHasInitiatedResearch] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imageExplanation, setImageExplanation] = useState<string>('');
  const [isLoadingExplanation, setIsLoadingExplanation] = useState(false);
  const [isLoadingFollowUp, setIsLoadingFollowUp] = useState(false);
  const [isLoadingSavedImages, setIsLoadingSavedImages] = useState(false);
  const [imageZoom, setImageZoom] = useState<number>(3.5);
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [followUpQuestion, setFollowUpQuestion] = useState<string>('');
  const [followUpAnswer, setFollowUpAnswer] = useState<string>('');
  const [isAskingFollowUp, setIsAskingFollowUp] = useState<boolean>(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [technicalQuestionAnswer, setTechnicalQuestionAnswer] = useState<string | null>(null);
  const [isLoadingTechnicalQuestion, setIsLoadingTechnicalQuestion] = useState(false);
  const [preloadedDetails, setPreloadedDetails] = useState<Record<string, DetailedResearchResponse>>({});
  const [detailData, setDetailData] = useState<DetailedResearchResponse | null>(null);

  // Image handling functions
  const openImagesInModal = (images: ImageResult[]) => {
    setModalImages(images);
    setImageModalOpen(true);
  };

  const searchImages = async (
    query: string,
    type: 'diagram' | 'part' | 'repair' = 'diagram'
  ): Promise<ImageResult[]> => {
    try {
      if (!selectedVehicle) {
        toast.error('Please select a vehicle first');
        return [];
      }

      const cleanedQuery = query.trim();
      
      // Show loading toast
      const loadingToast = toast.loading('Searching for images...');
      
      // Send complete vehicle info to backend
      const response = await axiosInstance.post('/serper/images', {
        query: cleanedQuery,
        num: 30,
        vehicleInfo: {
          year: selectedVehicle.year,
          make: selectedVehicle.make,
          model: selectedVehicle.model,
          engine: selectedVehicle.engine || undefined
        }
      });

      // Dismiss loading toast
      toast.dismiss(loadingToast);

      if (response.data?.images?.length > 0) {
        // Use the results directly from the backend
        setSearchResults(response.data.images);
        return response.data.images;
      } else {
        // Show helpful message when no results found
        toast.error(
          'No relevant images found. Try:\n' +
          '• Being more specific (e.g. "timing belt diagram" instead of just "belt")\n' +
          '• Including the component name (e.g. "water pump location")\n' +
          '• Adding terms like "diagram", "schematic", or "layout"'
        );
        return [];
      }
    } catch (error: unknown) {
      const typedError = error as ImageSearchError;
      const errorMessage = typedError.response?.data?.message || typedError.message || 'Failed to search for images';
      toast.error(errorMessage);
      return [];
    }
  };

  const getImageExplanation = async (imageUrl: string, title: string) => {
    try {
      const imageData = {
        title: title,
        imageUrl: imageUrl,
        thumbnailUrl: selectedDiagram?.thumbnail || '',
        source: '',
        link: imageUrl,
        originalUrl: imageUrl,
        prompt: "You are an automotive expert. Please explain this automotive diagram or image in detail. Focus on identifying parts, explaining their function, and any technical details visible in the image."
      };

      console.log('Requesting image explanation...');
      const response = await axiosInstance.post('/openai/explain-image', imageData);
      console.log('Received response:', response.data);

      if (response.data) {
        // Extract explanation from the response
        const explanation = response.data.explanation || response.data.output_text;
        console.log('Setting explanation:', explanation);
        setImageExplanation(explanation || 'No explanation available.');
        
        // Use the correct field names from the backend response
        if (response.data.conversationId) {
          setConversationId(response.data.conversationId);
          console.log('Saved conversation ID:', response.data.conversationId);
        } else if (response.data.conversation_id) {
          // Backend might send as conversation_id (OpenAI's format)
          setConversationId(response.data.conversation_id);
          console.log('Saved conversation_id as conversation ID:', response.data.conversation_id);
        } else if (response.data.responseId) {
          // Use responseId as a fallback
          setConversationId(response.data.responseId);
          console.log('Saved responseId as conversation ID:', response.data.responseId);
        } else {
          console.warn('No conversation ID found in response:', response.data);
        }
      } else {
        console.log('No explanation in response');
        setImageExplanation('No explanation available.');
      }
    } catch (error) {
      console.error('Error getting image explanation:', error);
      toast.error('Failed to get image explanation');
      setImageExplanation('Failed to get explanation. Please try again.');
    } finally {
      setIsLoadingExplanation(false);
      // Clear the pending flag
      setSelectedDiagram(prev => prev ? { ...prev, pendingExplanation: false } : null);
    }
  };

  const handleImageLoad = () => {
    if (selectedDiagram?.pendingExplanation) {
      setIsLoadingExplanation(true);
      generateImageExplanation();
    }
  };

  const handleImageClick = async (image: ImageSearchResult | SavedImage | ImageResult) => {
    try {
      // Prioritize full resolution image URLs
      const imageUrl = 'originalUrl' in image ? image.originalUrl : image.imageUrl;
      if (!imageUrl) {
        toast.error('No valid image URL found');
        return;
      }

      // Check if image has conversationId (for saved images)
      if ('conversationId' in image && image.conversationId) {
        console.log('Using conversation ID from saved image:', image.conversationId);
        setConversationId(image.conversationId);
      } else {
        // Reset conversation ID for new images
        setConversationId(null);
      }

      console.log('Setting diagram data...');
      setSelectedDiagram({
        url: imageUrl,
        title: image.title,
        thumbnail: image.thumbnailUrl,
        sourceUrl: image.link,
        fileType: 'image',
        link: image.link,
        pendingExplanation: true
      });

      if ('_id' in image && 'explanation' in image && image.explanation) {
        console.log('Using saved explanation');
        const explanationData = typeof image.explanation === 'string' 
          ? image.explanation 
          : (image.explanation as any).explanation || 'No explanation available.';
        setImageExplanation(explanationData);
        setSelectedDiagram(prev => prev ? { ...prev, pendingExplanation: false } : null);
        return;
      }
    } catch (error) {
      console.error('Error handling image click:', error);
      toast.error('Failed to open image');
    }
  };

  const handleSaveImage = async (image: ImageSearchResult) => {
    try {
      // Get the conversation ID from the current diagram if it exists
      const conversationId = selectedDiagram?.conversationId;
      console.log('Saving image with conversation ID:', conversationId || 'none');
      
      const imageData = {
        title: image.title,
        imageUrl: image.imageUrl,
        thumbnailUrl: image.thumbnailUrl,
        source: image.source,
        link: image.link,
        originalUrl: image.imageUrl,
        prompt: "Please explain this automotive diagram or image in detail. Focus on identifying parts, explaining their function, and any technical details visible in the image.",
        conversationId: conversationId
      };
      
      const response = await axiosInstance.post('/response-images', imageData);
      toast.success('Image saved successfully');
      return response.data;
    } catch (error) {
      console.error('Image save error:', error);
      toast.error('Failed to save image');
      throw error;
    }
  };

  // Effects
  useEffect(() => {
    if (initialResults && !researchData) {
        const formattedResults: ResearchResponse = {
            ...initialResults,
            recommendedFixes: (initialResults.recommendedFixes || []).map(fix => ({
                fix: fix.fix,
                difficulty: fix.difficulty as "Easy" | "Moderate" | "Complex",
                estimatedCost: fix.estimatedCost,
                professionalOnly: Boolean(fix.professionalOnly),
                parts: fix.parts?.map(part => ({
                    name: typeof part === 'string' ? part : part.name,
                    partNumber: typeof part === 'string' ? '' : part.partNumber,
                    estimatedPrice: typeof part === 'string' ? '' : part.estimatedPrice,
                    notes: typeof part === 'string' ? '' : part.notes
                })) || [],
                laborTime: fix.laborTime || '',
                specialTools: fix.specialTools || []
            }))
        };
        setResearchData(formattedResults);
    }
}, [initialResults, researchData]);

  // Function to preload all details
  const preloadAllDetails = async () => {
    if (!researchData || isLoading) return;
    setIsLoading(true);
    try {
      const preloadPromises: Promise<void>[] = [];

      researchData.diagnosticSteps?.forEach((step, index) => {
        preloadPromises.push(loadDetail('diagnostic', step, index));
      });
      researchData.possibleCauses?.forEach((cause, index) => {
        preloadPromises.push(loadDetail('causes', cause, index));
      });
      researchData.recommendedFixes?.forEach((fix, index) => {
        preloadPromises.push(loadDetail('fixes', fix, index));
      });

      await Promise.all(preloadPromises);
      toast.success('All detailed information has been preloaded');
    } catch (error) {
      console.error('Error preloading all details:', error);
      toast.error('Failed to preload all details');
    } finally {
      setIsLoading(false);
    }
  };

  // Function to load a single detail
  const loadDetail = async (category: string, item: any, index: number) => {
    const preloadKey = `${category}-${index}`;
    if (preloadedDetails[preloadKey]) return;

    try {
      const response = await axiosInstance.post('/research/detail', {
        vin: selectedVehicle.vin,
        year: selectedVehicle.year,
        make: selectedVehicle.make,
        model: selectedVehicle.model,
        category,
        item,
        originalProblem: problem
      }, {
        timeout: 30000 // Reduce timeout to 30 seconds
      });

      if (response.data?.result) {
        let parsed = typeof response.data.result === 'string' 
          ? JSON.parse(response.data.result) 
          : response.data.result;
        
        setPreloadedDetails(prev => ({
          ...prev,
          [preloadKey]: parsed
        }));
      }
    } catch (error) {
      console.warn(`Failed to preload detail for ${category} ${index}:`, error);
      throw error;
    }
  };

  const handleItemClick = async (category: string, item: any, index: number) => {
    const preloadKey = `${category}-${index}`;
    
    // Open modal first
    setDetailModalOpen(true);
    
    // Check if we already have the data
    if (preloadedDetails[preloadKey]) {
        setDetailData(preloadedDetails[preloadKey]);
        setDetailLoading(false);
        return;
    }

    // If not preloaded, load it
    setDetailLoading(true);
    
    try {
        const response = await axiosInstance.post('/research/detail', {
            vin: selectedVehicle?.vin,
            year: selectedVehicle?.year,
            make: selectedVehicle?.make,
            model: selectedVehicle?.model,
            category,
            item,
            originalProblem: problem
        });

        if (response.data?.result) {
            const parsed = typeof response.data.result === 'string' 
                ? JSON.parse(response.data.result) 
                : response.data.result;
            
            setDetailData(parsed);
            
            // Update preloaded details without triggering a re-render cascade
            setPreloadedDetails(prev => ({
                ...prev,
                [preloadKey]: parsed
            }));
        } else {
            toast.error('No detailed information available.');
        }
    } catch (error) {
        console.error('Detail research error:', error);
        toast.error('Error fetching detailed information. Please try again.');
    } finally {
        setDetailLoading(false);
    }
  };

  // Preload detail info
  useEffect(() => {
    if (researchData && !isLoading) {
      const preloadDetails = async () => {
        try {
          // Preload first item from each category
          const categories = {
            diagnostic: researchData.diagnosticSteps[0],
            causes: researchData.possibleCauses[0],
            fixes: researchData.recommendedFixes[0],
          };

          const preloadPromises = Object.entries(categories).map(async ([category, item]) => {
            if (!item) return null;
            try {
              const response = await axiosInstance.post('/researchl/detail', {
                vin: selectedVehicle.vin,
                year: selectedVehicle.year,
                make: selectedVehicle.make,
                model: selectedVehicle.model,
                category,
                item,
                originalProblem: problem
              });
              if (response.data?.result) {
                return { category, data: response.data.result };
              }
            } catch (error) {
              console.warn(`Preload failed for ${category}:`, error);
              return null;
            }
          });

          const preloadedResults = await Promise.all(preloadPromises);
          const newPreloadedDetails = preloadedResults.reduce((acc, result) => {
            if (result) {
              acc[`${result.category}-0`] = result.data;
            }
            return acc;
          }, {} as Record<string, DetailedResearchResponse>);

          Object.entries(newPreloadedDetails).forEach(([key, value]) => {
            loadDetail(key, value, 0);
          });
        } catch (error) {
          console.warn('Preload details error:', error);
        }
      };

      preloadDetails();
    }
  }, [researchData, isLoading, selectedVehicle, problem]);

  // Rendering for diagnostic steps
  const renderDiagnosticSteps = () => {
    return researchData?.diagnosticSteps?.map((step, index) => (
      <div
        key={index}
        className="mb-4 p-4 text-2xl bg-gray-800 bg-opacity-80 rounded-lg border-l-4 border-blue-500 cursor-pointer hover:bg-gray-700 transition-colors"
        onClick={() => handleItemClick('diagnostic', step, index)}
      >
        <div className="flex items-center justify-between">
          <h4 className="text-lg font-semibold text-blue-400">Step {index + 1}</h4>
          {detailedData[`diagnostic-${index}`] && (
            <span className="text-xl text-green-400">(Detailed info available)</span>
          )}
        </div>
        <p className="text-white mt-2">{step.step}</p>
        <p className="text-gray-300 mt-1">{step.details}</p>
        
        {/* Only render componentLocation if it exists */}
        {(step as any).componentLocation && (
          <div className="mt-2">
            <span className="text-blue-400">Component Location:</span>
            <p className="text-gray-300 ml-4">{(step as any).componentLocation}</p>
          </div>
        )}
        
        {/* Only render connectorInfo if it exists */}
        {(step as any).connectorInfo && (
          <div className="mt-2">
            <span className="text-blue-400">Connector Info:</span>
            <p className="text-gray-300 ml-4">{(step as any).connectorInfo}</p>
          </div>
        )}
        
        {step.tools && (
          <div className="mt-2">
            <span className="text-blue-400">Required Tools:</span>
            <ul className="list-disc list-inside text-gray-300 ml-4">
              {step.tools.map((tool, i) => (
                <li key={i}>{tool}</li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Only render normalValueRanges if it exists */}
        {(step as any).normalValueRanges && (
          <div className="mt-2">
            <span className="text-blue-400">Normal Value Ranges:</span>
            <p className="text-gray-300 ml-4">{(step as any).normalValueRanges}</p>
          </div>
        )}
        
        {/* Only render factoryServiceManualRef if it exists */}
        {(step as any).factoryServiceManualRef && (
          <div className="mt-2">
            <span className="text-blue-400">Service Manual Reference:</span>
            <p className="text-gray-300 ml-4">{(step as any).factoryServiceManualRef}</p>
          </div>
        )}
      </div>
    ));
  };

  const renderPossibleCauses = () => {
    return researchData?.possibleCauses?.map((cause, index) => (
      <div
        key={index}
        className="mb-4 p-4 text-2xl bg-gray-800 bg-opacity-80 rounded-lg border-l-4 border-yellow-500 cursor-pointer hover:bg-gray-700 transition-colors"
        onClick={() => handleItemClick('causes', cause, index)}
      >
        <div className="flex items-center justify-between">
          <h4 className="text-lg font-semibold text-yellow-400">{cause.cause}</h4>
          <div className="flex items-center gap-2">
            {detailedData[`causes-${index}`] && (
              <span className="text-xl text-green-400">(Detailed info available)</span>
            )}
            <span className={`px-2 py-1 rounded text-sm ${
              cause.likelihood === 'High' ? 'bg-red-500' :
              cause.likelihood === 'Medium' ? 'bg-yellow-500' :
              'bg-green-500'
            }`}>
              {cause.likelihood}
            </span>
          </div>
        </div>
        <p className="text-gray-300 mt-2">{cause.explanation}</p>
        
        {/* Display model-specific notes if available using type assertion */}
        {(cause as any).modelSpecificNotes && (
          <div className="mt-2">
            <span className="text-blue-400">Model-Specific Notes:</span>
            <p className="text-gray-300 ml-4">{(cause as any).modelSpecificNotes}</p>
          </div>
        )}
        
        {/* Display common symptoms using the correct property or fall back to type assertion */}
        {(cause.commonSymptoms || (cause as any).commonSymptomsForThisCause) && (
          <div className="mt-2">
            <span className="text-blue-400">Common Symptoms:</span>
            <ul className="list-disc list-inside text-gray-300 ml-4">
              {(cause.commonSymptoms || (cause as any).commonSymptomsForThisCause || []).map((symptom: string, i: number) => (
                <li key={i}>{symptom}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    ));
  };

  const renderRecommendedFixes = () => {
    return researchData?.recommendedFixes?.map((fix, index) => (
      <div
        key={index}
        className="mb-4 p-4 text-2xl bg-gray-800 bg-opacity-80 rounded-lg border-l-4 border-green-500 cursor-pointer hover:bg-gray-700 transition-colors"
        onClick={() => handleItemClick('fixes', fix, index)}
      >
        <div className="flex items-center justify-between">
          <h4 className="text-2xl font-semibold text-green-400">{fix.fix}</h4>
          <div className="flex items-center gap-2">
            {detailedData[`fixes-${index}`] && (
              <span className="text-xl text-green-400">(Detailed info available)</span>
            )}
            <span className={`px-2 py-1 rounded text-sm ${
              fix.difficulty === 'Complex' ? 'bg-red-500' :
              fix.difficulty === 'Moderate' ? 'bg-yellow-500' :
              'bg-green-500'
            }`}>
              {fix.difficulty}
            </span>
          </div>
        </div>
        <div className="mt-2">
          <span className="text-blue-400">Estimated Cost:</span>
          <span className="text-gray-300 ml-2">{fix.estimatedCost}</span>
        </div>
        
        {/* Display labor hours/time properly */}
        {(fix.laborTime || (fix as any).laborHours) && (
          <div className="mt-2">
            <span className="text-blue-400">Labor Hours:</span>
            <span className="text-gray-300 ml-2">{fix.laborTime || (fix as any).laborHours}</span>
          </div>
        )}
        
        {/* Display parts properly with correct type handling */}
        {fix.parts && fix.parts.length > 0 && (
          <div className="mt-2">
            <span className="text-blue-400">Required Parts:</span>
            <ul className="list-disc list-inside text-gray-300 ml-4">
              {fix.parts.map((part, i) => (
                <li key={i}>{typeof part === 'string' ? part : part.name}</li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Display OEM part numbers if available */}
        {(fix as any).oemPartNumbers && (
          <div className="mt-2">
            <span className="text-blue-400">OEM Part Numbers:</span>
            <ul className="list-disc list-inside text-gray-300 ml-4">
              {(fix as any).oemPartNumbers.map((partNumber: string, i: number) => (
                <li key={i}>{partNumber}</li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Display torque specs if available */}
        {(fix as any).torqueSpecs && (
          <div className="mt-2">
            <span className="text-blue-400">Torque Specifications:</span>
            <p className="text-gray-300 ml-4">{(fix as any).torqueSpecs}</p>
          </div>
        )}
        
        {/* Display special tools if available */}
        {fix.specialTools && fix.specialTools.length > 0 && (
          <div className="mt-2">
            <span className="text-blue-400">Special Tools:</span>
            <ul className="list-disc list-inside text-gray-300 ml-4">
              {fix.specialTools.map((tool, i) => (
                <li key={i}>{tool}</li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Display procedure overview if available */}
        {(fix as any).procedureOverview && (
          <div className="mt-2">
            <span className="text-blue-400">Procedure Overview:</span>
            <p className="text-gray-300 ml-4">{(fix as any).procedureOverview}</p>
          </div>
        )}
      </div>
    ));
  };

  const renderTechnicalNotes = () => {
    return (
      <div className="space-y-6 text-2xl">
        {researchData?.technicalNotes?.commonIssues && (
          <div 
            className="mb-4 p-4 text-2xl bg-gray-800 bg-opacity-80 rounded-lg border-l-4 border-purple-500 cursor-pointer hover:bg-gray-700 transition-colors"
            onClick={() => handleItemClick('technical', { section: 'commonIssues', data: researchData.technicalNotes.commonIssues }, 0)}
          >
            <h4 className="text-2xl font-semibold text-purple-400 mb-3">Common Issues</h4>
            <ul className="list-disc list-inside text-gray-300 space-y-2">
              {researchData.technicalNotes.commonIssues.map((issue, index) => (
                <li key={index} className="text-2xl">{issue}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Display manufacturer-specific notes if available */}
        {researchData?.technicalNotes?.manufacturerSpecificNotes && (
          <div 
            className="mb-4 p-4 text-2xl bg-gray-800 bg-opacity-80 rounded-lg border-l-4 border-purple-500 cursor-pointer hover:bg-gray-700 transition-colors"
            onClick={() => handleItemClick('technical', { section: 'manufacturerSpecificNotes', data: researchData.technicalNotes.manufacturerSpecificNotes }, 0)}
          >
            <h4 className="text-2xl font-semibold text-purple-400 mb-3">Manufacturer-Specific Information</h4>
            <p className="text-gray-300">{researchData.technicalNotes.manufacturerSpecificNotes}</p>
          </div>
        )}

        {/* Display known good values if available */}
        {researchData?.technicalNotes?.knownGoodValues && (
          <div 
            className="mb-4 p-4 text-2xl bg-gray-800 bg-opacity-80 rounded-lg border-l-4 border-purple-500 cursor-pointer hover:bg-gray-700 transition-colors"
            onClick={() => handleItemClick('technical', { section: 'knownGoodValues', data: researchData.technicalNotes.knownGoodValues }, 0)}
          >
            <h4 className="text-2xl font-semibold text-purple-400 mb-3">Known Good Values</h4>
            <p className="text-gray-300">{researchData.technicalNotes.knownGoodValues}</p>
          </div>
        )}

        {researchData?.technicalNotes?.serviceIntervals && (
          <div 
            className="mb-4 p-4 text-2xl bg-gray-800 bg-opacity-80 rounded-lg border-l-4 border-purple-500 cursor-pointer hover:bg-gray-700 transition-colors"
            onClick={() => handleItemClick('technical', { section: 'serviceIntervals', data: researchData.technicalNotes.serviceIntervals }, 0)}
          >
            <h4 className="text-2xl font-semibold text-purple-400 mb-3">Service Intervals</h4>
            <ul className="list-disc list-inside text-gray-300 space-y-2">
              {researchData.technicalNotes.serviceIntervals.map((interval, index) => (
                <li key={index} className="text-2xl">{interval}</li>
              ))}
            </ul>
          </div>
        )}

        {researchData?.technicalNotes?.recalls && (
          <div 
            className="mb-4 p-4 text-2xl bg-gray-800 bg-opacity-80 rounded-lg border-l-4 border-purple-500 cursor-pointer hover:bg-gray-700 transition-colors"
            onClick={() => handleItemClick('technical', { section: 'recalls', data: researchData.technicalNotes.recalls }, 0)}
          >
            <h4 className="text-2xl font-semibold text-purple-400 mb-3">Recalls</h4>
            <ul className="list-disc list-inside text-gray-300 space-y-2">
              {researchData.technicalNotes.recalls.map((recall, index) => (
                <li key={index} className="text-2xl">{recall}</li>
              ))}
            </ul>
          </div>
        )}

        {researchData?.technicalNotes?.tsbs && (
          <div 
            className="mb-4 p-4 text-2xl bg-gray-800 bg-opacity-80 rounded-lg border-l-4 border-purple-500 cursor-pointer hover:bg-gray-700 transition-colors"
            onClick={() => handleItemClick('technical', { section: 'tsbs', data: researchData.technicalNotes.tsbs }, 0)}
          >
            <h4 className="text-2xl font-semibold text-purple-400 mb-3">
              Technical Service Bulletins
            </h4>
            <ul className="list-disc list-inside text-gray-300 space-y-2">
              {researchData.technicalNotes.tsbs.map((tsb, index) => (
                <li key={index} className="text-2xl">{tsb}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  const renderReferences = () => {
    return (
      <div className="space-y-4">
        {researchData?.references?.map((reference, index) => (
          <div
            key={index}
            className="mb-4 p-4 text-2xl bg-gray-800 bg-opacity-80 rounded-lg border-l-4 border-blue-500 cursor-pointer hover:bg-gray-700 transition-colors"
          >
            <h4 className="text-2xl font-semibold text-purple-400">{reference.source || 'Unknown Source'}</h4>
            <div className="mt-1 text-2xl text-gray-300">{reference.type || 'Unknown Type'}</div>
            
            {reference.documentNumber && (
              <div className="mt-1 text-2xl">
                <span className="text-blue-400 text-2xl">Document #:</span>
                <span className="text-gray-300 ml-2 text-2xl">{reference.documentNumber}</span>
              </div>
            )}
            
            <div className="mt-1 text-2xl">
              <span className="text-blue-400 text-2xl">Relevance:</span>
              <span className="text-gray-300 ml-2 text-2xl">{reference.relevance || 'Not specified'}</span>
            </div>
            
            {reference.url && (
              <a
                href={reference.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-blue-400 hover:text-blue-300 text-2xl"
              >
                Visit Source →
              </a>
            )}
          </div>
        ))}
      </div>
    );
  };

  // Add function to fetch saved images
  const fetchSavedImages = async () => {
    try {
      const response = await axiosInstance.get('/response-images');
      setSavedImages(response.data);
    } catch (error) {
      console.error('Error fetching saved images:', error);
      toast.error('Failed to load saved images');
    }
  };

  // Add useEffect to load saved images on component mount
  useEffect(() => {
    fetchSavedImages();
  }, []);

  // Update handleCustomImageSearch
  const handleCustomImageSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customImageSearch.trim() || !selectedVehicle) return;
    
    try {
      const results = await searchImages(customImageSearch);
      
      if (results.length > 0) {
        setIsImageSearchModalOpen(true);
        setCurrentImageIndex(0);
        toast.success(`Found ${results.length} images`);
      }
      setCustomImageSearch('');
    } catch (error) {
      console.error('Custom image search error:', error);
      toast.error('Search failed. Please try again.');
    }
  };

  // Add delete function for saved images
  const handleDeleteImage = async (imageId: string) => {
    try {
      await axiosInstance.delete(`/response-images/${imageId}`);
      toast.success('Image deleted successfully');
      // Refresh the saved images list
      fetchSavedImages();
    } catch (error) {
      console.error('Error deleting image:', error);
      toast.error('Failed to delete image');
    }
  };

  // Add useEffect to fetch saved images when modal opens
  useEffect(() => {
    if (isImageSearchModalOpen) {
        fetchSavedImages();
    }
  }, [isImageSearchModalOpen]);

  const handleModalImageClick = (image: SavedImage) => {
    console.log('Image clicked from modal, conversation ID:', image.conversationId || 'none');
    
    handleImageClick({
      ...image, 
      // Explicitly extract conversationId from the saved image
      conversationId: image.conversationId
    });
  };

  // Function to handle zoom changes
  const handleZoomIn = () => {
    setImageZoom(prev => Math.min(prev + 0.5, 6));
  };

  const handleZoomOut = () => {
    setImageZoom(prev => Math.max(prev - 0.5, 1));
  };

  const generateImageExplanation = async () => {
    try {
      if (selectedDiagram && selectedDiagram.url) {
        console.log('Generating explanation for image with conversation ID:', conversationId || 'none');
        await getImageExplanation(selectedDiagram.url, selectedDiagram.title || 'Vehicle Diagram');
      }
    } catch (error) {
      console.error('Error generating image explanation:', error);
      setIsLoadingExplanation(false);
    }
  };

  // Function to handle uploaded image
  const handleImageUpload = async (file: File) => {
    try {
      setIsUploadingImage(true);
      toast.loading('Processing your image...');
      
      // Convert file to base64
      const reader = new FileReader();
      
      // Create a promise to handle the FileReader async operation
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
      });
      
      reader.readAsDataURL(file);
      const base64Image = await base64Promise;
      
      // Generate a unique ID and timestamp for consistent metadata
      const uniqueId = `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const timestamp = new Date().toISOString();
      const fileName = file.name || 'Uploaded Image';
      
      // Resize image before processing
      const resizedImage = await resizeImageIfNeeded(base64Image, 1200); // Max width 1200px
      
      // Create consistent metadata like search results
      const imageMetadata: {
        title: string;
        imageUrl: string;
        thumbnailUrl: string;
        source: string;
        link: string;
        _id: string;
        timestamp: string;
        originalUrl: string;
        contentType: string;
        relevanceScore: number;
        explanation?: string;
        conversationId?: string;
      } = {
        title: fileName,
        imageUrl: resizedImage,
        thumbnailUrl: resizedImage,
        source: 'User Upload',
        link: '',
        _id: uniqueId,
        timestamp: timestamp,
        originalUrl: resizedImage,
        contentType: file.type,
        relevanceScore: 10 // Higher relevance for user uploads
      };
      
      // Set diagram data with uploaded image
      setSelectedDiagram({
        url: resizedImage,
        title: fileName,
        thumbnail: resizedImage,
        sourceUrl: '',
        fileType: file.type,
        link: '',
        pendingExplanation: true
      });
      
      // Send to explain-image endpoint
      const imageData = {
        ...imageMetadata,
        prompt: "You are an automotive expert. Please explain this automotive diagram or image in detail. Focus on identifying parts, explaining their function, and any technical details visible in the image. Include how to locate the components and test the components."
      };
      
      const response = await axiosInstance.post('/openai/explain-image', imageData);
      
      if (response.data) {
        // Extract explanation from the API response format
        // Backend returns explanation in either explanation or output_text field
        const explanation = response.data.explanation || response.data.output_text || 'No explanation available.';
        
        // Add the explanation to the metadata
        const updatedMetadata = {
          ...imageMetadata,
          explanation: explanation
        };
        
        // Update the explanation state
        setImageExplanation(explanation);
        
        // Store conversation ID if available, or use responseId as fallback
        if (response.data.conversationId) {
          console.log('Storing conversation ID from upload:', response.data.conversationId);
          setConversationId(response.data.conversationId);
          
          // Also include conversation ID in the saved metadata
          updatedMetadata.conversationId = response.data.conversationId;
        }
        else if (response.data.conversation_id) {
          console.log('Found conversation_id in response:', response.data.conversation_id);
          setConversationId(response.data.conversation_id);
          
          // Include the conversation_id in the saved metadata
          updatedMetadata.conversationId = response.data.conversation_id;
        }
        else if (response.data.responseId) {
          // Use responseId as a fallback
          setConversationId(response.data.responseId);
          console.log('No conversationId in response, using responseId instead:', response.data.responseId);
          
          // Include the responseId as conversationId in the saved metadata
          updatedMetadata.conversationId = response.data.responseId;
        }
        else {
          console.warn('No conversationId or responseId found in response:', response.data);
        }
        
        // Optionally save the image with metadata to saved images
        try {
          const saveResponse = await axiosInstance.post('/response-images', updatedMetadata);
          // Add to saved images if save was successful
          if (saveResponse.data) {
            fetchSavedImages(); // Refresh saved images list
          }
        } catch (saveError) {
          console.error('Error saving uploaded image:', saveError);
          // Don't block the main flow if saving fails
        }
        
        toast.dismiss();
        toast.success('Image processed successfully');
      } else {
        toast.dismiss();
        toast.error('Failed to process image');
      }
    } catch (error) {
      console.error('Error uploading and processing image:', error);
      toast.dismiss();
      toast.error('Failed to process image');
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Helper function to resize image if needed
  const resizeImageIfNeeded = (dataUrl: string, maxWidth: number): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        // Only resize if image is larger than maxWidth
        if (img.width <= maxWidth) {
          resolve(dataUrl);
          return;
        }
        
        // Calculate new dimensions while maintaining aspect ratio
        const ratio = maxWidth / img.width;
        const newWidth = maxWidth;
        const newHeight = img.height * ratio;
        
        // Create canvas and resize
        const canvas = document.createElement('canvas');
        canvas.width = newWidth;
        canvas.height = newHeight;
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          ctx.drawImage(img, 0, 0, newWidth, newHeight);
          // Get the resized image as dataURL
          const resizedDataUrl = canvas.toDataURL(
            // Try to keep original format if possible
            dataUrl.startsWith('data:image/png') ? 'image/png' : 
            dataUrl.startsWith('data:image/gif') ? 'image/gif' : 
            'image/jpeg', 
            0.9 // Quality for jpg
          );
          resolve(resizedDataUrl);
        } else {
          // If can't get context, return original
          resolve(dataUrl);
        }
      };
      
      img.onerror = () => {
        // If error, return original
        resolve(dataUrl);
      };
      
      img.src = dataUrl;
    });
  };

  // Handle follow-up questions to images
  const handleFollowUpQuestion = async (imageUrl: string, question: string) => {
    if (!question.trim()) {
      toast.error('Please enter a question');
      return;
    }

    // Check if this is a technical vehicle question (not directly related to the image)
    const isTechnicalQuestion = 
      question.toLowerCase().includes('specification') ||
      question.toLowerCase().includes('spec') ||
      question.toLowerCase().includes('torque') ||
      question.toLowerCase().includes('tsb') ||
      question.toLowerCase().includes('bulletin') ||
      question.toLowerCase().includes('part number') ||
      question.toLowerCase().includes('procedure');

    if (isTechnicalQuestion && selectedVehicle) {
      // Use the vehicle-question endpoint instead of image explanation follow-up
      try {
        setIsAskingFollowUp(true);
        setIsLoadingFollowUp(true);
        
        const answer = await askVehicleQuestion(question);
        
        setFollowUpAnswer(answer);
        // Don't append to image explanation for technical questions
        
        toast.success('Technical information retrieved');
      } catch (error) {
        console.error('Error with technical question:', error);
        setFollowUpAnswer('Error processing your technical question. Please try again.');
        toast.error('Technical question failed');
      } finally {
        setIsAskingFollowUp(false);
        setIsLoadingFollowUp(false);
      }
      return;
    }

    // Handle image-related follow-up as before
    if (!conversationId) {
      toast.error('No conversation context available. Please try refreshing the explanation.');
      return;
    }

    try {
      setIsAskingFollowUp(true);
      setIsLoadingFollowUp(true);
      toast.loading('Getting answer...');
      
      const followUpData = {
        imageUrl: imageUrl,
        question: question,
        conversationId: conversationId,
        context: {
          vehicleYear: selectedVehicle?.year,
          vehicleMake: selectedVehicle?.make,
          vehicleModel: selectedVehicle?.model,
          vehicleEngine: selectedVehicle?.engine
        }
      };
      
      console.log('Sending follow-up with conversation ID:', conversationId);
      const response = await axiosInstance.post('/openai/explain-image/follow-up', followUpData);
      
      toast.dismiss();
      if (response.data && (response.data.answer || response.data.output_text)) {
        const answer = response.data.answer || response.data.output_text;
        setFollowUpAnswer(answer);
        
        // Append to the existing explanation for conversation history
        setImageExplanation(prev => {
          const separator = prev ? '\n\nQ: ' + question + '\n\nA: ' : '';
          return prev + separator + answer;
        });
        
        // Update conversation ID if it changed
        if (response.data.conversationId) {
          setConversationId(response.data.conversationId);
          console.log('Updated conversation ID:', response.data.conversationId);
        } else if (response.data.conversation_id) {
          // Check for conversation_id (from OpenAI format)
          setConversationId(response.data.conversation_id);
          console.log('Updated conversation_id as conversation ID:', response.data.conversation_id);
        } else if (response.data.responseId) {
          // Use responseId as a fallback
          setConversationId(response.data.responseId);
          console.log('Updated to responseId as conversation ID:', response.data.responseId);
        }
        
        toast.success('Got answer');
      } else {
        setFollowUpAnswer('Sorry, I couldn\'t answer that question about the image.');
        toast.error('Failed to get a clear answer');
      }
    } catch (error) {
      console.error('Error with follow-up question:', error);
      toast.dismiss();
      toast.error('Failed to process your question');
      setFollowUpAnswer('Error processing your question. Please try again.');
    } finally {
      setIsAskingFollowUp(false);
      setIsLoadingFollowUp(false);
    }
  };

  // Helper function to fetch images
  const fetchImages = async (
    query: string,
    type: 'diagram' | 'part' | 'repair' = 'diagram'
  ): Promise<ImageResult[]> => {
    try {
      if (!selectedVehicle) {
        toast.error('Please select a vehicle first');
        return [];
      }

      const cleanedQuery = query.trim();
      
      // Show loading toast
      const loadingToast = toast.loading('Searching for images...');
      
      // Send complete vehicle info to backend
      const response = await axiosInstance.post('/serper/images', {
        query: cleanedQuery,
        num: 30,
        vehicleInfo: {
          year: selectedVehicle.year,
          make: selectedVehicle.make,
          model: selectedVehicle.model,
          engine: selectedVehicle.engine || undefined
        }
      });

      // Dismiss loading toast
      toast.dismiss(loadingToast);

      if (response.data?.images?.length > 0) {
        // Use the results directly from the backend
        setSearchResults(response.data.images);
        return response.data.images;
      } else {
        // Show helpful message when no results found
        toast.error(
          'No relevant images found. Try:\n' +
          '• Being more specific (e.g. "timing belt diagram" instead of just "belt")\n' +
          '• Including the component name (e.g. "water pump location")\n' +
          '• Adding terms like "diagram", "schematic", or "layout"'
        );
        return [];
      }
    } catch (error: unknown) {
      const typedError = error as ImageSearchError;
      const errorMessage = typedError.response?.data?.message || typedError.message || 'Failed to search for images';
      toast.error(errorMessage);
      return [];
    }
  };
  
  // New method to ask vehicle-specific questions using the new endpoint
  const askVehicleQuestion = async (question: string, dtcCode?: string): Promise<string> => {
    if (!selectedVehicle) {
      toast.error('No vehicle selected');
      return 'Please select a vehicle first';
    }
    
    try {
      setIsLoadingFollowUp(true);
      toast.loading('Getting expert answer...');
      
      const response = await axiosInstance.post('/research/vehicle-question', {
        vin: selectedVehicle.vin,
        year: selectedVehicle.year,
        make: selectedVehicle.make,
        model: selectedVehicle.model,
        dtcCode: dtcCode,
        question: question,
        trim: selectedVehicle.trim,
        engine: selectedVehicle.engine,
        transmission: selectedVehicle.transmission,
        mileage: selectedVehicle.mileage,
        includeHistory: true
      });
      
      toast.dismiss();
      if (response.data?.result) {
        toast.success('Got expert answer');
        return response.data.result;
      } else {
        toast.error('Failed to get answer');
        return 'Sorry, I could not answer that question about the vehicle.';
      }
    } catch (error) {
      console.error('Error asking vehicle question:', error);
      toast.dismiss();
      toast.error('Failed to process your question');
      return 'Error processing your question. Please try again.';
    } finally {
      setIsLoadingFollowUp(false);
    }
  };

  return (
    <>
    <div className="p-4 pb-20 text-2xl">
      {/* Content grid with main column */}
      <div className="flex flex-col gap-4">
        {/* Top section with grid */}
        <div className="grid grid-cols-12 gap-6">
          {/* Customer Context - 2 columns */}
          <div className="col-span-3 ">
            <CustomerContextDisplay />
          </div>
          
          {/* Middle section - 8 columns */}
          <div className="col-span-9 flex flex-col gap-4 bg-opacity-50 ">
        
            <div className="w-full flex-1 rounded-lg  border-l-4 border-green-500">
              <TranscriptProvider>
                <EventProvider>
                <AppointmentsPage />
                  <App />
                </EventProvider>
              </TranscriptProvider>
            </div>
          </div>

          {/* Right spacing for image area - 2 columns */}
          <div className="col-span-2"></div>
        </div>

        {/* Image search section - fixed on right side */}
        <div className="fixed right-[1vw] w-[13vw] h-[78vh] bg-opacity-50  border-l-4 border-green-400 bg-gray-800 shadow-xl z-10 rounded-lg flex flex-col">
          <div className="p-4 border-b border-gray-600">
            <form onSubmit={handleCustomImageSearch} className="flex flex-col gap-2">
              <input
                type="text"
                value={customImageSearch}
                onChange={(e) => setCustomImageSearch(e.target.value)}
                placeholder={selectedVehicle ? 
                  `Search ${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}` : 
                  "Select a vehicle first"}
                className="w-full p-2 text-center bg-gray-600 text-white rounded-lg text-2xl focus:ring-2 focus:ring-blue-500"
                disabled={!selectedVehicle}
              />
              <Button 
                type="submit" 
                disabled={!selectedVehicle || !customImageSearch.trim()}
                className="text-2xl text-white w-full"
              >
                <Search className="mr-2" />
                Search
              </Button>
            </form>
            
            {/* Add DropZone component here */}
            <div className="mt-4  border-r-4 border-l-4 border-blue-500">
              <h4 className="text-white text-xl mb-2 font-bold text-center">Upload your own image</h4>
              <DropZone onImageUpload={handleImageUpload} />
            </div>
          </div>
          <div className="flex-1  overflow-y-auto p-4">
            <div className="space-y-4 ">
              {savedImages
                .sort((a, b) => {
                  // Sort by timestamp in descending order (newest first)
                  const timestampA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
                  const timestampB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
                  return timestampB - timestampA;
                })
                .slice(0, 15) // Only display the 15 most recent images
                .map((image, index) => (
                <div 
                  key={index}
                  className="bg-gray-900 bg-opacity-50 rounded-lg border-l-4 border-r-4 border-blue-500 p-2 cursor-pointer hover:bg-gray-800"
                  onClick={() => handleModalImageClick(image)}
                >
                  <div className="relative w-full h-48">
                    <img
                      src={getImageUrl(image.imageUrl)}
                      alt={image.title}
                      className="w-full text-xl h-full object-contain rounded"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        console.log("Image load error, trying alternates:", image.title);
                        
                        // Try alternate image sources
                        if (image.thumbnailUrl) {
                          target.src = getImageUrl(image.thumbnailUrl);
                        } else if (image.link) {
                          target.src = getImageUrl(image.link);
                        } else {
                          // If no alternates, use the default handler
                          handleImageError(e);
                        }
                      }}
                    />
                  </div>
                  <p className="mt-2 text-white text-2xl truncate font-semibold">{image.title}</p>
                  <div className="flex justify-between items-center">
                    <p className="text-gray-400 text-2xl font-semibold">
                      Saved: {image.timestamp ? new Date(image.timestamp).toLocaleDateString() : 'Unknown date'}
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteImage(image._id);
                      }}
                      className="p-1 text-red-500 hover:bg-gray-700 rounded"
                      title="Delete Image"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
       
        {/* Research results grid - Always visible */}
        <div className="mt-6">
          <div className="grid grid-cols-5 gap-4 h-[80vh] overflow-y-auto">
            {/* Diagnostic Steps Column */}
            <div className="bg-gray-800 bg-opacity-50 rounded-lg p-4 overflow-y-auto border-l-4 border-blue-500">
              <h3 className="text-2xl font-bold text-yellow-300 mb-4 sticky top-0 bg-gray-800 py-2 z-10">Diagnostic Steps</h3>
              <div className="space-y-4">
                {researchData ? renderDiagnosticSteps() : (
                  <div className="text-gray-400 text-center p-4">
                    No diagnostic steps available yet. Select a vehicle and problem to begin research.
                  </div>
                )}
              </div>
            </div>

            {/* Possible Causes Column */}
            <div className="bg-gray-800 bg-opacity-50 rounded-lg p-4  overflow-y-auto border-l-4  border-green-500">
              <h3 className="text-2xl font-bold text-yellow-300 mb-4 sticky top-0 bg-gray-800 py-2 z-10">Possible Causes</h3>
              <div className="space-y-4">
                {researchData ? renderPossibleCauses() : (
                  <div className="text-gray-400 text-center p-4">
                    No possible causes identified yet. Select a vehicle and problem to begin research.
                  </div>
                )}
              </div>
            </div>

            {/* Recommended Fixes Column */}
            <div className="bg-gray-800 bg-opacity-50 rounded-lg p-4 overflow-y-auto border-l-4  border-blue-500">
              <h3 className="text-2xl font-bold text-yellow-300 mb-4 sticky top-0 bg-gray-800 py-2 z-10">Recommended Fixes</h3>
              <div className="space-y-4">
                {researchData ? renderRecommendedFixes() : (
                  <div className="text-gray-400 text-center p-4">
                    No recommended fixes available yet. Select a vehicle and problem to begin research.
                  </div>
                )}
              </div>
            </div>

            {/* Technical Notes Column */}
            <div className="bg-gray-800 bg-opacity-50 rounded-lg p-4 overflow-y-auto border-l-4  border-green-500">
              <h3 className="text-2xl font-bold text-yellow-300 mb-4 sticky top-0 bg-gray-800 py-2 z-10">Technical Notes</h3>
              <div className="space-y-4">
                {researchData ? renderTechnicalNotes() : (
                  <div className="text-gray-400 text-center p-4">
                    No technical notes available yet. Select a vehicle and problem to begin research.
                  </div>
                )}
              </div>
            </div>

            {/* References Column */}
            <div className="bg-gray-800 bg-opacity-50 rounded-lg p-4 overflow-y-auto border-l-4 border-blue-500">
              <h3 className="text-2xl font-bold text-yellow-300 mb-4 sticky top-0 bg-gray-800 py-2 z-10">References</h3>
              <div className="space-y-4">
                {researchData ? renderReferences() : (
                  <div className="text-gray-400 text-center p-4">
                    No references available yet. Select a vehicle and problem to begin research.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Diagnostic Stepper */}
        {researchData?.diagnosticSteps && researchData.diagnosticSteps.length > 0 && (
          <div className="mt-6 bg-gray-800 bg-opacity-50 rounded-lg p-4 border-l-4 border-r-4 border-blue-500">
            <h3 className="text-2xl font-bold text-yellow-300 mb-4">Diagnostic Procedure</h3>
            <VerticalLinearStepper 
              diagnosticSteps={researchData.diagnosticSteps.map((step, index) => ({
                ...step,
                id: `step-${index}`
              }))}
              onStepComplete={(stepIndex: number, testResults: any) => {
                // Handle step completion
                console.log(`Step ${stepIndex + 1} completed with results:`, testResults);
              }}
            />
          </div>
        )}
      </div>

      {/* Modals */}
      <DetailModal
        isOpen={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false);
          setSelectedDetailKey(null);
          setCurrentDetailData(null);
        }}
        loading={detailLoading}
        data={currentDetailData}
      />

      {/* Image Search Modal */}
      <ImageSearchModal
        isOpen={isImageSearchModalOpen}
        onClose={() => setIsImageSearchModalOpen(false)}
        savedImages={savedImages}
        onImageClick={handleModalImageClick}
        onDeleteImage={handleDeleteImage}
        isLoadingSavedImages={isLoadingSavedImages}
      />

      {/* Image Viewer Modal with Follow-up Question support */}
      {selectedDiagram && (
        <Imagemodal
          open={!!selectedDiagram}
          onClose={() => {
            setSelectedDiagram(null);
            setImageExplanation('');
            setImageZoom(3.5); // Reset zoom when closing
            setConversationId(null); // Clear conversation ID when closing
          }}
          explanation={imageExplanation}
          isLoadingExplanation={isLoadingExplanation}
          onAskFollowUp={(question) => handleFollowUpQuestion(selectedDiagram.url, question)}
          selectedDiagram={selectedDiagram}
          conversationId={conversationId}
          isLoadingFollowUp={isLoadingFollowUp || isAskingFollowUp}
        >
          <div className="relative w-full h-full flex items-center justify-center">
            <div className="absolute top-4 left-4 z-50 flex space-x-2">
              <button 
                onClick={handleZoomOut}
                className="bg-gray-800 text-red-500 rounded-full w-20 h-20 flex items-center justify-center text-3xl"
              >
                -
              </button>
              <button 
                onClick={handleZoomIn}
                className="bg-gray-800 text-green-400 rounded-full w-20 h-20 flex items-center justify-center text-3xl"
              >
                +
              </button>
            </div>
            
            <img 
              src={getImageUrl(selectedDiagram.url)}
              alt={selectedDiagram.title}
              className="object-contain"
              style={{ 
                maxWidth: "100%", 
                maxHeight: "100%", 
                width: "auto", 
                height: "auto",
                transform: `scale(${imageZoom})` // Use the zoom state variable
              }}
              onLoad={handleImageLoad}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                console.log("Image load error, trying alternates:", selectedDiagram.title);
                toast.error("Image failed to load. Trying alternate source...");
                
                // Try the original URL first if available
                if (selectedDiagram.link && selectedDiagram.link !== selectedDiagram.url) {
                  console.log("Using link as alternate source");
                  target.src = getImageUrl(selectedDiagram.link);
                } 
                // Try thumbnail as a second option
                else if (selectedDiagram.thumbnail) {
                  console.log("Using thumbnail as fallback");
                  target.src = getImageUrl(selectedDiagram.thumbnail);
                }
                // If all alternates fail, apply the default error handler on the next error
                else {
                  handleImageError(e);
                }
                
                // Set up a final fallback in case the alternate sources also fail
                target.onerror = (finalError) => handleImageError(finalError as any);
              }}
            />
            <div className="absolute bottom-0 left-0 right-0 bg-gray-900 bg-opacity-90 p-4 rounded-b-lg">
              <p className="text-3xl text-white font-semibold">{selectedDiagram.title}</p>
              {selectedDiagram.sourceUrl && (
                <a
                  href={selectedDiagram.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-blue-400 hover:text-blue-300 text-3xl mt-2"
                >
                  <ExternalLink size={16} className="mr-2" />
                  View Source
                </a>
              )}
            </div>
          </div>
        </Imagemodal>
      )}
    </div>

    <div className="col-span-2 flex flex-col space-y-8 mt-4">
      <div className="w-full bg-gray-800 bg-opacity-50 rounded-lg shadow-md">
      </div>
      <div className="w-full bg-gray-800 bg-opacity-50 rounded-lg shadow-md">
       
      </div>  
    </div>  
    </>
  );
};

export default VehicleResearch;
  