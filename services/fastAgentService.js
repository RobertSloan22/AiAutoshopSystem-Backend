// services/fastAgentService.js - Service to communicate with fast-agent Python Flask server

import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class FastAgentService {
  constructor() {
    // Get fast-agent server URL from environment or use default
    this.baseUrl = process.env.FASTAGENT_SERVER_URL || 'http://localhost:8080';
    this.timeout = 300000; // 5 minutes timeout for analysis
  }

  /**
   * Check if fast-agent server is available
   */
  async healthCheck() {
    try {
      const response = await axios.get(`${this.baseUrl}/health`, {
        timeout: 5000
      });
      return {
        available: true,
        status: response.data.status,
        serverTime: response.data.server_time
      };
    } catch (error) {
      return {
        available: false,
        error: error.message
      };
    }
  }

  /**
   * Upload CSV file to fast-agent server
   * @param {string} csvFilePath - Path to CSV file
   * @param {string} filename - Optional filename
   * @returns {Promise<Object>} Upload result with URL
   */
  async uploadCSV(csvFilePath, filename = null) {
    try {
      if (!fs.existsSync(csvFilePath)) {
        throw new Error(`CSV file not found: ${csvFilePath}`);
      }

      const formData = new FormData();
      const fileStream = fs.createReadStream(csvFilePath);
      const actualFilename = filename || path.basename(csvFilePath);
      
      formData.append('file', fileStream, {
        filename: actualFilename,
        contentType: 'text/csv'
      });

      const response = await axios.post(`${this.baseUrl}/upload`, formData, {
        headers: formData.getHeaders(),
        timeout: 30000
      });

      return {
        success: true,
        filename: response.data.filename || actualFilename,
        url: response.data.url || response.data.direct_url,
        csvUrl: response.data.csv_url || response.data.url || response.data.direct_url,
        service: response.data.service,
        expires: response.data.expires
      };
    } catch (error) {
      console.error('❌ FastAgent CSV upload failed:', error);
      throw new Error(`Failed to upload CSV to fast-agent: ${error.message}`);
    }
  }

  /**
   * Run analysis on a CSV URL
   * @param {string} csvUrl - URL of CSV file (from upload or external)
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} Analysis result
   */
  async runAnalysis(csvUrl, options = {}) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/run-analysis-url`,
        { file_url: csvUrl },
        {
          timeout: this.timeout,
          headers: { 'Content-Type': 'application/json' }
        }
      );

      return {
        success: true,
        status: response.data.status,
        message: response.data.message || 'Analysis started'
      };
    } catch (error) {
      console.error('❌ FastAgent analysis failed:', error);
      throw new Error(`Failed to run analysis: ${error.message}`);
    }
  }

  /**
   * Run analysis on a specific file
   * @param {string} filename - Filename to analyze
   * @returns {Promise<Object>} Analysis result with analysis_id
   */
  async runAnalysisByFilename(filename) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/run-analysis`,
        { filename },
        {
          timeout: this.timeout,
          headers: { 'Content-Type': 'application/json' }
        }
      );

      return {
        success: true,
        status: response.data.status,
        analysisId: response.data.analysis_id,
        message: response.data.message
      };
    } catch (error) {
      console.error('❌ FastAgent analysis by filename failed:', error);
      throw new Error(`Failed to run analysis: ${error.message}`);
    }
  }

  /**
   * Get analysis status
   * @param {string} analysisId - Analysis ID
   * @returns {Promise<Object>} Analysis status
   */
  async getAnalysisStatus(analysisId) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/analysis/status`,
        {
          params: { id: analysisId },
          timeout: 10000
        }
      );

      return response.data;
    } catch (error) {
      console.error('❌ Failed to get analysis status:', error);
      throw new Error(`Failed to get analysis status: ${error.message}`);
    }
  }

  /**
   * Poll for terminal output (analysis progress)
   * @param {number} lastId - Last message ID received
   * @param {number} since - Timestamp to get messages since
   * @returns {Promise<Object>} New messages
   */
  async pollOutput(lastId = 0, since = 0) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/poll/output`,
        {
          params: { last_id: lastId, since },
          timeout: 30000
        }
      );

      return {
        messages: response.data.messages || [],
        lastId: response.data.last_id || lastId,
        serverTime: response.data.server_time
      };
    } catch (error) {
      console.error('❌ Failed to poll output:', error);
      return {
        messages: [],
        lastId,
        error: error.message
      };
    }
  }

  /**
   * Poll for new images/visualizations
   * @param {number} lastId - Last image ID received
   * @returns {Promise<Object>} New images
   */
  async pollImages(lastId = 0) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/poll/images`,
        {
          params: { last_id: lastId },
          timeout: 30000
        }
      );

      return {
        images: response.data.images || [],
        lastId: response.data.last_id || lastId,
        serverTime: response.data.server_time
      };
    } catch (error) {
      console.error('❌ Failed to poll images:', error);
      return {
        images: [],
        lastId,
        error: error.message
      };
    }
  }

  /**
   * Get all available images
   * @returns {Promise<Array>} List of images
   */
  async getImages() {
    try {
      const response = await axios.get(
        `${this.baseUrl}/images`,
        { timeout: 10000 }
      );

      return response.data || [];
    } catch (error) {
      console.error('❌ Failed to get images:', error);
      return [];
    }
  }

  /**
   * Get image file from fast-agent server
   * @param {string} imagePath - Path or URL to image
   * @returns {Promise<Buffer>} Image buffer
   */
  async getImageFile(imagePath) {
    try {
      // If it's a full URL, use it directly
      if (imagePath.startsWith('http')) {
        const response = await axios.get(imagePath, {
          responseType: 'arraybuffer',
          timeout: 30000
        });
        return Buffer.from(response.data);
      }

      // Otherwise, try to get from fast-agent server
      const response = await axios.get(
        `${this.baseUrl}${imagePath.startsWith('/') ? imagePath : '/' + imagePath}`,
        {
          responseType: 'arraybuffer',
          timeout: 30000
        }
      );

      return Buffer.from(response.data);
    } catch (error) {
      console.error('❌ Failed to get image file:', error);
      throw new Error(`Failed to get image: ${error.message}`);
    }
  }

  /**
   * Use OBD2 API integration endpoint (if available)
   * @param {string} sessionId - OBD2 session ID
   * @returns {Promise<Object>} Analysis result
   */
  async analyzeOBD2Session(sessionId) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/obd2/sessions/${sessionId}/analyze`,
        {},
        {
          timeout: this.timeout,
          headers: { 'Content-Type': 'application/json' }
        }
      );

      return {
        success: true,
        status: response.data.status,
        analysisId: response.data.analysis_id,
        sessionId: response.data.session_id,
        message: response.data.message
      };
    } catch (error) {
      console.error('❌ FastAgent OBD2 analysis failed:', error);
      throw new Error(`Failed to analyze OBD2 session: ${error.message}`);
    }
  }

  /**
   * Get active OBD2 sessions from fast-agent
   * @returns {Promise<Array>} List of active sessions
   */
  async getActiveOBD2Sessions() {
    try {
      const response = await axios.get(
        `${this.baseUrl}/api/obd2/sessions/active`,
        { timeout: 10000 }
      );

      return {
        success: true,
        sessions: response.data.sessions || [],
        count: response.data.count || 0
      };
    } catch (error) {
      console.error('❌ Failed to get active OBD2 sessions:', error);
      return {
        success: false,
        sessions: [],
        count: 0,
        error: error.message
      };
    }
  }
}

export default new FastAgentService();


