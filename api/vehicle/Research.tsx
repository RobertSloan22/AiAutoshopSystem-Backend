// src/components/VehicleResearch.jsx
import React, { useState, useEffect } from 'react';
import { useCustomer } from '../../context/CustomerContext';
import axiosInstance from '../../utils/axiosConfig';
import { toast } from 'react-hot-toast';
import { Button } from "../ui/button";
import { agentService } from '../../services/agentService';
import { useResearch } from '../../context/ResearchContext';
import { ImageSearchModal } from './ImageSearchModal'; 
import { Imagemodal } from './Imagemodal';
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { ChatOpenAI } from "@langchain/openai";
import { MemorySaver } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { SERVICES } from '../../config/services';


import.meta.env.VITE_TAVILY_API_KEY;



interface ResearchResponse {
  diagnosticSteps: Array<{
    step: string;
    details: string;
    tools?: string[];
    expectedReadings?: string;
    notes?: string;
  }>;
  possibleCauses: Array<{
    cause: string;
    likelihood: string;
    explanation: string;
  }>;
  recommendedFixes: Array<{
    fix: string;
    difficulty: string;
    estimatedCost: string;
    professionalOnly?: boolean;
    parts?: string[];
  }>;
  technicalNotes: {
    commonIssues: string[];
    serviceIntervals?: string[];
    recalls?: string[];
    tsbs?: string[];
  };
  references: Array<{
    source: string;
    url?: string;
    type: string;
    relevance: string;
  }>;
}

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
}

interface DetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  loading: boolean;
  data: DetailedResearchResponse | null;
}

interface VehicleResearchProps {
  initialResults?: ResearchResponse;
}
interface ImageResult {
  title: string;
  imageUrl: string;
  thumbnailUrl: string;
  source?: string;
  link: string;
}

const DetailModal: React.FC<DetailModalProps> = ({ isOpen, onClose, loading, data }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-gray-900 rounded-lg p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-2xl font-bold text-white">{data?.title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-gray-800 p-4 rounded-lg">
              <h4 className="text-blue-400 text-xl mb-2">Detailed Description</h4>
              <p className="text-white text-lg">{data?.detailedDescription}</p>
            </div>

            {data?.additionalSteps && (
              <div className="bg-gray-800 p-4 rounded-lg">
                <h4 className="text-blue-400 text-xl mb-2">Additional Steps</h4>
                <ul className="list-disc list-inside text-white space-y-2">
                  {data.additionalSteps.map((step, index) => (
                    <li key={index} className="text-lg">{step}</li>
                  ))}
                </ul>
              </div>
            )}

            {data?.warnings && (
              <div className="bg-red-900 bg-opacity-50 p-4 rounded-lg">
                <h4 className="text-red-400 text-xl mb-2">Important Warnings</h4>
                <ul className="list-disc list-inside text-white space-y-2">
                  {data.warnings.map((warning, index) => (
                    <li key={index} className="text-lg">{warning}</li>
                  ))}
                </ul>
              </div>
            )}

            {data?.expertTips && (
              <div className="bg-green-900 bg-opacity-50 p-4 rounded-lg">
                <h4 className="text-green-400 text-xl mb-2">Expert Tips</h4>
                <ul className="list-disc list-inside text-white space-y-2">
                  {data.expertTips.map((tip, index) => (
                    <li key={index} className="text-lg">{tip}</li>
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

// Initialize LangChain agent
const initializeLangChainAgent = () => {
  const agentTools = [new TavilySearchResults({ maxResults: 3, apiKey: import.meta.env.VITE_TAVILY_API_KEY })];
  const agentModel = new ChatOpenAI({
    temperature: 0,
    clientOptions: {
      baseURL: SERVICES.LLM_SERVICE
    }
  });

  return createReactAgent({
    llm: agentModel,
    tools: agentTools
  });
};

const VehicleResearch: React.FC<VehicleResearchProps> = ({ initialResults }) => {
  const { selectedCustomer, selectedVehicle } = useCustomer();
  const [problem, setProblem] = useState('');
  const [result, setResult] = useState<ResearchResponse | null>(initialResults || null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('diagnostic');
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<DetailedResearchResponse | null>(null);
  const [preloadedDetails, setPreloadedDetails] = useState<Record<string, DetailedResearchResponse>>({});
  const [agent] = useState(() => initializeLangChainAgent());
  const [threadId] = useState(() => Math.random().toString(36).substring(7));

  // Add state for loading all details
  const [isLoadingAllDetails, setIsLoadingAllDetails] = useState(false);
  const [allDetailsLoaded, setAllDetailsLoaded] = useState(false);

  useEffect(() => {
    if (initialResults) {
      setResult(initialResults);
    }
  }, [initialResults]);

  // Preload detailed information when results are available
  useEffect(() => {
    if (result && !loading) {
      const preloadDetails = async () => {
        try {
          // Preload first item from each category
          const categories = {
            diagnostic: result.diagnosticSteps[0],
            causes: result.possibleCauses[0],
            fixes: result.recommendedFixes[0]
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

          setPreloadedDetails(newPreloadedDetails);
        } catch (error) {
          console.warn('Preload details error:', error);
        }
      };

      preloadDetails();
    }
  }, [result, loading, selectedVehicle, problem]);

  // Function to preload all details
  const preloadAllDetails = async () => {
    if (!result || isLoadingAllDetails) return;
    
    setIsLoadingAllDetails(true);
    try {
      const preloadPromises: Promise<void>[] = [];

      // Preload all diagnostic steps
      result.diagnosticSteps?.forEach((step, index) => {
        preloadPromises.push(loadDetail('diagnostic', step, index));
      });

      // Preload all possible causes
      result.possibleCauses?.forEach((cause, index) => {
        preloadPromises.push(loadDetail('causes', cause, index));
      });

      // Preload all recommended fixes
      result.recommendedFixes?.forEach((fix, index) => {
        preloadPromises.push(loadDetail('fixes', fix, index));
      });

      await Promise.all(preloadPromises);
      setAllDetailsLoaded(true);
      toast.success('All detailed information has been preloaded');
    } catch (error) {
      console.error('Error preloading all details:', error);
      toast.error('Failed to preload all details');
    } finally {
      setIsLoadingAllDetails(false);
    }
  };

  // Function to load a single detail
  const loadDetail = async (category: string, item: any, index: number) => {
    const preloadKey = `${category}-${index}`;
    if (preloadedDetails[preloadKey]) return;

    try {
      const response = await axiosInstance.post('/rservice/detail', {
        vin: selectedVehicle.vin,
        year: selectedVehicle.year,
        make: selectedVehicle.make,
        model: selectedVehicle.model,
        category,
        item,
        originalProblem: problem
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

  // Function to format research data into readable text
  const formatComprehensiveDataForEliza = (data: any): string => {
    let formattedText = "=== VEHICLE RESEARCH RESULTS ===\n\n";

    // Vehicle Information
    formattedText += "VEHICLE INFORMATION:\n";
    formattedText += `Vehicle: ${data.vehicleInfo.year} ${data.vehicleInfo.make} ${data.vehicleInfo.model}\n`;
    formattedText += `VIN: ${data.vehicleInfo.vin}\n`;
    if (data.vehicleInfo.engine) formattedText += `Engine: ${data.vehicleInfo.engine}\n`;
    if (data.vehicleInfo.transmission) formattedText += `Transmission: ${data.vehicleInfo.transmission}\n`;
    formattedText += "\n";

    // Problem Description
    if (data.problem) {
      formattedText += "PROBLEM DESCRIPTION:\n";
      formattedText += `${data.problem}\n\n`;
    }

    // Research Results
    if (data.researchResults) {
      // Diagnostic Steps
      if (data.researchResults.diagnosticSteps?.length > 0) {
        formattedText += "DIAGNOSTIC STEPS:\n";
        data.researchResults.diagnosticSteps.forEach((step: any, index: number) => {
          formattedText += `${index + 1}. ${step.step}\n`;
          formattedText += `   Details: ${step.details}\n`;
          if (step.tools?.length) {
            formattedText += `   Tools Required: ${step.tools.join(", ")}\n`;
          }
          if (step.expectedReadings) {
            formattedText += `   Expected Readings: ${step.expectedReadings}\n`;
          }
          formattedText += "\n";
        });
      }

      // Possible Causes
      if (data.researchResults.possibleCauses?.length > 0) {
        formattedText += "POSSIBLE CAUSES:\n";
        data.researchResults.possibleCauses.forEach((cause: any, index: number) => {
          formattedText += `${index + 1}. ${cause.cause} (${cause.likelihood})\n`;
          formattedText += `   Explanation: ${cause.explanation}\n\n`;
        });
      }

      // Recommended Fixes
      if (data.researchResults.recommendedFixes?.length > 0) {
        formattedText += "RECOMMENDED FIXES:\n";
        data.researchResults.recommendedFixes.forEach((fix: any, index: number) => {
          formattedText += `${index + 1}. ${fix.fix}\n`;
          formattedText += `   Difficulty: ${fix.difficulty}\n`;
          formattedText += `   Estimated Cost: ${fix.estimatedCost}\n`;
          if (fix.professionalOnly) {
            formattedText += `   ⚠️ Professional Installation Required\n`;
          }
          if (fix.parts?.length) {
            formattedText += `   Required Parts: ${fix.parts.join(", ")}\n`;
          }
          formattedText += "\n";
        });
      }

      // Technical Notes
      if (data.researchResults.technicalNotes) {
        formattedText += "TECHNICAL NOTES:\n";
        if (data.researchResults.technicalNotes.commonIssues?.length) {
          formattedText += "Common Issues:\n";
          data.researchResults.technicalNotes.commonIssues.forEach((issue: string) => {
            formattedText += `- ${issue}\n`;
          });
          formattedText += "\n";
        }
        if (data.researchResults.technicalNotes.recalls?.length) {
          formattedText += "Related Recalls:\n";
          data.researchResults.technicalNotes.recalls.forEach((recall: string) => {
            formattedText += `- ${recall}\n`;
          });
          formattedText += "\n";
        }
      }
    }

    // Detailed Analysis Summary
    if (Object.keys(data.detailedAnalysis).length > 0) {
      formattedText += "DETAILED ANALYSIS SUMMARY:\n";
      Object.entries(data.detailedAnalysis).forEach(([key, value]: [string, any]) => {
        formattedText += `${value.title}\n`;
        formattedText += `${value.detailedDescription}\n\n`;
      });
    }

    return formattedText;
  };

  // Function to send all data to ElizaChat
  const sendToElizaChat = async () => {
    if (!selectedCustomer || !selectedVehicle) {
      toast.error('Please select a customer and vehicle first');
      return;
    }

    try {
      setLoading(true);
      // If we have research results, include them in the data sent to the agent
      const researchData = result ? {
        diagnosticSteps: result.diagnosticSteps,
        possibleCauses: result.possibleCauses,
        recommendedFixes: result.recommendedFixes,
        technicalNotes: result.technicalNotes,
        problem: problem, // Include the original problem description
        detailedAnalysis: preloadedDetails // Include any detailed analysis
      } : null;

      // Send the data to the agent using the service
      await agentService.sendComprehensiveData(
        selectedCustomer,
        selectedVehicle,
        [], // Invoices will be fetched by the service
        researchData
      );

      toast.success('Vehicle data and research results resent to AI Assistant');
    } catch (error) {
      console.error('Error sending data to AI Assistant:', error);
      toast.error('Failed to send data to AI Assistant');
    } finally {
      setLoading(false);
    }
  };

  // Preload all details when results are first received
  useEffect(() => {
    if (result && !allDetailsLoaded && !isLoadingAllDetails) {
      preloadAllDetails();
    }
  }, [result]);

  // Add function to query LangChain agent
  const queryLangChainAgent = async (query: string) => {
    try {
      const agentState = await agent.invoke(
        { messages: [new HumanMessage(query)] },
        { configurable: { thread_id: threadId } }
      );
      return agentState.messages[agentState.messages.length - 1].content;
    } catch (error) {
      console.error('Error querying LangChain agent:', error);
      return null;
    }
  };

  // Update handleSubmit to include LangChain agent
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      // Query both the existing research endpoint and LangChain agent
      const [response, agentResponse] = await Promise.all([
        axiosInstance.post('/researchl', {
          vin: selectedVehicle.vin,
          year: selectedVehicle.year,
          make: selectedVehicle.make,
          model: selectedVehicle.model,
          problem: problem,
        }),
        queryLangChainAgent(`Research problem for ${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}: ${problem}`)
      ]);

      if (response.data?.result) {
        let parsed;
        if (typeof response.data.result === 'string') {
          try {
            parsed = JSON.parse(response.data.result);
          } catch (parseError) {
            console.error('Error parsing result:', parseError);
            toast.error('Received malformed JSON from server.');
            return;
          }
        } else {
          parsed = response.data.result;
        }

        // Enhance the parsed results with LangChain agent response
        if (agentResponse) {
          parsed.technicalNotes = parsed.technicalNotes || {};
          parsed.technicalNotes.agentInsights = agentResponse;
        }

        setResult(parsed);

        // Send to agent service
        try {
          const researchData = {
            ...parsed,
            problem: problem,
            detailedAnalysis: preloadedDetails,
            agentResponse
          };

          await agentService.sendComprehensiveData(
            selectedCustomer,
            selectedVehicle,
            [],
            researchData
          );

          toast.success('Research completed and sent to AI Assistant');
        } catch (sendError) {
          console.error('Error sending data to AI Assistant:', sendError);
          toast.error('Research completed but failed to send to AI Assistant');
        }
      } else {
        toast.error('No research result received.');
      }
    } catch (error: any) {
      console.error('Research error:', error);
      toast.error('Error researching the vehicle problem.');
    } finally {
      setLoading(false);
    }
  };

  const handleItemClick = async (category: string, item: any, index: number) => {
    setDetailModalOpen(true);
    
    // Check if we have preloaded data for this item
    const preloadKey = `${category}-${index}`;
    if (preloadedDetails[preloadKey]) {
      setDetailData(preloadedDetails[preloadKey]);
      setDetailLoading(false);
      return;
    }

    // If not preloaded, load normally
    setDetailLoading(true);
    setDetailData(null);

    try {
      const response = await axiosInstance.post('/rservice/detail', {
        vin: selectedVehicle.vin,
        year: selectedVehicle.year,
        make: selectedVehicle.make,
        model: selectedVehicle.model,
        category,
        item,
        originalProblem: problem
      });

      if (response.data?.result) {
        let parsed;
        if (typeof response.data.result === 'string') {
          parsed = JSON.parse(response.data.result);
        } else {
          parsed = response.data.result;
        }
        setDetailData(parsed);
        
        // Cache the result for future use
        setPreloadedDetails(prev => ({
          ...prev,
          [preloadKey]: parsed
        }));
      } else {
        toast.error('No detailed information available.');
      }
    } catch (error) {
      console.error('Detail research error:', error);
      toast.error('Error fetching detailed information.');
    } finally {
      setDetailLoading(false);
    }
  };

  const renderDiagnosticSteps = () => {
    return result?.diagnosticSteps?.map((step, index) => (
      <div
        key={index}
        className="mb-4 p-4 text-xl bg-gray-800 bg-opacity-50 rounded-lg border-l-4 border-blue-500 cursor-pointer hover:bg-gray-700 transition-colors"
        onClick={() => handleItemClick('diagnostic', step, index)}
      >
        <div className="flex items-center justify-between">
          <h4 className="text-lg font-semibold text-blue-400">Step {index + 1}</h4>
          {preloadedDetails[`diagnostic-${index}`] && (
            <span className="text-xs text-gray-400">(Detailed info ready)</span>
          )}
        </div>
        <p className="text-white mt-2">{step.step}</p>
        <p className="text-gray-300 mt-1">{step.details}</p>
        {step.tools && (
          <div className="mt-2">
            <span className="text-blue-400">Required Tools:</span>
            <ul className="list-disc list-inside text-gray-300 ml-4">
              {step.tools.map((tool, i) => <li key={i}>{tool}</li>)}
            </ul>
          </div>
        )}
        {step.expectedReadings && (
          <div className="mt-2">
            <span className="text-blue-400">Expected Readings:</span>
            <p className="text-gray-300 ml-4">{step.expectedReadings}</p>
          </div>
        )}
      </div>
    ));
  };

  const renderPossibleCauses = () => {
    return result?.possibleCauses?.map((cause, index) => (
      <div
        key={index}
        className="mb-4 p-4 text-xl bg-gray-800 bg-opacity-50 rounded-lg border-l-4 border-yellow-500 cursor-pointer hover:bg-gray-700 transition-colors"
        onClick={() => handleItemClick('causes', cause, index)}
      >
        <div className="flex items-center justify-between">
          <h4 className="text-lg font-semibold text-yellow-400">{cause.cause}</h4>
          <div className="flex items-center gap-2">
            {preloadedDetails[`causes-${index}`] && (
              <span className="text-xs text-gray-400">(Detailed info ready)</span>
            )}
            <span className={`px-2 py-1 rounded text-sm ${
              cause.likelihood.toLowerCase().includes('high')
                ? 'bg-red-500'
                : cause.likelihood.toLowerCase().includes('medium')
                ? 'bg-yellow-500'
                : 'bg-green-500'
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
    return result?.recommendedFixes?.map((fix, index) => (
      <div
        key={index}
        className="mb-4 p-4 bg-gray-800 text-xl bg-opacity-50 rounded-lg border-l-4 border-green-500 cursor-pointer hover:bg-gray-700 transition-colors"
        onClick={() => handleItemClick('fixes', fix, index)}
      >
        <div className="flex items-center justify-between">
          <h4 className="text-lg font-semibold text-green-400">{fix.fix}</h4>
          <div className="flex items-center gap-2">
            {preloadedDetails[`fixes-${index}`] && (
              <span className="text-xs text-gray-400">(Detailed info ready)</span>
            )}
            <span className="px-2 py-1 bg-gray-700 rounded text-sm">{fix.difficulty}</span>
            <span className="px-2 py-1 bg-gray-700 rounded text-sm">{fix.estimatedCost}</span>
          </div>
        </div>
        {fix.professionalOnly && (
          <div className="mt-2 text-red-400">⚠️ Professional Installation Required</div>
        )}
        {fix.parts && (
          <div className="mt-2">
            <span className="text-green-400">Required Parts:</span>
            <ul className="list-disc list-inside text-gray-300 ml-4">
              {fix.parts.map((part, i) => <li key={i}>{part}</li>)}
            </ul>
          </div>
        )}
      </div>
    ));
  };

  const renderReferences = () => {
    return result?.references?.map((ref, index) => (
      <div key={index} className="mb-4 text-xl p-4 bg-gray-800 bg-opacity-50 rounded-lg border-l-4 border-purple-500">
        <div className="flex justify-between items-start">
          <h4 className="text-lg font-semibold text-purple-400">{ref.source}</h4>
          <span className="px-2 py-1 bg-gray-700 rounded text-sm">{ref.type}</span>
        </div>
        {ref.url && (
          <a
            href={ref.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 mt-2 block"
          >
            View Source →
          </a>
        )}
        <p className="text-gray-300 mt-2">Relevance: {ref.relevance}</p>
      </div>
    ));
  };

  if (!selectedCustomer) {
    return (
      <div className="p-4 bg-gray-900 bg-opacity-75 rounded-lg shadow-lg text-white">
        Please select a customer.
      </div>
    );
  }

  if (!selectedVehicle) {
    return (
      <div className="p-4 bg-gray-900 bg-opacity-75 rounded-lg shadow-lg text-white">
        No vehicle selected.
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-900 bg-opacity-75 rounded-lg shadow-lg">
      {!initialResults && (
        <>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white">Vehicle Research</h2>
            {result && (
              <Button
                onClick={sendToElizaChat}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
              >
                Resend to AI Assistant
              </Button>
            )}
          </div>
          
          {/* Vehicle Info Card */}
          <div className="mb-4 p-4 bg-gray-800 bg-opacity-50 rounded-lg border-l-4 border-blue-500">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-lg font-semibold text-blue-400 mb-2">Vehicle Information</h3>
                <p className="text-white text-xl">
                  <span className="text-blue-400 text-xl">VIN:</span> {selectedVehicle.vin}
                </p>
                <p className="text-white text-xl">
                  <span className="text-blue-400 text-xl">Year:</span> {selectedVehicle.year}
                </p>
                <p className="text-white text-xl">
                  <span className="text-blue-400 text-xl">Make:</span> {selectedVehicle.make}
                </p>
                <p className="text-white text-xl">
                  <span className="text-blue-400 text-xl">Model:</span> {selectedVehicle.model}
                </p>
              </div>
              {selectedVehicle.engine && (
                <div>
                  <h3 className="font-semibold text-blue-400 mb-2  text-xl">Engine Details</h3>
                  <p className="text-white text-xl">
                    <span className="text-blue-400 text-xl">Engine:</span> {selectedVehicle.engine}
                  </p>
                  {selectedVehicle.transmission && (
                    <p className="text-white text-xl">
                      <span className="text-blue-400 text-xl">Transmission:</span> {selectedVehicle.transmission}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Research Form */}
          <form onSubmit={handleSubmit} className="space-y-4 mb-6">
            <label className="block text-white text-xl" htmlFor="problem">
              Describe the problem:
            </label>
            <textarea
              id="problem"
              className="w-full p-2  h-[5vh] rounded bg-gray-800 text-white border text-xl border-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              rows={5}
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              placeholder="e.g. The engine misfires and there is a rough idle..."
              required
            />
            <button
              type="submit"
              disabled={loading}
              className={`px-4 py-2 rounded text-white ${
                loading ? 'bg-gray-600' : 'bg-blue-600 hover:bg-blue-700'
              } transition-colors`}
            >
              {loading ? 'Researching...' : 'Research Problem'}
            </button>
        
            
          </form>
          <div className="flex space-x-4 border-b border-gray-700 font-bold text-white text-2xl">

          <button
                onClick={() => setActiveTab('diagnostic')}
                className={`px-4 py-2 ${
                  activeTab === 'diagnostic'
                    ? 'text-blue-400 border-b-2 border-blue-400'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                Diagnostic Steps
              </button>
              <button
                onClick={() => setActiveTab('causes')}
                className={`px-4 py-2 ${
                  activeTab === 'causes'
                    ? 'text-blue-400 border-b-2 border-blue-400'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                Possible Causes
              </button>
              <button
                onClick={() => setActiveTab('fixes')}
                className={`px-4 py-2 ${
                  activeTab === 'fixes'
                    ? 'text-blue-400 border-b-2 border-blue-400'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                Recommended Fixes
              </button>
              <button
                onClick={() => setActiveTab('references')}
                className={`px-4 py-2 ${
                  activeTab === 'references'
                    ? 'text-blue-400 border-b-2 border-blue-400'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                References
              </button>
            </div>
            {isLoadingAllDetails ? (
              <div className="flex items-center text-blue-400 ">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
                Loading details...
              </div>
            ) : allDetailsLoaded ? (
              <span className="text-green-400 text-2xl">All details loaded</span>
            ) : (
              <Button
                onClick={preloadAllDetails}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
              >
                Preload All Details
              </Button>
              
           
            )}
        </>
      )}

      {/* Results Display */}
      {result && (
        <div className="space-y-6 h-[55vh] overflow-y-auto ">
          <div className="flex justify-between items-center ">
            <div className="flex space-x-4 border-b border-gray-700 font-bold text-white text-2xl">
              
             
              
              
            </div>
            {isLoadingAllDetails ? (
              <div className="flex items-center text-blue-400 ">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
                Loading details...
              </div>
            ) : allDetailsLoaded ? (
              <span className="text-green-400 text-2xl">All details loaded</span>
            ) : (
              <Button
                onClick={preloadAllDetails}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
              >
                Preload All Details
              </Button>
            )}
          </div>

          {/* Tab Content */}
          <div className="mt-6 h-[50vh] overflow-y-auto text-xl">
            {activeTab === 'diagnostic' && renderDiagnosticSteps()}
            {activeTab === 'causes' && renderPossibleCauses()}
            {activeTab === 'fixes' && renderRecommendedFixes()}
            {activeTab === 'references' && renderReferences()}
          </div>
          

          {result.technicalNotes && (
            <div className="mt-6 p-4 bg-gray-800 bg-opacity-50 rounded-lg">
              <h3 className="text-2xl font-semibold text-white mb-2">Technical Notes</h3>
              {result.technicalNotes.commonIssues && (
                <div className="mb-2">
                  <h4 className="text-blue-400 text-xl">Common Issues:</h4>
                  <ul className="list-disc list-inside  text-gray-300 ml-4 text-xl">
                    {result.technicalNotes.commonIssues.map((issue, i) => (
                      <li key={i}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}
              {result.technicalNotes.recalls && (
                <div className="mb-2">
                  <h4 className="text-blue-400 text-xl">Related Recalls:</h4>
                  <ul className="list-disc list-inside text-gray-300 ml-4 text-base">
                    {result.technicalNotes.recalls.map((recall, i) => (
                      <li key={i}>{recall}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <DetailModal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        loading={detailLoading}
        data={detailData}
      />
    </div>
  );
};

export default VehicleResearch;
