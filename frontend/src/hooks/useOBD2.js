import React, { useState, useCallback, useRef, useEffect } from 'react';
import obd2Service from '../services/obd2Service';

export const useOBD2 = (options = {}) => {
  const { autoConnect = false, vehicleId = null } = options;
  
  // State management
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [currentSession, setCurrentSession] = useState(null);
  const [vehicleState, setVehicleState] = useState(null);
  const [dtcCodes, setDtcCodes] = useState([]);
  const [liveData, setLiveData] = useState([]);
  const [analysisResults, setAnalysisResults] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // WebSocket reference
  const wsRef = useRef(null);
  
  // Start OBD2 session
  const startSession = useCallback(async (vehicleId, adapterInfo) => {
    if (!vehicleId) {
      setConnectionError('Vehicle ID is required');
      return null;
    }
    
    setIsConnecting(true);
    setConnectionError(null);
    
    try {
      const response = await obd2Service.startSession(vehicleId, adapterInfo);
      
      if (response.success) {
        setCurrentSession({
          sessionId: response.sessionId,
          vehicleId: response.data.vehicleId,
          startTime: response.data.startTime
        });
        setIsConnected(true);
        return response;
      } else {
        throw new Error(response.error || 'Failed to start session');
      }
    } catch (error) {
      setConnectionError(error.message);
      setIsConnected(false);
      return null;
    } finally {
      setIsConnecting(false);
    }
  }, []);
  
  // End OBD2 session
  const endSession = useCallback(async () => {
    if (!currentSession?.sessionId) {
      return;
    }
    
    try {
      // Close WebSocket if open
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      
      await obd2Service.endSession(currentSession.sessionId);
      
      setCurrentSession(null);
      setIsConnected(false);
      setVehicleState(null);
      setLiveData([]);
      setConnectionError(null);
    } catch (error) {
      console.error('Error ending session:', error);
      setConnectionError(error.message);
    }
  }, [currentSession]);
  
  // Connect to real-time data stream
  const connectToStream = useCallback(async () => {
    if (!currentSession?.sessionId || wsRef.current) {
      return;
    }
    
    try {
      const streamInfo = await obd2Service.getStreamInfo(currentSession.sessionId);
      
      if (streamInfo.success) {
        wsRef.current = obd2Service.createWebSocketConnection(
          currentSession.sessionId,
          // onMessage
          (data) => {
            switch (data.type) {
              case 'obd2_data':
                setLiveData(prev => [...prev.slice(-99), data]); // Keep last 100 points
                if (data.vehicleState) {
                  setVehicleState(data.vehicleState);
                }
                if (data.dtcCodes && data.dtcCodes.length > 0) {
                  setDtcCodes(prev => [...prev, ...data.dtcCodes]);
                }
                break;
              case 'vehicle_state':
                setVehicleState(data.state);
                break;
              case 'dtc_update':
                setDtcCodes(data.codes);
                break;
              case 'analysis_result':
                setAnalysisResults(prev => [...prev, data.result]);
                setIsAnalyzing(false);
                break;
              default:
                console.log('Received unknown message type:', data.type);
            }
          },
          // onError
          (error) => {
            console.error('WebSocket error:', error);
            setConnectionError('Real-time connection error');
          },
          // onClose
          (event) => {
            wsRef.current = null;
            if (event.code !== 1000) { // Not a normal closure
              setConnectionError('Real-time connection lost');
            }
          }
        );
      }
    } catch (error) {
      console.error('Error connecting to stream:', error);
      setConnectionError(error.message);
    }
  }, [currentSession]);
  
  // Ingest data point
  const ingestData = useCallback(async (data) => {
    if (!currentSession?.sessionId) {
      throw new Error('No active session');
    }
    
    try {
      return await obd2Service.ingestData(currentSession.sessionId, data);
    } catch (error) {
      console.error('Error ingesting data:', error);
      throw error;
    }
  }, [currentSession]);
  
  // Trigger analysis
  const triggerAnalysis = useCallback(async (analysisType = 'general', options = {}) => {
    if (!currentSession?.sessionId) {
      throw new Error('No active session');
    }
    
    setIsAnalyzing(true);
    
    try {
      const result = await obd2Service.triggerAnalysis(
        currentSession.sessionId,
        analysisType,
        options
      );
      
      if (result.success) {
        // If not using WebSocket, add result directly
        if (!wsRef.current) {
          setAnalysisResults(prev => [...prev, result.data]);
          setIsAnalyzing(false);
        }
      }
      
      return result;
    } catch (error) {
      setIsAnalyzing(false);
      console.error('Error triggering analysis:', error);
      throw error;
    }
  }, [currentSession]);
  
  // Get vehicle current state
  const getCurrentState = useCallback(async (vehicleId) => {
    try {
      const response = await obd2Service.getCurrentState(vehicleId);
      if (response.success) {
        setVehicleState(response.data.vehicleState);
        setDtcCodes(response.data.activeDTCs || []);
        return response.data;
      }
      return null;
    } catch (error) {
      console.error('Error getting current state:', error);
      throw error;
    }
  }, []);
  
  // Get data history
  const getDataHistory = useCallback(async (vehicleId, options = {}) => {
    try {
      return await obd2Service.getDataHistory(vehicleId, options);
    } catch (error) {
      console.error('Error getting data history:', error);
      throw error;
    }
  }, []);
  
  // Clear DTC codes
  const clearDTCCodes = useCallback(async (vehicleId, codes) => {
    try {
      const result = await obd2Service.clearDTCCodes(vehicleId, codes);
      if (result.success) {
        // Remove cleared codes from local state
        setDtcCodes(prev => prev.filter(dtc => !codes.includes(dtc.code)));
      }
      return result;
    } catch (error) {
      console.error('Error clearing DTC codes:', error);
      throw error;
    }
  }, []);
  
  // Get data quality report
  const getDataQualityReport = useCallback(async () => {
    if (!currentSession?.sessionId) {
      throw new Error('No active session');
    }
    
    try {
      return await obd2Service.getDataQualityReport(currentSession.sessionId);
    } catch (error) {
      console.error('Error getting data quality report:', error);
      throw error;
    }
  }, [currentSession]);
  
  // Export data
  const exportData = useCallback(async (vehicleId, options = {}) => {
    try {
      return await obd2Service.exportData(vehicleId, options);
    } catch (error) {
      console.error('Error exporting data:', error);
      throw error;
    }
  }, []);
  
  // Auto-connect effect
  useEffect(() => {
    if (autoConnect && vehicleId && !isConnected && !isConnecting) {
      startSession(vehicleId);
    }
  }, [autoConnect, vehicleId, isConnected, isConnecting, startSession]);
  
  // Cleanup effect
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);
  
  return {
    // State
    isConnected,
    isConnecting,
    connectionError,
    currentSession,
    vehicleState,
    dtcCodes,
    liveData,
    analysisResults,
    isAnalyzing,
    
    // Actions
    startSession,
    endSession,
    connectToStream,
    ingestData,
    triggerAnalysis,
    getCurrentState,
    getDataHistory,
    clearDTCCodes,
    getDataQualityReport,
    exportData,
    
    // Utilities
    clearError: () => setConnectionError(null),
    clearLiveData: () => setLiveData([]),
    clearAnalysisResults: () => setAnalysisResults([])
  };
};