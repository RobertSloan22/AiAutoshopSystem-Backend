import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Play, Square, Pause, Download, Trash2, Eye, Calendar, Car, Database, Activity, AlertTriangle, CheckCircle, Search, Filter, ChevronDown, ChevronUp, X } from 'lucide-react';

// Import your existing OBD2 services
import { obd2StreamingService, obd2SessionService } from '../services/obd2Service';
import { mockObd2StreamingService, mockObd2SessionService } from '../services/mockObd2Service';
import { unifiedOBD2Service } from '../services/UnifiedOBD2Service'; // Your existing OBD2 service
import axiosInstance from '../../../../../../utils/axiosConfig';

// Use mock services if real ones are not available
const streamingService = obd2StreamingService || mockObd2StreamingService;
const sessionService = obd2SessionService || mockObd2SessionService;

// Define interfaces
interface Session {
  id: string;
  userId?: string;
  vehicleId?: string;
  sessionName?: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  status: 'active' | 'completed' | 'paused';
  dataPointCount: number;
  vehicleInfo?: any;
  sessionNotes?: string;
  tags?: string[];
}

interface ChartDataPoint {
  timestamp: string;
  [key: string]: number | string;
}

interface SessionDataPoint {
  timestamp: string;
  rpm?: number;
  speed?: number;
  engineTemp?: number;
  throttlePosition?: number;
  engineLoad?: number;
  maf?: number;
  map?: number;
  [key: string]: any;
}

// Enhanced OBD2 Service with search and data viewing capabilities
class EnhancedOBD2Service {
  constructor() {
    this.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:3000';
    this.apiURL = `${this.baseURL}/api/obd2`;
  }

  // Get auth headers
  getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  }

  // Search sessions with filters
  async searchSessions(filters = {}) {
    try {
      const params = new URLSearchParams();
      
      if (filters.userId) params.append('userId', filters.userId);
      if (filters.limit) params.append('limit', filters.limit.toString());
      if (filters.offset) params.append('offset', filters.offset.toString());
      if (filters.status) params.append('status', filters.status);
      if (filters.vehicleId) params.append('vehicleId', filters.vehicleId);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.searchTerm) params.append('searchTerm', filters.searchTerm);

      const response = await fetch(`${this.apiURL}/sessions?${params}`, {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to search sessions: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error searching sessions:', error);
      throw error;
    }
  }

  // Get session data with filtering
  async getSessionData(sessionId, options = {}) {
    // Validate sessionId
    if (!sessionId || sessionId === 'undefined' || sessionId === 'null') {
      throw new Error('Invalid session ID provided');
    }

    try {
      const params = new URLSearchParams();
      
      if (options.startTime) params.append('startTime', options.startTime);
      if (options.endTime) params.append('endTime', options.endTime);
      if (options.limit) params.append('limit', options.limit.toString());
      if (options.parameters) params.append('parameters', options.parameters.join(','));
      if (options.aggregate) params.append('aggregate', options.aggregate.toString());
      if (options.interval) params.append('interval', options.interval);

      const response = await fetch(`${this.apiURL}/sessions/${sessionId}/data?${params}`, {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to get session data: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting session data:', error);
      throw error;
    }
  }

  // Get session details
  async getSession(sessionId) {
    // Validate sessionId
    if (!sessionId || sessionId === 'undefined' || sessionId === 'null') {
      throw new Error('Invalid session ID provided');
    }

    try {
      const response = await fetch(`${this.apiURL}/sessions/${sessionId}`, {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to get session: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting session:', error);
      throw error;
    }
  }

  // Export session data
  async exportSessionData(sessionId, format = 'json') {
    // Validate sessionId
    if (!sessionId || sessionId === 'undefined' || sessionId === 'null') {
      throw new Error('Invalid session ID provided');
    }

    try {
      const response = await fetch(`${this.apiURL}/sessions/${sessionId}/export?format=${format}`, {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to export session data: ${response.statusText}`);
      }

      if (format === 'json') {
        return await response.json();
      } else {
        return await response.blob();
      }
    } catch (error) {
      console.error('Error exporting session data:', error);
      throw error;
    }
  }

  // Delete session
  async deleteSession(sessionId) {
    // Validate sessionId
    if (!sessionId || sessionId === 'undefined' || sessionId === 'null') {
      throw new Error('Invalid session ID provided');
    }

    try {
      const response = await fetch(`${this.apiURL}/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to delete session: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error deleting session:', error);
      throw error;
    }
  }
}

const enhancedOBD2Service = new EnhancedOBD2Service();

// React Hook for OBD2 streaming integration
function useOBD2Integration() {
  const [streamingState, setStreamingState] = useState(streamingService.getState());
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = streamingService.subscribe(setStreamingState);
    return unsubscribe;
  }, []);

  const connectToBackend = useCallback(async () => {
    try {
      await streamingService.connect();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    }
  }, []);

  const startNewSession = useCallback(async (sessionOptions: any) => {
    try {
      const sessionId = await streamingService.startSession(sessionOptions);
      return sessionId;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
      throw err;
    }
  }, []);

  const endCurrentSession = useCallback(async () => {
    try {
      await streamingService.endSession();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Session end failed');
    }
  }, []);

  const searchSessions = useCallback(async (filters = {}) => {
    try {
      setLoading(true);
      setError(null);
      const data = await enhancedOBD2Service.searchSessions(filters);
      setSessions(data?.sessions || []);
      return data;
    } catch (err) {
      console.error('Failed to search sessions:', err);
      setError(err instanceof Error ? err.message : 'Failed to search sessions');
      setSessions([]);
      return { sessions: [], total: 0 };
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      await enhancedOBD2Service.deleteSession(sessionId);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete session');
    }
  }, []);

  return {
    streamingState,
    sessions,
    loading,
    error,
    connectToBackend,
    startNewSession,
    endCurrentSession,
    searchSessions,
    deleteSession,
    streamDataPoint: (data: any) => obd2StreamingService.streamDataPoint(data),
    startStreaming: () => obd2StreamingService.startDataStreaming(),
    stopStreaming: () => obd2StreamingService.stopDataStreaming()
  };
}

// Session Data Viewer Component
const SessionDataViewer = ({ session, onClose }) => {
  const [sessionData, setSessionData] = useState<SessionDataPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataFilters, setDataFilters] = useState({
    startTime: '',
    endTime: '',
    parameters: ['rpm', 'speed', 'engineTemp', 'throttlePosition'],
    limit: 1000,
    aggregate: false,
    interval: '1 minute'
  });
  const [activeTab, setActiveTab] = useState('chart');

  useEffect(() => {
    console.log('SessionDataViewer useEffect triggered with session:', session);
    if (session) {
      console.log('Loading session data for session ID:', session.id);
      loadSessionData();
    }
  }, [session, dataFilters]);

  const loadSessionData = async () => {
    if (!session || !session.id || session.id === 'undefined') {
      console.error('Invalid session or session ID');
      setError('Invalid session ID');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await enhancedOBD2Service.getSessionData(session.id, dataFilters);
      setSessionData(response.data || []);
    } catch (err) {
      console.error('Failed to load session data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load session data');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format = 'json') => {
    if (!session || !session.id || session.id === 'undefined') {
      console.error('Cannot export: Invalid session ID');
      return;
    }

    try {
      const data = await enhancedOBD2Service.exportSessionData(session.id, format);
      
      if (format === 'json') {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `session-${session.id}-data.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const url = URL.createObjectURL(data);
        const a = document.createElement('a');
        a.href = url;
        a.download = `session-${session.id}-data.${format}`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const chartConfig: Record<string, { color: string; label: string; unit: string }> = {
    rpm: { color: '#ff6b6b', label: 'RPM', unit: 'rpm' },
    speed: { color: '#4ecdc4', label: 'Speed', unit: 'km/h' },
    engineTemp: { color: '#45b7d1', label: 'Engine Temp', unit: '°C' },
    throttlePosition: { color: '#f9ca24', label: 'Throttle', unit: '%' },
    engineLoad: { color: '#6c5ce7', label: 'Engine Load', unit: '%' },
    maf: { color: '#fd79a8', label: 'MAF', unit: 'g/s' },
    map: { color: '#00b894', label: 'MAP', unit: 'kPa' }
  };

  if (!session) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold">
              {session.sessionName || `Session ${session.id.slice(-6)}`}
            </h2>
            <p className="text-gray-600 text-sm">
              {new Date(session.startTime).toLocaleString()} • {session.dataPointCount} data points
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('chart')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'chart' 
                ? 'border-b-2 border-blue-500 text-blue-600' 
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Chart View
          </button>
          <button
            onClick={() => setActiveTab('table')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'table' 
                ? 'border-b-2 border-blue-500 text-blue-600' 
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Data Table
          </button>
          <button
            onClick={() => setActiveTab('info')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'info' 
                ? 'border-b-2 border-blue-500 text-blue-600' 
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Session Info
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 200px)' }}>
          {activeTab === 'chart' && (
            <div className="space-y-4">
              {/* Data Filters */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-medium mb-3">Data Filters</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Time
                    </label>
                    <input
                      type="datetime-local"
                      value={dataFilters.startTime}
                      onChange={(e) => setDataFilters(prev => ({ ...prev, startTime: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      End Time
                    </label>
                    <input
                      type="datetime-local"
                      value={dataFilters.endTime}
                      onChange={(e) => setDataFilters(prev => ({ ...prev, endTime: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Data Points Limit
                    </label>
                    <input
                      type="number"
                      min="100"
                      max="10000"
                      value={dataFilters.limit}
                      onChange={(e) => setDataFilters(prev => ({ ...prev, limit: parseInt(e.target.value) }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* Chart */}
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
                  <p className="text-gray-600 mt-2">Loading session data...</p>
                </div>
              ) : error ? (
                <div className="text-center py-8 text-red-600">
                  <p>Error loading data: {error}</p>
                </div>
              ) : sessionData.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No data available for this session</p>
                </div>
              ) : (
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={sessionData}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis 
                        dataKey="timestamp" 
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                      />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#1f2937', 
                          border: 'none', 
                          borderRadius: '8px',
                          color: '#fff'
                        }}
                        labelFormatter={(value) => new Date(value).toLocaleString()}
                        formatter={(value, name) => [
                          `${(value as number)?.toFixed(1)} ${chartConfig[name]?.unit || ''}`,
                          chartConfig[name]?.label || name
                        ]}
                      />
                      <Legend />
                      {dataFilters.parameters.map(param => (
                        <Line
                          key={param}
                          type="monotone"
                          dataKey={param}
                          stroke={chartConfig[param]?.color || '#8884d8'}
                          strokeWidth={2}
                          dot={false}
                          name={chartConfig[param]?.label || param}
                          connectNulls={false}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {activeTab === 'table' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-medium">Data Table ({sessionData.length} records)</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleExport('json')}
                    className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    Export JSON
                  </button>
                  <button
                    onClick={() => handleExport('csv')}
                    className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600"
                  >
                    Export CSV
                  </button>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full border border-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 border-b">
                        Timestamp
                      </th>
                      {dataFilters.parameters.map(param => (
                        <th key={param} className="px-4 py-2 text-left text-sm font-medium text-gray-700 border-b">
                          {chartConfig[param]?.label || param} ({chartConfig[param]?.unit || ''})
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sessionData.slice(0, 100).map((dataPoint, index) => (
                      <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-4 py-2 text-sm text-gray-900 border-b">
                          {new Date(dataPoint.timestamp).toLocaleString()}
                        </td>
                        {dataFilters.parameters.map(param => (
                          <td key={param} className="px-4 py-2 text-sm text-gray-900 border-b">
                            {dataPoint[param] !== undefined ? (dataPoint[param] as number)?.toFixed(2) : 'N/A'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {sessionData.length > 100 && (
                  <p className="text-sm text-gray-500 mt-2 text-center">
                    Showing first 100 records. Use export function to get all data.
                  </p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'info' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-medium mb-3">Session Details</h3>
                  <div className="space-y-2 text-sm">
                    <div><strong>Session ID:</strong> {session.id}</div>
                    <div><strong>Status:</strong> <span className={`px-2 py-1 rounded-full text-xs ${
                      session.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>{session.status}</span></div>
                    <div><strong>Start Time:</strong> {new Date(session.startTime).toLocaleString()}</div>
                    {session.endTime && (
                      <div><strong>End Time:</strong> {new Date(session.endTime).toLocaleString()}</div>
                    )}
                    {session.duration && (
                      <div><strong>Duration:</strong> {Math.floor(session.duration / 60)}:{(session.duration % 60).toString().padStart(2, '0')}</div>
                    )}
                    <div><strong>Data Points:</strong> {session.dataPointCount}</div>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-medium mb-3">Vehicle Information</h3>
                  <div className="space-y-2 text-sm">
                    {session.vehicleInfo ? (
                      Object.entries(session.vehicleInfo).map(([key, value]) => (
                        <div key={key}><strong>{key}:</strong> {String(value)}</div>
                      ))
                    ) : (
                      <div className="text-gray-500">No vehicle information available</div>
                    )}
                  </div>
                </div>
              </div>

              {session.sessionNotes && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-medium mb-3">Session Notes</h3>
                  <p className="text-sm">{session.sessionNotes}</p>
                </div>
              )}

              {session.tags && session.tags.length > 0 && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-medium mb-3">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {session.tags.map(tag => (
                      <span key={tag} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-6 border-t bg-gray-50">
          <button
            onClick={() => handleExport('json')}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export Data
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// Enhanced Real-time OBD2 Chart Component
const IntegratedOBD2Chart = ({ parameters = ['rpm', 'speed', 'engineTemp'], maxDataPoints = 100 }) => {
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [obd2Connected, setObd2Connected] = useState(false);
  const { streamingState, connectToBackend, streamDataPoint, startStreaming, stopStreaming, startNewSession } = useOBD2Integration();

  // Subscribe to OBD2 data from your existing service
  useEffect(() => {
    const unsubscribe = unifiedOBD2Service.subscribe((obd2State) => {
      if (obd2State.lastData && streamingState.isStreaming) {
        // Stream data to backend if session is active
        streamDataPoint(obd2State.lastData);
        
        // Update local chart data - filter out complex objects
        const filteredData = Object.entries(obd2State.lastData).reduce((acc, [key, value]) => {
          if (typeof value === 'number' || typeof value === 'string') {
            acc[key] = value;
          }
          return acc;
        }, {} as Record<string, number | string>);

        const newDataPoint: ChartDataPoint = {
          ...filteredData,
          timestamp: new Date().toLocaleTimeString()
        };

        setData(prev => {
          const updated = [...prev, newDataPoint];
          return updated.slice(-maxDataPoints);
        });
      }
      
      setObd2Connected(obd2State.isConnected);
    });

    return unsubscribe;
  }, [streamingState.isStreaming, maxDataPoints]);

  const handleStartStreaming = async () => {
    try {
      if (!streamingState.isConnected) {
        await connectToBackend();
      }
      
      if (!streamingState.currentSession) {
        // Start session first
        await startNewSession({
          sessionName: `OBD2 Session ${new Date().toLocaleString()}`,
          vehicleInfo: unifiedOBD2Service.getState().connectedDevice
        });
      }
      
      // Start OBD2 data collection
      unifiedOBD2Service.startDataStream(1000);
      startStreaming();
    } catch (error) {
      console.error('Failed to start streaming:', error);
    }
  };

  const handleStopStreaming = () => {
    unifiedOBD2Service.stopDataStream();
    stopStreaming();
  };

  const chartConfig: Record<string, { color: string; label: string; unit: string }> = {
    rpm: { color: '#ff6b6b', label: 'RPM', unit: 'rpm' },
    speed: { color: '#4ecdc4', label: 'Speed', unit: 'km/h' },
    engineTemp: { color: '#45b7d1', label: 'Engine Temp', unit: '°C' },
    throttlePosition: { color: '#f9ca24', label: 'Throttle', unit: '%' },
    engineLoad: { color: '#6c5ce7', label: 'Engine Load', unit: '%' },
    maf: { color: '#fd79a8', label: 'MAF', unit: 'g/s' },
    map: { color: '#00b894', label: 'MAP', unit: 'kPa' }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-600" />
          Real-time OBD2 Data
          {obd2Connected && (
            <span className="text-green-600 text-sm">• Connected</span>
          )}
          {streamingState.isConnected && (
            <span className="text-blue-600 text-sm">• Backend Connected</span>
          )}
        </h3>
        
        <div className="flex gap-2">
          <button
            onClick={streamingState.isStreaming ? handleStopStreaming : handleStartStreaming}
            disabled={!obd2Connected}
            className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 disabled:opacity-50 ${
              streamingState.isStreaming 
                ? 'bg-red-500 hover:bg-red-600 text-white' 
                : 'bg-green-500 hover:bg-green-600 text-white'
            }`}
          >
            {streamingState.isStreaming ? (
              <>
                <Square className="w-4 h-4" />
                Stop
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Start
              </>
            )}
          </button>
          <button
            onClick={() => setData([])}
            className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium"
          >
            Clear
          </button>
        </div>
      </div>

      {streamingState.error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-lg text-red-700">
          {streamingState.error}
        </div>
      )}

      <div className="h-96">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis 
              dataKey="timestamp" 
              tick={{ fontSize: 12 }}
              interval="preserveStartEnd"
            />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#1f2937', 
                border: 'none', 
                borderRadius: '8px',
                color: '#fff'
              }}
              formatter={(value, name) => [
                `${(value as number)?.toFixed(1)} ${chartConfig[name]?.unit || ''}`,
                chartConfig[name]?.label || name
              ]}
            />
            <Legend />
            {parameters.map(param => (
              <Line
                key={param}
                type="monotone"
                dataKey={param}
                stroke={chartConfig[param]?.color || '#8884d8'}
                strokeWidth={2}
                dot={false}
                name={chartConfig[param]?.label || param}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        {parameters.map(param => {
          const latest = data[data.length - 1];
          const value = latest?.[param];
          const config = chartConfig[param];
          
          return (
            <div key={param} className="bg-gray-50 rounded-lg p-3">
              <div className="text-sm text-gray-600">{config?.label}</div>
              <div className="text-xl font-bold" style={{ color: config?.color }}>
                {value ? `${(value as number)?.toFixed(1)} ${config?.unit}` : '-- --'}
              </div>
            </div>
          );
        })}
      </div>

      {streamingState.currentSession && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-sm text-blue-800">
            <strong>Active Session:</strong> {streamingState.currentSession.id}
          </div>
          <div className="text-sm text-blue-600">
            Started: {new Date(streamingState.currentSession.startTime).toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
};

// Enhanced Session Manager Component with Search and View capabilities
const IntegratedSessionManager = () => {
  const { 
    streamingState, 
    sessions, 
    loading, 
    error,
    connectToBackend,
    startNewSession, 
    endCurrentSession, 
    searchSessions, 
    deleteSession 
  } = useOBD2Integration();

  // Search and filter states
  const [searchFilters, setSearchFilters] = useState({
    searchTerm: '',
    status: '',
    userId: '',
    vehicleId: '',
    startDate: '',
    endDate: '',
    limit: 50,
    offset: 0
  });

  const [sessionForm, setSessionForm] = useState({
    sessionName: '',
    userId: '',
    vehicleId: '',
    sessionNotes: '',
    tags: ''
  });

  const [showFilters, setShowFilters] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [totalSessions, setTotalSessions] = useState(0);

  useEffect(() => {
    handleSearch();
  }, []);

  const handleSearch = async () => {
    try {
      const result = await searchSessions(searchFilters);
      setTotalSessions(result.total || 0);
    } catch (error) {
      console.error('Search failed:', error);
    }
  };

  const handleStartSession = async () => {
    try {
      if (!streamingState.isConnected) {
        await connectToBackend();
      }

      const sessionOptions = {
        ...sessionForm,
        tags: sessionForm.tags ? sessionForm.tags.split(',').map(t => t.trim()) : [],
        vehicleInfo: unifiedOBD2Service.getState().connectedDevice || {}
      };

      await startNewSession(sessionOptions);
      
      // Clear form
      setSessionForm({
        sessionName: '',
        userId: '',
        vehicleId: '',
        sessionNotes: '',
        tags: ''
      });

      // Refresh session list
      handleSearch();
    } catch (error) {
      console.error('Failed to start session:', error);
    }
  };

  const handleEndSession = async () => {
    try {
      await endCurrentSession();
      await handleSearch(); // Refresh session list
    } catch (error) {
      console.error('Failed to end session:', error);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (window.confirm('Are you sure you want to delete this session? This action cannot be undone.')) {
      await deleteSession(sessionId);
      handleSearch(); // Refresh list
    }
  };

  const handleViewSession = (session: Session) => {
    console.log('Attempting to view session:', session);
    
    if (!session || !session.id || session.id === 'undefined' || session.id === 'null') {
      console.error('Cannot view session: Invalid session ID', session);
      return;
    }
    
    console.log('Setting selected session with ID:', session.id);
    setSelectedSession(session);
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const handleLoadMore = () => {
    setSearchFilters(prev => ({
      ...prev,
      offset: prev.offset + prev.limit
    }));
    // This will trigger useEffect to search with new offset
    setTimeout(handleSearch, 0);
  };

  return (
    <div className="space-y-6">
      {/* Session Data Viewer Modal */}
      {selectedSession && (
        <SessionDataViewer 
          session={selectedSession} 
          onClose={() => setSelectedSession(null)} 
        />
      )}

      {/* Connection Status */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Database className="w-5 h-5 text-blue-600" />
          Connection Status
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${
              unifiedOBD2Service.getState().isConnected ? 'bg-green-500' : 'bg-red-500'
            }`} />
            <span>OBD2 Device: {
              unifiedOBD2Service.getState().isConnected ? 'Connected' : 'Disconnected'
            }</span>
          </div>
          
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${
              streamingState.isConnected ? 'bg-green-500' : 'bg-red-500'
            }`} />
            <span>Backend: {streamingState.isConnected ? 'Connected' : 'Disconnected'}</span>
          </div>
        </div>

        {!streamingState.isConnected && (
          <button
            onClick={connectToBackend}
            className="mt-4 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium"
          >
            Connect to Backend
          </button>
        )}
      </div>

      {/* Session Control */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Car className="w-5 h-5 text-blue-600" />
          Session Management
        </h3>

        {streamingState.currentSession ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-medium text-green-800">Active Session</h4>
                  <p className="text-sm text-green-600">ID: {streamingState.currentSession.id}</p>
                  <p className="text-sm text-green-600">
                    Started: {formatDate(streamingState.currentSession.startTime)}
                  </p>
                  <p className="text-sm text-green-600">
                    Data Points: {streamingState.currentSession.dataPointCount || 0}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {streamingState.isStreaming && (
                    <div className="flex items-center gap-1 text-green-600">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-xs">Streaming</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={handleEndSession}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium flex items-center gap-2"
            >
              <Square className="w-4 h-4" />
              End Session
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Session Name"
                value={sessionForm.sessionName}
                onChange={(e) => setSessionForm(prev => ({ ...prev, sessionName: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="text"
                placeholder="User ID (optional)"
                value={sessionForm.userId}
                onChange={(e) => setSessionForm(prev => ({ ...prev, userId: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <input
              type="text"
              placeholder="Session notes"
              value={sessionForm.sessionNotes}
              onChange={(e) => setSessionForm(prev => ({ ...prev, sessionNotes: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            
            <input
              type="text"
              placeholder="Tags (comma-separated)"
              value={sessionForm.tags}
              onChange={(e) => setSessionForm(prev => ({ ...prev, tags: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />

            <button
              onClick={handleStartSession}
              disabled={!streamingState.isConnected}
              className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium flex items-center gap-2 disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              Start New Session
            </button>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded-lg text-red-700">
            {error}
          </div>
        )}
      </div>

      {/* Session Search and History */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            Session History ({totalSessions} total sessions)
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium flex items-center gap-2"
            >
              <Filter className="w-4 h-4" />
              {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium flex items-center gap-2"
            >
              <Search className="w-4 h-4" />
              Search
            </button>
          </div>
        </div>

        {/* Search Filters */}
        {showFilters && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Search Term</label>
                <input
                  type="text"
                  placeholder="Search by session name or notes..."
                  value={searchFilters.searchTerm}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={searchFilters.status}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Status</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="paused">Paused</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">User ID</label>
                <input
                  type="text"
                  placeholder="Filter by user ID..."
                  value={searchFilters.userId}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, userId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={searchFilters.startDate}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, startDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={searchFilters.endDate}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, endDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Results Per Page</label>
                <select
                  value={searchFilters.limit}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, limit: parseInt(e.target.value), offset: 0 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSearch}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium"
              >
                Apply Filters
              </button>
              <button
                onClick={() => {
                  setSearchFilters({
                    searchTerm: '',
                    status: '',
                    userId: '',
                    vehicleId: '',
                    startDate: '',
                    endDate: '',
                    limit: 50,
                    offset: 0
                  });
                  handleSearch();
                }}
                className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
            <p className="text-gray-600 mt-2">Loading sessions...</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No diagnostic sessions found</p>
            {Object.values(searchFilters).some(v => v !== '' && v !== 0) && (
              <p className="text-sm mt-2">Try adjusting your search filters</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map(session => (
              <div key={session.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium">
                        {session.sessionName || `Session ${session.id.slice(-6)}`}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        session.status === 'completed' 
                          ? 'bg-green-100 text-green-700'
                          : session.status === 'active'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {session.status}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                      <div>
                        <strong>Started:</strong> {formatDate(session.startTime)}
                      </div>
                      {session.endTime && (
                        <div>
                          <strong>Duration:</strong> {formatDuration(session.duration)}
                        </div>
                      )}
                      <div>
                        <strong>Data Points:</strong> {session.dataPointCount}
                      </div>
                    </div>

                    {session.sessionNotes && (
                      <p className="mt-2 text-sm text-gray-700">{session.sessionNotes}</p>
                    )}

                    {session.tags && session.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {session.tags.map(tag => (
                          <span 
                            key={tag}
                            className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleViewSession(session)}
                      className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg"
                      title="View Session Data"
                      disabled={!session.id || session.id === 'undefined'}
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteSession(session.id)}
                      className="p-2 text-red-600 hover:bg-red-100 rounded-lg"
                      title="Delete Session"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* Load More Button */}
            {sessions.length < totalSessions && (
              <div className="text-center pt-4">
                <button
                  onClick={handleLoadMore}
                  className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium"
                >
                  Load More ({sessions.length} of {totalSessions})
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export { IntegratedOBD2Chart, IntegratedSessionManager, useOBD2Integration, SessionDataViewer, EnhancedOBD2Service };