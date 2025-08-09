import { spawn } from 'child_process';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import WebSocket from 'ws';

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
    const { save_plots = true, plot_filename } = options;

    try {
      // If Python server is available, use it for better performance
      if (this.isConnected) {
        return await this.executeViaServer(code, executionId, { save_plots, plot_filename });
      } else {
        // Fallback to local execution
        return await this.executeLocally(code, executionId, { save_plots, plot_filename });
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
                  const plotPath = await this.savePlot(message.data, message.filename || options.plot_filename);
                  plots.push(plotPath);
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
      const wrappedCode = this.wrapCodeForExecution(code, options);
      await fs.writeFile(tempFile, wrappedCode);

      return new Promise((resolve, reject) => {
        const pythonProcess = spawn('python3', [tempFile], {
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

          // Check for generated plots
          const plots = await this.findGeneratedPlots(executionId);

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
    const plotSetup = options.save_plots ? `
import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend
import matplotlib.pyplot as plt

# Store the original show function
_original_show = plt.show

# Override plt.show to save instead
def _save_show():
    import os
    plot_filename = "${options.plot_filename || `plot_${Date.now()}`}"
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
        plt.savefig(f"${this.outputDir}/figure_{fig_num}_${Date.now()}.png", dpi=150, bbox_inches='tight')
    plt.close('all')
`;
  }

  async savePlot(base64Data, filename) {
    const plotFilename = filename || `plot_${Date.now()}`;
    const plotPath = path.join(this.outputDir, `${plotFilename}.png`);
    
    // Remove base64 prefix if present
    const base64Clean = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Clean, 'base64');
    
    await fs.writeFile(plotPath, buffer);
    return plotPath;
  }

  async findGeneratedPlots(executionId) {
    try {
      const files = await fs.readdir(this.outputDir);
      const plots = files.filter(f => f.endsWith('.png') && f.includes(String(executionId)));
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