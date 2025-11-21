# OBD2 Interval Analysis System

## Overview

The Interval Analysis System provides real-time analysis of OBD2 data at specific time intervals during active diagnostic sessions. This enables automotive technicians to receive immediate feedback and alerts about vehicle health without waiting for the session to complete.

## Features

### 1. Real-Time Interval Analysis

Analysis is triggered automatically at four key intervals during an active session:

| Interval | Time | Analysis Type | Purpose |
|----------|------|---------------|---------|
| **Quick Check** | 15 seconds | Anomaly Detection | Rapid detection of out-of-bounds parameters and critical alerts |
| **Mid-Session 1** | 60 seconds | Quick Overview | Trend analysis and overall vehicle status |
| **Mid-Session 2** | 2 minutes | Health Check | Comprehensive system health assessment with correlations |
| **Mid-Session 3** | 3 minutes | Diagnostic Analysis | Full diagnostic analysis with predictive insights |

### 2. Multiple Visualizations

Each analysis generates comprehensive multi-panel visualizations:

#### Quick Check (15s)
- **Single comprehensive dashboard** showing all key parameters
- **Color-coded alerts** (RED for out-of-bounds, GREEN for normal)
- **Real-time status** of critical sensors

#### Mid-Session Overviews (60s, 2min)
- **Time-series plots** of critical parameters
- **Trend indicators** (improving/stable/degrading)
- **Current vs normal range** comparisons

#### Full Diagnostic (3min)
- **6-8 panel comprehensive dashboard** including:
  - System health scores
  - Correlation heatmaps
  - Anomaly detection results
  - Predictive maintenance indicators

### 3. Final Session Analysis

When a session ends, a comprehensive analysis generates **3-5 separate visualization files**:

1. **Engine Performance Dashboard** (6-panel)
   - RPM, temperature, throttle, speed
   - Engine efficiency and power estimation

2. **Fuel System Analysis** (4-panel)
   - Fuel trims (short & long term)
   - Fuel pressure and air-fuel ratio

3. **Emissions & O2 Sensors** (4-panel)
   - O2 sensor patterns
   - Catalyst efficiency
   - Emissions system health

4. **System Health Heatmap** (multi-panel)
   - Parameter correlations
   - Health score gauges
   - Anomaly timeline

5. **Diagnostic Summary & Alerts** (dashboard)
   - Key metrics with gauges
   - Alert timeline
   - Overall vehicle health score (0-100)

## API Endpoints

### Start Session (Auto-triggers interval analysis)
```http
POST /api/obd2/sessions
```

Automatically starts interval analysis timers when a new session is created.

### End Session (Triggers final analysis)
```http
PUT /api/obd2/sessions/:sessionId/end
```

Stops interval analysis and triggers comprehensive final analysis.

### Get Interval Analysis Results
```http
GET /api/obd2/sessions/:sessionId/interval-analysis
```

**Response:**
```json
{
  "success": true,
  "sessionId": "507f1f77bcf86cd799439011",
  "intervalAnalysis": {
    "quick_check": {
      "timestamp": "2025-11-19T10:15:30.000Z",
      "analysisType": "anomaly_detection",
      "result": "⚠️ ALERTS: [engineTemp out of range...]\n✅ NORMAL: [rpm, speed...]",
      "plots": [
        {
          "filename": "quick_check_dashboard.png",
          "base64": "iVBORw0KG...",
          "mimeType": "image/png"
        }
      ],
      "duration": 2.5,
      "dataPointCount": 150
    },
    "mid_session_1": { ... },
    "mid_session_2": { ... },
    "mid_session_3": { ... }
  },
  "autoAnalysis": {
    "status": "completed",
    "result": "Comprehensive diagnostic summary...",
    "plots": [ /* 3-5 visualization files */ ],
    "duration": 8.7
  },
  "availableIntervals": ["quick_check", "mid_session_1", "mid_session_2", "mid_session_3"]
}
```

## Architecture

### Components

1. **IntervalAnalysisService** (`services/intervalAnalysisService.js`)
   - Manages interval timers for active sessions
   - Triggers analysis at specified intervals
   - Stores results in DiagnosticSession model

2. **OBD2AnalysisAgent** (`obd2-code-interpreter/agents/OBD2AnalysisAgent.js`)
   - Uses OpenAI o3-mini model for intelligent analysis
   - Generates Python code for data analysis and visualization
   - Executes code in isolated Docker container

3. **DiagnosticSession Model** (MongoDB)
   - Stores interval analysis results
   - Schema includes `intervalAnalysis` field with sub-documents for each interval

### Data Flow

```
Session Start
    ↓
Start Interval Timers (15s, 60s, 2min, 3min)
    ↓
Data Collection (OBD2 data points streaming in)
    ↓
Interval Triggered
    ↓
Load Data → Generate Analysis → Create Visualizations → Store Results
    ↓
Continue monitoring...
    ↓
Session End
    ↓
Stop Timers → Trigger Final Comprehensive Analysis
    ↓
Generate 3-5 Visualization Files → Store Complete Report
```

## Database Schema

```javascript
{
  // ... other session fields ...
  intervalAnalysis: {
    quick_check: {
      timestamp: Date,
      analysisType: String,
      result: String,
      plots: [{ filename, base64, mimeType }],
      duration: Number,
      dataPointCount: Number,
      error: String
    },
    mid_session_1: { ... },
    mid_session_2: { ... },
    mid_session_3: { ... }
  },
  autoAnalysis: {
    status: String,
    startedAt: Date,
    completedAt: Date,
    result: String,
    plots: [{ filename, base64, mimeType }],
    duration: Number,
    error: String
  }
}
```

## Frontend Integration

### Polling for Interval Results

```javascript
// Start polling when session becomes active
const pollInterval = setInterval(async () => {
  const response = await fetch(`/api/obd2/sessions/${sessionId}/interval-analysis`);
  const data = await response.json();

  // Check for new interval results
  if (data.intervalAnalysis.quick_check && !hasDisplayedQuickCheck) {
    displayAlert(data.intervalAnalysis.quick_check);
    hasDisplayedQuickCheck = true;
  }

  // Display visualizations
  displayPlots(data.intervalAnalysis);
}, 5000); // Poll every 5 seconds

// Stop polling when session ends
clearInterval(pollInterval);
```

### Real-time Alerts

The 15-second Quick Check is designed to provide immediate alerts:

```javascript
function displayAlert(quickCheck) {
  if (quickCheck.result.includes('⚠️ ALERTS:')) {
    // Parse and display alerts
    const alerts = parseAlerts(quickCheck.result);
    showNotification({
      type: 'warning',
      title: 'Parameters Out of Range',
      message: alerts.join(', '),
      image: quickCheck.plots[0]?.base64
    });
  }
}
```

## Configuration

### Adjusting Interval Timings

Edit `services/intervalAnalysisService.js`:

```javascript
this.intervalConfigs = {
  quick_check: {
    interval: 15000, // Change to desired milliseconds
    analysisType: 'anomaly_detection',
    reasoningEffort: 'low'
  },
  // ... other intervals
};
```

### Customizing Analysis Prompts

Modify the `generateAnalysisQuestion()` method in `IntervalAnalysisService` to customize what analysis is performed at each interval.

## Performance Considerations

1. **Docker Container**: All Python code execution happens in isolated Docker container
2. **Non-blocking**: Interval analysis runs in background, doesn't affect data collection
3. **Reasoning Effort**: Uses 'low' for quick checks, 'medium' for comprehensive analysis
4. **Caching**: Results stored in MongoDB for quick retrieval

## Security

- All code execution isolated in Docker container
- No access to host filesystem from Python execution
- MongoDB queries use proper ObjectId validation
- Error handling prevents sensitive data exposure

## Troubleshooting

### Interval Analysis Not Triggering

1. Verify Docker container is running: `docker ps | grep obd2_sandbox`
2. Check session is active: `GET /api/obd2/sessions/:sessionId/status`
3. Verify OpenAI API key is configured
4. Check server logs for interval analysis messages

### No Visualizations Generated

1. Ensure matplotlib/seaborn available in Docker container
2. Check Python code execution logs
3. Verify data points exist in database
4. Increase reasoning effort for more reliable visualization generation

### Analysis Takes Too Long

1. Reduce reasoning effort: Change 'medium' to 'low'
2. Limit data points analyzed (sample instead of full dataset)
3. Simplify visualization requirements

## Future Enhancements

- [ ] Real-time SSE (Server-Sent Events) for instant alerts
- [ ] Configurable interval timings per session
- [ ] Custom analysis templates
- [ ] Multi-language support for analysis results
- [ ] Historical trend comparison across sessions
- [ ] Machine learning-based anomaly detection
- [ ] Integration with manufacturer-specific diagnostic databases
