// Enhanced Diagnostic Hook - Comprehensive State Management
import { useState, useEffect, useCallback, useRef } from 'react';
import EnhancedDiagnosticService from '../services/enhancedDiagnosticService';

export const useEnhancedDiagnostic = (initialConfig = {}) => {
  const {
    enableLiveData = true,
    enableWebSearch = true,
    enableVisualAids = true,
    enableAutoGeneration = true,
    autoSwitchTabs = true
  } = initialConfig;

  // Service instance
  const [diagnosticService] = useState(() => new EnhancedDiagnosticService());
  
  // Session state
  const [enhancedSessionId, setEnhancedSessionId] = useState(null);
  const [originalSession, setOriginalSession] = useState(null);
  const [currentStep, setCurrentStep] = useState(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [sessionStatus, setSessionStatus] = useState('inactive'); // 'inactive', 'initializing', 'active', 'paused', 'completed', 'error'
  
  // Data state
  const [liveData, setLiveData] = useState([]);
  const [liveDataConnected, setLiveDataConnected] = useState(false);
  const [diagnosticTriggers, setDiagnosticTriggers] = useState([]);
  const [generatedCharts, setGeneratedCharts] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [visualAids, setVisualAids] = useState([]);
  
  // UI state
  const [activeTab, setActiveTab] = useState('step');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [isAgentTyping, setIsAgentTyping] = useState(false);
  
  // Settings
  const [settings, setSettings] = useState({
    enableLiveData,
    enableWebSearch,
    enableVisualAids,
    enableAutoGeneration,
    autoSwitchTabs,
    liveDataUpdateInterval: 1000,
    chartGenerationDelay: 2000,
    maxLiveDataPoints: 200,
    maxConversationHistory: 100
  });

  // Refs for cleanup
  const mountedRef = useRef(true);
  const eventListenersSetupRef = useRef(false);

  // Setup event listeners
  useEffect(() => {
    if (diagnosticService && !eventListenersSetupRef.current) {
      console.log('Setting up enhanced diagnostic event listeners...');
      
      // Live data events
      diagnosticService.on('liveDataUpdate', handleLiveDataUpdate);
      diagnosticService.on('liveDataConnected', handleLiveDataConnected);
      diagnosticService.on('liveDataDisconnected', handleLiveDataDisconnected);
      
      // Chart generation events
      diagnosticService.on('chartsGenerated', handleChartsGenerated);
      
      // Search events
      diagnosticService.on('searchResultsUpdated', handleSearchResultsUpdated);
      diagnosticService.on('visualAidsUpdated', handleVisualAidsUpdated);
      
      // Diagnostic events
      diagnosticService.on('diagnosticTriggers', handleDiagnosticTriggers);
      diagnosticService.on('sessionEnded', handleSessionEnded);

      eventListenersSetupRef.current = true;

      return () => {
        if (diagnosticService) {
          diagnosticService.removeAllListeners();
        }
        eventListenersSetupRef.current = false;
      };
    }
  }, [diagnosticService]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (enhancedSessionId) {
        diagnosticService?.endSession(enhancedSessionId).catch(console.error);
      }
    };
  }, [enhancedSessionId, diagnosticService]);

  // Event handlers
  const handleLiveDataUpdate = useCallback((data) => {
    if (!mountedRef.current) return;
    
    setLiveData(prev => {
      const newData = [...prev, data.data];
      return newData.slice(-settings.maxLiveDataPoints);
    });
  }, [settings.maxLiveDataPoints]);

  const handleLiveDataConnected = useCallback((data) => {
    if (!mountedRef.current) return;
    setLiveDataConnected(true);
    console.log('Live data connected for session:', data.sessionId);
  }, []);

  const handleLiveDataDisconnected = useCallback((data) => {
    if (!mountedRef.current) return;
    setLiveDataConnected(false);
    console.log('Live data disconnected for session:', data.sessionId);
  }, []);

  const handleChartsGenerated = useCallback((data) => {
    if (!mountedRef.current) return;
    
    setGeneratedCharts(prev => [...prev, ...data.charts]);
    
    if (settings.autoSwitchTabs && data.charts.length > 0) {
      setTimeout(() => {
        setActiveTab('charts');
      }, 500);
    }
  }, [settings.autoSwitchTabs]);

  const handleSearchResultsUpdated = useCallback((data) => {
    if (!mountedRef.current) return;
    
    setSearchResults(prev => [...prev, {
      type: data.type,
      results: data.results,
      timestamp: new Date().toISOString(),
      id: Date.now() + Math.random()
    }]);
    
    if (settings.autoSwitchTabs) {
      setTimeout(() => {
        setActiveTab('search');
      }, 500);
    }
  }, [settings.autoSwitchTabs]);

  const handleVisualAidsUpdated = useCallback((data) => {
    if (!mountedRef.current) return;
    
    setVisualAids(prev => [...prev, {
      type: data.type,
      images: data.images,
      timestamp: new Date().toISOString(),
      id: Date.now() + Math.random()
    }]);
    
    if (settings.autoSwitchTabs && data.images.length > 0) {
      setTimeout(() => {
        setActiveTab('visualAids');
      }, 500);
    }
  }, [settings.autoSwitchTabs]);

  const handleDiagnosticTriggers = useCallback((data) => {
    if (!mountedRef.current) return;
    
    setDiagnosticTriggers(prev => [
      ...prev.slice(-10), // Keep only last 10 triggers
      ...data.triggers.map(trigger => ({
        ...trigger,
        id: Date.now() + Math.random(),
        sessionId: data.sessionId
      }))
    ]);
  }, []);

  const handleSessionEnded = useCallback((data) => {
    if (!mountedRef.current) return;
    
    console.log('Enhanced diagnostic session ended:', data.sessionId);
    setSessionStatus('completed');
  }, []);

  // Main functions
  const initializeSession = useCallback(async (sessionData) => {
    if (!sessionData) {
      throw new Error('Session data is required');
    }

    try {
      setIsLoading(true);
      setError(null);
      setSessionStatus('initializing');

      console.log('Initializing enhanced diagnostic session...');
      
      const enhancedSession = await diagnosticService.createEnhancedDiagnosticSession(sessionData);
      
      if (!mountedRef.current) return;

      setEnhancedSessionId(enhancedSession.sessionId);
      setOriginalSession(sessionData);
      setSessionStatus('active');
      
      // Set initial step
      if (sessionData.diagnosticSteps && sessionData.diagnosticSteps.length > 0) {
        setCurrentStep(sessionData.diagnosticSteps[0]);
        setCurrentStepIndex(0);
      }

      console.log('Enhanced diagnostic session initialized:', enhancedSession.sessionId);
      return enhancedSession;

    } catch (error) {
      console.error('Failed to initialize enhanced session:', error);
      if (mountedRef.current) {
        setError(error.message);
        setSessionStatus('error');
      }
      throw error;
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [diagnosticService]);

  const chatWithAgent = useCallback(async (message, context = {}) => {
    if (!enhancedSessionId) {
      throw new Error('No active diagnostic session');
    }

    try {
      setIsAgentTyping(true);
      setError(null);

      // Add user message to conversation
      const userMessage = {
        role: 'user',
        message,
        timestamp: new Date().toISOString(),
        step: currentStepIndex,
        id: Date.now() + Math.random()
      };

      setConversationHistory(prev => {
        const updated = [...prev, userMessage];
        return updated.slice(-settings.maxConversationHistory);
      });

      // Send to enhanced service
      const response = await diagnosticService.chatWithDiagnosticAgent(
        enhancedSessionId, 
        message, 
        {
          ...context,
          currentStep,
          currentStepIndex,
          liveDataEnabled: settings.enableLiveData && liveDataConnected,
          webSearchEnabled: settings.enableWebSearch,
          visualAidsEnabled: settings.enableVisualAids
        }
      );

      if (!mountedRef.current) return response;

      // Add agent response to conversation
      const agentMessage = {
        role: 'agent',
        message: response.response || 'No response received',
        timestamp: new Date().toISOString(),
        step: currentStepIndex,
        context: response.context,
        id: Date.now() + Math.random()
      };

      setConversationHistory(prev => {
        const updated = [...prev, agentMessage];
        return updated.slice(-settings.maxConversationHistory);
      });

      return response;

    } catch (error) {
      console.error('Chat error:', error);
      if (mountedRef.current) {
        setError(error.message);
      }
      throw error;
    } finally {
      if (mountedRef.current) {
        setIsAgentTyping(false);
      }
    }
  }, [enhancedSessionId, currentStep, currentStepIndex, liveDataConnected, diagnosticService, settings]);

  const completeStep = useCallback(async (stepData) => {
    if (!enhancedSessionId || !currentStep) {
      throw new Error('No active step to complete');
    }

    try {
      setIsLoading(true);
      setError(null);

      // Add enhanced context to step data
      const enhancedStepData = {
        ...stepData,
        enhancedContext: {
          liveDataPoints: liveData.length,
          liveDataSummary: liveData.slice(-5),
          diagnosticTriggers: diagnosticTriggers.slice(-5),
          chartsGenerated: generatedCharts.length,
          searchResults: searchResults.length,
          visualAids: visualAids.reduce((sum, aid) => sum + aid.images.length, 0)
        }
      };

      // Complete step (this would integrate with your existing step completion logic)
      console.log('Completing enhanced step:', currentStep.id, enhancedStepData);

      // Move to next step
      if (originalSession?.diagnosticSteps) {
        const nextIndex = currentStepIndex + 1;
        if (nextIndex < originalSession.diagnosticSteps.length) {
          setCurrentStep(originalSession.diagnosticSteps[nextIndex]);
          setCurrentStepIndex(nextIndex);
        } else {
          setSessionStatus('completed');
        }
      }

      return {
        success: true,
        isComplete: currentStepIndex >= (originalSession?.diagnosticSteps?.length || 1) - 1,
        nextStep: originalSession?.diagnosticSteps?.[currentStepIndex + 1] || null,
        enhancedData: enhancedStepData.enhancedContext
      };

    } catch (error) {
      console.error('Step completion error:', error);
      if (mountedRef.current) {
        setError(error.message);
      }
      throw error;
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [enhancedSessionId, currentStep, currentStepIndex, liveData, diagnosticTriggers, generatedCharts, searchResults, visualAids, originalSession]);

  const generateCharts = useCallback(async () => {
    if (!enhancedSessionId || !settings.enableAutoGeneration) {
      return;
    }

    try {
      setIsLoading(true);
      await diagnosticService.generateDiagnosticCharts(enhancedSessionId);
    } catch (error) {
      console.error('Chart generation error:', error);
      if (mountedRef.current) {
        setError('Failed to generate charts: ' + error.message);
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [enhancedSessionId, settings.enableAutoGeneration, diagnosticService]);

  const searchRecalls = useCallback(async () => {
    if (!enhancedSessionId || !settings.enableWebSearch) {
      return;
    }

    try {
      setIsLoading(true);
      await diagnosticService.searchRecallsAndTSBs(enhancedSessionId);
    } catch (error) {
      console.error('Recall search error:', error);
      if (mountedRef.current) {
        setError('Failed to search recalls: ' + error.message);
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [enhancedSessionId, settings.enableWebSearch, diagnosticService]);

  const searchTechnicalImages = useCallback(async (query) => {
    if (!enhancedSessionId || !settings.enableVisualAids) {
      return;
    }

    try {
      setIsLoading(true);
      await diagnosticService.searchTechnicalImages(enhancedSessionId, query);
    } catch (error) {
      console.error('Technical image search error:', error);
      if (mountedRef.current) {
        setError('Failed to search technical images: ' + error.message);
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [enhancedSessionId, settings.enableVisualAids, diagnosticService]);

  const endSession = useCallback(async () => {
    if (!enhancedSessionId) {
      return;
    }

    try {
      await diagnosticService.endSession(enhancedSessionId);
      
      if (mountedRef.current) {
        setEnhancedSessionId(null);
        setSessionStatus('inactive');
        setCurrentStep(null);
        setCurrentStepIndex(0);
        setLiveData([]);
        setLiveDataConnected(false);
        setConversationHistory([]);
        setError(null);
      }
    } catch (error) {
      console.error('Session end error:', error);
    }
  }, [enhancedSessionId, diagnosticService]);

  const clearData = useCallback((dataType) => {
    switch (dataType) {
      case 'charts':
        setGeneratedCharts([]);
        break;
      case 'search':
        setSearchResults([]);
        break;
      case 'visualAids':
        setVisualAids([]);
        break;
      case 'triggers':
        setDiagnosticTriggers([]);
        break;
      case 'conversation':
        setConversationHistory([]);
        break;
      case 'all':
        setGeneratedCharts([]);
        setSearchResults([]);
        setVisualAids([]);
        setDiagnosticTriggers([]);
        setConversationHistory([]);
        setLiveData([]);
        break;
      default:
        console.warn('Unknown data type for clearing:', dataType);
    }
  }, []);

  const updateSettings = useCallback((newSettings) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  const getSessionStatus = useCallback(() => {
    if (!enhancedSessionId) {
      return {
        sessionId: null,
        status: sessionStatus,
        progress: {
          currentStep: currentStepIndex,
          totalSteps: originalSession?.diagnosticSteps?.length || 0,
          percentage: originalSession?.diagnosticSteps?.length ? 
            Math.round((currentStepIndex / originalSession.diagnosticSteps.length) * 100) : 0
        },
        data: {
          liveDataPoints: liveData.length,
          liveDataConnected,
          chartsGenerated: generatedCharts.length,
          searchResults: searchResults.length,
          visualAids: visualAids.reduce((sum, aid) => sum + aid.images.length, 0),
          diagnosticTriggers: diagnosticTriggers.length,
          conversationMessages: conversationHistory.length
        },
        capabilities: {
          liveData: settings.enableLiveData,
          webSearch: settings.enableWebSearch,
          visualAids: settings.enableVisualAids,
          autoGeneration: settings.enableAutoGeneration
        }
      };
    }

    return diagnosticService?.getSessionStatus(enhancedSessionId) || null;
  }, [enhancedSessionId, sessionStatus, currentStepIndex, originalSession, liveData, liveDataConnected, generatedCharts, searchResults, visualAids, diagnosticTriggers, conversationHistory, settings, diagnosticService]);

  // Return hook interface
  return {
    // Session state
    enhancedSessionId,
    originalSession,
    currentStep,
    currentStepIndex,
    sessionStatus,
    
    // Data state
    liveData,
    liveDataConnected,
    diagnosticTriggers,
    generatedCharts,
    searchResults,
    visualAids,
    conversationHistory,
    
    // UI state
    activeTab,
    setActiveTab,
    isLoading,
    error,
    setError,
    isAgentTyping,
    
    // Settings
    settings,
    updateSettings,
    
    // Actions
    initializeSession,
    chatWithAgent,
    completeStep,
    generateCharts,
    searchRecalls,
    searchTechnicalImages,
    endSession,
    clearData,
    getSessionStatus,
    
    // Utilities
    diagnosticService
  };
};

export default useEnhancedDiagnostic;