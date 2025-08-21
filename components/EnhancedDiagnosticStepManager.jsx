// Enhanced Diagnostic Step Manager - Complete Integration with All Features
import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageCircle, 
  Send, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  Wrench, 
  User, 
  Bot,
  Brain,
  Loader2,
  ChevronRight,
  ChevronDown,
  FileText,
  Camera,
  Mic,
  RotateCcw,
  Play,
  Pause,
  Square,
  Activity,
  BarChart3,
  Search,
  Image as ImageIcon,
  Globe,
  TrendingUp,
  Zap,
  Eye,
  EyeOff,
  Settings,
  Download,
  Share2,
  Maximize2
} from 'lucide-react';
import LiveDataVisualization from './LiveDataVisualization';
import EnhancedChartDisplay from './EnhancedChartDisplay';
import EnhancedDiagnosticService from '../services/enhancedDiagnosticService';

const EnhancedDiagnosticStepManager = ({ 
  session, 
  onStepComplete, 
  onStepSkip, 
  onSessionComplete,
  onSessionPause,
  onSessionResume,
  onStepUpdate,
  theme = 'dark',
  enableLiveData = true,
  enableWebSearch = true,
  enableVisualAids = true,
  enableAutoGeneration = true,
  useDiagnosticAgent // Original hook from your existing code
}) => {

  // Enhanced diagnostic service
  const [enhancedService] = useState(() => new EnhancedDiagnosticService());
  const [enhancedSessionId, setEnhancedSessionId] = useState(null);
  
  // Live data state
  const [liveData, setLiveData] = useState([]);
  const [liveDataConnected, setLiveDataConnected] = useState(false);
  const [diagnosticTriggers, setDiagnosticTriggers] = useState([]);
  
  // Charts and visualizations state
  const [generatedCharts, setGeneratedCharts] = useState([]);
  const [pythonCharts, setPythonCharts] = useState([]);
  
  // Search and visual aids state
  const [searchResults, setSearchResults] = useState([]);
  const [visualAids, setVisualAids] = useState([]);
  const [webSearchLoading, setWebSearchLoading] = useState(false);
  
  // UI state
  const [activeTab, setActiveTab] = useState('step'); // 'step', 'liveData', 'charts', 'search', 'visualAids'
  const [showLiveDataPanel, setShowLiveDataPanel] = useState(true);
  const [autoGenerationEnabled, setAutoGenerationEnabled] = useState(enableAutoGeneration);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Original diagnostic agent state
  const [originalSessionId, setOriginalSessionId] = useState(null);
  const [currentStep, setCurrentStep] = useState(null);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sessionSummary, setSessionSummary] = useState(null);
  const [isAgentTyping, setIsAgentTyping] = useState(false);

  // Step input state
  const [stepFindings, setStepFindings] = useState('');
  const [testResults, setTestResults] = useState({});
  const [expectedParameters, setExpectedParameters] = useState([]);
  const [confidence, setConfidence] = useState(70);
  const [stepNotes, setStepNotes] = useState('');
  const [chatMessage, setChatMessage] = useState('');

  // Refs
  const chatContainerRef = useRef(null);
  const messageInputRef = useRef(null);

  // Initialize enhanced session when component mounts
  useEffect(() => {
    if (session && !enhancedSessionId && !isLoading) {
      console.log('Component mounted with session, initializing enhanced diagnostic session...');
      initializeEnhancedSession().catch(error => {
        console.error('Failed to auto-initialize enhanced session on mount:', error);
      });
    }
  }, [session, enhancedSessionId, isLoading]);

  // Set up enhanced service event listeners
  useEffect(() => {
    if (enhancedService) {
      enhancedService.on('liveDataUpdate', handleLiveDataUpdate);
      enhancedService.on('liveDataConnected', handleLiveDataConnected);
      enhancedService.on('liveDataDisconnected', handleLiveDataDisconnected);
      enhancedService.on('chartsGenerated', handleChartsGenerated);
      enhancedService.on('searchResultsUpdated', handleSearchResultsUpdated);
      enhancedService.on('visualAidsUpdated', handleVisualAidsUpdated);
      enhancedService.on('diagnosticTriggers', handleDiagnosticTriggers);

      return () => {
        enhancedService.removeAllListeners();
      };
    }
  }, [enhancedService]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [conversationHistory, isAgentTyping]);

  // Initialize enhanced diagnostic session
  const initializeEnhancedSession = async () => {
    try {
      if (!session) {
        throw new Error('No session data available');
      }

      setIsLoading(true);
      setError(null);

      const sessionData = {
        dtcCode: session.dtcCode,
        vehicleInfo: session.vehicleInfo,
        researchData: session.researchData || {},
        diagnosticSteps: session.steps,
        sessionId: session.sessionId
      };

      console.log('Initializing enhanced diagnostic session with data:', sessionData);
      
      // Create enhanced session with all features
      const enhancedSession = await enhancedService.createEnhancedDiagnosticSession(sessionData);
      setEnhancedSessionId(enhancedSession.sessionId);
      
      // Set up initial step
      if (sessionData.diagnosticSteps && sessionData.diagnosticSteps.length > 0) {
        setCurrentStep(sessionData.diagnosticSteps[0]);
        const params = getExpectedParameters(sessionData.diagnosticSteps[0]);
        setExpectedParameters(params);
        
        // Initialize test results
        const newTestResults = {};
        params.forEach(param => {
          newTestResults[param] = '';
        });
        setTestResults(newTestResults);
      }
      
      console.log('Enhanced diagnostic session initialized successfully');
      setIsLoading(false);

    } catch (error) {
      console.error('Failed to initialize enhanced session:', error);
      setError(error.message);
      setIsLoading(false);
      throw error;
    }
  };

  // Enhanced service event handlers
  const handleLiveDataUpdate = (data) => {
    setLiveData(prev => {
      const newData = [...prev, data.data];
      // Keep only last 200 data points for performance
      return newData.slice(-200);
    });
  };

  const handleLiveDataConnected = (data) => {
    setLiveDataConnected(true);
    console.log('Live data connected for session:', data.sessionId);
  };

  const handleLiveDataDisconnected = (data) => {
    setLiveDataConnected(false);
    console.log('Live data disconnected for session:', data.sessionId);
  };

  const handleChartsGenerated = (data) => {
    setPythonCharts(prev => [...prev, ...data.charts]);
    setGeneratedCharts(prev => [...prev, ...data.charts]);
    
    // Auto-switch to charts tab when new charts are generated
    if (autoGenerationEnabled && data.charts.length > 0) {
      setActiveTab('charts');
    }
  };

  const handleSearchResultsUpdated = (data) => {
    setSearchResults(prev => [...prev, {
      type: data.type,
      results: data.results,
      timestamp: new Date().toISOString()
    }]);
    
    // Auto-switch to search tab when new results are available
    if (autoGenerationEnabled) {
      setActiveTab('search');
    }
  };

  const handleVisualAidsUpdated = (data) => {
    setVisualAids(prev => [...prev, {
      type: data.type,
      images: data.images,
      timestamp: new Date().toISOString()
    }]);
    
    // Auto-switch to visual aids tab when new images are available
    if (autoGenerationEnabled && data.images.length > 0) {
      setActiveTab('visualAids');
    }
  };

  const handleDiagnosticTriggers = (data) => {
    setDiagnosticTriggers(prev => [...prev.slice(-10), ...data.triggers]); // Keep only last 10 triggers
  };

  // Get expected parameters for current step
  const getExpectedParameters = (step) => {
    const parametersByType = {
      'voltage': ['Voltage Reading', 'Load Test Result', 'Temperature'],
      'pressure': ['Pressure PSI', 'Leak Rate', 'Temperature'],
      'resistance': ['Resistance Ohms', 'Continuity', 'Temperature'],
      'visual': ['Condition', 'Wear Level', 'Damage Description'],
      'scan': ['DTC Codes', 'Freeze Frame Data', 'Monitor Status'],
      'default': ['Measurement Value', 'Condition', 'Notes']
    };

    const stepTitle = step?.title?.toLowerCase() || '';
    for (const [type, params] of Object.entries(parametersByType)) {
      if (stepTitle.includes(type)) {
        return params;
      }
    }
    return parametersByType.default;
  };

  // Enhanced chat submit handler
  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatMessage.trim() || isAgentTyping) return;

    // Check if session is active before attempting chat
    if (!enhancedSessionId) {
      console.error('No active diagnostic session. Initializing session first...');
      try {
        await initializeEnhancedSession();
        setTimeout(() => {
          handleChatSubmit(e);
        }, 1000);
        return;
      } catch (error) {
        console.error('Failed to initialize session:', error);
        return;
      }
    }

    const message = chatMessage.trim();
    setChatMessage('');
    setIsAgentTyping(true);

    // Add user message to conversation
    const userMessage = {
      role: 'user',
      message,
      timestamp: new Date().toISOString(),
      step: currentStep?.stepNumber || 0
    };
    setConversationHistory(prev => [...prev, userMessage]);

    try {
      // Use enhanced service for chat with additional context
      const response = await enhancedService.chatWithDiagnosticAgent(
        enhancedSessionId, 
        message, 
        {
          findings: stepFindings || null,
          testResults: testResults || null,
          stepNumber: currentStep?.stepNumber || 0,
          stepTitle: currentStep?.title,
          liveDataEnabled: enableLiveData && liveDataConnected,
          visualAidsEnabled: enableVisualAids,
          webSearchEnabled: enableWebSearch
        }
      );

      // Add agent response to conversation
      const agentMessage = {
        role: 'agent',
        message: response.response,
        timestamp: new Date().toISOString(),
        step: currentStep?.stepNumber || 0,
        context: response.context
      };
      setConversationHistory(prev => [...prev, agentMessage]);

    } catch (error) {
      console.error('Enhanced chat error:', error);
      setError('Failed to communicate with diagnostic assistant');
    } finally {
      setIsAgentTyping(false);
    }
  };

  // Enhanced step completion handler
  const handleStepComplete = async () => {
    if (!currentStep) return;

    try {
      const stepData = {
        findings: stepFindings,
        testResults: testResults,
        notes: stepNotes,
        confidence: confidence,
        liveDataSummary: enableLiveData ? {
          dataPoints: liveData.length,
          latestValues: liveData.slice(-5),
          triggers: diagnosticTriggers.slice(-5)
        } : null,
        generatedCharts: generatedCharts.map(chart => ({
          filename: chart.filename,
          path: chart.path,
          imageId: chart.imageId
        })),
        searchResults: searchResults.slice(-3),
        visualAids: visualAids.slice(-5)
      };

      // Call parent callback with enhanced structured results
      if (onStepComplete) {
        const structuredResults = [{
          testResults,
          findings: stepFindings,
          completedParameters: Object.values(testResults).filter(v => v.trim()).length,
          totalParameters: expectedParameters.length,
          liveDataSummary: stepData.liveDataSummary,
          chartsGenerated: generatedCharts.length,
          searchResultsCount: searchResults.length,
          visualAidsCount: visualAids.length,
          timestamp: new Date().toISOString()
        }];
        onStepComplete(currentStep.id, stepFindings, structuredResults, stepNotes);
      }

      // Auto-generate final step analysis if enabled
      if (autoGenerationEnabled && enhancedSessionId) {
        await enhancedService.generateDiagnosticCharts(enhancedSessionId);
      }

      // Move to next step
      const nextStepIndex = session.steps.findIndex(step => step.id === currentStep.id) + 1;
      if (nextStepIndex < session.steps.length) {
        const nextStep = session.steps[nextStepIndex];
        setCurrentStep(nextStep);
        const params = getExpectedParameters(nextStep);
        setExpectedParameters(params);
        
        // Reset test results for new step
        const newTestResults = {};
        params.forEach(param => {
          newTestResults[param] = '';
        });
        setTestResults(newTestResults);
      } else {
        // Session complete
        if (onSessionComplete) {
          onSessionComplete({
            ...session,
            sessionSummary,
            enhancedData: {
              liveDataPoints: liveData.length,
              chartsGenerated: generatedCharts.length,
              searchResults: searchResults.length,
              visualAids: visualAids.length
            }
          });
        }
      }

      // Reset step form
      setStepFindings('');
      setTestResults({});
      setStepNotes('');
      setConfidence(70);

    } catch (error) {
      console.error('Error completing enhanced step:', error);
      setError('Failed to complete step');
    }
  };

  // Enhanced action handlers
  const handleGenerateCharts = async () => {
    if (enhancedSessionId && enableAutoGeneration) {
      try {
        setIsLoading(true);
        await enhancedService.generateDiagnosticCharts(enhancedSessionId);
      } catch (error) {
        console.error('Failed to generate charts:', error);
        setError('Failed to generate charts');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleSearchRecalls = async () => {
    if (enhancedSessionId && enableWebSearch) {
      setWebSearchLoading(true);
      try {
        await enhancedService.searchRecallsAndTSBs(enhancedSessionId);
      } catch (error) {
        console.error('Failed to search recalls:', error);
        setError('Failed to search recalls');
      } finally {
        setWebSearchLoading(false);
      }
    }
  };

  const handleSearchTechnicalImages = async (query) => {
    if (enhancedSessionId && enableVisualAids) {
      try {
        const searchQuery = query || `${session?.vehicleInfo?.year} ${session?.vehicleInfo?.make} ${session?.vehicleInfo?.model} ${currentStep?.title || 'diagnostic'}`;
        await enhancedService.searchTechnicalImages(enhancedSessionId, searchQuery);
      } catch (error) {
        console.error('Failed to search technical images:', error);
        setError('Failed to search technical images');
      }
    }
  };

  // Clear functions
  const clearCharts = () => {
    setGeneratedCharts([]);
    setPythonCharts([]);
  };

  const clearSearchResults = () => {
    setSearchResults([]);
  };

  const clearVisualAids = () => {
    setVisualAids([]);
  };

  // Theme classes
  const themeClasses = theme === 'dark' ? {
    bg: 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900',
    bgSecondary: 'bg-slate-800/80',
    bgTertiary: 'bg-gray-700/70',
    text: 'text-slate-100',
    textSecondary: 'text-slate-200',
    textMuted: 'text-slate-400',
    border: 'border-slate-700',
    input: 'bg-gray-800/70 border-slate-700 text-slate-100',
    button: 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30',
    buttonSecondary: 'bg-slate-700 hover:bg-slate-600'
  } : {
    bg: 'bg-white',
    bgSecondary: 'bg-gray-50',
    bgTertiary: 'bg-gray-100',
    text: 'text-gray-900',
    textSecondary: 'text-gray-700',
    textMuted: 'text-gray-500',
    border: 'border-gray-300',
    input: 'bg-white border-gray-300 text-gray-900',
    button: 'bg-blue-600 hover:bg-blue-700',
    buttonSecondary: 'bg-gray-200 hover:bg-gray-300'
  };

  // Tab navigation component
  const TabNavigation = () => {
    const tabs = [
      { id: 'step', label: 'Diagnostic Step', icon: Wrench, count: null },
      { id: 'liveData', label: 'Live Data', icon: Activity, count: liveData.length },
      { id: 'charts', label: 'Charts', icon: BarChart3, count: generatedCharts.length },
      { id: 'search', label: 'Web Search', icon: Search, count: searchResults.length },
      { id: 'visualAids', label: 'Visual Aids', icon: ImageIcon, count: visualAids.length }
    ];

    return (
      <div className="flex space-x-1 bg-gray-700/50 p-1 rounded-lg mb-6">
        {tabs.map(tab => {
          const IconComponent = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-all duration-200 ${
                isActive 
                  ? 'bg-blue-600 text-white shadow-lg' 
                  : 'text-gray-300 hover:bg-gray-600/50 hover:text-white'
              }`}
            >
              <IconComponent className="w-4 h-4" />
              <span className="font-medium">{tab.label}</span>
              {tab.count !== null && tab.count > 0 && (
                <span className={`px-2 py-1 text-xs rounded-full ${
                  isActive ? 'bg-white/20' : 'bg-gray-600 text-gray-300'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  };

  // Render current step panel
  const renderStepPanel = () => (
    <div className="space-y-6">
      {/* Step Header */}
      <div className={`${themeClasses.bgSecondary} p-6 rounded-lg border ${themeClasses.border}`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">
            Step {currentStep?.stepNumber || 1} of {session?.steps?.length || 1}
          </h2>
          <div className="flex items-center space-x-3">
            <span className={`flex items-center gap-2 ${themeClasses.textMuted} font-medium`}>
              <Clock className="w-5 h-5" />
              {currentStep?.estimatedTime || '15'} min
            </span>
            <span className={`px-3 py-1.5 rounded-md text-sm font-semibold ${
              currentStep?.difficulty === 'easy' ? 'bg-emerald-800 text-emerald-300' :
              currentStep?.difficulty === 'medium' ? 'bg-amber-800 text-amber-300' :
              'bg-red-800 text-red-300'
            }`}>
              {currentStep?.difficulty || 'medium'}
            </span>
          </div>
        </div>

        <h3 className="text-xl font-bold mb-2">{currentStep?.title || 'Loading...'}</h3>
        <p className={`${themeClasses.textSecondary} text-base leading-relaxed mb-4`}>
          {currentStep?.description || 'Loading step description...'}
        </p>

        {currentStep?.safetyWarning && (
          <div className="bg-amber-900/40 border border-amber-700/60 p-4 rounded-lg mb-4">
            <div className="flex items-center gap-3 text-amber-200">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-semibold text-lg">Safety Warning</span>
            </div>
            <p className="text-amber-100 mt-2 text-base">{currentStep.safetyWarning}</p>
          </div>
        )}

        {currentStep?.tools && currentStep.tools.length > 0 && (
          <div>
            <h4 className="font-semibold text-lg mb-3">Required Tools:</h4>
            <div className="flex flex-wrap gap-2">
              {currentStep.tools.map((tool, index) => (
                <span key={index} className="bg-blue-900/30 text-blue-200 text-sm px-3 py-1 rounded-full">
                  {tool}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Step Input Forms */}
      <div className={`${themeClasses.bgSecondary} p-6 rounded-lg border ${themeClasses.border} space-y-6`}>
        {/* Expected Parameters */}
        {expectedParameters.length > 0 && (
          <div>
            <label className="block text-base font-semibold mb-3">
              Test Results & Measurements
            </label>
            <div className="space-y-4">
              {expectedParameters.map((param) => (
                <div key={param}>
                  <label className="block text-sm text-slate-400 mb-2">
                    {param}
                  </label>
                  <input
                    type="text"
                    value={testResults[param] || ''}
                    onChange={(e) => setTestResults(prev => ({ ...prev, [param]: e.target.value }))}
                    placeholder={getParameterPlaceholder(param)}
                    className={`w-full p-3 rounded-md ${themeClasses.input} text-base border focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all`}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Additional Findings */}
        <div>
          <label className="block text-base font-semibold mb-3">
            Additional Findings & Observations
          </label>
          <textarea
            value={stepFindings}
            onChange={(e) => setStepFindings(e.target.value)}
            placeholder="Describe any additional observations or notes about this step..."
            className={`w-full h-24 p-4 rounded-md ${themeClasses.input} resize-none text-base border focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all`}
          />
        </div>

        {/* Confidence Level */}
        <div>
          <label className="block text-base font-semibold mb-3">
            Confidence Level: <span className="text-blue-400 font-bold">{confidence}%</span>
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={confidence}
            onChange={(e) => setConfidence(parseInt(e.target.value))}
            className="w-full h-3 bg-slate-600 rounded-lg appearance-none cursor-pointer slider"
          />
        </div>

        {/* Additional Notes */}
        <div>
          <label className="block text-base font-semibold mb-3">
            Additional Notes
          </label>
          <textarea
            value={stepNotes}
            onChange={(e) => setStepNotes(e.target.value)}
            placeholder="Any additional notes about this step..."
            className={`w-full h-20 p-4 rounded-md ${themeClasses.input} resize-none text-base border focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all`}
          />
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleGenerateCharts}
            disabled={isLoading || !enableAutoGeneration}
            className={`${themeClasses.buttonSecondary} ${themeClasses.text} py-2 px-4 rounded-md font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-all duration-200`}
          >
            <BarChart3 className="w-4 h-4" />
            Generate Charts
          </button>
          
          <button
            onClick={handleSearchRecalls}
            disabled={webSearchLoading || !enableWebSearch}
            className={`${themeClasses.buttonSecondary} ${themeClasses.text} py-2 px-4 rounded-md font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-all duration-200`}
          >
            <Search className="w-4 h-4" />
            Search Recalls
          </button>
        </div>

        {/* Step Actions */}
        <div className="flex gap-3 pt-4 border-t border-slate-700">
          <button
            onClick={handleStepComplete}
            disabled={(!Object.values(testResults).some(v => v.trim()) && !stepFindings.trim()) || isLoading}
            className={`flex-1 ${themeClasses.button} text-white py-3 px-6 rounded-md font-semibold text-base flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transition-all duration-200 hover:shadow-xl`}
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
            Complete Step
          </button>
          <button
            onClick={onStepSkip}
            className={`px-6 py-3 ${themeClasses.buttonSecondary} ${themeClasses.text} rounded-md font-semibold text-base shadow-lg transition-all duration-200 hover:shadow-xl`}
          >
            Skip
          </button>
        </div>
      </div>

      {/* AI Chat Panel */}
      <div className={`${themeClasses.bgSecondary} rounded-lg border ${themeClasses.border} overflow-hidden`}>
        <div className="p-4 border-b ${themeClasses.border}">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Brain className="w-5 h-5 text-blue-400" />
            AI Diagnostic Assistant
            {conversationHistory.length > 0 && (
              <span className="bg-blue-600 text-white text-xs font-semibold px-2 py-1 rounded-full">
                {conversationHistory.length}
              </span>
            )}
          </h3>
        </div>

        {/* Chat Messages */}
        <div ref={chatContainerRef} className="h-64 overflow-y-auto p-4 space-y-4">
          {conversationHistory.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              <Brain className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Start a conversation with the AI diagnostic assistant...</p>
            </div>
          ) : (
            conversationHistory.map((entry, idx) => (
              <div key={idx} className={`flex ${entry.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-3 rounded-lg ${
                  entry.role === 'user' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-600 text-gray-100'
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    {entry.role === 'user' ? (
                      <User className="w-4 h-4" />
                    ) : (
                      <Bot className="w-4 h-4" />
                    )}
                    <span className="text-xs opacity-70">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{entry.message}</p>
                </div>
              </div>
            ))
          )}
          
          {isAgentTyping && (
            <div className="flex justify-start">
              <div className="bg-gray-600 text-gray-100 p-3 rounded-lg">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4" />
                  <span className="text-xs opacity-70">AI is typing...</span>
                </div>
                <div className="flex space-x-1 mt-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Chat Input */}
        <div className="p-4 border-t ${themeClasses.border}">
          <form onSubmit={handleChatSubmit} className="flex gap-3">
            <input
              ref={messageInputRef}
              type="text"
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              placeholder={enhancedSessionId ? "Ask the AI assistant..." : "Initializing session..."}
              className={`flex-1 p-3 rounded-md ${themeClasses.input} text-base border focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all`}
              disabled={isAgentTyping || !enhancedSessionId}
            />
            <button
              type="submit"
              disabled={!chatMessage.trim() || isAgentTyping || !enhancedSessionId}
              className={`${themeClasses.button} text-white p-3 rounded-md disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transition-all duration-200 hover:shadow-xl`}
              title={!enhancedSessionId ? "Initializing diagnostic session..." : "Send message"}
            >
              {isLoading && !isAgentTyping ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  // Helper function for parameter placeholders
  const getParameterPlaceholder = (parameter) => {
    const placeholderMap = {
      'Voltage Reading': 'e.g., 12.6V',
      'Load Test Result': 'e.g., Passed / Failed',
      'Temperature': 'e.g., 85°F or 29°C',
      'Pressure PSI': 'e.g., 35 PSI',
      'Leak Rate': 'e.g., 2 PSI/min',
      'Resistance Ohms': 'e.g., 2.3Ω',
      'Continuity': 'e.g., Good / Poor / None',
      'Condition': 'e.g., Good / Fair / Poor',
      'Wear Level': 'e.g., 25% worn',
      'Damage Description': 'e.g., Minor crack on left side',
      'DTC Codes': 'e.g., P0420, P0171',
      'Freeze Frame Data': 'e.g., RPM: 2500, Load: 45%',
      'Monitor Status': 'e.g., Ready / Not Ready',
      'Measurement Value': 'Enter your measurement',
      'Notes': 'Additional notes'
    };
    return placeholderMap[parameter] || `Enter ${parameter.toLowerCase()}`;
  };

  // Main render
  if (!session) {
    return (
      <div className={`${themeClasses.bg} border ${themeClasses.border} ${themeClasses.text} p-8 rounded-lg shadow-xl text-center`}>
        <AlertTriangle className="w-16 h-16 mx-auto mb-6 text-amber-500" />
        <h3 className="text-2xl font-bold mb-4">No Diagnostic Session</h3>
        <p className={`${themeClasses.textMuted} text-base`}>Please select a DTC code and vehicle to begin diagnostics.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${themeClasses.bg} border border-red-500 ${themeClasses.text} p-8 rounded-lg shadow-xl text-center`}>
        <AlertTriangle className="w-16 h-16 mx-auto mb-6 text-red-500" />
        <h3 className="text-2xl font-bold mb-4">Error</h3>
        <p className="text-red-400 text-base mb-4">{error}</p>
        <button
          onClick={() => {
            setError(null);
            initializeEnhancedSession();
          }}
          className={`${themeClasses.button} text-white px-6 py-3 rounded-md font-semibold`}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={`${themeClasses.bg} ${themeClasses.text} rounded-lg shadow-xl min-h-screen ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* Header */}
      <div className={`${themeClasses.bgSecondary} p-6 ${isFullscreen ? '' : 'rounded-t-lg'} border-b ${themeClasses.border} shadow-lg`}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Wrench className="w-8 h-8 text-blue-400" />
              Enhanced Diagnostic Assistant
            </h1>
            <p className="text-gray-400 mt-2 flex items-center gap-4">
              <span>{session?.vehicleInfo?.year} {session?.vehicleInfo?.make} {session?.vehicleInfo?.model}</span>
              <span>•</span>
              <span>DTC: {session?.dtcCode}</span>
              {liveDataConnected && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1 text-green-400">
                    <Activity className="w-4 h-4" />
                    Live Data Connected
                  </span>
                </>
              )}
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className={`p-3 ${themeClasses.buttonSecondary} ${themeClasses.text} rounded-md transition-colors`}
              title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            >
              <Maximize2 className="w-5 h-5" />
            </button>
            
            <button
              onClick={() => setAutoGenerationEnabled(!autoGenerationEnabled)}
              className={`p-3 ${autoGenerationEnabled ? 'bg-green-600 hover:bg-green-700' : themeClasses.buttonSecondary} text-white rounded-md transition-colors`}
              title="Toggle Auto-Generation"
            >
              <Zap className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Tab Navigation */}
        <TabNavigation />

        {/* Tab Content */}
        <div className="min-h-[600px]">
          {activeTab === 'step' && renderStepPanel()}
          
          {activeTab === 'liveData' && enableLiveData && (
            <LiveDataVisualization
              sessionId={enhancedSessionId}
              liveData={liveData}
              diagnosticService={enhancedService}
              currentStep={currentStep}
              theme={theme}
            />
          )}
          
          {activeTab === 'charts' && (
            <EnhancedChartDisplay
              charts={generatedCharts}
              onClear={clearCharts}
              theme={theme}
              allowDownload={true}
              allowDelete={true}
            />
          )}
          
          {activeTab === 'search' && enableWebSearch && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Globe className="w-6 h-6 text-blue-400" />
                  Web Search Results ({searchResults.length})
                </h2>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleSearchRecalls}
                    disabled={webSearchLoading}
                    className={`px-4 py-2 ${themeClasses.button} text-white rounded-md flex items-center space-x-2 disabled:opacity-50`}
                  >
                    {webSearchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    <span>Search Recalls</span>
                  </button>
                  <button
                    onClick={clearSearchResults}
                    className={`px-4 py-2 ${themeClasses.buttonSecondary} ${themeClasses.text} rounded-md`}
                  >
                    Clear Results
                  </button>
                </div>
              </div>
              
              {searchResults.length === 0 ? (
                <div className={`${themeClasses.bgSecondary} rounded-lg p-8 text-center`}>
                  <Search className="w-16 h-16 mx-auto mb-4 text-gray-500" />
                  <h3 className="text-xl font-semibold mb-2">No Search Results</h3>
                  <p className="text-gray-400">Click "Search Recalls" to find relevant information for this vehicle and DTC.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {searchResults.map((result, index) => (
                    <div key={index} className={`${themeClasses.bgSecondary} p-4 rounded-lg border ${themeClasses.border}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-blue-400">{result.type}</span>
                        <span className="text-xs text-gray-500">{new Date(result.timestamp).toLocaleString()}</span>
                      </div>
                      <div className="text-sm text-gray-300 whitespace-pre-wrap">{result.results}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'visualAids' && enableVisualAids && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <ImageIcon className="w-6 h-6 text-blue-400" />
                  Visual Diagnostic Aids ({visualAids.reduce((sum, aid) => sum + aid.images.length, 0)})
                </h2>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => handleSearchTechnicalImages()}
                    className={`px-4 py-2 ${themeClasses.button} text-white rounded-md flex items-center space-x-2`}
                  >
                    <ImageIcon className="w-4 h-4" />
                    <span>Search Images</span>
                  </button>
                  <button
                    onClick={clearVisualAids}
                    className={`px-4 py-2 ${themeClasses.buttonSecondary} ${themeClasses.text} rounded-md`}
                  >
                    Clear Images
                  </button>
                </div>
              </div>
              
              {visualAids.length === 0 ? (
                <div className={`${themeClasses.bgSecondary} rounded-lg p-8 text-center`}>
                  <ImageIcon className="w-16 h-16 mx-auto mb-4 text-gray-500" />
                  <h3 className="text-xl font-semibold mb-2">No Visual Aids</h3>
                  <p className="text-gray-400">Click "Search Images" to find technical diagrams and visual references.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {visualAids.map((aid, aidIndex) => (
                    <div key={aidIndex} className={`${themeClasses.bgSecondary} p-4 rounded-lg border ${themeClasses.border}`}>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold">{aid.type} Results</h3>
                        <span className="text-xs text-gray-500">{new Date(aid.timestamp).toLocaleString()}</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {aid.images.map((image, imageIndex) => (
                          <div key={imageIndex} className="bg-gray-700 rounded-lg overflow-hidden">
                            <img
                              src={image.thumbnailUrl || image.imageUrl}
                              alt={image.title}
                              className="w-full h-48 object-cover cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => window.open(image.imageUrl, '_blank')}
                            />
                            <div className="p-3">
                              <h4 className="font-medium text-sm truncate">{image.title}</h4>
                              <p className="text-xs text-gray-400 mt-1">{image.source}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Diagnostic Triggers Alert */}
      {diagnosticTriggers.length > 0 && (
        <div className="fixed bottom-4 right-4 space-y-2 z-40">
          {diagnosticTriggers.slice(-3).map((trigger, index) => (
            <div
              key={index}
              className={`p-4 rounded-lg border-l-4 max-w-sm shadow-lg ${
                trigger.severity === 'high'
                  ? 'bg-red-900/90 border-red-500 text-red-200'
                  : trigger.severity === 'medium'
                  ? 'bg-yellow-900/90 border-yellow-500 text-yellow-200'
                  : 'bg-blue-900/90 border-blue-500 text-blue-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                <span className="font-medium text-sm">{trigger.message}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EnhancedDiagnosticStepManager;