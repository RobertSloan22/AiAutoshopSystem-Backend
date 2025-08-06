import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Play, Square, Pause, Download, Trash2, Eye, Calendar, Car, Database, Activity, AlertTriangle, CheckCircle, Search, Filter, ChevronDown, ChevronUp, X } from 'lucide-react';
import { useOBD2Integration, SessionDataViewer, EnhancedOBD2Service } from './OBD2IntegratedComponents';
import { unifiedOBD2Service } from '../services/UnifiedOBD2Service';

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

// Define the data point interface
interface DataPoint {
  timestamp: string;
  rpm: number;
  speed: number;
  engineTemp: number;
  throttlePosition: number;
  engineLoad: number;
  maf: number;
  map: number;
}

// Real-time OBD2 Data Chart Component
const OBD2RealTimeChart = ({ parameters = ['rpm', 'speed', 'engineTemp'], maxDataPoints = 50 }) => {
  const [data, setData] = useState<DataPoint[]>([]);
  const [obd2Connected, setObd2Connected] = useState(false);
  const { streamingState, connectToBackend, streamDataPoint, startStreaming, stopStreaming, startNewSession } = useOBD2Integration();

  // Subscribe to OBD2 data from unified service
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const initializeSubscription = async () => {
      try {
        // Ensure service is initialized before subscribing
        if (!unifiedOBD2Service.isBluetoothSupported()) {
          console.warn('⚠️ Bluetooth not supported, skipping OBD2 subscription');
          return;
        }

        unsubscribe = unifiedOBD2Service.subscribe((obd2State) => {
          if (obd2State.lastData && streamingState.isStreaming) {
            // Stream data to backend if session is active
            streamDataPoint(obd2State.lastData);
            
            // Update local chart data
            const newDataPoint: DataPoint = {
              timestamp: new Date().toLocaleTimeString(),
              rpm: obd2State.lastData.rpm || 0,
              speed: obd2State.lastData.speed || 0,
              engineTemp: obd2State.lastData.engineTemp || 0,
              throttlePosition: obd2State.lastData.throttlePosition || 0,
              engineLoad: obd2State.lastData.engineLoad || 0,
              maf: obd2State.lastData.maf || 0,
              map: obd2State.lastData.map || 0
            };

            setData(prev => {
              const updated = [...prev, newDataPoint];
              return updated.slice(-maxDataPoints);
            });
          }
          
          setObd2Connected(obd2State.isConnected);
        });
      } catch (error) {
        console.error('❌ Failed to initialize OBD2 subscription:', error);
      }
    };

    initializeSubscription();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [streamingState.isStreaming, maxDataPoints, streamDataPoint]);

  const handleStartStreaming = async () => {
    try {
      if (!streamingState.isConnected) {
        await connectToBackend();
      }
      
      if (!streamingState.currentSession) {
        await startNewSession({
          sessionName: `Dashboard Session ${new Date().toLocaleString()}`,
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
    engineTemp: { color: '#45b7d1', label: 'Temp', unit: '°C' },
    throttlePosition: { color: '#f9ca24', label: 'Throttle', unit: '%' },
    engineLoad: { color: '#6c5ce7', label: 'Load', unit: '%' },
    maf: { color: '#fd79a8', label: 'MAF', unit: 'g/s' },
    map: { color: '#00b894', label: 'MAP', unit: 'kPa' }
  };

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg w-full h-full flex flex-col">
      <div className="flex justify-between items-center mb-3 p-3">
        <h3 className="text-xl font-semibold flex items-center gap-1 text-gray-100">
          <Activity className="w-4 h-4 text-blue-400" />
          Real-time Data
          {obd2Connected && (
            <span className="text-green-400 text-lg">• OBD2</span>
          )}
          {streamingState.isConnected && (
            <span className="text-blue-400 text-lg">• Backend</span>
          )}
        </h3>
        <div className="flex gap-1">
          <button
            onClick={streamingState.isStreaming ? handleStopStreaming : handleStartStreaming}
            disabled={!obd2Connected}
            className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 disabled:opacity-50 ${
              streamingState.isStreaming 
                ? 'bg-red-500 hover:bg-red-600 text-white' 
                : 'bg-green-500 hover:bg-green-600 text-white'
            }`}
          >
            {streamingState.isStreaming ? (
              <>
                <Square className="w-3 h-3" />
                Stop
              </>
            ) : (
              <>
                <Play className="w-3 h-3" />
                Start
              </>
            )}
          </button>
          <button
            onClick={() => setData([])}
            className="px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-xs font-medium"
          >
            Clear
          </button>
        </div>
      </div>

      {streamingState.error && (
        <div className="mx-3 mb-3 p-2 bg-red-900/50 border border-red-700 rounded text-red-300 text-xs">
          {streamingState.error}
        </div>
      )}

      <div className="flex-1 min-h-0 px-3">
        <ResponsiveContainer width="100%" height="100%" minHeight={200}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis 
              dataKey="timestamp" 
              tick={{ fontSize: 10, fill: '#9CA3AF' }}
              axisLine={{ stroke: '#4B5563' }}
              tickLine={{ stroke: '#4B5563' }}
              interval="preserveStartEnd"
            />
            <YAxis 
              tick={{ fontSize: 10, fill: '#9CA3AF' }}
              axisLine={{ stroke: '#4B5563' }}
              tickLine={{ stroke: '#4B5563' }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#1F2937', 
                border: '1px solid #374151', 
                borderRadius: '6px',
                color: '#F9FAFB'
              }}
              formatter={(value: any, name: any) => [
                `${typeof value === 'number' ? value.toFixed(1) : value} ${chartConfig[name as string]?.unit || ''}`,
                chartConfig[name as string]?.label || name
              ]}
            />
            {parameters.map(param => (
              <Line
                key={param}
                type="monotone"
                dataKey={param}
                stroke={chartConfig[param as string]?.color || '#8884d8'}
                strokeWidth={1.5}
                dot={false}
                name={chartConfig[param as string]?.label || param}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 px-3 pb-3 grid grid-cols-2 gap-2">
        {parameters.slice(0, 4).map(param => {
          const latest = data[data.length - 1];
          const value = latest?.[param as keyof DataPoint];
          const config = chartConfig[param as string];
          
          return (
            <div key={param} className="bg-gray-700 rounded p-2">
              <div className="text-xs text-gray-300">{config?.label}</div>
              <div className="text-sm font-bold text-gray-100">
                {typeof value === 'number' ? `${value.toFixed(1)} ${config?.unit}` : '--'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Enhanced Session Manager Component with Search
const SessionManager = () => {
  const { 
    streamingState, 
    sessions, 
    loading, 
    error,
    connectToBackend,
    startNewSession, 
    endCurrentSession, 
    searchSessions,
    deleteSession,
    startStreaming,
    stopStreaming
  } = useOBD2Integration();
  
  const [showForm, setShowForm] = useState(false);
  const [sessionForm, setSessionForm] = useState({
    sessionName: '',
    userId: '',
    vehicleId: '',
    sessionNotes: '',
    tags: ''
  });

  // Search states
  const [showSearch, setShowSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [searchFilters, setSearchFilters] = useState({
    searchTerm: '',
    status: '',
    userId: '',
    limit: 10,
    offset: 0
  });

  useEffect(() => {
    // Only load sessions if backend is connected
    if (streamingState.isConnected) {
      searchSessions(searchFilters);
    }
  }, [streamingState.isConnected]);

  const handleSearch = async () => {
    await searchSessions({
      ...searchFilters,
      searchTerm: searchTerm
    });
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
      
      setSessionForm({ sessionName: '', userId: '', vehicleId: '', sessionNotes: '', tags: '' });
      setShowForm(false);
      
      // Refresh sessions
      await searchSessions(searchFilters);
    } catch (error) {
      console.error('Failed to start session:', error);
    }
  };

  const handleEndSession = async () => {
    try {
      await endCurrentSession();
      await searchSessions(searchFilters);
    } catch (error) {
      console.error('Failed to end session:', error);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (window.confirm('Delete this session?')) {
      await deleteSession(sessionId);
      await searchSessions(searchFilters);
    }
  };

  const handleViewSession = (session: Session) => {
    if (!session || !session.id || session.id === 'undefined' || session.id === 'null') {
      console.error('Cannot view session: Invalid session ID', session);
      return;
    }
    setSelectedSession(session);
  };

  const toggleStreaming = async () => {
    if (!streamingState.currentSession) return;

    try {
      if (streamingState.isStreaming) {
        unifiedOBD2Service.stopDataStream();
        stopStreaming();
      } else {
        unifiedOBD2Service.startDataStream(1000);
        startStreaming();
      }
    } catch (error) {
      console.error('Failed to toggle streaming:', error);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="h-full flex flex-col space-y-3">
      {/* Session Data Viewer Modal */}
      {selectedSession && (
        <SessionDataViewer 
          session={selectedSession} 
          onClose={() => setSelectedSession(null)} 
        />
      )}

      {/* Current Session Panel */}
      <div className="bg-gray-800 rounded-lg shadow-lg p-3 flex-1">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-1 text-gray-100">
          <Database className="w-4 h-4 text-blue-400" />
          Session Control
        </h3>

        {streamingState.currentSession ? (
          <div className="space-y-3">
            <div className="bg-green-900/50 border border-green-700 rounded-lg p-3">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-medium text-green-300 text-sm">Active Session</h4>
                  <p className="text-xs text-green-400">ID: {streamingState.currentSession.id}</p>
                  <p className="text-xs text-green-400">
                    {new Date(streamingState.currentSession.startTime).toLocaleTimeString()}
                  </p>
                  <p className="text-xs text-green-400">
                    Data Points: {streamingState.currentSession.dataPointCount || 0}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {streamingState.isStreaming && (
                    <div className="flex items-center gap-1 text-green-400">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                      <span className="text-xs">Live</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={toggleStreaming}
                className={`px-3 py-1 rounded text-xs font-medium flex items-center gap-1 flex-1 justify-center ${
                  streamingState.isStreaming
                    ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                    : 'bg-green-500 hover:bg-green-600 text-white'
                }`}
              >
                {streamingState.isStreaming ? (
                  <>
                    <Pause className="w-3 h-3" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3" />
                    Start
                  </>
                )}
              </button>
              
              <button
                onClick={handleEndSession}
                className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-xs font-medium flex items-center gap-1"
              >
                <Square className="w-3 h-3" />
                End
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {!showForm ? (
              <button
                onClick={() => setShowForm(true)}
                className="w-full px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm font-medium flex items-center justify-center gap-1"
              >
                <Play className="w-4 h-4" />
                Start New Session
              </button>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Session notes"
                  value={sessionForm.sessionNotes}
                  onChange={(e) => setSessionForm(prev => ({ ...prev, sessionNotes: e.target.value }))}
                  className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                
                <div className="flex gap-2">
                  <button
                    onClick={handleStartSession}
                    disabled={!streamingState.isConnected}
                    className="flex-1 px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded text-xs font-medium disabled:opacity-50"
                  >
                    Start
                  </button>
                  <button
                    onClick={() => setShowForm(false)}
                    className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-xs font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        
        {!streamingState.isConnected && (
          <button
            onClick={connectToBackend}
            className="w-full mt-3 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm font-medium"
          >
            Connect to Backend
          </button>
        )}

        {error && (
          <div className="mt-3 p-2 bg-red-900/50 border border-red-700 rounded text-red-300 text-xs">
            {error}
          </div>
        )}
      </div>

      {/* Session History with Search */}
      <div className="bg-gray-800 rounded-lg shadow-lg p-3 flex-1">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-1 text-gray-100">
            <Calendar className="w-4 h-4 text-blue-400" />
            History
          </h3>
          <div className="flex gap-1">
            <button
              onClick={() => setShowSearch(!showSearch)}
              className={`px-2 py-1 ${showSearch ? 'bg-blue-600' : 'bg-gray-600'} hover:bg-blue-700 text-white rounded text-xs font-medium`}
              title="Search Sessions"
            >
              <Search className="w-3 h-3" />
            </button>
            <button
              onClick={() => searchSessions(searchFilters)}
              className="px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-xs font-medium"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Search Bar */}
        {showSearch && (
          <div className="mb-3 flex gap-2">
            <input
              type="text"
              placeholder="Search sessions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={searchFilters.status}
              onChange={(e) => setSearchFilters(prev => ({ ...prev, status: e.target.value }))}
              className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-gray-100 focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="paused">Paused</option>
            </select>
            <button
              onClick={handleSearch}
              className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs font-medium"
            >
              Search
            </button>
          </div>
        )}

        {loading ? (
          <div className="text-center py-4">
            <div className="animate-spin w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full mx-auto"></div>
            <p className="text-gray-400 mt-2 text-xs">Loading...</p>
          </div>
        ) : !sessions || sessions.length === 0 ? (
          <div className="text-center py-4 text-gray-500">
            <Database className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-xs">No sessions found</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {sessions?.map(session => (
              <div key={session.id} className="border border-gray-700 rounded-lg p-2 hover:bg-gray-700/50">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-200 text-xs">
                        {session.sessionName || `Session ${session.id.slice(-6)}`}
                      </span>
                      <span className={`px-1 py-0.5 rounded text-xs ${
                        session.status === 'completed' 
                          ? 'bg-green-800 text-green-300'
                          : session.status === 'active'
                          ? 'bg-blue-800 text-blue-300'
                          : 'bg-yellow-800 text-yellow-300'
                      }`}>
                        {session.status}
                      </span>
                    </div>
                    
                    <div className="text-xs text-gray-400">
                      <div>Started: {new Date(session.startTime).toLocaleDateString()}</div>
                      {session.endTime && (
                        <div>Duration: {formatDuration(session.duration || 0)}</div>
                      )}
                      <div>Data: {session.dataPointCount} points</div>
                    </div>

                    {session.sessionNotes && (
                      <div className="mt-1 text-xs text-gray-500 truncate">
                        {session.sessionNotes}
                      </div>
                    )}

                    {session.tags && session.tags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {session.tags.slice(0, 3).map(tag => (
                          <span 
                            key={tag}
                            className="px-1 py-0.5 bg-blue-900 text-blue-300 text-xs rounded"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-1 ml-2">
                    <button
                      onClick={() => handleViewSession(session)}
                      className="p-1 text-blue-400 hover:bg-blue-900/50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                      title="View"
                      disabled={!session.id || session.id === 'undefined'}
                    >
                      <Eye className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleDeleteSession(session.id)}
                      className="p-1 text-red-400 hover:bg-red-900/50 rounded"
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Main OBD2 Panel Component
const StreamingDashboard = () => {
  return (
    <div className="h-full bg-gray-900 p-3 flex flex-col">
      <div className="flex-1 space-y-3 overflow-hidden">
        <header className="bg-gray-800 rounded-lg shadow-lg p-3">
          <h1 className="text-lg font-bold text-gray-100 flex items-center gap-2">
            <Car className="w-5 h-5 text-blue-400" />
            OBD2 Diagnostics
          </h1>
          <p className="text-gray-400 mt-1 text-xs">
            Real-time vehicle diagnostics with session search
          </p>
        </header>

        <div className="flex-1 min-h-0">
          <OBD2RealTimeChart parameters={['rpm', 'speed', 'engineTemp', 'throttlePosition']} />
        </div>
        
        <div className="flex gap-3">
          <div className="flex-1">
            <SessionManager />
          </div>
        </div>
        
        {/* Connection Status Footer */}
        <div className="bg-gray-800 rounded-lg shadow-lg p-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                unifiedOBD2Service.getState().isConnected ? 'bg-green-500' : 'bg-red-500'
              }`} />
              <span className="text-gray-300">
                OBD2: {unifiedOBD2Service.getState().isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="w-3 h-3 text-gray-400" />
              <span className="text-gray-300">
                {unifiedOBD2Service.getState().lastData ? 'Receiving Data' : 'No Data'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StreamingDashboard;