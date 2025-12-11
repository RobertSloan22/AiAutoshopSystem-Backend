/**
 * OBD2MCPAgent - Experimental agent with real-time ELM327 MCP capabilities
 * Integrates with existing OBD2DataAccessAgent and OBD2AnalysisAgent
 * Provides real-time vehicle data access and live diagnostic validation
 */

import BaseAgent from '../core/BaseAgent.js';
import MCPRealtimeTool from '../tools/MCPRealtimeTool.js';
import MCPDiagnosticTool from '../tools/MCPDiagnosticTool.js';

class OBD2MCPAgent extends BaseAgent {
  constructor({ languageModelInterface, mcpConfig = {}, reasoningEffort = 'medium' }) {
    const systemPrompt = `You are an experimental OBD2 MCP agent with real-time ELM327 capabilities.

CORE CAPABILITIES:
- Connect to live vehicle data via MCP server and ELM327 adapter
- Read real-time OBD2 PIDs and parameters
- Perform live diagnostic operations (read/clear DTCs, vehicle info)
- Compare live data with historical session data
- Validate diagnostic conclusions in real-time
- Monitor critical vehicle parameters
- Trigger immediate alerts for dangerous conditions

INTEGRATION WITH EXISTING SYSTEM:
- Work alongside OBD2DataAccessAgent (historical data) and OBD2AnalysisAgent (code execution)
- Your role is to bridge live vehicle data with stored diagnostic sessions
- Use live data to validate, enhance, or contradict historical analysis
- Provide real-time context for diagnostic conclusions

AVAILABLE TOOLS:
1. get_realtime_obd2_data: Collect live OBD2 data from ELM327 adapter
   - Specify PIDs, duration, sampling rate
   - Get structured real-time vehicle parameters
   - Monitor trends and detect anomalies

2. obd2_diagnostic_operations: Perform live diagnostic operations
   - Read current DTCs (stored, pending, permanent)
   - Clear DTCs (with confirmation)
   - Get vehicle information (VIN, ECU details)
   - Check monitor readiness status
   - Test connection quality

ANALYSIS APPROACH:
1. LIVE DATA COLLECTION: Always start by collecting relevant live data
2. HISTORICAL COMPARISON: Compare with provided historical session data
3. VALIDATION: Validate or challenge stored diagnostic conclusions
4. REAL-TIME INSIGHTS: Provide immediate insights based on current vehicle state
5. SAFETY ALERTS: Flag any dangerous conditions immediately

SAFETY PRIORITIES:
- Alert immediately for critical conditions (overheating, low oil pressure, etc.)
- Warn about dangerous driving conditions
- Prioritize safety over comprehensive analysis

RESPONSE STYLE:
- Be direct and actionable
- Highlight discrepancies between live and historical data
- Provide clear diagnostic confidence levels
- Explain real-time findings in automotive technician language

LIMITATIONS AWARENESS:
- MCP connection may fail - handle gracefully
- ELM327 adapter limitations - some PIDs may not be available
- Vehicle must be accessible and in appropriate state
- Live data represents current moment, not historical conditions

Remember: You are experimental - clearly indicate when findings are based on live data vs. historical analysis.`;

    super({
      prompt: systemPrompt,
      model: 'gpt-4o',
      languageModelInterface,
      reasoningEffort
    });

    // Initialize MCP tools
    this.mcpRealtimeTool = new MCPRealtimeTool(mcpConfig);
    this.mcpDiagnosticTool = new MCPDiagnosticTool(mcpConfig);

    // Register tools
    this.registerTool(this.mcpRealtimeTool);
    this.registerTool(this.mcpDiagnosticTool);

    this.mcpConfig = mcpConfig;
    console.log('🚗 OBD2MCPAgent initialized with MCP capabilities');
  }

  /**
   * Enhanced task method with MCP-specific context management
   */
  async task(userQuery, options = {}) {
    const { 
      includeConnectionTest = true,
      autoCollectBasicData = true,
      maxRetries = 2 
    } = options;

    try {
      // Add MCP-specific context
      this.addContext(`
[MCP AGENT SESSION START]
Current Time: ${new Date().toISOString()}
MCP Configuration: ${JSON.stringify(this.mcpConfig, null, 2)}
Session Type: Experimental MCP-Enhanced Analysis

Note: This agent has real-time vehicle access capabilities. Always consider:
1. Current vehicle state vs. historical data
2. Connection quality and data reliability  
3. Safety implications of any findings
4. Confidence levels of live vs. stored data
      `);

      // Optional: Test connection first
      if (includeConnectionTest) {
        console.log('🔧 Testing MCP connection before analysis...');
        try {
          const connectionResult = await this.mcpDiagnosticTool.run({ operation: 'test_connection' });
          const connectionData = JSON.parse(connectionResult);
          
          if (connectionData.success) {
            this.addContext(`[CONNECTION STATUS] ✅ ELM327 connected successfully
Protocol: ${connectionData.data?.protocol}
Response Time: ${connectionData.data?.response_time_ms}ms
Connection Quality: ${connectionData.data?.connection_quality}
ELM327 Version: ${connectionData.data?.elm327_version || 'Unknown'}`);
          } else {
            this.addContext(`[CONNECTION STATUS] ❌ ELM327 connection failed: ${connectionData.error}
Operating in historical-data-only mode.`);
          }
        } catch (connError) {
          console.warn('⚠️ Connection test failed:', connError.message);
          this.addContext(`[CONNECTION STATUS] ⚠️ Connection test failed: ${connError.message}
Will attempt live data collection during analysis if requested.`);
        }
      }

      // Optional: Auto-collect basic live data
      if (autoCollectBasicData) {
        console.log('📊 Auto-collecting basic live vehicle data...');
        try {
          const basicData = await this.mcpRealtimeTool.run({
            pids: ['01 0C', '01 0D', '01 05', '01 0F'], // RPM, Speed, Coolant, Intake temp
            duration_seconds: 5,
            sampling_rate_hz: 1
          });
          
          const parsedData = JSON.parse(basicData);
          if (parsedData.success) {
            this.addContext(`[LIVE DATA PREVIEW] Current vehicle state (5-second snapshot):
${JSON.stringify(parsedData.summary, null, 2)}

This live data is available for comparison with historical session data.`);
          }
        } catch (dataError) {
          console.warn('⚠️ Auto data collection failed:', dataError.message);
          this.addContext(`[LIVE DATA] ⚠️ Auto data collection failed: ${dataError.message}
Will collect specific data if analysis requires it.`);
        }
      }

      // Execute the main task using base agent functionality
      const result = await super.task(userQuery, { maxRetries });

      return result;

    } catch (error) {
      console.error('❌ OBD2MCPAgent task failed:', error);
      
      // Add error context for retry or user feedback
      this.addContext(`[MCP AGENT ERROR] Task failed: ${error.message}
Falling back to available data and capabilities.`);

      throw error;
    }
  }

  /**
   * Quick method to get current vehicle status
   */
  async getCurrentVehicleStatus() {
    try {
      console.log('🚗 Getting current vehicle status...');
      
      // Test connection
      const connectionTest = await this.mcpDiagnosticTool.run({ 
        operation: 'test_connection' 
      });
      const connectionData = JSON.parse(connectionTest);
      
      if (!connectionData.success) {
        return {
          success: false,
          error: 'Vehicle not connected',
          message: connectionData.error
        };
      }

      // Get basic real-time data
      const realtimeData = await this.mcpRealtimeTool.run({
        pids: ['01 0C', '01 0D', '01 05', '01 0F', '01 11', '01 04'],
        duration_seconds: 3,
        sampling_rate_hz: 1
      });

      // Get current DTCs
      const dtcData = await this.mcpDiagnosticTool.run({
        operation: 'read_dtcs',
        include_pending: true,
        include_permanent: true
      });

      return {
        success: true,
        connection: connectionData.data,
        realtime_data: JSON.parse(realtimeData),
        diagnostics: JSON.parse(dtcData),
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ Failed to get vehicle status:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Compare live data with historical session data
   */
  async compareLiveWithHistorical(sessionData, comparisonDuration = 30) {
    const comparison = {
      timestamp: new Date().toISOString(),
      session_id: sessionData.sessionId || 'unknown',
      comparison_duration: comparisonDuration,
      findings: []
    };

    try {
      // Extract PIDs from historical data
      const historicalPids = this.extractPIDsFromSession(sessionData);
      
      if (historicalPids.length === 0) {
        comparison.findings.push({
          type: 'warning',
          message: 'No recognizable PIDs found in historical data for comparison'
        });
        return comparison;
      }

      // Collect live data for same PIDs
      const liveDataResult = await this.mcpRealtimeTool.run({
        pids: historicalPids.slice(0, 10), // Limit to first 10 for performance
        duration_seconds: comparisonDuration,
        sampling_rate_hz: 0.5 // 0.5 Hz for longer duration
      });

      const liveData = JSON.parse(liveDataResult);
      
      if (!liveData.success) {
        comparison.findings.push({
          type: 'error',
          message: `Failed to collect live data: ${liveData.error}`
        });
        return comparison;
      }

      // Perform comparison analysis
      comparison.findings = this.analyzeLiveVsHistorical(historicalPids, liveData.data, sessionData);
      comparison.success = true;

    } catch (error) {
      comparison.success = false;
      comparison.error = error.message;
      comparison.findings.push({
        type: 'error',
        message: `Comparison failed: ${error.message}`
      });
    }

    return comparison;
  }

  /**
   * Extract PIDs from historical session data
   */
  extractPIDsFromSession(sessionData) {
    const pids = new Set();
    
    // Common OBD2 PIDs to look for
    const commonPids = ['01 0C', '01 0D', '01 05', '01 0F', '01 11', '01 04', '01 06', '01 07'];
    
    // Add common PIDs (they're most likely to be available)
    commonPids.forEach(pid => pids.add(pid));
    
    // Try to extract from session data structure (this depends on your data format)
    if (sessionData.obd2_data && Array.isArray(sessionData.obd2_data)) {
      sessionData.obd2_data.forEach(dataPoint => {
        if (dataPoint.pid) pids.add(dataPoint.pid);
      });
    }

    return Array.from(pids);
  }

  /**
   * Analyze differences between live and historical data
   */
  analyzeLiveVsHistorical(pids, liveData, sessionData) {
    const findings = [];

    // Analyze each PID
    pids.forEach(pid => {
      const liveValues = liveData.pid_data?.[pid]?.values || [];
      
      if (liveValues.length > 0) {
        const currentAvg = liveValues.reduce((sum, v) => sum + parseFloat(v.value), 0) / liveValues.length;
        const currentMax = Math.max(...liveValues.map(v => parseFloat(v.value)));
        const currentMin = Math.min(...liveValues.map(v => parseFloat(v.value)));
        
        findings.push({
          type: 'comparison',
          pid,
          description: this.getPIDDescription(pid),
          live_data: {
            avg: Math.round(currentAvg * 100) / 100,
            min: currentMin,
            max: currentMax,
            samples: liveValues.length
          },
          analysis: `Current ${this.getPIDDescription(pid)}: avg ${Math.round(currentAvg * 100) / 100} ${this.getPIDUnit(pid)}`,
          confidence: 'high'
        });

        // Add safety alerts if needed
        const safetyAlert = this.checkSafetyLimits(pid, currentAvg, currentMax);
        if (safetyAlert) {
          findings.push({
            type: 'safety_alert',
            pid,
            severity: safetyAlert.severity,
            message: safetyAlert.message,
            current_value: currentAvg,
            threshold: safetyAlert.threshold
          });
        }
      }
    });

    return findings;
  }

  /**
   * Check if current values exceed safety thresholds
   */
  checkSafetyLimits(pid, avgValue, maxValue) {
    const safetyLimits = {
      '01 05': { max: 110, severity: 'critical', message: 'Engine overheating detected' }, // Coolant temp
      '01 0F': { max: 60, severity: 'warning', message: 'High intake air temperature' }, // Intake temp
      '01 0C': { max: 6000, severity: 'warning', message: 'High engine RPM' }, // RPM
      '01 0D': { max: 200, severity: 'warning', message: 'Excessive vehicle speed' } // Speed
    };

    const limit = safetyLimits[pid];
    if (limit && maxValue > limit.max) {
      return {
        severity: limit.severity,
        message: limit.message,
        threshold: limit.max
      };
    }

    return null;
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
      '01 07': 'Long Term Fuel Trim Bank 1'
    };
    return descriptions[pid] || 'Unknown Parameter';
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
      '01 07': '%'
    };
    return units[pid] || '';
  }

  /**
   * Cleanup method to disconnect MCP connections
   */
  async cleanup() {
    try {
      if (this.mcpRealtimeTool) {
        await this.mcpRealtimeTool.disconnectMCP();
      }
      if (this.mcpDiagnosticTool && this.mcpDiagnosticTool.disconnectMCP) {
        await this.mcpDiagnosticTool.disconnectMCP();
      }
      console.log('🧹 OBD2MCPAgent cleanup completed');
    } catch (error) {
      console.warn('⚠️ Error during MCP cleanup:', error);
    }
  }
}

export default OBD2MCPAgent;