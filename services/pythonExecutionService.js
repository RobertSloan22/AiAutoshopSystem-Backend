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
    this.connectionCheckInProgress = false; // Prevent multiple simultaneous health checks
    this.lastConnectionCheck = 0; // Track last health check time
    this.connectionCheckInterval = 60000; // Only check connection every 60 seconds max
    // Use OS temp directory for cross-platform compatibility
    this.outputDir = path.join(os.tmpdir(), 'python_outputs');
    this.initializeService();
  }

  async initializeService() {
    try {
      // Create output directory if it doesn't exist
      await fs.mkdir(this.outputDir, { recursive: true });

      // Check connection to Python server (only once during initialization)
      await this.checkConnection();
    } catch (error) {
      console.error('Failed to initialize Python execution service:', error);
    }
  }

  async checkConnection() {
    // Prevent multiple simultaneous health checks
    if (this.connectionCheckInProgress) {
      return;
    }

    // Throttle health checks - only check if enough time has passed
    const now = Date.now();
    if (now - this.lastConnectionCheck < this.connectionCheckInterval) {
      return;
    }

    this.connectionCheckInProgress = true;
    this.lastConnectionCheck = now;

    try {
      const response = await axios.get(`${this.pythonServerUrl}/health`, { timeout: 5000 });
      this.isConnected = response.status === 200;
      console.log('✅ Python server connection status:', this.isConnected);
    } catch (error) {
      console.log('⚠️ Python server not available - will use local Python execution:', error.message);
      this.isConnected = false;
    } finally {
      this.connectionCheckInProgress = false;
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

    console.log(`📐 PYTHON EXEC: Starting execution with ID: ${executionId}`);
    console.log(`📐 PYTHON EXEC: Options:`, JSON.stringify(options));
    console.log(`📐 PYTHON EXEC: SessionId for plots: ${options.sessionId}`);
    console.log(`📐 PYTHON EXEC: Code length: ${code.length} chars`);
    console.log(`📐 PYTHON EXEC: Code includes plt.savefig: ${code.includes('plt.savefig')}`);

    try {
      // If Python server is available, use it for better performance
      if (this.isConnected) {
        console.log(`📐 PYTHON EXEC: Using server execution`);
        return await this.executeViaServer(code, executionId, { ...options, save_plots, plot_filename });
      } else {
        // Fallback to local execution
        console.log(`📐 PYTHON EXEC: Using local execution`);
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
        }, 120000); // 120 second timeout (2 minutes) for complex plots
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
        // Determine Python path based on environment
        const isWindows = process.platform === 'win32';
        const isDocker = process.env.NODE_ENV === 'production' || process.env.DOCKER_ENV === 'true';

        let pythonPath;

        if (isDocker) {
          // In Docker container, use global Python3
          pythonPath = 'python3';
        } else {
          // In development, use virtual environment
          // Try multiple possible paths for the virtual environment
          const possiblePaths = isWindows
            ? [
                path.join(process.cwd(), 'venv', 'Scripts', 'python.exe'),
                path.join(process.cwd(), 'venv', 'Scripts', 'python3.exe')
              ]
            : [
                path.join(process.cwd(), 'venv', 'bin', 'python3'),
                path.join(process.cwd(), 'venv', 'bin', 'python'),
                path.join(process.cwd(), 'venv', 'bin', 'python3.12')
              ];

          // Find the first path that exists
          pythonPath = possiblePaths.find(p => {
            try {
              return fsSync.existsSync(p);
            } catch (e) {
              return false;
            }
          });

          // If no venv Python found, fall back to system Python (will log warning)
          if (!pythonPath) {
            console.warn('⚠️  PYTHON EXEC: Virtual environment Python not found, using system Python');
            pythonPath = 'python3';
          }
        }

        console.log(`🐍 PYTHON EXEC: Using Python path: ${pythonPath}`);
        console.log(`🐍 PYTHON EXEC: Python exists: ${fsSync.existsSync(pythonPath)}`);
        console.log(`🐍 PYTHON EXEC: Environment: ${isDocker ? 'Docker' : 'Development'}`);

        // Set up virtual environment variables for non-Docker environments
        const venvPath = isDocker ? null : path.join(process.cwd(), 'venv');
        const pythonEnv = {
          ...process.env,
          PYTHONIOENCODING: 'utf-8',
          MPLBACKEND: 'Agg',  // Force matplotlib to use non-interactive backend
          DISPLAY: ''  // Disable display server
        };

        // If using venv, set proper environment variables
        if (venvPath && fsSync.existsSync(venvPath)) {
          pythonEnv.VIRTUAL_ENV = venvPath;
          pythonEnv.PYTHONPATH = path.join(venvPath, 'lib', 'python3.12', 'site-packages');
          // Update PATH to prioritize venv binaries
          pythonEnv.PATH = `${path.join(venvPath, 'bin')}${path.delimiter}${process.env.PATH}`;
          console.log(`🐍 PYTHON EXEC: Virtual env set to: ${venvPath}`);
          console.log(`🐍 PYTHON EXEC: PYTHONPATH set to: ${pythonEnv.PYTHONPATH}`);
        }

        const pythonProcess = spawn(pythonPath, [tempFile], {
          env: pythonEnv
        });

        let output = [];
        let errorOutput = [];

        pythonProcess.stdout.on('data', (data) => {
          const text = data.toString();
          output.push(text);
          console.log(`🐍 PYTHON STDOUT: ${text.substring(0, 200)}`);
        });

        pythonProcess.stderr.on('data', (data) => {
          const text = data.toString();
          errorOutput.push(text);
          console.log(`🐍 PYTHON STDERR: ${text.substring(0, 200)}`);
        });

        pythonProcess.on('error', (error) => {
          console.error(`🐍 PYTHON PROCESS ERROR: ${error.message}`);
          console.error(`🐍 Python path that failed: ${pythonPath}`);
          reject(new Error(`Failed to spawn Python process: ${error.message}`));
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
          const errorText = errorOutput.join('');

          console.log(`📐 PYTHON OUTPUT: ${outputText.substring(0, 500)}...`);
          console.log(`📐 PYTHON ERRORS: ${errorText.substring(0, 500)}...`);

          const plotPathMatches = outputText.match(/Plot saved to: (.+\.png)/g) || [];
          const extractedPaths = plotPathMatches.map(match =>
            match.replace('Plot saved to: ', '').trim()
          );

          // Check for generated plots and register them
          const plotPaths = await this.findGeneratedPlots(executionId);

          console.log(`📐 PYTHON EXEC: Output text includes 'Plot saved to': ${outputText.includes('Plot saved to')}`);
          console.log(`📐 PYTHON EXEC: Found ${plotPathMatches.length} plot paths in output`);
          console.log(`📐 PYTHON EXEC: Found ${plotPaths.length} plot files in directory`);

          // Combine both methods
          const allPlotPaths = [...new Set([...plotPaths, ...extractedPaths])];
          console.log(`📐 PYTHON EXEC: Total unique plots found: ${allPlotPaths.length}`);

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
              console.log(`📊 LOCAL PLOT SAVED: MongoDB ID: ${imageId}`);
              console.log(`📊 LOCAL PLOT SAVED: SessionId: ${options.sessionId}`);
              console.log(`📊 LOCAL PLOT SAVED: Filename: ${filename}`);

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
        }, 120000); // 120 second timeout (2 minutes) for complex plots
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
    const sessionId = options.sessionId || 'no_session';

    console.log(`📐 WRAP CODE: ExecutionId: ${executionId}`);
    console.log(`📐 WRAP CODE: SessionId: ${sessionId}`);
    console.log(`📐 WRAP CODE: save_plots: ${options.save_plots}`);

    // Escape the output directory path for Python (convert backslashes to forward slashes)
    const outputDirEscaped = this.outputDir.replace(/\\/g, '/');

    const plotSetup = options.save_plots ? `
import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend
import matplotlib.pyplot as plt
import os

# Store the original functions
_original_show = plt.show
_original_savefig = plt.savefig

# Override plt.show to save instead
def _save_show():
    plot_filename = "${options.plot_filename || `plot_${sessionId}_${executionId}_${Date.now()}`}"
    plot_path = os.path.join(r"${outputDirEscaped}", f"{plot_filename}.png")
    plt.savefig(plot_path, dpi=150, bbox_inches='tight')
    print(f"Plot saved to: {plot_path}")
    plt.close()

# Override plt.savefig to use absolute paths
def _enhanced_savefig(fname, *args, **kwargs):
    if not os.path.isabs(fname):
        # Convert relative path to absolute path in our output directory
        fname = os.path.join(r"${outputDirEscaped}", fname)
    result = _original_savefig(fname, *args, **kwargs)
    print(f"Plot saved to: {fname}")
    return result

plt.show = _save_show
plt.savefig = _enhanced_savefig
` : '';

    const finalCode = `
${plotSetup}

# User code starts here
${code}

# Ensure all plots are saved
if 'plt' in locals():
    for fig_num in plt.get_fignums():
        plt.figure(fig_num)
        plot_path = f"${outputDirEscaped}/figure_{fig_num}_${sessionId}_${executionId}_${Date.now()}.png"
        plt.savefig(plot_path, dpi=150, bbox_inches='tight')
        print(f"Plot saved to: {plot_path}")
    plt.close('all')
`;

    console.log(`📐 FINAL CODE: Wrapped code length: ${finalCode.length}`);
    console.log(`📐 FINAL CODE: Includes plt.show override: ${finalCode.includes('plt.show = _save_show')}`);
    console.log(`📐 FINAL CODE: Includes auto-save: ${finalCode.includes('plt.get_fignums')}`);

    return finalCode;
  }

  async savePlot(base64Data, filename, executionId, options = {}) {
    const plotFilename = filename || `plot_${Date.now()}`;
    const plotPath = path.join(this.outputDir, `${plotFilename}.png`);

    console.log(`🔍 PLOT DEBUG: Saving plot with sessionId: ${options.sessionId}`);
    console.log(`🔍 PLOT DEBUG: executionId: ${executionId}`);
    console.log(`🔍 PLOT DEBUG: filename: ${plotFilename}`);

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
      console.log(`📊 PLOT SAVED: MongoDB ID: ${imageId}`);
      console.log(`📊 PLOT SAVED: SessionId: ${options.sessionId}`);
      console.log(`📊 PLOT SAVED: Filename: ${plotFilename}.png`);
      console.log(`📊 PLOT SAVED: Size: ${stats.size} bytes`);

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
        'std': float(df['rpm'].std()),
        'median': float(df['rpm'].median()),
        'p95': float(df['rpm'].quantile(0.95))
    }
    analysis_results['metrics']['rpm'] = rpm_stats
    print(f"RPM - Avg: {rpm_stats['avg']:.0f}, Max: {rpm_stats['max']:.0f}, Range: {rpm_stats['max'] - rpm_stats['min']:.0f}")

if 'speed' in df.columns and df['speed'].notna().sum() > 0:
    speed_stats = {
        'avg': float(df['speed'].mean()),
        'max': float(df['speed'].max()),
        'min': float(df['speed'].min()),
        'median': float(df['speed'].median()),
        'p95': float(df['speed'].quantile(0.95))
    }
    analysis_results['metrics']['speed'] = speed_stats
    print(f"Speed - Avg: {speed_stats['avg']:.1f} km/h, Max: {speed_stats['max']:.1f} km/h")

if 'engineLoad' in df.columns and df['engineLoad'].notna().sum() > 0:
    load_stats = {
        'avg': float(df['engineLoad'].mean()),
        'max': float(df['engineLoad'].max()),
        'median': float(df['engineLoad'].median()),
        'p95': float(df['engineLoad'].quantile(0.95))
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
# Generate professional performance plots
if len(df) > 1:
    # Set professional styling
    plt.style.use('default')
    sns.set_palette("husl")

    # Create high-quality figure
    fig = plt.figure(figsize=(16, 12), dpi=300, facecolor='white')
    fig.patch.set_facecolor('white')

    # Define color scheme
    primary_color = '#2E86AB'
    secondary_color = '#A23B72'
    accent_color = '#F18F01'
    warning_color = '#C73E1D'

    # Create grid layout
    gs = fig.add_gridspec(3, 3, height_ratios=[1, 1, 0.8], hspace=0.3, wspace=0.3)

    # Main title with professional styling
    fig.suptitle('Vehicle Performance Analysis Dashboard',
                fontsize=20, fontweight='bold', y=0.95, color='#2c3e50')

    # RPM Analysis (Top Left)
    if 'rpm' in df.columns and df['rpm'].notna().sum() > 0:
        ax1 = fig.add_subplot(gs[0, 0])
        rpm_data = df['rpm'].dropna()

        # Time series with moving average
        ax1.plot(df['timestamp'], df['rpm'], color=primary_color, linewidth=1.5, alpha=0.7, label='RPM')
        if len(rpm_data) > 20:
            rpm_ma = rpm_data.rolling(window=20, center=True).mean()
            ax1.plot(df['timestamp'][rpm_data.index], rpm_ma,
                    color=warning_color, linewidth=3, alpha=0.9, label='Trend (20pt MA)')

        # Add reference lines
        if 'avg' in analysis_results['metrics']['rpm']:
            avg_rpm = analysis_results['metrics']['rpm']['avg']
            ax1.axhline(y=avg_rpm, color='gray', linestyle='--', alpha=0.6, label=f'Average ({avg_rpm:.0f})')

        ax1.set_title('Engine RPM Over Time', fontsize=14, fontweight='bold', pad=15)
        ax1.set_ylabel('RPM', fontsize=12)
        ax1.grid(True, alpha=0.3, linestyle='-', linewidth=0.5)
        ax1.legend(fontsize=10)
        ax1.spines['top'].set_visible(False)
        ax1.spines['right'].set_visible(False)

    # Speed Analysis (Top Middle)
    if 'speed' in df.columns and df['speed'].notna().sum() > 0:
        ax2 = fig.add_subplot(gs[0, 1])
        speed_data = df['speed'].dropna()

        ax2.plot(df['timestamp'], df['speed'], color=secondary_color, linewidth=1.5, alpha=0.7, label='Speed')
        if len(speed_data) > 20:
            speed_ma = speed_data.rolling(window=20, center=True).mean()
            ax2.plot(df['timestamp'][speed_data.index], speed_ma,
                    color=accent_color, linewidth=3, alpha=0.9, label='Trend (20pt MA)')

        # Speed zones
        ax2.axhline(y=50, color='green', linestyle=':', alpha=0.6, label='City Speed')
        ax2.axhline(y=100, color='orange', linestyle=':', alpha=0.6, label='Highway Speed')

        ax2.set_title('Vehicle Speed Over Time', fontsize=14, fontweight='bold', pad=15)
        ax2.set_ylabel('Speed (km/h)', fontsize=12)
        ax2.grid(True, alpha=0.3, linestyle='-', linewidth=0.5)
        ax2.legend(fontsize=10)
        ax2.spines['top'].set_visible(False)
        ax2.spines['right'].set_visible(False)

    # Engine Load Analysis (Top Right)
    if 'engineLoad' in df.columns and df['engineLoad'].notna().sum() > 0:
        ax3 = fig.add_subplot(gs[0, 2])
        load_data = df['engineLoad'].dropna()

        ax3.plot(df['timestamp'], df['engineLoad'], color=accent_color, linewidth=1.5, alpha=0.7)
        ax3.fill_between(df['timestamp'], df['engineLoad'], alpha=0.2, color=accent_color)

        # Load zones
        ax3.axhline(y=25, color='green', linestyle='--', alpha=0.7, label='Light Load')
        ax3.axhline(y=50, color='orange', linestyle='--', alpha=0.7, label='Moderate Load')
        ax3.axhline(y=75, color='red', linestyle='--', alpha=0.7, label='Heavy Load')

        ax3.set_title('Engine Load Over Time', fontsize=14, fontweight='bold', pad=15)
        ax3.set_ylabel('Load (%)', fontsize=12)
        ax3.set_ylim(0, 100)
        ax3.grid(True, alpha=0.3, linestyle='-', linewidth=0.5)
        ax3.legend(fontsize=10)
        ax3.spines['top'].set_visible(False)
        ax3.spines['right'].set_visible(False)

    # RPM vs Speed Correlation (Middle Left)
    if 'rpm' in df.columns and 'speed' in df.columns:
        ax4 = fig.add_subplot(gs[1, 0])
        valid_data = df.dropna(subset=['rpm', 'speed'])
        if len(valid_data) > 10:
            # Scatter plot with density
            scatter = ax4.scatter(valid_data['speed'], valid_data['rpm'],
                               c=valid_data.index, cmap='viridis', alpha=0.6, s=30)

            # Trend line
            if len(valid_data) > 3:
                z = np.polyfit(valid_data['speed'], valid_data['rpm'], 1)
                p = np.poly1d(z)
                ax4.plot(valid_data['speed'], p(valid_data['speed']),
                        color=warning_color, linestyle='--', linewidth=2, alpha=0.8)

            ax4.set_title('RPM vs Speed Correlation', fontsize=14, fontweight='bold', pad=15)
            ax4.set_xlabel('Speed (km/h)', fontsize=12)
            ax4.set_ylabel('RPM', fontsize=12)
            ax4.grid(True, alpha=0.3, linestyle='-', linewidth=0.5)

            # Add correlation coefficient
            corr = valid_data['rpm'].corr(valid_data['speed'])
            ax4.text(0.05, 0.95, f'r = {corr:.3f}', transform=ax4.transAxes,
                    fontsize=11, bbox=dict(boxstyle="round,pad=0.3", facecolor="white", alpha=0.8))

        ax4.spines['top'].set_visible(False)
        ax4.spines['right'].set_visible(False)

    # Performance Distribution (Middle Center)
    if 'rpm' in df.columns or 'speed' in df.columns or 'engineLoad' in df.columns:
        ax5 = fig.add_subplot(gs[1, 1])

        distributions = []
        labels = []
        colors = []

        if 'rpm' in df.columns and df['rpm'].notna().sum() > 0:
            distributions.append(df['rpm'].dropna() / 1000)  # Scale RPM for comparison
            labels.append('RPM (×1000)')
            colors.append(primary_color)

        if 'speed' in df.columns and df['speed'].notna().sum() > 0:
            distributions.append(df['speed'].dropna())
            labels.append('Speed (km/h)')
            colors.append(secondary_color)

        if 'engineLoad' in df.columns and df['engineLoad'].notna().sum() > 0:
            distributions.append(df['engineLoad'].dropna())
            labels.append('Engine Load (%)')
            colors.append(accent_color)

        if distributions:
            box_plot = ax5.boxplot(distributions, labels=labels, patch_artist=True,
                                  boxprops=dict(alpha=0.7), medianprops=dict(color='black', linewidth=2))

            for patch, color in zip(box_plot['boxes'], colors):
                patch.set_facecolor(color)

            ax5.set_title('Performance Metrics Distribution', fontsize=14, fontweight='bold', pad=15)
            ax5.grid(True, alpha=0.3, linestyle='-', linewidth=0.5)
            ax5.spines['top'].set_visible(False)
            ax5.spines['right'].set_visible(False)

    # Performance Summary (Middle Right)
    ax6 = fig.add_subplot(gs[1, 2])
    ax6.axis('off')

    # Create summary text
    summary_text = "Performance Summary\\n\\n"

    if 'rpm' in analysis_results['metrics']:
        rpm_stats = analysis_results['metrics']['rpm']
        summary_text += f"RPM Statistics:\\n"
        summary_text += f"  Average: {rpm_stats['avg']:.0f}\\n"
        summary_text += f"  Range: {rpm_stats['min']:.0f} - {rpm_stats['max']:.0f}\\n"
        summary_text += f"  95th %ile: {rpm_stats['p95']:.0f}\\n\\n"

    if 'speed' in analysis_results['metrics']:
        speed_stats = analysis_results['metrics']['speed']
        summary_text += f"Speed Statistics:\\n"
        summary_text += f"  Average: {speed_stats['avg']:.1f} km/h\\n"
        summary_text += f"  Range: {speed_stats['min']:.0f} - {speed_stats['max']:.0f}\\n"
        summary_text += f"  95th %ile: {speed_stats['p95']:.1f}\\n\\n"

    if 'engineLoad' in analysis_results['metrics']:
        load_stats = analysis_results['metrics']['engineLoad']
        summary_text += f"Engine Load Statistics:\\n"
        summary_text += f"  Average: {load_stats['avg']:.1f}%\\n"
        summary_text += f"  Maximum: {load_stats['max']:.1f}%\\n"
        summary_text += f"  95th %ile: {load_stats['p95']:.1f}%\\n"

    ax6.text(0.1, 0.9, summary_text, transform=ax6.transAxes, fontsize=11,
            verticalalignment='top', fontfamily='monospace',
            bbox=dict(boxstyle="round,pad=0.5", facecolor="#f8f9fa", edgecolor="#dee2e6"))

    # Insights and Recommendations (Bottom Span)
    ax7 = fig.add_subplot(gs[2, :])
    ax7.axis('off')

    insights_text = ""
    if analysis_results['insights']:
        insights_text += "Key Insights:\\n"
        for i, insight in enumerate(analysis_results['insights'], 1):
            insights_text += f"  {i}. {insight}\\n"

    if analysis_results['recommendations']:
        insights_text += "\\nRecommendations:\\n"
        for i, rec in enumerate(analysis_results['recommendations'], 1):
            insights_text += f"  {i}. {rec}\\n"

    if insights_text:
        ax7.text(0.05, 0.9, insights_text, transform=ax7.transAxes, fontsize=12,
                verticalalignment='top', color='#2c3e50',
                bbox=dict(boxstyle="round,pad=0.5", facecolor="#e8f4f8", edgecolor="#2E86AB", alpha=0.8))

    # Add timestamp
    timestamp = pd.Timestamp.now().strftime("%Y-%m-%d %H:%M:%S")
    fig.text(0.99, 0.01, f"Generated: {timestamp}", ha='right', va='bottom',
            fontsize=9, alpha=0.7, style='italic')

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
    'sensor_health': {},
    'health_score': 0
}

# PROFESSIONAL ENGINE TEMPERATURE ANALYSIS - Technician-grade thresholds
if 'engineTemp' in df.columns and df['engineTemp'].notna().sum() > 0:
    temp_data = df['engineTemp'].dropna()
    temp_avg = float(temp_data.mean())
    temp_max = float(temp_data.max())
    temp_min = float(temp_data.min())
    temp_std = float(temp_data.std())
    temp_median = float(temp_data.median())
    temp_p95 = float(temp_data.quantile(0.95))

    # Count temperature threshold violations for professional analysis
    critical_temp_count = len(temp_data[temp_data > 112])  # >230°F
    high_temp_count = len(temp_data[temp_data > 99])       # >210°F
    warm_temp_count = len(temp_data[temp_data > 93])       # >200°F
    cool_temp_count = len(temp_data[temp_data < 71])       # <160°F

    analysis_results['sensor_health']['engine_temperature'] = {
        'avg': temp_avg,
        'max': temp_max,
        'min': temp_min,
        'median': temp_median,
        'p95': temp_p95,
        'std': temp_std,
        'status': 'normal',
        'score': 100,
        'critical_events': critical_temp_count,
        'high_temp_events': high_temp_count,
        'warm_temp_events': warm_temp_count,
        'cool_temp_events': cool_temp_count,
        'technical_assessment': 'within_normal_range'
    }

    # CRITICAL: Immediate damage risk (>230°F/112°C)
    if critical_temp_count > 0:
        analysis_results['issues'].append(f"CRITICAL: Engine temperature exceeded 230°F ({temp_max:.1f}°F max) - {critical_temp_count} times")
        analysis_results['sensor_health']['engine_temperature']['status'] = 'critical'
        analysis_results['sensor_health']['engine_temperature']['score'] = 15
        analysis_results['sensor_health']['engine_temperature']['technical_assessment'] = 'immediate_damage_risk'
        analysis_results['recommendations'].append("IMMEDIATE SHUTDOWN - Risk of engine damage. Check cooling system, head gasket, water pump pressure")
    # HIGH: Overheating concern (>210°F/99°C)
    elif high_temp_count > 0:
        analysis_results['issues'].append(f"HIGH: Engine overheating detected ({temp_max:.1f}°F max) - {high_temp_count} instances above 210°F")
        analysis_results['sensor_health']['engine_temperature']['status'] = 'critical'
        analysis_results['sensor_health']['engine_temperature']['score'] = 35
        analysis_results['sensor_health']['engine_temperature']['technical_assessment'] = 'overheating_condition'
        analysis_results['recommendations'].append("Priority repair: Check thermostat, coolant condition, radiator efficiency, cooling fan operation")
    # WARNING: Running warm (>200°F/93°C)
    elif warm_temp_count > len(temp_data) * 0.1:
        analysis_results['warnings'].append(f"WARNING: Engine running warm ({temp_avg:.1f}°F avg) - {warm_temp_count} readings above 200°F")
        analysis_results['sensor_health']['engine_temperature']['status'] = 'warning'
        analysis_results['sensor_health']['engine_temperature']['score'] = 70
        analysis_results['sensor_health']['engine_temperature']['technical_assessment'] = 'elevated_operating_temp'
        analysis_results['recommendations'].append("Schedule diagnostic: Monitor cooling system - may indicate developing thermal management issue")
    # INFO: Too cool - thermostat issue (<160°F/71°C)
    elif cool_temp_count > len(temp_data) * 0.5:
        analysis_results['warnings'].append(f"INFO: Engine not reaching operating temperature ({temp_avg:.1f}°F avg) - {cool_temp_count} readings below 160°F")
        analysis_results['sensor_health']['engine_temperature']['status'] = 'info'
        analysis_results['sensor_health']['engine_temperature']['score'] = 85
        analysis_results['sensor_health']['engine_temperature']['technical_assessment'] = 'thermostat_concern'
        analysis_results['recommendations'].append("Check thermostat operation - may be stuck open or incorrect temperature rating")

    # Temperature stability analysis for technicians
    if temp_std > 8:  # More sensitive variance detection
        analysis_results['warnings'].append(f"Temperature instability detected (std dev: {temp_std:.1f}°F)")
        analysis_results['sensor_health']['engine_temperature']['score'] = min(analysis_results['sensor_health']['engine_temperature']['score'], 75)
        analysis_results['recommendations'].append("Check cooling system components for intermittent operation")

# Oxygen sensor analysis
if 'o2B1S1Voltage' in df.columns and df['o2B1S1Voltage'].notna().sum() > 0:
    o2_data = df['o2B1S1Voltage'].dropna()
    o2_avg = float(o2_data.mean())
    o2_std = float(o2_data.std())
    o2_min = float(o2_data.min())
    o2_max = float(o2_data.max())

    analysis_results['sensor_health']['oxygen_sensor'] = {
        'avg_voltage': o2_avg,
        'variability': o2_std,
        'min_voltage': o2_min,
        'max_voltage': o2_max,
        'status': 'normal',
        'score': 100
    }

    # O2 sensor should switch between rich (0.8V) and lean (0.2V)
    if o2_std < 0.1:
        analysis_results['warnings'].append(f"O2 sensor may be sluggish (low variability: {o2_std:.3f}V)")
        analysis_results['sensor_health']['oxygen_sensor']['status'] = 'warning'
        analysis_results['sensor_health']['oxygen_sensor']['score'] = 60
    elif o2_avg < 0.1 or o2_avg > 0.9:
        analysis_results['warnings'].append(f"O2 sensor voltage outside normal range ({o2_avg:.2f}V)")
        analysis_results['sensor_health']['oxygen_sensor']['status'] = 'warning'
        analysis_results['sensor_health']['oxygen_sensor']['score'] = 70

# PROFESSIONAL FUEL TRIM ANALYSIS - Technician-grade thresholds
if 'fuelTrimShortB1' in df.columns and df['fuelTrimShortB1'].notna().sum() > 0:
    ft_data = df['fuelTrimShortB1'].dropna()
    ft_avg = float(ft_data.mean())
    ft_std = float(ft_data.std())
    ft_max_abs = float(abs(ft_data).max())
    ft_min = float(ft_data.min())
    ft_max = float(ft_data.max())

    # Professional fuel trim thresholds
    critical_lean_count = len(ft_data[ft_data > 15])      # Severe lean >15%
    critical_rich_count = len(ft_data[ft_data < -15])     # Severe rich <-15%
    high_lean_count = len(ft_data[ft_data > 10])          # High lean >10%
    high_rich_count = len(ft_data[ft_data < -10])         # High rich <-10%
    moderate_lean_count = len(ft_data[ft_data > 6])       # Moderate lean >6%
    moderate_rich_count = len(ft_data[ft_data < -6])      # Moderate rich <-6%

    analysis_results['sensor_health']['fuel_trim'] = {
        'short_term_avg': ft_avg,
        'variability': ft_std,
        'max_absolute': ft_max_abs,
        'min_value': ft_min,
        'max_value': ft_max,
        'status': 'normal',
        'score': 100,
        'critical_lean_events': critical_lean_count,
        'critical_rich_events': critical_rich_count,
        'high_lean_events': high_lean_count,
        'high_rich_events': high_rich_count,
        'moderate_lean_events': moderate_lean_count,
        'moderate_rich_events': moderate_rich_count,
        'technical_assessment': 'within_acceptable_range'
    }

    # CRITICAL: Severe fuel trim deviation (>±15% or persistent >±12%)
    if ft_max_abs > 18 or critical_lean_count > 0 or critical_rich_count > 0:
        analysis_results['issues'].append(f"CRITICAL: Severe fuel trim deviation ({ft_avg:.1f}% avg, {ft_max_abs:.1f}% max)")
        analysis_results['sensor_health']['fuel_trim']['status'] = 'critical'
        analysis_results['sensor_health']['fuel_trim']['score'] = 25
        analysis_results['sensor_health']['fuel_trim']['technical_assessment'] = 'critical_fuel_system_fault'
        if ft_avg > 15:
            analysis_results['recommendations'].append("CRITICAL LEAN: Major vacuum leak or fuel delivery failure - immediate diagnosis required")
        elif ft_avg < -15:
            analysis_results['recommendations'].append("CRITICAL RICH: Leaking injectors or O2 sensor failure - immediate diagnosis required")
        else:
            analysis_results['recommendations'].append("Severe fuel trim instability - major fuel/air metering problem")

    # HIGH: Significant fuel trim deviation (>±10% average or frequent >±12%)
    elif ft_max_abs > 12 or abs(ft_avg) > 10 or (high_lean_count + high_rich_count) > len(ft_data) * 0.2:
        analysis_results['issues'].append(f"HIGH: Significant fuel trim deviation ({ft_avg:.1f}% avg, {ft_max_abs:.1f}% max)")
        analysis_results['sensor_health']['fuel_trim']['status'] = 'high_concern'
        analysis_results['sensor_health']['fuel_trim']['score'] = 50
        analysis_results['sensor_health']['fuel_trim']['technical_assessment'] = 'significant_adaptation_required'
        if ft_avg > 8:
            analysis_results['recommendations'].append("HIGH LEAN condition: Check intake manifold, vacuum hoses, MAF sensor, fuel pressure")
        elif ft_avg < -8:
            analysis_results['recommendations'].append("HIGH RICH condition: Check fuel pressure regulator, O2 sensors, injector leakage")
        else:
            analysis_results['recommendations'].append("Unstable fuel trims - check fuel pump performance and intake system integrity")

    # WARNING: Moderate fuel trim concern (>±6% or frequent >±8%)
    elif ft_max_abs > 8 or abs(ft_avg) > 6 or (moderate_lean_count + moderate_rich_count) > len(ft_data) * 0.3:
        analysis_results['warnings'].append(f"WARNING: Elevated fuel trims ({ft_avg:.1f}% avg, {ft_max_abs:.1f}% max)")
        analysis_results['sensor_health']['fuel_trim']['status'] = 'warning'
        analysis_results['sensor_health']['fuel_trim']['score'] = 75
        analysis_results['sensor_health']['fuel_trim']['technical_assessment'] = 'moderate_adaptation_concern'
        analysis_results['recommendations'].append("Monitor fuel system - early indication of developing air/fuel control issue")

    # INFO: Minor adaptation (>±3%)
    elif abs(ft_avg) > 3 or ft_max_abs > 5:
        analysis_results['warnings'].append(f"INFO: Minor fuel trim adaptation ({ft_avg:.1f}% avg)")
        analysis_results['sensor_health']['fuel_trim']['status'] = 'info'
        analysis_results['sensor_health']['fuel_trim']['score'] = 90
        analysis_results['sensor_health']['fuel_trim']['technical_assessment'] = 'normal_adaptation'
        analysis_results['recommendations'].append("Document for trend analysis - system adapting to maintain stoichiometric ratio")

    # Fuel trim stability analysis for technicians
    if ft_std > 4:  # More sensitive stability detection
        analysis_results['warnings'].append(f"Fuel trim instability detected (std dev: {ft_std:.1f}%)")
        analysis_results['sensor_health']['fuel_trim']['score'] = min(analysis_results['sensor_health']['fuel_trim']['score'], 70)
        analysis_results['recommendations'].append("Check for intermittent vacuum leaks or fuel delivery issues")

# Battery voltage analysis
if 'batteryVoltage' in df.columns and df['batteryVoltage'].notna().sum() > 0:
    batt_data = df['batteryVoltage'].dropna()
    batt_avg = float(batt_data.mean())
    batt_min = float(batt_data.min())

    analysis_results['sensor_health']['battery'] = {
        'avg_voltage': batt_avg,
        'min_voltage': batt_min,
        'status': 'normal',
        'score': 100
    }

    if batt_min < 11.5:
        analysis_results['issues'].append(f"Critical battery voltage drop ({batt_min:.1f}V)")
        analysis_results['sensor_health']['battery']['status'] = 'critical'
        analysis_results['sensor_health']['battery']['score'] = 20
    elif batt_avg < 12.0:
        analysis_results['warnings'].append(f"Low battery voltage detected ({batt_avg:.1f}V)")
        analysis_results['sensor_health']['battery']['status'] = 'warning'
        analysis_results['sensor_health']['battery']['score'] = 60

# Calculate overall health score
sensor_scores = [sensor.get('score', 100) for sensor in analysis_results['sensor_health'].values()]
if sensor_scores:
    analysis_results['health_score'] = sum(sensor_scores) / len(sensor_scores)

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
print(f"Health Score: {analysis_results['health_score']:.1f}/100")
print(f"Issues: {issue_count}, Warnings: {warning_count}")

${generatePlots ? `
# Generate professional diagnostic plots
if len(df) > 1:
    # Set professional styling
    plt.style.use('default')

    # Create high-quality figure
    fig = plt.figure(figsize=(18, 14), dpi=300, facecolor='white')
    fig.patch.set_facecolor('white')

    # Professional color scheme
    temp_color = '#E74C3C'      # Red for temperature
    o2_color = '#3498DB'        # Blue for O2
    fuel_color = '#9B59B6'      # Purple for fuel
    battery_color = '#F39C12'   # Orange for battery
    normal_color = '#27AE60'    # Green for normal ranges
    warning_color = '#F39C12'   # Orange for warnings
    critical_color = '#E74C3C'  # Red for critical

    # Create grid layout
    gs = fig.add_gridspec(3, 3, height_ratios=[1, 1, 0.6], hspace=0.35, wspace=0.3)

    # Main title
    status_color = {'excellent': '#27AE60', 'good': '#2ECC71', 'fair': '#F39C12', 'poor': '#E74C3C'}.get(
        analysis_results['health_status'], '#2C3E50')
    fig.suptitle(f'Diagnostic Analysis Dashboard - Status: {analysis_results["health_status"].upper()}',
                fontsize=20, fontweight='bold', y=0.95, color=status_color)

    # Engine Temperature (Top Left)
    if 'engineTemp' in df.columns and df['engineTemp'].notna().sum() > 0:
        ax1 = fig.add_subplot(gs[0, 0])
        temp_data = df['engineTemp'].dropna()

        # Plot temperature with gradient fill
        ax1.plot(df['timestamp'], df['engineTemp'], color=temp_color, linewidth=2, alpha=0.8)
        ax1.fill_between(df['timestamp'], df['engineTemp'], alpha=0.2, color=temp_color)

        # Add critical thresholds
        ax1.axhline(y=85, color=normal_color, linestyle='-', alpha=0.7, linewidth=2, label='Normal (85°C)')
        ax1.axhline(y=95, color=warning_color, linestyle='--', alpha=0.8, linewidth=2, label='Warning (95°C)')
        ax1.axhline(y=105, color=critical_color, linestyle='--', alpha=0.8, linewidth=2, label='Critical (105°C)')

        # Highlight critical zones
        ax1.axhspan(105, ax1.get_ylim()[1], alpha=0.1, color=critical_color)
        ax1.axhspan(95, 105, alpha=0.1, color=warning_color)

        ax1.set_title('Engine Temperature Analysis', fontsize=14, fontweight='bold', pad=15)
        ax1.set_ylabel('Temperature (°C)', fontsize=12)
        ax1.grid(True, alpha=0.3, linestyle='-', linewidth=0.5)
        ax1.legend(fontsize=10, loc='upper left')
        ax1.spines['top'].set_visible(False)
        ax1.spines['right'].set_visible(False)

        # Add statistics box
        temp_stats = analysis_results['sensor_health'].get('engine_temperature', {})
        stats_text = f"Avg: {temp_stats.get('avg', 0):.1f}°C\\nMax: {temp_stats.get('max', 0):.1f}°C\\nScore: {temp_stats.get('score', 100):.0f}/100"
        ax1.text(0.02, 0.98, stats_text, transform=ax1.transAxes, fontsize=10,
                verticalalignment='top', bbox=dict(boxstyle="round,pad=0.3", facecolor="white", alpha=0.8))

    # O2 Sensor Voltage (Top Middle)
    if 'o2B1S1Voltage' in df.columns and df['o2B1S1Voltage'].notna().sum() > 0:
        ax2 = fig.add_subplot(gs[0, 1])

        ax2.plot(df['timestamp'], df['o2B1S1Voltage'], color=o2_color, linewidth=1.5, alpha=0.8)

        # O2 sensor reference ranges
        ax2.axhline(y=0.45, color=normal_color, linestyle='-', alpha=0.8, linewidth=2, label='Stoichiometric (0.45V)')
        ax2.axhspan(0.2, 0.8, alpha=0.1, color=normal_color, label='Normal Range')
        ax2.axhline(y=0.2, color='gray', linestyle=':', alpha=0.6, label='Lean (0.2V)')
        ax2.axhline(y=0.8, color='gray', linestyle=':', alpha=0.6, label='Rich (0.8V)')

        ax2.set_title('O2 Sensor Voltage (Bank 1, Sensor 1)', fontsize=14, fontweight='bold', pad=15)
        ax2.set_ylabel('Voltage (V)', fontsize=12)
        ax2.set_ylim(0, 1.0)
        ax2.grid(True, alpha=0.3, linestyle='-', linewidth=0.5)
        ax2.legend(fontsize=9, loc='upper right')
        ax2.spines['top'].set_visible(False)
        ax2.spines['right'].set_visible(False)

        # Add statistics
        o2_stats = analysis_results['sensor_health'].get('oxygen_sensor', {})
        stats_text = f"Avg: {o2_stats.get('avg_voltage', 0):.3f}V\\nStd: {o2_stats.get('variability', 0):.3f}V\\nScore: {o2_stats.get('score', 100):.0f}/100"
        ax2.text(0.02, 0.98, stats_text, transform=ax2.transAxes, fontsize=10,
                verticalalignment='top', bbox=dict(boxstyle="round,pad=0.3", facecolor="white", alpha=0.8))

    # Fuel Trim Analysis (Top Right)
    if 'fuelTrimShortB1' in df.columns and df['fuelTrimShortB1'].notna().sum() > 0:
        ax3 = fig.add_subplot(gs[0, 2])

        ax3.plot(df['timestamp'], df['fuelTrimShortB1'], color=fuel_color, linewidth=1.5, alpha=0.8)
        ax3.axhline(y=0, color=normal_color, linestyle='-', alpha=0.8, linewidth=2, label='Ideal (0%)')

        # Fuel trim zones
        ax3.axhspan(-5, 5, alpha=0.1, color=normal_color, label='Normal Range')
        ax3.axhspan(-10, -5, alpha=0.1, color=warning_color)
        ax3.axhspan(5, 10, alpha=0.1, color=warning_color)
        ax3.axhspan(-25, -10, alpha=0.1, color=critical_color)
        ax3.axhspan(10, 25, alpha=0.1, color=critical_color)

        ax3.axhline(y=10, color=warning_color, linestyle='--', alpha=0.7, label='Warning (±10%)')
        ax3.axhline(y=-10, color=warning_color, linestyle='--', alpha=0.7)
        ax3.axhline(y=25, color=critical_color, linestyle='--', alpha=0.7, label='Critical (±25%)')
        ax3.axhline(y=-25, color=critical_color, linestyle='--', alpha=0.7)

        ax3.set_title('Short Term Fuel Trim (Bank 1)', fontsize=14, fontweight='bold', pad=15)
        ax3.set_ylabel('Fuel Trim (%)', fontsize=12)
        ax3.grid(True, alpha=0.3, linestyle='-', linewidth=0.5)
        ax3.legend(fontsize=9, loc='upper right')
        ax3.spines['top'].set_visible(False)
        ax3.spines['right'].set_visible(False)

        # Add statistics
        ft_stats = analysis_results['sensor_health'].get('fuel_trim', {})
        stats_text = f"Avg: {ft_stats.get('short_term_avg', 0):.1f}%\\nMax: ±{ft_stats.get('max_absolute', 0):.1f}%\\nScore: {ft_stats.get('score', 100):.0f}/100"
        ax3.text(0.02, 0.98, stats_text, transform=ax3.transAxes, fontsize=10,
                verticalalignment='top', bbox=dict(boxstyle="round,pad=0.3", facecolor="white", alpha=0.8))

    # Battery Voltage (Middle Left)
    if 'batteryVoltage' in df.columns and df['batteryVoltage'].notna().sum() > 0:
        ax4 = fig.add_subplot(gs[1, 0])

        ax4.plot(df['timestamp'], df['batteryVoltage'], color=battery_color, linewidth=1.5, alpha=0.8)
        ax4.fill_between(df['timestamp'], df['batteryVoltage'], alpha=0.2, color=battery_color)

        # Battery voltage thresholds
        ax4.axhline(y=12.6, color=normal_color, linestyle='-', alpha=0.8, linewidth=2, label='Fully Charged (12.6V)')
        ax4.axhline(y=12.0, color=warning_color, linestyle='--', alpha=0.7, label='Warning (12.0V)')
        ax4.axhline(y=11.5, color=critical_color, linestyle='--', alpha=0.7, label='Critical (11.5V)')

        # Highlight zones
        ax4.axhspan(ax4.get_ylim()[0], 11.5, alpha=0.1, color=critical_color)
        ax4.axhspan(11.5, 12.0, alpha=0.1, color=warning_color)

        ax4.set_title('Battery Voltage Monitoring', fontsize=14, fontweight='bold', pad=15)
        ax4.set_ylabel('Voltage (V)', fontsize=12)
        ax4.grid(True, alpha=0.3, linestyle='-', linewidth=0.5)
        ax4.legend(fontsize=10, loc='lower right')
        ax4.spines['top'].set_visible(False)
        ax4.spines['right'].set_visible(False)

        # Add statistics
        batt_stats = analysis_results['sensor_health'].get('battery', {})
        stats_text = f"Avg: {batt_stats.get('avg_voltage', 0):.2f}V\\nMin: {batt_stats.get('min_voltage', 0):.2f}V\\nScore: {batt_stats.get('score', 100):.0f}/100"
        ax4.text(0.02, 0.98, stats_text, transform=ax4.transAxes, fontsize=10,
                verticalalignment='top', bbox=dict(boxstyle="round,pad=0.3", facecolor="white", alpha=0.8))

    # Health Score Gauge (Middle Center)
    ax5 = fig.add_subplot(gs[1, 1])

    # Create circular gauge
    health_score = analysis_results.get('health_score', 0)

    # Define score ranges and colors
    if health_score >= 90:
        score_color = '#27AE60'
        score_label = 'Excellent'
    elif health_score >= 75:
        score_color = '#2ECC71'
        score_label = 'Good'
    elif health_score >= 50:
        score_color = '#F39C12'
        score_label = 'Fair'
    else:
        score_color = '#E74C3C'
        score_label = 'Poor'

    # Create pie chart for health score
    sizes = [health_score, 100 - health_score]
    colors = [score_color, '#ECF0F1']

    wedges, texts = ax5.pie(sizes, colors=colors, startangle=90, counterclock=False,
                           wedgeprops=dict(width=0.3, edgecolor='white', linewidth=2))

    # Add center text
    ax5.text(0, 0, f'{health_score:.0f}\\n{score_label}', ha='center', va='center',
            fontsize=16, fontweight='bold', color=score_color)

    ax5.set_title('Overall Health Score', fontsize=14, fontweight='bold', pad=15)

    # Sensor Status Summary (Middle Right)
    ax6 = fig.add_subplot(gs[1, 2])
    ax6.axis('off')

    # Create status summary
    status_text = "Sensor Status Summary\\n\\n"

    for sensor, data in analysis_results['sensor_health'].items():
        sensor_name = sensor.replace('_', ' ').title()
        status = data.get('status', 'unknown')
        score = data.get('score', 0)

        status_icon = {'excellent': '✓', 'normal': '✓', 'good': '!', 'warning': '⚠', 'critical': '✗', 'poor': '✗'}.get(status, '?')
        status_color_map = {'excellent': '#27AE60', 'normal': '#27AE60', 'good': '#2ECC71', 'warning': '#F39C12', 'critical': '#E74C3C', 'poor': '#E74C3C'}

        status_text += f"{status_icon} {sensor_name}\\n"
        status_text += f"   Score: {score:.0f}/100\\n"
        status_text += f"   Status: {status.title()}\\n\\n"

    ax6.text(0.1, 0.9, status_text, transform=ax6.transAxes, fontsize=11,
            verticalalignment='top', fontfamily='monospace',
            bbox=dict(boxstyle="round,pad=0.5", facecolor="#f8f9fa", edgecolor="#dee2e6"))

    # Issues and Recommendations (Bottom Span)
    ax7 = fig.add_subplot(gs[2, :])
    ax7.axis('off')

    info_text = ""

    if analysis_results['issues']:
        info_text += "🔴 CRITICAL ISSUES:\\n"
        for i, issue in enumerate(analysis_results['issues'], 1):
            info_text += f"  {i}. {issue}\\n"
        info_text += "\\n"

    if analysis_results['warnings']:
        info_text += "🟡 WARNINGS:\\n"
        for i, warning in enumerate(analysis_results['warnings'], 1):
            info_text += f"  {i}. {warning}\\n"
        info_text += "\\n"

    if analysis_results['recommendations']:
        info_text += "💡 RECOMMENDATIONS:\\n"
        for i, rec in enumerate(analysis_results['recommendations'], 1):
            info_text += f"  {i}. {rec}\\n"

    if not info_text:
        info_text = "✅ All systems are operating within normal parameters."

    # Color code the background based on health status
    bg_color = {'excellent': '#e8f5e8', 'good': '#e8f5e8', 'fair': '#fff3cd', 'poor': '#f8d7da'}
    border_color = {'excellent': '#27AE60', 'good': '#27AE60', 'fair': '#F39C12', 'poor': '#E74C3C'}

    ax7.text(0.05, 0.9, info_text, transform=ax7.transAxes, fontsize=11,
            verticalalignment='top', color='#2c3e50',
            bbox=dict(boxstyle="round,pad=0.5",
                     facecolor=bg_color.get(analysis_results['health_status'], '#f8f9fa'),
                     edgecolor=border_color.get(analysis_results['health_status'], '#dee2e6'),
                     alpha=0.9))

    # Add timestamp and metadata
    timestamp = pd.Timestamp.now().strftime("%Y-%m-%d %H:%M:%S")
    fig.text(0.99, 0.01, f"Generated: {timestamp}", ha='right', va='bottom',
            fontsize=9, alpha=0.7, style='italic')

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

# Engine temperature check (Professional standards)
if 'engineTemp' in df.columns and df['engineTemp'].notna().sum() > 0:
    temp_max = float(df['engineTemp'].max())
    temp_avg = float(df['engineTemp'].mean())
    temp_min = float(df['engineTemp'].min())

    diagnostic_results['engine_temperature'] = {
        'max': temp_max,
        'avg': temp_avg,
        'min': temp_min,
        'status': 'normal'
    }

    # Professional automotive thresholds
    if temp_max > 110:
        issues.append(f"CRITICAL: Engine severely overheating ({temp_max:.1f}°C) - Risk of engine damage")
        diagnostic_results['engine_temperature']['status'] = 'critical'
    elif temp_max > 105:
        issues.append(f"Engine overheating detected ({temp_max:.1f}°C) - Immediate attention required")
        diagnostic_results['engine_temperature']['status'] = 'critical'
    elif temp_max > 100:
        warnings.append(f"Engine temperature high ({temp_max:.1f}°C) - Monitor cooling system")
        diagnostic_results['engine_temperature']['status'] = 'warning'
    elif temp_avg > 95:
        warnings.append(f"Engine running warm (avg: {temp_avg:.1f}°C) - Check coolant level and thermostat")
        diagnostic_results['engine_temperature']['status'] = 'warning'
    elif temp_avg < 70 and len(df) > 50:
        warnings.append(f"Engine not reaching operating temperature (avg: {temp_avg:.1f}°C) - Possible thermostat issue")
        diagnostic_results['engine_temperature']['status'] = 'warning'

    # Check for rapid temperature fluctuations
    if len(df) > 10:
        temp_diff = df['engineTemp'].diff().abs()
        max_change = float(temp_diff.max())
        if max_change > 15:
            warnings.append(f"Rapid temperature fluctuation detected ({max_change:.1f}°C/reading) - Check cooling system")
            diagnostic_results['engine_temperature']['status'] = 'warning'

# O2 sensor check (Professional standards)
if 'o2B1S1Voltage' in df.columns and df['o2B1S1Voltage'].notna().sum() > 0:
    o2_avg = float(df['o2B1S1Voltage'].mean())
    o2_max = float(df['o2B1S1Voltage'].max())
    o2_min = float(df['o2B1S1Voltage'].min())
    o2_std = float(df['o2B1S1Voltage'].std())

    diagnostic_results['oxygen_sensor'] = {
        'avg_voltage': o2_avg,
        'max_voltage': o2_max,
        'min_voltage': o2_min,
        'variability': o2_std,
        'status': 'normal'
    }

    # Professional O2 sensor analysis (normal range: 0.1-0.9V, cycling around 0.45V)
    if o2_avg < 0.1 or o2_avg > 0.9:
        issues.append(f"O2 sensor out of range ({o2_avg:.2f}V) - Sensor may be failing")
        diagnostic_results['oxygen_sensor']['status'] = 'critical'
    elif o2_avg < 0.15 or o2_avg > 0.85:
        warnings.append(f"O2 sensor voltage extreme ({o2_avg:.2f}V) - Check for lean/rich condition")
        diagnostic_results['oxygen_sensor']['status'] = 'warning'
    elif abs(o2_avg - 0.45) > 0.25:
        warnings.append(f"O2 sensor biased ({o2_avg:.2f}V, expected ~0.45V) - Possible fuel system issue")
        diagnostic_results['oxygen_sensor']['status'] = 'warning'

    # Check for dead/lazy sensor (insufficient variability)
    if o2_std < 0.05 and len(df) > 30:
        warnings.append(f"O2 sensor not switching properly (std: {o2_std:.3f}V) - Sensor may be contaminated")
        diagnostic_results['oxygen_sensor']['status'] = 'warning'
    elif o2_max - o2_min < 0.2 and len(df) > 30:
        warnings.append(f"O2 sensor limited range ({o2_min:.2f}-{o2_max:.2f}V) - Sensor aging or contamination")
        diagnostic_results['oxygen_sensor']['status'] = 'warning'

# Fuel system check (Professional standards)
if 'fuelTrimShortB1' in df.columns and df['fuelTrimShortB1'].notna().sum() > 0:
    ft_avg = float(df['fuelTrimShortB1'].mean())
    ft_max = float(df['fuelTrimShortB1'].max())
    ft_min = float(df['fuelTrimShortB1'].min())
    ft_abs_max = float(max(abs(ft_max), abs(ft_min)))

    diagnostic_results['fuel_system'] = {
        'short_term_trim_avg': ft_avg,
        'max_trim': ft_max,
        'min_trim': ft_min,
        'status': 'normal'
    }

    # Professional fuel trim standards (normal: ±5%, acceptable: ±8%, problem: >±10%)
    if ft_abs_max > 20:
        issues.append(f"SEVERE fuel trim problem ({ft_avg:+.1f}%, max: {ft_abs_max:.1f}%) - Major air/fuel issue")
        diagnostic_results['fuel_system']['status'] = 'critical'
    elif ft_abs_max > 12:
        issues.append(f"Significant fuel trim deviation ({ft_avg:+.1f}%, max: {ft_abs_max:.1f}%) - Check for vacuum leaks or injector issues")
        diagnostic_results['fuel_system']['status'] = 'critical'
    elif abs(ft_avg) > 10:
        warnings.append(f"High average fuel trim ({ft_avg:+.1f}%) - ECU compensating heavily")
        diagnostic_results['fuel_system']['status'] = 'warning'
    elif abs(ft_avg) > 5:
        warnings.append(f"Elevated fuel trim ({ft_avg:+.1f}%) - Minor compensation detected")
        diagnostic_results['fuel_system']['status'] = 'warning'
    elif ft_abs_max > 15:
        warnings.append(f"Occasional high fuel trim spikes (max: {ft_abs_max:.1f}%) - Investigate fuel delivery")
        diagnostic_results['fuel_system']['status'] = 'warning'

    # Check for both short and long term trim if available
    if 'fuelTrimLongB1' in df.columns and df['fuelTrimLongB1'].notna().sum() > 0:
        lt_avg = float(df['fuelTrimLongB1'].mean())
        diagnostic_results['fuel_system']['long_term_trim'] = lt_avg

        total_trim = abs(ft_avg) + abs(lt_avg)
        if total_trim > 20:
            issues.append(f"Combined fuel trim excessive (ST: {ft_avg:+.1f}%, LT: {lt_avg:+.1f}%) - System unable to compensate")
            diagnostic_results['fuel_system']['status'] = 'critical'
        elif total_trim > 15:
            warnings.append(f"Combined fuel trim high (ST: {ft_avg:+.1f}%, LT: {lt_avg:+.1f}%) - Monitor closely")
            diagnostic_results['fuel_system']['status'] = 'warning'

# Additional professional diagnostic checks

# Battery voltage check
if 'batteryVoltage' in df.columns and df['batteryVoltage'].notna().sum() > 0:
    batt_avg = float(df['batteryVoltage'].mean())
    batt_min = float(df['batteryVoltage'].min())
    batt_max = float(df['batteryVoltage'].max())

    diagnostic_results['battery'] = {
        'avg_voltage': batt_avg,
        'min_voltage': batt_min,
        'max_voltage': batt_max,
        'status': 'normal'
    }

    # Professional battery thresholds (running: 13.5-14.5V, off/idle: 12.4-12.8V)
    if 'rpm' in df.columns and df['rpm'].notna().sum() > 0:
        high_rpm_voltage = df[df['rpm'] > 1500]['batteryVoltage'].mean() if len(df[df['rpm'] > 1500]) > 0 else batt_avg

        if high_rpm_voltage > 15.0:
            warnings.append(f"Overcharging detected ({high_rpm_voltage:.2f}V) - Voltage regulator issue")
            diagnostic_results['battery']['status'] = 'warning'
        elif high_rpm_voltage < 13.0:
            warnings.append(f"Undercharging ({high_rpm_voltage:.2f}V) - Alternator or battery issue")
            diagnostic_results['battery']['status'] = 'warning'

    if batt_min < 11.5:
        issues.append(f"Critical low voltage detected ({batt_min:.2f}V) - Battery/charging system failure")
        diagnostic_results['battery']['status'] = 'critical'
    elif batt_min < 12.0:
        warnings.append(f"Low voltage detected ({batt_min:.2f}V) - Weak battery or charging issue")
        diagnostic_results['battery']['status'] = 'warning'

# MAF sensor check
if 'maf' in df.columns and df['maf'].notna().sum() > 0:
    maf_avg = float(df['maf'].mean())
    maf_max = float(df['maf'].max())

    diagnostic_results['mass_air_flow'] = {
        'avg_gps': maf_avg,
        'max_gps': maf_max,
        'status': 'normal'
    }

    # Check for MAF correlation with RPM and throttle
    if 'rpm' in df.columns and 'throttlePosition' in df.columns:
        valid_data = df.dropna(subset=['maf', 'rpm', 'throttlePosition'])
        if len(valid_data) > 20:
            # MAF should correlate with throttle and RPM
            corr_throttle = valid_data[['maf', 'throttlePosition']].corr().iloc[0, 1]
            if corr_throttle < 0.3:
                warnings.append(f"MAF sensor not responding to throttle (corr: {corr_throttle:.2f}) - Possible sensor contamination")
                diagnostic_results['mass_air_flow']['status'] = 'warning'

# Throttle position sensor check
if 'throttlePosition' in df.columns and df['throttlePosition'].notna().sum() > 0:
    throttle_avg = float(df['throttlePosition'].mean())
    throttle_max = float(df['throttlePosition'].max())
    throttle_min = float(df['throttlePosition'].min())

    diagnostic_results['throttle_position'] = {
        'avg': throttle_avg,
        'max': throttle_max,
        'min': throttle_min,
        'status': 'normal'
    }

    # Check for stuck throttle or abnormal behavior
    if len(df) > 30:
        throttle_std = float(df['throttlePosition'].std())
        if throttle_std < 2 and throttle_avg > 10:
            warnings.append(f"Throttle position not varying (avg: {throttle_avg:.1f}%, std: {throttle_std:.1f}) - Check TPS or drive pattern")
            diagnostic_results['throttle_position']['status'] = 'warning'

# RPM and load correlation check
if 'rpm' in df.columns and 'engineLoad' in df.columns and 'speed' in df.columns:
    valid_data = df.dropna(subset=['rpm', 'engineLoad', 'speed'])
    if len(valid_data) > 30:
        # Check for abnormal constant RPM with varying speed (transmission slip)
        rpm_std = float(valid_data['rpm'].std())
        speed_std = float(valid_data['speed'].std())

        if speed_std > 10 and rpm_std < 50:
            warnings.append(f"RPM constant ({valid_data['rpm'].mean():.0f}) while speed varies - Possible transmission issue")

        # Check for high load at low RPM (lugging)
        high_load_low_rpm = valid_data[(valid_data['engineLoad'] > 80) & (valid_data['rpm'] < 2000)]
        if len(high_load_low_rpm) > len(valid_data) * 0.1:
            warnings.append("Engine lugging detected (high load at low RPM) - Can cause engine damage")

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

# PROFESSIONAL HOLISTIC HEALTH SCORING SYSTEM
# This system evaluates overall vehicle health by considering:
# 1. Data quality and sample size
# 2. Weighted severity of issues (critical systems vs. convenience)
# 3. Cross-system correlations and patterns
# 4. Missing critical sensor data

critical_issues = len(issues)
warning_count = len(warnings)

# Start with base score of 100
health_score = 100.0

# Data quality penalty
data_quality_score = 0
if len(df) < 10:
    data_quality_score -= 30
    warnings.append(f"Insufficient data for reliable analysis ({len(df)} points) - Results may be unreliable")
elif len(df) < 30:
    data_quality_score -= 15
    warnings.append(f"Limited data sample ({len(df)} points) - Extended monitoring recommended")
elif len(df) < 100:
    data_quality_score -= 5

# Apply data quality penalty
health_score += data_quality_score

# Critical issues have severe impact (weighted by system importance)
critical_system_issues = 0
major_system_issues = 0
minor_issues = 0

for issue in issues:
    issue_lower = issue.lower()
    # Critical systems: Engine temp, fuel trim, O2 sensor (affects drivability/safety)
    if any(keyword in issue_lower for keyword in ['overheating', 'severe', 'critical:', 'battery', 'o2 sensor out']):
        critical_system_issues += 1
        health_score -= 25  # Severe penalty
    # Major systems: Fuel system, charging
    elif any(keyword in issue_lower for keyword in ['fuel trim', 'voltage', 'significant']):
        major_system_issues += 1
        health_score -= 15  # Major penalty
    else:
        minor_issues += 1
        health_score -= 10  # Standard penalty

# Warning penalties (less severe but still important)
critical_warnings = 0
major_warnings = 0
minor_warnings = 0

for warning in warnings:
    warning_lower = warning.lower()
    # Critical warnings: Temperature issues, fuel trim problems, sensor failures
    if any(keyword in issue_lower for keyword in ['temperature', 'fuel trim', 'sensor', 'voltage', 'charging']):
        critical_warnings += 1
        health_score -= 8
    # Major warnings: Performance issues, efficiency problems
    elif any(keyword in warning_lower for keyword in ['load', 'rpm', 'correlation', 'lugging']):
        major_warnings += 1
        health_score -= 5
    else:
        minor_warnings += 1
        health_score -= 3

# Missing critical sensor penalty
critical_sensors = ['engineTemp', 'rpm', 'speed']
missing_critical = [sensor for sensor in critical_sensors if sensor not in df.columns or df[sensor].notna().sum() == 0]
if missing_critical:
    health_score -= len(missing_critical) * 5
    warnings.append(f"Missing critical sensor data: {', '.join(missing_critical)}")

# Important sensor penalty (less severe)
important_sensors = ['o2B1S1Voltage', 'fuelTrimShortB1', 'engineLoad', 'throttlePosition']
missing_important = [sensor for sensor in important_sensors if sensor not in df.columns or df[sensor].notna().sum() == 0]
if missing_important:
    health_score -= len(missing_important) * 2

# Bonus for clean bill of health (rare, as it should be)
if critical_issues == 0 and warning_count == 0 and len(df) >= 100:
    health_score += 5  # Small bonus for truly clean system with good data

# Clamp score to 0-100 range
health_score = max(0.0, min(100.0, health_score))

# Determine overall health grade with professional standards
# Professional mechanics don't often see "excellent" systems - most have some issues
if health_score >= 95 and critical_issues == 0 and warning_count == 0:
    overall_health = 'excellent'
    health_description = 'All systems operating optimally'
elif health_score >= 85 and critical_issues == 0:
    overall_health = 'very_good'
    health_description = 'Minor issues present, but no immediate concerns'
elif health_score >= 70 and critical_issues == 0:
    overall_health = 'good'
    health_description = 'Some attention needed, but vehicle is safe to operate'
elif health_score >= 55:
    overall_health = 'fair'
    health_description = 'Multiple issues require attention soon'
elif health_score >= 35:
    overall_health = 'poor'
    health_description = 'Significant problems detected - service recommended'
else:
    overall_health = 'critical'
    health_description = 'Serious issues require immediate professional attention'

# Generate context-aware recommendations
recommendations = []

# Critical issue recommendations (highest priority)
if critical_system_issues > 0:
    recommendations.append("🔴 URGENT: Critical system issues detected - Do NOT drive until inspected by professional mechanic")
if major_system_issues > 0:
    recommendations.append("🟠 IMPORTANT: Major system problems require immediate professional diagnosis")

# Data-driven recommendations
if critical_issues > 0:
    recommendations.append("Schedule professional diagnostic scan to identify all fault codes")

if warning_count >= 5:
    recommendations.append("Multiple warnings indicate systemic issues - comprehensive inspection recommended")
elif warning_count >= 3:
    recommendations.append("Several warnings detected - preventive maintenance advised")

# System-specific recommendations
for sensor, data in diagnostic_results.items():
    if data.get('status') == 'critical':
        sensor_name = sensor.replace('_', ' ').title()
        recommendations.append(f"Address {sensor_name} issue immediately")
    elif data.get('status') == 'warning' and len(recommendations) < 8:
        sensor_name = sensor.replace('_', ' ').title()
        recommendations.append(f"Monitor {sensor_name} - may require service")

# Performance-based recommendations
if 'performance' in analysis_results and 'rpm' in analysis_results['performance']:
    if analysis_results['performance']['rpm']['operating_range'] == 'high':
        recommendations.append("High RPM operation detected - review driving style to reduce engine wear")

if fuel_efficiency.get('driving_style') == 'aggressive':
    recommendations.append("Aggressive driving pattern - smoother inputs can improve fuel economy and reduce wear")

# Data quality recommendations
if len(df) < 30:
    recommendations.append("Collect more data over longer drive cycles for comprehensive analysis")

# Maintenance recommendations based on patterns
if 'engine_temperature' in diagnostic_results and diagnostic_results['engine_temperature'].get('avg', 0) > 90:
    recommendations.append("Consider coolant system service - temperatures trending high")

analysis_results['recommendations'] = recommendations
analysis_results['health_score'] = round(health_score, 1)
analysis_results['health_description'] = health_description
analysis_results['data_quality'] = 'excellent' if len(df) >= 100 else 'good' if len(df) >= 30 else 'fair' if len(df) >= 10 else 'poor'

analysis_results['overall_health'] = overall_health

# Summary
analysis_results['summary'] = {
    'data_points': len(df),
    'session_duration_minutes': float((df['timestamp'].max() - df['timestamp'].min()).total_seconds() / 60) if len(df) > 1 else 0,
    'critical_issues': critical_issues,
    'warnings': warning_count,
    'overall_health': overall_health,
    'health_score': round(health_score, 1),
    'health_description': health_description,
    'data_quality': analysis_results['data_quality'],
    'critical_system_issues': critical_system_issues,
    'major_system_issues': major_system_issues,
    'key_findings': []
}

# Add professional key findings
if critical_system_issues > 0:
    analysis_results['summary']['key_findings'].append(f"🔴 {critical_system_issues} critical system issue(s) - URGENT attention required")
if major_system_issues > 0:
    analysis_results['summary']['key_findings'].append(f"🟠 {major_system_issues} major system issue(s) - Prompt service needed")
if warning_count > 5:
    analysis_results['summary']['key_findings'].append(f"⚠️  {warning_count} warnings detected - Comprehensive inspection recommended")
elif warning_count > 0:
    analysis_results['summary']['key_findings'].append(f"{warning_count} warning(s) - Monitor and address as needed")

# System-specific findings
systems_checked = len(diagnostic_results)
systems_with_issues = sum(1 for s in diagnostic_results.values() if s.get('status') in ['warning', 'critical'])
analysis_results['summary']['key_findings'].append(f"Evaluated {systems_checked} system(s), {systems_with_issues} require attention")

if fuel_efficiency.get('efficiency_score'):
    analysis_results['summary']['key_findings'].append(f"Fuel efficiency score: {fuel_efficiency['efficiency_score']:.1f}/100 ({fuel_efficiency['driving_style']} driving)")

if 'performance' in analysis_results and 'rpm' in analysis_results['performance']:
    avg_rpm = analysis_results['performance']['rpm']['avg']
    analysis_results['summary']['key_findings'].append(f"Average RPM: {avg_rpm:.0f} ({analysis_results['performance']['rpm']['operating_range']} range)")

# Data quality finding
if len(df) < 30:
    analysis_results['summary']['key_findings'].append(f"Limited data sample - Extended monitoring recommended for accurate diagnosis")

print(f"\\n{'='*60}")
print(f"PROFESSIONAL OBD2 ANALYSIS SUMMARY")
print(f"{'='*60}")
print(f"Data Points Analyzed: {len(df)}")
print(f"Session Duration: {analysis_results['summary']['session_duration_minutes']:.1f} minutes")
print(f"Data Quality: {analysis_results['data_quality'].upper()}")
print(f"\\nHealth Score: {health_score:.1f}/100")
print(f"Overall Health: {overall_health.upper()}")
print(f"Description: {health_description}")
print(f"\\nIssue Breakdown:")
print(f"  Critical System Issues: {critical_system_issues}")
print(f"  Major System Issues: {major_system_issues}")
print(f"  Total Critical Issues: {critical_issues}")
print(f"  Total Warnings: {warning_count}")
print(f"\\nSystems Evaluated: {systems_checked}")
print(f"Systems Requiring Attention: {systems_with_issues}")
print(f"{'='*60}")

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
