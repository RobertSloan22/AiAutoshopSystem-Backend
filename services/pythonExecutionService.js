import { spawn } from 'child_process';
import axios from 'axios';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';
import WebSocket from 'ws';
import { registerImage } from '../routes/images.js';
import Plot from '../models/plot.model.js';
import OBD2Data from '../models/obd2Data.model.js';
import mongoose from 'mongoose';
import os from 'os';

class PythonExecutionService {
  constructor() {
    this.pythonServerUrl = process.env.PYTHON_SERVER_URL || 'http://localhost:8000';
    this.pythonServerWsUrl = process.env.PYTHON_SERVER_WS_URL || 'ws://localhost:8000';
    this.isConnected = false;
    this.executionResults = new Map();
    // Use OS temp directory for cross-platform compatibility
    this.outputDir = path.join(os.tmpdir(), 'python_outputs');
    this.initializeService();
  }

  async initializeService() {
    try {
      // Create output directory if it doesn't exist
      await fs.mkdir(this.outputDir, { recursive: true });
      
      // Check connection to Python server
      await this.checkConnection();
    } catch (error) {
      console.error('Failed to initialize Python execution service:', error);
    }
  }

  async checkConnection() {
    try {
      const response = await axios.get(`${this.pythonServerUrl}/health`, { timeout: 5000 });
      this.isConnected = response.status === 200;
      console.log('Python server connection status:', this.isConnected);
    } catch (error) {
      console.log('Python server not available:', error.message);
      this.isConnected = false;
    }
  }

  // Tool definition for OpenAI function calling
  getToolDefinition() {
    return {
      type: 'function',
      function: {
        name: 'execute_python_code',
        description: 'Execute Python code in a secure environment with access to data analysis libraries (pandas, numpy, matplotlib, seaborn). Can perform calculations, data analysis, and generate plots.',
        parameters: {
          type: 'object',
          properties: {
            code: {
              type: 'string',
              description: 'The Python code to execute. Can include imports, calculations, data analysis, and plot generation.'
            },
            save_plots: {
              type: 'boolean',
              description: 'Whether to save any generated plots as PNG files',
              default: true
            },
            plot_filename: {
              type: 'string',
              description: 'Optional filename for saved plots (without extension). If not provided, a unique name will be generated.'
            }
          },
          required: ['code']
        }
      }
    };
  }

  async executeCode(code, options = {}) {
    const executionId = crypto.randomUUID();
    const { save_plots = true, plot_filename } = options;

    try {
      // If Python server is available, use it for better performance
      if (this.isConnected) {
        return await this.executeViaServer(code, executionId, { ...options, save_plots, plot_filename });
      } else {
        // Fallback to local execution
        return await this.executeLocally(code, executionId, { ...options, save_plots, plot_filename });
      }
    } catch (error) {
      console.error('Python execution error:', error);
      return {
        success: false,
        error: error.message,
        execution_id: executionId
      };
    }
  }

  async executeViaServer(code, executionId, options) {
    try {
      // Connect via WebSocket for streaming output
      const ws = new WebSocket(`${this.pythonServerWsUrl}/ws?client_id=${executionId}`);
      
      return new Promise((resolve, reject) => {
        let output = [];
        let plots = [];
        let error = null;

        ws.on('open', () => {
          // Send execution request
          ws.send(JSON.stringify({
            type: 'execute_code',
            code: code,
            execution_id: executionId,
            options: {
              save_plots: options.save_plots,
              plot_dir: this.outputDir,
              plot_filename: options.plot_filename
            }
          }));
        });

        ws.on('message', async (data) => {
          try {
            const message = JSON.parse(data.toString());

            switch (message.type) {
              case 'output':
                output.push(message.content);
                break;

              case 'plot':
                // Handle plot data (base64 encoded)
                if (message.data && options.save_plots) {
                  const plotResult = await this.savePlot(
                    message.data, 
                    message.filename || options.plot_filename,
                    executionId,
                    {
                      description: message.description || 'Generated chart',
                      tags: message.tags || ['python', 'visualization'],
                      pythonCode: options.pythonCode,
                      sessionId: options.sessionId,
                      vehicleContext: options.vehicleContext,
                      customerContext: options.customerContext
                    }
                  );
                  plots.push(plotResult);
                }
                break;

              case 'error':
                error = message.content;
                break;

              case 'complete':
                ws.close();
                resolve({
                  success: !error,
                  output: output.join('\n'),
                  plots: plots,
                  error: error,
                  execution_id: executionId
                });
                break;
            }
          } catch (parseError) {
            console.error('Error parsing WebSocket message:', parseError);
          }
        });

        ws.on('error', (wsError) => {
          reject(new Error(`WebSocket error: ${wsError.message}`));
        });

        ws.on('close', () => {
          if (!output.length && !error) {
            reject(new Error('Connection closed without receiving results'));
          }
        });

        // Set timeout
        setTimeout(() => {
          ws.close();
          reject(new Error('Execution timeout'));
        }, 30000); // 30 second timeout
      });

    } catch (error) {
      console.error('Server execution error:', error);
      throw error;
    }
  }

  async executeLocally(code, executionId, options) {
    // Create a temporary Python file
    const tempFile = path.join(this.outputDir, `temp_${executionId}.py`);
    
    try {
      // Wrap the code to capture plots if needed
      const wrappedCode = this.wrapCodeForExecution(code, { ...options, executionId });
      await fs.writeFile(tempFile, wrappedCode);

      return new Promise((resolve, reject) => {
        // Use the Python from virtual environment
        const isWindows = process.platform === 'win32';
        const pythonPath = isWindows 
          ? path.join(process.cwd(), 'venv', 'Scripts', 'python.exe')
          : path.join(process.cwd(), 'venv', 'bin', 'python');
        const pythonProcess = spawn(pythonPath, [tempFile], {
          env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
        });

        let output = [];
        let errorOutput = [];

        pythonProcess.stdout.on('data', (data) => {
          output.push(data.toString());
        });

        pythonProcess.stderr.on('data', (data) => {
          errorOutput.push(data.toString());
        });

        pythonProcess.on('close', async (code) => {
          // Clean up temp file
          try {
            await fs.unlink(tempFile);
          } catch (e) {
            // Ignore cleanup errors
          }

          // Parse output to find plot paths
          const outputText = output.join('');
          const plotPathMatches = outputText.match(/Plot saved to: (.+\.png)/g) || [];
          const extractedPaths = plotPathMatches.map(match => 
            match.replace('Plot saved to: ', '').trim()
          );

          // Check for generated plots and register them
          const plotPaths = await this.findGeneratedPlots(executionId);
          
          // Combine both methods
          const allPlotPaths = [...new Set([...plotPaths, ...extractedPaths])];
          
          const plots = [];
          
          for (const plotPath of allPlotPaths) {
            const filename = path.basename(plotPath);
            const imageId = crypto.randomUUID();
            
            try {
              // Read file data and stats
              const imageData = await fs.readFile(plotPath);
              const stats = await fs.stat(plotPath);
              
              // Save to MongoDB
              const plot = new Plot({
                imageId,
                filename,
                originalPath: plotPath,
                imageData,
                mimeType: 'image/png',
                size: stats.size,
                executionId,
                description: 'Local Python execution chart',
                tags: ['python', 'local-execution'],
                pythonCode: options.pythonCode || code,
                sessionId: options.sessionId,
                vehicleContext: options.vehicleContext,
                customerContext: options.customerContext
              });
              
              plot.setExpiration(7);
              await plot.save();
              console.log(`Local plot saved to MongoDB with ID: ${imageId}`);
              
            } catch (dbError) {
              console.error('Error saving local plot to MongoDB:', dbError);
            }
            
            // Also register with legacy system for backward compatibility
            registerImage(plotPath, {
              id: imageId,
              filename,
              executionId,
              description: 'Local Python execution chart',
              tags: ['python', 'local-execution'],
              mimeType: 'image/png'
            });
            
            plots.push({ path: plotPath, imageId });
          }

          resolve({
            success: code === 0,
            output: output.join(''),
            error: errorOutput.join(''),
            plots: plots,
            execution_id: executionId
          });
        });

        pythonProcess.on('error', (error) => {
          reject(error);
        });

        // Set timeout
        setTimeout(() => {
          pythonProcess.kill();
          reject(new Error('Execution timeout'));
        }, 30000); // 30 second timeout
      });

    } catch (error) {
      // Clean up temp file on error
      try {
        await fs.unlink(tempFile);
      } catch (e) {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  wrapCodeForExecution(code, options) {
    const executionId = options.executionId || 'unknown';
    const plotSetup = options.save_plots ? `
import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend
import matplotlib.pyplot as plt

# Store the original show function
_original_show = plt.show

# Override plt.show to save instead
def _save_show():
    import os
    plot_filename = "${options.plot_filename || `plot_${executionId}_${Date.now()}`}"
    plot_path = os.path.join("${this.outputDir}", f"{plot_filename}.png")
    plt.savefig(plot_path, dpi=150, bbox_inches='tight')
    print(f"Plot saved to: {plot_path}")
    plt.close()

plt.show = _save_show
` : '';

    return `
${plotSetup}

# User code starts here
${code}

# Ensure all plots are saved
if 'plt' in locals():
    for fig_num in plt.get_fignums():
        plt.figure(fig_num)
        plt.savefig(f"${this.outputDir}/figure_{fig_num}_${executionId}_${Date.now()}.png", dpi=150, bbox_inches='tight')
    plt.close('all')
`;
  }

  async savePlot(base64Data, filename, executionId, options = {}) {
    const plotFilename = filename || `plot_${Date.now()}`;
    const plotPath = path.join(this.outputDir, `${plotFilename}.png`);
    
    // Remove base64 prefix if present
    const base64Clean = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Clean, 'base64');
    
    await fs.writeFile(plotPath, buffer);
    
    // Generate unique image ID
    const imageId = crypto.randomUUID();
    
    try {
      // Get file stats for size information
      const stats = await fs.stat(plotPath);
      
      // Save to MongoDB
      const plot = new Plot({
        imageId,
        filename: `${plotFilename}.png`,
        originalPath: plotPath,
        imageData: buffer,
        mimeType: 'image/png',
        size: stats.size,
        executionId: executionId,
        description: options.description || 'Python generated chart',
        tags: options.tags || ['python', 'chart'],
        pythonCode: options.pythonCode,
        pythonOutput: options.pythonOutput || '',
        metadata: options.metadata || {},
        vehicleContext: options.vehicleContext,
        customerContext: options.customerContext,
        sessionId: options.sessionId
      });
      
      // Set automatic expiration (7 days by default)
      plot.setExpiration(7);
      
      await plot.save();
      console.log(`Plot saved to MongoDB with ID: ${imageId}`);
      
      // Also register with the legacy image system for backward compatibility
      registerImage(plotPath, {
        id: imageId,
        filename: `${plotFilename}.png`,
        executionId: executionId,
        description: options.description || 'Python generated chart',
        tags: options.tags || ['python', 'chart'],
        mimeType: 'image/png'
      });
      
    } catch (error) {
      console.error('Error saving plot to MongoDB:', error);
      // Fallback to legacy system only
      registerImage(plotPath, {
        id: imageId,
        filename: `${plotFilename}.png`,
        executionId: executionId,
        description: options.description || 'Python generated chart',
        tags: options.tags || ['python', 'chart'],
        mimeType: 'image/png'
      });
    }
    
    return { path: plotPath, imageId };
  }

  async findGeneratedPlots(executionId) {
    try {
      const files = await fs.readdir(this.outputDir);
      // Look for plots that either contain the executionId or were just created
      const plots = files.filter(f => {
        if (!f.endsWith('.png')) return false;
        // Check if filename contains executionId
        if (f.includes(String(executionId))) return true;
        // If not, check if the file was created recently (within last 5 seconds)
        try {
          const filePath = path.join(this.outputDir, f);
          const stats = fsSync.statSync(filePath);
          const fileAge = Date.now() - stats.mtimeMs;
          return fileAge < 5000; // 5 seconds
        } catch (err) {
          return false;
        }
      });
      return plots.map(f => path.join(this.outputDir, f));
    } catch (error) {
      console.error('Error finding generated plots:', error);
      return [];
    }
  }

  async getPlotAsBase64(plotPath) {
    try {
      const data = await fs.readFile(plotPath);
      return `data:image/png;base64,${data.toString('base64')}`;
    } catch (error) {
      console.error('Error reading plot file:', error);
      return null;
    }
  }

  // Get plot from MongoDB by imageId
  async getPlotFromDB(imageId) {
    try {
      const plot = await Plot.findOne({ imageId });
      if (plot) {
        // Update access statistics
        await plot.updateAccess();
        return plot;
      }
      return null;
    } catch (error) {
      console.error('Error retrieving plot from MongoDB:', error);
      return null;
    }
  }

  // Get plots by execution ID from MongoDB
  async getPlotsByExecutionId(executionId, options = {}) {
    try {
      return await Plot.findByExecutionId(executionId, options);
    } catch (error) {
      console.error('Error retrieving plots by execution ID:', error);
      return [];
    }
  }

  // Get plots by session ID from MongoDB
  async getPlotsBySessionId(sessionId, options = {}) {
    try {
      return await Plot.findBySessionId(sessionId, options);
    } catch (error) {
      console.error('Error retrieving plots by session ID:', error);
      return [];
    }
  }

  // Clean up old execution results and plots
  async cleanup(maxAgeMs = 60 * 60 * 1000) { // 1 hour default
    try {
      const files = await fs.readdir(this.outputDir);
      const now = Date.now();

      for (const file of files) {
        const filePath = path.join(this.outputDir, file);
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtimeMs > maxAgeMs) {
          await fs.unlink(filePath);
        }
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }

  // =====================================================
  // OBD2 ANALYSIS METHODS
  // =====================================================

  /**
   * Analyze OBD2 session data using Python
   * @param {string} sessionId - MongoDB session ID
   * @param {Object} options - Analysis options
   * @returns {Object} Analysis results
   */
  async analyzeOBD2Session(sessionId, options = {}) {
    const {
      analysisType = 'comprehensive',
      generatePlots = true,
      saveResults = true
    } = options;

    try {
      // Validate sessionId
      if (!mongoose.Types.ObjectId.isValid(sessionId)) {
        throw new Error('Invalid session ID format');
      }

      // Get session data from MongoDB
      const sessionData = await this.getSessionDataForAnalysis(sessionId);
      if (!sessionData || sessionData.length === 0) {
        throw new Error('No data found for session');
      }

      // Generate Python analysis code
      const analysisCode = this.generateAnalysisCode(sessionData, analysisType, {
        sessionId,
        generatePlots
      });

      // Execute Python analysis
      const executionResult = await this.executeCode(analysisCode, {
        save_plots: generatePlots,
        plot_filename: `obd2_analysis_${sessionId}_${Date.now()}`,
        sessionId,
        pythonCode: analysisCode
      });

      // Parse analysis results
      const analysisResults = this.parseAnalysisResults(executionResult);

      // Save results to MongoDB if requested
      if (saveResults && analysisResults.success) {
        await this.saveAnalysisResults(sessionId, analysisResults, analysisType);
      }

      return {
        success: true,
        sessionId,
        analysisType,
        results: analysisResults,
        executionId: executionResult.execution_id,
        plots: executionResult.plots || [],
        generatedAt: new Date()
      };

    } catch (error) {
      console.error('OBD2 analysis error:', error);
      return {
        success: false,
        sessionId,
        error: error.message,
        generatedAt: new Date()
      };
    }
  }

  /**
   * Get session data formatted for Python analysis
   * @param {string} sessionId - Session ID
   * @returns {Array} Formatted data points
   */
  async getSessionDataForAnalysis(sessionId) {
    try {
      // Try to get data from the new OBD2DataPoint collection first
      const OBD2DataPoint = mongoose.model('OBD2DataPoint');
      const dataPoints = await OBD2DataPoint.find({ 
        sessionId: new mongoose.Types.ObjectId(sessionId) 
      }).sort({ timestamp: 1 });

      if (dataPoints.length > 0) {
        return dataPoints.map(point => this.formatDataPoint(point.toObject()));
      }

      // Fallback to legacy OBD2Data collection
      const sessionData = await OBD2Data.find({ sessionId }).sort({ createdAt: 1 });
      
      // Flatten parameters from all session records
      const allDataPoints = [];
      sessionData.forEach(session => {
        session.parameters.forEach(param => {
          allDataPoints.push({
            timestamp: param.timestamp || session.createdAt,
            parameter: param.name,
            pid: param.pid,
            value: param.formattedValue || param.value,
            unit: param.unit,
            sessionId: session.sessionId,
            vehicleId: session.vehicleId
          });
        });
      });

      return allDataPoints;
    } catch (error) {
      console.error('Error retrieving session data:', error);
      return [];
    }
  }

  /**
   * Format a data point for Python analysis
   * @param {Object} dataPoint - Raw data point
   * @returns {Object} Formatted data point
   */
  formatDataPoint(dataPoint) {
    return {
      timestamp: dataPoint.timestamp,
      rpm: dataPoint.rpm || null,
      speed: dataPoint.speed || null,
      engineTemp: dataPoint.engineTemp || null,
      throttlePosition: dataPoint.throttlePosition || null,
      engineLoad: dataPoint.engineLoad || null,
      maf: dataPoint.maf || null,
      map: dataPoint.map || null,
      fuelTrimShortB1: dataPoint.fuelTrimShortB1 || null,
      fuelTrimLongB1: dataPoint.fuelTrimLongB1 || null,
      o2B1S1Voltage: dataPoint.o2B1S1Voltage || null,
      o2B1S2Voltage: dataPoint.o2B1S2Voltage || null,
      batteryVoltage: dataPoint.batteryVoltage || null,
      timingAdvance: dataPoint.timingAdvance || null,
      fuelLevel: dataPoint.fuelLevel || null
    };
  }

  /**
   * Generate Python analysis code based on analysis type
   * @param {Array} sessionData - Session data points
   * @param {string} analysisType - Type of analysis to perform
   * @param {Object} options - Additional options
   * @returns {string} Python code
   */
  generateAnalysisCode(sessionData, analysisType, options = {}) {
    const { sessionId, generatePlots = true } = options;
    
    // Convert data to JSON string for Python
    const dataJson = JSON.stringify(sessionData);
    
    const baseImports = `
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
import json
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

# Configure matplotlib
plt.style.use('seaborn-v0_8')
plt.rcParams['figure.figsize'] = (12, 8)
plt.rcParams['font.size'] = 10

# Load data
data_json = '''${dataJson}'''
data = json.loads(data_json)
df = pd.DataFrame(data)

# Convert timestamp to datetime
df['timestamp'] = pd.to_datetime(df['timestamp'])
df = df.sort_values('timestamp')

# Remove null values and ensure numeric columns
numeric_columns = ['rpm', 'speed', 'engineTemp', 'throttlePosition', 'engineLoad', 'maf', 'map', 
                  'fuelTrimShortB1', 'fuelTrimLongB1', 'o2B1S1Voltage', 'o2B1S2Voltage', 
                  'batteryVoltage', 'timingAdvance', 'fuelLevel']

for col in numeric_columns:
    if col in df.columns:
        df[col] = pd.to_numeric(df[col], errors='coerce')

print(f"Loaded {len(df)} data points for analysis")
print(f"Data columns: {list(df.columns)}")
print(f"Date range: {df['timestamp'].min()} to {df['timestamp'].max()}")
`;

    switch (analysisType) {
      case 'performance':
        return baseImports + this.getPerformanceAnalysisCode(generatePlots);
      case 'diagnostics':
        return baseImports + this.getDiagnosticsAnalysisCode(generatePlots);
      case 'fuel_efficiency':
        return baseImports + this.getFuelEfficiencyAnalysisCode(generatePlots);
      case 'engine_health':
        return baseImports + this.getEngineHealthAnalysisCode(generatePlots);
      case 'comprehensive':
      default:
        return baseImports + this.getComprehensiveAnalysisCode(generatePlots);
    }
  }

  /**
   * Generate performance analysis Python code
   */
  getPerformanceAnalysisCode(generatePlots = true) {
    return `
# PERFORMANCE ANALYSIS
print("\\n=== PERFORMANCE ANALYSIS ===")

analysis_results = {
    'analysis_type': 'performance',
    'metrics': {},
    'insights': [],
    'recommendations': []
}

# Basic performance metrics
if 'rpm' in df.columns and df['rpm'].notna().sum() > 0:
    rpm_stats = {
        'avg': float(df['rpm'].mean()),
        'max': float(df['rpm'].max()),
        'min': float(df['rpm'].min()),
        'std': float(df['rpm'].std())
    }
    analysis_results['metrics']['rpm'] = rpm_stats
    print(f"RPM - Avg: {rpm_stats['avg']:.0f}, Max: {rpm_stats['max']:.0f}, Range: {rpm_stats['max'] - rpm_stats['min']:.0f}")

if 'speed' in df.columns and df['speed'].notna().sum() > 0:
    speed_stats = {
        'avg': float(df['speed'].mean()),
        'max': float(df['speed'].max()),
        'min': float(df['speed'].min())
    }
    analysis_results['metrics']['speed'] = speed_stats
    print(f"Speed - Avg: {speed_stats['avg']:.1f} km/h, Max: {speed_stats['max']:.1f} km/h")

if 'engineLoad' in df.columns and df['engineLoad'].notna().sum() > 0:
    load_stats = {
        'avg': float(df['engineLoad'].mean()),
        'max': float(df['engineLoad'].max())
    }
    analysis_results['metrics']['engineLoad'] = load_stats
    print(f"Engine Load - Avg: {load_stats['avg']:.1f}%, Max: {load_stats['max']:.1f}%")

# Performance insights
if 'rpm' in analysis_results['metrics']:
    rpm_avg = analysis_results['metrics']['rpm']['avg']
    if rpm_avg > 3000:
        analysis_results['insights'].append("High average RPM detected - may indicate aggressive driving")
    elif rpm_avg < 1000:
        analysis_results['insights'].append("Low average RPM - efficient driving pattern")

if 'engineLoad' in analysis_results['metrics']:
    load_avg = analysis_results['metrics']['engineLoad']['avg']
    if load_avg > 80:
        analysis_results['insights'].append("High engine load detected - engine working hard")
        analysis_results['recommendations'].append("Consider lighter acceleration for better efficiency")

${generatePlots ? `
# Generate performance plots
if len(df) > 1:
    fig, axes = plt.subplots(2, 2, figsize=(15, 10))
    fig.suptitle('Performance Analysis Dashboard', fontsize=16, fontweight='bold')
    
    # RPM over time
    if 'rpm' in df.columns and df['rpm'].notna().sum() > 0:
        axes[0,0].plot(df['timestamp'], df['rpm'], linewidth=1, alpha=0.7)
        axes[0,0].set_title('Engine RPM Over Time')
        axes[0,0].set_ylabel('RPM')
        axes[0,0].grid(True, alpha=0.3)
    
    # Speed over time
    if 'speed' in df.columns and df['speed'].notna().sum() > 0:
        axes[0,1].plot(df['timestamp'], df['speed'], linewidth=1, alpha=0.7, color='orange')
        axes[0,1].set_title('Vehicle Speed Over Time')
        axes[0,1].set_ylabel('Speed (km/h)')
        axes[0,1].grid(True, alpha=0.3)
    
    # Engine Load over time
    if 'engineLoad' in df.columns and df['engineLoad'].notna().sum() > 0:
        axes[1,0].plot(df['timestamp'], df['engineLoad'], linewidth=1, alpha=0.7, color='red')
        axes[1,0].set_title('Engine Load Over Time')
        axes[1,0].set_ylabel('Load (%)')
        axes[1,0].grid(True, alpha=0.3)
    
    # RPM vs Speed scatter
    if 'rpm' in df.columns and 'speed' in df.columns:
        valid_data = df.dropna(subset=['rpm', 'speed'])
        if len(valid_data) > 0:
            axes[1,1].scatter(valid_data['speed'], valid_data['rpm'], alpha=0.5)
            axes[1,1].set_title('RPM vs Speed Relationship')
            axes[1,1].set_xlabel('Speed (km/h)')
            axes[1,1].set_ylabel('RPM')
            axes[1,1].grid(True, alpha=0.3)
    
    plt.tight_layout()
    plt.show()
` : ''}

# Output results
print("\\n=== ANALYSIS RESULTS ===")
print(json.dumps(analysis_results, indent=2))
`;
  }

  /**
   * Generate diagnostics analysis Python code
   */
  getDiagnosticsAnalysisCode(generatePlots = true) {
    return `
# DIAGNOSTICS ANALYSIS
print("\\n=== DIAGNOSTICS ANALYSIS ===")

analysis_results = {
    'analysis_type': 'diagnostics',
    'health_status': 'unknown',
    'issues': [],
    'warnings': [],
    'recommendations': [],
    'sensor_health': {}
}

# Engine temperature analysis
if 'engineTemp' in df.columns and df['engineTemp'].notna().sum() > 0:
    temp_avg = float(df['engineTemp'].mean())
    temp_max = float(df['engineTemp'].max())
    
    analysis_results['sensor_health']['engine_temperature'] = {
        'avg': temp_avg,
        'max': temp_max,
        'status': 'normal'
    }
    
    if temp_max > 105:
        analysis_results['issues'].append("Engine overheating detected (>105°C)")
        analysis_results['sensor_health']['engine_temperature']['status'] = 'critical'
    elif temp_avg > 95:
        analysis_results['warnings'].append("Engine running hot (avg >95°C)")
        analysis_results['sensor_health']['engine_temperature']['status'] = 'warning'

# Oxygen sensor analysis
if 'o2B1S1Voltage' in df.columns and df['o2B1S1Voltage'].notna().sum() > 0:
    o2_data = df['o2B1S1Voltage'].dropna()
    o2_avg = float(o2_data.mean())
    o2_std = float(o2_data.std())
    
    analysis_results['sensor_health']['oxygen_sensor'] = {
        'avg_voltage': o2_avg,
        'variability': o2_std,
        'status': 'normal'
    }
    
    if o2_avg < 0.2 or o2_avg > 0.8:
        analysis_results['warnings'].append(f"O2 sensor voltage unusual ({o2_avg:.2f}V)")
        analysis_results['sensor_health']['oxygen_sensor']['status'] = 'warning'

# Fuel trim analysis
if 'fuelTrimShortB1' in df.columns and df['fuelTrimShortB1'].notna().sum() > 0:
    ft_data = df['fuelTrimShortB1'].dropna()
    ft_avg = float(ft_data.mean())
    
    analysis_results['sensor_health']['fuel_trim'] = {
        'short_term_avg': ft_avg,
        'status': 'normal'
    }
    
    if abs(ft_avg) > 10:
        analysis_results['warnings'].append(f"High fuel trim detected ({ft_avg:.1f}%)")
        analysis_results['sensor_health']['fuel_trim']['status'] = 'warning'
        analysis_results['recommendations'].append("Check for vacuum leaks or fuel system issues")

# Overall health assessment
issue_count = len(analysis_results['issues'])
warning_count = len(analysis_results['warnings'])

if issue_count > 0:
    analysis_results['health_status'] = 'poor'
elif warning_count > 2:
    analysis_results['health_status'] = 'fair'
elif warning_count > 0:
    analysis_results['health_status'] = 'good'
else:
    analysis_results['health_status'] = 'excellent'

print(f"Overall Health Status: {analysis_results['health_status'].upper()}")
print(f"Issues: {issue_count}, Warnings: {warning_count}")

${generatePlots ? `
# Generate diagnostic plots
if len(df) > 1:
    fig, axes = plt.subplots(2, 2, figsize=(15, 10))
    fig.suptitle('Diagnostic Analysis Dashboard', fontsize=16, fontweight='bold')
    
    # Engine temperature
    if 'engineTemp' in df.columns and df['engineTemp'].notna().sum() > 0:
        axes[0,0].plot(df['timestamp'], df['engineTemp'], linewidth=1, color='red')
        axes[0,0].axhline(y=90, color='orange', linestyle='--', label='Warning (90°C)')
        axes[0,0].axhline(y=105, color='red', linestyle='--', label='Critical (105°C)')
        axes[0,0].set_title('Engine Temperature')
        axes[0,0].set_ylabel('Temperature (°C)')
        axes[0,0].legend()
        axes[0,0].grid(True, alpha=0.3)
    
    # O2 sensor voltage
    if 'o2B1S1Voltage' in df.columns and df['o2B1S1Voltage'].notna().sum() > 0:
        axes[0,1].plot(df['timestamp'], df['o2B1S1Voltage'], linewidth=1, color='blue')
        axes[0,1].axhline(y=0.45, color='green', linestyle='--', label='Ideal (0.45V)')
        axes[0,1].set_title('O2 Sensor Voltage (Bank 1 Sensor 1)')
        axes[0,1].set_ylabel('Voltage (V)')
        axes[0,1].legend()
        axes[0,1].grid(True, alpha=0.3)
    
    # Fuel trim
    if 'fuelTrimShortB1' in df.columns and df['fuelTrimShortB1'].notna().sum() > 0:
        axes[1,0].plot(df['timestamp'], df['fuelTrimShortB1'], linewidth=1, color='purple')
        axes[1,0].axhline(y=0, color='green', linestyle='-', label='Ideal (0%)')
        axes[1,0].axhline(y=10, color='orange', linestyle='--', label='Warning (+10%)')
        axes[1,0].axhline(y=-10, color='orange', linestyle='--', label='Warning (-10%)')
        axes[1,0].set_title('Short Term Fuel Trim')
        axes[1,0].set_ylabel('Fuel Trim (%)')
        axes[1,0].legend()
        axes[1,0].grid(True, alpha=0.3)
    
    # Battery voltage
    if 'batteryVoltage' in df.columns and df['batteryVoltage'].notna().sum() > 0:
        axes[1,1].plot(df['timestamp'], df['batteryVoltage'], linewidth=1, color='orange')
        axes[1,1].axhline(y=12.6, color='green', linestyle='--', label='Good (12.6V)')
        axes[1,1].axhline(y=12.0, color='orange', linestyle='--', label='Low (12.0V)')
        axes[1,1].set_title('Battery Voltage')
        axes[1,1].set_ylabel('Voltage (V)')
        axes[1,1].legend()
        axes[1,1].grid(True, alpha=0.3)
    
    plt.tight_layout()
    plt.show()
` : ''}

print("\\n=== ANALYSIS RESULTS ===")
print(json.dumps(analysis_results, indent=2))
`;
  }

  /**
   * Generate comprehensive analysis Python code
   */
  getComprehensiveAnalysisCode(generatePlots = true) {
    return `
# COMPREHENSIVE ANALYSIS
print("\\n=== COMPREHENSIVE OBD2 ANALYSIS ===")

analysis_results = {
    'analysis_type': 'comprehensive',
    'summary': {},
    'performance': {},
    'diagnostics': {},
    'fuel_efficiency': {},
    'recommendations': [],
    'overall_health': 'unknown'
}

# Performance metrics
performance_metrics = {}
if 'rpm' in df.columns and df['rpm'].notna().sum() > 0:
    performance_metrics['rpm'] = {
        'avg': float(df['rpm'].mean()),
        'max': float(df['rpm'].max()),
        'operating_range': 'efficient' if df['rpm'].mean() < 2500 else 'high'
    }

if 'speed' in df.columns and df['speed'].notna().sum() > 0:
    performance_metrics['speed'] = {
        'avg': float(df['speed'].mean()),
        'max': float(df['speed'].max())
    }

if 'engineLoad' in df.columns and df['engineLoad'].notna().sum() > 0:
    performance_metrics['engine_load'] = {
        'avg': float(df['engineLoad'].mean()),
        'max': float(df['engineLoad'].max())
    }

analysis_results['performance'] = performance_metrics

# Diagnostic checks
diagnostic_results = {}
issues = []
warnings = []

# Engine temperature check
if 'engineTemp' in df.columns and df['engineTemp'].notna().sum() > 0:
    temp_max = float(df['engineTemp'].max())
    temp_avg = float(df['engineTemp'].mean())
    
    diagnostic_results['engine_temperature'] = {
        'max': temp_max,
        'avg': temp_avg,
        'status': 'normal'
    }
    
    if temp_max > 105:
        issues.append("Engine overheating detected")
        diagnostic_results['engine_temperature']['status'] = 'critical'
    elif temp_avg > 95:
        warnings.append("Engine running warm")
        diagnostic_results['engine_temperature']['status'] = 'warning'

# O2 sensor check
if 'o2B1S1Voltage' in df.columns and df['o2B1S1Voltage'].notna().sum() > 0:
    o2_avg = float(df['o2B1S1Voltage'].mean())
    diagnostic_results['oxygen_sensor'] = {
        'avg_voltage': o2_avg,
        'status': 'normal'
    }
    
    if o2_avg < 0.2 or o2_avg > 0.8:
        warnings.append(f"O2 sensor voltage irregular: {o2_avg:.2f}V")
        diagnostic_results['oxygen_sensor']['status'] = 'warning'

# Fuel system check
if 'fuelTrimShortB1' in df.columns and df['fuelTrimShortB1'].notna().sum() > 0:
    ft_avg = float(df['fuelTrimShortB1'].mean())
    diagnostic_results['fuel_system'] = {
        'short_term_trim': ft_avg,
        'status': 'normal'
    }
    
    if abs(ft_avg) > 15:
        issues.append(f"Extreme fuel trim: {ft_avg:.1f}%")
        diagnostic_results['fuel_system']['status'] = 'critical'
    elif abs(ft_avg) > 8:
        warnings.append(f"High fuel trim: {ft_avg:.1f}%")
        diagnostic_results['fuel_system']['status'] = 'warning'

analysis_results['diagnostics'] = {
    'results': diagnostic_results,
    'issues': issues,
    'warnings': warnings
}

# Fuel efficiency estimation
fuel_efficiency = {}
if 'speed' in df.columns and 'engineLoad' in df.columns:
    valid_data = df.dropna(subset=['speed', 'engineLoad'])
    if len(valid_data) > 0:
        avg_speed = float(valid_data['speed'].mean())
        avg_load = float(valid_data['engineLoad'].mean())
        
        # Simple efficiency estimate based on speed and load
        if avg_speed > 0:
            efficiency_score = max(0, 100 - (avg_load * 0.5) - abs(avg_speed - 60) * 0.2)
            fuel_efficiency = {
                'efficiency_score': efficiency_score,
                'driving_style': 'efficient' if efficiency_score > 80 else 'moderate' if efficiency_score > 60 else 'aggressive'
            }

analysis_results['fuel_efficiency'] = fuel_efficiency

# Generate recommendations
recommendations = []
if len(issues) > 0:
    recommendations.append("Address critical issues immediately - schedule professional inspection")
if len(warnings) > 2:
    recommendations.append("Multiple warnings detected - consider preventive maintenance")
if 'performance' in analysis_results and 'rpm' in analysis_results['performance']:
    if analysis_results['performance']['rpm']['operating_range'] == 'high':
        recommendations.append("Consider more efficient driving to reduce engine wear")
if fuel_efficiency.get('driving_style') == 'aggressive':
    recommendations.append("Adopt smoother acceleration and braking for better fuel economy")

analysis_results['recommendations'] = recommendations

# Overall health assessment
critical_issues = len(issues)
warning_count = len(warnings)

if critical_issues > 0:
    overall_health = 'poor'
elif warning_count > 3:
    overall_health = 'fair'
elif warning_count > 0:
    overall_health = 'good'
else:
    overall_health = 'excellent'

analysis_results['overall_health'] = overall_health

# Summary
analysis_results['summary'] = {
    'data_points': len(df),
    'session_duration_minutes': float((df['timestamp'].max() - df['timestamp'].min()).total_seconds() / 60) if len(df) > 1 else 0,
    'critical_issues': critical_issues,
    'warnings': warning_count,
    'overall_health': overall_health,
    'key_findings': []
}

# Add key findings
if critical_issues > 0:
    analysis_results['summary']['key_findings'].append(f"{critical_issues} critical issue(s) require immediate attention")
if fuel_efficiency.get('efficiency_score'):
    analysis_results['summary']['key_findings'].append(f"Fuel efficiency score: {fuel_efficiency['efficiency_score']:.1f}/100")
if 'performance' in analysis_results and 'rpm' in analysis_results['performance']:
    avg_rpm = analysis_results['performance']['rpm']['avg']
    analysis_results['summary']['key_findings'].append(f"Average RPM: {avg_rpm:.0f} ({analysis_results['performance']['rpm']['operating_range']} range)")

print(f"\\nAnalysis Summary:")
print(f"- Data Points: {len(df)}")
print(f"- Overall Health: {overall_health.upper()}")
print(f"- Critical Issues: {critical_issues}")
print(f"- Warnings: {warning_count}")

${generatePlots ? `
# Generate comprehensive dashboard
if len(df) > 1:
    fig = plt.figure(figsize=(20, 15))
    
    # Create a 3x3 grid for comprehensive dashboard
    gs = fig.add_gridspec(3, 3, hspace=0.3, wspace=0.3)
    
    # RPM over time
    if 'rpm' in df.columns and df['rpm'].notna().sum() > 0:
        ax1 = fig.add_subplot(gs[0, 0])
        ax1.plot(df['timestamp'], df['rpm'], linewidth=1, alpha=0.7)
        ax1.set_title('Engine RPM', fontweight='bold')
        ax1.set_ylabel('RPM')
        ax1.grid(True, alpha=0.3)
    
    # Speed over time
    if 'speed' in df.columns and df['speed'].notna().sum() > 0:
        ax2 = fig.add_subplot(gs[0, 1])
        ax2.plot(df['timestamp'], df['speed'], linewidth=1, alpha=0.7, color='orange')
        ax2.set_title('Vehicle Speed', fontweight='bold')
        ax2.set_ylabel('Speed (km/h)')
        ax2.grid(True, alpha=0.3)
    
    # Engine temperature
    if 'engineTemp' in df.columns and df['engineTemp'].notna().sum() > 0:
        ax3 = fig.add_subplot(gs[0, 2])
        ax3.plot(df['timestamp'], df['engineTemp'], linewidth=1, color='red')
        ax3.axhline(y=90, color='orange', linestyle='--', alpha=0.7, label='Warning')
        ax3.axhline(y=105, color='red', linestyle='--', alpha=0.7, label='Critical')
        ax3.set_title('Engine Temperature', fontweight='bold')
        ax3.set_ylabel('Temperature (°C)')
        ax3.legend()
        ax3.grid(True, alpha=0.3)
    
    # Engine load
    if 'engineLoad' in df.columns and df['engineLoad'].notna().sum() > 0:
        ax4 = fig.add_subplot(gs[1, 0])
        ax4.plot(df['timestamp'], df['engineLoad'], linewidth=1, alpha=0.7, color='purple')
        ax4.set_title('Engine Load', fontweight='bold')
        ax4.set_ylabel('Load (%)')
        ax4.grid(True, alpha=0.3)
    
    # O2 sensor
    if 'o2B1S1Voltage' in df.columns and df['o2B1S1Voltage'].notna().sum() > 0:
        ax5 = fig.add_subplot(gs[1, 1])
        ax5.plot(df['timestamp'], df['o2B1S1Voltage'], linewidth=1, color='blue')
        ax5.axhline(y=0.45, color='green', linestyle='--', alpha=0.7, label='Ideal')
        ax5.set_title('O2 Sensor Voltage', fontweight='bold')
        ax5.set_ylabel('Voltage (V)')
        ax5.legend()
        ax5.grid(True, alpha=0.3)
    
    # Fuel trim
    if 'fuelTrimShortB1' in df.columns and df['fuelTrimShortB1'].notna().sum() > 0:
        ax6 = fig.add_subplot(gs[1, 2])
        ax6.plot(df['timestamp'], df['fuelTrimShortB1'], linewidth=1, color='green')
        ax6.axhline(y=0, color='black', linestyle='-', alpha=0.5)
        ax6.axhline(y=10, color='orange', linestyle='--', alpha=0.7)
        ax6.axhline(y=-10, color='orange', linestyle='--', alpha=0.7)
        ax6.set_title('Short Term Fuel Trim', fontweight='bold')
        ax6.set_ylabel('Fuel Trim (%)')
        ax6.grid(True, alpha=0.3)
    
    # RPM vs Speed scatter
    if 'rpm' in df.columns and 'speed' in df.columns:
        valid_data = df.dropna(subset=['rpm', 'speed'])
        if len(valid_data) > 0:
            ax7 = fig.add_subplot(gs[2, 0])
            ax7.scatter(valid_data['speed'], valid_data['rpm'], alpha=0.5, s=10)
            ax7.set_title('RPM vs Speed', fontweight='bold')
            ax7.set_xlabel('Speed (km/h)')
            ax7.set_ylabel('RPM')
            ax7.grid(True, alpha=0.3)
    
    # Engine Load vs Speed
    if 'engineLoad' in df.columns and 'speed' in df.columns:
        valid_data = df.dropna(subset=['engineLoad', 'speed'])
        if len(valid_data) > 0:
            ax8 = fig.add_subplot(gs[2, 1])
            ax8.scatter(valid_data['speed'], valid_data['engineLoad'], alpha=0.5, s=10, color='purple')
            ax8.set_title('Engine Load vs Speed', fontweight='bold')
            ax8.set_xlabel('Speed (km/h)')
            ax8.set_ylabel('Engine Load (%)')
            ax8.grid(True, alpha=0.3)
    
    # Health status pie chart
    ax9 = fig.add_subplot(gs[2, 2])
    health_data = [critical_issues, warning_count, max(0, 10 - critical_issues - warning_count)]
    health_labels = ['Critical', 'Warning', 'Normal']
    health_colors = ['red', 'orange', 'green']
    # Only show pie if there's data
    if sum(health_data) > 0:
        ax9.pie([x for x in health_data if x > 0], 
               labels=[l for i, l in enumerate(health_labels) if health_data[i] > 0],
               colors=[c for i, c in enumerate(health_colors) if health_data[i] > 0],
               autopct='%1.0f%%')
        ax9.set_title('System Health Overview', fontweight='bold')
    
    plt.suptitle(f'Comprehensive OBD2 Analysis Dashboard\\nOverall Health: {overall_health.upper()}', 
                fontsize=18, fontweight='bold')
    plt.show()
` : ''}

print("\\n=== FINAL ANALYSIS RESULTS ===")
print(json.dumps(analysis_results, indent=2))
`;
  }

  /**
   * Additional analysis code generators can be added here for:
   * - Fuel efficiency analysis
   * - Engine health analysis
   * - Emission analysis
   * - Driving behavior analysis
   */
  getFuelEfficiencyAnalysisCode(generatePlots = true) {
    return `
# FUEL EFFICIENCY ANALYSIS
print("\\n=== FUEL EFFICIENCY ANALYSIS ===")

analysis_results = {
    'analysis_type': 'fuel_efficiency',
    'efficiency_metrics': {},
    'driving_patterns': {},
    'recommendations': []
}

# Calculate basic efficiency metrics
if 'speed' in df.columns and 'engineLoad' in df.columns:
    valid_data = df.dropna(subset=['speed', 'engineLoad'])
    if len(valid_data) > 0:
        analysis_results['efficiency_metrics']['avg_speed'] = float(valid_data['speed'].mean())
        analysis_results['efficiency_metrics']['avg_load'] = float(valid_data['engineLoad'].mean())
        
        # Estimate efficiency based on load and speed patterns
        efficiency_score = 100 - (valid_data['engineLoad'].mean() * 0.8) - abs(valid_data['speed'].mean() - 50) * 0.3
        analysis_results['efficiency_metrics']['efficiency_score'] = max(0, min(100, efficiency_score))

# Add more fuel efficiency specific analysis...

print(json.dumps(analysis_results, indent=2))
`;
  }

  getEngineHealthAnalysisCode(generatePlots = true) {
    return `
# ENGINE HEALTH ANALYSIS
print("\\n=== ENGINE HEALTH ANALYSIS ===")

analysis_results = {
    'analysis_type': 'engine_health',
    'health_indicators': {},
    'wear_indicators': {},
    'maintenance_alerts': []
}

# Analyze engine health indicators
if 'engineTemp' in df.columns:
    temp_data = df['engineTemp'].dropna()
    if len(temp_data) > 0:
        analysis_results['health_indicators']['temperature'] = {
            'avg': float(temp_data.mean()),
            'max': float(temp_data.max()),
            'stability': float(temp_data.std())
        }

# Add more engine health specific analysis...

print(json.dumps(analysis_results, indent=2))
`;
  }

  /**
   * Parse analysis results from Python execution output
   * @param {Object} executionResult - Result from Python execution
   * @returns {Object} Parsed analysis results
   */
  parseAnalysisResults(executionResult) {
    try {
      if (!executionResult.success) {
        return {
          success: false,
          error: executionResult.error
        };
      }

      // Look for JSON results in the output
      const output = executionResult.output || '';
      
      // Find the last JSON block in the output (should be the final results)
      const jsonMatches = output.match(/\{[\s\S]*\}/g);
      
      if (jsonMatches && jsonMatches.length > 0) {
        try {
          // Try to parse the last JSON block
          const lastJson = jsonMatches[jsonMatches.length - 1];
          const results = JSON.parse(lastJson);
          
          return {
            success: true,
            results,
            rawOutput: output,
            plots: executionResult.plots || []
          };
        } catch (parseError) {
          console.log('JSON parse error, returning raw output');
          return {
            success: true,
            rawOutput: output,
            results: { raw_analysis: output },
            plots: executionResult.plots || []
          };
        }
      }

      return {
        success: true,
        rawOutput: output,
        results: { raw_analysis: output },
        plots: executionResult.plots || []
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Save analysis results to MongoDB
   * @param {string} sessionId - Session ID
   * @param {Object} analysisResults - Analysis results
   * @param {string} analysisType - Type of analysis
   * @returns {Promise}
   */
  async saveAnalysisResults(sessionId, analysisResults, analysisType) {
    try {
      // Try to save to the new DiagnosticSession model first
      const mongoose = await import('mongoose');
      
      try {
        const DiagnosticSession = mongoose.default.model('DiagnosticSession');
        await DiagnosticSession.findByIdAndUpdate(sessionId, {
          $push: {
            analysisResults: {
              analysisType,
              result: analysisResults.results,
              confidence: analysisResults.confidence || 0.8,
              generatedAt: new Date(),
              processingTime: Date.now() - (analysisResults.startTime || Date.now())
            }
          }
        });
        console.log(`Analysis results saved to DiagnosticSession: ${sessionId}`);
        return;
      } catch (modelError) {
        console.log('DiagnosticSession model not available, trying OBD2Data...');
      }

      // Fallback to legacy OBD2Data model
      await OBD2Data.findOneAndUpdate(
        { sessionId },
        {
          $push: {
            analysisResults: {
              analysisType,
              result: analysisResults.results,
              confidence: analysisResults.confidence || 0.8,
              generatedAt: new Date(),
              processingTime: Date.now() - (analysisResults.startTime || Date.now())
            }
          },
          $set: { 
            processingStatus: 'completed',
            updatedAt: new Date()
          }
        },
        { new: true, upsert: false }
      );

      console.log(`Analysis results saved to OBD2Data: ${sessionId}`);
    } catch (error) {
      console.error('Error saving analysis results:', error);
      throw error;
    }
  }

  /**
   * Get analysis results for a session
   * @param {string} sessionId - Session ID
   * @returns {Array} Analysis results
   */
  async getSessionAnalysisResults(sessionId) {
    try {
      // Try new DiagnosticSession model first
      try {
        const mongoose = await import('mongoose');
        const DiagnosticSession = mongoose.default.model('DiagnosticSession');
        const session = await DiagnosticSession.findById(sessionId).select('analysisResults');
        if (session && session.analysisResults) {
          return session.analysisResults;
        }
      } catch (modelError) {
        console.log('DiagnosticSession model not available, trying OBD2Data...');
      }

      // Fallback to legacy model
      const sessionData = await OBD2Data.findOne({ sessionId }).select('analysisResults');
      return sessionData?.analysisResults || [];
    } catch (error) {
      console.error('Error retrieving analysis results:', error);
      return [];
    }
  }
}

export default PythonExecutionService;