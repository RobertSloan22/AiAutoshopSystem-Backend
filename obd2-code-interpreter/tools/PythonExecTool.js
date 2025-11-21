/**
 * PythonExecTool - Executes Python code in isolated Docker container
 * EXECUTION ONLY - No access to host filesystem or MongoDB
 */

import ToolInterface from '../core/ToolInterface.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

class PythonExecTool extends ToolInterface {
  constructor() {
    super('execute_python_code', 'Execute Python code in a secure Docker container for OBD2 data analysis');
  }

  getDefinition() {
    return {
      type: 'function',
      function: {
        name: this.name,
        description: 'Executes Python code securely in a Docker container. Python 3.10 with pandas, numpy, matplotlib, seaborn, scikit-learn, polars, and scipy are available. The OBD2 data CSV file is at /home/obd2analyzer/obd2_data.csv',
        parameters: {
          type: 'object',
          properties: {
            python_code: {
              type: 'string',
              description: 'The Python code to execute. Can include data analysis, calculations, and visualizations. Use print() to return results.'
            }
          },
          required: ['python_code']
        }
      }
    };
  }

  async run({ python_code }) {
    const tempFile = `/tmp/python_exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.py`;

    try {
      console.log('🐍 Executing Python code in Docker container...');
      console.log(`Code length: ${python_code.length} characters`);

      // Clean the code (remove markdown code blocks if present)
      const cleanCode = python_code
        .trim()
        .replace(/^```python\n?/, '')
        .replace(/\n?```$/, '')
        .replace(/^```\n?/, '')
        .replace(/\n?```$/, '');

      // Write code to a temporary file on the host
      await fs.writeFile(tempFile, cleanCode);

      // Copy the file into the container
      const containerPath = `/home/obd2analyzer/temp_exec_${Date.now()}.py`;
      await execAsync(`docker cp ${tempFile} obd2_sandbox:${containerPath}`, { timeout: 5000 });

      // Execute the file in the container
      const { stdout, stderr } = await execAsync(
        `docker exec -i obd2_sandbox python ${containerPath}`,
        {
          timeout: 60000, // 60 second timeout for complex analysis
          maxBuffer: 10 * 1024 * 1024 // 10MB buffer
        }
      );

      // Clean up the file from the container
      try {
        await execAsync(`docker exec obd2_sandbox rm ${containerPath}`, { timeout: 5000 });
      } catch (cleanupError) {
        console.warn('⚠️  Warning: Could not clean up container file:', cleanupError.message);
      }

      // Clean up the temp file from host
      try {
        await fs.unlink(tempFile);
      } catch (cleanupError) {
        console.warn('⚠️  Warning: Could not clean up host file:', cleanupError.message);
      }

      // Filter out warnings from stderr
      const errors = stderr.split('\n')
        .filter(line => line && !line.includes('Warning') && !line.includes('warning'))
        .join('\n');

      if (errors) {
        console.error('Python stderr (non-warnings):', errors);
      }

      console.log('✅ Python execution completed');

      // Check for generated plots in the container
      const plots = await this.extractPlots();

      // Build response
      const response = {
        output: stdout || 'Code executed successfully (no output)',
        errors: errors || null,
        plots: plots
      };

      if (!stdout && !errors && plots.length === 0) {
        return JSON.stringify({
          output: 'Code executed successfully (no output)',
          plots: []
        });
      }

      // Return structured response with plots
      return JSON.stringify(response);

    } catch (error) {
      console.error('❌ Python execution error:', error);

      // Clean up temp file on error
      try {
        await fs.unlink(tempFile);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }

      // Parse execution errors
      const errorMessage = error.stderr || error.message;
      return JSON.stringify({
        error: `[Error executing Python code]\n${errorMessage}`,
        plots: []
      });
    }
  }

  async extractPlots() {
    try {
      // List PNG files in the container's working directory
      const { stdout } = await execAsync(
        `docker exec obd2_sandbox find /home/obd2analyzer -maxdepth 1 -name "*.png" -type f`,
        { timeout: 5000 }
      );

      if (!stdout.trim()) {
        console.log('📊 No plots found in container');
        return [];
      }

      const plotPaths = stdout.trim().split('\n').filter(p => p);
      console.log(`📊 Found ${plotPaths.length} plot(s) in container:`, plotPaths);

      const plots = [];
      for (const containerPath of plotPaths) {
        const filename = path.basename(containerPath);
        const hostPath = `/tmp/${filename}`;

        // Copy plot from container to host
        await execAsync(`docker cp obd2_sandbox:${containerPath} ${hostPath}`);
        console.log(`📊 Copied plot to host: ${hostPath}`);

        // Read and convert to base64
        const imageBuffer = await fs.readFile(hostPath);
        const base64Image = imageBuffer.toString('base64');

        plots.push({
          filename: filename,
          path: containerPath,
          base64: base64Image,
          mimeType: 'image/png'
        });

        // Clean up files
        await execAsync(`docker exec obd2_sandbox rm ${containerPath}`);
        await fs.unlink(hostPath);
        console.log(`📊 Cleaned up: ${filename}`);
      }

      return plots;
    } catch (error) {
      console.error('⚠️  Error extracting plots:', error.message);
      return [];
    }
  }
}

export default PythonExecTool;
