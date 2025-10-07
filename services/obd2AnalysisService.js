import mongoose from 'mongoose';

class OBD2AnalysisService {
  constructor() {
    this.analysisTools = this.initializeAnalysisTools();
    // Models will be retrieved when needed to avoid circular dependency
    this.DiagnosticSession = null;
    this.OBD2DataPoint = null;
  }

  getModels() {
    if (!this.DiagnosticSession || !this.OBD2DataPoint) {
      // Get models from mongoose connection
      this.DiagnosticSession = mongoose.models.DiagnosticSession;
      this.OBD2DataPoint = mongoose.models.OBD2DataPoint;
    }
    return { DiagnosticSession: this.DiagnosticSession, OBD2DataPoint: this.OBD2DataPoint };
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
      const { DiagnosticSession, OBD2DataPoint } = this.getModels();

      if (!DiagnosticSession || !OBD2DataPoint) {
        throw new Error('Database models not available. Ensure the database is connected.');
      }

      // Get session data
      const session = await DiagnosticSession.findById(sessionId);
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      // Build query for data points
      let query = { sessionId: new mongoose.Types.ObjectId(sessionId) };
      if (timeRange?.start || timeRange?.end) {
        query.timestamp = {};
        if (timeRange.start) query.timestamp.$gte = new Date(timeRange.start);
        if (timeRange.end) query.timestamp.$lte = new Date(timeRange.end);
      }

      const dataPoints = await OBD2DataPoint.find(query).sort({ timestamp: 1 });

      if (dataPoints.length === 0) {
        return {
          success: false,
          message: 'No data points found for this session',
          sessionInfo: session
        };
      }

      // Perform analysis based on type
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
          analysis.summary = this.generateSummaryStats(dataPoints);
          break;
        case 'detailed':
          analysis.detailed = this.generateDetailedAnalysis(dataPoints);
          break;
        case 'anomalies':
          analysis.anomalies = this.detectDataAnomalies(dataPoints);
          break;
        case 'performance':
          analysis.performance = this.analyzePerformanceMetrics(dataPoints);
          break;
        case 'fuel_economy':
          analysis.fuelEconomy = this.analyzeFuelEconomy(dataPoints);
          break;
        case 'emissions':
          analysis.emissions = this.analyzeEmissions(dataPoints);
          break;
        case 'comprehensive':
          analysis.summary = this.generateSummaryStats(dataPoints);
          analysis.detailed = this.generateDetailedAnalysis(dataPoints);
          analysis.anomalies = this.detectDataAnomalies(dataPoints);
          analysis.performance = this.analyzePerformanceMetrics(dataPoints);
          analysis.fuelEconomy = this.analyzeFuelEconomy(dataPoints);
          analysis.emissions = this.analyzeEmissions(dataPoints);
          break;
      }

      return {
        success: true,
        analysis,
        recommendations: this.generateRecommendations(analysis, analysisType)
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
    const stats = {
      averages: {},
      maximums: {},
      minimums: {},
      ranges: {}
    };

    // Parameters to analyze
    const parameters = ['rpm', 'speed', 'engineTemp', 'throttlePosition', 'engineLoad', 'fuelRate'];

    parameters.forEach(param => {
      const values = dataPoints.map(dp => dp[param]).filter(v => v !== null && v !== undefined);
      if (values.length > 0) {
        stats.averages[param] = values.reduce((a, b) => a + b, 0) / values.length;
        stats.maximums[param] = Math.max(...values);
        stats.minimums[param] = Math.min(...values);
        stats.ranges[param] = stats.maximums[param] - stats.minimums[param];
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

    return stats;
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
      metrics: {}
    };

    // Check for high engine temperatures
    const highTempPoints = dataPoints.filter(dp => dp.engineTemp > 220);
    if (highTempPoints.length > 0) {
      health.score -= 10;
      health.issues.push({
        severity: 'warning',
        description: `Engine temperature exceeded 220°F ${highTempPoints.length} times`,
        recommendation: 'Check cooling system'
      });
    }

    // Check for rough idle
    const idlePoints = dataPoints.filter(dp => dp.speed === 0 && dp.rpm > 0);
    if (idlePoints.length > 10) {
      const rpmVariance = this.calculateVariance(idlePoints.map(dp => dp.rpm));
      if (rpmVariance > 100) {
        health.score -= 15;
        health.issues.push({
          severity: 'warning',
          description: 'High RPM variance detected at idle',
          recommendation: 'Check for vacuum leaks, dirty MAF sensor, or worn spark plugs'
        });
      }
    }

    // Check engine load patterns
    const highLoadPoints = dataPoints.filter(dp => dp.engineLoad > 80);
    health.metrics.highLoadPercentage = (highLoadPoints.length / dataPoints.length) * 100;

    return health;
  }

  detectDataAnomalies(dataPoints) {
    const anomalies = [];

    // Define normal ranges for parameters
    const normalRanges = {
      engineTemp: { min: 160, max: 220 },
      rpm: { min: 0, max: 6500 },
      o2Voltage: { min: 0.1, max: 0.9 },
      fuelTrim: { min: -25, max: 25 }
    };

    // Check for out-of-range values
    dataPoints.forEach((dp, index) => {
      // Engine temperature anomalies
      if (dp.engineTemp && (dp.engineTemp < normalRanges.engineTemp.min ||
          dp.engineTemp > normalRanges.engineTemp.max)) {
        anomalies.push({
          timestamp: dp.timestamp,
          parameter: 'engineTemp',
          value: dp.engineTemp,
          type: dp.engineTemp < normalRanges.engineTemp.min ? 'too_low' : 'too_high',
          severity: dp.engineTemp > 240 ? 'critical' : 'warning'
        });
      }

      // Sudden changes detection
      if (index > 0) {
        const prevDp = dataPoints[index - 1];
        const timeDiff = (dp.timestamp - prevDp.timestamp) / 1000; // seconds

        // Rapid RPM changes
        if (dp.rpm && prevDp.rpm && Math.abs(dp.rpm - prevDp.rpm) / timeDiff > 1000) {
          anomalies.push({
            timestamp: dp.timestamp,
            parameter: 'rpm',
            value: dp.rpm,
            previousValue: prevDp.rpm,
            type: 'rapid_change',
            changeRate: Math.abs(dp.rpm - prevDp.rpm) / timeDiff
          });
        }
      }
    });

    return {
      count: anomalies.length,
      anomalies: anomalies.slice(0, 50), // Limit to 50 most recent
      summary: this.summarizeAnomalies(anomalies)
    };
  }

  calculateVariance(values) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squareDiffs = values.map(value => Math.pow(value - mean, 2));
    return Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / values.length);
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

    // Generate recommendations based on analysis type and findings
    if (analysis.summary?.driveStatistics?.idlePercentage > 20) {
      recommendations.push({
        category: 'fuel_efficiency',
        priority: 'medium',
        message: 'High idle time detected',
        action: 'Consider turning off engine during long stops to save fuel'
      });
    }

    if (analysis.anomalies?.count > 10) {
      recommendations.push({
        category: 'maintenance',
        priority: 'high',
        message: 'Multiple sensor anomalies detected',
        action: 'Schedule diagnostic check to investigate sensor readings'
      });
    }

    return recommendations;
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

    if (Math.abs(avgShort) > 10 || Math.abs(avgLong) > 10) {
      return {
        status: 'needs_attention',
        message: 'Fuel trims indicate potential air/fuel mixture issue'
      };
    }

    return {
      status: 'normal',
      message: 'Fuel trims within normal range'
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

    // Deduct points for various issues
    if (analysis.detailed?.engineHealth?.score) {
      const engineScore = analysis.detailed.engineHealth.score;
      if (engineScore < 100) {
        healthScore -= (100 - engineScore) * 0.3;
        if (engineScore < 70) issues.push('Engine health concerns');
      }
    }

    if (analysis.anomalies?.count > 20) {
      healthScore -= 10;
      issues.push('Multiple sensor anomalies detected');
    }

    if (analysis.detailed?.emissionSystem?.catalystEfficiency?.status === 'poor') {
      healthScore -= 15;
      issues.push('Catalyst efficiency degraded');
    }

    if (analysis.detailed?.fuelSystem?.fuelTrimAnalysis?.assessment?.status === 'needs_attention') {
      healthScore -= 10;
      issues.push('Fuel system adjustment needed');
    }

    return {
      score: Math.max(0, Math.round(healthScore)),
      rating: healthScore > 85 ? 'Excellent' : healthScore > 70 ? 'Good' : healthScore > 55 ? 'Fair' : 'Poor',
      issues: issues
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