// services/obd2CsvExportService.js - Export OBD2 session data to CSV for fast-agent analysis

import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class OBD2CSVExportService {
  constructor() {
    // Directory for temporary CSV files
    this.tempDir = path.join(__dirname, '../temp/csv-exports');
    this.ensureTempDir();
  }

  ensureTempDir() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Export OBD2 session data to CSV format compatible with fast-agent
   * @param {string} sessionId - MongoDB session ID
   * @param {Object} options - Export options
   * @param {Object} models - Mongoose models (DiagnosticSession, OBD2DataPoint)
   * @returns {Promise<string>} Path to exported CSV file
   */
  async exportSessionToCSV(sessionId, options = {}, models = null) {
    try {
      const {
        includeMetadata = true,
        timeRange = null,
        parameters = null, // Specific parameters to include
        aggregation = null // 'minute', 'second', etc.
      } = options;

      // Get models - either passed in or from mongoose
      let DiagnosticSession, OBD2DataPoint;
      if (models) {
        DiagnosticSession = models.DiagnosticSession;
        OBD2DataPoint = models.OBD2DataPoint;
      } else {
        DiagnosticSession = mongoose.model('DiagnosticSession');
        OBD2DataPoint = mongoose.model('OBD2DataPoint');
      }

      // Get session info
      const session = await DiagnosticSession.findById(sessionId).lean();
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      // Build query for data points
      let query = { sessionId: new mongoose.Types.ObjectId(sessionId) };
      
      if (timeRange) {
        query.timestamp = {};
        if (timeRange.start) query.timestamp.$gte = new Date(timeRange.start);
        if (timeRange.end) query.timestamp.$lte = new Date(timeRange.end);
      }

      // Fetch data points
      let dataPoints = await OBD2DataPoint.find(query)
        .sort({ timestamp: 1 })
        .lean();

      if (dataPoints.length === 0) {
        throw new Error(`No data points found for session: ${sessionId}`);
      }

      // Prepare CSV data
      const csvRows = [];
      
      // Get all available parameter names from first data point
      const firstPoint = dataPoints[0];
      const allParams = Object.keys(firstPoint).filter(key => {
        // Exclude MongoDB fields and non-numeric fields
        return !['_id', '__v', 'sessionId', 'createdAt', 'updatedAt', 'timestamp'].includes(key) &&
               (typeof firstPoint[key] === 'number' || firstPoint[key] === null || firstPoint[key] === undefined);
      });

      // Filter parameters if specified
      const paramsToInclude = parameters && Array.isArray(parameters) 
        ? allParams.filter(p => parameters.includes(p))
        : allParams;

      // CSV Header
      const headers = ['timestamp', ...paramsToInclude];
      if (includeMetadata) {
        headers.push('session_id', 'session_name', 'vehicle_id');
      }
      csvRows.push(headers.join(','));

      // CSV Rows
      for (const point of dataPoints) {
        const row = [];
        
        // Timestamp (ISO format)
        row.push(new Date(point.timestamp).toISOString());
        
        // Parameter values
        for (const param of paramsToInclude) {
          const value = point[param];
          if (value === null || value === undefined) {
            row.push('');
          } else if (typeof value === 'number') {
            row.push(value.toString());
          } else {
            row.push(JSON.stringify(value));
          }
        }
        
        // Metadata if requested
        if (includeMetadata) {
          row.push(sessionId);
          row.push(session.sessionName || '');
          row.push(session.vehicleId || '');
        }
        
        csvRows.push(row.join(','));
      }

      // Write CSV file
      const filename = `obd2_session_${sessionId}_${Date.now()}.csv`;
      const filepath = path.join(this.tempDir, filename);
      fs.writeFileSync(filepath, csvRows.join('\n'), 'utf8');

      console.log(`✅ Exported ${dataPoints.length} data points to CSV: ${filepath}`);

      return {
        filepath,
        filename,
        rowCount: dataPoints.length,
        parameterCount: paramsToInclude.length,
        sessionId,
        sessionName: session.sessionName
      };
    } catch (error) {
      console.error('❌ Failed to export session to CSV:', error);
      throw error;
    }
  }

  /**
   * Clean up old CSV files (older than specified hours)
   * @param {number} hoursOld - Delete files older than this many hours
   */
  async cleanupOldFiles(hoursOld = 24) {
    try {
      const files = fs.readdirSync(this.tempDir);
      const now = Date.now();
      const maxAge = hoursOld * 60 * 60 * 1000;
      let deletedCount = 0;

      for (const file of files) {
        if (file.endsWith('.csv')) {
          const filepath = path.join(this.tempDir, file);
          const stats = fs.statSync(filepath);
          const age = now - stats.mtimeMs;

          if (age > maxAge) {
            fs.unlinkSync(filepath);
            deletedCount++;
          }
        }
      }

      if (deletedCount > 0) {
        console.log(`🧹 Cleaned up ${deletedCount} old CSV file(s)`);
      }

      return deletedCount;
    } catch (error) {
      console.error('❌ Failed to cleanup old CSV files:', error);
      return 0;
    }
  }

  /**
   * Delete a specific CSV file
   * @param {string} filepath - Path to CSV file
   */
  async deleteCSVFile(filepath) {
    try {
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Failed to delete CSV file:', error);
      return false;
    }
  }
}

export default new OBD2CSVExportService();

