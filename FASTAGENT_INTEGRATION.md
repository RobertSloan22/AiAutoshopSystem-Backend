# Fast-Agent Integration Guide

This document describes how to integrate the fast-agent data analysis system with your OBD2 diagnostic backend.

## Overview

The fast-agent integration allows you to analyze OBD2 session data using the powerful multi-agent data analysis system. The integration:

1. Exports OBD2 session data from MongoDB to CSV format
2. Uploads the CSV to the fast-agent Python Flask server
3. Streams analysis progress and visualizations back to your frontend
4. Provides real-time updates via Server-Sent Events (SSE)

## Prerequisites

1. **Fast-Agent Server Running**: The Python Flask server must be running on the configured port (default: 8080)
2. **Environment Variables**: Set `FASTAGENT_SERVER_URL` in your `.env` file
3. **Dependencies**: Ensure `axios` and `form-data` are installed

## Environment Configuration

Add to your `.env` file:

```env
# Fast-Agent Server Configuration
FASTAGENT_SERVER_URL=http://localhost:8080
```

## API Endpoints

### 1. Start Analysis (Streaming)

**POST** `/api/obd2/sessions/:sessionId/analyze/fast-agent`

Starts analysis and streams progress via Server-Sent Events.

**Request Body:**
```json
{
  "includeVisualization": true,
  "streamProgress": true,
  "analysisType": "comprehensive"
}
```

**Response (SSE Stream):**
```
data: {"type":"analysis_started","sessionId":"...","message":"Starting fast-agent analysis..."}
data: {"type":"progress","message":"Exporting session data to CSV...","progress":10}
data: {"type":"progress","message":"Exported 1500 data points to CSV","progress":20}
data: {"type":"progress","message":"Uploading CSV to analysis server...","progress":30}
data: {"type":"progress","message":"CSV uploaded successfully","progress":40}
data: {"type":"progress","message":"Starting data analysis...","progress":50}
data: {"type":"analysis_output","message":"Loading data...","messageType":"info"}
data: {"type":"visualization","image":{"id":1,"name":"chart1.png","data":"data:image/png;base64,..."}}
data: {"type":"analysis_completed","message":"Analysis completed successfully","visualizations":3}
data: {"type":"stream_end"}
```

### 2. Get Analysis Status (Polling)

**GET** `/api/obd2/sessions/:sessionId/analyze/fast-agent/status?lastId=0`

Get analysis progress messages (for non-streaming mode).

**Query Parameters:**
- `lastId` (optional): Last message ID received (for incremental updates)

**Response:**
```json
{
  "success": true,
  "sessionId": "...",
  "messages": [
    {
      "id": 1,
      "type": "info",
      "message": "Analysis in progress...",
      "timestamp": 1234567890
    }
  ],
  "lastId": 1,
  "serverTime": 1234567890
}
```

### 3. Get Visualizations (Polling)

**GET** `/api/obd2/sessions/:sessionId/analyze/fast-agent/images?lastId=0`

Get generated visualizations/images.

**Query Parameters:**
- `lastId` (optional): Last image ID received

**Response:**
```json
{
  "success": true,
  "sessionId": "...",
  "images": [
    {
      "id": 1,
      "name": "obd2_visualization.png",
      "url": "/mount-point1/obd2_visualization.png",
      "data": "data:image/png;base64,...",
      "timestamp": 1234567890
    }
  ],
  "lastId": 1,
  "serverTime": 1234567890
}
```

### 4. Health Check

**GET** `/api/obd2/fast-agent/health`

Check if fast-agent server is available.

**Response:**
```json
{
  "success": true,
  "available": true,
  "status": "ok",
  "serverTime": 1234567890,
  "serverUrl": "http://localhost:8080"
}
```

## Frontend Integration Example

### Using Server-Sent Events (Recommended)

```javascript
// Start analysis with streaming
const eventSource = new EventSource(
  `/api/obd2/sessions/${sessionId}/analyze/fast-agent`,
  {
    method: 'POST',
    body: JSON.stringify({
      includeVisualization: true,
      streamProgress: true
    })
  }
);

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  switch (data.type) {
    case 'analysis_started':
      console.log('Analysis started');
      break;
      
    case 'progress':
      updateProgressBar(data.progress);
      showMessage(data.message);
      break;
      
    case 'analysis_output':
      appendToLog(data.message);
      break;
      
    case 'visualization':
      displayImage(data.image);
      break;
      
    case 'analysis_completed':
      console.log(`Analysis complete! ${data.visualizations} visualizations generated`);
      eventSource.close();
      break;
      
    case 'error':
      console.error('Analysis error:', data.error);
      eventSource.close();
      break;
      
    case 'stream_end':
      eventSource.close();
      break;
  }
};

eventSource.onerror = (error) => {
  console.error('SSE error:', error);
  eventSource.close();
};
```

### Using Fetch with Polling

```javascript
// Start analysis (non-streaming)
const response = await fetch(`/api/obd2/sessions/${sessionId}/analyze/fast-agent`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    includeVisualization: true,
    streamProgress: false
  })
});

const { analysisId, endpoints } = await response.json();

// Poll for status
let lastId = 0;
const statusInterval = setInterval(async () => {
  const statusResponse = await fetch(
    `${endpoints.status}?lastId=${lastId}`
  );
  const status = await statusResponse.json();
  
  status.messages.forEach(msg => {
    console.log(msg.message);
  });
  
  lastId = status.lastId;
  
  // Check if complete
  if (status.messages.some(m => m.message.includes('completed'))) {
    clearInterval(statusInterval);
    // Fetch images
    fetchImages(endpoints.images);
  }
}, 2000);
```

## Data Flow

1. **Export**: OBD2 session data is exported from MongoDB to CSV format
2. **Upload**: CSV is uploaded to fast-agent server via HTTP multipart/form-data
3. **Analysis**: Fast-agent processes the CSV using its multi-agent system
4. **Streaming**: Progress and results are streamed back via SSE or polling
5. **Visualizations**: Generated images are fetched and sent to frontend as base64

## CSV Format

The exported CSV includes:
- **Timestamp**: ISO format timestamp for each data point
- **OBD2 Parameters**: All numeric parameters (RPM, speed, engineTemp, etc.)
- **Metadata** (optional): session_id, session_name, vehicle_id

Example CSV structure:
```csv
timestamp,rpm,speed,engineTemp,throttlePosition,engineLoad,session_id,session_name,vehicle_id
2024-01-01T12:00:00.000Z,2500,60,195,45,65,session123,Test Session,vehicle456
2024-01-01T12:00:01.000Z,2600,62,196,47,67,session123,Test Session,vehicle456
```

## Error Handling

The integration handles various error scenarios:

- **Server Unavailable**: Returns 503 with helpful message
- **Session Not Found**: Returns 404
- **No Data**: Returns 400 if session has no data points
- **Export/Upload Failures**: Returns 500 with error details
- **Analysis Failures**: Streams error events via SSE

## Troubleshooting

### Fast-Agent Server Not Available

1. Check if Python server is running: `curl http://localhost:8080/health`
2. Verify `FASTAGENT_SERVER_URL` environment variable
3. Check server logs for errors

### CSV Export Fails

1. Verify session has data points
2. Check MongoDB connection
3. Verify temp directory permissions (`temp/csv-exports`)

### Images Not Appearing

1. Check fast-agent server image directory
2. Verify image URLs are accessible
3. Check CORS settings if accessing from different origin

## Cleanup

CSV files are automatically cleaned up:
- After analysis completes (1 minute delay)
- Old files (>24 hours) can be cleaned via `obd2CsvExportService.cleanupOldFiles()`

## Performance Considerations

- **Large Sessions**: For sessions with >10,000 data points, consider time range filtering
- **Streaming**: Use SSE for real-time updates, polling for simpler implementations
- **Image Size**: Base64 images can be large; consider lazy loading or thumbnails

## Next Steps

1. Start fast-agent server: `cd fastagent-server/examples/data-analysis && python app.py`
2. Test health endpoint: `GET /api/obd2/fast-agent/health`
3. Start analysis on a session: `POST /api/obd2/sessions/:sessionId/analyze/fast-agent`
4. Monitor progress via SSE or polling endpoints


