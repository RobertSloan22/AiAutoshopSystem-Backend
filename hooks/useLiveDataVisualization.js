// Live Data Visualization Hook - Advanced OBD2 Data Management
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

export const useLiveDataVisualization = (config = {}) => {
  const {
    sessionId,
    maxDataPoints = 200,
    updateInterval = 1000,
    enableAlerts = true,
    enableTrends = true,
    autoScale = true,
    alertThresholds = {},
    dataRetentionTime = 5 * 60 * 1000 // 5 minutes
  } = config;

  // Data state
  const [rawData, setRawData] = useState([]);
  const [processedData, setProcessedData] = useState([]);
  const [sensorStats, setSensorStats] = useState({});
  const [alerts, setAlerts] = useState([]);
  const [trends, setTrends] = useState({});
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  
  // Visualization state
  const [visibleSensors, setVisibleSensors] = useState(new Set(['rpm', 'engineLoad', 'coolantTemp']));
  const [chartType, setChartType] = useState('line');
  const [timeRange, setTimeRange] = useState('5min');
  const [yAxisRange, setYAxisRange] = useState({});
  const [dataFilters, setDataFilters] = useState({});
  
  // Performance state
  const [lastUpdate, setLastUpdate] = useState(null);
  const [updateRate, setUpdateRate] = useState(0);
  const [dataQuality, setDataQuality] = useState('good');

  // Refs
  const wsRef = useRef(null);
  const dataBufferRef = useRef([]);
  const statsBufferRef = useRef({});
  const alertsRef = useRef([]);
  const updateCounterRef = useRef(0);
  const lastUpdateTimeRef = useRef(Date.now());

  // Sensor metadata with enhanced properties
  const sensorMetadata = useMemo(() => ({
    rpm: {
      name: 'Engine RPM',
      unit: 'RPM',
      color: '#3B82F6',
      normalRange: [800, 6000],
      warningRange: [6000, 7000],
      criticalRange: [7000, 8000],
      precision: 0,
      smoothing: true,
      category: 'engine'
    },
    engineLoad: {
      name: 'Engine Load',
      unit: '%',
      color: '#10B981',
      normalRange: [0, 85],
      warningRange: [85, 95],
      criticalRange: [95, 100],
      precision: 1,
      smoothing: true,
      category: 'engine'
    },
    coolantTemp: {
      name: 'Coolant Temperature',
      unit: '°C',
      color: '#EF4444',
      normalRange: [85, 105],
      warningRange: [105, 115],
      criticalRange: [115, 130],
      precision: 0,
      smoothing: true,
      category: 'cooling'
    },
    intakeTemp: {
      name: 'Intake Air Temperature',
      unit: '°C',
      color: '#F59E0B',
      normalRange: [20, 60],
      warningRange: [60, 80],
      criticalRange: [80, 100],
      precision: 0,
      smoothing: true,
      category: 'intake'
    },
    fuelTrimShort: {
      name: 'Short Term Fuel Trim',
      unit: '%',
      color: '#8B5CF6',
      normalRange: [-10, 10],
      warningRange: [-25, 25],
      criticalRange: [-40, 40],
      precision: 2,
      smoothing: false,
      category: 'fuel'
    },
    fuelTrimLong: {
      name: 'Long Term Fuel Trim',
      unit: '%',
      color: '#EC4899',
      normalRange: [-10, 10],
      warningRange: [-25, 25],
      criticalRange: [-40, 40],
      precision: 2,
      smoothing: false,
      category: 'fuel'
    },
    maf: {
      name: 'Mass Air Flow',
      unit: 'g/s',
      color: '#06B6D4',
      normalRange: [2, 200],
      warningRange: [200, 300],
      criticalRange: [300, 400],
      precision: 2,
      smoothing: true,
      category: 'intake'
    },
    throttlePosition: {
      name: 'Throttle Position',
      unit: '%',
      color: '#84CC16',
      normalRange: [0, 100],
      warningRange: [],
      criticalRange: [],
      precision: 1,
      smoothing: false,
      category: 'intake'
    },
    o2Sensor1: {
      name: 'O2 Sensor 1',
      unit: 'V',
      color: '#F97316',
      normalRange: [0.1, 0.9],
      warningRange: [0, 0.1],
      criticalRange: [0.9, 1.2],
      precision: 3,
      smoothing: false,
      category: 'exhaust'
    },
    vehicleSpeed: {
      name: 'Vehicle Speed',
      unit: 'km/h',
      color: '#6366F1',
      normalRange: [0, 120],
      warningRange: [120, 160],
      criticalRange: [160, 200],
      precision: 0,
      smoothing: true,
      category: 'vehicle'
    },
    manifoldPressure: {
      name: 'Manifold Pressure',
      unit: 'kPa',
      color: '#D946EF',
      normalRange: [20, 100],
      warningRange: [100, 120],
      criticalRange: [120, 150],
      precision: 1,
      smoothing: true,
      category: 'intake'
    },
    sparkAdvance: {
      name: 'Spark Advance',
      unit: '°',
      color: '#F43F5E',
      normalRange: [10, 35],
      warningRange: [35, 45],
      criticalRange: [45, 60],
      precision: 1,
      smoothing: true,
      category: 'ignition'
    }
  }), []);

  // Initialize WebSocket connection
  useEffect(() => {
    if (sessionId && !wsRef.current) {
      initializeWebSocket();
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [sessionId]);

  // Data processing and cleanup
  useEffect(() => {
    const interval = setInterval(() => {
      processDataBuffer();
      calculateUpdateRate();
      cleanupOldData();
    }, updateInterval);

    return () => clearInterval(interval);
  }, [updateInterval, dataRetentionTime]);

  // Alert monitoring
  useEffect(() => {
    if (enableAlerts && processedData.length > 0) {
      checkAlerts();
    }
  }, [processedData, enableAlerts, alertThresholds]);

  // Trend calculation
  useEffect(() => {
    if (enableTrends && processedData.length > 10) {
      calculateTrends();
    }
  }, [processedData, enableTrends]);

  const initializeWebSocket = useCallback(() => {
    const wsUrl = `ws://localhost:5000/ws/obd2/${sessionId}`;
    
    try {
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        setIsConnected(true);
        setConnectionStatus('connected');
        console.log('Live data WebSocket connected');
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleIncomingData(data);
        } catch (error) {
          console.error('Error parsing WebSocket data:', error);
        }
      };

      wsRef.current.onclose = () => {
        setIsConnected(false);
        setConnectionStatus('disconnected');
        console.log('Live data WebSocket disconnected');
      };

      wsRef.current.onerror = (error) => {
        setConnectionStatus('error');
        console.error('WebSocket error:', error);
      };

    } catch (error) {
      setConnectionStatus('error');
      console.error('Failed to initialize WebSocket:', error);
    }
  }, [sessionId]);

  const handleIncomingData = useCallback((data) => {
    const timestamp = new Date().toISOString();
    const enhancedData = {
      ...data,
      timestamp,
      _id: Date.now() + Math.random()
    };

    // Add to buffer for processing
    dataBufferRef.current.push(enhancedData);
    
    // Keep buffer size manageable
    if (dataBufferRef.current.length > maxDataPoints * 2) {
      dataBufferRef.current = dataBufferRef.current.slice(-maxDataPoints);
    }

    setLastUpdate(timestamp);
    updateCounterRef.current++;
  }, [maxDataPoints]);

  const processDataBuffer = useCallback(() => {
    if (dataBufferRef.current.length === 0) return;

    // Apply smoothing and filtering
    const smoothedData = applyDataSmoothing(dataBufferRef.current);
    
    // Update processed data
    setProcessedData(prev => {
      const combined = [...prev, ...smoothedData];
      return combined.slice(-maxDataPoints);
    });

    // Update raw data
    setRawData(prev => {
      const combined = [...prev, ...dataBufferRef.current];
      dataBufferRef.current = []; // Clear buffer
      return combined.slice(-maxDataPoints);
    });

    // Calculate statistics
    calculateSensorStatistics();
  }, [maxDataPoints]);

  const applyDataSmoothing = useCallback((data) => {
    if (data.length === 0) return [];

    return data.map(point => {
      const smoothedPoint = { ...point };
      
      Object.keys(sensorMetadata).forEach(sensor => {
        const metadata = sensorMetadata[sensor];
        if (point[sensor] !== undefined && metadata.smoothing) {
          // Simple exponential smoothing
          const alpha = 0.3;
          const prevValue = statsBufferRef.current[sensor]?.lastSmoothed || point[sensor];
          smoothedPoint[sensor] = alpha * point[sensor] + (1 - alpha) * prevValue;
          
          if (!statsBufferRef.current[sensor]) {
            statsBufferRef.current[sensor] = {};
          }
          statsBufferRef.current[sensor].lastSmoothed = smoothedPoint[sensor];
        }
      });
      
      return smoothedPoint;
    });
  }, [sensorMetadata]);

  const calculateSensorStatistics = useCallback(() => {
    if (processedData.length === 0) return;

    const stats = {};
    
    Object.keys(sensorMetadata).forEach(sensor => {
      const values = processedData
        .map(point => point[sensor])
        .filter(val => val !== undefined && val !== null && !isNaN(val));
      
      if (values.length > 0) {
        const sorted = [...values].sort((a, b) => a - b);
        stats[sensor] = {
          current: values[values.length - 1],
          min: sorted[0],
          max: sorted[sorted.length - 1],
          avg: values.reduce((sum, val) => sum + val, 0) / values.length,
          median: sorted[Math.floor(sorted.length / 2)],
          count: values.length,
          trend: calculateSensorTrend(values),
          quality: calculateDataQuality(values),
          variance: calculateVariance(values),
          changeRate: values.length > 1 ? values[values.length - 1] - values[values.length - 2] : 0
        };
      }
    });

    setSensorStats(stats);
  }, [processedData, sensorMetadata]);

  const calculateSensorTrend = useCallback((values) => {
    if (values.length < 5) return 'insufficient_data';
    
    const recent = values.slice(-5);
    const older = values.slice(-10, -5);
    
    if (older.length === 0) return 'insufficient_data';
    
    const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
    const olderAvg = older.reduce((sum, val) => sum + val, 0) / older.length;
    
    const change = ((recentAvg - olderAvg) / olderAvg) * 100;
    
    if (Math.abs(change) < 2) return 'stable';
    return change > 0 ? 'increasing' : 'decreasing';
  }, []);

  const calculateDataQuality = useCallback((values) => {
    if (values.length < 3) return 'insufficient';
    
    const variance = calculateVariance(values);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const cv = Math.sqrt(variance) / mean; // Coefficient of variation
    
    if (cv < 0.1) return 'excellent';
    if (cv < 0.2) return 'good';
    if (cv < 0.4) return 'fair';
    return 'poor';
  }, []);

  const calculateVariance = useCallback((values) => {
    if (values.length < 2) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  }, []);

  const checkAlerts = useCallback(() => {
    const currentAlerts = [];
    
    Object.entries(sensorStats).forEach(([sensor, stats]) => {
      const metadata = sensorMetadata[sensor];
      const customThresholds = alertThresholds[sensor];
      
      if (!metadata || !stats.current) return;
      
      const value = stats.current;
      let alertLevel = null;
      let message = null;
      
      // Check custom thresholds first
      if (customThresholds) {
        if (customThresholds.critical && (value >= customThresholds.critical.max || value <= customThresholds.critical.min)) {
          alertLevel = 'critical';
          message = customThresholds.critical.message || `${metadata.name} critical: ${value}${metadata.unit}`;
        } else if (customThresholds.warning && (value >= customThresholds.warning.max || value <= customThresholds.warning.min)) {
          alertLevel = 'warning';
          message = customThresholds.warning.message || `${metadata.name} warning: ${value}${metadata.unit}`;
        }
      } else {
        // Use default thresholds
        if (metadata.criticalRange.length > 0) {
          const [min, max] = metadata.criticalRange;
          if (value < min || value > max) {
            alertLevel = 'critical';
            message = `${metadata.name} critical: ${value.toFixed(metadata.precision)}${metadata.unit}`;
          }
        }
        
        if (!alertLevel && metadata.warningRange.length > 0) {
          const [min, max] = metadata.warningRange;
          if (value < min || value > max) {
            alertLevel = 'warning';
            message = `${metadata.name} warning: ${value.toFixed(metadata.precision)}${metadata.unit}`;
          }
        }
      }
      
      if (alertLevel) {
        currentAlerts.push({
          sensor,
          level: alertLevel,
          message,
          value,
          timestamp: new Date().toISOString(),
          id: Date.now() + Math.random(),
          metadata
        });
      }
    });
    
    // Update alerts, keeping only recent ones
    setAlerts(prev => {
      const combined = [...prev, ...currentAlerts];
      alertsRef.current = combined.slice(-20); // Keep last 20 alerts
      return alertsRef.current;
    });
  }, [sensorStats, sensorMetadata, alertThresholds]);

  const calculateTrends = useCallback(() => {
    const trendData = {};
    
    Object.keys(sensorMetadata).forEach(sensor => {
      const values = processedData
        .map(point => point[sensor])
        .filter(val => val !== undefined && val !== null && !isNaN(val));
      
      if (values.length > 10) {
        const trend = calculateSensorTrend(values);
        const momentum = calculateMomentum(values);
        const volatility = calculateVolatility(values);
        
        trendData[sensor] = {
          direction: trend,
          momentum,
          volatility,
          strength: Math.abs(momentum),
          confidence: values.length / maxDataPoints
        };
      }
    });
    
    setTrends(trendData);
  }, [processedData, sensorMetadata, maxDataPoints]);

  const calculateMomentum = useCallback((values) => {
    if (values.length < 5) return 0;
    
    const periods = [5, 10];
    let weightedMomentum = 0;
    let totalWeight = 0;
    
    periods.forEach(period => {
      if (values.length >= period) {
        const recent = values.slice(-period);
        const older = values.slice(-period * 2, -period);
        
        if (older.length > 0) {
          const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
          const olderAvg = older.reduce((sum, val) => sum + val, 0) / older.length;
          const momentum = ((recentAvg - olderAvg) / olderAvg) * 100;
          
          const weight = period; // Longer periods have more weight
          weightedMomentum += momentum * weight;
          totalWeight += weight;
        }
      }
    });
    
    return totalWeight > 0 ? weightedMomentum / totalWeight : 0;
  }, []);

  const calculateVolatility = useCallback((values) => {
    if (values.length < 10) return 0;
    
    const returns = [];
    for (let i = 1; i < values.length; i++) {
      if (values[i - 1] !== 0) {
        returns.push((values[i] - values[i - 1]) / values[i - 1]);
      }
    }
    
    if (returns.length === 0) return 0;
    
    const variance = calculateVariance(returns);
    return Math.sqrt(variance) * 100; // Convert to percentage
  }, []);

  const calculateUpdateRate = useCallback(() => {
    const now = Date.now();
    const timeDiff = now - lastUpdateTimeRef.current;
    
    if (timeDiff >= 5000) { // Calculate every 5 seconds
      const rate = (updateCounterRef.current / timeDiff) * 1000; // Updates per second
      setUpdateRate(Math.round(rate * 10) / 10); // Round to 1 decimal
      
      // Reset counters
      updateCounterRef.current = 0;
      lastUpdateTimeRef.current = now;
    }
  }, []);

  const cleanupOldData = useCallback(() => {
    const cutoff = Date.now() - dataRetentionTime;
    
    setProcessedData(prev => prev.filter(point => 
      new Date(point.timestamp).getTime() > cutoff
    ));
    
    setRawData(prev => prev.filter(point => 
      new Date(point.timestamp).getTime() > cutoff
    ));
    
    setAlerts(prev => prev.filter(alert => 
      new Date(alert.timestamp).getTime() > cutoff - (60 * 1000) // Keep alerts for 1 extra minute
    ));
  }, [dataRetentionTime]);

  // Public methods
  const toggleSensor = useCallback((sensor) => {
    setVisibleSensors(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sensor)) {
        newSet.delete(sensor);
      } else {
        newSet.add(sensor);
      }
      return newSet;
    });
  }, []);

  const setSensorFilter = useCallback((sensor, filter) => {
    setDataFilters(prev => ({
      ...prev,
      [sensor]: filter
    }));
  }, []);

  const getFilteredData = useCallback((sensor) => {
    if (!dataFilters[sensor]) return processedData;
    
    const filter = dataFilters[sensor];
    return processedData.filter(point => {
      const value = point[sensor];
      if (value === undefined) return true;
      
      if (filter.min !== undefined && value < filter.min) return false;
      if (filter.max !== undefined && value > filter.max) return false;
      
      return true;
    });
  }, [processedData, dataFilters]);

  const exportData = useCallback((format = 'json') => {
    const exportObject = {
      metadata: {
        sessionId,
        exportTime: new Date().toISOString(),
        dataPoints: processedData.length,
        timeRange,
        sensors: Array.from(visibleSensors)
      },
      sensorMetadata,
      data: processedData,
      statistics: sensorStats,
      alerts: alerts.slice(-10),
      trends
    };

    if (format === 'csv') {
      return convertToCSV(exportObject);
    }

    return JSON.stringify(exportObject, null, 2);
  }, [sessionId, processedData, timeRange, visibleSensors, sensorMetadata, sensorStats, alerts, trends]);

  const convertToCSV = useCallback((data) => {
    if (data.data.length === 0) return '';
    
    const headers = ['timestamp', ...Object.keys(sensorMetadata)];
    const rows = [headers.join(',')];
    
    data.data.forEach(point => {
      const row = [point.timestamp];
      Object.keys(sensorMetadata).forEach(sensor => {
        row.push(point[sensor] || '');
      });
      rows.push(row.join(','));
    });
    
    return rows.join('\n');
  }, [sensorMetadata]);

  return {
    // Data
    rawData,
    processedData,
    sensorStats,
    alerts,
    trends,
    sensorMetadata,
    
    // Connection state
    isConnected,
    connectionStatus,
    lastUpdate,
    updateRate,
    dataQuality,
    
    // Visualization state
    visibleSensors,
    chartType,
    setChartType,
    timeRange,
    setTimeRange,
    yAxisRange,
    setYAxisRange,
    
    // Actions
    toggleSensor,
    setSensorFilter,
    getFilteredData,
    exportData,
    
    // Connection management
    initializeWebSocket,
    
    // Utilities
    clearAlerts: () => setAlerts([]),
    resetStats: () => setSensorStats({}),
    reconnect: () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      initializeWebSocket();
    }
  };
};

export default useLiveDataVisualization;