# Fast-Agent Integration Setup Guide

## Overview

Your automotive diagnostic system now integrates with the fast-agent multi-agent data analysis system. This provides superior analysis quality using multiple specialized AI agents working together to analyze OBD2 session data.

## What Was Integrated

### Backend Components Created

1. **`services/fastAgentService.js`** - Service to communicate with fast-agent Python server
   - Upload CSV files to fast-agent
   - Trigger analysis jobs
   - Poll for progress and results
   - Retrieve generated visualizations

2. **`services/obd2CsvExportService.js`** - Export OBD2 session data to CSV
   - Converts MongoDB OBD2 data to CSV format
   - Handles all OBD2 parameters (RPM, speed, temperature, etc.)
   - Includes metadata (session ID, vehicle info)
   - Automatic cleanup of old files

3. **`routes/obd2.routes.js`** - New endpoints added:
   - `POST /api/obd2/sessions/:sessionId/analyze/fast-agent` - Start analysis with streaming
   - `GET /api/obd2/sessions/:sessionId/analyze/fast-agent/status` - Get analysis progress
   - `GET /api/obd2/sessions/:sessionId/analyze/fast-agent/images` - Get visualizations
   - `GET /api/obd2/fast-agent/health` - Check fast-agent server status

### Frontend Components Updated

1. **Agent Tool Added**: `analyze_session_with_fast_agent`
   - Located in `startupConnectionAgent.ts`
   - Streams progress and results to transcript
   - Handles visualizations automatically
   - Displays terminal output and analysis results

2. **Agent Instructions Updated**:
   - Added guidance on when to use fast-agent vs standard analysis
   - Tool selection guide for different scenarios
   - Proactive triggers for offering fast-agent analysis

## Setup Instructions

### 1. Environment Configuration

Add to your `.env` file:

```env
# Fast-Agent Server Configuration
FASTAGENT_SERVER_URL=http://localhost:8080

# Optional: Enable if fast-agent server is on different host
# FASTAGENT_SERVER_URL=http://your-server:8080
```

### 2. Start Fast-Agent Server

Navigate to the fast-agent server directory and start it:

```bash
cd AiAutoshopSystem-Backend/fastagent-server/examples/data-analysis
python app.py
```

The server will start on port 8080 by default.

### 3. Verify Integration

Test the integration with a health check:

```bash
curl http://localhost:5000/api/obd2/fast-agent/health
```

Expected response:
```json
{
  "success": true,
  "available": true,
  "status": "ok",
  "serverUrl": "http://localhost:8080"
}
```

## How It Works

### Data Flow

1. **Export**: OBD2 session data is exported from MongoDB to CSV format
   ```
   MongoDB (OBD2DataPoint collection)
   → CSV Export Service
   → Temporary CSV file
   ```

2. **Upload**: CSV is uploaded to fast-agent server
   ```
   CSV file
   → Fast-Agent Service (HTTP multipart upload)
   → Fast-Agent Python Server
   ```

3. **Analysis**: Fast-agent processes the CSV with multiple AI agents
   ```
   Fast-Agent Server
   → Data Analysis Agent (statistics, patterns)
   → Visualization Agent (charts, plots)
   → Diagnostic Agent (insights, recommendations)
   → Report Agent (comprehensive summary)
   ```

4. **Streaming**: Progress and results stream back to frontend
   ```
   Fast-Agent Server
   → Server-Sent Events (SSE)
   → Node.js Backend (obd2.routes.js)
   → Agent Tool Logic
   → Transcript Display
   ```

## Using the Tool

### From Your Agent

The agent can now analyze sessions using the fast-agent system:

**User says**: "Can you analyze the session data?"

**Agent responds**: Calls `analyze_session_with_fast_agent` tool with the session ID

**What happens**:
1. Agent displays: "🔬 Fast-Agent Multi-Agent Analysis Starting..."
2. Progress updates stream in: "⏳ Exporting session data to CSV..."
3. Terminal output appears: "📊 Loading data... Analyzing patterns..."
4. Visualizations display as generated: Charts appear in transcript
5. Final message: "✅ Fast-Agent Analysis Complete - Generated 5 visualizations"

### Example Conversation

```
User: "I just stopped the recording session, can you analyze it?"

Agent: [Calls analyze_session_with_fast_agent with session ID]

Transcript shows:
  🔬 Fast-Agent Multi-Agent Analysis Starting
  ⏳ Exporting session data to CSV...
  ⏳ Exported 1500 data points to CSV
  ⏳ Uploading CSV to analysis server...
  ⏳ CSV uploaded successfully
  ⏳ Starting data analysis...
  📊 Loading data from CSV...
  📊 Analyzing 1500 data points...
  📊 Detecting patterns and anomalies...
  📊 Generating visualizations...
  [Chart 1 appears]
  [Chart 2 appears]
  [Chart 3 appears]
  ✅ Fast-Agent Analysis Complete - Generated 3 visualizations
```

## Agent Tool Selection

The agent now has three analysis options:

### 1. Fast-Agent Analysis (RECOMMENDED)
- **Tool**: `analyze_session_with_fast_agent`
- **When**: User wants comprehensive analysis
- **Benefits**: 
  - Multiple AI agents working together
  - Automated professional visualizations
  - Real-time progress streaming
  - Superior analysis quality
- **Use for**: Complex diagnostics, multiple DTCs, comprehensive analysis requests

### 2. Standard Backend Analysis
- **Tool**: `analyze_session_data`
- **When**: Basic analysis needed, fast-agent unavailable
- **Benefits**: Fast, reliable, uses Python visualization tools
- **Use for**: Quick analysis, single parameter checks

### 3. Post-Session Analysis
- **Tool**: `perform_post_session_analysis`
- **When**: Automatically after session ends
- **Benefits**: Detailed statistical breakdown, custom plot types
- **Use for**: Automated analysis on session completion

## Troubleshooting

### Fast-Agent Server Not Running

**Error**: "Fast-agent server unavailable"

**Solution**:
1. Start the fast-agent server: `cd fastagent-server/examples/data-analysis && python app.py`
2. Check server is listening: `curl http://localhost:8080/health`
3. Verify FASTAGENT_SERVER_URL environment variable

### No Visualizations Appearing

**Issue**: Analysis completes but no charts show

**Check**:
1. Fast-agent server console for matplotlib/seaborn errors
2. Fast-agent server has write permissions to mount-point1 directory
3. Backend can fetch images from fast-agent server
4. Network connectivity between backend and fast-agent server

### Session Has No Data

**Error**: "No data available for analysis"

**Solution**:
1. Verify session was stopped properly (not just created)
2. Check session actually recorded data (dataPointCount > 0)
3. Wait 2-3 seconds after stopping before analyzing
4. Verify MongoDB has OBD2DataPoint entries for the session

### CSV Export Fails

**Issue**: Export fails with errors

**Check**:
1. MongoDB connection is active
2. Session ID is valid MongoDB ObjectId
3. temp/csv-exports directory exists and is writable
4. Node.js has file system permissions

## File Locations

```
AiAutoshopSystem-Backend/
├── services/
│   ├── fastAgentService.js          # Fast-agent communication
│   └── obd2CsvExportService.js      # CSV export for OBD2 data
├── routes/
│   └── obd2.routes.js               # Endpoints: /analyze/fast-agent
├── temp/
│   └── csv-exports/                 # Temporary CSV files (auto-cleanup)
├── FASTAGENT_INTEGRATION.md         # API documentation
└── FAST_AGENT_SETUP.md              # This file

src/app/src/app/agent/app/agentConfigs/customerServiceRetail/
└── startupConnectionAgent.ts         # Agent with fast-agent tool
```

## Environment Variables

```env
# Required
FASTAGENT_SERVER_URL=http://localhost:8080

# Optional - if MongoDB is on different host
MONGO_DB_URI=mongodb://localhost:27017/yourdb

# Optional - API base URL if backend is on different host
VITE_API_BASE_URL=http://localhost:5000
```

## Next Steps

1. ✅ Start fast-agent server
2. ✅ Verify health endpoint responds
3. ✅ Test with a sample session
4. Monitor agent conversations for fast-agent usage
5. Review generated visualizations quality
6. Adjust analysis types based on diagnostic needs

## Advanced Configuration

### Custom Analysis Types

The fast-agent system supports different analysis types:
- `comprehensive` - Full analysis with all metrics
- `performance` - Focus on engine performance metrics
- `diagnostics` - Focus on diagnostic parameters
- `fuel_efficiency` - Focus on fuel system analysis
- `maintenance` - Focus on maintenance indicators
- `driving_behavior` - Focus on driving patterns

### Streaming Configuration

By default, analysis progress streams in real-time. To disable:

```javascript
analyze_session_with_fast_agent({
  sessionId: 'your-session-id',
  analysisType: 'comprehensive',
  streamProgress: false  // Disable streaming
})
```

## Support

For issues:
1. Check fast-agent server logs
2. Check Node.js backend logs
3. Review browser console for frontend errors
4. Check MongoDB for session data existence
5. Verify all services are running (MongoDB, Redis, Backend, Fast-Agent)

