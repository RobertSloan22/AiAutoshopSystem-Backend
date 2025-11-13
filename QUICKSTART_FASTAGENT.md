# Quick Start: Fast-Agent Integration

## What You Have Now

Your automotive AI agent can now use an advanced multi-agent data analysis system to analyze OBD2 session data. The analysis streams progress and results directly into your React frontend transcript.

## Setup (5 minutes)

### 1. Add Environment Variable

```bash
# In AiAutoshopSystem-Backend/.env
FASTAGENT_SERVER_URL=http://localhost:8080
```

### 2. Start Fast-Agent Server

```bash
cd AiAutoshopSystem-Backend/fastagent-server/examples/data-analysis
python app.py
```

You should see:
```
Starting server on port 8080
Upload directory created/verified: /path/to/uploads
Mount point directory created/verified: /path/to/mount-point1
```

### 3. Test It

In your React app, tell your agent:

**User**: "Analyze the last session with comprehensive analysis"

**Agent will**:
1. Call `analyze_session_with_fast_agent` tool
2. Export OBD2 data to CSV
3. Upload to fast-agent server
4. Stream analysis progress to transcript
5. Display generated visualizations in transcript

## How It Appears in Your Transcript

```
🔬 Fast-Agent Multi-Agent Analysis Starting
Initializing the advanced data analysis system...

⏳ Exporting session data to CSV...
⏳ Exported 1500 data points to CSV
⏳ Uploading CSV to analysis server...
⏳ CSV uploaded successfully  
⏳ Starting data analysis...

📊 Loading data from CSV...
📊 Performing statistical analysis...
📊 Detecting patterns and correlations...
📊 Generating visualizations...

[Chart 1: Time Series Analysis appears]
[Chart 2: Parameter Correlation Matrix appears]
[Chart 3: Health Dashboard appears]

✅ Fast-Agent Analysis Complete
Generated 3 visualizations
```

## Agent Behavior

Your agent now has intelligent analysis selection:

### Scenario 1: User Asks for Analysis
**User**: "Can you analyze my session data?"

**Agent thinks**: *User wants analysis, I'll use fast-agent for superior quality*

**Agent calls**: `analyze_session_with_fast_agent(sessionId, 'comprehensive', true)`

**Result**: Comprehensive multi-agent analysis with automated visualizations streams into transcript

### Scenario 2: Complex Diagnostic
**User**: "I have multiple DTCs and need detailed analysis"

**Agent thinks**: *Complex case, perfect for fast-agent multi-agent system*

**Agent calls**: `analyze_session_with_fast_agent(sessionId, 'diagnostics', true)`

**Result**: Multiple AI agents analyze the data from different perspectives

### Scenario 3: Quick Check
**User**: "Just give me a quick overview"

**Agent thinks**: *Simple request, standard analysis is fine*

**Agent calls**: `analyze_session_data(sessionId, 'comprehensive', true, [])`

**Result**: Fast standard analysis with Python visualizations

## What Gets Analyzed

The fast-agent system analyzes:

- **All OBD2 Parameters**: RPM, speed, temperature, throttle, load, fuel trims, O2 sensors, etc.
- **Time Series Data**: Parameter evolution over session duration
- **Correlations**: How parameters relate to each other
- **Anomalies**: Values outside normal ranges
- **Patterns**: Recurring behaviors and trends
- **DTC Correlation**: How DTCs relate to parameter values

## Generated Visualizations

Fast-agent automatically creates:

1. **Comprehensive Dashboard**: Overview of all key parameters
2. **Time Series Plots**: Parameter trends over time
3. **Correlation Matrix**: Parameter relationships heatmap
4. **Health Scoring**: System health by category
5. **DTC Impact Analysis**: How codes affect systems
6. **Recommendations Panel**: Prioritized repair suggestions

## Benefits vs Standard Analysis

| Feature | Fast-Agent | Standard |
|---------|-----------|----------|
| Multiple AI Agents | ✅ Yes | ❌ No |
| Auto Visualizations | ✅ Professional | ⚠️ Manual |
| Progress Streaming | ✅ Real-time | ❌ No |
| Pattern Detection | ✅ Advanced | ⚠️ Basic |
| Report Quality | ✅ Superior | ⚠️ Good |
| Setup Required | ⚠️ Python Server | ✅ None |

## Endpoints Created

```
POST   /api/obd2/sessions/:sessionId/analyze/fast-agent
  ↳ Start analysis (streams via SSE)

GET    /api/obd2/sessions/:sessionId/analyze/fast-agent/status?lastId=0
  ↳ Poll for progress messages

GET    /api/obd2/sessions/:sessionId/analyze/fast-agent/images?lastId=0
  ↳ Poll for visualizations

GET    /api/obd2/fast-agent/health
  ↳ Check if fast-agent server is running
```

## Testing

### Test 1: Health Check

```bash
curl http://localhost:5000/api/obd2/fast-agent/health
```

Expected:
```json
{
  "success": true,
  "available": true,
  "status": "ok"
}
```

### Test 2: Manual Analysis Trigger

```bash
curl -X POST http://localhost:5000/api/obd2/sessions/YOUR_SESSION_ID/analyze/fast-agent \
  -H "Content-Type: application/json" \
  -d '{
    "includeVisualization": true,
    "streamProgress": true,
    "analysisType": "comprehensive"
  }'
```

Watch the SSE stream for progress events.

### Test 3: Via Agent

In your React app:
1. Record an OBD2 session (collect some data)
2. Stop the session
3. Tell agent: "Analyze this session using the advanced multi-agent system"
4. Watch transcript for streaming progress and visualizations

## Customization

### Analysis Types

```javascript
// In agent tool call
analyze_session_with_fast_agent({
  sessionId: 'abc123',
  analysisType: 'performance',  // Options: comprehensive, performance, diagnostics, fuel_efficiency, maintenance, driving_behavior
  streamProgress: true
})
```

### Disable Streaming

```javascript
analyze_session_with_fast_agent({
  sessionId: 'abc123',
  analysisType: 'comprehensive',
  streamProgress: false  // Get final results only
})
```

## Common Issues

### "Fast-agent server unavailable"
➡️ Start the Python server: `cd fastagent-server/examples/data-analysis && python app.py`

### "No data available for analysis"
➡️ Ensure session has data points (check MongoDB OBD2DataPoint collection)

### "Session not found"
➡️ Verify session ID is valid and session exists in MongoDB

### Visualizations not showing
➡️ Check fast-agent server has matplotlib/seaborn installed
➡️ Verify mount-point1 directory has write permissions

## Directory Structure

```
AiAutoshopSystem-Backend/
├── fastagent-server/
│   └── examples/
│       └── data-analysis/
│           ├── app.py                    # Fast-agent Flask server
│           ├── analysis_wrapper.py        # Analysis logic
│           ├── uploads/                   # CSV uploads
│           └── mount-point1/              # Generated images
├── services/
│   ├── fastAgentService.js               # Communication layer
│   └── obd2CsvExportService.js           # CSV export
├── routes/
│   └── obd2.routes.js                    # New endpoints
└── temp/
    └── csv-exports/                       # Temporary CSVs (auto-cleanup)
```

## Success Indicators

✅ Fast-agent server shows "Starting server on port 8080"
✅ Health endpoint returns `{"available": true}`
✅ Agent can call `analyze_session_with_fast_agent` tool
✅ Progress messages stream into transcript
✅ Visualizations appear in transcript as base64 images
✅ Analysis completes with summary message

## Next Steps

1. Test with a real OBD2 session
2. Monitor visualization quality
3. Adjust analysis types based on use case
4. Configure auto-cleanup intervals for CSV files
5. Consider adding custom analysis prompts to fast-agent server

## Documentation

- **API Reference**: See `FASTAGENT_INTEGRATION.md`
- **Setup Guide**: See `FAST_AGENT_SETUP.md`
- **Fast-Agent Docs**: See `fastagent-server/README.md`

