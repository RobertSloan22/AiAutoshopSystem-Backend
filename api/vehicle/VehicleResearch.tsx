// src/components/VehicleResearch.tsx
import React, { useState, useEffect } from 'react';
import { useCustomer } from '../../context/CustomerContext';
import axiosInstance from '../../utils/axiosConfig';
import { toast } from 'react-hot-toast';
import { Button } from '../ui/button';
import { useResearch, ResearchResponse, EnhancedPart } from '../../context/ResearchContext';
import { ImageSearchModal } from './ImageSearchModal';
import { Imagemodal } from './Imagemodal';
import { Save, Search, ExternalLink, Trash2 } from 'lucide-react';
import { CustomerContextDisplay } from "../../components/customer/CustomerContextDisplay";
import { AppointmentsPage } from "../../components/assistant/AppointmentsPage";
import { App } from '../../app/src/app/App';
import { TranscriptProvider } from '../../app/src/app/contexts/TranscriptContext';
import { EventProvider } from '../../app/src/app/contexts/EventContext';
import OpenAI from 'openai';
import Image from 'next/image';
//This is the component for researching vehicle data and dtc information, that will collect images related to the dtc 

//Type Interface's 
interface IntrinsicAttributes{
  isOpen?: boolean;
}


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
  additionalResources?: Array<{
    title: string;
    url?: string;
    description: string;
  }>;
  url?: string;
  fileType?: string;
  thumbnail?: string;
  sourceUrl?: string;
  link?: string;
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



interface ImageSearchResult {
  title: string;
  imageUrl: string;
  thumbnailUrl: string;
  source: string;
  link: string;
}

interface ImageModalProps {
  isOpen?: boolean;
}

// Add new interface for saved images
interface SavedImage extends ImageResult {
  _id: string;
  timestamp: string;
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
    
    // Always use proxy in electron environment
    if (window.electron && !cleanUrl.startsWith('data:')) {
      const proxyUrl = `${axiosInstance.defaults.baseURL}/proxy-image?url=${encodeURIComponent(cleanUrl)}`;
      return proxyUrl;
    }
    
    return cleanUrl;
  } catch (error) {
    console.error('Error processing image URL:', error);
    return '';
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

            {data?.additionalResources && (
              <div className="bg-gray-800 p-4 rounded-lg">
                <h4 className="text-blue-400 text-xl mb-2">Additional Resources</h4>
                <div className="space-y-3">
                  {data.additionalResources.map((resource, index) => (
                    <div key={index} className="border-l-4 border-blue-500 pl-4">
                      <h5 className="text-white text-lg font-semibold">{resource.title}</h5>
                      <p className="text-gray-300">{resource.description}</p>
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

const VehicleResearch: React.FC<VehicleResearchProps> = ({ initialResults }): JSX.Element => {
  const { selectedCustomer, selectedVehicle } = useCustomer();
  const {
    problem,
    setProblem,
    researchData,
    setResearchData,
    detailedData,
    loadDetail,
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

  // Image handling functions
  const openImagesInModal = (images: ImageResult[]) => {
    setModalImages(images);
    setImageModalOpen(true);
  };

  const getImageExplanation = async (imageUrl: string) => {
    setIsLoadingExplanation(true);
    try {
      // Extract original URL if it's a proxied URL
      let originalUrl = imageUrl;
      if (imageUrl.includes('/proxy-image?')) {
        const urlParams = new URLSearchParams(imageUrl.split('?')[1]);
        originalUrl = urlParams.get('url') || imageUrl;
      }

      const response = await axiosInstance.post('/openai/explain-image', {
        imageUrl: originalUrl,
        prompt: "Please explain this automotive diagram or image in detail. Focus on identifying parts, explaining their function, and any technical details visible in the image. Include location and how to test electrical components."
      });

      if (response.data.status === 'success' && response.data.explanation) {
        setImageExplanation(response.data.explanation);
        console.log('Usage stats:', response.data.usage);
      } else {
        setImageExplanation('No explanation available.');
      }
    } catch (error) {
      console.error('Error getting image explanation:', error);
      toast.error('Failed to get image explanation');
      setImageExplanation('Failed to get explanation. Please try again.');
    } finally {
      setIsLoadingExplanation(false);
    }
  };

  const handleImageClick = async (image: SavedImage) => {
    try {
      // Get the best available URL
      const imageUrl = image.imageUrl || image.thumbnailUrl || image.link;
      if (!imageUrl) {
        toast.error('No valid image URL found');
        return;
      }

      // Set the selected diagram with all available information
      setSelectedDiagram({
        url: imageUrl,
        title: image.title || 'Untitled',
        thumbnail: image.thumbnailUrl || '',
        sourceUrl: image.link || image.source || '',
        fileType: 'image',
        link: image.link || ''
      });

      // Get explanation for the image using the original URL
      setIsLoadingExplanation(true);
      await getImageExplanation(image.link || imageUrl);
    } catch (error) {
      console.error('Error handling image click:', error);
      toast.error('Failed to open image');
    }
  };

  const handleSaveImage = async (image: ImageSearchResult) => {
    try {
      const imageData = {
        title: image.title,
        imageUrl: image.imageUrl,
        thumbnailUrl: image.thumbnailUrl,
        source: image.source,
        link: image.link,
        timestamp: new Date().toISOString(),
        vehicleInfo: {
          year: selectedVehicle?.year,
          make: selectedVehicle?.make,
          model: selectedVehicle?.model,
          vin: selectedVehicle?.vin
        }
      };
      
      const response = await axiosInstance.post('/images', imageData);
      toast.success('Image saved successfully');
      return response.data;
    } catch (error) {
      console.error('Image save error:', error);
      toast.error('Failed to save image');
      throw error;
    }
  };

  const handleSaveAndViewImage = async (image: ImageSearchResult) => {
    try {
      // First save the image
      const savedImage = await handleSaveImage(image);
      // Then view the saved image
      if (savedImage) {
        handleImageClick(savedImage);
      }
    } catch (error) {
      console.error('Error saving and viewing image:', error);
      toast.error('Failed to save and view image');
    }
  };

  const searchImages = async (
    query: string,
    type: 'diagram' | 'part' | 'repair' = 'diagram'
  ): Promise<ImageResult[]> => {
    try {
      if (!selectedVehicle) {
        console.warn('No vehicle selected for image search');
        return [];
      }

      const cleanedQuery = query.trim();
      const vehicleTerms = `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}`;
      const typeTerms = {
        diagram: ['diagram', 'schematic', 'layout'],
        part: ['part', 'component', 'assembly'],
        repair: ['repair', 'procedure', 'fix']
      }[type];

      const enhancedQuery = `${vehicleTerms} ${cleanedQuery} ${typeTerms.join(' ')}`;

      console.log('Sending search request with query:', enhancedQuery);

      const response = await axiosInstance.post('/serper/images', {
        query: enhancedQuery,
        num: 30,
        vehicleInfo: {
          year: selectedVehicle.year,
          make: selectedVehicle.make,
          model: selectedVehicle.model,
          engine: selectedVehicle.engine || ''
        }
      });

      if (response.data?.images?.length > 0) {
        const results = response.data.images;
        console.log('Search metadata:', response.data.metadata);

        const mappedResults = results
          .map((img: any) => ({
            title: img.title || 'Untitled',
            imageUrl: img.link || img.imageUrl || img.url,
            thumbnailUrl: img.thumbnail || img.thumbnailUrl,
            source: img.source || '',
            link: img.link || img.url || '',
            relevanceScore: img.relevanceScore || 0,
            timestamp: new Date().toISOString()
          }))
          .filter((img: ImageResult) => {
            const url = (img.imageUrl || '').toLowerCase();
            return !url.endsWith('.html') && !url.endsWith('.htm');
          });

        setSearchResults(mappedResults);
        return mappedResults;
      }
      return [];
    } catch (error) {
      console.error('Image search error:', error);
      toast.error('Failed to search for images');
      return [];
    }
  };

  const getRelevanceScore = (result: ImageResult): number => {
    const title = (result.title || '').toLowerCase();
    const link = (result.link || '').toLowerCase();
    const source = (result.source || '').toLowerCase();
    const allText = `${title} ${link} ${source}`;
    
    let score = 0;
    
    if (selectedVehicle) {
      const vehicleYear = selectedVehicle.year.toString();
      const vehicleMake = selectedVehicle.make.toLowerCase();
      const vehicleModel = selectedVehicle.model.toLowerCase();
      
      if (allText.includes(vehicleYear)) score += 3;
      if (allText.includes(vehicleMake)) score += 3;
      if (allText.includes(vehicleModel)) score += 3;
    }
    
    return score;
  };

  // Effects
  useEffect(() => {
    if (initialResults) {
      const formattedResults: ResearchResponse = {
        ...initialResults,
        recommendedFixes: initialResults.recommendedFixes.map(fix => ({
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
  }, [initialResults]);

  // Helper function to fetch images
  const fetchImages = async (
    query: string,
    type: 'diagram' | 'part' | 'repair' = 'diagram'
  ): Promise<ImageResult[]> => {
    try {
      const response = await axiosInstance.post('/serper/images', {
        query: `${query} ${type}`,
        num: 5,
      });
      if (response.data.images?.length > 0) {
        const results = response.data.images;
        setSearchResults(results);
        return results.map((img: any) => ({
          title: img.title,
          imageUrl: img.link,
          thumbnailUrl: img.thumbnail,
          source: '', // add if available
          link: img.thumbnail,
        }));
      }
      return [];
    } catch (error) {
      console.error('Error fetching images for query:', query, error);
      return [];
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
              const response = await axiosInstance.post('/research/detail', {
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

  const handleItemClick = async (category: string, item: any, index: number) => {
    const detailKey = `${category}-${index}`;
    setSelectedDetailKey(detailKey);
    setDetailModalOpen(true);

    // If we already have the data, use it
    if (detailedData[detailKey]) {
      setCurrentDetailData(detailedData[detailKey]);
      return;
    }

    // Otherwise, load it
    setDetailLoading(true);
    try {
      await loadDetail(category, item, index);
      setCurrentDetailData(detailedData[detailKey]);
    } catch (error) {
      console.error('Error loading detail:', error);
      toast.error('Failed to load detailed information');
    } finally {
      setDetailLoading(false);
    }
  };

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
            <h4 className="text-2xl font-semibold text-purple-400">{reference.source}</h4>
            <div className="mt-1 text-2xl text-gray-300">{reference.type}</div>
            <div className="mt-1 text-2xl">
              <span className="text-blue-400 text-2xl">Relevance:</span>
              <span className="text-gray-300 ml-2 text-2xl">{reference.relevance}</span>
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
      const response = await axiosInstance.get('/images');
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
      // Determine search type based on query terms
      let searchType: 'diagram' | 'part' | 'repair' = 'diagram';
      const query = customImageSearch.toLowerCase();
      
      if (query.includes('part') || query.includes('component')) {
        searchType = 'part';
      } else if (query.includes('repair') || query.includes('fix')) {
        searchType = 'repair';
      }

      toast.loading('Searching for images...');
      const results = await searchImages(customImageSearch, searchType);
      toast.dismiss();

      if (results.length > 0) {
        setIsImageSearchModalOpen(true);
        setCurrentImageIndex(0);
        toast.success(`Found ${results.length} relevant images`);
      } else {
        toast.error('No relevant images found. Try:\n• Adding more specific terms\n• Including part names\n• Using different keywords');
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
      await axiosInstance.delete(`/images/${imageId}`);
      toast.success('Image deleted successfully');
      // Refresh the saved images list
      fetchSavedImages();
    } catch (error) {
      console.error('Error deleting image:', error);
      toast.error('Failed to delete image');
    }
  };

  return (
    <div className="p-4 pb-20 text-2xl">
      {/* Content grid with main column */}
      <div className="flex flex-col gap-4">
        {/* Top section with grid */}
        <div className="grid grid-cols-3 gap-4 pr-[1vw]">
          <CustomerContextDisplay />
          
          <AppointmentsPage />
          <div className="w-full">
            <TranscriptProvider>
              <EventProvider>
                <App />
              </EventProvider>
            </TranscriptProvider>
          </div>
        </div>

        {/* Image search section - fixed on right side */}
        <div className="fixed right-[1vw] w-[14vw] h-[100vh] bg-gray-800 shadow-xl z-10 flex flex-col">
          <div className="p-4 border-b border-gray-700">
            <form onSubmit={handleCustomImageSearch} className="flex flex-col gap-2">
              <input
                type="text"
                value={customImageSearch}
                onChange={(e) => setCustomImageSearch(e.target.value)}
                placeholder={selectedVehicle ? 
                  `Search ${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}` : 
                  "Select a vehicle first"}
                className="w-full p-2 bg-gray-700 text-white rounded-lg text-xl focus:ring-2 focus:ring-blue-500"
                disabled={!selectedVehicle}
              />
              <div className="flex gap-2">
                <Button 
                  type="submit" 
                  disabled={!selectedVehicle || !customImageSearch.trim()}
                  className="flex-1"
                >
                  <Search className="mr-2" />
                  Search
                </Button>
                <Button
                  onClick={() => {
                    setShowSavedImages(!showSavedImages);
                    fetchSavedImages();
                  }}
                  className="flex-1"
                >
                  <Save className="mr-2" />
                  {showSavedImages ? 'Hide' : 'Saved'}
                </Button>
              </div>
            </form>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              {!showSavedImages ? (
                searchResults.map((result, index) => (
                  <div 
                    key={index}
                    className="bg-gray-900 rounded-lg p-2 cursor-pointer hover:bg-gray-800"
                    onClick={() => handleSaveAndViewImage(result)}
                  >
                    <div className="relative w-full h-48">
                      <img
                        src={getImageUrl(result.thumbnailUrl || result.imageUrl)}
                        alt={result.title}
                        className="w-full h-full object-contain rounded"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          if (result.imageUrl) {
                            target.src = getImageUrl(result.imageUrl);
                          } else if (result.link) {
                            target.src = getImageUrl(result.link);
                          }
                        }}
                      />
                    </div>
                    <p className="mt-2 text-white text-sm truncate">{result.title}</p>
                    <div className="flex justify-end gap-2 mt-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSaveImage(result);
                        }}
                        className="p-1 text-white hover:bg-gray-700 rounded"
                        title="Save Image"
                      >
                        <Save size={16} />
                      </button>
                      {result.link && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(result.link, '_blank');
                          }}
                          className="p-1 text-white hover:bg-gray-700 rounded"
                          title="View Source"
                        >
                          <ExternalLink size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                savedImages.map((image, index) => (
                  <div 
                    key={index}
                    className="bg-gray-900 rounded-lg p-2 cursor-pointer hover:bg-gray-800"
                    onClick={() => handleImageClick(image)}
                  >
                    <div className="relative w-full h-48">
                      <img
                        src={getImageUrl(image.imageUrl)}
                        alt={image.title}
                        className="w-full h-full object-contain rounded"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          if (image.thumbnailUrl) {
                            target.src = getImageUrl(image.thumbnailUrl);
                          } else if (image.link) {
                            target.src = getImageUrl(image.link);
                          }
                        }}
                      />
                    </div>
                    <p className="mt-2 text-white text-sm truncate">{image.title}</p>
                    <div className="flex justify-between items-center">
                      <p className="text-gray-400 text-xs">
                        Saved: {new Date(image.timestamp).toLocaleDateString()}
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
                ))
              )}
            </div>
          </div>
        </div>

        {/* Research results grid */}
        {researchData && (
          <div className="mt-6 pr-[5vw]">
            <div className="grid grid-cols-5 gap-4 h-[100vh] overflow-y-auto">
              {/* Diagnostic Steps Column */}
              <div className="bg-gray-800 bg-opacity-50 rounded-lg p-4 overflow-y-auto">
                <h3 className="text-2xl font-bold text-yellow-300 mb-4 sticky top-0 bg-gray-800 py-2 z-10">Diagnostic Steps</h3>
                <div className="space-y-4">
                  {renderDiagnosticSteps()}
                </div>
              </div>

              {/* Possible Causes Column */}
              <div className="bg-gray-800 bg-opacity-50 rounded-lg p-4 overflow-y-auto">
                <h3 className="text-2xl font-bold text-yellow-300 mb-4 sticky top-0 bg-gray-800 py-2 z-10">Possible Causes</h3>
                <div className="space-y-4">
                  {renderPossibleCauses()}
                </div>
              </div>

              {/* Recommended Fixes Column */}
              <div className="bg-gray-800 bg-opacity-50 rounded-lg p-4 overflow-y-auto">
                <h3 className="text-2xl font-bold text-yellow-300 mb-4 sticky top-0 bg-gray-800 py-2 z-10">Recommended Fixes</h3>
                <div className="space-y-4">
                  {renderRecommendedFixes()}
                </div>
              </div>

              {/* Technical Notes Column */}
              <div className="bg-gray-800 bg-opacity-50 rounded-lg p-4 overflow-y-auto">
                <h3 className="text-2xl font-bold text-yellow-300 mb-4 sticky top-0 bg-gray-800 py-2 z-10">Technical Notes</h3>
                <div className="space-y-4">
                  {renderTechnicalNotes()}
                </div>
              </div>

              {/* References Column */}
              <div className="bg-gray-800 bg-opacity-50 rounded-lg p-4 overflow-y-auto">
                <h3 className="text-2xl font-bold text-yellow-300 mb-4 sticky top-0 bg-gray-800 py-2 z-10">References</h3>
                <div className="space-y-4">
                  {renderReferences()}
                </div>
              </div>
            </div>
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
        searchResults={searchResults}
        onImageClick={handleSaveAndViewImage}
        onSaveImage={handleSaveImage}
      />

      {/* Image Viewer Modal */}
      {selectedDiagram && (
        <Imagemodal
          open={!!selectedDiagram}
          onClose={() => {
            setSelectedDiagram(null);
            setImageExplanation('');
          }}
        >
          <div className="relative w-full h-full">
            <div className="flex flex-col items-center justify-center p-4">
              <div className="relative flex items-center justify-center w-full h-[60vh]">
                <Image 
                  src={getImageUrl(selectedDiagram.url)}
                  alt={selectedDiagram.title}
                  width={1920}
                  height={1080}
                  className="max-w-[98vw] max-h-[55vh] w-auto h-auto object-contain rounded-lg shadow-xl"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    if (selectedDiagram.twe are nothumbnail) {
                      target.src = getImageUrl(selectedDiagram.thumbnail);
                    } else if (selectedDiagram.link) {
                      target.src = getImageUrl(selectedDiagram.link);
                    }
                  }}
                />
              </div>
              <div className="mt-4 w-full max-w-3xl bg-gray-800 rounded-lg p-6">
                <p className="text-2xl text-white font-semibold mb-4">{selectedDiagram.title}</p>
                <div className="border-t border-gray-700 pt-4">
                  <h3 className="text-xl text-blue-400 font-semibold mb-2">AI Explanation:</h3>
                  {isLoadingExplanation ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    </div>
                  ) : (
                    <p className="text-gray-300 text-xl whitespace-pre-wrap">{imageExplanation}</p>
                  )}
                </div>
                {selectedDiagram.sourceUrl && (
                  <div className="mt-4 flex justify-end">
                    <a
                      href={selectedDiagram.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-blue-400 hover:text-blue-300 text-lg"
                    >
                      <ExternalLink size={20} className="mr-2" />
                      View Source
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Imagemodal>
      )}
    </div>
  );
};

export default VehicleResearch;
  