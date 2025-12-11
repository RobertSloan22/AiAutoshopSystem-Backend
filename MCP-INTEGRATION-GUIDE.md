# MCP ELM327 Integration Guide

## Overview

This guide explains how to set up and use the experimental MCP (Model Context Protocol) integration with your ELM327 OBD2 adapter in the OBD2 code interpreter system.

## Architecture

The MCP integration adds a third agent to your existing system:

1. **OBD2DataAccessAgent** (Existing) - Historical data from MongoDB
2. **OBD2AnalysisAgent** (Existing) - Code execution and visualization  
3. **OBD2MCPAgent** (NEW) - Real-time ELM327 data via MCP server

## Setup Instructions

### 1. Install Python Dependencies

```bash
cd mcp-servers/
pip install -r requirements.txt
```

### 2. Install Node.js MCP Dependencies

```bash
npm install @modelcontextprotocol/sdk
```

### 3. Configure ELM327 Hardware

Follow your existing setup guide: `fastagent-server/examples/researcher/OBD2-ADAPTER-SETUP.md`

Key points:
- Ensure ELM327 is paired via Bluetooth or connected via USB
- Note the device path (e.g., `/dev/ttyUSB0` or Bluetooth address)
- Test with a simple OBD2 scanner app first

### 4. Update MCP Configuration

Edit `config/mcp-elm327.config.json`:

```json
{
  "elm327_config": {
    "device_path": "/dev/ttyUSB0",  // Update this path
    "baud_rate": 38400,
    "timeout_seconds": 10,
    "preferred_protocol": "AUTO"
  }
}
```

### 5. Test MCP Server

```bash
cd mcp-servers/
python elm327-mcp-server.py --device /dev/ttyUSB0 --debug
```

## API Usage

### Experimental Analysis Endpoint

**POST** `/api/obd2/sessions/:sessionId/analyze/secure/experimental`

```json
{
  "question": "Analyze this diagnostic session and compare with current vehicle state",
  "reasoningEffort": "medium",
  "includeRealtimeData": true,
  "realtimeDuration": 30,
  "enableLiveComparison": true,
  "mcpConfig": {
    "command": "python",
    "args": ["-m", "mcp_servers.elm327"],
    "timeout": 30000
  }
}
```

### Live Status Check

**GET** `/api/obd2/live/status`

```json
{
  "success": true,
  "timestamp": "2024-12-05T10:30:00Z",
  "vehicleStatus": {
    "connection": {
      "connected": true,
      "protocol": "ISO15765",
      "response_time_ms": 45.2
    },
    "realtime_data": {
      "summary": {
        "pid_count": 4,
        "sample_count": 5
      }
    },
    "diagnostics": {
      "stored_dtcs": [],
      "total_count": 0
    }
  }
}
```

## Features

### Real-time Data Collection
- Collect live OBD2 PIDs during analysis
- Configurable sampling rates (0.1-10 Hz)
- Safety monitoring and alerts
- Connection quality assessment

### Diagnostic Operations
- Read stored, pending, and permanent DTCs
- Clear DTCs with confirmation
- Vehicle information retrieval (VIN, ECU details)
- Monitor readiness status

### Live vs Historical Comparison
- Compare current vehicle state with stored sessions
- Identify discrepancies and validate conclusions
- Confidence scoring for analysis results
- Safety alerts for critical conditions

### Integration with Existing System
- Works alongside existing secure analysis
- Fallback to historical-only analysis if MCP fails
- Maintains same security model (Docker sandboxing)
- Compatible with existing data models

## Safety Features

- **Critical temperature monitoring**: Alert at >110°C coolant temp
- **RPM safety limits**: Warning at >6500 RPM
- **Speed monitoring**: Alert for excessive speeds
- **Connection validation**: Verify adapter health before data collection
- **Automatic fallback**: Switch to historical analysis if live data fails

## Troubleshooting

### Common Issues

1. **MCP Server Connection Failed**
   ```
   Error: MCP functionality not available
   ```
   - Check ELM327 adapter connection
   - Verify device path in configuration
   - Ensure Python dependencies installed
   - Test with standalone MCP server

2. **ELM327 Not Responding**
   ```
   Error: Failed to connect to ELM327 adapter
   ```
   - Check vehicle ignition (should be ON)
   - Verify OBD2 port accessibility
   - Try different protocols (ISO15765, ISO14230)
   - Check adapter pairing (Bluetooth) or cable (USB)

3. **No Live Data Collected**
   ```
   Warning: Real-time data collection failed
   ```
   - Vehicle may not support requested PIDs
   - Try basic PIDs first: RPM (01 0C), Speed (01 0D)
   - Check protocol compatibility
   - Ensure engine is running for some PIDs

### Debug Mode

Enable detailed logging:

```bash
# Start MCP server with debug
python elm327-mcp-server.py --debug

# Check logs in application
tail -f logs/mcp-elm327.log
```

### Fallback Behavior

If MCP integration fails, the system automatically:
1. Logs the error with troubleshooting suggestions
2. Falls back to regular OBD2AnalysisAgent
3. Continues analysis with historical data only
4. Provides clear indication of fallback in results

## Security Considerations

- **Read-only vehicle access**: MCP agent cannot control vehicle systems
- **Docker isolation**: Code execution still sandboxed
- **Connection validation**: Verify adapter authenticity 
- **Data validation**: Check for reasonable parameter ranges
- **Automatic cleanup**: Disconnect MCP connections after analysis

## Integration Points

### Backend Agents
Your existing backend agents can access MCP via the FastAgent framework:

```javascript
const mcpConfig = require('./config/mcp-elm327.config.json');
const mcpAgent = new OBD2MCPAgent({ 
  languageModelInterface: openAI,
  mcpConfig: mcpConfig.mcp_server
});
```

### Frontend Agents
Frontend can access processed MCP data through existing WebSocket services:

```javascript
// Via existing OBD2 WebSocket service
const ws = new WebSocket('ws://localhost:5005/obd2-realtime');
ws.on('mcp-enhanced-data', handleMCPData);
```

## Performance Considerations

- **Sampling rate**: Higher rates (>2 Hz) may impact adapter performance
- **Duration limits**: Long collections (>5 minutes) may timeout
- **Concurrent access**: Only one MCP client per adapter
- **Connection caching**: Reuse connections for 30 seconds to improve performance

## Future Enhancements

- **Multi-vehicle support**: Connect multiple ELM327 adapters
- **Predictive analysis**: Machine learning on real-time trends  
- **Advanced diagnostics**: Custom PID monitoring and alerts
- **Fleet integration**: Scale to multiple simultaneous vehicles
- **Protocol expansion**: Support for J1939, ISO14229 (UDS)

## Support

For issues specific to MCP integration:
1. Check this guide's troubleshooting section
2. Review MCP server logs
3. Test ELM327 with standalone tools first
4. Ensure all dependencies are correctly installed

For general OBD2 system issues:
- Use existing diagnostic endpoints
- Check existing FastAgent documentation
- Verify MongoDB data integrity