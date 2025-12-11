/**
 * MCPRealtimeTool - Real-time ELM327 data access via MCP server
 * Integrates with your existing MCP server infrastructure
 */

import ToolInterface from '../core/ToolInterface.js';
import { Client as MCPClient } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

class MCPRealtimeTool extends ToolInterface {
  constructor(mcpConfig = {}) {
    super();
    this.name = 'get_realtime_obd2_data';
    this.description = 'Get live OBD2 data from ELM327 adapter via MCP server';
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
            pids: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of OBD2 PIDs to read (e.g., ["01 0C", "01 0D", "01 05"])',
              default: ["01 0C", "01 0D", "01 05", "01 0F"] // RPM, Speed, Coolant temp, Intake temp
            },
            duration_seconds: {
              type: 'number',
              description: 'Duration to collect data in seconds',
              default: 10,
              minimum: 1,
              maximum: 300
            },
            sampling_rate_hz: {
              type: 'number',
              description: 'Data sampling rate in Hz',
              default: 1,
              minimum: 0.1,
              maximum: 10
            },
            vehicle_protocol: {
              type: 'string',
              description: 'OBD2 protocol to use',
              enum: ['AUTO', 'ISO9141', 'ISO14230', 'ISO15765', 'SAE_J1850'],
              default: 'AUTO'
            }
          },
          required: ['pids']
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
        { name: 'obd2-code-interpreter', version: '1.0.0' },
        { capabilities: {} }
      );

      await this.mcpClient.connect(transport);
      console.log('🔌 Connected to ELM327 MCP server');
      return this.mcpClient;
    } catch (error) {
      console.error('❌ Failed to connect to MCP server:', error);
      throw new Error(`MCP connection failed: ${error.message}`);
    }
  }

  async disconnectMCP() {
    if (this.mcpClient) {
      await this.mcpClient.close();
      this.mcpClient = null;
      console.log('🔌 Disconnected from ELM327 MCP server');
    }
  }

  async run(args) {
    const { pids = ["01 0C", "01 0D", "01 05"], duration_seconds = 10, sampling_rate_hz = 1, vehicle_protocol = 'AUTO' } = args;

    try {
      console.log(`🚗 Starting real-time OBD2 data collection...`);
      console.log(`📊 PIDs: ${pids.join(', ')}`);
      console.log(`⏱️  Duration: ${duration_seconds}s, Rate: ${sampling_rate_hz}Hz`);

      const client = await this.connectToMCP();
      
      // Call MCP tool to get real-time data
      const result = await client.callTool({
        name: 'read_realtime_pids',
        arguments: {
          pids,
          duration_seconds,
          sampling_rate_hz,
          protocol: vehicle_protocol
        }
      });

      if (!result.content || result.content.length === 0) {
        throw new Error('No data received from MCP server');
      }

      const mcpData = result.content[0];
      
      // Process and format the data for analysis
      const formattedData = this.formatRealtimeData(mcpData, pids);
      
      return JSON.stringify({
        success: true,
        message: `Successfully collected ${duration_seconds}s of real-time OBD2 data`,
        data: formattedData,
        metadata: {
          collection_time: new Date().toISOString(),
          duration_seconds,
          sampling_rate_hz,
          pids_requested: pids,
          protocol_used: vehicle_protocol,
          total_samples: formattedData.readings?.length || 0
        },
        summary: {
          pid_count: pids.length,
          sample_count: formattedData.readings?.length || 0,
          time_range: formattedData.time_range,
          connection_quality: formattedData.connection_quality
        }
      }, null, 2);

    } catch (error) {
      console.error('❌ Real-time data collection failed:', error);
      return JSON.stringify({
        success: false,
        error: error.message,
        message: 'Failed to collect real-time OBD2 data. Check ELM327 connection and MCP server status.',
        troubleshooting: [
          'Verify ELM327 adapter is connected and paired',
          'Check MCP server is running and accessible',
          'Ensure vehicle is running and OBD2 port is accessible',
          'Try with different PIDs or protocol settings'
        ]
      }, null, 2);
    } finally {
      // Keep connection alive for potential subsequent calls
      // await this.disconnectMCP();
    }
  }

  formatRealtimeData(mcpData, requestedPids) {
    try {
      // Handle different MCP response formats
      let rawData = mcpData;
      if (typeof mcpData === 'string') {
        rawData = JSON.parse(mcpData);
      }

      const readings = rawData.readings || rawData.data || [];
      const errors = rawData.errors || [];

      // Calculate time range
      const timestamps = readings.map(r => new Date(r.timestamp));
      const timeRange = timestamps.length > 0 ? {
        start: timestamps[0].toISOString(),
        end: timestamps[timestamps.length - 1].toISOString(),
        duration_ms: timestamps.length > 0 ? timestamps[timestamps.length - 1] - timestamps[0] : 0
      } : null;

      // Calculate connection quality
      const expectedSamples = Math.floor(timeRange?.duration_ms / 1000) || 1;
      const actualSamples = readings.length;
      const connectionQuality = actualSamples / Math.max(expectedSamples, 1);

      // Group readings by PID for easier analysis
      const pidData = {};
      requestedPids.forEach(pid => {
        pidData[pid] = {
          values: [],
          unit: this.getPIDUnit(pid),
          description: this.getPIDDescription(pid)
        };
      });

      readings.forEach(reading => {
        Object.entries(reading.data || {}).forEach(([pid, value]) => {
          if (pidData[pid]) {
            pidData[pid].values.push({
              timestamp: reading.timestamp,
              value: value,
              raw_value: reading.raw_data?.[pid]
            });
          }
        });
      });

      return {
        readings,
        pid_data: pidData,
        time_range: timeRange,
        connection_quality: Math.round(connectionQuality * 100) / 100,
        errors,
        stats: this.calculateBasicStats(pidData)
      };

    } catch (error) {
      console.error('❌ Failed to format realtime data:', error);
      return {
        error: 'Failed to format data',
        raw_data: mcpData
      };
    }
  }

  calculateBasicStats(pidData) {
    const stats = {};
    
    Object.entries(pidData).forEach(([pid, data]) => {
      if (data.values.length > 0) {
        const values = data.values.map(v => parseFloat(v.value)).filter(v => !isNaN(v));
        if (values.length > 0) {
          stats[pid] = {
            min: Math.min(...values),
            max: Math.max(...values),
            avg: values.reduce((sum, v) => sum + v, 0) / values.length,
            count: values.length,
            unit: data.unit
          };
        }
      }
    });

    return stats;
  }

  getPIDUnit(pid) {
    const units = {
      '01 0C': 'RPM',
      '01 0D': 'km/h',
      '01 05': '°C',
      '01 0F': '°C',
      '01 11': '%',
      '01 04': '%',
      '01 06': '%',
      '01 07': '%',
      '01 0B': 'kPa',
      '01 0A': 'kPa',
      '01 23': 'kPa',
      '01 42': 'V'
    };
    return units[pid] || 'unknown';
  }

  getPIDDescription(pid) {
    const descriptions = {
      '01 0C': 'Engine RPM',
      '01 0D': 'Vehicle Speed',
      '01 05': 'Engine Coolant Temperature',
      '01 0F': 'Intake Air Temperature',
      '01 11': 'Throttle Position',
      '01 04': 'Calculated Engine Load',
      '01 06': 'Short Term Fuel Trim Bank 1',
      '01 07': 'Long Term Fuel Trim Bank 1',
      '01 0B': 'Intake Manifold Absolute Pressure',
      '01 0A': 'Fuel Pressure',
      '01 23': 'Fuel Rail Pressure',
      '01 42': 'Control Module Voltage'
    };
    return descriptions[pid] || 'Unknown PID';
  }
}

export default MCPRealtimeTool;