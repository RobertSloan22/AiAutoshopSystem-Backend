# OBD2 Routes Functionality Documentation

## Overview
The OBD2 routes provide comprehensive functionality for managing automotive diagnostic sessions, real-time data collection, analysis, and visualization. This API enables creation, monitoring, and analysis of OBD2 diagnostic sessions with advanced features like real-time streaming, interval analysis, session sharing, and secure code execution.

## Session Management Routes

### POST /sessions
**Purpose**: Creates a new OBD2 diagnostic session  
**Input Parameters**:
- Body: `userId`, `vehicleId`, `sessionName`, `vehicleInfo`, `sessionNotes`, `tags`, `selectedPids`, `dtcCodes`, `affectedSystems`, `focusAreas`, `metadata`, `pidConfiguration`
**Response Format**: 
```json
{
  "success": true,
  "session": {
    "sessionId": "ObjectId",
    "startTime": "Date",
    "status": "active"
  }
}
```
**Key Features**: Automatically starts interval analysis service for real-time monitoring

### PUT /sessions/:sessionId/end
**Purpose**: Ends an active diagnostic session and triggers automatic analysis  
**Input Parameters**:
- Path: `sessionId` (MongoDB ObjectId)
**Response Format**:
```json
{
  "success": true,
  "session": {
    "sessionId": "ObjectId",
    "endTime": "Date",
    "duration": "number (seconds)",
    "dataPointCount": "number",
    "status": "completed",
    "autoAnalysisTriggered": "boolean"
  }
}
```
**Key Features**: 
- Stops interval analysis
- Forces data buffer flush
- Waits for data commit verification
- Triggers automatic background analysis
- Ends associated sharing sessions

### PUT /sessions/:sessionId/status
**Purpose**: Updates session status  
**Input Parameters**:
- Path: `sessionId`
- Body: `status` (active|paused|error|cancelled)
**Response Format**:
```json
{
  "success": true,
  "session": {
    "sessionId": "ObjectId",
    "status": "string"
  }
}
```

## Session Sharing Routes

### POST /sessions/:sessionId/share
**Purpose**: Creates a shareable session with 6-character code  
**Input Parameters**:
- Path: `sessionId`
- Body: `hostUserId` (optional)
**Response Format**:
```json
{
  "success": true,
  "shareCode": "string (6 chars)",
  "sessionId": "ObjectId",
  "expiresAt": "Date"
}
```
**Key Features**: Only allows sharing of active sessions, 24-hour expiry

### POST /share/:shareCode/join
**Purpose**: Joins a shared session using share code  
**Input Parameters**:
- Path: `shareCode` (6-character code)
- Body: `clientId` (optional)
**Response Format**:
```json
{
  "success": true,
  "shareCode": "string",
  "sessionId": "ObjectId",
  "sessionInfo": {
    "sessionName": "string",
    "startTime": "Date",
    "vehicleInfo": "object",
    "status": "string"
  }
}
```

### PUT /share/:shareCode/ping
**Purpose**: Updates client activity timestamp in sharing session  
**Input Parameters**:
- Path: `shareCode`
- Body: `clientId`
**Response Format**:
```json
{
  "success": true,
  "timestamp": "Date"
}
```

### GET /share/:shareCode
**Purpose**: Validates and retrieves share session information  
**Input Parameters**:
- Path: `shareCode`
**Response Format**:
```json
{
  "shareCode": "string",
  "sessionId": "ObjectId",
  "sessionInfo": "object",
  "isActive": "boolean"
}
```

### GET /sessions/:sessionId/sharing
**Purpose**: Retrieves active sharing sessions for a diagnostic session  
**Input Parameters**:
- Path: `sessionId`
**Response Format**:
```json
{
  "sharingSessions": "SharedSession[]"
}
```

### DELETE /share/:shareCode
**Purpose**: Ends a sharing session  
**Input Parameters**:
- Path: `shareCode`
**Response Format**:
```json
{
  "message": "Sharing session ended successfully"
}
```

## Session Query Routes

### GET /sessions/active
**Purpose**: Retrieves active sessions for a user  
**Input Parameters**:
- Query: `userId` (optional)
**Response Format**:
```json
{
  "activeSessions": "Session[]",
  "count": "number",
  "message": "string (if no sessions)"
}
```

### GET /sessions
**Purpose**: Retrieves sessions with flexible filtering  
**Input Parameters**:
- Query: `userId`, `vehicleId`, `vin`, `status`, `sessionType`, `startDate`, `endDate`, `tags`, `limit`, `offset`, `sortBy`, `sortOrder`, `includeSummary`
**Response Format**:
```json
{
  "sessions": "Session[]",
  "total": "number",
  "filters": "object",
  "pagination": "object"
}
```
**Key Features**: Supports VIN-based filtering, pagination, sorting

### GET /sessions/:sessionId
**Purpose**: Retrieves specific session details  
**Input Parameters**:
- Path: `sessionId`
**Response Format**:
```json
{
  "session": "Session object with id field"
}
```

### GET /sessions/:sessionId/status
**Purpose**: Lightweight endpoint for polling session status  
**Input Parameters**:
- Path: `sessionId`
**Response Format**:
```json
{
  "sessionId": "string",
  "status": "string",
  "startTime": "Date",
  "endTime": "Date",
  "duration": "number",
  "dataPointCount": "number",
  "selectedPids": "string[]",
  "dtcCodes": "string[]",
  "affectedSystems": "string",
  "focusAreas": "string[]",
  "analysisTimestamp": "Date",
  "analysisType": "string",
  "tags": "string[]",
  "sessionNotes": "string",
  "metadata": "object",
  "updatedAt": "Date"
}
```

### GET /sessions/:sessionId/interval-analysis
**Purpose**: Retrieves real-time interval analysis results for a session  
**Input Parameters**:
- Path: `sessionId` (MongoDB ObjectId)
**Response Format**:
```json
{
  "success": true,
  "sessionId": "string",
  "intervalAnalysis": "object",
  "autoAnalysis": "object",
  "availableIntervals": "string[]",
  "message": "string (if no results)"
}
```
**Key Features**: Shows analysis at 15s, 60s, 2min, and 3min intervals during active sessions
**Route Location**: routes/obd2.routes.js:949

### GET /vehicles/:vehicleId/sessions
**Purpose**: Retrieves all sessions for a specific vehicle  
**Input Parameters**:
- Path: `vehicleId`
- Query: `status`, `startDate`, `endDate`, `limit`, `offset`, `sortBy`, `sortOrder`, `includeSummary`
**Response Format**:
```json
{
  "vehicleId": "string",
  "sessions": "Session[]",
  "total": "number",
  "pagination": "object",
  "summary": "object (if requested)"
}
```
**Key Features**: Optional summary with statistics and common DTCs

## Data Access Routes

### GET /sessions/:sessionId/data
**Purpose**: Retrieves session data points with filtering and aggregation  
**Input Parameters**:
- Path: `sessionId`
- Query: `startTime`, `endTime`, `interval`, `parameters`, `limit`, `aggregate`
**Response Format**:
```json
{
  "data": "DataPoint[] or AggregatedData[]",
  "count": "number",
  "aggregated": "boolean"
}
```
**Key Features**: 
- Supports time range filtering
- Parameter-specific filtering
- MongoDB aggregation for time-series data
- Raw or aggregated data modes

### PATCH /sessions/:sessionId/config
**Purpose**: Updates session configuration and metadata  
**Input Parameters**:
- Path: `sessionId`
- Body: `selectedPids`, `dtcCodes`, `affectedSystems`, `focusAreas`, `analysisResults`, `analysisTimestamp`, `analysisType`, `visualizations`, `metadata`, `sessionNotes`, `tags`, `pidConfiguration`, `dataPointCount`, `status`
**Response Format**:
```json
{
  "success": true,
  "session": {
    "sessionId": "string",
    "status": "string",
    "selectedPids": "string[]",
    "dtcCodes": "string[]",
    "affectedSystems": "string",
    "focusAreas": "string[]",
    "analysisTimestamp": "Date",
    "analysisType": "string",
    "dataPointCount": "number",
    "tags": "string[]",
    "sessionNotes": "string"
  }
}
```

### DELETE /sessions/:sessionId
**Purpose**: Deletes session and all associated data  
**Input Parameters**:
- Path: `sessionId`
**Response Format**:
```json
{
  "message": "Session deleted successfully"
}
```
**Key Features**: Cascades to delete OBD2DataPoint and DTCEvent records

### POST /sessions/:sessionId/data
**Purpose**: Enhanced data ingestion endpoint for external OBD2 devices  
**Input Parameters**:
- Path: `sessionId`
- Body: OBD2 data point object
**Response Format**:
```json
{
  "success": true,
  "timestamp": "Date",
  "dataPointId": "ObjectId"
}
```
**Key Features**: 
- Stores in both MongoDB and Redis
- Updates session data point count
- Validates session existence

## Real-time Data Routes

### GET /sessions/:sessionId/stream
**Purpose**: Server-Sent Events endpoint for real-time updates  
**Input Parameters**:
- Path: `sessionId`
**Response Format**: SSE stream with JSON data events
**Key Features**: 
- Heartbeat every 30 seconds
- Redis subscription for real-time updates
- Automatic cleanup on disconnect

### GET /sessions/:sessionId/updates
**Purpose**: Polling endpoint for real-time updates  
**Input Parameters**:
- Path: `sessionId`
- Query: `since`, `limit`
**Response Format**:
```json
{
  "data": "DataPoint[]",
  "timestamp": "number",
  "hasMore": "boolean"
}
```

### GET /sessions/:sessionId/long-poll
**Purpose**: Long polling endpoint with 30-second timeout  
**Input Parameters**:
- Path: `sessionId`
- Query: `lastTimestamp`
**Response Format**:
```json
{
  "data": "DataPoint[]",
  "timestamp": "number",
  "type": "data|timeout"
}
```

### GET /sessions/:sessionId/aggregated
**Purpose**: Retrieves aggregated data for charts  
**Input Parameters**:
- Path: `sessionId`
- Query: `interval`, `limit`
**Response Format**:
```json
{
  "data": "AggregatedData[]",
  "interval": "string",
  "count": "number"
}
```

### GET /sessions/:sessionId/range
**Purpose**: Retrieves data by time range with Redis caching  
**Input Parameters**:
- Path: `sessionId`
- Query: `startTime` (required), `endTime`, `limit`
**Response Format**:
```json
{
  "data": "DataPoint[]",
  "count": "number",
  "startTime": "number",
  "endTime": "number"
}
```

### GET /sessions/:sessionId/timeseries
**Purpose**: Optimized timeseries endpoint for live plotting  
**Input Parameters**:
- Path: `sessionId`
- Query: `since`, `interval`, `limit`
**Response Format**:
```json
{
  "success": true,
  "data": "TimeseriesData[]",
  "type": "realtime|aggregated",
  "count": "number",
  "timestamp": "number",
  "sessionId": "string"
}
```
**Key Features**: Real-time or historical data based on `since` parameter

### GET /sessions/:sessionId/stats
**Purpose**: Retrieves session statistics  
**Input Parameters**:
- Path: `sessionId`
**Response Format**: Session statistics object
**Key Features**: Cached stats from Redis

## Analysis Routes

### POST /sessions/:sessionId/analyze
**Purpose**: Performs comprehensive OBD2 data analysis with visualizations  
**Input Parameters**:
- Path: `sessionId`
- Body: `analysisType`, `timeRange`, `includeVisualization`, `vehicleContext`, `customerContext`
**Response Format**:
```json
{
  "success": true,
  "sessionId": "string",
  "analysisType": "string",
  "analysisId": "ObjectId",
  "results": "object",
  "visualizations": "object[]",
  "analysisTimestamp": "Date",
  "processingTime": "number"
}
```
**Key Features**: 
- Race condition handling for recently ended sessions
- Multiple visualization types
- Comprehensive anomaly detection
- Health scoring

### GET /sessions/:sessionId/analysis
**Purpose**: Retrieves latest analysis results for a session  
**Input Parameters**:
- Path: `sessionId`
**Response Format**: Analysis results object

### GET /analysis/:analysisId
**Purpose**: Retrieves specific analysis by ID  
**Input Parameters**:
- Path: `analysisId`
**Response Format**: Analysis object

### GET /sessions/:sessionId/analyses
**Purpose**: Retrieves all analyses for a session  
**Input Parameters**:
- Path: `sessionId`
**Response Format**:
```json
{
  "analyses": "Analysis[]",
  "count": "number"
}
```

### GET /analysis/:analysisId/plots
**Purpose**: Retrieves plot files for an analysis  
**Input Parameters**:
- Path: `analysisId`
**Response Format**:
```json
{
  "plots": "PlotFile[]",
  "count": "number"
}
```

### DELETE /analysis/:analysisId
**Purpose**: Deletes an analysis record  
**Input Parameters**:
- Path: `analysisId`
**Response Format**:
```json
{
  "message": "Analysis deleted successfully"
}
```

### POST /sessions/:sessionId/analyze/stream
**Purpose**: Streaming analysis with real-time updates via SSE  
**Input Parameters**:
- Path: `sessionId`
- Body: Analysis configuration
**Response Format**: SSE stream with analysis progress

## Specialized Analysis Routes

### POST /sessions/compare
**Purpose**: Compares multiple sessions  
**Input Parameters**:
- Body: Array of session IDs
**Response Format**: Comparison analysis results

### POST /sessions/:sessionId/recommendations
**Purpose**: Generates maintenance recommendations  
**Input Parameters**:
- Path: `sessionId`
**Response Format**: Recommendations array

### POST /sessions/:sessionId/fuel-economy
**Purpose**: Analyzes fuel economy patterns  
**Input Parameters**:
- Path: `sessionId`
**Response Format**: Fuel economy analysis

### POST /sessions/:sessionId/anomalies
**Purpose**: Detects anomalies in session data  
**Input Parameters**:
- Path: `sessionId`
**Response Format**: Anomaly detection results

### POST /sessions/:sessionId/health-report
**Purpose**: Generates comprehensive vehicle health report  
**Input Parameters**:
- Path: `sessionId`
**Response Format**: Health report with scores and recommendations

### GET /analysis/tools
**Purpose**: Lists available analysis tools  
**Response Format**:
```json
{
  "tools": "string[]",
  "count": "number"
}
```

### GET /sessions/:sessionId/pids
**Purpose**: Retrieves available PIDs for a session  
**Input Parameters**:
- Path: `sessionId`
**Response Format**:
```json
{
  "pids": "PID[]",
  "count": "number"
}
```

### GET /sessions/:sessionId/pids/:pidName/analysis
**Purpose**: Analyzes specific PID data  
**Input Parameters**:
- Path: `sessionId`, `pidName`
**Response Format**: PID-specific analysis results

### GET /sessions/:sessionId/correlations
**Purpose**: Analyzes correlations between different parameters  
**Input Parameters**:
- Path: `sessionId`
**Response Format**: Correlation analysis results

## Auto-Analysis Routes

### GET /sessions/:sessionId/auto-analysis
**Purpose**: Retrieves automatic analysis status and results  
**Input Parameters**:
- Path: `sessionId`
**Response Format**:
```json
{
  "status": "pending|running|completed|failed",
  "results": "object",
  "triggeredAt": "Date",
  "completedAt": "Date"
}
```

### POST /sessions/:sessionId/auto-analysis/trigger
**Purpose**: Manually triggers automatic analysis  
**Input Parameters**:
- Path: `sessionId`
**Response Format**:
```json
{
  "success": true,
  "message": "Auto-analysis triggered",
  "status": "pending"
}
```

## Analytics Pack Routes

### GET /sessions/:sessionId/analytics-pack/overview
**Purpose**: Retrieves analytics pack overview  
**Input Parameters**:
- Path: `sessionId`
**Response Format**: Analytics overview

### POST /sessions/:sessionId/analytics-pack/query
**Purpose**: Executes custom analytics queries  
**Input Parameters**:
- Path: `sessionId`
- Body: Query configuration
**Response Format**: Query results

### POST /sessions/:sessionId/analytics-pack/build
**Purpose**: Builds custom analytics pack  
**Input Parameters**:
- Path: `sessionId`
- Body: Build configuration
**Response Format**: Build results

### POST /sessions/:sessionId/analytics-pack/upload
**Purpose**: Uploads analytics pack data  
**Input Parameters**:
- Path: `sessionId`
- Body: Upload data
**Response Format**: Upload confirmation

### POST /sessions/:sessionId/analytics-pack/code-interpreter
**Purpose**: Executes code in analytics interpreter  
**Input Parameters**:
- Path: `sessionId`
- Body: Code and configuration
**Response Format**: Execution results

## Secure Analysis Routes

### POST /sessions/:sessionId/analyze/secure
**Purpose**: Secure analysis using o3-mini with Docker isolation  
**Input Parameters**:
- Path: `sessionId`
- Body: `question`, `reasoningEffort`
**Response Format**:
```json
{
  "success": true,
  "analysis": "string",
  "visualizations": "object[]",
  "processingTime": "number"
}
```
**Key Features**: Uses Docker container for code execution security

### POST /sessions/:sessionId/analyze/secure/stream
**Purpose**: Streaming secure analysis  
**Input Parameters**:
- Path: `sessionId`
- Body: Analysis configuration
**Response Format**: SSE stream with secure analysis results

### POST /sessions/:sessionId/analyze/secure/experimental
**Purpose**: Experimental secure analysis features  
**Input Parameters**:
- Path: `sessionId`
- Body: Experimental configuration
**Response Format**: Experimental analysis results

## System Health Routes

### GET /health
**Purpose**: System health check  
**Response Format**:
```json
{
  "status": "healthy|unhealthy",
  "timestamp": "Date",
  "services": "object"
}
```

### GET /live/status
**Purpose**: Real-time system status  
**Response Format**:
```json
{
  "status": "active",
  "timestamp": "Date",
  "activeSessions": "number",
  "systemLoad": "object"
}
```

### GET /secure-interpreter/health
**Purpose**: Health check for secure code interpreter  
**Response Format**:
```json
{
  "status": "healthy|unhealthy",
  "docker": "object",
  "python": "object"
}
```

## Summary

The OBD2 routes provide a comprehensive API for:
- **Session Management**: Creating, monitoring, and ending diagnostic sessions
- **Real-time Data**: Streaming, polling, and aggregated data access
- **Analysis**: Comprehensive analysis with visualizations and AI-powered insights
- **Sharing**: Collaborative session sharing with secure access codes
- **Security**: Isolated code execution for secure analysis
- **Monitoring**: Health checks and system status endpoints

This API supports both real-time diagnostic applications and comprehensive post-session analysis workflows.