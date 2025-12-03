/**
 * OBD2DataAccessTool - Reads OBD2 data from MongoDB and prepares for analysis
 * READ ONLY - Does not execute code
 */

import ToolInterface from '../core/ToolInterface.js';
import mongoose from 'mongoose';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

class OBD2DataAccessTool extends ToolInterface {
  constructor(OBD2Data, DiagnosticSession) {
    super('access_obd2_data', 'Access OBD2 diagnostic data from MongoDB and prepare it for analysis');
    this.OBD2Data = OBD2Data;
    this.DiagnosticSession = DiagnosticSession;

    // Common DTC code descriptions
    this.dtcDatabase = {
      'P0171': 'System Too Lean (Bank 1) - Fuel trim indicates insufficient fuel or excess air',
      'P0172': 'System Too Rich (Bank 1) - Fuel trim indicates excess fuel or insufficient air',
      'P0174': 'System Too Lean (Bank 2) - Fuel trim indicates insufficient fuel or excess air',
      'P0175': 'System Too Rich (Bank 2) - Fuel trim indicates excess fuel or insufficient air',
      'P0300': 'Random/Multiple Cylinder Misfire Detected - Check spark, fuel, compression',
      'P0301': 'Cylinder 1 Misfire Detected',
      'P0302': 'Cylinder 2 Misfire Detected',
      'P0303': 'Cylinder 3 Misfire Detected',
      'P0304': 'Cylinder 4 Misfire Detected',
      'P0420': 'Catalyst System Efficiency Below Threshold (Bank 1) - Catalytic converter degradation',
      'P0430': 'Catalyst System Efficiency Below Threshold (Bank 2) - Catalytic converter degradation',
      'P0128': 'Coolant Thermostat (Coolant Temperature Below Thermostat Regulating Temperature)',
      'P0131': 'O2 Sensor Circuit Low Voltage (Bank 1, Sensor 1)',
      'P0132': 'O2 Sensor Circuit High Voltage (Bank 1, Sensor 1)',
      'P0133': 'O2 Sensor Circuit Slow Response (Bank 1, Sensor 1)',
      'P0134': 'O2 Sensor Circuit No Activity Detected (Bank 1, Sensor 1)',
      'P0135': 'O2 Sensor Heater Circuit (Bank 1, Sensor 1)',
      'P0141': 'O2 Sensor Heater Circuit (Bank 1, Sensor 2)',
      'P0401': 'Exhaust Gas Recirculation (EGR) Flow Insufficient',
      'P0402': 'Exhaust Gas Recirculation (EGR) Flow Excessive',
      'P0440': 'Evaporative Emission System Malfunction',
      'P0442': 'Evaporative Emission System Leak Detected (Small Leak)',
      'P0455': 'Evaporative Emission System Leak Detected (Large Leak)',
      'P0500': 'Vehicle Speed Sensor Malfunction',
      'P0700': 'Transmission Control System Malfunction',
      'P0715': 'Input/Turbine Speed Sensor Circuit Malfunction',
      'P1000': 'OBD System Readiness Test Not Complete (Manufacturer specific)'
    };
  }

  getDefinition() {
    return {
      type: 'function',
      function: {
        name: this.name,
        description: this.description,
        parameters: {
          type: 'object',
          properties: {
            sessionId: {
              type: 'string',
              description: 'The diagnostic session ID to retrieve data for'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of data points to retrieve (default: all)',
              default: null
            }
          },
          required: ['sessionId']
        }
      }
    };
  }

  async run({ sessionId, limit = null }) {
    try {
      console.log(`📊 Accessing OBD2 data for session: ${sessionId}`);
      console.log(`📊 Session ID type: ${typeof sessionId}, Value: ${JSON.stringify(sessionId)}`);

      // Get session info
      const session = await this.DiagnosticSession.findById(sessionId).lean();
      if (!session) {
        console.error(`❌ Session ${sessionId} not found in database`);
        return JSON.stringify({
          success: false,
          error: `Session ${sessionId} not found`
        });
      }

      console.log(`✅ Found session: ${session.sessionName || sessionId}`);

      // Get data points
      let query = this.OBD2Data.find({
        sessionId: new mongoose.Types.ObjectId(sessionId)
      }).sort({ timestamp: 1 });

      if (limit) {
        query = query.limit(limit);
      }

      const dataPoints = await query.lean();

      if (dataPoints.length === 0) {
        console.error(`❌ No data points found for session ${sessionId}`);
        return JSON.stringify({
          success: false,
          error: `No data points found for session ${sessionId}`
        });
      }

      console.log(`✅ Retrieved ${dataPoints.length} data points`);

      // Export to CSV for Docker container
      const csvFilename = `obd2_data_${sessionId}.csv`;
      const csvPath = path.join('/tmp', csvFilename);
      console.log(`📝 Converting ${dataPoints.length} data points to CSV...`);
      const csv = this.convertToCSV(dataPoints);
      console.log(`📝 CSV size: ${csv.length} bytes`);

      await fs.writeFile(csvPath, csv);
      console.log(`✅ Exported to CSV: ${csvPath}`);

      // Verify file was written
      const stats = await fs.stat(csvPath);
      console.log(`✅ Verified CSV file: ${stats.size} bytes`);

      // Copy to Docker container
      console.log(`🐳 Copying CSV to Docker container...`);
      const { stdout, stderr } = await execAsync(`docker cp ${csvPath} obd2_sandbox:/home/obd2analyzer/obd2_data.csv`);
      if (stderr) {
        console.log(`⚠️  Docker cp stderr: ${stderr}`);
      }

      console.log(`✅ Copied to Docker container`);

      // Verify file in container
      const verifyResult = await execAsync(`docker exec obd2_sandbox ls -lh /home/obd2analyzer/obd2_data.csv`);
      console.log(`✅ Verified in container: ${verifyResult.stdout.trim()}`);

      // Prepare DTC codes with descriptions
      const dtcCodesRaw = session.dtcCodes || [];
      const dtcCodesWithDescriptions = dtcCodesRaw.map(code => ({
        code: code,
        description: this.dtcDatabase[code] || 'Unknown DTC code - requires manual lookup'
      }));

      // Format vehicle information
      const vehicleInfo = session.vehicleInfo || {};
      const vehicleDescription = vehicleInfo.make && vehicleInfo.model && vehicleInfo.year
        ? `${vehicleInfo.year} ${vehicleInfo.make} ${vehicleInfo.model}`
        : 'Vehicle information not provided';

      // Create summary with rich context
      const summary = {
        sessionId: sessionId,
        sessionName: session.sessionName || 'Diagnostic Session',
        startTime: session.startTime,
        endTime: session.endTime,
        duration: session.duration,
        dataPointCount: dataPoints.length,

        // CRITICAL DIAGNOSTIC CONTEXT
        vehicleInfo: {
          description: vehicleDescription,
          make: vehicleInfo.make || 'Unknown',
          model: vehicleInfo.model || 'Unknown',
          year: vehicleInfo.year || 'Unknown',
          vin: vehicleInfo.vin || 'Not provided',
          engine: vehicleInfo.engine || 'Not specified',
          transmission: vehicleInfo.transmission || 'Not specified',
          mileage: vehicleInfo.mileage || 'Unknown',
          fuelType: vehicleInfo.fuelType || 'Not specified'
        },

        // DIAGNOSTIC TROUBLE CODES (Critical for analysis)
        dtcCodes: dtcCodesWithDescriptions,
        hasDTCCodes: dtcCodesRaw.length > 0,
        dtcCount: dtcCodesRaw.length,
        affectedSystems: session.affectedSystems || 'Not specified',
        focusAreas: session.focusAreas || [],

        // Session context
        sessionNotes: session.sessionNotes || 'No notes provided',
        drivingConditions: session.drivingConditions || 'Not specified',

        availableParameters: this.getAvailableParameters(dataPoints),
        sampleData: dataPoints.slice(0, 5).map(dp => ({
          timestamp: dp.timestamp,
          rpm: dp.rpm,
          speed: dp.speed,
          engineTemp: dp.engineTemp,
          throttlePosition: dp.throttlePosition
        }))
      };

      // Build context-aware message
      let contextMessage = `Loaded ${dataPoints.length} data points for session ${sessionId}.\n\n`;
      contextMessage += `VEHICLE: ${vehicleDescription}\n`;

      if (dtcCodesRaw.length > 0) {
        contextMessage += `\n⚠️  ACTIVE DIAGNOSTIC TROUBLE CODES (${dtcCodesRaw.length}):\n`;
        dtcCodesWithDescriptions.forEach(dtc => {
          contextMessage += `   • ${dtc.code}: ${dtc.description}\n`;
        });
        contextMessage += `\n🔍 CRITICAL: Analyze the data to find evidence supporting these DTCs. Look for:\n`;
        contextMessage += `   - Parameter values that correlate with the DTC descriptions\n`;
        contextMessage += `   - Timing of when issues occurred during the session\n`;
        contextMessage += `   - Related parameters that may indicate root cause\n`;
      } else {
        contextMessage += `\nNo active DTCs reported. Perform general health analysis.\n`;
      }

      if (session.focusAreas && session.focusAreas.length > 0) {
        contextMessage += `\n📋 FOCUS AREAS: ${session.focusAreas.join(', ')}\n`;
      }

      return JSON.stringify({
        success: true,
        message: contextMessage,
        summary: summary,
        dataLocation: '/home/obd2analyzer/obd2_data.csv',
        instructions: 'The CSV file is available in the Docker container at /home/obd2analyzer/obd2_data.csv. Use pandas to load it: pd.read_csv("/home/obd2analyzer/obd2_data.csv")'
      }, null, 2);

    } catch (error) {
      console.error('❌ Error accessing OBD2 data:', error);
      console.error('❌ Stack trace:', error.stack);
      return JSON.stringify({
        success: false,
        error: `Error accessing OBD2 data: ${error.message}`,
        stack: error.stack
      });
    }
  }

  convertToCSV(dataPoints) {
    if (dataPoints.length === 0) return '';

    // Get all unique keys
    const keys = [...new Set(dataPoints.flatMap(Object.keys))];
    // Filter out MongoDB internal fields
    const filteredKeys = keys.filter(k => !k.startsWith('_') && k !== '__v');
    const header = filteredKeys.join(',');

    const rows = dataPoints.map(dp => {
      return filteredKeys.map(key => {
        const value = dp[key];
        if (value === null || value === undefined) return '';
        if (typeof value === 'object') return JSON.stringify(value).replace(/,/g, ';');
        return value;
      }).join(',');
    });

    return [header, ...rows].join('\n');
  }

  getAvailableParameters(dataPoints) {
    const params = new Set();
    dataPoints.forEach(dp => {
      Object.keys(dp).forEach(key => {
        if (!key.startsWith('_') && key !== '__v' && key !== 'sessionId' &&
            dp[key] !== null && dp[key] !== undefined) {
          params.add(key);
        }
      });
    });
    return Array.from(params).sort();
  }
}

export default OBD2DataAccessTool;
