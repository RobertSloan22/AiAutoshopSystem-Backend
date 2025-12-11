/**
 * IntervalAnalysisService - Manages real-time interval-based OBD2 analysis
 *
 * Analysis Intervals:
 * - 30 seconds: Quick anomaly detection and out-of-bounds alerts
 * - 3 minutes: Mid-session overview with trend analysis
 * - Final: Comprehensive analysis when session stream ends
 */

import mongoose from 'mongoose';
import OBD2DataAccessTool from '../obd2-code-interpreter/tools/OBD2DataAccessTool.js';
import OBD2AnalysisAgent from '../obd2-code-interpreter/agents/OBD2AnalysisAgent.js';
import Analysis from '../models/analysis.model.js';

class IntervalAnalysisService {
  constructor(OBD2DataPoint, DiagnosticSession, openAIInterface) {
    this.OBD2DataPoint = OBD2DataPoint;
    this.DiagnosticSession = DiagnosticSession;
    this.Analysis = Analysis;
    this.openAIInterface = openAIInterface;

    // Track active session intervals
    this.activeIntervals = new Map(); // sessionId -> { timers, lastAnalysis }

    // Analysis configurations for different intervals
    this.intervalConfigs = {
      quick_check: {
        interval: 30000, // 30 seconds
        analysisType: 'anomaly_detection',
        reasoningEffort: 'low',
        description: 'Quick anomaly detection and out-of-bounds alerts'
      },
      mid_session: {
        interval: 180000, // 180 seconds (3 minutes)
        analysisType: 'quick_overview',
        reasoningEffort: 'medium',
        description: 'Mid-session overview with trend analysis'
      }
    };
  }

  /**
   * Start interval analysis for a session
   */
  async startIntervalAnalysis(sessionId) {
    console.log(`📊 [INTERVAL] Starting interval analysis for session ${sessionId}`);

    // Verify session exists and is active
    const session = await this.DiagnosticSession.findById(sessionId);
    if (!session || session.status !== 'active') {
      console.log(`⚠️  [INTERVAL] Session ${sessionId} not active, skipping interval analysis`);
      return;
    }

    // Initialize interval tracking
    const intervalData = {
      timers: {},
      lastAnalysis: {},
      sessionStartTime: new Date()
    };

    // Set up all interval timers
    for (const [key, config] of Object.entries(this.intervalConfigs)) {
      intervalData.timers[key] = setTimeout(
        () => this.runIntervalAnalysis(sessionId, key, config),
        config.interval
      );
      console.log(`⏰ [INTERVAL] Scheduled ${key} analysis for session ${sessionId} in ${config.interval}ms`);
    }

    this.activeIntervals.set(sessionId, intervalData);
  }

  /**
   * Stop interval analysis for a session
   */
  stopIntervalAnalysis(sessionId) {
    const intervalData = this.activeIntervals.get(sessionId);
    if (!intervalData) return;

    console.log(`🛑 [INTERVAL] Stopping interval analysis for session ${sessionId}`);

    // Clear all timers
    for (const timer of Object.values(intervalData.timers)) {
      if (timer) clearTimeout(timer);
    }

    this.activeIntervals.delete(sessionId);
  }

  /**
   * Run analysis at a specific interval
   */
  async runIntervalAnalysis(sessionId, intervalKey, config) {
    const startTime = Date.now();
    console.log(`🔍 [INTERVAL:${intervalKey}] Starting ${config.description} for session ${sessionId}`);

    try {
      // Verify session is still active
      const session = await this.DiagnosticSession.findById(sessionId);
      if (!session || session.status !== 'active') {
        console.log(`⚠️  [INTERVAL:${intervalKey}] Session no longer active, skipping analysis`);
        this.stopIntervalAnalysis(sessionId);
        return;
      }

      // Get data point count to verify we have data
      const dataPointCount = await this.OBD2DataPoint.countDocuments({
        sessionId: new mongoose.Types.ObjectId(sessionId)
      });

      if (dataPointCount === 0) {
        console.log(`⚠️  [INTERVAL:${intervalKey}] No data points yet, skipping analysis`);
        return;
      }

      console.log(`📊 [INTERVAL:${intervalKey}] Found ${dataPointCount} data points`);

      // Load data into Docker container
      const dataAccessTool = new OBD2DataAccessTool(this.OBD2DataPoint, this.DiagnosticSession);
      const dataContextRaw = await dataAccessTool.run({ sessionId });

      const dataResult = JSON.parse(dataContextRaw);
      if (!dataResult.success) {
        throw new Error(dataResult.error || 'Failed to load OBD2 data');
      }

      // Create analysis agent with appropriate reasoning effort
      const analysisAgent = new OBD2AnalysisAgent(this.openAIInterface, config.reasoningEffort);
      analysisAgent.addContext(dataContextRaw);

      // Generate analysis question based on interval type
      const question = this.generateAnalysisQuestion(intervalKey, config.analysisType, dataPointCount);

      // Run analysis
      const analysisResult = await analysisAgent.task(question);

      // Extract plots from agent's preserved plot storage
      // NOTE: Plots are now stored separately to prevent context overflow
      const plots = analysisAgent.generatedPlots || [];
      console.log(`📊 [INTERVAL:${intervalKey}] Generated ${plots.length} visualization(s)`);

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      // Generate unique analysis ID
      const analysisId = Analysis.generateAnalysisId();

      // Store interval analysis in Analysis collection with raw data
      const analysisDoc = new Analysis({
        analysisId: analysisId,
        sessionId: new mongoose.Types.ObjectId(sessionId),
        analysisType: config.analysisType,
        timestamp: new Date(),
        status: 'completed',
        duration: parseFloat(duration),
        result: analysisResult,
        plots: plots.map(plot => {
          // Extract parameters from plot description or filename
          const parameters = this.extractParametersFromPlot(plot, intervalData);
          
          return {
            filename: plot.filename || `${intervalKey}_plot_${Date.now()}.png`,
            base64: plot.base64,
            mimeType: plot.mimeType || 'image/png',
            description: plot.description || `${intervalKey} analysis visualization`,
            rawData: this.processIntervalDataForFrontend(intervalData, parameters, intervalKey),
            plotMetadata: {
              plotType: this.inferPlotType(plot, intervalKey),
              axes: this.generateAxesInfo(parameters, intervalKey),
              colors: this.generatePlotColors(parameters),
              interactive: true
            }
          };
        }),
        context: {
          dataPointCount: dataPointCount,
          timeRange: {
            start: session.startTime,
            end: new Date()
          },
          dtcCodes: session.dtcCodes || [],
          vehicleInfo: session.vehicleInfo || {}
        },
        modelInfo: {
          model: 'o3-mini',
          reasoningEffort: config.reasoningEffort
        },
        tags: [config.analysisType, 'interval_analysis', intervalKey]
      });

      await analysisDoc.save();
      console.log(`✅ [INTERVAL:${intervalKey}] Saved analysis with ID: ${analysisId}`);

      // Store interval analysis result in session (for backwards compatibility)
      const updateData = {
        [`intervalAnalysis.${intervalKey}`]: {
          timestamp: new Date(),
          analysisType: config.analysisType,
          analysisId: analysisId,  // Link to Analysis document
          result: analysisResult,
          plots: plots,
          duration: parseFloat(duration),
          dataPointCount: dataPointCount
        }
      };

      await this.DiagnosticSession.findByIdAndUpdate(sessionId, updateData);

      console.log(`✅ [INTERVAL:${intervalKey}] Analysis completed in ${duration}s`);

      // Update tracking
      const intervalData = this.activeIntervals.get(sessionId);
      if (intervalData) {
        intervalData.lastAnalysis[intervalKey] = new Date();
      }

    } catch (error) {
      console.error(`❌ [INTERVAL:${intervalKey}] Analysis failed:`, error);

      // Store error in session
      await this.DiagnosticSession.findByIdAndUpdate(sessionId, {
        [`intervalAnalysis.${intervalKey}`]: {
          timestamp: new Date(),
          error: error.message,
          status: 'failed'
        }
      });
    }
  }

  /**
   * Generate analysis question based on interval type
   */
  generateAnalysisQuestion(intervalKey, analysisType, dataPointCount) {
    const questions = {
      quick_check: `QUICK ANOMALY CHECK (30-second interval):

You have ${dataPointCount} data points collected so far. Perform a rapid check for:
1. Any parameters currently OUT OF BOUNDS (flag these as ALERTS)
2. Critical sensor readings (engine temp, RPM spikes, voltage issues)
3. Immediate concerns that need attention

VISUALIZATION REQUIREMENT:
Create ONE comprehensive multi-panel PNG dashboard (figsize=(18, 10)) with 4-6 subplots showing:
- Subplot 1: RPM & Speed (dual axis)
- Subplot 2: Engine Temperature with normal range highlighting
- Subplot 3: Fuel Trims (Short & Long Term)
- Subplot 4: Throttle Position & Engine Load
- Subplot 5: Battery Voltage
- Subplot 6: O2 Sensor readings (if available)

Use plt.subplot(2, 3, n) for 6-panel layout.
Highlight ANY out-of-bounds values with RED markers or zones.
Use green fill_between() for normal operating ranges.
Add reference lines (axhline) for critical thresholds.
Save as: 'quick_check_anomaly_dashboard_[timestamp].png'

Be concise and focus on ALERTS. Format response as:
⚠️ ALERTS: [list any out-of-bounds parameters]
✅ NORMAL: [list parameters in normal range]`,

      mid_session: `MID-SESSION OVERVIEW (3-minute interval):

You have ${dataPointCount} data points collected. Provide a comprehensive health overview:
1. Overall vehicle status
2. Developing trends and patterns
3. Key metrics summary (avg RPM, temp, speed, fuel efficiency, etc.)
4. Any warnings or concerns
5. System-by-system status (engine, fuel, emissions, cooling, electrical)

VISUALIZATION REQUIREMENT:
Create ONE comprehensive multi-panel PNG dashboard (figsize=(20, 14)) with 6-9 subplots showing:
- Engine Performance: RPM, Speed, Throttle, Load (2-3 subplots)
- Temperature Systems: Engine Temp, Intake Temp trends (1 subplot)
- Fuel System: Fuel Trims, MAF, Fuel Pressure (2 subplots)
- Emissions: O2 Sensors, Catalyst temps (1-2 subplots)
- Electrical: Battery voltage over time (1 subplot)
- Air Flow: MAF vs MAP correlation (1 subplot)

Use plt.subplot(3, 3, n) for 9-panel layout.
Include trend lines or moving averages.
Color-code by health status (green=good, yellow=warning, red=critical).
Add statistical summaries in plot titles (e.g., "Avg: 2500 RPM").
Save as: 'mid_session_overview_dashboard_[timestamp].png'

Provide actionable insights and recommendations with system health scores.`
    };

    return questions[intervalKey] || questions.quick_check;
  }

  /**
   * Extract OBD2 parameters from plot data
   */
  extractParametersFromPlot(plot, intervalData) {
    // Common OBD2 parameters to look for
    const obd2Parameters = ['rpm', 'speed', 'engineTemp', 'intakeTemp', 'throttlePosition', 
                           'engineLoad', 'fuelLevel', 'batteryVoltage', 'maf', 'map', 
                           'fuelTrimShortB1', 'fuelTrimLongB1', 'o2B1S1Voltage'];
    
    // If interval data is available, find parameters with actual data
    if (intervalData && Array.isArray(intervalData)) {
      const availableParams = [];
      intervalData.forEach(dataPoint => {
        Object.keys(dataPoint).forEach(key => {
          if (obd2Parameters.includes(key) && dataPoint[key] !== null && dataPoint[key] !== undefined) {
            if (!availableParams.includes(key)) {
              availableParams.push(key);
            }
          }
        });
      });
      return availableParams.slice(0, 8); // Limit to 8 parameters for performance
    }
    
    // Fallback: detect parameters from plot filename/description
    const description = (plot.description || plot.filename || '').toLowerCase();
    const detectedParams = obd2Parameters.filter(param => 
      description.includes(param.toLowerCase()) || 
      description.includes(param.replace(/([A-Z])/g, '_$1').toLowerCase())
    );
    
    return detectedParams.length > 0 ? detectedParams : ['rpm', 'speed', 'engineTemp', 'throttlePosition'];
  }

  /**
   * Process interval data for frontend Chart.js compatibility
   */
  processIntervalDataForFrontend(intervalData, parameters, intervalKey) {
    if (!intervalData || !Array.isArray(intervalData) || intervalData.length === 0) {
      return { datasets: [], labels: [], parameters: [], dataRange: {}, chartConfig: {} };
    }

    const datasets = [];
    const labels = intervalData.map(point => point.timestamp || point.createdAt || new Date());
    const startTime = new Date(Math.min(...labels));
    const endTime = new Date(Math.max(...labels));

    parameters.forEach((param, index) => {
      const dataValues = intervalData.map(point => {
        const value = point[param];
        return (value !== null && value !== undefined) ? parseFloat(value) : null;
      }).filter(val => val !== null);

      if (dataValues.length > 0) {
        datasets.push({
          label: this.formatParameterLabel(param),
          data: intervalData.map(point => ({
            x: point.timestamp || point.createdAt,
            y: point[param]
          })),
          parameter: param,
          unit: this.getParameterUnit(param),
          color: this.getParameterColor(param, index),
          borderColor: this.getParameterColor(param, index),
          backgroundColor: this.getParameterColor(param, index) + '20',
          fill: false
        });
      }
    });

    return {
      datasets,
      labels,
      parameters,
      dataRange: {
        startTime,
        endTime,
        totalPoints: intervalData.length
      },
      chartConfig: {
        type: 'line',
        responsive: true,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        scales: {
          x: {
            type: 'time',
            time: {
              unit: 'second',
              displayFormats: {
                second: 'HH:mm:ss'
              }
            },
            title: {
              display: true,
              text: 'Time'
            }
          },
          y: {
            beginAtZero: false,
            title: {
              display: true,
              text: 'Value'
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: `${intervalKey.toUpperCase()} Analysis - OBD2 Parameters`
          },
          legend: {
            display: true,
            position: 'top'
          }
        }
      }
    };
  }

  /**
   * Infer plot type from content and interval
   */
  inferPlotType(plot, intervalKey) {
    const description = (plot.description || plot.filename || '').toLowerCase();
    
    if (description.includes('correlation') || description.includes('scatter')) {
      return 'scatter';
    } else if (description.includes('histogram') || description.includes('distribution')) {
      return 'histogram';
    } else if (description.includes('anomaly') || description.includes('alert')) {
      return 'anomaly';
    } else if (description.includes('dashboard') || intervalKey === 'mid_session') {
      return 'dashboard';
    }
    
    return 'time_series';
  }

  /**
   * Generate axes information for plots
   */
  generateAxesInfo(parameters, intervalKey) {
    const primaryParam = parameters[0] || 'value';
    return {
      x: { 
        label: 'Time', 
        unit: '', 
        type: 'datetime' 
      },
      y: { 
        label: parameters.length > 1 ? 'Multiple Parameters' : this.formatParameterLabel(primaryParam),
        unit: parameters.length === 1 ? this.getParameterUnit(primaryParam) : 'Mixed Units',
        type: 'linear' 
      }
    };
  }

  /**
   * Generate plot colors for parameters
   */
  generatePlotColors(parameters) {
    return parameters.map((param, index) => this.getParameterColor(param, index));
  }

  /**
   * Format parameter names for display
   */
  formatParameterLabel(parameter) {
    const labelMap = {
      rpm: 'Engine RPM',
      speed: 'Vehicle Speed',
      engineTemp: 'Engine Temperature',
      intakeTemp: 'Intake Air Temperature',
      throttlePosition: 'Throttle Position',
      engineLoad: 'Engine Load',
      fuelLevel: 'Fuel Level',
      batteryVoltage: 'Battery Voltage',
      maf: 'Mass Air Flow',
      map: 'Manifold Pressure',
      fuelTrimShortB1: 'Short Term Fuel Trim B1',
      fuelTrimLongB1: 'Long Term Fuel Trim B1',
      o2B1S1Voltage: 'O2 Sensor B1S1'
    };
    return labelMap[parameter] || parameter.charAt(0).toUpperCase() + parameter.slice(1);
  }

  /**
   * Get parameter units
   */
  getParameterUnit(parameter) {
    const units = {
      rpm: 'RPM',
      speed: 'km/h',
      engineTemp: '°C',
      intakeTemp: '°C',
      throttlePosition: '%',
      engineLoad: '%',
      fuelLevel: '%',
      batteryVoltage: 'V',
      maf: 'g/s',
      map: 'kPa',
      fuelTrimShortB1: '%',
      fuelTrimLongB1: '%',
      o2B1S1Voltage: 'V'
    };
    return units[parameter] || '';
  }

  /**
   * Get parameter colors
   */
  getParameterColor(parameter, index) {
    const colorMap = {
      rpm: '#3b82f6',           // Blue
      speed: '#10b981',         // Green
      engineTemp: '#ef4444',    // Red
      intakeTemp: '#f59e0b',    // Yellow
      throttlePosition: '#8b5cf6', // Purple
      engineLoad: '#06b6d4',    // Cyan
      fuelLevel: '#84cc16',     // Lime
      batteryVoltage: '#f97316', // Orange
      maf: '#ec4899',           // Pink
      map: '#6366f1',           // Indigo
      fuelTrimShortB1: '#14b8a6', // Teal
      fuelTrimLongB1: '#f43f5e', // Rose
      o2B1S1Voltage: '#a855f7'  // Violet
    };
    const defaultColors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'];
    return colorMap[parameter] || defaultColors[index % defaultColors.length];
  }

  /**
   * Extract plots from agent's message history
   */
  extractPlotsFromAgent(agent) {
    const plots = [];

    for (const message of agent.messages) {
      if (message.role === 'tool' && message.content) {
        try {
          const toolResult = JSON.parse(message.content);
          if (toolResult.plots && Array.isArray(toolResult.plots)) {
            plots.push(...toolResult.plots);
          }
        } catch (e) {
          // Not JSON, skip
        }
      }
    }

    return plots;
  }

  /**
   * Get interval analysis results for a session
   */
  async getIntervalAnalysisResults(sessionId) {
    const session = await this.DiagnosticSession.findById(sessionId).lean();
    if (!session) {
      return { error: 'Session not found' };
    }

    return {
      sessionId: session._id,
      intervalAnalysis: session.intervalAnalysis || {},
      autoAnalysis: session.autoAnalysis || {}
    };
  }

  /**
   * Check if session needs interval analysis triggered
   * (Called from data ingestion endpoint)
   */
  shouldTriggerAnalysis(sessionId, sessionStartTime) {
    const elapsed = Date.now() - new Date(sessionStartTime).getTime();
    const intervalData = this.activeIntervals.get(sessionId);

    // If no tracking exists, start it
    if (!intervalData) {
      this.startIntervalAnalysis(sessionId).catch(err => {
        console.error(`Failed to start interval analysis for session ${sessionId}:`, err);
      });
      return false;
    }

    return false; // Timers handle triggering automatically
  }
}

export default IntervalAnalysisService;
