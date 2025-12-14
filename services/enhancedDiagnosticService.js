// Enhanced Diagnostic Service - Comprehensive Integration Layer
import EventEmitter from 'events';
import dotenv from 'dotenv';



class EnhancedDiagnosticService extends EventEmitter {
  constructor() {
    super();
    this.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
    this.wsURL = process.env.REACT_APP_WS_URL || 'ws://localhost:5000';
    this.activeSessions = new Map();
    this.liveDataStreams = new Map();
    this.webSocketConnections = new Map();
    this.pythonCharts = new Map();
  }

  // ========================
  // SESSION MANAGEMENT
  // ========================

  async createEnhancedDiagnosticSession(sessionData) {
    try {
      // Create OBD2 session for live data
      const obd2Session = await this.createOBD2Session(sessionData.vehicleInfo);
      
      // Create diagnostic agent session
      const agentSession = await this.createDiagnosticAgentSession({
        dtcCode: sessionData.dtcCode,
        vehicleInfo: sessionData.vehicleInfo,
        researchData: sessionData.researchData,
        diagnosticSteps: sessionData.diagnosticSteps,
        obd2SessionId: obd2Session.sessionId
      });

      // Create enhanced session object
      const enhancedSession = {
        id: `enhanced_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        obd2SessionId: obd2Session.sessionId,
        agentSessionId: agentSession.sessionId,
        dtcCode: sessionData.dtcCode,
        vehicleInfo: sessionData.vehicleInfo,
        researchData: sessionData.researchData,
        diagnosticSteps: sessionData.diagnosticSteps,
        currentStepIndex: 0,
        liveDataActive: false,
        searchResults: [],
        generatedCharts: [],
        visualAids: [],
        createdAt: new Date().toISOString(),
        status: 'active'
      };

      this.activeSessions.set(enhancedSession.id, enhancedSession);

      // Initialize live data stream
      await this.initializeLiveDataStream(enhancedSession.id, obd2Session.sessionId);

      return {
        success: true,
        sessionId: enhancedSession.id,
        session: enhancedSession
      };

    } catch (error) {
      console.error('Failed to create enhanced diagnostic session:', error);
      throw error;
    }
  }

  // ========================
  // OBD2 LIVE DATA INTEGRATION
  // ========================

  async createOBD2Session(vehicleInfo) {
    const response = await fetch(`${this.baseURL}/api/obd2/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getAuthToken()}`
      },
      body: JSON.stringify({
        vehicleInfo: {
          year: vehicleInfo.year,
          make: vehicleInfo.make,
          model: vehicleInfo.model,
          vin: vehicleInfo.vin,
          engine: vehicleInfo.engine
        },
        startTimestamp: new Date().toISOString(),
        metadata: {
          sessionType: 'diagnostic',
          source: 'enhanced_diagnostic_manager'
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to create OBD2 session: ${response.statusText}`);
    }

    return await response.json();
  }

  async initializeLiveDataStream(sessionId, obd2SessionId) {
    try {
      // Create WebSocket connection for live data
      const ws = new WebSocket(`${this.wsURL}/ws/obd2/${obd2SessionId}`);
      
      ws.onopen = () => {
        console.log(`Live data stream connected for session ${sessionId}`);
        this.emit('liveDataConnected', { sessionId, obd2SessionId });
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        this.handleLiveDataUpdate(sessionId, data);
      };

      ws.onerror = (error) => {
        console.error('Live data WebSocket error:', error);
        this.emit('liveDataError', { sessionId, error });
      };

      ws.onclose = () => {
        console.log(`Live data stream disconnected for session ${sessionId}`);
        this.emit('liveDataDisconnected', { sessionId });
      };

      this.webSocketConnections.set(sessionId, ws);
      this.liveDataStreams.set(sessionId, {
        obd2SessionId,
        connected: true,
        lastUpdate: new Date().toISOString(),
        dataBuffer: []
      });

    } catch (error) {
      console.error('Failed to initialize live data stream:', error);
      throw error;
    }
  }

  handleLiveDataUpdate(sessionId, data) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    const stream = this.liveDataStreams.get(sessionId);
    if (!stream) return;

    // Add to buffer
    stream.dataBuffer.push({
      ...data,
      timestamp: new Date().toISOString()
    });

    // Keep only last 100 data points in buffer
    if (stream.dataBuffer.length > 100) {
      stream.dataBuffer = stream.dataBuffer.slice(-100);
    }

    stream.lastUpdate = new Date().toISOString();

    // Emit live data update
    this.emit('liveDataUpdate', {
      sessionId,
      data,
      currentStep: session.currentStepIndex,
      stepTitle: session.diagnosticSteps[session.currentStepIndex]?.title
    });

    // Check for diagnostic triggers
    this.checkDiagnosticTriggers(sessionId, data);
  }

  async getLiveData(sessionId, timeRange = '5min') {
    const stream = this.liveDataStreams.get(sessionId);
    if (!stream) {
      throw new Error('No live data stream found for session');
    }

    const now = new Date();
    const rangeMs = this.parseTimeRange(timeRange);
    const cutoff = new Date(now.getTime() - rangeMs);

    return stream.dataBuffer.filter(point => 
      new Date(point.timestamp) >= cutoff
    );
  }

  // ========================
  // DIAGNOSTIC AGENTS INTEGRATION
  // ========================

  async createDiagnosticAgentSession(sessionData) {
    const response = await fetch(`${this.baseURL}/api/diagnostic-agents/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getAuthToken()}`
      },
      body: JSON.stringify(sessionData)
    });

    if (!response.ok) {
      throw new Error(`Failed to create diagnostic agent session: ${response.statusText}`);
    }

    return await response.json();
  }

  async chatWithDiagnosticAgent(sessionId, message, context = {}) {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Add live data context
    const liveData = await this.getLiveData(sessionId, '30sec');
    const enhancedContext = {
      ...context,
      liveData: liveData.slice(-5), // Last 5 data points
      currentStep: session.diagnosticSteps[session.currentStepIndex],
      sessionHistory: session.searchResults,
      generatedCharts: session.generatedCharts
    };

    const response = await fetch(`${this.baseURL}/api/diagnostic-agents/sessions/${session.agentSessionId}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getAuthToken()}`
      },
      body: JSON.stringify({
        message,
        ...enhancedContext
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to chat with diagnostic agent: ${response.statusText}`);
    }

    const result = await response.json();

    // Process agent response for additional actions
    await this.processAgentResponse(sessionId, result);

    return result;
  }

  async processAgentResponse(sessionId, agentResponse) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    const response = agentResponse.response.toLowerCase();

    // Auto-trigger web search for recalls/TSBs
    if (response.includes('recall') || response.includes('tsb') || response.includes('technical service bulletin')) {
      await this.searchRecallsAndTSBs(sessionId);
    }

    // Auto-generate charts for data analysis requests
    if (response.includes('chart') || response.includes('graph') || response.includes('plot')) {
      await this.generateDiagnosticCharts(sessionId);
    }

    // Auto-search for technical images
    if (response.includes('diagram') || response.includes('wiring') || response.includes('schematic')) {
      const currentStep = session.diagnosticSteps[session.currentStepIndex];
      await this.searchTechnicalImages(sessionId, `${session.vehicleInfo.year} ${session.vehicleInfo.make} ${session.vehicleInfo.model} ${currentStep?.title || 'diagnostic'}`);
    }
  }

  // ========================
  // WEB SEARCH INTEGRATION
  // ========================

  async searchRecallsAndTSBs(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    try {
      const query = `${session.vehicleInfo.year} ${session.vehicleInfo.make} ${session.vehicleInfo.model} ${session.dtcCode} recall TSB`;
      
      const response = await fetch(`${this.baseURL}/api/responses/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({
          message: `Search for recalls and TSBs: ${query}`,
          vehicleContext: session.vehicleInfo,
          customerContext: { dtcCode: session.dtcCode }
        })
      });

      if (response.ok) {
        const result = await response.json();
        session.searchResults.push({
          type: 'recalls_tsbs',
          query,
          results: result.response,
          timestamp: new Date().toISOString()
        });

        this.emit('searchResultsUpdated', {
          sessionId,
          type: 'recalls_tsbs',
          results: result.response
        });
      }
    } catch (error) {
      console.error('Failed to search recalls/TSBs:', error);
    }
  }

  async searchTechnicalImages(sessionId, query) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    try {
      const response = await fetch(`${this.baseURL}/api/serper/images`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({
          query,
          num: 5,
          vehicleInfo: session.vehicleInfo
        })
      });

      if (response.ok) {
        const result = await response.json();
        session.visualAids.push({
          type: 'technical_images',
          query,
          images: result.images || [],
          timestamp: new Date().toISOString()
        });

        this.emit('visualAidsUpdated', {
          sessionId,
          type: 'technical_images',
          images: result.images || []
        });
      }
    } catch (error) {
      console.error('Failed to search technical images:', error);
    }
  }

  // ========================
  // PYTHON CHART GENERATION
  // ========================

  async generateDiagnosticCharts(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    try {
      // Get recent live data for charting
      const liveData = await this.getLiveData(sessionId, '5min');
      
      if (liveData.length === 0) {
        console.log('No live data available for chart generation');
        return;
      }

      // Generate multiple charts based on available data
      const chartPromises = [];

      // Engine performance chart
      if (liveData.some(d => d.rpm && d.engineLoad)) {
        chartPromises.push(this.generateEnginePerformanceChart(sessionId, liveData));
      }

      // Sensor trend chart
      if (liveData.length > 10) {
        chartPromises.push(this.generateSensorTrendChart(sessionId, liveData));
      }

      // DTC-specific chart
      if (session.dtcCode) {
        chartPromises.push(this.generateDTCSpecificChart(sessionId, liveData, session.dtcCode));
      }

      const charts = await Promise.all(chartPromises.filter(Boolean));
      
      session.generatedCharts.push(...charts);

      this.emit('chartsGenerated', {
        sessionId,
        charts
      });

    } catch (error) {
      console.error('Failed to generate diagnostic charts:', error);
    }
  }

  async generateEnginePerformanceChart(sessionId, data) {
    const pythonCode = `
import matplotlib.pyplot as plt
import numpy as np
import json
from datetime import datetime

# Parse data
data = json.loads('${JSON.stringify(data)}')
times = [datetime.fromisoformat(d['timestamp'].replace('Z', '+00:00')) for d in data if 'rpm' in d and 'engineLoad' in d]
rpms = [d['rpm'] for d in data if 'rpm' in d and 'engineLoad' in d]
loads = [d['engineLoad'] for d in data if 'rpm' in d and 'engineLoad' in d]

if len(times) > 0:
    # Create subplot
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12, 8))
    fig.suptitle('Engine Performance Analysis', fontsize=16, fontweight='bold')
    
    # RPM plot
    ax1.plot(times, rpms, 'b-', linewidth=2, label='RPM')
    ax1.set_ylabel('RPM', fontsize=12)
    ax1.grid(True, alpha=0.3)
    ax1.legend()
    ax1.set_title('Engine RPM over Time')
    
    # Engine Load plot
    ax2.plot(times, loads, 'r-', linewidth=2, label='Engine Load %')
    ax2.set_ylabel('Engine Load (%)', fontsize=12)
    ax2.set_xlabel('Time', fontsize=12)
    ax2.grid(True, alpha=0.3)
    ax2.legend()
    ax2.set_title('Engine Load over Time')
    
    plt.tight_layout()
    plt.xticks(rotation=45)
    plt.show()
else:
    print("No engine performance data available")
`;

    return await this.executePythonCode(sessionId, pythonCode, 'engine_performance_chart');
  }

  async generateSensorTrendChart(sessionId, data) {
    const pythonCode = `
import matplotlib.pyplot as plt
import numpy as np
import json
from datetime import datetime

# Parse data
data = json.loads('${JSON.stringify(data)}')
times = [datetime.fromisoformat(d['timestamp'].replace('Z', '+00:00')) for d in data]

# Extract common sensor data
sensors = {}
for d in data:
    for key, value in d.items():
        if key != 'timestamp' and isinstance(value, (int, float)):
            if key not in sensors:
                sensors[key] = []
            sensors[key].append(value)

if sensors:
    # Create multi-sensor chart
    fig, axes = plt.subplots(min(4, len(sensors)), 1, figsize=(12, 10))
    if len(sensors) == 1:
        axes = [axes]
    
    fig.suptitle('Sensor Trend Analysis', fontsize=16, fontweight='bold')
    
    sensor_keys = list(sensors.keys())[:4]  # Limit to 4 sensors
    colors = ['blue', 'red', 'green', 'orange']
    
    for i, sensor in enumerate(sensor_keys):
        if i < len(axes):
            axes[i].plot(times[:len(sensors[sensor])], sensors[sensor], 
                        color=colors[i % len(colors)], linewidth=2, label=sensor)
            axes[i].set_ylabel(sensor, fontsize=10)
            axes[i].grid(True, alpha=0.3)
            axes[i].legend()
            
    axes[-1].set_xlabel('Time', fontsize=12)
    plt.tight_layout()
    plt.xticks(rotation=45)
    plt.show()
else:
    print("No sensor data available")
`;

    return await this.executePythonCode(sessionId, pythonCode, 'sensor_trend_chart');
  }

  async generateDTCSpecificChart(sessionId, data, dtcCode) {
    // Generate DTC-specific analysis based on code
    let specificCode = '';
    
    switch (dtcCode.substring(0, 4)) {
      case 'P030':
        // Misfire codes - analyze RPM and engine load
        specificCode = `
# Misfire Analysis for ${dtcCode}
if 'rpm' in sensors and 'engineLoad' in sensors:
    fig, ax = plt.subplots(1, 1, figsize=(12, 6))
    scatter = ax.scatter(sensors['rpm'], sensors['engineLoad'], 
                        c=range(len(sensors['rpm'])), cmap='viridis', alpha=0.7)
    ax.set_xlabel('RPM')
    ax.set_ylabel('Engine Load (%)')
    ax.set_title('RPM vs Engine Load - Misfire Analysis (${dtcCode})')
    ax.grid(True, alpha=0.3)
    plt.colorbar(scatter, label='Time Sequence')
    plt.show()
`;
        break;
      case 'P017':
        // Fuel system codes - analyze fuel trims
        specificCode = `
# Fuel System Analysis for ${dtcCode}
fuel_sensors = [key for key in sensors.keys() if 'fuel' in key.lower() or 'trim' in key.lower()]
if fuel_sensors:
    fig, ax = plt.subplots(1, 1, figsize=(12, 6))
    for sensor in fuel_sensors[:3]:  # Limit to 3 fuel-related sensors
        ax.plot(times[:len(sensors[sensor])], sensors[sensor], label=sensor, linewidth=2)
    ax.set_xlabel('Time')
    ax.set_ylabel('Value')
    ax.set_title('Fuel System Analysis (${dtcCode})')
    ax.legend()
    ax.grid(True, alpha=0.3)
    plt.xticks(rotation=45)
    plt.show()
`;
        break;
      default:
        specificCode = `
# General DTC Analysis for ${dtcCode}
if sensors:
    fig, ax = plt.subplots(1, 1, figsize=(12, 6))
    # Plot first available sensor
    first_sensor = list(sensors.keys())[0]
    ax.plot(times[:len(sensors[first_sensor])], sensors[first_sensor], 
           'b-', linewidth=2, label=first_sensor)
    ax.set_xlabel('Time')
    ax.set_ylabel(first_sensor)
    ax.set_title('DTC ${dtcCode} - ${first_sensor} Analysis')
    ax.legend()
    ax.grid(True, alpha=0.3)
    plt.xticks(rotation=45)
    plt.show()
`;
    }

    const pythonCode = `
import matplotlib.pyplot as plt
import numpy as np
import json
from datetime import datetime

# Parse data
data = json.loads('${JSON.stringify(data)}')
times = [datetime.fromisoformat(d['timestamp'].replace('Z', '+00:00')) for d in data]

# Extract sensor data
sensors = {}
for d in data:
    for key, value in d.items():
        if key != 'timestamp' and isinstance(value, (int, float)):
            if key not in sensors:
                sensors[key] = []
            sensors[key].append(value)

${specificCode}
`;

    return await this.executePythonCode(sessionId, pythonCode, `dtc_${dtcCode.toLowerCase()}_analysis`);
  }

  async executePythonCode(sessionId, code, filename) {
    try {
      const response = await fetch(`${this.baseURL}/api/execute/python`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({
          code,
          save_plots: true,
          plot_filename: `${filename}_${sessionId}_${Date.now()}`
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.plots_data && result.plots_data.length > 0) {
          const chart = {
            filename,
            sessionId,
            ...result.plots_data[0],
            generatedAt: new Date().toISOString()
          };
          
          this.pythonCharts.set(chart.path, chart);
          return chart;
        }
      }
    } catch (error) {
      console.error('Failed to execute Python code:', error);
    }
    return null;
  }

  // ========================
  // DIAGNOSTIC TRIGGERS
  // ========================

  checkDiagnosticTriggers(sessionId, data) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    const triggers = [];

    // Check for abnormal RPM patterns
    if (data.rpm) {
      if (data.rpm > 5000) {
        triggers.push({
          type: 'warning',
          message: 'High RPM detected - monitor for overrev conditions',
          severity: 'medium',
          data: { rpm: data.rpm }
        });
      }
    }

    // Check for engine load issues
    if (data.engineLoad) {
      if (data.engineLoad > 85) {
        triggers.push({
          type: 'warning',
          message: 'High engine load detected - possible performance issue',
          severity: 'medium',
          data: { engineLoad: data.engineLoad }
        });
      }
    }

    // Check for temperature warnings
    if (data.coolantTemp) {
      if (data.coolantTemp > 105) {
        triggers.push({
          type: 'alert',
          message: 'Coolant temperature critical - stop engine immediately',
          severity: 'high',
          data: { coolantTemp: data.coolantTemp }
        });
      }
    }

    // Emit triggers
    if (triggers.length > 0) {
      this.emit('diagnosticTriggers', {
        sessionId,
        triggers,
        timestamp: new Date().toISOString()
      });
    }
  }

  // ========================
  // UTILITY METHODS
  // ========================

  parseTimeRange(range) {
    const timeMap = {
      '30sec': 30 * 1000,
      '1min': 60 * 1000,
      '5min': 5 * 60 * 1000,
      '10min': 10 * 60 * 1000,
      '30min': 30 * 60 * 1000,
      '1hour': 60 * 60 * 1000
    };
    return timeMap[range] || timeMap['5min'];
  }

  getAuthToken() {
    // In a real implementation, get from localStorage or context
    return localStorage.getItem('authToken') || '';
  }

  // ========================
  // SESSION CLEANUP
  // ========================

  async endSession(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    try {
      // Close WebSocket connections
      const ws = this.webSocketConnections.get(sessionId);
      if (ws) {
        ws.close();
        this.webSocketConnections.delete(sessionId);
      }

      // End OBD2 session
      if (session.obd2SessionId) {
        await fetch(`${this.baseURL}/api/obd2/sessions/${session.obd2SessionId}/end`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.getAuthToken()}`
          }
        });
      }

      // Clean up data structures
      this.activeSessions.delete(sessionId);
      this.liveDataStreams.delete(sessionId);

      this.emit('sessionEnded', { sessionId });

    } catch (error) {
      console.error('Failed to end session properly:', error);
    }
  }

  // Get session status
  getSessionStatus(sessionId) {
    const session = this.activeSessions.get(sessionId);
    const stream = this.liveDataStreams.get(sessionId);
    
    return {
      exists: !!session,
      active: session?.status === 'active',
      liveDataConnected: stream?.connected || false,
      lastUpdate: stream?.lastUpdate,
      currentStep: session?.currentStepIndex,
      totalSteps: session?.diagnosticSteps?.length || 0,
      chartsGenerated: session?.generatedCharts?.length || 0,
      searchResults: session?.searchResults?.length || 0,
      visualAids: session?.visualAids?.length || 0
    };
  }
}

export default EnhancedDiagnosticService;