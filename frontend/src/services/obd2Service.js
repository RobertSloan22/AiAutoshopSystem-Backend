// OBD2 Service for API communication
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

class OBD2Service {
  constructor() {
    this.baseURL = `${API_BASE_URL}/api/obd2`;
  }

  // Helper method to get auth headers
  getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  }

  // Session Management
  async startSession(vehicleId, adapterInfo = { type: 'bluetooth' }) {
    try {
      const response = await fetch(`${this.baseURL}/session/start`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ vehicleId, adapterInfo })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to start OBD2 session: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error starting OBD2 session:', error);
      throw error;
    }
  }

  async endSession(sessionId) {
    try {
      const response = await fetch(`${this.baseURL}/session/end/${sessionId}`, {
        method: 'POST',
        headers: this.getAuthHeaders()
      });
      
      if (!response.ok) {
        throw new Error(`Failed to end OBD2 session: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error ending OBD2 session:', error);
      throw error;
    }
  }

  // Data Ingestion
  async ingestData(sessionId, data) {
    try {
      const response = await fetch(`${this.baseURL}/ingest`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ sessionId, ...data })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to ingest OBD2 data: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error ingesting OBD2 data:', error);
      throw error;
    }
  }

  async bulkIngestData(sessionId, dataPoints) {
    try {
      const response = await fetch(`${this.baseURL}/ingest/bulk`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ sessionId, dataPoints })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to bulk ingest OBD2 data: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error bulk ingesting OBD2 data:', error);
      throw error;
    }
  }

  // Data Retrieval
  async getDataHistory(vehicleId, options = {}) {
    try {
      const { startDate, endDate, limit = 50, page = 1 } = options;
      const params = new URLSearchParams({ limit: limit.toString(), page: page.toString() });
      
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      
      const response = await fetch(`${this.baseURL}/history/${vehicleId}?${params}`, {
        headers: this.getAuthHeaders()
      });
      
      if (!response.ok) {
        throw new Error(`Failed to get OBD2 data history: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error getting OBD2 data history:', error);
      throw error;
    }
  }

  async getCurrentState(vehicleId) {
    try {
      const response = await fetch(`${this.baseURL}/current-state/${vehicleId}`, {
        headers: this.getAuthHeaders()
      });
      
      if (!response.ok) {
        throw new Error(`Failed to get vehicle current state: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error getting vehicle current state:', error);
      throw error;
    }
  }

  async getDTCHistory(vehicleId, limit = 50) {
    try {
      const response = await fetch(`${this.baseURL}/dtc-history/${vehicleId}?limit=${limit}`, {
        headers: this.getAuthHeaders()
      });
      
      if (!response.ok) {
        throw new Error(`Failed to get DTC history: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error getting DTC history:', error);
      throw error;
    }
  }

  // Analysis
  async triggerAnalysis(sessionId, analysisType = 'general', options = {}) {
    try {
      const response = await fetch(`${this.baseURL}/analyze/${sessionId}`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ analysisType, options })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to trigger analysis: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error triggering analysis:', error);
      throw error;
    }
  }

  async getAnalysisResults(sessionId) {
    try {
      const response = await fetch(`${this.baseURL}/analysis/${sessionId}`, {
        headers: this.getAuthHeaders()
      });
      
      if (!response.ok) {
        throw new Error(`Failed to get analysis results: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error getting analysis results:', error);
      throw error;
    }
  }

  // WebSocket Connection for Real-time Data
  async getStreamInfo(sessionId) {
    try {
      const response = await fetch(`${this.baseURL}/stream/${sessionId}`, {
        headers: this.getAuthHeaders()
      });
      
      if (!response.ok) {
        throw new Error(`Failed to get stream info: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error getting stream info:', error);
      throw error;
    }
  }

  // Utilities
  async clearDTCCodes(vehicleId, codes) {
    try {
      const response = await fetch(`${this.baseURL}/dtc/clear/${vehicleId}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ codes })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to clear DTC codes: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error clearing DTC codes:', error);
      throw error;
    }
  }

  async getDataQualityReport(sessionId) {
    try {
      const response = await fetch(`${this.baseURL}/data-quality/${sessionId}`, {
        headers: this.getAuthHeaders()
      });
      
      if (!response.ok) {
        throw new Error(`Failed to get data quality report: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error getting data quality report:', error);
      throw error;
    }
  }

  async exportData(vehicleId, options = {}) {
    try {
      const { format = 'json', startDate, endDate } = options;
      const params = new URLSearchParams({ format });
      
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      
      const response = await fetch(`${this.baseURL}/export/${vehicleId}?${params}`, {
        headers: this.getAuthHeaders()
      });
      
      if (!response.ok) {
        throw new Error(`Failed to export data: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error exporting data:', error);
      throw error;
    }
  }

  // WebSocket connection helper
  createWebSocketConnection(sessionId, onMessage, onError, onClose) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/obd2/${sessionId}`;
    
    const ws = new WebSocket(wsUrl, ['obd2-stream']);
    
    ws.onopen = () => {
      console.log('OBD2 WebSocket connected');
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
        onError(error);
      }
    };
    
    ws.onerror = (error) => {
      console.error('OBD2 WebSocket error:', error);
      onError(error);
    };
    
    ws.onclose = (event) => {
      console.log('OBD2 WebSocket disconnected:', event.code, event.reason);
      onClose(event);
    };
    
    return ws;
  }
}

export default new OBD2Service();