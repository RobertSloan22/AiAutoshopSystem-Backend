/**
 * MCPDiagnosticTool - Live diagnostic operations via MCP server
 * Handles DTC reading, clearing, and vehicle information retrieval
 */

import ToolInterface from '../core/ToolInterface.js';
import { Client as MCPClient } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

class MCPDiagnosticTool extends ToolInterface {
  constructor(mcpConfig = {}) {
    super();
    this.name = 'obd2_diagnostic_operations';
    this.description = 'Perform live OBD2 diagnostic operations: read DTCs, get vehicle info, monitor readiness';
    this.mcpConfig = {
      command: mcpConfig.command || 'python',
      args: mcpConfig.args || ['-m', 'mcp_servers.elm327'],
      timeout: mcpConfig.timeout || 30000,
      ...mcpConfig
    };
    this.mcpClient = null;
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
            operation: {
              type: 'string',
              description: 'Diagnostic operation to perform',
              enum: [
                'read_dtcs',           // Read diagnostic trouble codes
                'clear_dtcs',          // Clear diagnostic trouble codes  
                'get_vehicle_info',    // Get VIN, calibration ID, etc.
                'monitor_readiness',   // Get monitor readiness status
                'get_freeze_frame',    // Get freeze frame data
                'test_connection',     // Test ELM327 connection
                'get_supported_pids'   // Get list of supported PIDs
              ]
            },
            include_pending: {
              type: 'boolean',
              description: 'Include pending DTCs in results',
              default: true
            },
            include_permanent: {
              type: 'boolean',
              description: 'Include permanent DTCs in results',
              default: true
            },
            clear_confirmation: {
              type: 'boolean',
              description: 'Confirmation required for clearing DTCs (safety measure)',
              default: false
            },
            freeze_frame_number: {
              type: 'number',
              description: 'Freeze frame number to retrieve (0-255)',
              default: 0,
              minimum: 0,
              maximum: 255
            }
          },
          required: ['operation']
        }
      }
    };
  }

  async connectToMCP() {
    if (this.mcpClient) {
      return this.mcpClient;
    }

    try {
      const transport = new StdioClientTransport({
        command: this.mcpConfig.command,
        args: this.mcpConfig.args
      });

      this.mcpClient = new MCPClient(
        { name: 'obd2-diagnostic-tool', version: '1.0.0' },
        { capabilities: {} }
      );

      await this.mcpClient.connect(transport);
      console.log('🔌 Connected to ELM327 MCP server for diagnostics');
      return this.mcpClient;
    } catch (error) {
      console.error('❌ Failed to connect to MCP server:', error);
      throw new Error(`MCP diagnostic connection failed: ${error.message}`);
    }
  }

  async run(args) {
    const { 
      operation, 
      include_pending = true, 
      include_permanent = true, 
      clear_confirmation = false,
      freeze_frame_number = 0
    } = args;

    try {
      console.log(`🔧 Performing diagnostic operation: ${operation}`);
      const client = await this.connectToMCP();

      let result;
      
      switch (operation) {
        case 'read_dtcs':
          result = await this.readDTCs(client, include_pending, include_permanent);
          break;
        case 'clear_dtcs':
          result = await this.clearDTCs(client, clear_confirmation);
          break;
        case 'get_vehicle_info':
          result = await this.getVehicleInfo(client);
          break;
        case 'monitor_readiness':
          result = await this.getMonitorReadiness(client);
          break;
        case 'get_freeze_frame':
          result = await this.getFreezeFrame(client, freeze_frame_number);
          break;
        case 'test_connection':
          result = await this.testConnection(client);
          break;
        case 'get_supported_pids':
          result = await this.getSupportedPIDs(client);
          break;
        default:
          throw new Error(`Unknown diagnostic operation: ${operation}`);
      }

      return JSON.stringify({
        success: true,
        operation,
        timestamp: new Date().toISOString(),
        data: result,
        message: `Diagnostic operation '${operation}' completed successfully`
      }, null, 2);

    } catch (error) {
      console.error(`❌ Diagnostic operation '${operation}' failed:`, error);
      return JSON.stringify({
        success: false,
        operation,
        error: error.message,
        timestamp: new Date().toISOString(),
        troubleshooting: this.getTroubleshootingTips(operation)
      }, null, 2);
    }
  }

  async readDTCs(client, includePending, includePermanent) {
    const dtcResults = {
      stored_dtcs: [],
      pending_dtcs: [],
      permanent_dtcs: [],
      total_count: 0
    };

    // Read stored DTCs
    const storedResult = await client.callTool({
      name: 'read_dtcs',
      arguments: { dtc_type: 'stored' }
    });
    
    if (storedResult.content?.[0]) {
      const storedData = JSON.parse(storedResult.content[0]);
      dtcResults.stored_dtcs = this.formatDTCs(storedData.dtcs || []);
    }

    // Read pending DTCs if requested
    if (includePending) {
      try {
        const pendingResult = await client.callTool({
          name: 'read_dtcs',
          arguments: { dtc_type: 'pending' }
        });
        
        if (pendingResult.content?.[0]) {
          const pendingData = JSON.parse(pendingResult.content[0]);
          dtcResults.pending_dtcs = this.formatDTCs(pendingData.dtcs || []);
        }
      } catch (error) {
        console.warn('⚠️ Could not read pending DTCs:', error.message);
      }
    }

    // Read permanent DTCs if requested
    if (includePermanent) {
      try {
        const permanentResult = await client.callTool({
          name: 'read_dtcs',
          arguments: { dtc_type: 'permanent' }
        });
        
        if (permanentResult.content?.[0]) {
          const permanentData = JSON.parse(permanentResult.content[0]);
          dtcResults.permanent_dtcs = this.formatDTCs(permanentData.dtcs || []);
        }
      } catch (error) {
        console.warn('⚠️ Could not read permanent DTCs:', error.message);
      }
    }

    dtcResults.total_count = dtcResults.stored_dtcs.length + 
                            dtcResults.pending_dtcs.length + 
                            dtcResults.permanent_dtcs.length;

    dtcResults.summary = {
      has_codes: dtcResults.total_count > 0,
      stored_count: dtcResults.stored_dtcs.length,
      pending_count: dtcResults.pending_dtcs.length,
      permanent_count: dtcResults.permanent_dtcs.length,
      severity_breakdown: this.analyzeSeverity(dtcResults)
    };

    return dtcResults;
  }

  async clearDTCs(client, confirmation) {
    if (!confirmation) {
      throw new Error('DTC clearing requires confirmation. Set clear_confirmation to true.');
    }

    const result = await client.callTool({
      name: 'clear_dtcs',
      arguments: { confirm: true }
    });

    if (result.content?.[0]) {
      const clearData = JSON.parse(result.content[0]);
      return {
        cleared: true,
        message: 'DTCs cleared successfully',
        cleared_at: new Date().toISOString(),
        additional_info: clearData
      };
    }

    throw new Error('Failed to clear DTCs - no confirmation received');
  }

  async getVehicleInfo(client) {
    const vehicleInfo = {};

    // Get VIN
    try {
      const vinResult = await client.callTool({
        name: 'get_vehicle_vin',
        arguments: {}
      });
      if (vinResult.content?.[0]) {
        const vinData = JSON.parse(vinResult.content[0]);
        vehicleInfo.vin = vinData.vin;
      }
    } catch (error) {
      console.warn('⚠️ Could not read VIN:', error.message);
    }

    // Get calibration ID
    try {
      const calIdResult = await client.callTool({
        name: 'get_calibration_id',
        arguments: {}
      });
      if (calIdResult.content?.[0]) {
        const calData = JSON.parse(calIdResult.content[0]);
        vehicleInfo.calibration_id = calData.calibration_id;
      }
    } catch (error) {
      console.warn('⚠️ Could not read calibration ID:', error.message);
    }

    // Get ECU name
    try {
      const ecuResult = await client.callTool({
        name: 'get_ecu_name',
        arguments: {}
      });
      if (ecuResult.content?.[0]) {
        const ecuData = JSON.parse(ecuResult.content[0]);
        vehicleInfo.ecu_name = ecuData.ecu_name;
      }
    } catch (error) {
      console.warn('⚠️ Could not read ECU name:', error.message);
    }

    return vehicleInfo;
  }

  async getMonitorReadiness(client) {
    const result = await client.callTool({
      name: 'get_monitor_status',
      arguments: {}
    });

    if (result.content?.[0]) {
      const monitorData = JSON.parse(result.content[0]);
      return {
        mil_status: monitorData.mil_status,
        dtc_count: monitorData.dtc_count,
        monitors: monitorData.monitors || {},
        ready_monitors: Object.values(monitorData.monitors || {}).filter(m => m.complete).length,
        total_monitors: Object.keys(monitorData.monitors || {}).length,
        readiness_percentage: this.calculateReadiness(monitorData.monitors || {})
      };
    }

    throw new Error('Failed to read monitor readiness status');
  }

  async getFreezeFrame(client, frameNumber) {
    const result = await client.callTool({
      name: 'get_freeze_frame',
      arguments: { frame_number: frameNumber }
    });

    if (result.content?.[0]) {
      const freezeData = JSON.parse(result.content[0]);
      return {
        frame_number: frameNumber,
        dtc: freezeData.dtc,
        data: freezeData.data,
        timestamp: freezeData.timestamp,
        formatted_data: this.formatFreezeFrameData(freezeData.data || {})
      };
    }

    throw new Error(`No freeze frame data found for frame ${frameNumber}`);
  }

  async testConnection(client) {
    const result = await client.callTool({
      name: 'test_connection',
      arguments: {}
    });

    if (result.content?.[0]) {
      const testData = JSON.parse(result.content[0]);
      return {
        connected: testData.connected,
        protocol: testData.protocol,
        voltage: testData.voltage,
        response_time_ms: testData.response_time_ms,
        elm327_version: testData.elm327_version,
        connection_quality: testData.response_time_ms < 100 ? 'excellent' :
                           testData.response_time_ms < 500 ? 'good' : 'poor'
      };
    }

    throw new Error('Connection test failed');
  }

  async getSupportedPIDs(client) {
    const result = await client.callTool({
      name: 'get_supported_pids',
      arguments: {}
    });

    if (result.content?.[0]) {
      const pidData = JSON.parse(result.content[0]);
      return {
        supported_pids: pidData.pids || [],
        total_count: pidData.pids?.length || 0,
        by_mode: this.groupPIDsByMode(pidData.pids || []),
        capabilities: this.analyzePIDCapabilities(pidData.pids || [])
      };
    }

    throw new Error('Failed to read supported PIDs');
  }

  formatDTCs(dtcs) {
    return dtcs.map(dtc => ({
      code: dtc.code || dtc,
      description: this.getDTCDescription(dtc.code || dtc),
      severity: this.getDTCSeverity(dtc.code || dtc),
      system: this.getDTCSystem(dtc.code || dtc),
      raw: dtc
    }));
  }

  getDTCDescription(code) {
    const descriptions = {
      'P0300': 'Random/Multiple Cylinder Misfire Detected',
      'P0420': 'Catalyst System Efficiency Below Threshold (Bank 1)',
      'P0171': 'System Too Lean (Bank 1)',
      'P0455': 'Evaporative Emission Control System Leak Detected (no purge flow or large leak)',
      'P0442': 'Evaporative Emission Control System Leak Detected (small leak)',
      'P0506': 'Idle Air Control System RPM Lower Than Expected'
    };
    return descriptions[code] || 'Unknown DTC - Consult service manual';
  }

  getDTCSeverity(code) {
    // P0xxx = Powertrain, B0xxx = Body, C0xxx = Chassis, U0xxx = Network
    const firstChar = code.charAt(0);
    const secondChar = code.charAt(1);
    
    if (firstChar === 'P') {
      if (['0', '2'].includes(secondChar)) return 'high'; // Generic/Manufacturer specific
      if (['1', '3'].includes(secondChar)) return 'medium'; // Manufacturer specific
    }
    
    // Specific high-severity codes
    const highSeverityCodes = ['P0300', 'P0301', 'P0302', 'P0303', 'P0304'];
    if (highSeverityCodes.includes(code)) return 'high';
    
    return 'medium';
  }

  getDTCSystem(code) {
    const systems = {
      'P01': 'Fuel and Air Metering',
      'P02': 'Fuel and Air Metering (Injector Circuit)',
      'P03': 'Ignition System',
      'P04': 'Auxiliary Emission Controls',
      'P05': 'Vehicle Speed Controls and Idle Control System',
      'P06': 'Computer Output Circuit',
      'P07': 'Transmission',
      'B0': 'Body',
      'C0': 'Chassis',
      'U0': 'Network Communications'
    };
    
    const prefix = code.substring(0, 3);
    return systems[prefix] || systems[code.substring(0, 2)] || 'Unknown System';
  }

  analyzeSeverity(dtcResults) {
    const allDTCs = [...dtcResults.stored_dtcs, ...dtcResults.pending_dtcs, ...dtcResults.permanent_dtcs];
    const severityCounts = { high: 0, medium: 0, low: 0 };
    
    allDTCs.forEach(dtc => {
      severityCounts[dtc.severity] = (severityCounts[dtc.severity] || 0) + 1;
    });
    
    return severityCounts;
  }

  calculateReadiness(monitors) {
    const totalMonitors = Object.keys(monitors).length;
    if (totalMonitors === 0) return 0;
    
    const completeMonitors = Object.values(monitors).filter(m => m.complete).length;
    return Math.round((completeMonitors / totalMonitors) * 100);
  }

  formatFreezeFrameData(data) {
    const formatted = {};
    Object.entries(data).forEach(([pid, value]) => {
      formatted[pid] = {
        value,
        description: this.getPIDDescription(pid),
        unit: this.getPIDUnit(pid)
      };
    });
    return formatted;
  }

  groupPIDsByMode(pids) {
    const byMode = {};
    pids.forEach(pid => {
      const mode = pid.substring(0, 2);
      if (!byMode[mode]) byMode[mode] = [];
      byMode[mode].push(pid);
    });
    return byMode;
  }

  analyzePIDCapabilities(pids) {
    const capabilities = {
      realtime_data: pids.filter(p => p.startsWith('01')).length > 0,
      freeze_frame: pids.filter(p => p.startsWith('02')).length > 0,
      dtc_commands: pids.filter(p => p.startsWith('03')).length > 0,
      clear_dtcs: pids.includes('04 00'),
      o2_sensors: pids.filter(p => p.includes('O2')).length > 0,
      monitor_tests: pids.filter(p => p.startsWith('06')).length > 0
    };
    return capabilities;
  }

  getPIDDescription(pid) {
    const descriptions = {
      '01 0C': 'Engine RPM',
      '01 0D': 'Vehicle Speed',
      '01 05': 'Engine Coolant Temperature',
      '01 0F': 'Intake Air Temperature'
    };
    return descriptions[pid] || 'Unknown PID';
  }

  getPIDUnit(pid) {
    const units = {
      '01 0C': 'RPM',
      '01 0D': 'km/h', 
      '01 05': '°C',
      '01 0F': '°C'
    };
    return units[pid] || 'unknown';
  }

  getTroubleshootingTips(operation) {
    const tips = {
      read_dtcs: [
        'Ensure ignition is ON but engine may be OFF',
        'Check ELM327 connection to OBD2 port',
        'Some vehicles require engine running for pending DTCs'
      ],
      clear_dtcs: [
        'Vehicle must be in appropriate state (engine OFF, ignition ON)',
        'Some DTCs cannot be cleared until underlying issue is fixed',
        'Permanent DTCs require drive cycle completion to clear'
      ],
      get_vehicle_info: [
        'VIN may not be available on vehicles older than 1996',
        'Some information requires specific protocol support',
        'Try with engine running if data is not available'
      ],
      test_connection: [
        'Check ELM327 device pairing and connection',
        'Ensure OBD2 port has power (ignition ON)',
        'Try different baud rates or protocols'
      ]
    };
    return tips[operation] || ['Check ELM327 connection', 'Verify vehicle compatibility'];
  }
}

export default MCPDiagnosticTool;