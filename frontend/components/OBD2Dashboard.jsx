// frontend/components/OBD2Dashboard.jsx - Example React component using the OBD2 hooks

import React, { useState, useEffect } from 'react';
import { 
  useOBD2LiveData, 
  useOBD2SessionStats, 
  useOBD2HistoricalData 
} from '../hooks/useOBD2LiveData.js';

const OBD2Dashboard = ({ sessionId }) => {
  const [updateMethod, setUpdateMethod] = useState('polling');
  const [showHistorical, setShowHistorical] = useState(false);

  // Live data hook with chosen method
  const {
    data: liveData,
    connectionStatus,
    error: liveError,
    activeMethod,
    clearData
  } = useOBD2LiveData(sessionId, {
    method: updateMethod,
    fallback: true,
    maxDataPoints: 50,
    adaptive: true
  });

  // Session statistics
  const {
    stats,
    loading: statsLoading,
    error: statsError,
    refresh: refreshStats
  } = useOBD2SessionStats(sessionId);

  // Historical data
  const {
    data: historicalData,
    loading: historicalLoading,
    error: historicalError,
    fetchAggregated
  } = useOBD2HistoricalData(sessionId);

  // Get latest data point for current values display
  const latestData = liveData.length > 0 ? liveData[liveData.length - 1] : null;

  // Load historical data when requested
  useEffect(() => {
    if (showHistorical && sessionId) {
      fetchAggregated('minute', 100);
    }
  }, [showHistorical, sessionId, fetchAggregated]);

  // Connection status indicator
  const getStatusColor = (status) => {
    switch (status) {
      case 'connected': return '#4CAF50';
      case 'connecting': return '#FF9800';
      case 'disconnected': return '#f44336';
      case 'error': return '#f44336';
      default: return '#9E9E9E';
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>OBD2 Real-time Dashboard</h1>
      
      {/* Connection Status */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '10px', 
        marginBottom: '20px',
        padding: '10px',
        backgroundColor: '#f5f5f5',
        borderRadius: '5px'
      }}>
        <div 
          style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: getStatusColor(connectionStatus)
          }}
        />
        <span>Status: {connectionStatus}</span>
        <span>Method: {activeMethod}</span>
        {liveError && <span style={{ color: 'red' }}>Error: {liveError}</span>}
      </div>

      {/* Method Selection */}
      <div style={{ marginBottom: '20px' }}>
        <h3>Update Method:</h3>
        <select 
          value={updateMethod} 
          onChange={(e) => setUpdateMethod(e.target.value)}
          style={{ padding: '5px 10px', fontSize: '14px' }}
        >
          <option value=\"polling\">Smart Polling</option>
          <option value=\"sse\">Server-Sent Events (SSE)</option>
          <option value=\"long-polling\">Long Polling</option>
        </select>
        <button 
          onClick={clearData}
          style={{ marginLeft: '10px', padding: '5px 10px' }}
        >
          Clear Data
        </button>
      </div>

      {/* Current Values Display */}
      {latestData && (
        <div style={{ marginBottom: '30px' }}>
          <h3>Current Values</h3>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '15px'
          }}>
            <ValueCard 
              label=\"RPM\" 
              value={latestData.rpm} 
              unit=\"rpm\"
              color=\"#2196F3\"
            />
            <ValueCard 
              label=\"Speed\" 
              value={latestData.speed} 
              unit=\"km/h\"
              color=\"#4CAF50\"
            />
            <ValueCard 
              label=\"Engine Temp\" 
              value={latestData.engineTemp} 
              unit=\"°C\"
              color=\"#FF5722\"
            />
            <ValueCard 
              label=\"Throttle Position\" 
              value={latestData.throttlePosition} 
              unit=\"%\"
              color=\"#9C27B0\"
            />
            <ValueCard 
              label=\"Engine Load\" 
              value={latestData.engineLoad} 
              unit=\"%\"
              color=\"#FF9800\"
            />
            <ValueCard 
              label=\"MAF\" 
              value={latestData.maf} 
              unit=\"g/s\"
              color=\"#607D8B\"
            />
          </div>
        </div>
      )}

      {/* Session Statistics */}
      <div style={{ marginBottom: '30px' }}>
        <h3>Session Statistics</h3>
        {statsLoading && <p>Loading stats...</p>}
        {statsError && <p style={{ color: 'red' }}>Stats Error: {statsError}</p>}
        {stats && (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '15px'
          }}>
            <StatCard label=\"Data Points\" value={stats.dataPointCount} />
            <StatCard 
              label=\"Duration\" 
              value={stats.duration ? `${Math.round(stats.duration / 1000)}s` : 'N/A'} 
            />
            <StatCard 
              label=\"Start Time\" 
              value={stats.startTime ? new Date(stats.startTime).toLocaleTimeString() : 'N/A'} 
            />
            <StatCard 
              label=\"End Time\" 
              value={stats.endTime ? new Date(stats.endTime).toLocaleTimeString() : 'Active'} 
            />
          </div>
        )}
        <button 
          onClick={refreshStats}
          style={{ marginTop: '10px', padding: '5px 10px' }}
        >
          Refresh Stats
        </button>
      </div>

      {/* Live Data Table */}
      <div style={{ marginBottom: '30px' }}>
        <h3>Live Data Stream ({liveData.length} points)</h3>
        <div style={{ 
          maxHeight: '300px', 
          overflowY: 'auto',
          border: '1px solid #ddd',
          borderRadius: '5px'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f9f9f9' }}>
              <tr>
                <th style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>Time</th>
                <th style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>RPM</th>
                <th style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>Speed</th>
                <th style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>Temp</th>
                <th style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>Throttle</th>
                <th style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>Load</th>
              </tr>
            </thead>
            <tbody>
              {liveData.slice(-20).reverse().map((point, index) => (
                <tr key={point.timestamp || index}>
                  <td style={{ padding: '6px', borderBottom: '1px solid #eee' }}>
                    {new Date(point.timestamp).toLocaleTimeString()}
                  </td>
                  <td style={{ padding: '6px', borderBottom: '1px solid #eee' }}>
                    {point.rpm !== undefined ? Math.round(point.rpm) : '-'}
                  </td>
                  <td style={{ padding: '6px', borderBottom: '1px solid #eee' }}>
                    {point.speed !== undefined ? Math.round(point.speed) : '-'}
                  </td>
                  <td style={{ padding: '6px', borderBottom: '1px solid #eee' }}>
                    {point.engineTemp !== undefined ? Math.round(point.engineTemp) : '-'}
                  </td>
                  <td style={{ padding: '6px', borderBottom: '1px solid #eee' }}>
                    {point.throttlePosition !== undefined ? Math.round(point.throttlePosition) : '-'}
                  </td>
                  <td style={{ padding: '6px', borderBottom: '1px solid #eee' }}>
                    {point.engineLoad !== undefined ? Math.round(point.engineLoad) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Historical Data Section */}
      <div>
        <h3>Historical Data</h3>
        <button 
          onClick={() => setShowHistorical(!showHistorical)}
          style={{ padding: '8px 16px', marginBottom: '15px' }}
        >
          {showHistorical ? 'Hide' : 'Show'} Historical Data
        </button>
        
        {showHistorical && (
          <div>
            {historicalLoading && <p>Loading historical data...</p>}
            {historicalError && <p style={{ color: 'red' }}>Historical Error: {historicalError}</p>}
            {historicalData.length > 0 && (
              <div>
                <p>Showing {historicalData.length} aggregated data points</p>
                <div style={{ 
                  maxHeight: '200px', 
                  overflowY: 'auto',
                  border: '1px solid #ddd',
                  borderRadius: '5px'
                }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f9f9f9' }}>
                      <tr>
                        <th style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>Time</th>
                        <th style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>Avg RPM</th>
                        <th style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>Avg Speed</th>
                        <th style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>Avg Temp</th>
                        <th style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historicalData.slice(-20).reverse().map((point, index) => (
                        <tr key={point.timestamp || index}>
                          <td style={{ padding: '6px', borderBottom: '1px solid #eee' }}>
                            {new Date(point.timestamp).toLocaleTimeString()}
                          </td>
                          <td style={{ padding: '6px', borderBottom: '1px solid #eee' }}>
                            {point.rpm !== null ? Math.round(point.rpm) : '-'}
                          </td>
                          <td style={{ padding: '6px', borderBottom: '1px solid #eee' }}>
                            {point.speed !== null ? Math.round(point.speed) : '-'}
                          </td>
                          <td style={{ padding: '6px', borderBottom: '1px solid #eee' }}>
                            {point.engineTemp !== null ? Math.round(point.engineTemp) : '-'}
                          </td>
                          <td style={{ padding: '6px', borderBottom: '1px solid #eee' }}>
                            {point.count || 0}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Helper component for value cards
const ValueCard = ({ label, value, unit, color }) => (
  <div style={{
    padding: '15px',
    backgroundColor: 'white',
    border: `3px solid ${color}`,
    borderRadius: '8px',
    textAlign: 'center'
  }}>
    <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>
      {label}
    </div>
    <div style={{ fontSize: '24px', fontWeight: 'bold', color: color }}>
      {value !== undefined && value !== null ? `${Math.round(value * 100) / 100} ${unit || ''}` : 'N/A'}
    </div>
  </div>
);

// Helper component for stat cards
const StatCard = ({ label, value }) => (
  <div style={{
    padding: '15px',
    backgroundColor: 'white',
    border: '1px solid #ddd',
    borderRadius: '8px',
    textAlign: 'center'
  }}>
    <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>
      {label}
    </div>
    <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
      {value || 'N/A'}
    </div>
  </div>
);

export default OBD2Dashboard;