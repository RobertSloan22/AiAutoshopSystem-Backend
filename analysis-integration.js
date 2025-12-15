#!/usr/bin/env node
/**
 * Analysis System Integration Script
 * 
 * This script helps integrate the data analysis system with your main backend.
 * It starts the analysis server on port 8080 and provides integration endpoints.
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const ANALYSIS_PORT = process.env.ANALYSIS_PORT || 8080;
const ANALYSIS_DIR = path.join(__dirname, '../../../fast-agent', 'examples', 'data-analysis');
const PYTHON_EXECUTABLE = process.env.PYTHON_EXECUTABLE || 'python';

class AnalysisSystemIntegration {
  constructor() {
    this.analysisProcess = null;
    this.isRunning = false;
  }

  /**
   * Check if the analysis system is already running
   */
  async checkAnalysisSystem() {
    try {
      const response = await fetch(`http://localhost:${ANALYSIS_PORT}/health`);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Start the analysis system
   */
  async startAnalysisSystem() {
    console.log('🚀 Starting Data Analysis System...');
    
    // Check if already running
    if (await this.checkAnalysisSystem()) {
      console.log('✅ Analysis system is already running on port', ANALYSIS_PORT);
      return true;
    }

    // Check if analysis directory exists
    if (!fs.existsSync(ANALYSIS_DIR)) {
      console.error('❌ Analysis directory not found:', ANALYSIS_DIR);
      return false;
    }

    // Check if app.py exists
    const appPyPath = path.join(ANALYSIS_DIR, 'app.py');
    if (!fs.existsSync(appPyPath)) {
      console.error('❌ app.py not found in analysis directory');
      return false;
    }

    try {
      // Set environment variables
      const env = {
        ...process.env,
        PORT: ANALYSIS_PORT,
        OBD2_BACKEND_URL: process.env.OBD2_BACKEND_URL || 'http://localhost:5000',
        PYTHONPATH: ANALYSIS_DIR
      };

      // Start the analysis server
      this.analysisProcess = spawn(PYTHON_EXECUTABLE, ['app.py'], {
        cwd: ANALYSIS_DIR,
        env: env,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Handle process events
      this.analysisProcess.stdout.on('data', (data) => {
        console.log(`[Analysis System] ${data.toString().trim()}`);
      });

      this.analysisProcess.stderr.on('data', (data) => {
        console.error(`[Analysis System Error] ${data.toString().trim()}`);
      });

      this.analysisProcess.on('error', (error) => {
        console.error('❌ Failed to start analysis system:', error);
        this.isRunning = false;
      });

      this.analysisProcess.on('exit', (code) => {
        console.log(`⚠️ Analysis system exited with code ${code}`);
        this.isRunning = false;
      });

      // Wait for the system to start
      console.log('⏳ Waiting for analysis system to start...');
      await this.waitForSystemStart();

      this.isRunning = true;
      console.log(`✅ Analysis system started successfully on port ${ANALYSIS_PORT}`);
      return true;

    } catch (error) {
      console.error('❌ Error starting analysis system:', error);
      return false;
    }
  }

  /**
   * Wait for the analysis system to start
   */
  async waitForSystemStart(maxAttempts = 30) {
    for (let i = 0; i < maxAttempts; i++) {
      if (await this.checkAnalysisSystem()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    throw new Error('Analysis system failed to start within timeout');
  }

  /**
   * Stop the analysis system
   */
  stopAnalysisSystem() {
    if (this.analysisProcess) {
      console.log('🛑 Stopping analysis system...');
      this.analysisProcess.kill('SIGTERM');
      this.analysisProcess = null;
      this.isRunning = false;
    }
  }

  /**
   * Get system status
   */
  async getSystemStatus() {
    const isRunning = await this.checkAnalysisSystem();
    return {
      isRunning,
      port: ANALYSIS_PORT,
      analysisDir: ANALYSIS_DIR,
      pid: this.analysisProcess?.pid || null
    };
  }
}

// Export for use in other modules
export { AnalysisSystemIntegration };

// If run directly, start the integration
if (import.meta.url === `file://${process.argv[1]}`) {
  const integration = new AnalysisSystemIntegration();
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down analysis system integration...');
    integration.stopAnalysisSystem();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n�� Shutting down analysis system integration...');
    integration.stopAnalysisSystem();
    process.exit(0);
  });

  // Start the system
  integration.startAnalysisSystem()
    .then(success => {
      if (success) {
        console.log('🎉 Analysis system integration ready!');
        console.log(`📊 Access the analysis dashboard at: http://localhost:5000/analysis-dashboard`);
        console.log(`🔗 Session analysis at: http://localhost:5000/session-analysis`);
        console.log(`📈 Data analysis API at: http://localhost:5000/data-analysis`);
      } else {
        console.error('❌ Failed to start analysis system integration');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}
