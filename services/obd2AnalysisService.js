import mongoose from 'mongoose';

const { ObjectId } = mongoose.Types;

class OBD2AnalysisService {
  constructor() {
    this.analysisTools = this.initializeAnalysisTools();
    // Models will be retrieved when needed to avoid circular dependency
    this.DiagnosticSession = null;
    this.OBD2DataPoint = null;
    
    // Initialize PID metadata for professional analysis
    this.pidMetadata = this.initializePIDMetadata();
  }

  getModels() {
    if (!this.DiagnosticSession || !this.OBD2DataPoint) {
      // Get models from mongoose connection
      this.DiagnosticSession = mongoose.models.DiagnosticSession;
      this.OBD2DataPoint = mongoose.models.OBD2DataPoint;
    }
    return { DiagnosticSession: this.DiagnosticSession, OBD2DataPoint: this.OBD2DataPoint };
  }

  /**
   * Initialize comprehensive PID metadata based on OBD2 standards
   * This provides professional diagnostic thresholds and analysis rules
   */
  initializePIDMetadata() {
    return {
      // Engine Core Parameters
      rpm: {
        category: 'engine',
        unit: 'RPM',
        normalRange: { min: 0, max: 8000 },
        idleRange: { min: 600, max: 900 },
        criticalThresholds: { min: 0, max: 7000 },
        analysisType: 'continuous',
        diagnosticSignificance: 'high',
        relatedPIDs: ['throttlePosition', 'engineLoad', 'speed']
      },
      speed: {
        category: 'vehicle',
        unit: 'km/h',
        normalRange: { min: 0, max: 200 },
        criticalThresholds: { min: 0, max: 250 },
        analysisType: 'continuous',
        diagnosticSignificance: 'medium',
        relatedPIDs: ['rpm', 'throttlePosition', 'fuelRate']
      },
      engineTemp: {
        category: 'cooling',
        unit: '°F',
        normalRange: { min: 160, max: 220 },
        operatingRange: { min: 180, max: 210 },
        criticalThresholds: { min: 140, max: 240 },
        analysisType: 'temperature',
        diagnosticSignificance: 'critical',
        relatedPIDs: ['intakeTemp', 'ambientTemp', 'coolantTemp']
      },
      intakeTemp: {
        category: 'intake',
        unit: '°F',
        normalRange: { min: 32, max: 150 },
        criticalThresholds: { min: -40, max: 200 },
        analysisType: 'temperature',
        diagnosticSignificance: 'high',
        relatedPIDs: ['maf', 'map', 'engineTemp']
      },
      ambientTemp: {
        category: 'environment',
        unit: '°F',
        normalRange: { min: -40, max: 120 },
        analysisType: 'reference',
        diagnosticSignificance: 'low',
        relatedPIDs: ['intakeTemp', 'engineTemp']
      },
      
      // Throttle and Load
      throttlePosition: {
        category: 'throttle',
        unit: '%',
        normalRange: { min: 0, max: 100 },
        idleRange: { min: 0, max: 5 },
        criticalThresholds: { min: 0, max: 100 },
        analysisType: 'percentage',
        diagnosticSignificance: 'high',
        relatedPIDs: ['rpm', 'engineLoad', 'maf', 'speed']
      },
      engineLoad: {
        category: 'engine',
        unit: '%',
        normalRange: { min: 0, max: 100 },
        idleRange: { min: 10, max: 30 },
        criticalThresholds: { min: 0, max: 100 },
        analysisType: 'percentage',
        diagnosticSignificance: 'high',
        relatedPIDs: ['rpm', 'throttlePosition', 'maf', 'map']
      },
      absoluteLoad: {
        category: 'engine',
        unit: '%',
        normalRange: { min: 0, max: 100 },
        analysisType: 'percentage',
        diagnosticSignificance: 'medium',
        relatedPIDs: ['engineLoad', 'maf', 'rpm']
      },
      relativeThrottlePosition: {
        category: 'throttle',
        unit: '%',
        normalRange: { min: 0, max: 100 },
        analysisType: 'percentage',
        diagnosticSignificance: 'medium',
        relatedPIDs: ['throttlePosition', 'engineLoad']
      },
      
      // Fuel System
      fuelLevel: {
        category: 'fuel',
        unit: '%',
        normalRange: { min: 0, max: 100 },
        analysisType: 'percentage',
        diagnosticSignificance: 'low',
        relatedPIDs: ['fuelRate', 'fuelPressure']
      },
      fuelRate: {
        category: 'fuel',
        unit: 'L/h',
        normalRange: { min: 0, max: 50 },
        analysisType: 'continuous',
        diagnosticSignificance: 'high',
        relatedPIDs: ['speed', 'rpm', 'engineLoad', 'maf']
      },
      fuelPressure: {
        category: 'fuel',
        unit: 'kPa',
        normalRange: { min: 200, max: 600 },
        criticalThresholds: { min: 150, max: 700 },
        analysisType: 'pressure',
        diagnosticSignificance: 'critical',
        relatedPIDs: ['fuelTrimLongB1', 'fuelTrimShortB1', 'fuelRate']
      },
      fuelRailPressure: {
        category: 'fuel',
        unit: 'kPa',
        normalRange: { min: 200, max: 2000 },
        analysisType: 'pressure',
        diagnosticSignificance: 'high',
        relatedPIDs: ['fuelPressure', 'fuelTrimLongB1']
      },
      fuelTrimShortB1: {
        category: 'fuel',
        unit: '%',
        normalRange: { min: -10, max: 10 },
        warningRange: { min: -20, max: 20 },
        criticalThresholds: { min: -25, max: 25 },
        analysisType: 'trim',
        diagnosticSignificance: 'critical',
        relatedPIDs: ['fuelTrimLongB1', 'o2B1S1Voltage', 'maf', 'map']
      },
      fuelTrimLongB1: {
        category: 'fuel',
        unit: '%',
        normalRange: { min: -10, max: 10 },
        warningRange: { min: -20, max: 20 },
        criticalThresholds: { min: -25, max: 25 },
        analysisType: 'trim',
        diagnosticSignificance: 'critical',
        relatedPIDs: ['fuelTrimShortB1', 'o2B1S1Voltage', 'maf']
      },
      fuelTrimShortB2: {
        category: 'fuel',
        unit: '%',
        normalRange: { min: -10, max: 10 },
        warningRange: { min: -20, max: 20 },
        criticalThresholds: { min: -25, max: 25 },
        analysisType: 'trim',
        diagnosticSignificance: 'critical',
        relatedPIDs: ['fuelTrimLongB2', 'o2B2S1Voltage', 'maf']
      },
      fuelTrimLongB2: {
        category: 'fuel',
        unit: '%',
        normalRange: { min: -10, max: 10 },
        warningRange: { min: -20, max: 20 },
        criticalThresholds: { min: -25, max: 25 },
        analysisType: 'trim',
        diagnosticSignificance: 'critical',
        relatedPIDs: ['fuelTrimShortB2', 'o2B2S1Voltage', 'maf']
      },
      
      // Air Flow and Pressure
      maf: {
        category: 'intake',
        unit: 'g/s',
        normalRange: { min: 0, max: 500 },
        idleRange: { min: 2, max: 8 },
        criticalThresholds: { min: 0, max: 1000 },
        analysisType: 'flow',
        diagnosticSignificance: 'critical',
        relatedPIDs: ['rpm', 'throttlePosition', 'map', 'fuelTrimLongB1']
      },
      map: {
        category: 'intake',
        unit: 'kPa',
        normalRange: { min: 20, max: 110 },
        idleRange: { min: 25, max: 50 },
        criticalThresholds: { min: 10, max: 150 },
        analysisType: 'pressure',
        diagnosticSignificance: 'high',
        relatedPIDs: ['maf', 'rpm', 'throttlePosition', 'engineLoad']
      },
      barometricPressure: {
        category: 'environment',
        unit: 'kPa',
        normalRange: { min: 80, max: 110 },
        analysisType: 'reference',
        diagnosticSignificance: 'medium',
        relatedPIDs: ['map', 'maf']
      },
      vaporPressure: {
        category: 'emissions',
        unit: 'Pa',
        normalRange: { min: -5000, max: 5000 },
        criticalThresholds: { min: -10000, max: 10000 },
        analysisType: 'pressure',
        diagnosticSignificance: 'medium',
        relatedPIDs: ['fuelTrimLongB1', 'fuelTrimLongB2']
      },
      
      // Electrical
      batteryVoltage: {
        category: 'electrical',
        unit: 'V',
        normalRange: { min: 12.0, max: 14.5 },
        criticalThresholds: { min: 11.0, max: 15.5 },
        analysisType: 'voltage',
        diagnosticSignificance: 'high',
        relatedPIDs: []
      },
      
      // Oxygen Sensors
      o2B1S1Voltage: {
        category: 'emissions',
        unit: 'V',
        normalRange: { min: 0.1, max: 0.9 },
        analysisType: 'voltage_switching',
        diagnosticSignificance: 'critical',
        relatedPIDs: ['fuelTrimShortB1', 'fuelTrimLongB1', 'maf']
      },
      o2B1S2Voltage: {
        category: 'emissions',
        unit: 'V',
        normalRange: { min: 0.1, max: 0.9 },
        analysisType: 'voltage_switching',
        diagnosticSignificance: 'high',
        relatedPIDs: ['catalystTempB1S1', 'o2B1S1Voltage']
      },
      o2B2S1Voltage: {
        category: 'emissions',
        unit: 'V',
        normalRange: { min: 0.1, max: 0.9 },
        analysisType: 'voltage_switching',
        diagnosticSignificance: 'critical',
        relatedPIDs: ['fuelTrimShortB2', 'fuelTrimLongB2', 'maf']
      },
      o2B2S2Voltage: {
        category: 'emissions',
        unit: 'V',
        normalRange: { min: 0.1, max: 0.9 },
        analysisType: 'voltage_switching',
        diagnosticSignificance: 'high',
        relatedPIDs: ['catalystTempB2S1', 'o2B2S1Voltage']
      },
      
      // Timing
      timingAdvance: {
        category: 'ignition',
        unit: '°',
        normalRange: { min: -20, max: 60 },
        analysisType: 'angle',
        diagnosticSignificance: 'medium',
        relatedPIDs: ['rpm', 'engineLoad', 'engineTemp']
      },
      
      // EGR
      egrError: {
        category: 'emissions',
        unit: '%',
        normalRange: { min: -10, max: 10 },
        criticalThresholds: { min: -25, max: 25 },
        analysisType: 'error',
        diagnosticSignificance: 'medium',
        relatedPIDs: ['map', 'egrError']
      },
      commandedEGR: {
        category: 'emissions',
        unit: '%',
        normalRange: { min: 0, max: 100 },
        analysisType: 'percentage',
        diagnosticSignificance: 'medium',
        relatedPIDs: ['egrError', 'map', 'rpm']
      },
      
      // Catalyst Temperatures
      catalystTempB1S1: {
        category: 'emissions',
        unit: '°F',
        normalRange: { min: 300, max: 1600 },
        criticalThresholds: { min: 200, max: 1800 },
        analysisType: 'temperature',
        diagnosticSignificance: 'high',
        relatedPIDs: ['o2B1S1Voltage', 'o2B1S2Voltage', 'engineTemp']
      },
      catalystTempB1S2: {
        category: 'emissions',
        unit: '°F',
        normalRange: { min: 300, max: 1600 },
        criticalThresholds: { min: 200, max: 1800 },
        analysisType: 'temperature',
        diagnosticSignificance: 'high',
        relatedPIDs: ['catalystTempB1S1', 'o2B1S2Voltage']
      },
      catalystTempB2S1: {
        category: 'emissions',
        unit: '°F',
        normalRange: { min: 300, max: 1600 },
        criticalThresholds: { min: 200, max: 1800 },
        analysisType: 'temperature',
        diagnosticSignificance: 'high',
        relatedPIDs: ['o2B2S1Voltage', 'o2B2S2Voltage', 'engineTemp']
      },
      catalystTempB2S2: {
        category: 'emissions',
        unit: '°F',
        normalRange: { min: 300, max: 1600 },
        criticalThresholds: { min: 200, max: 1800 },
        analysisType: 'temperature',
        diagnosticSignificance: 'high',
        relatedPIDs: ['catalystTempB2S1', 'o2B2S2Voltage']
      },
      
      // Variable Valve Timing
      vvtB1: {
        category: 'engine',
        unit: '°',
        normalRange: { min: -50, max: 50 },
        analysisType: 'angle',
        diagnosticSignificance: 'medium',
        relatedPIDs: ['rpm', 'engineLoad', 'throttlePosition']
      },
      vvtB2: {
        category: 'engine',
        unit: '°',
        normalRange: { min: -50, max: 50 },
        analysisType: 'angle',
        diagnosticSignificance: 'medium',
        relatedPIDs: ['rpm', 'engineLoad', 'throttlePosition']
      }
    };
  }

  /**
   * Dynamically discover all available PIDs in the data
   * Returns a map of PID names to their availability and data quality
   */
  discoverAvailablePIDs(dataPoints) {
    try {
      if (!dataPoints || dataPoints.length === 0) {
        return {};
      }

      const pidInfo = {};
      const samplePoint = dataPoints[0];
      
      if (!samplePoint) {
        return {};
      }
      
      // Get all possible PID fields from the schema
      const allPossiblePIDs = Object.keys(this.pidMetadata || {});
      
      // Also check for any other numeric fields that might be PIDs
      let allFields = [];
      try {
        allFields = Object.keys(samplePoint.toObject ? samplePoint.toObject() : samplePoint);
      } catch (e) {
        console.warn('Error extracting fields from sample point:', e.message);
        allFields = Object.keys(samplePoint);
      }
      
      // Combine known PIDs with discovered fields
      const fieldsToCheck = new Set([...allPossiblePIDs, ...allFields]);
      
      fieldsToCheck.forEach(field => {
        try {
          // Skip non-PID fields
          if (['_id', 'sessionId', 'timestamp', '__v', 'createdAt', 'updatedAt', 'rawData', 'dataQuality', 'isInterpolated'].includes(field)) {
            return;
          }

          const values = dataPoints
            .map(dp => {
              try {
                const val = dp[field];
                return (typeof val === 'number' && !isNaN(val) && isFinite(val)) ? val : null;
              } catch (e) {
                return null;
              }
            })
            .filter(v => v !== null);

          if (values.length > 0) {
            const dataQuality = (values.length / dataPoints.length) * 100;
            const avg = values.reduce((a, b) => a + b, 0) / values.length;
            const min = Math.min(...values);
            const max = Math.max(...values);
            const variance = this.calculateVariance(values);
            const stdDev = Math.sqrt(variance);

            pidInfo[field] = {
              available: true,
              dataQuality: dataQuality,
              sampleCount: values.length,
              totalSamples: dataPoints.length,
              statistics: {
                average: avg,
                minimum: min,
                maximum: max,
                range: max - min,
                variance: variance,
                standardDeviation: stdDev,
                median: this.calculateMedian(values)
              },
              metadata: this.pidMetadata[field] || {
                category: 'unknown',
                unit: 'unknown',
                analysisType: 'continuous',
                diagnosticSignificance: 'low'
              }
            };
          }
        } catch (e) {
          console.warn(`Error processing PID field ${field}:`, e.message);
        }
      });

      return pidInfo;
    } catch (error) {
      console.error('Error in discoverAvailablePIDs:', error);
      return {};
    }
  }

  initializeAnalysisTools() {
    return [
      {
        name: 'analyze_obd2_session',
        description: 'Analyze OBD2 session data with comprehensive statistics and anomaly detection',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: {
              type: 'string',
              description: 'The OBD2 diagnostic session ID to analyze'
            },
            analysisType: {
              type: 'string',
              enum: ['summary', 'detailed', 'anomalies', 'performance', 'fuel_economy', 'emissions'],
              description: 'Type of analysis to perform',
              default: 'summary'
            },
            timeRange: {
              type: 'object',
              properties: {
                start: { type: 'string', description: 'Start time (ISO format)' },
                end: { type: 'string', description: 'End time (ISO format)' }
              }
            }
          },
          required: ['sessionId']
        }
      },
      {
        name: 'compare_obd2_sessions',
        description: 'Compare multiple OBD2 sessions to identify trends and changes',
        inputSchema: {
          type: 'object',
          properties: {
            sessionIds: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of session IDs to compare'
            },
            metrics: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['fuel_economy', 'performance', 'emissions', 'temperature', 'all']
              },
              default: ['all']
            }
          },
          required: ['sessionIds']
        }
      },
      {
        name: 'get_obd2_diagnostic_recommendations',
        description: 'Get intelligent diagnostic recommendations based on OBD2 data patterns',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: {
              type: 'string',
              description: 'Session ID for analysis'
            },
            dtcCodes: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional DTC codes to consider'
            },
            symptoms: {
              type: 'array',
              items: { type: 'string' },
              description: 'Vehicle symptoms (e.g., "rough idle", "poor acceleration")'
            }
          },
          required: ['sessionId']
        }
      },
      {
        name: 'calculate_fuel_economy_metrics',
        description: 'Calculate detailed fuel economy metrics from OBD2 data',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: {
              type: 'string',
              description: 'Session ID for fuel economy calculation'
            },
            unit: {
              type: 'string',
              enum: ['mpg', 'l/100km', 'km/l'],
              default: 'mpg'
            }
          },
          required: ['sessionId']
        }
      },
      {
        name: 'detect_obd2_anomalies',
        description: 'Detect anomalies and potential issues in OBD2 sensor data',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: {
              type: 'string',
              description: 'Session ID for anomaly detection'
            },
            sensitivity: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
              default: 'medium',
              description: 'Anomaly detection sensitivity'
            },
            parameters: {
              type: 'array',
              items: { type: 'string' },
              description: 'Specific parameters to check (default: all)'
            }
          },
          required: ['sessionId']
        }
      },
      {
        name: 'generate_obd2_health_report',
        description: 'Generate a comprehensive vehicle health report based on OBD2 data',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: {
              type: 'string',
              description: 'Session ID for health report'
            },
            includeHistory: {
              type: 'boolean',
              default: true,
              description: 'Include historical data comparison'
            },
            reportFormat: {
              type: 'string',
              enum: ['summary', 'detailed', 'technician'],
              default: 'summary'
            }
          },
          required: ['sessionId']
        }
      }
    ];
  }

  getToolDefinitions() {
    return this.analysisTools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema
      }
    }));
  }

  async executeTool(toolName, parameters) {
    const tool = this.analysisTools.find(t => t.name === toolName);
    if (!tool) {
      throw new Error(`Unknown OBD2 analysis tool: ${toolName}`);
    }

    switch (toolName) {
      case 'analyze_obd2_session':
        return await this.analyzeSession(parameters);
      case 'compare_obd2_sessions':
        return await this.compareSessions(parameters);
      case 'get_obd2_diagnostic_recommendations':
        return await this.getDiagnosticRecommendations(parameters);
      case 'calculate_fuel_economy_metrics':
        return await this.calculateFuelEconomy(parameters);
      case 'detect_obd2_anomalies':
        return await this.detectAnomalies(parameters);
      case 'generate_obd2_health_report':
        return await this.generateHealthReport(parameters);
      default:
        throw new Error(`Unimplemented tool: ${toolName}`);
    }
  }

  async analyzeSession(params) {
    try {
      const { sessionId, analysisType = 'summary', timeRange } = params;
      
      console.log('\n🔍 === OBD2 ANALYSIS START ===');
      console.log('📋 Analysis Parameters:');
      console.log('  SessionId:', sessionId);
      console.log('  Analysis Type:', analysisType);
      console.log('  Time Range:', timeRange ? JSON.stringify(timeRange) : 'Full session');
      
      const { DiagnosticSession, OBD2DataPoint } = this.getModels();

      if (!DiagnosticSession || !OBD2DataPoint) {
        throw new Error('Database models not available. Ensure the database is connected.');
      }

      // Get session data
      console.log('📊 Fetching session from database...');
      const session = await DiagnosticSession.findById(sessionId);
      if (!session) {
        console.log('❌ Session not found:', sessionId);
        throw new Error(`Session not found: ${sessionId}`);
      }
      
      console.log('✅ Session found:');
      console.log('  VehicleId:', session.vehicleId);
      console.log('  Start Time:', session.startTime);
      console.log('  End Time:', session.endTime);
      console.log('  Duration:', session.duration, 'seconds');
      console.log('  Status:', session.status);
      console.log('  DataPoint Count (metadata):', session.dataPointCount);

      // Build query for data points
      let query = { sessionId: new mongoose.Types.ObjectId(sessionId) };
      if (timeRange?.start || timeRange?.end) {
        query.timestamp = {};
        if (timeRange.start) query.timestamp.$gte = new Date(timeRange.start);
        if (timeRange.end) query.timestamp.$lte = new Date(timeRange.end);
      }

      console.log('📊 Fetching data points with query:', JSON.stringify(query));
      const dataPoints = await OBD2DataPoint.find(query).sort({ timestamp: 1 });
      
      console.log(`✅ Retrieved ${dataPoints.length} data points from database`);
      
      if (dataPoints.length === 0) {
        console.log('⚠️ No data points found for this session');
        return {
          success: false,
          message: 'No data points found for this session',
          sessionInfo: session
        };
      }
      
      // Log data sample
      console.log('\n📊 Data Sample (First 3 points):');
      dataPoints.slice(0, 3).forEach((dp, i) => {
        console.log(`  Point ${i + 1}:`, {
          timestamp: dp.timestamp,
          rpm: dp.rpm,
          speed: dp.speed,
          engineTemp: dp.engineTemp,
          throttlePosition: dp.throttlePosition,
          engineLoad: dp.engineLoad,
          fuelRate: dp.fuelRate,
          maf: dp.maf
        });
      });
      
      // Log available parameters
      const availableParams = new Set();
      dataPoints.forEach(dp => {
        Object.keys(dp.toObject()).forEach(key => {
          if (dp[key] !== null && dp[key] !== undefined && 
              !['_id', 'sessionId', 'timestamp', '__v'].includes(key)) {
            availableParams.add(key);
          }
        });
      });
      console.log('📊 Available Parameters:', Array.from(availableParams).join(', '));
      
      // Log data quality metrics
      const nullCounts = {};
      Array.from(availableParams).forEach(param => {
        nullCounts[param] = dataPoints.filter(dp => 
          dp[param] === null || dp[param] === undefined
        ).length;
      });
      console.log('📊 Data Quality (null counts):');
      Object.entries(nullCounts).forEach(([param, count]) => {
        const percentage = ((count / dataPoints.length) * 100).toFixed(1);
        if (count > 0) {
          console.log(`  ${param}: ${count}/${dataPoints.length} (${percentage}% null)`);
        }
      });

      // Perform analysis based on type
      console.log(`\n🔬 Performing ${analysisType} analysis...`);
      
      let analysis = {
        sessionInfo: {
          id: session._id,
          vehicleId: session.vehicleId,
          startTime: session.startTime,
          endTime: session.endTime,
          duration: session.duration,
          dataPoints: dataPoints.length,
          status: session.status
        }
      };

      switch (analysisType) {
        case 'summary':
          console.log('  → Generating summary statistics...');
          analysis.summary = this.generateSummaryStats(dataPoints);
          console.log('  ✅ Summary stats generated');
          break;
        case 'detailed':
          console.log('  → Generating detailed analysis...');
          analysis.detailed = this.generateDetailedAnalysis(dataPoints);
          console.log('  ✅ Detailed analysis generated');
          break;
        case 'anomalies':
          console.log('  → Detecting anomalies...');
          analysis.anomalies = this.detectDataAnomalies(dataPoints);
          console.log('  ✅ Anomaly detection complete');
          break;
        case 'performance':
          console.log('  → Analyzing performance metrics...');
          analysis.performance = this.analyzePerformanceMetrics(dataPoints);
          console.log('  ✅ Performance analysis complete');
          break;
        case 'fuel_economy':
          console.log('  → Analyzing fuel economy...');
          analysis.fuelEconomy = this.analyzeFuelEconomy(dataPoints);
          console.log('  ✅ Fuel economy analysis complete');
          break;
        case 'emissions':
          console.log('  → Analyzing emissions...');
          analysis.emissions = this.analyzeEmissions(dataPoints);
          console.log('  ✅ Emissions analysis complete');
          break;
        case 'comprehensive':
          console.log('  → Generating comprehensive analysis (all types)...');
          analysis.summary = this.generateSummaryStats(dataPoints);
          console.log('    ✅ Summary stats done');
          analysis.detailed = this.generateDetailedAnalysis(dataPoints);
          console.log('    ✅ Detailed analysis done');
          analysis.anomalies = this.detectDataAnomalies(dataPoints);
          console.log('    ✅ Anomaly detection done');
          analysis.performance = this.analyzePerformanceMetrics(dataPoints);
          console.log('    ✅ Performance analysis done');
          analysis.fuelEconomy = this.analyzeFuelEconomy(dataPoints);
          console.log('    ✅ Fuel economy analysis done');
          analysis.emissions = this.analyzeEmissions(dataPoints);
          console.log('    ✅ Emissions analysis done');
          break;
      }

      console.log('\n📊 Analysis Results Summary:');
      if (analysis.summary) {
        console.log('  Summary Stats:');
        console.log('    Averages:', Object.keys(analysis.summary.averages || {}).length, 'parameters');
        console.log('    Drive Time:', analysis.summary.driveStatistics?.totalTime, 'seconds');
      }
      if (analysis.anomalies) {
        const anomalyCount = (analysis.anomalies.critical?.length || 0) + 
                           (analysis.anomalies.warnings?.length || 0);
        console.log('  Anomalies Found:', anomalyCount);
      }
      if (analysis.performance) {
        console.log('  Performance Metrics:', Object.keys(analysis.performance || {}).length, 'categories');
      }
      
      const recommendations = this.generateRecommendations(analysis, analysisType);
      console.log('  Recommendations:', recommendations?.length || 0);
      console.log('\n✅ === OBD2 ANALYSIS COMPLETE ===\n');

      return {
        success: true,
        analysis,
        recommendations
      };

    } catch (error) {
      console.error('Session analysis error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  generateSummaryStats(dataPoints) {
    console.log('    📊 generateSummaryStats: Processing', dataPoints.length, 'data points');
    
    // Dynamically discover all available PIDs
    const availablePIDs = this.discoverAvailablePIDs(dataPoints);
    const pidNames = Object.keys(availablePIDs);
    
    console.log(`    🔍 Discovered ${pidNames.length} available PIDs:`, pidNames.join(', '));
    
    const stats = {
      averages: {},
      maximums: {},
      minimums: {},
      ranges: {},
      medians: {},
      standardDeviations: {},
      pidDiscovery: {
        totalPIDs: pidNames.length,
        availablePIDs: pidNames,
        pidDetails: availablePIDs
      }
    };

    // Analyze all discovered PIDs dynamically
    pidNames.forEach(pidName => {
      const pidInfo = availablePIDs[pidName];
      if (pidInfo && pidInfo.statistics) {
        stats.averages[pidName] = pidInfo.statistics.average;
        stats.maximums[pidName] = pidInfo.statistics.maximum;
        stats.minimums[pidName] = pidInfo.statistics.minimum;
        stats.ranges[pidName] = pidInfo.statistics.range;
        stats.medians[pidName] = pidInfo.statistics.median;
        stats.standardDeviations[pidName] = pidInfo.statistics.standardDeviation;
        
        // Log significant PIDs (high diagnostic significance or data quality issues)
        if (pidInfo.metadata.diagnosticSignificance === 'critical' || 
            pidInfo.metadata.diagnosticSignificance === 'high' ||
            pidInfo.dataQuality < 80) {
          console.log(`      ${pidName} [${pidInfo.metadata.category}/${pidInfo.metadata.unit}]:`, {
            validValues: pidInfo.sampleCount,
            dataQuality: pidInfo.dataQuality.toFixed(1) + '%',
            avg: pidInfo.statistics.average.toFixed(2),
            min: pidInfo.statistics.minimum.toFixed(2),
            max: pidInfo.statistics.maximum.toFixed(2),
            stdDev: pidInfo.statistics.standardDeviation.toFixed(2),
            significance: pidInfo.metadata.diagnosticSignificance
          });
        }
      }
    });

    // Calculate drive time statistics
    const driveTime = (dataPoints[dataPoints.length - 1].timestamp - dataPoints[0].timestamp) / 1000; // seconds
    const idleTime = dataPoints.filter(dp => dp.speed === 0 && dp.rpm > 0).length *
                    (driveTime / dataPoints.length);

    stats.driveStatistics = {
      totalTime: driveTime,
      idleTime: idleTime,
      idlePercentage: (idleTime / driveTime) * 100,
      averageSpeed: stats.averages.speed || 0,
      maxSpeed: stats.maximums.speed || 0,
      distanceEstimate: (stats.averages.speed || 0) * (driveTime / 3600) // rough estimate
    };
    
    console.log('      Drive Stats:', {
      totalTime: driveTime.toFixed(1) + 's',
      idleTime: idleTime.toFixed(1) + 's',
      idlePercentage: stats.driveStatistics.idlePercentage.toFixed(1) + '%',
      avgSpeed: stats.driveStatistics.averageSpeed.toFixed(1),
      distance: stats.driveStatistics.distanceEstimate.toFixed(2) + ' km'
    });

    // Add PID-specific analysis for all discovered PIDs
    stats.pidAnalysis = this.analyzeAllPIDs(dataPoints, availablePIDs);

    return stats;
  }

  /**
   * Perform comprehensive analysis on all discovered PIDs
   * Includes threshold checking, trend analysis, and correlation detection
   */
  analyzeAllPIDs(dataPoints, availablePIDs) {
    const analysis = {};
    
    if (!dataPoints || !availablePIDs || Object.keys(availablePIDs).length === 0) {
      return analysis;
    }
    
    Object.keys(availablePIDs).forEach(pidName => {
      try {
        const pidInfo = availablePIDs[pidName];
        if (!pidInfo) return;
        
        const metadata = pidInfo.metadata;
        
        if (!metadata || metadata.diagnosticSignificance === 'low') {
          return; // Skip low-significance PIDs for detailed analysis
        }

        const values = dataPoints
          .map(dp => {
            try {
              const val = dp[pidName];
              return (typeof val === 'number' && !isNaN(val) && isFinite(val)) ? val : null;
            } catch (e) {
              return null;
            }
          })
          .filter(v => v !== null);

        if (values.length < 10) {
          return; // Need minimum samples for analysis
        }

        const pidAnalysis = {
          pidName: pidName,
          category: metadata.category,
          unit: metadata.unit,
          diagnosticSignificance: metadata.diagnosticSignificance,
          dataQuality: pidInfo.dataQuality,
          thresholdAnalysis: this.analyzePIDThresholds(values, metadata),
          trendAnalysis: this.analyzePIDTrend(values, dataPoints),
          stabilityAnalysis: this.analyzePIDStability(values),
          correlationAnalysis: this.analyzePIDCorrelations(pidName, values, dataPoints, availablePIDs, metadata)
        };

        analysis[pidName] = pidAnalysis;
      } catch (error) {
        console.warn(`Error analyzing PID ${pidName}:`, error.message);
        // Continue with other PIDs even if one fails
      }
    });

    return analysis;
  }

  /**
   * Analyze PID values against professional diagnostic thresholds
   */
  analyzePIDThresholds(values, metadata) {
    const analysis = {
      status: 'normal',
      issues: [],
      warnings: [],
      outOfRangeCount: 0,
      criticalCount: 0
    };

    if (!metadata.normalRange && !metadata.criticalThresholds) {
      return analysis;
    }

    const normalRange = metadata.normalRange || { min: -Infinity, max: Infinity };
    const criticalThresholds = metadata.criticalThresholds || normalRange;
    const warningRange = metadata.warningRange || normalRange;

    values.forEach(value => {
      // Check critical thresholds
      if (value < criticalThresholds.min || value > criticalThresholds.max) {
        analysis.criticalCount++;
        if (analysis.issues.length < 5) {
          analysis.issues.push({
            value: value,
            type: value < criticalThresholds.min ? 'below_critical' : 'above_critical',
            threshold: criticalThresholds
          });
        }
      }
      // Check normal range
      else if (value < normalRange.min || value > normalRange.max) {
        analysis.outOfRangeCount++;
        if (analysis.warnings.length < 5) {
          analysis.warnings.push({
            value: value,
            type: value < normalRange.min ? 'below_normal' : 'above_normal',
            threshold: normalRange
          });
        }
      }
    });

    // Determine overall status
    const criticalPercentage = (analysis.criticalCount / values.length) * 100;
    const outOfRangePercentage = (analysis.outOfRangeCount / values.length) * 100;

    if (criticalPercentage > 5) {
      analysis.status = 'critical';
    } else if (criticalPercentage > 1 || outOfRangePercentage > 10) {
      analysis.status = 'warning';
    } else if (outOfRangePercentage > 5) {
      analysis.status = 'marginal';
    } else {
      analysis.status = 'normal';
    }

    analysis.summary = {
      criticalPercentage: criticalPercentage,
      outOfRangePercentage: outOfRangePercentage,
      totalSamples: values.length
    };

    return analysis;
  }

  /**
   * Analyze PID trend over time
   */
  analyzePIDTrend(values, dataPoints) {
    if (values.length < 20) {
      return { status: 'insufficient_data' };
    }

    // Split into thirds for trend analysis
    const thirdSize = Math.floor(values.length / 3);
    const firstThird = values.slice(0, thirdSize);
    const middleThird = values.slice(thirdSize, thirdSize * 2);
    const lastThird = values.slice(thirdSize * 2);

    const avgFirst = firstThird.reduce((a, b) => a + b, 0) / firstThird.length;
    const avgMiddle = middleThird.reduce((a, b) => a + b, 0) / middleThird.length;
    const avgLast = lastThird.reduce((a, b) => a + b, 0) / lastThird.length;

    const trend = {
      firstThird: avgFirst,
      middleThird: avgMiddle,
      lastThird: avgLast,
      direction: 'stable',
      changeRate: 0
    };

    // Calculate overall trend
    const totalChange = avgLast - avgFirst;
    const percentChange = (totalChange / Math.abs(avgFirst)) * 100;

    if (Math.abs(percentChange) < 2) {
      trend.direction = 'stable';
    } else if (percentChange > 5) {
      trend.direction = 'increasing';
      trend.changeRate = percentChange;
    } else if (percentChange < -5) {
      trend.direction = 'decreasing';
      trend.changeRate = percentChange;
    } else {
      trend.direction = Math.abs(percentChange) > 2 ? 'slightly_increasing' : 'slightly_decreasing';
      trend.changeRate = percentChange;
    }

    return trend;
  }

  /**
   * Analyze PID stability (variance, consistency)
   */
  analyzePIDStability(values) {
    if (values.length < 10) {
      return { status: 'insufficient_data' };
    }

    const variance = this.calculateVariance(values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const coefficientOfVariation = (variance / Math.abs(avg)) * 100;

    let stability = 'stable';
    if (coefficientOfVariation > 20) {
      stability = 'unstable';
    } else if (coefficientOfVariation > 10) {
      stability = 'moderate';
    } else if (coefficientOfVariation > 5) {
      stability = 'slightly_unstable';
    }

    return {
      variance: variance,
      coefficientOfVariation: coefficientOfVariation,
      stability: stability,
      average: avg
    };
  }

  /**
   * Analyze correlations between PIDs for professional diagnostics
   */
  analyzePIDCorrelations(pidName, values, dataPoints, availablePIDs, metadata) {
    const correlations = {};
    
    if (!metadata.relatedPIDs || metadata.relatedPIDs.length === 0) {
      return correlations;
    }

    metadata.relatedPIDs.forEach(relatedPID => {
      if (!availablePIDs[relatedPID] || !availablePIDs[relatedPID].available) {
        return;
      }

      const relatedValues = dataPoints
        .map(dp => {
          const val = dp[relatedPID];
          return (typeof val === 'number' && !isNaN(val) && isFinite(val)) ? val : null;
        })
        .filter(v => v !== null);

      if (relatedValues.length < 10 || values.length < 10) {
        return;
      }

      // Calculate correlation coefficient
      const correlation = this.calculateCorrelation(values, relatedValues);
      
      if (Math.abs(correlation) > 0.3) { // Only report meaningful correlations
        correlations[relatedPID] = {
          correlation: correlation,
          strength: Math.abs(correlation) > 0.7 ? 'strong' : 
                   Math.abs(correlation) > 0.5 ? 'moderate' : 'weak',
          direction: correlation > 0 ? 'positive' : 'negative',
          diagnosticNote: this.getCorrelationDiagnosticNote(pidName, relatedPID, correlation, metadata)
        };
      }
    });

    return correlations;
  }

  /**
   * Calculate Pearson correlation coefficient
   */
  calculateCorrelation(x, y) {
    try {
      if (!x || !y || x.length !== y.length || x.length === 0) return 0;

      const n = x.length;
      const sumX = x.reduce((a, b) => a + b, 0);
      const sumY = y.reduce((a, b) => a + b, 0);
      const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
      const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
      const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

      const numerator = n * sumXY - sumX * sumY;
      const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

      if (denominator === 0 || !isFinite(numerator) || !isFinite(denominator)) return 0;
      const correlation = numerator / denominator;
      
      // Clamp correlation to valid range [-1, 1]
      return Math.max(-1, Math.min(1, correlation));
    } catch (error) {
      console.warn('Error calculating correlation:', error.message);
      return 0;
    }
  }

  /**
   * Generate diagnostic notes based on PID correlations
   */
  getCorrelationDiagnosticNote(pid1, pid2, correlation, metadata) {
    // Professional diagnostic insights based on correlation patterns
    const strongPositive = correlation > 0.7;
    const strongNegative = correlation < -0.7;
    
    // Example diagnostic patterns
    if (pid1 === 'fuelTrimLongB1' && pid2 === 'maf' && strongNegative) {
      return 'Strong negative correlation suggests MAF sensor may be reading incorrectly - check for contamination or sensor failure';
    }
    if (pid1 === 'engineTemp' && pid2 === 'rpm' && strongPositive) {
      return 'Normal positive correlation - engine temperature increases with RPM as expected';
    }
    if (pid1 === 'o2B1S1Voltage' && pid2 === 'fuelTrimShortB1' && strongNegative) {
      return 'Expected negative correlation - O2 sensor feedback properly adjusting fuel trim';
    }
    
    return `Correlation ${strongPositive || strongNegative ? 'indicates' : 'suggests'} relationship between ${pid1} and ${pid2}`;
  }

  generateDetailedAnalysis(dataPoints) {
    const analysis = {
      engineHealth: this.analyzeEngineHealth(dataPoints),
      fuelSystem: this.analyzeFuelSystem(dataPoints),
      emissionSystem: this.analyzeEmissionSystem(dataPoints),
      performanceMetrics: this.analyzePerformanceMetrics(dataPoints),
      temperatureAnalysis: this.analyzeTemperatures(dataPoints)
    };

    return analysis;
  }

  analyzeEngineHealth(dataPoints) {
    const health = {
      score: 100,
      issues: [],
      warnings: [],
      metrics: {},
      technician_notes: []
    };

    // PROFESSIONAL TEMPERATURE ANALYSIS - More sensitive for early detection
    const engineTemps = dataPoints.map(dp => dp.engineTemp).filter(t => t != null && t > 0);
    if (engineTemps.length > 0) {
      const avgTemp = engineTemps.reduce((a, b) => a + b, 0) / engineTemps.length;
      const maxTemp = Math.max(...engineTemps);
      const minTemp = Math.min(...engineTemps);
      const tempVariance = this.calculateVariance(engineTemps);
      
      // Professional diagnostic temperature thresholds (°F)
      const criticalTempPoints = dataPoints.filter(dp => dp.engineTemp > 230);  // Immediate damage risk
      const highTempPoints = dataPoints.filter(dp => dp.engineTemp > 210);     // Concerning
      const warmTempPoints = dataPoints.filter(dp => dp.engineTemp > 200);     // Watch closely
      const coolTempPoints = dataPoints.filter(dp => dp.engineTemp < 160);     // Too cool
      
      if (criticalTempPoints.length > 0) {
        health.score -= 40;
        health.issues.push({
          severity: 'critical',
          description: `CRITICAL: Engine temperature exceeded 230°F ${criticalTempPoints.length} times (Max: ${maxTemp.toFixed(1)}°F)`,
          recommendation: 'IMMEDIATE attention required - Risk of engine damage. Check cooling system, head gasket, water pump',
          technical_priority: 1
        });
      } else if (highTempPoints.length > 0) {
        health.score -= 25;
        health.issues.push({
          severity: 'high',
          description: `Engine overheating detected: ${highTempPoints.length} instances above 210°F (Max: ${maxTemp.toFixed(1)}°F)`,
          recommendation: 'Check thermostat, coolant level/condition, radiator efficiency, cooling fan operation',
          technical_priority: 2
        });
      } else if (warmTempPoints.length > dataPoints.length * 0.1) {
        health.score -= 12;
        health.warnings.push({
          severity: 'warning',
          description: `Engine running warm: ${warmTempPoints.length} readings above 200°F (Avg: ${avgTemp.toFixed(1)}°F)`,
          recommendation: 'Monitor cooling system - may indicate developing issue',
          technical_priority: 3
        });
      }

      if (coolTempPoints.length > dataPoints.length * 0.5) {
        health.score -= 8;
        health.warnings.push({
          severity: 'warning',
          description: `Engine not reaching optimal operating temperature (${coolTempPoints.length} readings below 160°F)`,
          recommendation: 'Check thermostat operation - may be stuck open',
          technical_priority: 4
        });
      }

      // Temperature stability analysis
      if (tempVariance > 15) {
        health.score -= 10;
        health.warnings.push({
          severity: 'warning',
          description: `Unstable engine temperature (variance: ${tempVariance.toFixed(1)}°F)`,
          recommendation: 'Check cooling system components for intermittent issues',
          technical_priority: 3
        });
      }

      health.metrics.temperature = {
        average: avgTemp,
        maximum: maxTemp,
        minimum: minTemp,
        variance: tempVariance,
        stability: tempVariance < 10 ? 'stable' : tempVariance < 20 ? 'moderate' : 'unstable'
      };
    }

    // PROFESSIONAL IDLE ANALYSIS - More sensitive for technicians
    const idlePoints = dataPoints.filter(dp => dp.speed === 0 && dp.rpm > 0 && dp.rpm < 1200);
    if (idlePoints.length > 10) {
      const rpmValues = idlePoints.map(dp => dp.rpm);
      const rpmVariance = this.calculateVariance(rpmValues);
      const avgIdleRpm = rpmValues.reduce((a, b) => a + b, 0) / rpmValues.length;
      
      // Professional idle quality thresholds
      if (rpmVariance > 75) {  // Tightened from 100
        health.score -= 20;
        health.issues.push({
          severity: 'high',
          description: `Rough idle detected - RPM variance: ${rpmVariance.toFixed(1)} (Avg: ${avgIdleRpm.toFixed(0)} RPM)`,
          recommendation: 'Immediate diagnosis needed: Check for vacuum leaks, dirty throttle body, worn spark plugs, fuel injector issues',
          technical_priority: 2
        });
      } else if (rpmVariance > 50) {  // Earlier warning
        health.score -= 12;
        health.warnings.push({
          severity: 'warning',
          description: `Idle quality concern - RPM variance: ${rpmVariance.toFixed(1)} (Avg: ${avgIdleRpm.toFixed(0)} RPM)`,
          recommendation: 'Monitor idle quality - may indicate developing ignition/fuel system issues',
          technical_priority: 3
        });
      }

      // Idle RPM range analysis
      if (avgIdleRpm > 900) {
        health.score -= 8;
        health.warnings.push({
          severity: 'warning',
          description: `High idle RPM detected: ${avgIdleRpm.toFixed(0)} RPM`,
          recommendation: 'Check for vacuum leaks, throttle position sensor, IAC valve issues',
          technical_priority: 3
        });
      } else if (avgIdleRpm < 600) {
        health.score -= 10;
        health.warnings.push({
          severity: 'warning',
          description: `Low idle RPM detected: ${avgIdleRpm.toFixed(0)} RPM`,
          recommendation: 'Check idle air control, fuel delivery, engine timing',
          technical_priority: 3
        });
      }

      health.metrics.idle = {
        average_rpm: avgIdleRpm,
        rpm_variance: rpmVariance,
        stability: rpmVariance < 30 ? 'excellent' : rpmVariance < 50 ? 'good' : rpmVariance < 75 ? 'fair' : 'poor',
        sample_count: idlePoints.length
      };
    }

    // PROFESSIONAL ENGINE LOAD ANALYSIS
    const loadPoints = dataPoints.filter(dp => dp.engineLoad != null);
    if (loadPoints.length > 0) {
      const highLoadPoints = dataPoints.filter(dp => dp.engineLoad > 85);  // Tightened from 80
      const avgLoad = loadPoints.reduce((sum, dp) => sum + dp.engineLoad, 0) / loadPoints.length;
      
      health.metrics.engineLoad = {
        average: avgLoad,
        high_load_percentage: (highLoadPoints.length / dataPoints.length) * 100,
        max_load: Math.max(...loadPoints.map(dp => dp.engineLoad))
      };

      if (highLoadPoints.length > dataPoints.length * 0.3) {
        health.score -= 15;
        health.warnings.push({
          severity: 'warning',
          description: `Frequent high engine load detected (${((highLoadPoints.length / dataPoints.length) * 100).toFixed(1)}% of readings >85%)`,
          recommendation: 'Monitor engine performance - may indicate restricted air intake, exhaust restriction, or engine wear',
          technical_priority: 3
        });
      }
    }

    // COMPOUND PENALTY SYSTEM - Professional diagnostic approach
    const totalIssues = health.issues.length;
    const totalWarnings = health.warnings.length;
    
    if (totalIssues >= 2) {
      const compoundPenalty = Math.min(totalIssues * 8, 25);
      health.score -= compoundPenalty;
      health.technician_notes.push(`Multiple concurrent issues detected - compound diagnostic complexity penalty applied (-${compoundPenalty} points)`);
    }

    if (totalWarnings >= 3) {
      const warningPenalty = Math.min(totalWarnings * 3, 15);
      health.score -= warningPenalty;
      health.technician_notes.push(`Multiple warning indicators - early intervention recommended (-${warningPenalty} points)`);
    }

    // Ensure score doesn't go below 0
    health.score = Math.max(0, health.score);

    return health;
  }

  detectDataAnomalies(dataPoints, thresholds = null, parameters = null) {
    const anomalies = [];
    
    // Discover all available PIDs dynamically
    const availablePIDs = this.discoverAvailablePIDs(dataPoints);
    const pidNames = parameters || Object.keys(availablePIDs);
    
    console.log(`    🔍 Anomaly Detection: Analyzing ${pidNames.length} PIDs`);

    // Check for out-of-range values using PID metadata
    dataPoints.forEach((dp, index) => {
      pidNames.forEach(pidName => {
        const value = dp[pidName];
        if (value === null || value === undefined || typeof value !== 'number' || !isFinite(value)) {
          return;
        }

        const pidInfo = availablePIDs[pidName];
        if (!pidInfo || !pidInfo.metadata) {
          return;
        }

        const metadata = pidInfo.metadata;
        const normalRange = metadata.normalRange;
        const criticalThresholds = metadata.criticalThresholds || normalRange;

        // Check critical thresholds
        if (criticalThresholds && (value < criticalThresholds.min || value > criticalThresholds.max)) {
          const severity = metadata.diagnosticSignificance === 'critical' ? 'critical' : 'high';
          anomalies.push({
            timestamp: dp.timestamp,
            parameter: pidName,
            value: value,
            type: value < criticalThresholds.min ? 'below_critical_threshold' : 'above_critical_threshold',
            severity: severity,
            threshold: criticalThresholds,
            category: metadata.category,
            unit: metadata.unit,
            diagnosticNote: this.generateAnomalyDiagnosticNote(pidName, value, criticalThresholds, metadata)
          });
        }
        // Check normal range
        else if (normalRange && (value < normalRange.min || value > normalRange.max)) {
          anomalies.push({
            timestamp: dp.timestamp,
            parameter: pidName,
            value: value,
            type: value < normalRange.min ? 'below_normal' : 'above_normal',
            severity: 'warning',
            threshold: normalRange,
            category: metadata.category,
            unit: metadata.unit
          });
        }
      });

      // Sudden changes detection for all PIDs
      if (index > 0) {
        const prevDp = dataPoints[index - 1];
        const timeDiff = (dp.timestamp - prevDp.timestamp) / 1000; // seconds
        
        if (timeDiff <= 0 || timeDiff > 10) return; // Skip if time difference is invalid or too large

        pidNames.forEach(pidName => {
          const value = dp[pidName];
          const prevValue = prevDp[pidName];
          
          if (value === null || prevValue === null || 
              typeof value !== 'number' || typeof prevValue !== 'number' ||
              !isFinite(value) || !isFinite(prevValue)) {
            return;
          }

          const pidInfo = availablePIDs[pidName];
          if (!pidInfo || !pidInfo.metadata) {
            return;
          }

          const metadata = pidInfo.metadata;
          const change = Math.abs(value - prevValue);
          const changeRate = change / timeDiff;
          const percentChange = (change / Math.abs(prevValue)) * 100;

          // Detect rapid changes based on PID type
          let threshold = this.getRapidChangeThreshold(pidName, metadata);
          
          if (changeRate > threshold.rate || percentChange > threshold.percent) {
            anomalies.push({
              timestamp: dp.timestamp,
              parameter: pidName,
              value: value,
              previousValue: prevValue,
              type: 'rapid_change',
              changeRate: changeRate,
              percentChange: percentChange,
              severity: percentChange > 50 ? 'high' : 'warning',
              category: metadata.category,
              unit: metadata.unit,
              timeDelta: timeDiff
            });
          }
        });
      }
    });

    // Sort anomalies by severity and timestamp
    anomalies.sort((a, b) => {
      const severityOrder = { 'critical': 0, 'high': 1, 'warning': 2 };
      const severityDiff = (severityOrder[a.severity] || 3) - (severityOrder[b.severity] || 3);
      if (severityDiff !== 0) return severityDiff;
      return a.timestamp - b.timestamp;
    });

    return {
      count: anomalies.length,
      anomalies: anomalies.slice(0, 100), // Limit to 100 most significant
      summary: this.summarizeAnomalies(anomalies),
      byParameter: this.groupAnomaliesByParameter(anomalies),
      byCategory: this.groupAnomaliesByCategory(anomalies),
      bySeverity: this.groupAnomaliesBySeverity(anomalies)
    };
  }

  /**
   * Get rapid change threshold based on PID type and metadata
   */
  getRapidChangeThreshold(pidName, metadata) {
    // Default thresholds
    let rate = 100;
    let percent = 20;

    switch (metadata.analysisType) {
      case 'temperature':
        rate = 10; // 10 units per second
        percent = 5; // 5% change
        break;
      case 'voltage_switching':
        rate = 0.5; // 0.5V per second (O2 sensors switch rapidly)
        percent = 50; // 50% change is normal for switching
        break;
      case 'trim':
        rate = 5; // 5% per second
        percent = 10; // 10% change
        break;
      case 'pressure':
        rate = 50; // 50 kPa per second
        percent = 15; // 15% change
        break;
      case 'flow':
        rate = 20; // 20 g/s per second
        percent = 25; // 25% change
        break;
      case 'percentage':
        rate = 10; // 10% per second
        percent = 15; // 15% change
        break;
      case 'continuous':
        // Use default
        break;
    }

    // Adjust based on diagnostic significance
    if (metadata.diagnosticSignificance === 'critical') {
      percent *= 0.7; // More sensitive for critical PIDs
    }

    return { rate, percent };
  }

  /**
   * Generate diagnostic note for anomaly
   */
  generateAnomalyDiagnosticNote(pidName, value, threshold, metadata) {
    const isBelow = value < threshold.min;
    const deviation = isBelow ? threshold.min - value : value - threshold.max;
    const percentDeviation = (deviation / Math.abs(threshold.max - threshold.min)) * 100;

    if (pidName === 'engineTemp' && value > threshold.max) {
      return `CRITICAL: Engine temperature ${value.toFixed(1)}°F exceeds safe operating range. Risk of engine damage. Check cooling system immediately.`;
    }
    if (pidName.includes('fuelTrim') && Math.abs(deviation) > 15) {
      return `Significant fuel trim deviation (${deviation.toFixed(1)}%) indicates ${isBelow ? 'lean' : 'rich'} condition. Check for vacuum leaks, MAF sensor, or fuel delivery issues.`;
    }
    if (pidName === 'maf' && value < threshold.min) {
      return `MAF reading below normal range. Possible sensor contamination, intake restriction, or sensor failure.`;
    }
    
    return `${pidName} value ${value.toFixed(2)} ${metadata.unit} is ${isBelow ? 'below' : 'above'} ${isBelow ? 'minimum' : 'maximum'} threshold by ${deviation.toFixed(2)} ${metadata.unit} (${percentDeviation.toFixed(1)}%)`;
  }

  /**
   * Group anomalies by parameter
   */
  groupAnomaliesByParameter(anomalies) {
    const grouped = {};
    anomalies.forEach(anomaly => {
      if (!grouped[anomaly.parameter]) {
        grouped[anomaly.parameter] = [];
      }
      grouped[anomaly.parameter].push(anomaly);
    });
    return grouped;
  }

  /**
   * Group anomalies by category
   */
  groupAnomaliesByCategory(anomalies) {
    const grouped = {};
    anomalies.forEach(anomaly => {
      const category = anomaly.category || 'unknown';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(anomaly);
    });
    return grouped;
  }

  /**
   * Group anomalies by severity
   */
  groupAnomaliesBySeverity(anomalies) {
    const grouped = { critical: [], high: [], warning: [] };
    anomalies.forEach(anomaly => {
      const severity = anomaly.severity || 'warning';
      if (grouped[severity]) {
        grouped[severity].push(anomaly);
      }
    });
    return grouped;
  }

  calculateVariance(values) {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squareDiffs = values.map(value => Math.pow(value - mean, 2));
    return Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / values.length);
  }

  calculateMedian(values) {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  summarizeAnomalies(anomalies) {
    const summary = {};
    anomalies.forEach(anomaly => {
      if (!summary[anomaly.parameter]) {
        summary[anomaly.parameter] = {
          count: 0,
          types: {}
        };
      }
      summary[anomaly.parameter].count++;
      summary[anomaly.parameter].types[anomaly.type] =
        (summary[anomaly.parameter].types[anomaly.type] || 0) + 1;
    });
    return summary;
  }

  async calculateFuelEconomy(params) {
    try {
      const { sessionId, unit = 'mpg' } = params;
      const { DiagnosticSession, OBD2DataPoint } = this.getModels();

      const dataPoints = await OBD2DataPoint.find({
        sessionId: new mongoose.Types.ObjectId(sessionId),
        speed: { $gt: 0 },
        maf: { $exists: true, $ne: null }
      }).sort({ timestamp: 1 });

      if (dataPoints.length < 10) {
        return {
          success: false,
          message: 'Insufficient data for fuel economy calculation'
        };
      }

      // Calculate instantaneous fuel economy for each point
      const fuelEconomyData = dataPoints.map(dp => {
        // MAF in g/s, speed in mph
        // Gasoline density ~6.17 lb/gal, 453.592 g/lb
        const fuelFlowGPH = (dp.maf / 14.7 / 6.17 / 453.592) * 3600;
        const mpg = dp.speed / fuelFlowGPH;

        return {
          timestamp: dp.timestamp,
          speed: dp.speed,
          maf: dp.maf,
          instantMpg: mpg > 0 && mpg < 100 ? mpg : null // Filter unrealistic values
        };
      }).filter(d => d.instantMpg !== null);

      // Calculate statistics
      const validMpgValues = fuelEconomyData.map(d => d.instantMpg);
      const avgMpg = validMpgValues.reduce((a, b) => a + b, 0) / validMpgValues.length;

      // Convert units if needed
      let result = {
        unit: unit,
        average: avgMpg,
        dataPoints: fuelEconomyData.length
      };

      switch (unit) {
        case 'l/100km':
          result.average = 235.214 / avgMpg; // Convert MPG to L/100km
          break;
        case 'km/l':
          result.average = avgMpg * 0.425144; // Convert MPG to km/L
          break;
      }

      // Calculate trip totals
      const durationHours = (dataPoints[dataPoints.length - 1].timestamp -
                            dataPoints[0].timestamp) / (1000 * 60 * 60);
      const avgSpeed = dataPoints.reduce((sum, dp) => sum + dp.speed, 0) / dataPoints.length;
      const estimatedDistance = avgSpeed * durationHours;
      const estimatedFuelUsed = estimatedDistance / avgMpg;

      result.tripSummary = {
        duration: durationHours,
        distance: estimatedDistance,
        fuelUsed: estimatedFuelUsed,
        avgSpeed: avgSpeed
      };

      // Driving efficiency analysis
      const cityDriving = dataPoints.filter(dp => dp.speed < 35).length / dataPoints.length;
      const highwayDriving = dataPoints.filter(dp => dp.speed >= 55).length / dataPoints.length;

      result.drivingProfile = {
        cityPercentage: cityDriving * 100,
        highwayPercentage: highwayDriving * 100,
        mixedPercentage: (1 - cityDriving - highwayDriving) * 100
      };

      return {
        success: true,
        fuelEconomy: result,
        recommendations: this.generateFuelEconomyRecommendations(result, dataPoints)
      };

    } catch (error) {
      console.error('Fuel economy calculation error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  generateFuelEconomyRecommendations(fuelData, dataPoints) {
    const recommendations = [];

    // Check for aggressive acceleration
    const rapidAccelPoints = this.detectRapidAcceleration(dataPoints);
    if (rapidAccelPoints > dataPoints.length * 0.1) {
      recommendations.push({
        type: 'driving_behavior',
        message: 'Frequent rapid acceleration detected',
        impact: 'Could improve fuel economy by 5-10% with smoother acceleration',
        priority: 'medium'
      });
    }

    // Check idle time
    const idlePoints = dataPoints.filter(dp => dp.speed === 0 && dp.rpm > 0);
    const idlePercentage = (idlePoints.length / dataPoints.length) * 100;
    if (idlePercentage > 15) {
      recommendations.push({
        type: 'idle_time',
        message: `Vehicle spent ${idlePercentage.toFixed(1)}% of time idling`,
        impact: 'Reducing idle time could save up to 0.5 gallons per hour',
        priority: 'low'
      });
    }

    // Speed optimization
    const highSpeedPoints = dataPoints.filter(dp => dp.speed > 65);
    if (highSpeedPoints.length > dataPoints.length * 0.3) {
      recommendations.push({
        type: 'speed_optimization',
        message: 'Frequent high-speed driving detected',
        impact: 'Driving at 55-60 mph instead of 70+ could improve fuel economy by 15-20%',
        priority: 'medium'
      });
    }

    return recommendations;
  }

  detectRapidAcceleration(dataPoints) {
    let rapidAccelCount = 0;
    for (let i = 1; i < dataPoints.length; i++) {
      const timeDiff = (dataPoints[i].timestamp - dataPoints[i-1].timestamp) / 1000;
      const speedDiff = dataPoints[i].speed - dataPoints[i-1].speed;
      const acceleration = speedDiff / timeDiff;

      if (acceleration > 5) { // 5 mph/s is considered aggressive
        rapidAccelCount++;
      }
    }
    return rapidAccelCount;
  }

  generateRecommendations(analysis, analysisType) {
    const recommendations = [];

    // PROFESSIONAL RECOMMENDATION SYSTEM - More sensitive and actionable
    
    // Engine Health Recommendations
    if (analysis.detailed?.engineHealth) {
      const engineHealth = analysis.detailed.engineHealth;
      
      if (engineHealth.issues && engineHealth.issues.length > 0) {
        engineHealth.issues.forEach(issue => {
          recommendations.push({
            category: 'engine_health',
            priority: issue.technical_priority <= 2 ? 'critical' : 'high',
            severity: issue.severity,
            message: issue.description,
            action: issue.recommendation,
            technical_priority: issue.technical_priority,
            system: 'engine'
          });
        });
      }
      
      if (engineHealth.warnings && engineHealth.warnings.length > 0) {
        engineHealth.warnings.forEach(warning => {
          recommendations.push({
            category: 'engine_monitoring',
            priority: 'medium',
            severity: warning.severity,
            message: warning.description,
            action: warning.recommendation,
            technical_priority: warning.technical_priority || 3,
            system: 'engine'
          });
        });
      }
    }
    
    // Fuel System Recommendations
    if (analysis.detailed?.fuelSystem?.fuelTrimAnalysis?.assessment) {
      const fuelAssessment = analysis.detailed.fuelSystem.fuelTrimAnalysis.assessment;
      
      if (fuelAssessment.status !== 'normal' && fuelAssessment.technical_recommendations) {
        fuelAssessment.technical_recommendations.forEach(rec => {
          recommendations.push({
            category: 'fuel_system',
            priority: fuelAssessment.severity === 'critical' ? 'critical' : 
                     fuelAssessment.severity === 'high' ? 'high' : 'medium',
            severity: fuelAssessment.severity,
            message: fuelAssessment.message,
            action: rec,
            technical_priority: fuelAssessment.priority,
            system: 'fuel'
          });
        });
      }
    }

    // Professional Idle Time Analysis - More detailed
    if (analysis.summary?.driveStatistics?.idlePercentage > 30) {
      recommendations.push({
        category: 'operation_efficiency',
        priority: 'medium',
        message: `Excessive idle time detected (${analysis.summary.driveStatistics.idlePercentage.toFixed(1)}%)`,
        action: 'Investigate cause of excessive idling - may indicate driver behavior or operational inefficiency',
        technical_priority: 4,
        system: 'operational'
      });
    } else if (analysis.summary?.driveStatistics?.idlePercentage > 15) {
      recommendations.push({
        category: 'fuel_efficiency',
        priority: 'low',
        message: `Elevated idle time (${analysis.summary.driveStatistics.idlePercentage.toFixed(1)}%)`,
        action: 'Consider idle reduction strategies for improved fuel economy',
        technical_priority: 5,
        system: 'operational'
      });
    }

    // Professional Anomaly Analysis - More granular
    if (analysis.anomalies?.count > 25) {
      recommendations.push({
        category: 'system_integrity',
        priority: 'critical',
        message: `CRITICAL: ${analysis.anomalies.count} sensor anomalies detected`,
        action: 'IMMEDIATE comprehensive diagnostic scan required - multiple system failures possible',
        technical_priority: 1,
        system: 'sensors'
      });
    } else if (analysis.anomalies?.count > 15) {
      recommendations.push({
        category: 'sensor_health',
        priority: 'high',
        message: `${analysis.anomalies.count} sensor anomalies detected`,
        action: 'Schedule comprehensive diagnostic evaluation - multiple sensor concerns identified',
        technical_priority: 2,
        system: 'sensors'
      });
    } else if (analysis.anomalies?.count > 8) {  // Lowered from 10
      recommendations.push({
        category: 'preventive_maintenance',
        priority: 'medium',
        message: `${analysis.anomalies.count} sensor anomalies detected`,
        action: 'Monitor sensor performance - early indication of developing issues',
        technical_priority: 3,
        system: 'sensors'
      });
    }

    // Emissions System Recommendations
    if (analysis.detailed?.emissionSystem?.catalystEfficiency) {
      const catEff = analysis.detailed.emissionSystem.catalystEfficiency;
      if (catEff.status === 'poor' || (catEff.estimatedEfficiency && catEff.estimatedEfficiency < 65)) {
        recommendations.push({
          category: 'emissions',
          priority: 'critical',
          message: `Catalyst efficiency critically low (${catEff.estimatedEfficiency?.toFixed(1) || 'N/A'}%)`,
          action: 'IMMEDIATE catalyst system diagnosis required - emissions compliance at risk',
          technical_priority: 1,
          system: 'emissions'
        });
      } else if (catEff.status === 'marginal' || (catEff.estimatedEfficiency && catEff.estimatedEfficiency < 80)) {
        recommendations.push({
          category: 'emissions',
          priority: 'high',
          message: `Catalyst efficiency declining (${catEff.estimatedEfficiency?.toFixed(1) || 'N/A'}%)`,
          action: 'Schedule catalyst system evaluation - efficiency below optimal levels',
          technical_priority: 2,
          system: 'emissions'
        });
      }
    }

    // Performance Pattern Analysis
    if (analysis.detailed?.performanceMetrics?.acceleration) {
      const accel = analysis.detailed.performanceMetrics.acceleration;
      if (accel.zeroToSixty && accel.zeroToSixty.time > 15) {
        recommendations.push({
          category: 'performance',
          priority: 'medium',
          message: `Slow acceleration detected (0-60: ${accel.zeroToSixty.time.toFixed(1)}s)`,
          action: 'Evaluate engine performance, air intake, and exhaust system restrictions',
          technical_priority: 3,
          system: 'performance'
        });
      }
    }

    // Sort recommendations by technical priority
    recommendations.sort((a, b) => (a.technical_priority || 5) - (b.technical_priority || 5));

    return recommendations.slice(0, 15); // Limit to top 15 most important recommendations
  }

  analyzePerformanceMetrics(dataPoints) {
    // Implementation for performance analysis
    return {
      acceleration: this.calculateAccelerationMetrics(dataPoints),
      powerBand: this.analyzePowerBand(dataPoints),
      throttleResponse: this.analyzeThrottleResponse(dataPoints)
    };
  }

  analyzeFuelSystem(dataPoints) {
    // Implementation for fuel system analysis
    return {
      fuelTrimAnalysis: this.analyzeFuelTrims(dataPoints),
      fuelPressure: this.analyzeFuelPressure(dataPoints),
      injectorPerformance: this.estimateInjectorPerformance(dataPoints)
    };
  }

  analyzeEmissionSystem(dataPoints) {
    // Implementation for emission system analysis
    return {
      catalystEfficiency: this.estimateCatalystEfficiency(dataPoints),
      o2SensorHealth: this.analyzeO2Sensors(dataPoints),
      evapSystem: this.analyzeEvapSystem(dataPoints)
    };
  }

  analyzeTemperatures(dataPoints) {
    // Implementation for temperature analysis
    const temps = {
      engine: dataPoints.map(dp => dp.engineTemp).filter(t => t),
      intake: dataPoints.map(dp => dp.intakeTemp).filter(t => t),
      ambient: dataPoints.map(dp => dp.ambientTemp).filter(t => t)
    };

    return {
      engineTempPattern: this.analyzeTemperaturePattern(temps.engine),
      intakeTempPattern: this.analyzeTemperaturePattern(temps.intake),
      thermostatOperation: this.checkThermostatOperation(temps.engine)
    };
  }

  analyzeTemperaturePattern(temps) {
    if (temps.length === 0) return null;

    return {
      average: temps.reduce((a, b) => a + b, 0) / temps.length,
      max: Math.max(...temps),
      min: Math.min(...temps),
      variance: this.calculateVariance(temps),
      trend: this.calculateTrend(temps)
    };
  }

  calculateTrend(values) {
    if (values.length < 2) return 'stable';

    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));

    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    if (secondAvg > firstAvg + 5) return 'increasing';
    if (secondAvg < firstAvg - 5) return 'decreasing';
    return 'stable';
  }

  analyzeFuelTrims(dataPoints) {
    const shortTermB1 = dataPoints.map(dp => dp.fuelTrimShortB1).filter(v => v !== null);
    const longTermB1 = dataPoints.map(dp => dp.fuelTrimLongB1).filter(v => v !== null);

    return {
      shortTermBank1: {
        average: shortTermB1.reduce((a, b) => a + b, 0) / shortTermB1.length || 0,
        range: [Math.min(...shortTermB1), Math.max(...shortTermB1)]
      },
      longTermBank1: {
        average: longTermB1.reduce((a, b) => a + b, 0) / longTermB1.length || 0,
        range: [Math.min(...longTermB1), Math.max(...longTermB1)]
      },
      assessment: this.assessFuelTrimHealth(shortTermB1, longTermB1)
    };
  }

  assessFuelTrimHealth(shortTerm, longTerm) {
    const avgShort = shortTerm.reduce((a, b) => a + b, 0) / shortTerm.length || 0;
    const avgLong = longTerm.reduce((a, b) => a + b, 0) / longTerm.length || 0;
    const maxShortAbs = Math.max(...shortTerm.map(Math.abs));
    const maxLongAbs = Math.max(...longTerm.map(Math.abs));
    
    // PROFESSIONAL FUEL TRIM THRESHOLDS - More sensitive for technicians
    let status = 'normal';
    let message = 'Fuel trims within acceptable range';
    let severity = 'normal';
    let technical_recommendations = [];
    let priority = 5;
    
    // Critical thresholds - immediate attention needed
    if (Math.abs(avgShort) > 15 || Math.abs(avgLong) > 12 || maxShortAbs > 20 || maxLongAbs > 18) {
      status = 'critical';
      severity = 'critical';
      priority = 1;
      message = `CRITICAL fuel trim deviation detected - Short: ${avgShort.toFixed(1)}%, Long: ${avgLong.toFixed(1)}%`;
      
      if (avgShort > 15 || avgLong > 12) {
        technical_recommendations.push('Lean condition detected - Check for vacuum leaks, low fuel pressure, dirty MAF sensor');
        technical_recommendations.push('Perform smoke test for intake leaks, test fuel pump pressure and volume');
      } else if (avgShort < -15 || avgLong < -12) {
        technical_recommendations.push('Rich condition detected - Check for leaking fuel injectors, faulty O2 sensors, excessive fuel pressure');
        technical_recommendations.push('Test fuel pressure regulator, check for carbon canister purge issues');
      }
    }
    // High concern thresholds - needs attention soon
    else if (Math.abs(avgShort) > 10 || Math.abs(avgLong) > 8 || maxShortAbs > 12 || maxLongAbs > 10) {
      status = 'high_concern';
      severity = 'high';
      priority = 2;
      message = `Significant fuel trim deviation - Short: ${avgShort.toFixed(1)}%, Long: ${avgLong.toFixed(1)}%`;
      
      if (avgShort > 10 || avgLong > 8) {
        technical_recommendations.push('Developing lean condition - Monitor closely, check air intake system integrity');
      } else {
        technical_recommendations.push('Developing rich condition - Check fuel system components, O2 sensor response');
      }
    }
    // Warning thresholds - monitor closely
    else if (Math.abs(avgShort) > 6 || Math.abs(avgLong) > 5 || maxShortAbs > 8 || maxLongAbs > 7) {
      status = 'warning';
      severity = 'warning';
      priority = 3;
      message = `Elevated fuel trims detected - Short: ${avgShort.toFixed(1)}%, Long: ${avgLong.toFixed(1)}%`;
      technical_recommendations.push('Early indication of fuel system drift - schedule diagnostic evaluation');
    }
    // Watch thresholds - document for trend analysis
    else if (Math.abs(avgShort) > 3 || Math.abs(avgLong) > 3) {
      status = 'watch';
      severity = 'info';
      priority = 4;
      message = `Fuel trims showing minor deviation - Short: ${avgShort.toFixed(1)}%, Long: ${avgLong.toFixed(1)}%`;
      technical_recommendations.push('Document values for trend analysis - system adapting normally');
    }

    // Fuel trim stability analysis
    const shortVariance = this.calculateVariance(shortTerm);
    const longVariance = this.calculateVariance(longTerm);
    
    let stability_issues = [];
    if (shortVariance > 5) {
      stability_issues.push(`Unstable short-term fuel trim (variance: ${shortVariance.toFixed(1)}%)`);
    }
    if (longVariance > 3) {
      stability_issues.push(`Unstable long-term fuel trim (variance: ${longVariance.toFixed(1)}%)`);
    }

    return {
      status,
      message,
      severity,
      priority,
      technical_recommendations,
      stability_issues,
      metrics: {
        short_term_avg: avgShort,
        long_term_avg: avgLong,
        short_term_max: maxShortAbs,
        long_term_max: maxLongAbs,
        short_term_variance: shortVariance,
        long_term_variance: longVariance,
        adaptation_quality: (shortVariance < 3 && longVariance < 2) ? 'excellent' : 
                           (shortVariance < 5 && longVariance < 3) ? 'good' : 'poor'
      }
    };
  }

  calculateAccelerationMetrics(dataPoints) {
    const accelerationEvents = [];

    for (let i = 1; i < dataPoints.length; i++) {
      const timeDiff = (dataPoints[i].timestamp - dataPoints[i-1].timestamp) / 1000;
      const speedDiff = dataPoints[i].speed - dataPoints[i-1].speed;

      if (speedDiff > 0 && timeDiff > 0) {
        accelerationEvents.push({
          acceleration: speedDiff / timeDiff,
          fromSpeed: dataPoints[i-1].speed,
          toSpeed: dataPoints[i].speed,
          duration: timeDiff
        });
      }
    }

    // Find 0-60 time estimate
    const zeroToSixty = this.estimateZeroToSixty(dataPoints);

    return {
      events: accelerationEvents.length,
      average: accelerationEvents.reduce((sum, e) => sum + e.acceleration, 0) / accelerationEvents.length || 0,
      zeroToSixty: zeroToSixty
    };
  }

  estimateZeroToSixty(dataPoints) {
    // Find acceleration runs from near 0 to 60+ mph
    for (let i = 0; i < dataPoints.length - 10; i++) {
      if (dataPoints[i].speed < 5) {
        // Look for reaching 60 mph
        for (let j = i + 1; j < Math.min(i + 100, dataPoints.length); j++) {
          if (dataPoints[j].speed >= 60) {
            const timeToSixty = (dataPoints[j].timestamp - dataPoints[i].timestamp) / 1000;
            if (timeToSixty < 30) { // Reasonable 0-60 time
              return {
                time: timeToSixty,
                startIndex: i,
                endIndex: j
              };
            }
            break;
          }
        }
      }
    }
    return null;
  }

  analyzePowerBand(dataPoints) {
    // Group data by RPM ranges
    const rpmBands = {
      idle: { range: [0, 1000], points: [] },
      low: { range: [1000, 2500], points: [] },
      mid: { range: [2500, 4000], points: [] },
      high: { range: [4000, 6000], points: [] },
      redline: { range: [6000, 10000], points: [] }
    };

    dataPoints.forEach(dp => {
      if (dp.rpm && dp.engineLoad) {
        for (const [band, data] of Object.entries(rpmBands)) {
          if (dp.rpm >= data.range[0] && dp.rpm < data.range[1]) {
            data.points.push({ rpm: dp.rpm, load: dp.engineLoad, throttle: dp.throttlePosition });
            break;
          }
        }
      }
    });

    // Calculate average load per RPM band
    const analysis = {};
    for (const [band, data] of Object.entries(rpmBands)) {
      if (data.points.length > 0) {
        analysis[band] = {
          avgLoad: data.points.reduce((sum, p) => sum + p.load, 0) / data.points.length,
          avgThrottle: data.points.reduce((sum, p) => sum + (p.throttle || 0), 0) / data.points.length,
          sampleCount: data.points.length
        };
      }
    }

    return analysis;
  }

  analyzeThrottleResponse(dataPoints) {
    const throttleEvents = [];

    for (let i = 1; i < dataPoints.length; i++) {
      const throttleDiff = (dataPoints[i].throttlePosition || 0) - (dataPoints[i-1].throttlePosition || 0);
      const rpmDiff = dataPoints[i].rpm - dataPoints[i-1].rpm;
      const timeDiff = (dataPoints[i].timestamp - dataPoints[i-1].timestamp) / 1000;

      if (Math.abs(throttleDiff) > 5 && timeDiff > 0) {
        throttleEvents.push({
          throttleChange: throttleDiff,
          rpmChange: rpmDiff,
          responseTime: timeDiff,
          lag: rpmDiff / throttleDiff // RPM change per throttle % change
        });
      }
    }

    return {
      events: throttleEvents.length,
      avgResponseTime: throttleEvents.reduce((sum, e) => sum + e.responseTime, 0) / throttleEvents.length || 0,
      avgLag: throttleEvents.reduce((sum, e) => sum + Math.abs(e.lag), 0) / throttleEvents.length || 0
    };
  }

  checkThermostatOperation(engineTemps) {
    if (engineTemps.length < 20) return { status: 'insufficient_data' };

    // Check warm-up pattern
    const first10 = engineTemps.slice(0, 10);
    const last10 = engineTemps.slice(-10);

    const initialAvg = first10.reduce((a, b) => a + b, 0) / first10.length;
    const finalAvg = last10.reduce((a, b) => a + b, 0) / last10.length;

    // Check if thermostat opens properly (usually around 195°F)
    const operatingTemp = engineTemps.filter(t => t > 180 && t < 210).length / engineTemps.length;

    return {
      warmUpTime: this.estimateWarmUpTime(engineTemps),
      operatingTempPercentage: operatingTemp * 100,
      status: operatingTemp > 0.7 ? 'normal' : 'check_thermostat',
      initialTemp: initialAvg,
      operatingTemp: finalAvg
    };
  }

  estimateWarmUpTime(engineTemps) {
    // Find time to reach operating temperature (180°F)
    for (let i = 0; i < engineTemps.length; i++) {
      if (engineTemps[i] >= 180) {
        return i; // Return index as proxy for time
      }
    }
    return null;
  }

  analyzeFuelPressure(dataPoints) {
    const pressureReadings = dataPoints.map(dp => dp.fuelPressure).filter(p => p !== null);
    if (pressureReadings.length === 0) return { status: 'no_data' };

    return {
      average: pressureReadings.reduce((a, b) => a + b, 0) / pressureReadings.length,
      min: Math.min(...pressureReadings),
      max: Math.max(...pressureReadings),
      stability: this.calculateVariance(pressureReadings) < 5 ? 'stable' : 'unstable'
    };
  }

  estimateInjectorPerformance(dataPoints) {
    // Analyze fuel trim patterns for injector issues
    const analysis = {
      bank1Performance: 'normal',
      bank2Performance: 'normal',
      recommendations: []
    };

    const fuelTrimsB1 = dataPoints.map(dp => dp.fuelTrimLongB1).filter(v => v !== null);
    const fuelTrimsB2 = dataPoints.map(dp => dp.fuelTrimLongB2).filter(v => v !== null);

    if (fuelTrimsB1.length > 0) {
      const avgB1 = fuelTrimsB1.reduce((a, b) => a + b, 0) / fuelTrimsB1.length;
      if (Math.abs(avgB1) > 15) {
        analysis.bank1Performance = 'degraded';
        analysis.recommendations.push('Consider cleaning or testing bank 1 fuel injectors');
      }
    }

    if (fuelTrimsB2.length > 0) {
      const avgB2 = fuelTrimsB2.reduce((a, b) => a + b, 0) / fuelTrimsB2.length;
      if (Math.abs(avgB2) > 15) {
        analysis.bank2Performance = 'degraded';
        analysis.recommendations.push('Consider cleaning or testing bank 2 fuel injectors');
      }
    }

    return analysis;
  }

  estimateCatalystEfficiency(dataPoints) {
    // Compare upstream and downstream O2 sensors
    const upstreamB1 = dataPoints.map(dp => dp.o2B1S1Voltage).filter(v => v !== null);
    const downstreamB1 = dataPoints.map(dp => dp.o2B1S2Voltage).filter(v => v !== null);

    if (upstreamB1.length < 10 || downstreamB1.length < 10) {
      return { status: 'insufficient_data' };
    }

    // Calculate switching frequency
    const upstreamSwitches = this.countVoltageSwitches(upstreamB1);
    const downstreamSwitches = this.countVoltageSwitches(downstreamB1);

    // Downstream should switch much less than upstream
    const efficiency = 1 - (downstreamSwitches / upstreamSwitches);

    return {
      estimatedEfficiency: efficiency * 100,
      upstreamActivity: upstreamSwitches,
      downstreamActivity: downstreamSwitches,
      status: efficiency > 0.8 ? 'good' : efficiency > 0.6 ? 'marginal' : 'poor'
    };
  }

  countVoltageSwitches(voltages) {
    let switches = 0;
    const threshold = 0.45; // Typical switch point

    for (let i = 1; i < voltages.length; i++) {
      if ((voltages[i-1] < threshold && voltages[i] > threshold) ||
          (voltages[i-1] > threshold && voltages[i] < threshold)) {
        switches++;
      }
    }

    return switches;
  }

  analyzeO2Sensors(dataPoints) {
    const sensors = {
      B1S1: { voltages: dataPoints.map(dp => dp.o2B1S1Voltage).filter(v => v !== null) },
      B1S2: { voltages: dataPoints.map(dp => dp.o2B1S2Voltage).filter(v => v !== null) },
      B2S1: { voltages: dataPoints.map(dp => dp.o2B2S1Voltage).filter(v => v !== null) },
      B2S2: { voltages: dataPoints.map(dp => dp.o2B2S2Voltage).filter(v => v !== null) }
    };

    const analysis = {};

    for (const [sensor, data] of Object.entries(sensors)) {
      if (data.voltages.length > 0) {
        const switches = this.countVoltageSwitches(data.voltages);
        const avgVoltage = data.voltages.reduce((a, b) => a + b, 0) / data.voltages.length;

        analysis[sensor] = {
          switchCount: switches,
          avgVoltage: avgVoltage,
          responseTime: switches / (data.voltages.length / 10), // Switches per 10 samples
          status: this.assessO2SensorHealth(switches, avgVoltage, data.voltages.length)
        };
      }
    }

    return analysis;
  }

  assessO2SensorHealth(switches, avgVoltage, sampleCount) {
    const switchRate = switches / sampleCount;

    if (switchRate < 0.1) return 'slow_response';
    if (avgVoltage < 0.2 || avgVoltage > 0.8) return 'biased';
    if (switchRate > 0.5) return 'normal';

    return 'marginal';
  }

  analyzeEvapSystem(dataPoints) {
    // Analyze vapor pressure for EVAP leaks
    const vaporPressures = dataPoints.map(dp => dp.vaporPressure).filter(v => v !== null);

    if (vaporPressures.length === 0) {
      return { status: 'no_data' };
    }

    const avgPressure = vaporPressures.reduce((a, b) => a + b, 0) / vaporPressures.length;
    const variance = this.calculateVariance(vaporPressures);

    return {
      avgPressure: avgPressure,
      stability: variance < 0.5 ? 'stable' : 'unstable',
      leakDetected: avgPressure < -5 || avgPressure > 5,
      recommendation: avgPressure < -5 ? 'Check for EVAP system leak' : 'System appears sealed'
    };
  }

  analyzeEmissions(dataPoints) {
    // Comprehensive emissions analysis
    return {
      noxEmissions: this.estimateNOxEmissions(dataPoints),
      hcEmissions: this.estimateHCEmissions(dataPoints),
      coEmissions: this.estimateCOEmissions(dataPoints),
      overallRating: this.calculateEmissionsRating(dataPoints)
    };
  }

  analyzeFuelEconomy(dataPoints) {
    if (!dataPoints || dataPoints.length === 0) {
      return { error: 'No data points available for fuel economy analysis' };
    }

    // Extract relevant data
    const fuelData = dataPoints.filter(dp => dp.fuelLevel !== undefined || dp.fuelRate !== undefined);
    const speedData = dataPoints.filter(dp => dp.speed !== undefined && dp.speed > 0);
    const rpmData = dataPoints.filter(dp => dp.rpm !== undefined && dp.rpm > 0);

    if (fuelData.length === 0) {
      return { error: 'No fuel-related data available' };
    }

    // Calculate basic fuel economy metrics
    const avgSpeed = speedData.length > 0 ? speedData.reduce((sum, dp) => sum + dp.speed, 0) / speedData.length : 0;
    const avgRPM = rpmData.length > 0 ? rpmData.reduce((sum, dp) => sum + dp.rpm, 0) / rpmData.length : 0;
    
    // Estimate fuel economy based on driving patterns
    const idleTime = dataPoints.filter(dp => dp.speed !== undefined && dp.speed < 1).length;
    const idlePercentage = (idleTime / dataPoints.length) * 100;
    
    const highwayDriving = dataPoints.filter(dp => dp.speed !== undefined && dp.speed > 55).length;
    const highwayPercentage = (highwayDriving / dataPoints.length) * 100;
    
    const cityDriving = dataPoints.filter(dp => dp.speed !== undefined && dp.speed >= 1 && dp.speed <= 55).length;
    const cityPercentage = (cityDriving / dataPoints.length) * 100;

    // Calculate efficiency score (0-100)
    let efficiencyScore = 100;
    
    // Penalize excessive idling
    if (idlePercentage > 20) {
      efficiencyScore -= (idlePercentage - 20) * 2;
    }
    
    // Reward highway driving
    if (highwayPercentage > 30) {
      efficiencyScore += 10;
    }
    
    // Penalize aggressive driving (high RPM at low speeds)
    const aggressiveDriving = dataPoints.filter(dp => 
      dp.rpm !== undefined && dp.rpm > 3000 && 
      dp.speed !== undefined && dp.speed < 30
    ).length;
    const aggressivePercentage = (aggressiveDriving / dataPoints.length) * 100;
    
    if (aggressivePercentage > 10) {
      efficiencyScore -= aggressivePercentage * 1.5;
    }

    efficiencyScore = Math.max(0, Math.min(100, efficiencyScore));

    return {
      averageSpeed: Math.round(avgSpeed * 10) / 10,
      averageRPM: Math.round(avgRPM),
      idlePercentage: Math.round(idlePercentage * 10) / 10,
      highwayDriving: Math.round(highwayPercentage * 10) / 10,
      cityDriving: Math.round(cityPercentage * 10) / 10,
      efficiencyScore: Math.round(efficiencyScore),
      drivingPattern: this.assessDrivingPattern(avgSpeed, idlePercentage, highwayPercentage),
      recommendations: this.generateFuelEconomyRecommendations({
        idlePercentage,
        highwayPercentage,
        aggressivePercentage,
        avgSpeed
      }, dataPoints)
    };
  }

  assessDrivingPattern(avgSpeed, idlePercentage, highwayPercentage) {
    const cityPercentage = 100 - highwayPercentage - idlePercentage;
    
    if (highwayPercentage > 50) {
      return 'Highway';
    } else if (cityPercentage > 60) {
      return 'City';
    } else if (idlePercentage > 30) {
      return 'Stop-and-go';
    } else {
      return 'Mixed';
    }
  }

  estimateNOxEmissions(dataPoints) {
    // NOx is typically higher with high combustion temperatures and lean conditions
    const highTempLeanPoints = dataPoints.filter(dp =>
      dp.engineTemp > 200 &&
      dp.fuelTrimLongB1 < -5
    );

    return {
      riskLevel: highTempLeanPoints.length / dataPoints.length > 0.2 ? 'high' : 'normal',
      percentage: (highTempLeanPoints.length / dataPoints.length) * 100
    };
  }

  estimateHCEmissions(dataPoints) {
    // HC emissions increase with rich conditions and misfires
    const richConditionPoints = dataPoints.filter(dp =>
      dp.fuelTrimLongB1 > 5 ||
      dp.fuelTrimShortB1 > 10
    );

    return {
      riskLevel: richConditionPoints.length / dataPoints.length > 0.15 ? 'elevated' : 'normal',
      percentage: (richConditionPoints.length / dataPoints.length) * 100
    };
  }

  estimateCOEmissions(dataPoints) {
    // CO emissions correlate with rich conditions
    const veryRichPoints = dataPoints.filter(dp =>
      dp.fuelTrimLongB1 > 10 ||
      (dp.o2B1S1Voltage && dp.o2B1S1Voltage > 0.8)
    );

    return {
      riskLevel: veryRichPoints.length / dataPoints.length > 0.1 ? 'high' : 'normal',
      percentage: (veryRichPoints.length / dataPoints.length) * 100
    };
  }

  calculateEmissionsRating(dataPoints) {
    const nox = this.estimateNOxEmissions(dataPoints);
    const hc = this.estimateHCEmissions(dataPoints);
    const co = this.estimateCOEmissions(dataPoints);

    let score = 100;
    if (nox.riskLevel === 'high') score -= 30;
    if (hc.riskLevel === 'elevated') score -= 20;
    if (co.riskLevel === 'high') score -= 25;

    return {
      score: Math.max(0, score),
      rating: score > 80 ? 'excellent' : score > 60 ? 'good' : score > 40 ? 'fair' : 'poor',
      summary: `Based on sensor data analysis`
    };
  }

  async compareSessions(params) {
    try {
      const { sessionIds, metrics = ['all'] } = params;

      if (!sessionIds || sessionIds.length < 2) {
        return {
          success: false,
          error: 'At least two session IDs required for comparison'
        };
      }

      const sessionAnalyses = [];

      for (const sessionId of sessionIds) {
        const analysis = await this.analyzeSession({
          sessionId,
          analysisType: 'detailed'
        });

        if (analysis.success) {
          sessionAnalyses.push({
            sessionId,
            analysis: analysis.analysis
          });
        }
      }

      if (sessionAnalyses.length < 2) {
        return {
          success: false,
          error: 'Could not analyze enough sessions for comparison'
        };
      }

      // Compare the sessions
      const comparison = this.performSessionComparison(sessionAnalyses, metrics);

      return {
        success: true,
        comparison,
        trend: this.identifyTrends(sessionAnalyses)
      };

    } catch (error) {
      console.error('Session comparison error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  performSessionComparison(sessionAnalyses, metrics) {
    const comparison = {
      sessions: sessionAnalyses.length,
      metrics: {}
    };

    if (metrics.includes('all') || metrics.includes('fuel_economy')) {
      comparison.metrics.fuelEconomy = this.compareFuelEconomy(sessionAnalyses);
    }

    if (metrics.includes('all') || metrics.includes('performance')) {
      comparison.metrics.performance = this.comparePerformance(sessionAnalyses);
    }

    if (metrics.includes('all') || metrics.includes('emissions')) {
      comparison.metrics.emissions = this.compareEmissions(sessionAnalyses);
    }

    if (metrics.includes('all') || metrics.includes('temperature')) {
      comparison.metrics.temperature = this.compareTemperatures(sessionAnalyses);
    }

    return comparison;
  }

  compareFuelEconomy(sessionAnalyses) {
    return sessionAnalyses.map(sa => ({
      sessionId: sa.sessionId,
      avgFuelRate: sa.analysis.detailed?.fuelSystem?.avgFuelRate || 'N/A',
      fuelEfficiency: sa.analysis.detailed?.fuelSystem?.efficiency || 'N/A'
    }));
  }

  comparePerformance(sessionAnalyses) {
    return sessionAnalyses.map(sa => ({
      sessionId: sa.sessionId,
      avgPower: sa.analysis.detailed?.performanceMetrics?.avgPower || 'N/A',
      peakRpm: sa.analysis.detailed?.performanceMetrics?.peakRpm || 'N/A'
    }));
  }

  compareEmissions(sessionAnalyses) {
    return sessionAnalyses.map(sa => ({
      sessionId: sa.sessionId,
      emissionsScore: sa.analysis.detailed?.emissionSystem?.score || 'N/A',
      catalystEfficiency: sa.analysis.detailed?.emissionSystem?.catalystEfficiency?.estimatedEfficiency || 'N/A'
    }));
  }

  compareTemperatures(sessionAnalyses) {
    return sessionAnalyses.map(sa => ({
      sessionId: sa.sessionId,
      avgEngineTemp: sa.analysis.detailed?.temperatureAnalysis?.engineTempPattern?.average || 'N/A',
      maxEngineTemp: sa.analysis.detailed?.temperatureAnalysis?.engineTempPattern?.max || 'N/A'
    }));
  }

  identifyTrends(sessionAnalyses) {
    // Sort by session start time
    const sortedAnalyses = sessionAnalyses.sort((a, b) =>
      new Date(a.analysis.sessionInfo.startTime) - new Date(b.analysis.sessionInfo.startTime)
    );

    const trends = {
      improving: [],
      degrading: [],
      stable: []
    };

    // Identify trends in key metrics
    // This is a simplified trend analysis
    if (sortedAnalyses.length >= 2) {
      const first = sortedAnalyses[0];
      const last = sortedAnalyses[sortedAnalyses.length - 1];

      // Check engine health trend
      if (first.analysis.detailed?.engineHealth?.score && last.analysis.detailed?.engineHealth?.score) {
        const healthChange = last.analysis.detailed.engineHealth.score - first.analysis.detailed.engineHealth.score;
        if (healthChange > 5) {
          trends.improving.push('Engine health');
        } else if (healthChange < -5) {
          trends.degrading.push('Engine health');
        } else {
          trends.stable.push('Engine health');
        }
      }
    }

    return trends;
  }

  async getDiagnosticRecommendations(params) {
    try {
      const { sessionId, dtcCodes = [], symptoms = [] } = params;

      // Get session analysis
      const analysis = await this.analyzeSession({
        sessionId,
        analysisType: 'detailed'
      });

      if (!analysis.success) {
        return {
          success: false,
          error: 'Could not analyze session'
        };
      }

      const recommendations = [];

      // Analyze DTC codes if provided
      if (dtcCodes.length > 0) {
        const dtcRecommendations = this.getDTCRecommendations(dtcCodes, analysis.analysis);
        recommendations.push(...dtcRecommendations);
      }

      // Analyze symptoms
      if (symptoms.length > 0) {
        const symptomRecommendations = this.getSymptomRecommendations(symptoms, analysis.analysis);
        recommendations.push(...symptomRecommendations);
      }

      // Add data-driven recommendations
      const dataRecommendations = this.getDataDrivenRecommendations(analysis.analysis);
      recommendations.push(...dataRecommendations);

      // Prioritize and deduplicate recommendations
      const finalRecommendations = this.prioritizeRecommendations(recommendations);

      return {
        success: true,
        recommendations: finalRecommendations,
        analysis: analysis.analysis,
        confidence: this.calculateConfidenceScore(finalRecommendations, analysis.analysis)
      };

    } catch (error) {
      console.error('Diagnostic recommendations error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  getDTCRecommendations(dtcCodes, analysis) {
    const recommendations = [];

    // Map common DTC codes to recommendations
    const dtcMap = {
      'P0300': {
        title: 'Random/Multiple Cylinder Misfire',
        checks: [
          'Check spark plugs and ignition coils',
          'Inspect fuel injectors',
          'Check for vacuum leaks',
          'Verify fuel pressure'
        ],
        relatedData: ['rpm', 'engineLoad', 'fuelTrim']
      },
      'P0420': {
        title: 'Catalyst Efficiency Below Threshold',
        checks: [
          'Inspect catalytic converter',
          'Check O2 sensors',
          'Look for exhaust leaks',
          'Check for engine misfires'
        ],
        relatedData: ['o2Sensors', 'fuelTrim', 'engineTemp']
      },
      'P0171': {
        title: 'System Too Lean (Bank 1)',
        checks: [
          'Check for vacuum leaks',
          'Inspect MAF sensor',
          'Check fuel pressure',
          'Inspect PCV system'
        ],
        relatedData: ['fuelTrimLongB1', 'maf', 'o2B1S1Voltage']
      }
    };

    dtcCodes.forEach(code => {
      if (dtcMap[code]) {
        const dtcInfo = dtcMap[code];
        recommendations.push({
          type: 'dtc_based',
          priority: 'high',
          title: dtcInfo.title,
          code: code,
          checks: dtcInfo.checks,
          dataAnalysis: this.analyzeRelatedData(analysis, dtcInfo.relatedData)
        });
      }
    });

    return recommendations;
  }

  getSymptomRecommendations(symptoms, analysis) {
    const recommendations = [];

    const symptomMap = {
      'rough idle': {
        possibleCauses: [
          'Vacuum leak',
          'Dirty MAF sensor',
          'Worn spark plugs',
          'Carbon buildup',
          'EGR valve issues'
        ],
        dataToCheck: ['rpm variance at idle', 'fuel trims', 'MAF readings']
      },
      'poor acceleration': {
        possibleCauses: [
          'Clogged fuel filter',
          'Weak fuel pump',
          'Clogged air filter',
          'Transmission slipping',
          'Catalytic converter restriction'
        ],
        dataToCheck: ['throttle response', 'fuel pressure', 'MAF readings', 'engine load']
      },
      'high fuel consumption': {
        possibleCauses: [
          'Dragging brakes',
          'Low tire pressure',
          'Stuck thermostat',
          'O2 sensor failure',
          'Fuel system issues'
        ],
        dataToCheck: ['fuel trims', 'O2 sensors', 'engine temperature', 'driving patterns']
      }
    };

    symptoms.forEach(symptom => {
      const symptomLower = symptom.toLowerCase();
      Object.entries(symptomMap).forEach(([key, value]) => {
        if (symptomLower.includes(key)) {
          recommendations.push({
            type: 'symptom_based',
            priority: 'medium',
            symptom: symptom,
            possibleCauses: value.possibleCauses,
            dataToCheck: value.dataToCheck,
            relatedFindings: this.findRelatedAnomalies(analysis, key)
          });
        }
      });
    });

    return recommendations;
  }

  getDataDrivenRecommendations(analysis) {
    const recommendations = [];

    // Check engine health issues
    if (analysis.detailed?.engineHealth?.issues) {
      analysis.detailed.engineHealth.issues.forEach(issue => {
        recommendations.push({
          type: 'data_driven',
          priority: issue.severity === 'critical' ? 'high' : 'medium',
          finding: issue.description,
          recommendation: issue.recommendation,
          confidence: 'high'
        });
      });
    }

    // Check fuel system
    if (analysis.detailed?.fuelSystem?.fuelTrimAnalysis?.assessment?.status === 'needs_attention') {
      recommendations.push({
        type: 'data_driven',
        priority: 'medium',
        finding: 'Fuel trim values out of range',
        recommendation: 'Check for vacuum leaks, MAF sensor contamination, or fuel delivery issues',
        confidence: 'medium'
      });
    }

    // Check emission system
    if (analysis.detailed?.emissionSystem?.catalystEfficiency?.status === 'poor') {
      recommendations.push({
        type: 'data_driven',
        priority: 'high',
        finding: 'Catalyst efficiency below acceptable levels',
        recommendation: 'Inspect catalytic converter and O2 sensors',
        confidence: 'high'
      });
    }

    return recommendations;
  }

  analyzeRelatedData(analysis, dataPoints) {
    const findings = {};

    dataPoints.forEach(dataPoint => {
      switch(dataPoint) {
        case 'rpm':
          if (analysis.summary?.averages?.rpm) {
            findings.avgRpm = analysis.summary.averages.rpm;
          }
          break;
        case 'fuelTrim':
          if (analysis.detailed?.fuelSystem?.fuelTrimAnalysis) {
            findings.fuelTrimStatus = analysis.detailed.fuelSystem.fuelTrimAnalysis.assessment;
          }
          break;
        case 'o2Sensors':
          if (analysis.detailed?.emissionSystem?.o2SensorHealth) {
            findings.o2SensorStatus = analysis.detailed.emissionSystem.o2SensorHealth;
          }
          break;
      }
    });

    return findings;
  }

  findRelatedAnomalies(analysis, symptom) {
    const anomalies = [];

    if (analysis.anomalies?.anomalies) {
      analysis.anomalies.anomalies.forEach(anomaly => {
        // Match anomalies to symptoms
        if (symptom === 'rough idle' && anomaly.parameter === 'rpm' && anomaly.type === 'rapid_change') {
          anomalies.push(anomaly);
        }
        if (symptom === 'poor acceleration' && anomaly.parameter === 'throttlePosition') {
          anomalies.push(anomaly);
        }
      });
    }

    return anomalies;
  }

  prioritizeRecommendations(recommendations) {
    // Sort by priority and deduplicate
    const priorityOrder = { 'critical': 0, 'high': 1, 'medium': 2, 'low': 3 };

    return recommendations
      .sort((a, b) => (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3))
      .filter((rec, index, self) =>
        index === self.findIndex(r => r.recommendation === rec.recommendation)
      )
      .slice(0, 10); // Limit to top 10 recommendations
  }

  calculateConfidenceScore(recommendations, analysis) {
    let score = 50; // Base score

    // Increase confidence based on data quality
    if (analysis.sessionInfo?.dataPoints > 1000) score += 10;
    if (analysis.sessionInfo?.dataPoints > 5000) score += 10;

    // Increase confidence based on recommendation matches
    const highPriorityRecs = recommendations.filter(r => r.priority === 'high').length;
    score += Math.min(highPriorityRecs * 5, 20);

    // Decrease confidence if data anomalies are high
    if (analysis.anomalies?.count > 50) score -= 10;

    return Math.min(Math.max(score, 0), 100);
  }

  async generateHealthReport(params) {
    try {
      const { sessionId, includeHistory = true, reportFormat = 'summary' } = params;

      // Get current session analysis
      const currentAnalysis = await this.analyzeSession({
        sessionId,
        analysisType: 'detailed'
      });

      if (!currentAnalysis.success) {
        return {
          success: false,
          error: 'Could not analyze session'
        };
      }

      const report = {
        vehicleInfo: currentAnalysis.analysis.sessionInfo,
        timestamp: new Date().toISOString(),
        overallHealth: this.calculateOverallHealth(currentAnalysis.analysis),
        systems: this.assessAllSystems(currentAnalysis.analysis)
      };

      // Add historical comparison if requested
      if (includeHistory) {
        const historicalData = await this.getHistoricalComparison(
          currentAnalysis.analysis.sessionInfo.vehicleId,
          sessionId
        );
        report.historicalTrends = historicalData;
      }

      // Format report based on requested format
      switch (reportFormat) {
        case 'summary':
          return {
            success: true,
            report: this.formatSummaryReport(report)
          };
        case 'detailed':
          return {
            success: true,
            report: this.formatDetailedReport(report, currentAnalysis.analysis)
          };
        case 'technician':
          return {
            success: true,
            report: this.formatTechnicianReport(report, currentAnalysis.analysis)
          };
        default:
          return {
            success: true,
            report
          };
      }

    } catch (error) {
      console.error('Health report generation error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  calculateOverallHealth(analysis) {
    let healthScore = 100;
    const issues = [];
    const warnings = [];
    const technician_notes = [];
    let priority_items = [];

    // PROFESSIONAL ENGINE HEALTH ASSESSMENT - Higher penalty for issues
    if (analysis.detailed?.engineHealth?.score) {
      const engineScore = analysis.detailed.engineHealth.score;
      if (engineScore < 100) {
        const enginePenalty = (100 - engineScore) * 0.6;  // Increased from 0.3
        healthScore -= enginePenalty;
        
        if (engineScore < 50) {
          issues.push('CRITICAL engine health issues detected');
          priority_items.push({priority: 1, system: 'engine', severity: 'critical'});
        } else if (engineScore < 75) {
          issues.push('Significant engine health concerns');
          priority_items.push({priority: 2, system: 'engine', severity: 'high'});
        } else if (engineScore < 90) {
          warnings.push('Engine performance degradation detected');
          priority_items.push({priority: 3, system: 'engine', severity: 'warning'});
        }
        
        technician_notes.push(`Engine health score: ${engineScore.toFixed(1)}/100 (penalty: -${enginePenalty.toFixed(1)} points)`);
      }
    }

    // PROFESSIONAL ANOMALY THRESHOLD - More sensitive
    if (analysis.anomalies?.count > 10) {  // Lowered from 20
      const anomalyPenalty = Math.min(analysis.anomalies.count * 1.2, 20);
      healthScore -= anomalyPenalty;
      
      if (analysis.anomalies.count > 25) {
        issues.push(`CRITICAL: ${analysis.anomalies.count} sensor anomalies detected`);
        priority_items.push({priority: 1, system: 'sensors', severity: 'critical'});
      } else if (analysis.anomalies.count > 15) {
        issues.push(`Multiple sensor anomalies detected (${analysis.anomalies.count})`);
        priority_items.push({priority: 2, system: 'sensors', severity: 'high'});
      } else {
        warnings.push(`Elevated sensor anomaly count (${analysis.anomalies.count})`);
        priority_items.push({priority: 3, system: 'sensors', severity: 'warning'});
      }
      
      technician_notes.push(`Anomaly penalty: -${anomalyPenalty.toFixed(1)} points for ${analysis.anomalies.count} anomalies`);
    }

    // PROFESSIONAL CATALYST EFFICIENCY - More granular assessment
    if (analysis.detailed?.emissionSystem?.catalystEfficiency) {
      const catStatus = analysis.detailed.emissionSystem.catalystEfficiency.status;
      const catEfficiency = analysis.detailed.emissionSystem.catalystEfficiency.estimatedEfficiency || 0;
      
      if (catStatus === 'poor' || catEfficiency < 60) {
        healthScore -= 25;  // Increased penalty
        issues.push(`CRITICAL: Catalyst efficiency critically low (${catEfficiency.toFixed(1)}%)`);
        priority_items.push({priority: 1, system: 'emissions', severity: 'critical'});
      } else if (catStatus === 'marginal' || catEfficiency < 75) {
        healthScore -= 15;
        issues.push(`Catalyst efficiency below acceptable levels (${catEfficiency.toFixed(1)}%)`);
        priority_items.push({priority: 2, system: 'emissions', severity: 'high'});
      } else if (catEfficiency < 85) {
        healthScore -= 8;
        warnings.push(`Catalyst efficiency declining (${catEfficiency.toFixed(1)}%)`);
        priority_items.push({priority: 3, system: 'emissions', severity: 'warning'});
      }
    }

    // PROFESSIONAL FUEL SYSTEM ASSESSMENT - More detailed evaluation
    if (analysis.detailed?.fuelSystem?.fuelTrimAnalysis?.assessment) {
      const fuelStatus = analysis.detailed.fuelSystem.fuelTrimAnalysis.assessment.status;
      const fuelSeverity = analysis.detailed.fuelSystem.fuelTrimAnalysis.assessment.severity;
      const fuelPriority = analysis.detailed.fuelSystem.fuelTrimAnalysis.assessment.priority || 5;
      
      if (fuelStatus === 'critical') {
        healthScore -= 20;
        issues.push('CRITICAL fuel system deviation detected');
        priority_items.push({priority: 1, system: 'fuel', severity: 'critical'});
      } else if (fuelStatus === 'high_concern') {
        healthScore -= 15;
        issues.push('Significant fuel system concerns');
        priority_items.push({priority: 2, system: 'fuel', severity: 'high'});
      } else if (fuelStatus === 'warning') {
        healthScore -= 10;
        warnings.push('Fuel system adaptation concerns');
        priority_items.push({priority: 3, system: 'fuel', severity: 'warning'});
      } else if (fuelStatus === 'watch') {
        healthScore -= 5;
        warnings.push('Fuel system showing minor deviations');
        priority_items.push({priority: 4, system: 'fuel', severity: 'info'});
      }
    }

    // COMPOUND PENALTY FOR MULTIPLE SYSTEMS - Professional diagnostic approach
    const criticalSystems = priority_items.filter(item => item.priority <= 2).length;
    const warningSystems = priority_items.filter(item => item.priority === 3).length;
    
    if (criticalSystems >= 3) {
      const compoundPenalty = criticalSystems * 8;
      healthScore -= compoundPenalty;
      technician_notes.push(`Multiple critical systems affected - compound penalty: -${compoundPenalty} points`);
      issues.push('MULTIPLE CRITICAL SYSTEMS require immediate attention');
    } else if (criticalSystems >= 2) {
      const compoundPenalty = 10;
      healthScore -= compoundPenalty;
      technician_notes.push(`Multiple systems compromised - diagnostic complexity penalty: -${compoundPenalty} points`);
    }

    if (warningSystems >= 4) {
      const warningPenalty = warningSystems * 2;
      healthScore -= warningPenalty;
      technician_notes.push(`Multiple warning systems - preventive maintenance recommended: -${warningPenalty} points`);
    }

    // Ensure score doesn't go below 0
    healthScore = Math.max(0, Math.round(healthScore));

    // PROFESSIONAL RATING SCALE - More stringent for technicians
    let rating, diagnostic_priority, recommended_action;
    
    if (healthScore >= 95) {
      rating = 'Excellent';
      diagnostic_priority = 'routine';
      recommended_action = 'Continue normal maintenance schedule';
    } else if (healthScore >= 85) {
      rating = 'Good';
      diagnostic_priority = 'routine';
      recommended_action = 'Minor attention items - schedule during next service';
    } else if (healthScore >= 75) {
      rating = 'Fair';
      diagnostic_priority = 'moderate';
      recommended_action = 'Schedule diagnostic evaluation within 1-2 weeks';
    } else if (healthScore >= 60) {
      rating = 'Poor';
      diagnostic_priority = 'high';
      recommended_action = 'Schedule diagnostic appointment this week';
    } else if (healthScore >= 40) {
      rating = 'Critical';
      diagnostic_priority = 'urgent';
      recommended_action = 'Schedule immediate diagnostic evaluation';
    } else {
      rating = 'Failing';
      diagnostic_priority = 'emergency';
      recommended_action = 'IMMEDIATE professional diagnosis required - potential safety concern';
    }

    return {
      score: healthScore,
      rating,
      diagnostic_priority,
      recommended_action,
      issues,
      warnings,
      technician_notes,
      priority_items: priority_items.sort((a, b) => a.priority - b.priority),
      systems_affected: priority_items.length,
      critical_systems_count: criticalSystems,
      professional_assessment: {
        immediate_action_required: criticalSystems > 0,
        preventive_maintenance_due: warningSystems >= 2,
        system_degradation_trend: healthScore < 80 ? 'declining' : 'stable'
      }
    };
  }

  assessAllSystems(analysis) {
    return {
      engine: this.assessSystem('engine', analysis),
      fuel: this.assessSystem('fuel', analysis),
      emission: this.assessSystem('emission', analysis),
      electrical: this.assessSystem('electrical', analysis),
      cooling: this.assessSystem('cooling', analysis)
    };
  }

  assessSystem(system, analysis) {
    const assessment = {
      status: 'Good',
      score: 100,
      findings: []
    };

    switch(system) {
      case 'engine':
        if (analysis.detailed?.engineHealth) {
          assessment.score = analysis.detailed.engineHealth.score || 100;
          assessment.status = assessment.score > 80 ? 'Good' : assessment.score > 60 ? 'Fair' : 'Poor';
          assessment.findings = analysis.detailed.engineHealth.issues || [];
        }
        break;

      case 'fuel':
        if (analysis.detailed?.fuelSystem?.fuelTrimAnalysis?.assessment?.status === 'needs_attention') {
          assessment.score = 70;
          assessment.status = 'Fair';
          assessment.findings.push('Fuel trim adjustment required');
        }
        break;

      case 'emission':
        if (analysis.detailed?.emissionSystem?.catalystEfficiency) {
          const efficiency = analysis.detailed.emissionSystem.catalystEfficiency.estimatedEfficiency || 100;
          assessment.score = efficiency;
          assessment.status = efficiency > 80 ? 'Good' : efficiency > 60 ? 'Fair' : 'Poor';
          if (efficiency < 80) {
            assessment.findings.push(`Catalyst efficiency at ${efficiency}%`);
          }
        }
        break;

      case 'cooling':
        if (analysis.detailed?.temperatureAnalysis?.engineTempPattern) {
          const maxTemp = analysis.detailed.temperatureAnalysis.engineTempPattern.max;
          if (maxTemp > 220) {
            assessment.score = 80;
            assessment.status = 'Fair';
            assessment.findings.push('High engine temperatures detected');
          }
        }
        break;
    }

    return assessment;
  }

  async getHistoricalComparison(vehicleId, currentSessionId) {
    try {
      const { DiagnosticSession, OBD2DataPoint } = this.getModels();

      // Get recent sessions for the same vehicle
      const recentSessions = await DiagnosticSession.find({
        vehicleId: vehicleId,
        _id: { $ne: currentSessionId },
        status: 'completed'
      })
      .sort({ startTime: -1 })
      .limit(5);

      if (recentSessions.length === 0) {
        return { message: 'No historical data available' };
      }

      // Analyze trends
      const trends = {
        sessions: recentSessions.length,
        oldestSession: recentSessions[recentSessions.length - 1].startTime,
        newestSession: recentSessions[0].startTime
      };

      // Get basic stats from each session
      const historicalStats = [];
      for (const session of recentSessions) {
        const stats = await OBD2DataPoint.aggregate([
          { $match: { sessionId: session._id } },
          {
            $group: {
              _id: null,
              avgRpm: { $avg: '$rpm' },
              avgSpeed: { $avg: '$speed' },
              avgEngineTemp: { $avg: '$engineTemp' },
              avgFuelTrim: { $avg: '$fuelTrimLongB1' }
            }
          }
        ]);

        if (stats.length > 0) {
          historicalStats.push({
            sessionId: session._id,
            date: session.startTime,
            stats: stats[0]
          });
        }
      }

      trends.data = historicalStats;
      trends.summary = this.summarizeHistoricalTrends(historicalStats);

      return trends;

    } catch (error) {
      console.error('Historical comparison error:', error);
      return { error: 'Could not retrieve historical data' };
    }
  }

  summarizeHistoricalTrends(historicalStats) {
    if (historicalStats.length < 2) {
      return { message: 'Insufficient data for trend analysis' };
    }

    const oldest = historicalStats[historicalStats.length - 1];
    const newest = historicalStats[0];

    const trends = {
      fuelTrim: {
        old: oldest.stats.avgFuelTrim,
        new: newest.stats.avgFuelTrim,
        change: newest.stats.avgFuelTrim - oldest.stats.avgFuelTrim,
        trend: Math.abs(newest.stats.avgFuelTrim - oldest.stats.avgFuelTrim) > 5 ? 'changing' : 'stable'
      },
      engineTemp: {
        old: oldest.stats.avgEngineTemp,
        new: newest.stats.avgEngineTemp,
        change: newest.stats.avgEngineTemp - oldest.stats.avgEngineTemp,
        trend: newest.stats.avgEngineTemp > oldest.stats.avgEngineTemp + 10 ? 'increasing' : 'stable'
      }
    };

    return trends;
  }

  formatSummaryReport(report) {
    return {
      vehicleId: report.vehicleInfo.vehicleId,
      reportDate: report.timestamp,
      overallHealth: report.overallHealth,
      systemsSummary: Object.entries(report.systems).map(([system, assessment]) => ({
        system: system,
        status: assessment.status,
        score: assessment.score
      })),
      keyFindings: this.extractKeyFindings(report),
      recommendations: this.generateReportRecommendations(report)
    };
  }

  formatDetailedReport(report, fullAnalysis) {
    const detailed = this.formatSummaryReport(report);

    detailed.detailedAnalysis = {
      driveStatistics: fullAnalysis.summary?.driveStatistics,
      performanceMetrics: fullAnalysis.detailed?.performanceMetrics,
      fuelEconomy: fullAnalysis.detailed?.fuelSystem,
      emissions: fullAnalysis.detailed?.emissionSystem,
      anomalies: fullAnalysis.anomalies
    };

    detailed.systemDetails = report.systems;

    if (report.historicalTrends) {
      detailed.historicalAnalysis = report.historicalTrends;
    }

    return detailed;
  }

  formatTechnicianReport(report, fullAnalysis) {
    const tech = this.formatDetailedReport(report, fullAnalysis);

    // Add technical diagnostic data
    tech.diagnosticData = {
      sensorReadings: this.extractSensorReadings(fullAnalysis),
      dtcReadiness: this.checkDTCReadiness(fullAnalysis),
      pidData: this.extractPIDData(fullAnalysis),
      freezeFrameData: this.extractFreezeFrameData(fullAnalysis)
    };

    // Add repair recommendations with part numbers if applicable
    tech.repairRecommendations = this.generateRepairRecommendations(report, fullAnalysis);

    return tech;
  }

  extractKeyFindings(report) {
    const findings = [];

    // Extract issues from overall health
    findings.push(...report.overallHealth.issues);

    // Extract system-specific findings
    Object.entries(report.systems).forEach(([system, assessment]) => {
      if (assessment.findings.length > 0) {
        assessment.findings.forEach(finding => {
          if (typeof finding === 'object') {
            findings.push(`${system}: ${finding.description || finding}`);
          } else {
            findings.push(`${system}: ${finding}`);
          }
        });
      }
    });

    return findings;
  }

  generateReportRecommendations(report) {
    const recommendations = [];

    if (report.overallHealth.score < 70) {
      recommendations.push({
        priority: 'high',
        action: 'Schedule comprehensive diagnostic check',
        reason: 'Multiple systems showing degraded performance'
      });
    }

    // System-specific recommendations
    Object.entries(report.systems).forEach(([system, assessment]) => {
      if (assessment.score < 80) {
        recommendations.push({
          priority: assessment.score < 60 ? 'high' : 'medium',
          action: `Inspect ${system} system`,
          reason: assessment.findings.join(', ')
        });
      }
    });

    return recommendations;
  }

  extractSensorReadings(analysis) {
    // Extract current sensor readings from the analysis
    return {
      o2Sensors: analysis.detailed?.emissionSystem?.o2SensorHealth,
      temperatures: analysis.detailed?.temperatureAnalysis,
      pressures: {
        fuel: analysis.detailed?.fuelSystem?.fuelPressure,
        barometric: analysis.summary?.averages?.barometricPressure
      }
    };
  }

  checkDTCReadiness(analysis) {
    // Simulate DTC readiness monitors
    return {
      catalyst: 'Ready',
      heatedCatalyst: 'Ready',
      evaporativeSystem: 'Ready',
      secondaryAirSystem: 'Not Applicable',
      oxygenSensor: 'Ready',
      oxygenSensorHeater: 'Ready',
      egrSystem: 'Ready',
      misfire: 'Ready'
    };
  }

  extractPIDData(analysis) {
    // Extract relevant PID data
    return {
      calculatedLoad: analysis.summary?.averages?.engineLoad,
      coolantTemp: analysis.summary?.averages?.engineTemp,
      fuelSystemStatus: 'Closed Loop',
      fuelPressure: analysis.detailed?.fuelSystem?.fuelPressure?.average,
      intakeManifoldPressure: analysis.summary?.averages?.map,
      engineRPM: analysis.summary?.averages?.rpm,
      vehicleSpeed: analysis.summary?.averages?.speed,
      timingAdvance: 'N/A',
      intakeAirTemp: analysis.summary?.averages?.intakeTemp
    };
  }

  extractFreezeFrameData(analysis) {
    // Simulate freeze frame data
    return {
      dtcStored: 'None',
      conditions: {
        engineLoad: analysis.summary?.maximums?.engineLoad,
        engineTemp: analysis.summary?.averages?.engineTemp,
        rpm: analysis.summary?.averages?.rpm,
        speed: analysis.summary?.averages?.speed,
        runtime: analysis.sessionInfo?.duration
      }
    };
  }

  generateRepairRecommendations(report, analysis) {
    const repairs = [];

    // Generate specific repair recommendations based on findings
    if (report.systems.emission.score < 70) {
      repairs.push({
        component: 'Catalytic Converter',
        action: 'Test and possibly replace',
        estimatedCost: '$500-$2000',
        urgency: 'High',
        notes: 'Low catalyst efficiency detected'
      });
    }

    if (report.systems.fuel.score < 80) {
      repairs.push({
        component: 'Fuel System',
        action: 'Clean fuel injectors, check fuel pressure',
        estimatedCost: '$150-$400',
        urgency: 'Medium',
        notes: 'Fuel trim values indicate mixture issue'
      });
    }

    return repairs;
  }

  async detectAnomalies(params) {
    try {
      const { sessionId, sensitivity = 'medium', parameters } = params;
      const { DiagnosticSession, OBD2DataPoint } = this.getModels();

      const dataPoints = await OBD2DataPoint.find({
        sessionId: new mongoose.Types.ObjectId(sessionId)
      }).sort({ timestamp: 1 });

      if (dataPoints.length === 0) {
        return {
          success: false,
          message: 'No data points found for anomaly detection'
        };
      }

      // Set thresholds based on sensitivity
      const thresholds = this.getAnomalyThresholds(sensitivity);

      // Detect anomalies
      const anomalies = this.detectDataAnomalies(dataPoints, thresholds, parameters);

      // Analyze patterns
      const patterns = this.analyzeAnomalyPatterns(anomalies);

      return {
        success: true,
        anomalies: anomalies,
        patterns: patterns,
        summary: {
          totalAnomalies: anomalies.count,
          criticalAnomalies: anomalies.anomalies.filter(a => a.severity === 'critical').length,
          affectedSystems: Object.keys(anomalies.summary || {})
        }
      };

    } catch (error) {
      console.error('Anomaly detection error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  getAnomalyThresholds(sensitivity) {
    const thresholds = {
      low: {
        temperatureRange: 30,
        rpmVariance: 200,
        voltageRange: 0.3,
        pressureVariance: 10
      },
      medium: {
        temperatureRange: 20,
        rpmVariance: 100,
        voltageRange: 0.2,
        pressureVariance: 5
      },
      high: {
        temperatureRange: 10,
        rpmVariance: 50,
        voltageRange: 0.1,
        pressureVariance: 2
      }
    };

    return thresholds[sensitivity];
  }

  analyzeAnomalyPatterns(anomalies) {
    const patterns = {
      timeClustering: this.findTimeClusters(anomalies.anomalies),
      parameterCorrelation: this.findParameterCorrelations(anomalies.anomalies),
      recurringIssues: this.findRecurringPatterns(anomalies.anomalies)
    };

    return patterns;
  }

  findTimeClusters(anomalies) {
    // Group anomalies that occur close together in time
    const clusters = [];
    const timeThreshold = 60000; // 1 minute

    let currentCluster = null;

    anomalies.forEach(anomaly => {
      if (!currentCluster ||
          anomaly.timestamp - currentCluster.endTime > timeThreshold) {
        currentCluster = {
          startTime: anomaly.timestamp,
          endTime: anomaly.timestamp,
          anomalies: [anomaly]
        };
        clusters.push(currentCluster);
      } else {
        currentCluster.endTime = anomaly.timestamp;
        currentCluster.anomalies.push(anomaly);
      }
    });

    return clusters.filter(c => c.anomalies.length > 1);
  }

  findParameterCorrelations(anomalies) {
    // Find which parameters tend to have anomalies together
    const correlations = {};

    anomalies.forEach(anomaly => {
      if (!correlations[anomaly.parameter]) {
        correlations[anomaly.parameter] = {};
      }

      // Look for other anomalies within 10 seconds
      anomalies.forEach(other => {
        if (other.parameter !== anomaly.parameter &&
            Math.abs(other.timestamp - anomaly.timestamp) < 10000) {
          correlations[anomaly.parameter][other.parameter] =
            (correlations[anomaly.parameter][other.parameter] || 0) + 1;
        }
      });
    });

    return correlations;
  }

  findRecurringPatterns(anomalies) {
    // Identify patterns that repeat
    const patterns = {};

    anomalies.forEach(anomaly => {
      const key = `${anomaly.parameter}_${anomaly.type}`;
      if (!patterns[key]) {
        patterns[key] = {
          count: 0,
          instances: []
        };
      }
      patterns[key].count++;
      patterns[key].instances.push(anomaly.timestamp);
    });

    // Filter to only recurring patterns
    return Object.fromEntries(
      Object.entries(patterns).filter(([_, data]) => data.count > 2)
    );
  }
}

export default OBD2AnalysisService;
