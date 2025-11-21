# Analysis Storage and Retrieval System

## Overview
The OBD2 system now includes a dedicated Analysis storage system that allows frontend applications to store and retrieve analysis results with comprehensive multi-plot visualizations using unique analysis IDs.

## Architecture

### Database Schema
**Collection:** `analyses`

**Model:** `/models/analysis.model.js`

Each analysis document contains:
- **analysisId**: Unique string identifier (e.g., `analysis_abc123_def456`)
- **sessionId**: Reference to the diagnostic session
- **analysisType**: Type of analysis performed
- **result**: Full text analysis report
- **structuredData**: Parsed analysis components (health scores, anomalies, recommendations)
- **plots**: Array of base64-encoded PNG visualizations
- **context**: Session context (data point count, time range, DTC codes, vehicle info)
- **modelInfo**: AI model details
- **tags**: Categorization tags
- **timestamps**: Creation and update times

### Key Features
- ✅ Unique analysis IDs for easy retrieval
- ✅ Comprehensive multi-plot PNG dashboards stored as base64
- ✅ Structured data for programmatic access
- ✅ Backwards compatible with existing session storage
- ✅ Soft delete capability
- ✅ Tag-based categorization
- ✅ Interval analysis support

---

## API Endpoints

### 1. Run Analysis (Creates New Analysis)

**Endpoint:** `POST /api/obd2/sessions/:sessionId/analyze`

**Request Body:**
```json
{
  "analysisType": "comprehensive",
  "includeVisualization": true,
  "timeRange": {
    "start": "2025-01-01T00:00:00Z",
    "end": "2025-01-01T01:00:00Z"
  },
  "vehicleContext": {},
  "customerContext": {}
}
```

**Response:**
```json
{
  "success": true,
  "analysisId": "analysis_lqz8x9_k2p4m1",
  "analysisUrl": "/api/obd2/analysis/analysis_lqz8x9_k2p4m1",
  "sessionId": "507f1f77bcf86cd799439011",
  "analysisType": "comprehensive",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "analysis": {
    "response": "# Comprehensive OBD2 Diagnostic Analysis Report...",
    "sessionInfo": { ... }
  },
  "enhancedAnalysis": {
    "healthScores": {
      "overall": 85,
      "engine": 90,
      "fuel": 80,
      "emissions": 85,
      "cooling": 88,
      "electrical": 92
    },
    "anomalies": { ... },
    "dtcAnalysis": { ... }
  },
  "visualizations": [
    {
      "imageId": "plot_1234567890",
      "data": "iVBORw0KGgoAAAANS...",
      "type": "chart",
      "description": "Comprehensive OBD2 dashboard"
    }
  ]
}
```

---

### 2. Get Analysis by ID (Recommended)

**Endpoint:** `GET /api/obd2/analysis/:analysisId`

**Example:** `GET /api/obd2/analysis/analysis_lqz8x9_k2p4m1`

**Response:**
```json
{
  "success": true,
  "analysisId": "analysis_lqz8x9_k2p4m1",
  "sessionId": "507f1f77bcf86cd799439011",
  "analysisType": "comprehensive",
  "status": "completed",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "duration": 45.5,
  "result": "# Comprehensive OBD2 Diagnostic Analysis Report...",
  "structuredData": {
    "summary": {
      "totalParameters": 25,
      "parametersInRange": 20,
      "parametersOutOfRange": 5,
      "criticalIssues": 1,
      "dtcCodes": 2
    },
    "healthScores": {
      "overall": 85,
      "engine": 90,
      "fuel": 80,
      "emissions": 85,
      "cooling": 88,
      "electrical": 92
    },
    "anomalies": {
      "inRange": [...],
      "outOfRange": [...],
      "critical": [...]
    },
    "recommendations": [...]
  },
  "plots": [
    {
      "filename": "obd2_comprehensive_dashboard_1234567890.png",
      "data": "iVBORw0KGgoAAAANSUhEUgAA...",
      "base64": "iVBORw0KGgoAAAANSUhEUgAA...",
      "mimeType": "image/png",
      "description": "Comprehensive OBD2 dashboard",
      "generatedAt": "2025-01-15T10:30:45.000Z"
    }
  ],
  "context": {
    "dataPointCount": 1250,
    "timeRange": {
      "start": "2025-01-15T09:00:00.000Z",
      "end": "2025-01-15T10:30:00.000Z"
    },
    "dtcCodes": ["P0171", "P0420"],
    "vehicleInfo": { ... }
  },
  "modelInfo": {
    "model": "o3-mini",
    "reasoningEffort": "medium"
  },
  "tags": ["comprehensive", "has_dtc", "critical_issues"],
  "analysisUrl": "/api/obd2/analysis/analysis_lqz8x9_k2p4m1",
  "sessionUrl": "/api/obd2/sessions/507f1f77bcf86cd799439011",
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-01-15T10:30:00.000Z"
}
```

---

### 3. Get All Analyses for a Session

**Endpoint:** `GET /api/obd2/sessions/:sessionId/analyses`

**Query Parameters:**
- `limit` (default: 10) - Number of results to return
- `offset` (default: 0) - Pagination offset
- `includeDeleted` (default: false) - Include soft-deleted analyses

**Example:** `GET /api/obd2/sessions/507f1f77bcf86cd799439011/analyses?limit=5&offset=0`

**Response:**
```json
{
  "success": true,
  "sessionId": "507f1f77bcf86cd799439011",
  "analyses": [
    {
      "analysisId": "analysis_lqz8x9_k2p4m1",
      "analysisType": "comprehensive",
      "status": "completed",
      "timestamp": "2025-01-15T10:30:00.000Z",
      "duration": 45.5,
      "plotCount": 1,
      "hasRecommendations": true,
      "healthScore": 85,
      "tags": ["comprehensive", "has_dtc"],
      "analysisUrl": "/api/obd2/analysis/analysis_lqz8x9_k2p4m1",
      "createdAt": "2025-01-15T10:30:00.000Z"
    },
    {
      "analysisId": "analysis_abc123_xyz789",
      "analysisType": "quick_overview",
      "status": "completed",
      "timestamp": "2025-01-15T09:45:00.000Z",
      "duration": 12.3,
      "plotCount": 1,
      "hasRecommendations": false,
      "healthScore": 90,
      "tags": ["quick_overview", "interval_analysis"],
      "analysisUrl": "/api/obd2/analysis/analysis_abc123_xyz789",
      "createdAt": "2025-01-15T09:45:00.000Z"
    }
  ],
  "total": 5,
  "limit": 5,
  "offset": 0
}
```

**Note:** This endpoint excludes base64 plot data from the list view for performance. Use the individual analysis endpoint to get full plot data.

---

### 4. Get Only Plots from Analysis

**Endpoint:** `GET /api/obd2/analysis/:analysisId/plots`

**Example:** `GET /api/obd2/analysis/analysis_lqz8x9_k2p4m1/plots`

**Response:**
```json
{
  "success": true,
  "analysisId": "analysis_lqz8x9_k2p4m1",
  "plots": [
    {
      "filename": "obd2_comprehensive_dashboard_1234567890.png",
      "data": "iVBORw0KGgoAAAANSUhEUgAA...",
      "mimeType": "image/png",
      "description": "Comprehensive OBD2 dashboard",
      "generatedAt": "2025-01-15T10:30:45.000Z"
    }
  ],
  "plotCount": 1
}
```

**Use Case:** Perfect for displaying image galleries or previews without loading the full analysis data.

---

### 5. Delete Analysis (Soft Delete)

**Endpoint:** `DELETE /api/obd2/analysis/:analysisId`

**Example:** `DELETE /api/obd2/analysis/analysis_lqz8x9_k2p4m1`

**Response:**
```json
{
  "success": true,
  "message": "Analysis deleted successfully",
  "analysisId": "analysis_lqz8x9_k2p4m1"
}
```

**Note:** This performs a soft delete (sets `isDeleted: true`). The data remains in the database but won't appear in normal queries.

---

### 6. Get Interval Analysis Results

**Endpoint:** `GET /api/obd2/sessions/:sessionId/interval-analysis`

**Response:**
```json
{
  "success": true,
  "sessionId": "507f1f77bcf86cd799439011",
  "intervalAnalysis": {
    "quick_check": {
      "timestamp": "2025-01-15T09:00:30.000Z",
      "analysisType": "anomaly_detection",
      "analysisId": "analysis_interval_30s_abc123",
      "result": "⚠️ ALERTS: engineTemp out of range...",
      "plots": [...],
      "duration": 8.5,
      "dataPointCount": 50
    },
    "mid_session": {
      "timestamp": "2025-01-15T09:03:00.000Z",
      "analysisType": "quick_overview",
      "analysisId": "analysis_interval_3min_xyz789",
      "result": "Overall vehicle status: Good...",
      "plots": [...],
      "duration": 15.2,
      "dataPointCount": 300
    }
  },
  "autoAnalysis": {...},
  "availableIntervals": ["quick_check", "mid_session"]
}
```

---

## Frontend Integration Guide

### Typical Workflow

#### 1. Run Analysis
```javascript
// Trigger analysis
const response = await fetch(`/api/obd2/sessions/${sessionId}/analyze`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    analysisType: 'comprehensive',
    includeVisualization: true
  })
});

const data = await response.json();
const analysisId = data.analysisId;  // Save this!
console.log('Analysis URL:', data.analysisUrl);
```

#### 2. Retrieve Analysis Later
```javascript
// Fetch analysis by ID (anytime later)
const response = await fetch(`/api/obd2/analysis/${analysisId}`);
const analysis = await response.json();

// Display plots
analysis.plots.forEach(plot => {
  const img = document.createElement('img');
  img.src = `data:${plot.mimeType};base64,${plot.base64}`;
  img.alt = plot.description;
  document.body.appendChild(img);
});
```

#### 3. Display Health Scores
```javascript
const { healthScores } = analysis.structuredData;
console.log('Overall Health:', healthScores.overall);
console.log('Engine Health:', healthScores.engine);
console.log('Fuel System:', healthScores.fuel);
```

#### 4. Show Recommendations
```javascript
const { recommendations } = analysis.structuredData;
recommendations.forEach(rec => {
  console.log(`[${rec.priority}] ${rec.action}`);
  console.log(`Reason: ${rec.reason}`);
});
```

#### 5. List All Analyses for Session
```javascript
// Get all analyses for a session
const response = await fetch(`/api/obd2/sessions/${sessionId}/analyses?limit=10`);
const { analyses, total } = await response.json();

// Display list (without heavy plot data)
analyses.forEach(analysis => {
  console.log(`${analysis.analysisType} - Health: ${analysis.healthScore}/100`);
  console.log(`Plots: ${analysis.plotCount}, Date: ${analysis.timestamp}`);
});
```

---

## React Example Components

### Analysis Display Component
```jsx
import React, { useEffect, useState } from 'react';

function AnalysisViewer({ analysisId }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAnalysis() {
      try {
        const response = await fetch(`/api/obd2/analysis/${analysisId}`);
        const data = await response.json();
        setAnalysis(data);
      } catch (error) {
        console.error('Failed to fetch analysis:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchAnalysis();
  }, [analysisId]);

  if (loading) return <div>Loading analysis...</div>;
  if (!analysis) return <div>Analysis not found</div>;

  return (
    <div className="analysis-viewer">
      <h1>Analysis Report</h1>
      <p>Type: {analysis.analysisType}</p>
      <p>Date: {new Date(analysis.timestamp).toLocaleString()}</p>

      {/* Health Scores */}
      <div className="health-scores">
        <h2>Vehicle Health</h2>
        <p>Overall: {analysis.structuredData.healthScores.overall}/100</p>
        <p>Engine: {analysis.structuredData.healthScores.engine}/100</p>
        <p>Fuel: {analysis.structuredData.healthScores.fuel}/100</p>
      </div>

      {/* Visualizations */}
      <div className="plots">
        <h2>Diagnostic Plots</h2>
        {analysis.plots.map((plot, index) => (
          <div key={index}>
            <img
              src={`data:${plot.mimeType};base64,${plot.base64}`}
              alt={plot.description}
              style={{ maxWidth: '100%' }}
            />
            <p>{plot.description}</p>
          </div>
        ))}
      </div>

      {/* Recommendations */}
      <div className="recommendations">
        <h2>Recommendations</h2>
        {analysis.structuredData.recommendations.map((rec, index) => (
          <div key={index} className={`priority-${rec.priority}`}>
            <h3>[{rec.priority.toUpperCase()}] {rec.action}</h3>
            <p>{rec.reason}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AnalysisViewer;
```

---

## Database Indexes

The Analysis model includes optimized indexes for common queries:

```javascript
// Single field indexes
analysisId: unique, indexed
sessionId: indexed
timestamp: indexed

// Compound indexes
{ sessionId: 1, timestamp: -1 }  // Session analyses sorted by date
{ analysisType: 1, status: 1 }   // Filter by type and status
{ 'context.dtcCodes': 1 }        // Find analyses with specific DTC codes
{ tags: 1 }                       // Tag-based categorization
```

---

## Data Size Considerations

### Plot Storage
- Each PNG dashboard: ~50-200 KB (base64 encoded: ~70-270 KB)
- Comprehensive dashboard (9 plots): ~70-270 KB total (all on one image)
- Base64 encoding adds ~33% overhead

### Optimization Tips
1. **List Views**: Use `/sessions/:sessionId/analyses` which excludes base64 data
2. **Plot-Only Requests**: Use `/analysis/:analysisId/plots` for image galleries
3. **Pagination**: Use `limit` and `offset` parameters for large result sets
4. **Caching**: Cache analysis IDs in your frontend application

---

## Migration Notes

### Backwards Compatibility
The system maintains backwards compatibility with the existing session-based storage:
- Analysis data is still saved to `DiagnosticSession` model
- Old endpoints (`GET /sessions/:sessionId/analysis`) continue to work
- New `analysisId` is included in session metadata

### Recommended Migration Path
1. **Immediate**: Start using analysis IDs from POST response
2. **New Features**: Use `/api/obd2/analysis/:analysisId` endpoint
3. **Legacy Support**: Old session-based endpoints remain functional
4. **Gradual Migration**: Update frontend components incrementally

---

## Error Handling

### Common Errors

**404 - Analysis Not Found**
```json
{
  "success": false,
  "error": "Analysis not found",
  "message": "No analysis found with the provided ID",
  "analysisId": "invalid_id"
}
```

**400 - Invalid Session ID**
```json
{
  "success": false,
  "error": "Invalid session ID format",
  "sessionId": "invalid"
}
```

**500 - Server Error**
```json
{
  "success": false,
  "error": "Failed to retrieve analysis",
  "message": "Database connection error"
}
```

---

## Performance Characteristics

### Response Times (typical)
- `GET /analysis/:analysisId`: 50-150ms (with plots)
- `GET /analysis/:analysisId/plots`: 30-100ms (plots only)
- `GET /sessions/:sessionId/analyses`: 20-80ms (list without plots)
- `POST /sessions/:sessionId/analyze`: 30-60 seconds (full analysis)

### Database Size
- Average analysis: ~300 KB
- 1000 analyses: ~300 MB
- Consider archiving old analyses after 90 days

---

## Summary

The Analysis Storage System provides:
✅ Unique, shareable analysis IDs
✅ Comprehensive multi-plot PNG visualizations
✅ Structured data for programmatic access
✅ Efficient retrieval and pagination
✅ Backwards compatibility
✅ Soft delete capability
✅ Production-ready performance

**Best Practice:** Always save and use `analysisId` from the POST response for future retrieval. This provides the most reliable and efficient access to analysis results and visualizations.
