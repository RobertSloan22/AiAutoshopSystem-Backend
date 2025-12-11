// FastAgent-based OBD2 Analysis Service
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import DiagnosticSession from '../models/diagnosticSession.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default class FastAgentOBD2AnalysisService {
  constructor() {
    this.fastAgentPath = path.join(__dirname, '../fast-agent');
    this.analysisScriptPath = path.join(this.fastAgentPath, 'examples/data-analysis/analysis.py');
    this.workingDir = path.join(__dirname, '../temp/obd2-analysis');
  }

  async analyzeSession(sessionId, sessionData) {
    try {
      console.log(`🔄 Starting FastAgent analysis for session: ${sessionId}`);
      
      // 1. Prepare working directory and data
      await this.prepareAnalysisEnvironment(sessionId, sessionData);
      
      // 2. Execute FastAgent analysis
      const analysisResults = await this.runFastAgentAnalysis(sessionId);
      
      // 3. Process results and update session
      const processedResults = await this.processAnalysisResults(sessionId, analysisResults);
      
      // 4. Update diagnostic session with results
      await this.updateSessionWithResults(sessionId, processedResults);
      
      console.log(`✅ FastAgent analysis completed for session: ${sessionId}`);
      return processedResults;
      
    } catch (error) {
      console.error(`❌ FastAgent analysis failed for session ${sessionId}:`, error);
      throw error;
    }
  }

  async prepareAnalysisEnvironment(sessionId, sessionData) {
    // Create working directory
    const sessionWorkDir = path.join(this.workingDir, sessionId);
    await fs.mkdir(sessionWorkDir, { recursive: true });

    // Convert OBD2 data to CSV format for FastAgent
    const csvData = this.convertOBD2DataToCSV(sessionData);
    const csvPath = path.join(sessionWorkDir, 'obd2_session_data.csv');
    await fs.writeFile(csvPath, csvData);

    console.log(`📊 Prepared OBD2 data CSV: ${csvPath}`);
    return csvPath;
  }

  convertOBD2DataToCSV(sessionData) {
    if (!sessionData || !sessionData.length) {
      throw new Error('No session data provided for analysis');
    }

    // Extract unique column headers from data
    const allKeys = new Set();
    sessionData.forEach(point => {
      Object.keys(point).forEach(key => {
        if (key !== '_id' && key !== '__v' && key !== 'sessionId') {
          allKeys.add(key);
        }
      });
    });

    const headers = Array.from(allKeys);
    const csvLines = [headers.join(',')];

    // Convert data points to CSV rows
    sessionData.forEach(point => {
      const row = headers.map(header => {
        const value = point[header];
        if (value === null || value === undefined) return '';
        if (typeof value === 'object') return JSON.stringify(value);
        return value;
      });
      csvLines.push(row.join(','));
    });

    return csvLines.join('\n');
  }

  async runFastAgentAnalysis(sessionId) {
    const sessionWorkDir = path.join(this.workingDir, sessionId);
    
    return new Promise((resolve, reject) => {
      const pythonProcess = spawn('python3', [this.analysisScriptPath], {
        cwd: sessionWorkDir,
        env: {
          ...process.env,
          PYTHONPATH: this.fastAgentPath,
          OBD2_SESSION_ID: sessionId,
          ANALYSIS_MODE: 'obd2_diagnostic'
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
        console.log(`FastAgent Output: ${data.toString().trim()}`);
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
        console.error(`FastAgent Error: ${data.toString().trim()}`);
      });

      pythonProcess.on('close', (code) => {
        if (code === 0) {
          console.log('✅ FastAgent analysis completed successfully');
          resolve({ stdout, stderr, exitCode: code });
        } else {
          console.error(`❌ FastAgent analysis failed with code: ${code}`);
          reject(new Error(`FastAgent analysis failed: ${stderr}`));
        }
      });

      pythonProcess.on('error', (error) => {
        console.error('❌ Failed to spawn FastAgent process:', error);
        reject(error);
      });

      // Send analysis prompt to FastAgent
      const analysisPrompt = this.generateOBD2AnalysisPrompt();
      pythonProcess.stdin.write(analysisPrompt);
      pythonProcess.stdin.end();
    });
  }

  generateOBD2AnalysisPrompt() {
    return `
Analyze the OBD2 diagnostic data in the CSV file 'obd2_session_data.csv'. 

Please perform the following analysis:

1. **Data Overview**: Examine the structure and quality of the OBD2 data
2. **Engine Performance Analysis**: 
   - RPM patterns and anomalies
   - Engine load vs throttle position correlation
   - Temperature patterns (engine, intake, ambient)
3. **Fuel System Analysis**:
   - Fuel trim patterns (short-term and long-term)
   - Fuel pressure and flow analysis
   - Air-fuel ratio optimization insights
4. **Emissions Analysis**:
   - Oxygen sensor readings and patterns
   - EGR system performance
   - Secondary air system status
5. **System Health Assessment**:
   - Identify potential issues or failure patterns
   - Performance optimization opportunities
   - Diagnostic trouble indicators

Create meaningful visualizations for each analysis area and save them as PNG files:
- engine_performance.png
- fuel_system.png  
- emissions_analysis.png
- system_health_overview.png

Provide a comprehensive summary of findings with actionable diagnostic insights.
`;
  }

  async processAnalysisResults(sessionId, analysisResults) {
    const sessionWorkDir = path.join(this.workingDir, sessionId);
    
    // Look for generated plot files
    const plotFiles = await this.findGeneratedPlots(sessionWorkDir);
    
    // Process plots and convert to base64 or move to accessible location
    const plots = await this.processPlots(sessionId, plotFiles);
    
    // Extract insights from analysis output
    const insights = this.extractInsights(analysisResults.stdout);
    
    // Get session data for raw data pairing
    const sessionData = await this.getSessionData(sessionId);
    
    // Enhance plots with raw data for frontend access
    const enhancedPlots = await this.enhancePlotsWithRawData(plots, sessionData, sessionId);
    
    return {
      sessionId,
      analysisTimestamp: new Date(),
      plots: enhancedPlots,
      insights,
      rawOutput: analysisResults.stdout
    };
  }

  async findGeneratedPlots(workingDir) {
    const plots = [];
    
    try {
      const files = await fs.readdir(workingDir);
      const pngFiles = files.filter(file => file.endsWith('.png'));
      
      for (const pngFile of pngFiles) {
        const filePath = path.join(workingDir, pngFile);
        const stats = await fs.stat(filePath);
        
        plots.push({
          filename: pngFile,
          path: filePath,
          size: stats.size,
          created: stats.mtime
        });
      }
      
      console.log(`📈 Found ${plots.length} generated plots`);
      return plots;
      
    } catch (error) {
      console.error('❌ Error finding generated plots:', error);
      return [];
    }
  }

  async processPlots(sessionId, plotFiles) {
    const processedPlots = [];
    const plotsDir = path.join(__dirname, '../public/plots', sessionId);
    
    // Create plots directory
    await fs.mkdir(plotsDir, { recursive: true });
    
    for (const plot of plotFiles) {
      try {
        // Copy plot to public directory
        const publicPath = path.join(plotsDir, plot.filename);
        await fs.copyFile(plot.path, publicPath);
        
        // Generate accessible URL
        const plotUrl = `/plots/${sessionId}/${plot.filename}`;
        
        processedPlots.push({
          filename: plot.filename,
          url: plotUrl,
          localPath: publicPath,
          size: plot.size,
          created: plot.created
        });
        
        console.log(`📊 Processed plot: ${plot.filename} -> ${plotUrl}`);
        
      } catch (error) {
        console.error(`❌ Error processing plot ${plot.filename}:`, error);
      }
    }
    
    return processedPlots;
  }

  extractInsights(analysisOutput) {
    // Extract key insights from FastAgent output
    const insights = {
      summary: '',
      recommendations: [],
      issues: [],
      performance_metrics: {}
    };

    try {
      // Look for structured output patterns in the analysis
      const lines = analysisOutput.split('\n');
      let currentSection = null;
      
      lines.forEach(line => {
        const trimmed = line.trim();
        
        if (trimmed.includes('SUMMARY:') || trimmed.includes('Summary:')) {
          currentSection = 'summary';
        } else if (trimmed.includes('RECOMMENDATIONS:') || trimmed.includes('Recommendations:')) {
          currentSection = 'recommendations';
        } else if (trimmed.includes('ISSUES:') || trimmed.includes('Issues:')) {
          currentSection = 'issues';
        } else if (currentSection && trimmed) {
          switch (currentSection) {
            case 'summary':
              insights.summary += trimmed + ' ';
              break;
            case 'recommendations':
              if (trimmed.startsWith('-') || trimmed.startsWith('•')) {
                insights.recommendations.push(trimmed.substring(1).trim());
              }
              break;
            case 'issues':
              if (trimmed.startsWith('-') || trimmed.startsWith('•')) {
                insights.issues.push(trimmed.substring(1).trim());
              }
              break;
          }
        }
      });

      insights.summary = insights.summary.trim() || 'Analysis completed successfully';
      
    } catch (error) {
      console.error('❌ Error extracting insights:', error);
      insights.summary = 'Analysis completed with processing errors';
    }

    return insights;
  }

  async updateSessionWithResults(sessionId, results) {
    try {
      await DiagnosticSession.findByIdAndUpdate(sessionId, {
        analysisResults: results.insights,
        analysisTimestamp: results.analysisTimestamp,
        analysisType: 'fastagent_obd2',
        visualizations: results.plots,
        $push: {
          metadata: {
            fastagent_analysis: {
              completed: true,
              timestamp: results.analysisTimestamp,
              plots_generated: results.plots.length,
              insights_extracted: true,
              raw_data_included: results.plots.some(plot => plot.rawData && plot.rawData.datasets.length > 0)
            }
          }
        }
      });
      
      console.log(`✅ Updated session ${sessionId} with FastAgent results`);
      
    } catch (error) {
      console.error(`❌ Error updating session ${sessionId}:`, error);
      throw error;
    }
  }

  async getSessionData(sessionId) {
    try {
      const session = await DiagnosticSession.findById(sessionId);
      return session ? session.obd2Data : [];
    } catch (error) {
      console.error(`❌ Error fetching session data for ${sessionId}:`, error);
      return [];
    }
  }

  async enhancePlotsWithRawData(plots, sessionData, sessionId) {
    if (!sessionData || !Array.isArray(sessionData) || sessionData.length === 0) {
      console.log(`⚠️ No session data available for plot enhancement`);
      return plots;
    }

    return plots.map((plot, index) => {
      try {
        // Read plot image and convert to base64
        const imageBuffer = fs.readFileSync(plot.localPath);
        const base64Image = imageBuffer.toString('base64');

        // Extract parameters from plot filename
        const parameters = this.extractParametersFromPlotFile(plot.filename);
        
        // Process raw data for frontend
        const rawData = this.processRawDataForFrontend(sessionData, parameters);
        
        // Generate plot metadata
        const plotMetadata = {
          plotType: this.inferPlotTypeFromFilename(plot.filename),
          axes: {
            x: { label: 'Time', unit: '', type: 'datetime' },
            y: { label: parameters.join(', '), unit: 'Mixed', type: 'linear' }
          },
          colors: this.generateParameterColors(parameters),
          interactive: true
        };

        console.log(`📊 Enhanced plot ${plot.filename} with ${parameters.length} parameters and ${rawData.datasets.length} datasets`);

        return {
          filename: plot.filename,
          url: plot.url,
          base64: base64Image,
          mimeType: 'image/png',
          size: plot.size,
          created: plot.created,
          rawData,
          plotMetadata
        };
      } catch (error) {
        console.error(`❌ Error enhancing plot ${plot.filename}:`, error);
        return {
          ...plot,
          rawData: { datasets: [], labels: [], parameters: [], dataRange: {}, chartConfig: {} },
          plotMetadata: { plotType: 'time_series', axes: {}, colors: [], interactive: false }
        };
      }
    });
  }

  extractParametersFromPlotFile(filename) {
    const obd2Parameters = ['rpm', 'speed', 'engineTemp', 'intakeTemp', 'throttlePosition', 
                           'engineLoad', 'fuelLevel', 'batteryVoltage', 'maf', 'map', 
                           'fuelTrimShortB1', 'fuelTrimLongB1', 'o2B1S1Voltage'];
    
    const filenameLower = filename.toLowerCase();
    
    // Detect parameters from filename
    const detectedParams = obd2Parameters.filter(param => {
      return filenameLower.includes(param.toLowerCase()) || 
             filenameLower.includes(param.replace(/([A-Z])/g, '_$1').toLowerCase());
    });

    // Default parameters based on common FastAgent plot types
    if (detectedParams.length === 0) {
      if (filenameLower.includes('engine')) {
        return ['rpm', 'engineTemp', 'engineLoad'];
      } else if (filenameLower.includes('fuel')) {
        return ['fuelLevel', 'fuelTrimShortB1', 'maf'];
      } else if (filenameLower.includes('emission')) {
        return ['o2B1S1Voltage', 'fuelTrimShortB1'];
      } else if (filenameLower.includes('system') || filenameLower.includes('health')) {
        return ['rpm', 'speed', 'engineTemp', 'throttlePosition'];
      }
    }
    
    return detectedParams.length > 0 ? detectedParams : ['rpm', 'speed', 'engineTemp'];
  }

  inferPlotTypeFromFilename(filename) {
    const filenameLower = filename.toLowerCase();
    
    if (filenameLower.includes('dashboard') || filenameLower.includes('overview')) {
      return 'dashboard';
    } else if (filenameLower.includes('correlation') || filenameLower.includes('scatter')) {
      return 'scatter';
    } else if (filenameLower.includes('histogram') || filenameLower.includes('distribution')) {
      return 'histogram';
    } else if (filenameLower.includes('anomaly') || filenameLower.includes('health')) {
      return 'anomaly';
    }
    
    return 'time_series';
  }

  processRawDataForFrontend(sessionData, parameters) {
    if (!sessionData || !Array.isArray(sessionData) || sessionData.length === 0) {
      return { datasets: [], labels: [], parameters: [], dataRange: {}, chartConfig: {} };
    }

    const datasets = [];
    const labels = sessionData.map(point => point.timestamp || point.createdAt || new Date());
    const startTime = new Date(Math.min(...labels));
    const endTime = new Date(Math.max(...labels));

    parameters.forEach((param, index) => {
      const dataValues = sessionData.map(point => {
        const value = point[param];
        return (value !== null && value !== undefined) ? parseFloat(value) : null;
      }).filter(val => val !== null);

      if (dataValues.length > 0) {
        datasets.push({
          label: this.formatParameterLabel(param),
          data: sessionData.map(point => ({
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
        totalPoints: sessionData.length
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
            text: 'FastAgent OBD2 Analysis - Real-time Parameters'
          },
          legend: {
            display: true,
            position: 'top'
          }
        }
      }
    };
  }

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

  generateParameterColors(parameters) {
    return parameters.map((param, index) => this.getParameterColor(param, index));
  }

  async cleanup(sessionId) {
    try {
      const sessionWorkDir = path.join(this.workingDir, sessionId);
      await fs.rm(sessionWorkDir, { recursive: true, force: true });
      console.log(`🧹 Cleaned up analysis workspace for session: ${sessionId}`);
    } catch (error) {
      console.error(`❌ Error cleaning up session ${sessionId}:`, error);
    }
  }
}