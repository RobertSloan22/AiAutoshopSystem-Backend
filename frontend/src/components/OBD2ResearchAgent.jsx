import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';
import { Separator } from './ui/separator';
import { Search, Send, X, Plug, PlugZap, Car, Activity, AlertTriangle, Download, FileText, Play, Square } from 'lucide-react';
import { cn } from '../lib/utils';
import ResearchResults from '../pages/dashboard/pythoncomponent/ResearchResults';
import { useResearchAgent } from '../hooks/useResearchAgent';
import { useOBD2 } from '../hooks/useOBD2';
import ResearchServerStatusIndicator from './WebSocketStatusIndicator';
import { ErrorBoundary } from 'react-error-boundary';
import ConnectionErrorFallback from './ConnectionErrorFallback';
import { getResearchAgentUrl } from '../utils/apiConfig';
import '../app/src/app/components/layout/TopBarStyles.css';

// OBD2 Status Display Component
export const OBD2StatusDisplay = ({ vehicleState, dtcCodes, isConnected }) => {
  if (!isConnected) {
    return (
      <div className="p-3 bg-gray-800 rounded-lg border border-gray-700">
        <p className="text-gray-400 text-sm">No OBD2 connection</p>
      </div>
    );
  }

  return (
    <div className="p-3 bg-gray-800 rounded-lg border border-gray-700 space-y-2">
      <div className="flex items-center gap-2">
        <Car className="h-4 w-4 text-blue-400" />
        <span className="text-sm font-medium text-white">Vehicle Status</span>
      </div>
      
      {vehicleState && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="text-gray-300">
            RPM: <span className="text-white">{vehicleState.rpm || 'N/A'}</span>
          </div>
          <div className="text-gray-300">
            Speed: <span className="text-white">{vehicleState.speed || 'N/A'} km/h</span>
          </div>
          <div className="text-gray-300">
            Engine Load: <span className="text-white">{vehicleState.engineLoad || 'N/A'}%</span>
          </div>
          <div className="text-gray-300">
            Fuel Level: <span className="text-white">{vehicleState.fuelLevel || 'N/A'}%</span>
          </div>
        </div>
      )}
      
      {dtcCodes && dtcCodes.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-600">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-3 w-3 text-red-400" />
            <span className="text-xs text-red-400">Active DTCs: {dtcCodes.length}</span>
          </div>
        </div>
      )}
    </div>
  );
};

// OBD2 Connection Controls
export const OBD2ConnectionControls = ({ 
  isConnected, 
  isConnecting, 
  onConnect, 
  onDisconnect, 
  vehicleId, 
  setVehicleId 
}) => {
  return (
    <div className="p-4 bg-gray-800 border-b border-gray-700">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <Input
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
            placeholder="Enter Vehicle ID..."
            className="bg-gray-900 text-white border-gray-700"
            disabled={isConnected}
          />
        </div>
        <Button
          onClick={isConnected ? onDisconnect : onConnect}
          disabled={isConnecting || (!vehicleId && !isConnected)}
          className={cn(
            "modern-btn",
            isConnected ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"
          )}
        >
          {isConnecting ? (
            <>
              <div className="animate-spin h-4 w-4 border-2 border-white border-opacity-50 border-t-white rounded-full"></div>
              <span className="ml-2">Connecting...</span>
            </>
          ) : isConnected ? (
            <>
              <Square className="h-4 w-4" />
              <span className="ml-2">Disconnect</span>
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              <span className="ml-2">Connect OBD2</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

// Enhanced Research Input with OBD2 context
export const OBD2ResearchInput = ({ 
  value, 
  onChange, 
  onSend, 
  onResearch, 
  onAnalyze,
  disabled = false,
  hasOBD2Data = false 
}) => {
  const [analysisType, setAnalysisType] = useState('general');
  
  return (
    <div className="p-4 bg-gray-800 space-y-3">
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          placeholder="Ask about vehicle diagnostics, research topics, or analyze OBD2 data..."
          className="flex-1 bg-gray-900 text-white border-gray-700"
          disabled={disabled}
        />
        <Button
          variant="default"
          size="default"
          onClick={onSend}
          disabled={disabled || !value.trim()}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Send className="h-4 w-4 mr-2" />
          <span>Send</span>
        </Button>
      </div>
      
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="default"
          onClick={onResearch}
          disabled={disabled || !value.trim()}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          <Search className="h-4 w-4 mr-2" />
          <span>Research</span>
        </Button>
        
        {hasOBD2Data && (
          <>
            <select
              value={analysisType}
              onChange={(e) => setAnalysisType(e.target.value)}
              className="px-3 py-2 bg-gray-900 text-white border border-gray-700 rounded text-sm"
            >
              <option value="general">General Analysis</option>
              <option value="performance">Performance Analysis</option>
              <option value="diagnostics">Diagnostic Analysis</option>
              <option value="efficiency">Fuel Efficiency</option>
              <option value="emissions">Emissions Analysis</option>
            </select>
            <Button
              variant="outline"
              size="default"
              onClick={() => onAnalyze(analysisType)}
              disabled={disabled}
              className="bg-purple-600 hover:bg-purple-700 text-white border-purple-600"
            >
              <Activity className="h-4 w-4 mr-2" />
              <span>Analyze OBD2</span>
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

// Enhanced Message Component with OBD2 data display
export const EnhancedResearchMessage = ({ type, content, message, result, obd2Data }) => {
  return (
    <div
      className={cn(
        "p-3 rounded-lg",
        type === 'error' ? "bg-red-900/50 border border-red-800" :
        type === 'tool_result' ? "bg-blue-900/50 border border-blue-800" :
        type === 'obd2_analysis' ? "bg-purple-900/50 border border-purple-800" :
        type === 'chat' ? "bg-gray-800/50 border border-gray-700" :
        "bg-green-900/50 border border-green-800"
      )}
    >
      {type === 'error' && (
        <p className="text-red-300">{message}</p>
      )}
      {type === 'tool_result' && (
        <pre className="text-gray-200 whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>
      )}
      {type === 'obd2_analysis' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-purple-400" />
            <span className="text-purple-300 font-medium">OBD2 Analysis Result</span>
          </div>
          <div className="text-gray-200">
            <p><strong>Analysis Type:</strong> {result?.analysisType || 'General'}</p>
            <p><strong>Confidence:</strong> {result?.confidence || 'N/A'}</p>
            <div className="mt-2">
              <strong>Result:</strong>
              <pre className="mt-1 text-sm whitespace-pre-wrap">{JSON.stringify(result?.result, null, 2)}</pre>
            </div>
          </div>
        </div>
      )}
      {type === 'response' && (
        <p className="text-gray-200">{content}</p>
      )}
      {type === 'chat' && (
        <p className="text-gray-200">{content}</p>
      )}
      {type === 'connection_ready' && (
        <p className="text-gray-200">{message}</p>
      )}
      {obd2Data && (
        <div className="mt-2 pt-2 border-t border-gray-600">
          <OBD2StatusDisplay 
            vehicleState={obd2Data.vehicleState}
            dtcCodes={obd2Data.dtcCodes}
            isConnected={true}
          />
        </div>
      )}
    </div>
  );
};

// Main OBD2 Research Agent Interface
export const OBD2ResearchAgentInterface = ({
  customHeader,
  customControls,
  showResults,
  onResultsClose,
  initialVehicleId = ""
}) => {
  const [
    { messages, isConnected: researchConnected, connectionError: researchError, researchResult, showResults: internalShowResults, isConnecting: researchConnecting },
    { sendChatMessage, startResearch, reconnect: researchReconnect, closeResults, setResearchQuery }
  ] = useResearchAgent({ standalone: true });

  const {
    isConnected: obd2Connected,
    isConnecting: obd2Connecting,
    connectionError: obd2Error,
    currentSession,
    vehicleState,
    dtcCodes,
    liveData,
    analysisResults,
    isAnalyzing,
    startSession,
    endSession,
    connectToStream,
    triggerAnalysis,
    getCurrentState,
    clearError
  } = useOBD2();

  const [inputValue, setInputValue] = useState('');
  const [vehicleId, setVehicleId] = useState(initialVehicleId);
  const [enhancedMessages, setEnhancedMessages] = useState([]);
  
  // Combine research and OBD2 messages
  useEffect(() => {
    const combined = [...messages];
    
    // Add OBD2 analysis results as messages
    analysisResults.forEach(result => {
      combined.push({
        type: 'obd2_analysis',
        result: result,
        timestamp: new Date()
      });
    });
    
    setEnhancedMessages(combined);
  }, [messages, analysisResults]);
  
  // Determine if we should use external or internal control for results panel
  const effectiveShowResults = typeof showResults !== 'undefined' ? showResults : internalShowResults;
  const handleCloseResults = () => {
    if (onResultsClose) {
      onResultsClose();
    } else {
      closeResults();
    }
  };
  
  const handleSendMessage = () => {
    if (inputValue.trim()) {
      let enhancedMessage = inputValue;
      
      // Add OBD2 context if connected
      if (obd2Connected && vehicleState) {
        enhancedMessage += `\n\nCurrent Vehicle Context:\n`;
        enhancedMessage += `- RPM: ${vehicleState.rpm || 'N/A'}\n`;
        enhancedMessage += `- Speed: ${vehicleState.speed || 'N/A'} km/h\n`;
        enhancedMessage += `- Engine Load: ${vehicleState.engineLoad || 'N/A'}%\n`;
        enhancedMessage += `- Active DTCs: ${dtcCodes.length}`;
        
        if (dtcCodes.length > 0) {
          enhancedMessage += `\n- DTC Codes: ${dtcCodes.map(dtc => dtc.code).join(', ')}`;
        }
      }
      
      sendChatMessage(enhancedMessage);
      setInputValue('');
    }
  };
  
  const handleStartResearch = () => {
    if (inputValue.trim()) {
      setResearchQuery(inputValue);
      startResearch(inputValue);
      setInputValue('');
    }
  };
  
  const handleOBD2Connect = async () => {
    if (!vehicleId.trim()) return;
    
    clearError();
    try {
      const result = await startSession(vehicleId);
      if (result?.success) {
        // Connect to live stream
        setTimeout(() => connectToStream(), 1000);
        
        // Get current state
        getCurrentState(vehicleId);
      }
    } catch (error) {
      console.error('Failed to connect OBD2:', error);
    }
  };
  
  const handleOBD2Disconnect = async () => {
    await endSession();
  };
  
  const handleOBD2Analysis = async (analysisType) => {
    if (!currentSession?.sessionId) return;
    
    try {
      await triggerAnalysis(analysisType, {
        includeContext: inputValue.trim() ? inputValue : undefined
      });
    } catch (error) {
      console.error('Failed to trigger analysis:', error);
    }
  };

  return (
    <ErrorBoundary 
      FallbackComponent={props => (
        <ConnectionErrorFallback {...props} wsUrl={getResearchAgentUrl()} />
      )}
      onReset={() => researchReconnect()}
    >
      <div className="flex h-full">
        <div className="flex-1 flex flex-col bg-gray-900 rounded-lg shadow-lg overflow-hidden">
          <Card className="flex flex-col h-full border-none bg-transparent">
            {customHeader || (
              <div className="p-4 bg-gray-800 text-white flex justify-between items-center shrink-0">
                <div className="flex items-center gap-4">
                  <h2 className="text-xl font-semibold">OBD2 Research Agent</h2>
                  <OBD2StatusDisplay 
                    vehicleState={vehicleState}
                    dtcCodes={dtcCodes}
                    isConnected={obd2Connected}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <ResearchServerStatusIndicator 
                    isConnected={researchConnected}
                    isConnecting={researchConnecting}
                    connectionError={researchError || undefined}
                    onRetryClick={researchReconnect}
                  />
                  {customControls}
                </div>
              </div>
            )}
            
            <OBD2ConnectionControls
              isConnected={obd2Connected}
              isConnecting={obd2Connecting}
              onConnect={handleOBD2Connect}
              onDisconnect={handleOBD2Disconnect}
              vehicleId={vehicleId}
              setVehicleId={setVehicleId}
            />
            
            {(researchError && !researchConnected) && (
              <div className="px-4 py-2 bg-red-900/40 text-red-200 text-sm">
                <p>Research Agent: {researchError}</p>
              </div>
            )}
            
            {(obd2Error && !obd2Connected) && (
              <div className="px-4 py-2 bg-orange-900/40 text-orange-200 text-sm">
                <p>OBD2 Connection: {obd2Error}</p>
              </div>
            )}
            
            <Separator className="bg-gray-700 shrink-0" />
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {enhancedMessages.map((msg, index) => (
                <EnhancedResearchMessage 
                  key={index}
                  type={msg.type}
                  content={msg.content}
                  message={msg.message}
                  result={msg.result}
                  obd2Data={msg.type === 'obd2_analysis' ? { vehicleState, dtcCodes } : undefined}
                />
              ))}
              
              {isAnalyzing && (
                <div className="p-3 bg-purple-900/30 border border-purple-700 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="animate-spin h-4 w-4 border-2 border-purple-400 border-opacity-50 border-t-purple-400 rounded-full"></div>
                    <span className="text-purple-300">Analyzing OBD2 data...</span>
                  </div>
                </div>
              )}
            </div>
            
            <OBD2ResearchInput
              value={inputValue}
              onChange={setInputValue}
              onSend={handleSendMessage}
              onResearch={handleStartResearch}
              onAnalyze={handleOBD2Analysis}
              disabled={!researchConnected}
              hasOBD2Data={obd2Connected && currentSession}
            />
          </Card>
        </div>
        
        {effectiveShowResults && (
          <div className="flex-1 flex flex-col bg-gray-900 bg-opacity-75 rounded-lg shadow-lg overflow-hidden ml-4">
            <Card className="flex flex-col h-full w-full bg-transparent border-none">
              <div className="p-4 bg-gray-800 text-white flex justify-between items-center shrink-0">
                <h2 className="text-2xl">Research Results</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCloseResults}
                  className="text-gray-400 hover:text-white hover:bg-gray-700"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <Separator className="bg-gray-700 shrink-0" />
              <div className="flex-1 overflow-auto p-4">
                <ResearchResults 
                  results={{
                    message: researchResult || "",
                    files: []
                  }}
                />
              </div>
            </Card>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default OBD2ResearchAgentInterface;