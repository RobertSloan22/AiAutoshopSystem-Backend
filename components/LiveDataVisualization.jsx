// Live Data Visualization Component
import React, { useState, useEffect, useRef } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, ScatterChart, Scatter
} from 'recharts';
import { 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Gauge,
  Thermometer,
  Fuel,
  Zap,
  Eye,
  EyeOff
} from 'lucide-react';

const LiveDataVisualization = ({ 
  sessionId, 
  liveData = [], 
  diagnosticService,
  currentStep = {},
  theme = 'dark' 
}) => {
  const [visibleSensors, setVisibleSensors] = useState(new Set(['rpm', 'engineLoad', 'coolantTemp']));
  const [chartType, setChartType] = useState('line');
  const [timeRange, setTimeRange] = useState('5min');
  const [alerts, setAlerts] = useState([]);
  const [sensorStats, setSensorStats] = useState({});
  const [expectedRanges, setExpectedRanges] = useState({});
  const chartRef = useRef(null);

  // Define sensor metadata
  const sensorMetadata = {
    rpm: { 
      name: 'Engine RPM', 
      unit: 'RPM', 
      icon: Gauge, 
      color: '#3B82F6',
      normalRange: [800, 6000],
      warningRange: [6000, 7000],
      criticalRange: [7000, 8000]
    },
    engineLoad: { 
      name: 'Engine Load', 
      unit: '%', 
      icon: Activity, 
      color: '#10B981',
      normalRange: [0, 85],
      warningRange: [85, 95],
      criticalRange: [95, 100]
    },
    coolantTemp: { 
      name: 'Coolant Temperature', 
      unit: '°C', 
      icon: Thermometer, 
      color: '#EF4444',
      normalRange: [85, 105],
      warningRange: [105, 115],
      criticalRange: [115, 130]
    },
    intakeTemp: { 
      name: 'Intake Air Temperature', 
      unit: '°C', 
      icon: Thermometer, 
      color: '#F59E0B',
      normalRange: [20, 60],
      warningRange: [60, 80],
      criticalRange: [80, 100]
    },
    fuelTrimShort: { 
      name: 'Short Term Fuel Trim', 
      unit: '%', 
      icon: Fuel, 
      color: '#8B5CF6',
      normalRange: [-10, 10],
      warningRange: [-25, 25],
      criticalRange: [-40, 40]
    },
    fuelTrimLong: { 
      name: 'Long Term Fuel Trim', 
      unit: '%', 
      icon: Fuel, 
      color: '#EC4899',
      normalRange: [-10, 10],
      warningRange: [-25, 25],
      criticalRange: [-40, 40]
    },
    maf: { 
      name: 'Mass Air Flow', 
      unit: 'g/s', 
      icon: Activity, 
      color: '#06B6D4',
      normalRange: [2, 200],
      warningRange: [200, 300],
      criticalRange: [300, 400]
    },
    throttlePosition: { 
      name: 'Throttle Position', 
      unit: '%', 
      icon: Gauge, 
      color: '#84CC16',
      normalRange: [0, 100],
      warningRange: [],
      criticalRange: []
    },
    o2Sensor1: { 
      name: 'O2 Sensor 1', 
      unit: 'V', 
      icon: Zap, 
      color: '#F97316',
      normalRange: [0.1, 0.9],
      warningRange: [0, 0.1],
      criticalRange: [0.9, 1.2]
    },
    vehicleSpeed: { 
      name: 'Vehicle Speed', 
      unit: 'km/h', 
      icon: TrendingUp, 
      color: '#6366F1',
      normalRange: [0, 120],
      warningRange: [120, 160],
      criticalRange: [160, 200]
    }
  };

  // Process live data for charts
  const processedData = liveData.map((point, index) => ({
    ...point,
    timestamp: new Date(point.timestamp).toLocaleTimeString(),
    index
  }));

  // Calculate sensor statistics
  useEffect(() => {
    if (liveData.length > 0) {
      const stats = {};
      Object.keys(sensorMetadata).forEach(sensor => {
        const values = liveData
          .map(point => point[sensor])
          .filter(val => val !== undefined && val !== null);
        
        if (values.length > 0) {
          stats[sensor] = {
            current: values[values.length - 1],
            min: Math.min(...values),
            max: Math.max(...values),
            avg: values.reduce((a, b) => a + b, 0) / values.length,
            trend: values.length > 1 ? 
              (values[values.length - 1] - values[values.length - 2] > 0 ? 'up' : 'down') : 'stable'
          };
        }
      });
      setSensorStats(stats);
    }
  }, [liveData]);

  // Monitor for alerts
  useEffect(() => {
    if (Object.keys(sensorStats).length > 0) {
      const newAlerts = [];
      
      Object.entries(sensorStats).forEach(([sensor, stats]) => {
        const metadata = sensorMetadata[sensor];
        if (!metadata || !stats.current) return;

        const value = stats.current;
        let alertLevel = 'normal';
        
        if (metadata.criticalRange.length > 0) {
          if (value >= metadata.criticalRange[0] && value <= metadata.criticalRange[1]) {
            alertLevel = 'critical';
          }
        }
        
        if (alertLevel === 'normal' && metadata.warningRange.length > 0) {
          if (value >= metadata.warningRange[0] && value <= metadata.warningRange[1]) {
            alertLevel = 'warning';
          }
        }

        if (alertLevel !== 'normal') {
          newAlerts.push({
            sensor,
            level: alertLevel,
            message: `${metadata.name} ${alertLevel}: ${value}${metadata.unit}`,
            value,
            timestamp: new Date().toISOString()
          });
        }
      });
      
      setAlerts(newAlerts);
    }
  }, [sensorStats]);

  // Toggle sensor visibility
  const toggleSensor = (sensor) => {
    const newVisible = new Set(visibleSensors);
    if (newVisible.has(sensor)) {
      newVisible.delete(sensor);
    } else {
      newVisible.add(sensor);
    }
    setVisibleSensors(newVisible);
  };

  // Get sensor status color
  const getSensorStatusColor = (sensor) => {
    const alert = alerts.find(a => a.sensor === sensor);
    if (!alert) return 'text-green-400';
    return alert.level === 'critical' ? 'text-red-400' : 'text-yellow-400';
  };

  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-800 p-3 rounded shadow-lg border border-gray-600">
          <p className="text-gray-300 mb-2">{`Time: ${label}`}</p>
          {payload.map((entry, index) => {
            const metadata = sensorMetadata[entry.dataKey];
            return (
              <p key={index} style={{ color: entry.color }} className="text-sm">
                {`${metadata?.name || entry.dataKey}: ${entry.value}${metadata?.unit || ''}`}
              </p>
            );
          })}
        </div>
      );
    }
    return null;
  };

  // Render sensor cards
  const renderSensorCards = () => {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        {Object.entries(sensorStats).map(([sensor, stats]) => {
          const metadata = sensorMetadata[sensor];
          if (!metadata) return null;

          const IconComponent = metadata.icon;
          const isVisible = visibleSensors.has(sensor);
          const statusColor = getSensorStatusColor(sensor);

          return (
            <div 
              key={sensor}
              className={`bg-gray-800 rounded-lg p-4 cursor-pointer transition-all duration-200 hover:bg-gray-700 ${
                isVisible ? 'ring-2 ring-blue-500' : ''
              }`}
              onClick={() => toggleSensor(sensor)}
            >
              <div className="flex items-center justify-between mb-2">
                <IconComponent className={`w-5 h-5 ${statusColor}`} />
                {isVisible ? (
                  <Eye className="w-4 h-4 text-blue-400" />
                ) : (
                  <EyeOff className="w-4 h-4 text-gray-500" />
                )}
              </div>
              
              <div className="text-sm text-gray-400 mb-1">{metadata.name}</div>
              <div className={`text-lg font-bold ${statusColor}`}>
                {stats.current?.toFixed(1) || '--'}{metadata.unit}
              </div>
              
              <div className="flex items-center mt-2 text-xs text-gray-500">
                {stats.trend === 'up' ? (
                  <TrendingUp className="w-3 h-3 text-green-400 mr-1" />
                ) : stats.trend === 'down' ? (
                  <TrendingDown className="w-3 h-3 text-red-400 mr-1" />
                ) : (
                  <div className="w-3 h-3 bg-gray-500 rounded-full mr-1" />
                )}
                Avg: {stats.avg?.toFixed(1) || '--'}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Render alerts panel
  const renderAlerts = () => {
    if (alerts.length === 0) return null;

    return (
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
          <AlertTriangle className="w-5 h-5 text-yellow-400 mr-2" />
          Live Diagnostic Alerts ({alerts.length})
        </h3>
        <div className="space-y-2">
          {alerts.map((alert, index) => (
            <div 
              key={index}
              className={`p-3 rounded-lg border-l-4 ${
                alert.level === 'critical' 
                  ? 'bg-red-900/30 border-red-500 text-red-200'
                  : 'bg-yellow-900/30 border-yellow-500 text-yellow-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{alert.message}</span>
                <span className="text-xs opacity-75">
                  {new Date(alert.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Render main chart
  const renderChart = () => {
    if (processedData.length === 0) {
      return (
        <div className="bg-gray-800 rounded-lg p-8 text-center">
          <Activity className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400">No live data available</p>
          <p className="text-gray-500 text-sm mt-2">
            Start diagnostic session to see real-time sensor data
          </p>
        </div>
      );
    }

    const visibleSensorArray = Array.from(visibleSensors);

    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white flex items-center">
            <Activity className="w-5 h-5 text-blue-400 mr-2" />
            Live Sensor Data
          </h3>
          
          <div className="flex items-center space-x-4">
            <select 
              value={chartType} 
              onChange={(e) => setChartType(e.target.value)}
              className="bg-gray-700 text-white px-3 py-1 rounded"
            >
              <option value="line">Line Chart</option>
              <option value="area">Area Chart</option>
              <option value="scatter">Scatter Plot</option>
            </select>
            
            <select 
              value={timeRange} 
              onChange={(e) => setTimeRange(e.target.value)}
              className="bg-gray-700 text-white px-3 py-1 rounded"
            >
              <option value="30sec">30 seconds</option>
              <option value="1min">1 minute</option>
              <option value="5min">5 minutes</option>
              <option value="10min">10 minutes</option>
            </select>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={400}>
          {chartType === 'line' && (
            <LineChart data={processedData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="timestamp" 
                stroke="#9CA3AF" 
                tick={{ fontSize: 12 }}
              />
              <YAxis stroke="#9CA3AF" tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              
              {visibleSensorArray.map(sensor => {
                const metadata = sensorMetadata[sensor];
                if (!metadata) return null;
                
                return (
                  <Line
                    key={sensor}
                    type="monotone"
                    dataKey={sensor}
                    stroke={metadata.color}
                    strokeWidth={2}
                    dot={false}
                    name={metadata.name}
                  />
                );
              })}
            </LineChart>
          )}

          {chartType === 'area' && (
            <AreaChart data={processedData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="timestamp" 
                stroke="#9CA3AF" 
                tick={{ fontSize: 12 }}
              />
              <YAxis stroke="#9CA3AF" tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              
              {visibleSensorArray.map(sensor => {
                const metadata = sensorMetadata[sensor];
                if (!metadata) return null;
                
                return (
                  <Area
                    key={sensor}
                    type="monotone"
                    dataKey={sensor}
                    stroke={metadata.color}
                    fill={metadata.color}
                    fillOpacity={0.3}
                    name={metadata.name}
                  />
                );
              })}
            </AreaChart>
          )}

          {chartType === 'scatter' && visibleSensorArray.length >= 2 && (
            <ScatterChart data={processedData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey={visibleSensorArray[0]} 
                stroke="#9CA3AF" 
                name={sensorMetadata[visibleSensorArray[0]]?.name}
              />
              <YAxis 
                dataKey={visibleSensorArray[1]} 
                stroke="#9CA3AF" 
                name={sensorMetadata[visibleSensorArray[1]]?.name}
              />
              <Tooltip content={<CustomTooltip />} />
              <Scatter
                name={`${sensorMetadata[visibleSensorArray[0]]?.name} vs ${sensorMetadata[visibleSensorArray[1]]?.name}`}
                data={processedData}
                fill={sensorMetadata[visibleSensorArray[0]]?.color}
              />
            </ScatterChart>
          )}
        </ResponsiveContainer>

        {/* Expected ranges display */}
        {visibleSensorArray.length > 0 && (
          <div className="mt-4 p-4 bg-gray-700 rounded-lg">
            <h4 className="text-sm font-medium text-gray-300 mb-3">Expected Ranges</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleSensorArray.map(sensor => {
                const metadata = sensorMetadata[sensor];
                if (!metadata || metadata.normalRange.length === 0) return null;
                
                return (
                  <div key={sensor} className="text-sm">
                    <div className="text-white font-medium">{metadata.name}</div>
                    <div className="text-green-400">
                      Normal: {metadata.normalRange[0]} - {metadata.normalRange[1]}{metadata.unit}
                    </div>
                    {metadata.warningRange.length > 0 && (
                      <div className="text-yellow-400">
                        Warning: {metadata.warningRange[0]} - {metadata.warningRange[1]}{metadata.unit}
                      </div>
                    )}
                    {metadata.criticalRange.length > 0 && (
                      <div className="text-red-400">
                        Critical: {metadata.criticalRange[0]} - {metadata.criticalRange[1]}{metadata.unit}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white flex items-center">
          <Activity className="w-6 h-6 text-blue-400 mr-2" />
          Live Data Visualization
        </h2>
        
        <div className="flex items-center space-x-4 text-sm text-gray-400">
          <div className="flex items-center">
            <div className="w-2 h-2 bg-green-400 rounded-full mr-2" />
            {processedData.length} data points
          </div>
          <div className="flex items-center">
            <Clock className="w-4 h-4 mr-1" />
            {processedData.length > 0 ? 'Live' : 'Waiting'}
          </div>
        </div>
      </div>

      {/* Alerts Panel */}
      {renderAlerts()}

      {/* Sensor Cards */}
      {renderSensorCards()}

      {/* Main Chart */}
      {renderChart()}

      {/* Current Step Context */}
      {currentStep.title && (
        <div className="bg-blue-900/30 border border-blue-600 rounded-lg p-4">
          <div className="flex items-center mb-2">
            <CheckCircle className="w-5 h-5 text-blue-400 mr-2" />
            <span className="font-medium text-blue-200">Current Diagnostic Step</span>
          </div>
          <div className="text-white font-semibold">{currentStep.title}</div>
          {currentStep.description && (
            <div className="text-blue-200 text-sm mt-1">{currentStep.description}</div>
          )}
        </div>
      )}
    </div>
  );
};

export default LiveDataVisualization;