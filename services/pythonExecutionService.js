import { spawn } from 'child_process';
import axios from 'axios';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';
import WebSocket from 'ws';
import { registerImage } from '../routes/images.js';
import Plot from '../models/plot.model.js';

class PythonExecutionService {
  constructor() {
    this.pythonServerUrl = process.env.PYTHON_SERVER_URL || 'http://localhost:8000';
    this.pythonServerWsUrl = process.env.PYTHON_SERVER_WS_URL || 'ws://localhost:8000';
    this.isConnected = false;
    this.executionResults = new Map();
    this.outputDir = '/tmp/python_outputs';
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
    const { save_plots = true, plot_filename, data } = options;

    console.log(`📐 PYTHON EXEC: Starting execution with ID: ${executionId}`);
    console.log(`📐 PYTHON EXEC: Options:`, JSON.stringify({ ...options, data: data ? `<${Object.keys(data).length} data objects>` : undefined }));
    console.log(`📐 PYTHON EXEC: SessionId for plots: ${options.sessionId}`);
    console.log(`📐 PYTHON EXEC: Code length: ${code.length} chars`);
    console.log(`📐 PYTHON EXEC: Code includes plt.savefig: ${code.includes('plt.savefig')}`);

    try {
      // Handle data parameter: write data to JSON files if provided
      let dataFiles = {};
      if (data && typeof data === 'object') {
        console.log(`📐 PYTHON EXEC: Writing ${Object.keys(data).length} data objects to JSON files`);
        for (const [key, value] of Object.entries(data)) {
          const dataFilePath = path.join(this.outputDir, `data_${executionId}_${key}.json`);
          await fs.writeFile(dataFilePath, JSON.stringify(value));
          dataFiles[key] = dataFilePath;
          console.log(`📐 PYTHON EXEC: Wrote ${key} data to ${dataFilePath}`);
        }

        // Prepend code to load data files
        const dataLoadCode = Object.entries(dataFiles)
          .map(([key, filepath]) => `
import json
with open('${filepath}', 'r') as f:
    ${key} = json.load(f)`)
          .join('\n');

        code = dataLoadCode + '\n\n' + code;
        console.log(`📐 PYTHON EXEC: Enhanced code length with data loading: ${code.length} chars`);
      }

      // If Python server is available, use it for better performance
      if (this.isConnected) {
        console.log(`📐 PYTHON EXEC: Using server execution`);
        return await this.executeViaServer(code, executionId, { ...options, save_plots, plot_filename, dataFiles });
      } else {
        // Fallback to local execution
        console.log(`📐 PYTHON EXEC: Using local execution`);
        return await this.executeLocally(code, executionId, { ...options, save_plots, plot_filename, dataFiles });
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
        const pythonPath = path.join(process.cwd(), 'venv', 'bin', 'python');
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

          // Clean up data files if any
          if (options.dataFiles && typeof options.dataFiles === 'object') {
            for (const filepath of Object.values(options.dataFiles)) {
              try {
                await fs.unlink(filepath);
                console.log(`📐 PYTHON EXEC: Cleaned up data file: ${filepath}`);
              } catch (e) {
                // Ignore cleanup errors
              }
            }
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
          console.log(`📐 PYTHON EXEC: Plot paths:`, allPlotPaths);
          
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
            
            // Create plot result with base64 data for frontend
            const base64Data = await this.getPlotAsBase64(plotPath);
            const plotResult = {
              path: plotPath,
              imageId,
              data: base64Data,
              url: `/api/plots/${imageId}`,
              thumbnailUrl: `/api/plots/${imageId}/thumbnail`
            };
            
            console.log(`📊 PLOT RESULT: Created plot result with imageId=${imageId}, hasBase64=${!!base64Data}`);
            plots.push(plotResult);
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

      // Clean up data files on error
      if (options.dataFiles && typeof options.dataFiles === 'object') {
        for (const filepath of Object.values(options.dataFiles)) {
          try {
            await fs.unlink(filepath);
          } catch (e) {
            // Ignore cleanup errors
          }
        }
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
    plot_path = os.path.join("${this.outputDir}", f"{plot_filename}.png")
    plt.savefig(plot_path, dpi=150, bbox_inches='tight')
    print(f"Plot saved to: {plot_path}")
    plt.close()

# Override plt.savefig to use absolute paths
def _enhanced_savefig(fname, *args, **kwargs):
    if not os.path.isabs(fname):
        # Convert relative path to absolute path in our output directory
        fname = os.path.join("${this.outputDir}", fname)
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
        plot_path = f"${this.outputDir}/figure_{fig_num}_${sessionId}_${executionId}_${Date.now()}.png"
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
    
    // Create base64 data for immediate frontend use
    const base64Data = `data:image/png;base64,${base64Clean}`;
    
    return { 
      path: plotPath, 
      imageId,
      data: base64Data,
      url: `/api/plots/${imageId}`,
      thumbnailUrl: `/api/plots/${imageId}/thumbnail`
    };
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
}

export default PythonExecutionService;