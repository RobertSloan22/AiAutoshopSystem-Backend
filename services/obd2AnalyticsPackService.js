/**
 * OBD2 Analytics Pack Service
 * Builds and manages Parquet packs for Code Interpreter analysis
 */
/* global process */
import { spawn } from 'child_process';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class OBD2AnalyticsPackService {
  constructor() {
    this.packsDir = process.env.PACKS_DIR || path.resolve(__dirname, '../analytics-worker/packs');
    this.workerPath = process.env.WORKER_PATH || path.resolve(__dirname, '../analytics-worker/worker.py');
    this.pythonCmd = process.env.PYTHON || 'python';
    this.openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    // Ensure packs directory exists
    this.ensurePacksDir();
  }

  async ensurePacksDir() {
    try {
      await fs.mkdir(this.packsDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create packs directory:', error);
    }
  }

  /**
   * Build analytics pack for a session
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>} Pack information
   */
  async buildPack(sessionId) {
    const packPath = path.join(this.packsDir, sessionId);
    const parquetPath = path.join(packPath, 'timeseries.parquet');
    
    // Check if pack already exists
    try {
      await fs.access(parquetPath);
      console.log(`📦 Pack already exists for session ${sessionId}`);
      const summary = JSON.parse(await fs.readFile(path.join(packPath, 'summary.json'), 'utf-8'));
      return {
        sessionId,
        packPath,
        summary,
        cached: true
      };
    } catch {
      // Pack doesn't exist, build it
    }

    console.log(`🔨 Building pack for session ${sessionId}...`);
    
    return new Promise((resolve, reject) => {
      const worker = spawn(this.pythonCmd, [this.workerPath, sessionId], {
        cwd: path.dirname(this.workerPath),
        env: {
          ...process.env,
          MONGO_URI: process.env.MONGO_URI || 'mongodb://localhost:27017',
          DB_NAME: process.env.DB_NAME || 'obd',
          OUT_DIR: this.packsDir
        }
      });

      let stdout = '';
      let stderr = '';

      worker.stdout.on('data', (data) => {
        stdout += data.toString();
        console.log(`[Worker] ${data.toString().trim()}`);
      });

      worker.stderr.on('data', (data) => {
        stderr += data.toString();
        console.error(`[Worker Error] ${data.toString().trim()}`);
      });

      worker.on('close', async (code) => {
        if (code !== 0) {
          reject(new Error(`Pack build failed with code ${code}: ${stderr || stdout}`));
          return;
        }

        try {
          // Read summary
          const summaryPath = path.join(packPath, 'summary.json');
          const summary = JSON.parse(await fs.readFile(summaryPath, 'utf-8'));
          const stats = await fs.stat(parquetPath);

          resolve({
            sessionId,
            packPath,
            summary,
            parquetSize: stats.size,
            cached: false
          });
        } catch (error) {
          reject(new Error(`Failed to read pack results: ${error.message}`));
        }
      });

      worker.on('error', (error) => {
        reject(new Error(`Failed to spawn worker: ${error.message}`));
      });
    });
  }

  /**
   * Upload pack to OpenAI Files for Code Interpreter
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>} File IDs
   */
  async uploadPackToOpenAI(sessionId) {
    const packPath = path.join(this.packsDir, sessionId);
    const parquetPath = path.join(packPath, 'timeseries.parquet');
    const summaryPath = path.join(packPath, 'summary.json');

    // Ensure pack exists
    await this.buildPack(sessionId);

    console.log(`📤 Uploading pack for session ${sessionId} to OpenAI...`);

    try {
      // Upload Parquet file
      const parquetFile = await this.openaiClient.files.create({
        file: fsSync.createReadStream(parquetPath),
        purpose: 'assistants'
      });

      // Upload summary JSON
      const summaryFile = await this.openaiClient.files.create({
        file: fsSync.createReadStream(summaryPath),
        purpose: 'assistants'
      });

      console.log(`✅ Uploaded pack files: ${parquetFile.id}, ${summaryFile.id}`);

      return {
        parquetFileId: parquetFile.id,
        summaryFileId: summaryFile.id,
        sessionId
      };
    } catch (error) {
      console.error('Failed to upload pack to OpenAI:', error);
      throw error;
    }
  }

  /**
   * Query timeseries data from pack
   * @param {string} sessionId - Session ID
   * @param {string[]} signals - Signal names to query
   * @param {number} fromMs - Start timestamp (ms)
   * @param {number} toMs - End timestamp (ms)
   * @returns {Promise<Object>} Time series data
   */
  async queryTimeseries(sessionId, signals, fromMs, toMs) {
    // For now, return metadata - full implementation would use Polars/DuckDB
    const pack = await this.buildPack(sessionId);
    
    return {
      sessionId,
      signals,
        timeRange: { from: fromMs, to: toMs },
        availableSignals: pack.summary.signals,
        note: 'Use Code Interpreter for full time series queries'
    };
  }

  /**
   * Get session overview
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>} Session overview
   */
  async getSessionOverview(sessionId) {
    const pack = await this.buildPack(sessionId);
    
    return {
      sessionId,
      summary: pack.summary,
      artifacts: {
        packPath: pack.packPath,
        parquetSize: pack.parquetSize
      }
    };
  }
}

export default new OBD2AnalyticsPackService();

