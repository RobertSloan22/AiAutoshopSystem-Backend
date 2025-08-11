# Diagnostic Agents Frontend Integration Guide

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [API Endpoints](#api-endpoints)
4. [Data Structures](#data-structures)
5. [Frontend Service Integration](#frontend-service-integration)
6. [React Component Examples](#react-component-examples)
7. [State Management](#state-management)
8. [Error Handling](#error-handling)
9. [Testing Strategy](#testing-strategy)
10. [Performance Optimization](#performance-optimization)
11. [Deployment Considerations](#deployment-considerations)

## Overview

The Diagnostic Agents system provides AI-powered automotive diagnostic capabilities through three specialized agents:

- **Diagnostic Interpreter Agent**: Expert technician guidance for interpreting test results
- **Step Planner Agent**: Workflow optimization based on diagnostic findings
- **Context Manager Agent**: Session state management and pattern recognition

This guide provides comprehensive instructions for integrating these agents into your React frontend.

## Architecture

### System Architecture
```
Frontend (React)
    ↕ HTTP/REST API
Backend Express Server
    ↕ Agent Communication
OpenAI Agents (@openai/agents)
    ↕ AI Processing
Specialized AI Agents (3)
```

### Integration Pattern
Your frontend follows the established pattern seen in `StreamingDashboard.jsx` and `OBD2IntegratedComponents.jsx`:
1. Service layer for API communication
2. Custom hooks for state management
3. Component-based UI architecture
4. Real-time data handling capabilities

## API Endpoints

### Base URL
```javascript
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';
const DIAGNOSTIC_AGENTS_URL = `${API_BASE_URL}/api/diagnostic-agents`;
```

### Available Endpoints

#### 1. Session Management
```javascript
// Create new diagnostic session
POST /api/diagnostic-agents/sessions
Content-Type: application/json

{
  "dtcCode": "P0171",
  "vehicleInfo": {
    "year": 2020,
    "make": "BMW",
    "model": "X3",
    "vin": "WBAXG5C58KDT12345",
    "engine": "2.0L Turbo"
  },
  "researchData": {
    "possibleCauses": [
      { "cause": "Mass Air Flow Sensor", "likelihood": "High" },
      { "cause": "Fuel Injectors", "likelihood": "Medium" }
    ],
    "technicalNotes": {
      "commonIssues": ["MAF sensor contamination", "Vacuum leaks"]
    }
  },
  "diagnosticSteps": [
    {
      "id": "step_1",
      "title": "Visual Inspection",
      "description": "Check for obvious vacuum leaks, damaged hoses",
      "expectedResults": "No visible damage",
      "tools": ["Flashlight", "Visual inspection"]
    }
  ]
}

Response:
{
  "success": true,
  "sessionId": "diag_1704067200_abc123",
  "session": {
    "id": "diag_1704067200_abc123",
    "dtcCode": "P0171",
    "vehicleInfo": {...},
    "currentStepIndex": 0,
    "totalSteps": 5,
    "status": "active"
  }
}
```

#### 2. Get Current Step
```javascript
GET /api/diagnostic-agents/sessions/{sessionId}/current-step

Response:
{
  "success": true,
  "currentStep": {
    "id": "step_1",
    "title": "Visual Inspection",
    "description": "Check for obvious vacuum leaks, damaged hoses",
    "stepNumber": 1,
    "totalSteps": 5,
    "context": {
      "dtcCode": "P0171",
      "vehicleInfo": {...},
      "researchData": {...},
      "previousFindings": {},
      "conversationHistory": []
    }
  },
  "session": {
    "id": "diag_1704067200_abc123",
    "currentStepIndex": 0,
    "confidence": 0,
    "status": "active"
  }
}
```

#### 3. Chat with Diagnostic Agent
```javascript
POST /api/diagnostic-agents/sessions/{sessionId}/chat
Content-Type: application/json

{
  "message": "I found a cracked vacuum hose near the throttle body",
  "findings": "Vacuum leak detected",
  "testResults": {
    "vacuumPressure": "15 inHg",
    "location": "throttle body area"
  }
}

Response:
{
  "success": true,
  "response": "Excellent find! A cracked vacuum hose near the throttle body is a common cause of P0171. This vacuum leak causes unmetered air to enter the engine, creating a lean condition. I recommend replacing the damaged hose and checking for additional leaks using carburetor cleaner spray around suspect areas. After replacement, clear the code and road test to verify the fix.",
  "context": {
    "stepNumber": 1,
    "totalSteps": 5,
    "currentFindings": {
      "step_1": "Vacuum leak detected"
    }
  }
}
```

#### 4. Complete Step
```javascript
POST /api/diagnostic-agents/sessions/{sessionId}/complete-step
Content-Type: application/json

{
  "findings": "Vacuum leak found and repaired",
  "testResults": {
    "beforeRepair": { "vacuumPressure": "15 inHg" },
    "afterRepair": { "vacuumPressure": "20 inHg" }
  },
  "notes": "Replaced cracked vacuum hose, system now holds proper vacuum",
  "confidence": 85
}

Response:
{
  "success": true,
  "stepCompleted": true,
  "nextStepRecommendation": "Based on the successful vacuum hose repair, I recommend proceeding to verify the fix with a road test before moving to fuel system testing. The high confidence level (85%) suggests this may have resolved the P0171 code.",
  "currentStep": 1,
  "totalSteps": 5,
  "isComplete": false,
  "nextStep": {
    "id": "step_2",
    "title": "Road Test Verification",
    "description": "Clear codes and road test to verify repair",
    "stepNumber": 2,
    "context": {...}
  }
}
```

#### 5. Get Session Summary
```javascript
GET /api/diagnostic-agents/sessions/{sessionId}/summary

Response:
{
  "success": true,
  "summary": {
    "sessionId": "diag_1704067200_abc123",
    "dtcCode": "P0171",
    "vehicleInfo": {...},
    "status": "completed",
    "progress": {
      "currentStep": 2,
      "totalSteps": 5,
      "completedSteps": 2,
      "percentage": 40
    },
    "findings": {
      "step_1": "Vacuum leak found and repaired",
      "step_2": "Road test successful, code cleared"
    },
    "conversationHistory": [...],
    "stepHistory": [...],
    "timestamps": {
      "created": "2024-01-01T10:00:00Z",
      "updated": "2024-01-01T11:30:00Z",
      "completed": null
    }
  }
}
```

#### 6. Reset Session
```javascript
POST /api/diagnostic-agents/sessions/{sessionId}/reset
Content-Type: application/json

{
  "resetToStep": 0
}

Response:
{
  "success": true,
  "message": "Session reset to step 1",
  "currentStep": 0,
  "totalSteps": 5
}
```

## Data Structures

### TypeScript Interfaces

```typescript
// Core diagnostic session interface
interface DiagnosticSession {
  id: string;
  dtcCode: string;
  vehicleInfo: VehicleInfo;
  researchData: ResearchData;
  diagnosticSteps: DiagnosticStep[];
  currentStepIndex: number;
  stepHistory: StepResult[];
  conversationHistory: ConversationEntry[];
  findings: { [stepKey: string]: string };
  confidence: number;
  status: 'active' | 'completed' | 'paused';
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

// Vehicle information
interface VehicleInfo {
  year: number;
  make: string;
  model: string;
  vin?: string;
  engine?: string;
  mileage?: number;
  transmission?: string;
}

// Research data from DTC analysis
interface ResearchData {
  possibleCauses?: PossibleCause[];
  technicalNotes?: TechnicalNotes;
  dtcCodes?: DTCInfo[];
}

interface PossibleCause {
  cause: string;
  likelihood: 'High' | 'Medium' | 'Low';
  description?: string;
  estimatedCost?: number;
}

interface TechnicalNotes {
  commonIssues?: string[];
  diagnosticTips?: string[];
  serviceData?: any;
}

// Diagnostic step definition
interface DiagnosticStep {
  id: string;
  title: string;
  description: string;
  expectedResults?: string;
  tools?: string[];
  estimatedTime?: number;
  difficulty?: 'Easy' | 'Medium' | 'Hard';
  safetyNotes?: string[];
}

// Step completion result
interface StepResult {
  stepIndex: number;
  stepId: string;
  title: string;
  findings: string;
  testResults?: any;
  notes?: string;
  confidence: number;
  completedAt: string;
}

// Conversation entry
interface ConversationEntry {
  role: 'user' | 'agent';
  message: string;
  timestamp: string;
  step: number;
}

// API Response types
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

interface SessionCreateResponse {
  success: boolean;
  sessionId: string;
  session: {
    id: string;
    dtcCode: string;
    vehicleInfo: VehicleInfo;
    currentStepIndex: number;
    totalSteps: number;
    status: string;
  };
}

interface ChatResponse {
  success: boolean;
  response: string;
  context: {
    stepNumber: number;
    totalSteps: number;
    currentFindings: { [key: string]: string };
  };
}
```

## Frontend Service Integration

### Diagnostic Agents Service

Create a new service file: `src/services/diagnosticAgentsService.js`

```javascript
// DiagnosticAgentsService.js
class DiagnosticAgentsService {
  constructor() {
    this.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:3000';
    this.apiURL = `${this.baseURL}/api/diagnostic-agents`;
  }

  // Get auth headers (following your existing pattern)
  getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  }

  // Create new diagnostic session
  async createSession(sessionData) {
    try {
      const response = await fetch(`${this.apiURL}/sessions`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(sessionData)
      });

      if (!response.ok) {
        throw new Error(`Failed to create diagnostic session: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating diagnostic session:', error);
      throw error;
    }
  }

  // Get current diagnostic step
  async getCurrentStep(sessionId) {
    try {
      const response = await fetch(`${this.apiURL}/sessions/${sessionId}/current-step`, {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to get current step: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting current step:', error);
      throw error;
    }
  }

  // Chat with diagnostic agent
  async chatWithAgent(sessionId, message, findings = null, testResults = null) {
    try {
      const response = await fetch(`${this.apiURL}/sessions/${sessionId}/chat`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ message, findings, testResults })
      });

      if (!response.ok) {
        throw new Error(`Failed to chat with agent: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error chatting with agent:', error);
      throw error;
    }
  }

  // Complete current step
  async completeStep(sessionId, stepData) {
    try {
      const response = await fetch(`${this.apiURL}/sessions/${sessionId}/complete-step`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(stepData)
      });

      if (!response.ok) {
        throw new Error(`Failed to complete step: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error completing step:', error);
      throw error;
    }
  }

  // Get session summary
  async getSessionSummary(sessionId) {
    try {
      const response = await fetch(`${this.apiURL}/sessions/${sessionId}/summary`, {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to get session summary: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting session summary:', error);
      throw error;
    }
  }

  // Reset session
  async resetSession(sessionId, resetToStep = 0) {
    try {
      const response = await fetch(`${this.apiURL}/sessions/${sessionId}/reset`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ resetToStep })
      });

      if (!response.ok) {
        throw new Error(`Failed to reset session: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error resetting session:', error);
      throw error;
    }
  }
}

export default new DiagnosticAgentsService();
```

### Custom Hook for Diagnostic Agents

Create: `src/hooks/useDiagnosticAgents.js`

```javascript
// useDiagnosticAgents.js
import { useState, useEffect, useCallback } from 'react';
import diagnosticAgentsService from '../services/diagnosticAgentsService';

export const useDiagnosticAgents = () => {
  const [currentSession, setCurrentSession] = useState(null);
  const [currentStep, setCurrentStep] = useState(null);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sessionSummary, setSessionSummary] = useState(null);

  // Create new diagnostic session
  const createSession = useCallback(async (sessionData) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await diagnosticAgentsService.createSession(sessionData);
      setCurrentSession(response.session);
      
      // Load the first step
      await loadCurrentStep(response.sessionId);
      
      return response;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Load current step
  const loadCurrentStep = useCallback(async (sessionId) => {
    if (!sessionId) return;
    
    setLoading(true);
    try {
      const response = await diagnosticAgentsService.getCurrentStep(sessionId);
      setCurrentStep(response.currentStep);
      setCurrentSession(prev => ({ ...prev, ...response.session }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Send message to diagnostic agent
  const sendMessage = useCallback(async (sessionId, message, findings = null, testResults = null) => {
    if (!sessionId) throw new Error('No active session');
    
    setLoading(true);
    try {
      const response = await diagnosticAgentsService.chatWithAgent(sessionId, message, findings, testResults);
      
      // Update conversation history
      setConversationHistory(prev => [
        ...prev,
        { role: 'user', message, timestamp: new Date().toISOString() },
        { role: 'agent', message: response.response, timestamp: new Date().toISOString() }
      ]);
      
      return response;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Complete current step
  const completeStep = useCallback(async (sessionId, stepData) => {
    if (!sessionId) throw new Error('No active session');
    
    setLoading(true);
    try {
      const response = await diagnosticAgentsService.completeStep(sessionId, stepData);
      
      if (response.isComplete) {
        // Session completed
        setSessionSummary(response.finalDiagnosis);
      } else {
        // Load next step
        setCurrentStep(response.nextStep);
      }
      
      setCurrentSession(prev => ({
        ...prev,
        currentStepIndex: response.currentStep
      }));
      
      return response;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Load session summary
  const loadSessionSummary = useCallback(async (sessionId) => {
    if (!sessionId) return;
    
    setLoading(true);
    try {
      const response = await diagnosticAgentsService.getSessionSummary(sessionId);
      setSessionSummary(response.summary);
      setConversationHistory(response.summary.conversationHistory || []);
      return response.summary;
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Reset session
  const resetSession = useCallback(async (sessionId, resetToStep = 0) => {
    if (!sessionId) throw new Error('No active session');
    
    setLoading(true);
    try {
      const response = await diagnosticAgentsService.resetSession(sessionId, resetToStep);
      
      // Reload current step after reset
      await loadCurrentStep(sessionId);
      
      // Clear conversation history for steps beyond reset point
      setConversationHistory(prev => 
        prev.filter(entry => (entry.step || 0) <= resetToStep)
      );
      
      return response;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [loadCurrentStep]);

  // Clear current session
  const clearSession = useCallback(() => {
    setCurrentSession(null);
    setCurrentStep(null);
    setConversationHistory([]);
    setSessionSummary(null);
    setError(null);
  }, []);

  return {
    // State
    currentSession,
    currentStep,
    conversationHistory,
    loading,
    error,
    sessionSummary,
    
    // Actions
    createSession,
    loadCurrentStep,
    sendMessage,
    completeStep,
    loadSessionSummary,
    resetSession,
    clearSession
  };
};

export default useDiagnosticAgents;
```

## React Component Examples

### Main Diagnostic Dashboard Component

Create: `src/components/DiagnosticAgentsDashboard.jsx`

```jsx
// DiagnosticAgentsDashboard.jsx
import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Square, 
  RotateCcw, 
  MessageCircle, 
  CheckCircle, 
  AlertTriangle, 
  Car, 
  Wrench, 
  Clock,
  TrendingUp
} from 'lucide-react';
import { useDiagnosticAgents } from '../hooks/useDiagnosticAgents';

const DiagnosticAgentsDashboard = ({ vehicleInfo, dtcCode, researchData }) => {
  const {
    currentSession,
    currentStep,
    conversationHistory,
    loading,
    error,
    sessionSummary,
    createSession,
    sendMessage,
    completeStep,
    resetSession,
    clearSession
  } = useDiagnosticAgents();

  const [chatMessage, setChatMessage] = useState('');
  const [stepFindings, setStepFindings] = useState('');
  const [stepNotes, setStepNotes] = useState('');
  const [confidence, setConfidence] = useState(50);
  const [showSessionForm, setShowSessionForm] = useState(false);

  // Example diagnostic steps (you would generate these based on DTC code and research)
  const generateDiagnosticSteps = (dtcCode, researchData) => {
    // This is a simplified example - in reality, you'd have more sophisticated logic
    const commonSteps = [
      {
        id: 'step_1',
        title: 'Visual Inspection',
        description: 'Perform visual inspection of related components and wiring',
        expectedResults: 'No visible damage or disconnections',
        tools: ['Flashlight', 'Visual inspection'],
        estimatedTime: 15,
        difficulty: 'Easy'
      },
      {
        id: 'step_2',
        title: 'Data Analysis',
        description: 'Review freeze frame data and current sensor readings',
        expectedResults: 'Identify anomalous readings',
        tools: ['OBD2 Scanner', 'Multimeter'],
        estimatedTime: 20,
        difficulty: 'Medium'
      },
      {
        id: 'step_3',
        title: 'Component Testing',
        description: 'Test suspected components based on initial findings',
        expectedResults: 'Identify faulty component',
        tools: ['Multimeter', 'Oscilloscope'],
        estimatedTime: 30,
        difficulty: 'Medium'
      }
    ];

    return commonSteps;
  };

  // Start new diagnostic session
  const handleStartSession = async () => {
    if (!dtcCode || !vehicleInfo) {
      alert('Please provide DTC code and vehicle information');
      return;
    }

    try {
      const diagnosticSteps = generateDiagnosticSteps(dtcCode, researchData);
      
      const sessionData = {
        dtcCode,
        vehicleInfo,
        researchData,
        diagnosticSteps
      };

      await createSession(sessionData);
      setShowSessionForm(false);
    } catch (err) {
      console.error('Failed to start session:', err);
    }
  };

  // Send chat message to agent
  const handleSendMessage = async () => {
    if (!chatMessage.trim() || !currentSession?.id) return;

    try {
      await sendMessage(currentSession.id, chatMessage);
      setChatMessage('');
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  // Complete current step
  const handleCompleteStep = async () => {
    if (!currentSession?.id || !stepFindings.trim()) {
      alert('Please provide findings for this step');
      return;
    }

    try {
      const stepData = {
        findings: stepFindings,
        notes: stepNotes,
        confidence,
        testResults: {} // Add any test results here
      };

      await completeStep(currentSession.id, stepData);
      
      // Reset form
      setStepFindings('');
      setStepNotes('');
      setConfidence(50);
    } catch (err) {
      console.error('Failed to complete step:', err);
    }
  };

  // Reset session
  const handleResetSession = async () => {
    if (!currentSession?.id) return;

    if (window.confirm('Are you sure you want to reset this diagnostic session?')) {
      try {
        await resetSession(currentSession.id);
      } catch (err) {
        console.error('Failed to reset session:', err);
      }
    }
  };

  return (
    <div className="h-full bg-gray-900 p-6">
      {/* Header */}
      <div className="bg-gray-800 rounded-lg p-4 mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Wrench className="w-6 h-6 text-blue-400" />
              AI Diagnostic Assistant
            </h1>
            <p className="text-gray-400 mt-1">
              Step-by-step diagnostic guidance with AI assistance
            </p>
          </div>
          
          <div className="flex gap-2">
            {currentSession ? (
              <>
                <button
                  onClick={handleResetSession}
                  className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset
                </button>
                <button
                  onClick={clearSession}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded flex items-center gap-2"
                >
                  <Square className="w-4 h-4" />
                  End Session
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowSessionForm(true)}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                Start Diagnosis
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 text-red-300">
            <AlertTriangle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Session Form */}
      {showSessionForm && (
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Start New Diagnostic Session</h2>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-gray-300 mb-2">Vehicle</label>
              <div className="text-white">
                {vehicleInfo ? 
                  `${vehicleInfo.year} ${vehicleInfo.make} ${vehicleInfo.model}` : 
                  'Vehicle info not provided'
                }
              </div>
            </div>
            <div>
              <label className="block text-gray-300 mb-2">DTC Code</label>
              <div className="text-white font-mono">{dtcCode || 'No DTC provided'}</div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleStartSession}
              disabled={loading || !dtcCode || !vehicleInfo}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded"
            >
              {loading ? 'Starting...' : 'Start Session'}
            </button>
            <button
              onClick={() => setShowSessionForm(false)}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Active Session */}
      {currentSession && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Current Step Panel */}
          <div className="lg:col-span-1">
            <div className="bg-gray-800 rounded-lg p-4">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-400" />
                Current Step
              </h2>

              {currentStep ? (
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-blue-300 font-medium">
                        Step {currentStep.stepNumber} of {currentStep.totalSteps}
                      </span>
                      <span className="text-gray-400 text-sm flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {currentStep.estimatedTime || 0}min
                      </span>
                    </div>
                    <h3 className="text-white font-semibold">{currentStep.title}</h3>
                    <p className="text-gray-300 text-sm mt-2">{currentStep.description}</p>
                  </div>

                  {currentStep.tools && (
                    <div>
                      <h4 className="text-gray-300 font-medium text-sm">Required Tools:</h4>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {currentStep.tools.map((tool, idx) => (
                          <span key={idx} className="bg-blue-900 text-blue-200 text-xs px-2 py-1 rounded">
                            {tool}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Step Completion Form */}
                  <div className="space-y-3 border-t border-gray-700 pt-4">
                    <div>
                      <label className="block text-gray-300 text-sm mb-1">Findings</label>
                      <textarea
                        value={stepFindings}
                        onChange={(e) => setStepFindings(e.target.value)}
                        className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm"
                        rows="3"
                        placeholder="Describe what you found during this step..."
                      />
                    </div>

                    <div>
                      <label className="block text-gray-300 text-sm mb-1">Notes</label>
                      <textarea
                        value={stepNotes}
                        onChange={(e) => setStepNotes(e.target.value)}
                        className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm"
                        rows="2"
                        placeholder="Additional notes or observations..."
                      />
                    </div>

                    <div>
                      <label className="block text-gray-300 text-sm mb-1">
                        Confidence: {confidence}%
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={confidence}
                        onChange={(e) => setConfidence(parseInt(e.target.value))}
                        className="w-full"
                      />
                    </div>

                    <button
                      onClick={handleCompleteStep}
                      disabled={loading || !stepFindings.trim()}
                      className="w-full px-4 py-2 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white rounded"
                    >
                      {loading ? 'Completing...' : 'Complete Step'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-gray-400">Loading current step...</div>
              )}
            </div>
          </div>

          {/* Chat Panel */}
          <div className="lg:col-span-2">
            <div className="bg-gray-800 rounded-lg p-4 h-full flex flex-col">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-blue-400" />
                AI Diagnostic Assistant
              </h2>

              {/* Conversation History */}
              <div className="flex-1 bg-gray-700 rounded p-4 mb-4 overflow-y-auto max-h-96">
                {conversationHistory.length === 0 ? (
                  <div className="text-gray-400 text-center">
                    Start a conversation with the diagnostic assistant...
                  </div>
                ) : (
                  <div className="space-y-4">
                    {conversationHistory.map((entry, idx) => (
                      <div key={idx} className={`flex ${entry.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                          entry.role === 'user' 
                            ? 'bg-blue-500 text-white' 
                            : 'bg-gray-600 text-gray-100'
                        }`}>
                          <p className="text-sm">{entry.message}</p>
                          <span className="text-xs opacity-70 mt-1 block">
                            {new Date(entry.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Chat Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  className="flex-1 bg-gray-700 text-white rounded px-3 py-2"
                  placeholder="Ask the diagnostic assistant..."
                  disabled={loading}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={loading || !chatMessage.trim()}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Session Summary */}
      {sessionSummary && (
        <div className="mt-6 bg-gray-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-400" />
            Diagnostic Complete
          </h2>
          <div className="bg-gray-700 rounded p-4">
            <pre className="text-gray-300 whitespace-pre-wrap text-sm">{sessionSummary}</pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default DiagnosticAgentsDashboard;
```

### Integration with Existing OBD2 Components

To integrate with your existing `StreamingDashboard.jsx`, you can add the diagnostic agents as a new tab or panel:

```jsx
// In StreamingDashboard.jsx, add this import
import DiagnosticAgentsDashboard from './DiagnosticAgentsDashboard';

// Add to your dashboard state
const [activeTab, setActiveTab] = useState('streaming'); // Add 'diagnostic' option

// Add tab navigation
const tabOptions = [
  { id: 'streaming', label: 'Real-time Data', icon: Activity },
  { id: 'sessions', label: 'Sessions', icon: Database },
  { id: 'diagnostic', label: 'AI Diagnosis', icon: Wrench } // Add this
];

// In your render method, add the diagnostic tab content
{activeTab === 'diagnostic' && (
  <DiagnosticAgentsDashboard 
    vehicleInfo={streamingState.currentSession?.vehicleInfo}
    dtcCode={/* DTC from your OBD2 data */}
    researchData={/* Research data if available */}
  />
)}
```

## State Management

### Context Provider (Optional but Recommended)

For complex applications, consider using a Context Provider to manage diagnostic agents state globally:

```jsx
// DiagnosticAgentsContext.jsx
import React, { createContext, useContext, useReducer } from 'react';

const DiagnosticAgentsContext = createContext();

const initialState = {
  sessions: [],
  currentSession: null,
  currentStep: null,
  loading: false,
  error: null
};

function diagnosticAgentsReducer(state, action) {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_CURRENT_SESSION':
      return { ...state, currentSession: action.payload };
    case 'SET_CURRENT_STEP':
      return { ...state, currentStep: action.payload };
    case 'ADD_SESSION':
      return { ...state, sessions: [...state.sessions, action.payload] };
    default:
      return state;
  }
}

export const DiagnosticAgentsProvider = ({ children }) => {
  const [state, dispatch] = useReducer(diagnosticAgentsReducer, initialState);

  return (
    <DiagnosticAgentsContext.Provider value={{ state, dispatch }}>
      {children}
    </DiagnosticAgentsContext.Provider>
  );
};

export const useDiagnosticAgentsContext = () => {
  const context = useContext(DiagnosticAgentsContext);
  if (!context) {
    throw new Error('useDiagnosticAgentsContext must be used within a DiagnosticAgentsProvider');
  }
  return context;
};
```

## Error Handling

### Comprehensive Error Handling Strategy

```javascript
// errorHandler.js
export class DiagnosticAgentsError extends Error {
  constructor(message, code, details = null) {
    super(message);
    this.name = 'DiagnosticAgentsError';
    this.code = code;
    this.details = details;
  }
}

export const ERROR_CODES = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  INVALID_STEP: 'INVALID_STEP',
  AGENT_ERROR: 'AGENT_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR'
};

export const handleApiError = (error, operation = 'API call') => {
  console.error(`${operation} failed:`, error);

  if (error.name === 'DiagnosticAgentsError') {
    return error;
  }

  if (error.response) {
    // Server responded with error status
    const status = error.response.status;
    const message = error.response.data?.error || error.message;

    switch (status) {
      case 401:
        return new DiagnosticAgentsError(
          'Authentication required. Please log in.',
          ERROR_CODES.AUTHENTICATION_ERROR
        );
      case 404:
        return new DiagnosticAgentsError(
          'Session not found. It may have expired.',
          ERROR_CODES.SESSION_NOT_FOUND
        );
      case 500:
        return new DiagnosticAgentsError(
          'Server error. Please try again later.',
          ERROR_CODES.AGENT_ERROR,
          message
        );
      default:
        return new DiagnosticAgentsError(message, ERROR_CODES.NETWORK_ERROR);
    }
  } else if (error.request) {
    // Network error
    return new DiagnosticAgentsError(
      'Network error. Please check your connection.',
      ERROR_CODES.NETWORK_ERROR
    );
  } else {
    // Other error
    return new DiagnosticAgentsError(
      error.message || 'An unexpected error occurred',
      ERROR_CODES.VALIDATION_ERROR
    );
  }
};

// Usage in components
const handleError = (error) => {
  const diagnosticError = handleApiError(error, 'Diagnostic operation');
  
  // Show user-friendly error message
  switch (diagnosticError.code) {
    case ERROR_CODES.AUTHENTICATION_ERROR:
      // Redirect to login or refresh token
      break;
    case ERROR_CODES.SESSION_NOT_FOUND:
      // Clear current session and redirect to start
      clearSession();
      break;
    default:
      // Show generic error message
      setError(diagnosticError.message);
  }
};
```

## Testing Strategy

### Unit Tests Example

```javascript
// __tests__/diagnosticAgentsService.test.js
import diagnosticAgentsService from '../services/diagnosticAgentsService';

// Mock fetch
global.fetch = jest.fn();

describe('DiagnosticAgentsService', () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  describe('createSession', () => {
    it('should create a session successfully', async () => {
      const mockResponse = {
        success: true,
        sessionId: 'test-session-123',
        session: { id: 'test-session-123', status: 'active' }
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const sessionData = {
        dtcCode: 'P0171',
        vehicleInfo: { year: 2020, make: 'BMW', model: 'X3' },
        diagnosticSteps: []
      };

      const result = await diagnosticAgentsService.createSession(sessionData);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/diagnostic-agents/sessions'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(sessionData)
        })
      );

      expect(result).toEqual(mockResponse);
    });

    it('should handle API errors', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error'
      });

      const sessionData = { dtcCode: 'P0171' };

      await expect(
        diagnosticAgentsService.createSession(sessionData)
      ).rejects.toThrow('Failed to create diagnostic session');
    });
  });
});
```

### Integration Tests

```javascript
// __tests__/useDiagnosticAgents.test.js
import { renderHook, act } from '@testing-library/react';
import { useDiagnosticAgents } from '../hooks/useDiagnosticAgents';

// Mock the service
jest.mock('../services/diagnosticAgentsService');

describe('useDiagnosticAgents', () => {
  it('should create session and load first step', async () => {
    const { result } = renderHook(() => useDiagnosticAgents());

    expect(result.current.currentSession).toBeNull();
    expect(result.current.loading).toBeFalsy();

    const sessionData = {
      dtcCode: 'P0171',
      vehicleInfo: { year: 2020, make: 'BMW', model: 'X3' },
      diagnosticSteps: [{ id: 'step_1', title: 'Test Step' }]
    };

    await act(async () => {
      await result.current.createSession(sessionData);
    });

    expect(result.current.currentSession).toBeTruthy();
    expect(result.current.currentStep).toBeTruthy();
  });
});
```

## Performance Optimization

### Memoization and Optimization Strategies

```jsx
// Optimized component with memoization
import { memo, useMemo, useCallback } from 'react';

const DiagnosticStep = memo(({ step, onComplete }) => {
  const stepProgress = useMemo(() => {
    return {
      percentage: ((step.stepNumber - 1) / step.totalSteps) * 100,
      isComplete: step.status === 'completed',
      isCurrent: step.status === 'active'
    };
  }, [step.stepNumber, step.totalSteps, step.status]);

  const handleComplete = useCallback((stepData) => {
    onComplete(step.id, stepData);
  }, [step.id, onComplete]);

  return (
    <div className="diagnostic-step">
      {/* Step content */}
    </div>
  );
});

// Debounced chat input
import { useMemo } from 'react';
import { debounce } from 'lodash';

const ChatInput = ({ onSendMessage }) => {
  const debouncedSend = useMemo(
    () => debounce(onSendMessage, 300),
    [onSendMessage]
  );

  return (
    <input
      onChange={(e) => debouncedSend(e.target.value)}
      placeholder="Type your message..."
    />
  );
};
```

### Lazy Loading

```jsx
// Lazy load diagnostic components
import { lazy, Suspense } from 'react';

const DiagnosticAgentsDashboard = lazy(() => 
  import('./DiagnosticAgentsDashboard')
);

const App = () => {
  return (
    <div>
      <Suspense fallback={<div>Loading diagnostic tools...</div>}>
        <DiagnosticAgentsDashboard />
      </Suspense>
    </div>
  );
};
```

## Deployment Considerations

### Environment Variables

```bash
# .env.production
REACT_APP_API_URL=https://your-production-api.com
REACT_APP_DIAGNOSTIC_AGENTS_ENABLED=true
REACT_APP_DIAGNOSTIC_AGENTS_VERSION=1.0.0
```

### Build Optimization

```javascript
// webpack.config.js additions for production
module.exports = {
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        diagnosticAgents: {
          test: /[\\/]diagnostic-agents[\\/]/,
          name: 'diagnostic-agents',
          chunks: 'all',
        }
      }
    }
  }
};
```

### Progressive Web App Support

```javascript
// Add to your service worker for offline diagnostic capabilities
const DIAGNOSTIC_CACHE = 'diagnostic-agents-v1';

const diagnosticAssets = [
  '/api/diagnostic-agents/sessions',
  // Add other critical diagnostic endpoints
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(DIAGNOSTIC_CACHE)
      .then((cache) => cache.addAll(diagnosticAssets))
  );
});
```

## Integration Checklist

- [ ] Install dependencies (`@openai/agents` already installed)
- [ ] Create diagnostic agents service (`diagnosticAgentsService.js`)
- [ ] Create custom hook (`useDiagnosticAgents.js`)
- [ ] Create main dashboard component (`DiagnosticAgentsDashboard.jsx`)
- [ ] Add error handling and validation
- [ ] Integrate with existing OBD2 components
- [ ] Add unit and integration tests
- [ ] Implement performance optimizations
- [ ] Configure environment variables
- [ ] Test in development environment
- [ ] Deploy to production

## Support and Troubleshooting

### Common Issues

1. **Agent not responding**: Check OpenAI API key configuration
2. **Session not found**: Verify session ID is properly passed
3. **Network errors**: Check API endpoint URLs and CORS settings
4. **Performance issues**: Implement debouncing and memoization

### Debug Mode

```javascript
// Add debug logging
const DEBUG = process.env.NODE_ENV === 'development';

const log = (message, data = null) => {
  if (DEBUG) {
    console.log(`[DiagnosticAgents] ${message}`, data);
  }
};

// Usage
log('Creating session', sessionData);
log('Agent response received', response);
```

This comprehensive guide should provide everything you need to integrate the diagnostic agents functionality into your React frontend. The system is designed to work seamlessly with your existing OBD2 components while providing powerful AI-driven diagnostic assistance.