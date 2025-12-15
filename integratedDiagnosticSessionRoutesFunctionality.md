# Integrated Diagnostic Session Routes Functionality Documentation

## Overview
The Integrated Research Routes provide AI-powered research capabilities for automotive diagnostics. These routes enable intelligent analysis and research functionality using advanced language models to assist with diagnostic insights.

## Health Check Route

### GET /health
**Purpose**: Checks the health status of the integrated research service  
**Input Parameters**: None
**Response Format**: 
```json
{
  "status": "healthy|unhealthy",
  "timestamp": "Date",
  "service": "integrated-research"
}
```
**Key Features**: Simple health monitoring for service availability

## Research Routes

### POST /research
**Purpose**: Performs comprehensive research analysis using AI models  
**Input Parameters**:
- Body: Research query and configuration parameters
**Response Format**: 
```json
{
  "success": true,
  "results": "object",
  "timestamp": "Date",
  "processingTime": "number"
}
```
**Key Features**: 
- AI-powered diagnostic research
- Comprehensive analysis capabilities
- Structured response format

### POST /research/stream
**Purpose**: Performs streaming research with real-time updates via Server-Sent Events  
**Input Parameters**:
- Body: Research query and configuration parameters
**Response Format**: SSE stream with research progress and results
**Key Features**: 
- Real-time streaming of research results
- Progressive analysis updates
- Non-blocking research operations
- Live feedback during research process

## Implementation Details

The integrated diagnostic session routes are implemented in `/routes/integrated-research.routes.js` and provide a focused set of endpoints for AI-powered research capabilities. Unlike the comprehensive OBD2 routes, this service is designed specifically for intelligent analysis and research functions.

### Key Characteristics:
- **Minimal Route Set**: Only 3 focused endpoints
- **AI Integration**: Leverages advanced language models for research
- **Streaming Capability**: Supports real-time research streaming
- **Health Monitoring**: Includes service health checks

### Controller Integration:
The routes delegate functionality to dedicated controllers:
- `performResearch`: Handles standard research operations
- `performStreamingResearch`: Manages streaming research with SSE
- `healthCheck`: Provides service health status

## Usage Patterns

### Standard Research Flow:
1. POST to `/research` with research query
2. Receive comprehensive analysis results
3. Process structured response data

### Streaming Research Flow:
1. POST to `/research/stream` with research query  
2. Establish SSE connection
3. Receive progressive updates in real-time
4. Handle stream completion

### Health Monitoring:
1. GET `/health` endpoint for service status
2. Monitor service availability
3. Implement health-based routing decisions

## Summary

The Integrated Diagnostic Session routes provide a streamlined, AI-focused API for:
- **Research Operations**: Standard and streaming research capabilities
- **Health Monitoring**: Service availability checks  
- **Real-time Analysis**: Progressive research with live updates

This service complements the comprehensive OBD2 diagnostic routes by providing specialized AI research capabilities for advanced diagnostic analysis.