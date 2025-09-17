# OBD2 Analysis & Visualization API Documentation

This document provides comprehensive guidance on how to interact with the OBD2 analysis backend API for generating visualizations and performing data analysis.

## Table of Contents
1. [Overview](#overview)
2. [Complete Workflow](#complete-workflow)
3. [API Endpoints](#api-endpoints)
4. [Frontend Integration Examples](#frontend-integration-examples)
5. [Troubleshooting](#troubleshooting)

## Overview

The backend provides a comprehensive API for OBD2 data analysis with visualization capabilities. The system uses OpenAI's API for intelligent analysis and Python code execution for generating matplotlib charts.

### Key Features:
- Real-time OBD2 data analysis
- Automatic chart generation using matplotlib
- Session-based data management
- Persistent plot storage with MongoDB
- Streaming responses for real-time feedback

## Complete Workflow

### Step 1: Create an OBD2 Session

```javascript
// Create a new diagnostic session
const response = await fetch('/api/obd2/sessions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'user123',
    vehicleId: 'vehicle456',
    sessionName: 'Diagnostic Session ' + new Date().toISOString(),
    vehicleInfo: {
      year: 2019,
      make: 'Honda',
      model: 'Civic',
      vin: '1HGCV1F37KA123456'
    },
    sessionNotes: 'Checking engine performance',
    tags: ['diagnostic', 'performance']
  })
});

const { session } = await response.json();
const sessionId = session.sessionId;
console.log('Created session:', sessionId);
```

### Step 2: Add OBD2 Data to Session

```javascript
// Add data points to the session
const dataPoint = {
  timestamp: new Date().toISOString(),
  rpm: 2500,
  speed: 60,
  engineTemp: 195,
  throttlePosition: 45,
  engineLoad: 65,
  batteryVoltage: 14.2,
  fuelPressure: 35,
  intakeTemp: 85,
  maf: 12.5,
  o2sensor: 0.45
};

await fetch(`/api/obd2/sessions/${sessionId}/data`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(dataPoint)
});
```

### Step 3: Analyze Session with Visualization

```javascript
// Request comprehensive analysis with visualizations
const analysisResponse = await fetch('/api/responses/chat/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    question: `Analyze OBD2 session ${sessionId} and create 3 visualization charts:
      1. Time series plot of key engine parameters (RPM, speed, engine temp)
      2. Correlation heatmap of all parameters
      3. Statistical summary with box plots for anomaly detection
      
      Focus on identifying any performance issues or anomalies.`,
    vehicleContext: {
      year: 2019,
      make: 'Honda',
      model: 'Civic',
      vin: '1HGCV1F37KA123456'
    },
    customerContext: {
      name: 'John Doe',
      concern: 'Engine running rough at idle'
    },
    conversationId: 'conv123',
    includeVisualization: true
  })
});

const analysis = await analysisResponse.json();
console.log('Analysis complete:', analysis);
```

### Step 4: Retrieve Generated Plots

```javascript
// Get all plots for the session
const plotsResponse = await fetch(`/api/plots/session/${sessionId}`);
const plots = await plotsResponse.json();

console.log(`Found ${plots.length} plots for session`);

// Load each plot
for (const plot of plots) {
  // Get plot as base64 data
  const base64Response = await fetch(`/api/plots/${plot.id}/base64`);
  const { base64Data, mimeType } = await base64Response.json();
  
  // Display in frontend
  const img = document.createElement('img');
  img.src = `data:${mimeType};base64,${base64Data}`;
  document.getElementById('charts-container').appendChild(img);
}
```

## API Endpoints

### OBD2 Session Management

#### Create Session
```
POST /api/obd2/sessions
Body: {
  userId: string,
  vehicleId: string,
  sessionName: string,
  vehicleInfo: object,
  sessionNotes: string,
  tags: string[]
}
Response: {
  success: true,
  session: {
    sessionId: string,
    startTime: Date,
    status: string
  }
}
```

#### Add Data Point
```
POST /api/obd2/sessions/:sessionId/data
Body: {
  timestamp: Date,
  rpm: number,
  speed: number,
  engineTemp: number,
  // ... other OBD2 parameters
}
Response: {
  success: true,
  timestamp: Date,
  dataPointId: string
}
```

#### Get Session Data
```
GET /api/obd2/sessions/:sessionId/data?aggregate=true&interval=1minute
Response: {
  data: [{
    time_bucket: Date,
    data: { rpm, speed, engineTemp, ... }
  }],
  count: number,
  aggregated: boolean
}
```

### Analysis & Visualization

#### Analyze with Visualization (Non-Streaming)
```
POST /api/responses/chat/analyze
Body: {
  question: string,
  vehicleContext: object,
  customerContext: object,
  conversationId: string,
  includeVisualization: boolean
}
Response: {
  message: string,
  analysis: object,
  visualizations: [{
    imageId: string,
    url: string,
    thumbnailUrl: string,
    data: string (base64)
  }],
  codeExecution: {
    code: string,
    output: string,
    success: boolean
  }
}
```

#### Streaming Analysis
```
POST /api/responses/chat/analyze/stream
Body: Same as above
Response: Server-Sent Events stream

Event Types:
- session_started: { sessionId, question, timestamp }
- content: { content, sessionId }
- tools_executing: { tools[], sessionId }
- code_execution: { code, output, sessionId }
- visualization_ready: { visualizations[], sessionId }
- analysis_complete: { summary, sessionId }
- done: {}
```

### Plot Management

#### Get Plot by ID
```
GET /api/plots/:imageId
Response: Binary image data
Headers: 
  Content-Type: image/png
  X-Plot-ID: imageId
  X-Generated-At: timestamp
```

#### Get Plot as Base64
```
GET /api/plots/:imageId/base64
Response: {
  imageId: string,
  base64Data: string,
  mimeType: string,
  filename: string
}
```

#### Get Session Plots
```
GET /api/plots/session/:sessionId
Response: {
  plots: [{
    id: string,
    filename: string,
    mimeType: string,
    size: number,
    description: string,
    tags: string[],
    createdAt: Date,
    url: string,
    thumbnailUrl: string
  }],
  pagination: object
}
```

## Frontend Integration Examples

### React Hook Example

```javascript
import { useState, useEffect } from 'react';

function useOBD2Analysis(sessionId) {
  const [analysis, setAnalysis] = useState(null);
  const [charts, setCharts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const analyzeSession = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Step 1: Request analysis
      const response = await fetch('/api/responses/chat/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: `Analyze OBD2 session ${sessionId} comprehensively with visualizations`,
          includeVisualization: true
        })
      });

      if (!response.ok) throw new Error('Analysis failed');
      
      const result = await response.json();
      setAnalysis(result);

      // Step 2: Wait for plots to be generated (backend processing time)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Step 3: Fetch plots
      const plotsResponse = await fetch(`/api/plots/session/${sessionId}`);
      const { plots } = await plotsResponse.json();

      // Step 4: Load plot data
      const chartsWithData = await Promise.all(
        plots.map(async (plot) => {
          const base64Response = await fetch(`/api/plots/${plot.id}/base64`);
          const { base64Data } = await base64Response.json();
          return {
            ...plot,
            dataUrl: `data:image/png;base64,${base64Data}`
          };
        })
      );

      setCharts(chartsWithData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return { analysis, charts, loading, error, analyzeSession };
}
```

### Streaming Analysis Example

```javascript
function streamAnalysis(sessionId, onUpdate) {
  const eventSource = new EventSource(
    `/api/responses/chat/analyze/stream?sessionId=${sessionId}`,
    { withCredentials: true }
  );

  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    switch(data.type) {
      case 'session_started':
        onUpdate({ type: 'start', sessionId: data.sessionId });
        break;
        
      case 'content':
        onUpdate({ type: 'content', text: data.content });
        break;
        
      case 'visualization_ready':
        onUpdate({ type: 'charts', charts: data.visualizations });
        break;
        
      case 'analysis_complete':
        onUpdate({ type: 'complete', summary: data.summary });
        break;
        
      case 'done':
        eventSource.close();
        break;
    }
  };

  eventSource.onerror = (error) => {
    console.error('SSE Error:', error);
    eventSource.close();
    onUpdate({ type: 'error', error });
  };

  return eventSource;
}
```

### Complete Frontend Component Example

```javascript
function OBD2AnalysisComponent({ sessionId }) {
  const [status, setStatus] = useState('idle');
  const [analysisText, setAnalysisText] = useState('');
  const [charts, setCharts] = useState([]);

  const runAnalysis = async () => {
    setStatus('analyzing');
    setAnalysisText('');
    setCharts([]);

    try {
      // Use streaming for real-time updates
      const response = await fetch('/api/responses/chat/analyze/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: `Perform comprehensive OBD2 analysis for session ${sessionId}`,
          vehicleContext: { /* ... */ },
          includeVisualization: true
        })
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            
            if (data.type === 'content') {
              setAnalysisText(prev => prev + data.content);
            } else if (data.type === 'visualization_ready') {
              // Fetch actual plot data
              const chartsWithData = await Promise.all(
                data.visualizations.map(async (viz) => {
                  if (viz.data) return viz;
                  
                  const response = await fetch(`/api/plots/${viz.imageId}/base64`);
                  const { base64Data } = await response.json();
                  return {
                    ...viz,
                    data: base64Data
                  };
                })
              );
              setCharts(chartsWithData);
            }
          }
        }
      }

      setStatus('complete');
    } catch (error) {
      console.error('Analysis error:', error);
      setStatus('error');
    }
  };

  return (
    <div>
      <button onClick={runAnalysis} disabled={status === 'analyzing'}>
        {status === 'analyzing' ? 'Analyzing...' : 'Run Analysis'}
      </button>

      <div className="analysis-text">
        {analysisText}
      </div>

      <div className="charts-grid">
        {charts.map((chart, index) => (
          <img 
            key={chart.imageId || index}
            src={`data:image/png;base64,${chart.data}`}
            alt={`Analysis Chart ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
```

## Troubleshooting

### Issue: No plots showing after analysis

**Diagnosis Steps:**
1. Check browser console for sessionId being passed
2. Check backend logs for "🔍 PLOT DEBUG" messages
3. Verify plots are saved in MongoDB

**Common Causes:**
1. **SessionId mismatch**: Ensure the same sessionId is used throughout
2. **Python not generating plots**: Check Python code includes plt.savefig()
3. **Timing issue**: Plots may take 2-5 seconds to process

**Solution:**
```javascript
// Add retry logic for plot retrieval
async function getSessionPlotsWithRetry(sessionId, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(`/api/plots/session/${sessionId}`);
    const { plots } = await response.json();
    
    if (plots.length > 0) return plots;
    
    // Wait before retry
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  return [];
}
```

### Issue: Analysis completes but no visualizations

**Check Python Code Generation:**
```javascript
// Ensure your analysis prompt explicitly requests matplotlib code
const question = `
Analyze session ${sessionId} and generate exactly 3 matplotlib visualizations:
1. Time series plot using plt.plot()
2. Correlation heatmap using sns.heatmap()
3. Box plots for anomaly detection using plt.boxplot()

Make sure to call plt.savefig() for each plot.
`;
```

### Issue: Plots not linked to session

**Verify SessionId Flow:**
1. Frontend passes sessionId to analysis endpoint
2. Backend passes sessionId to Python execution
3. Python service saves plots with sessionId

**Backend Logs Should Show:**
```
🔍 PLOT DEBUG: sessionId being passed to Python: 68c31e074c1384e896bb20e5
🔍 PLOT DEBUG: Saving plot with sessionId: 68c31e074c1384e896bb20e5
Plot saved to MongoDB with ID: <uuid>
```

## Best Practices

1. **Always use the same sessionId** throughout the analysis flow
2. **Wait 2-5 seconds** after analysis before fetching plots
3. **Use streaming endpoints** for better user experience
4. **Implement retry logic** for plot retrieval
5. **Check backend logs** when debugging visualization issues

## Example Full Implementation

```javascript
class OBD2AnalysisService {
  constructor(apiBaseUrl = '') {
    this.apiBaseUrl = apiBaseUrl;
  }

  async createSession(vehicleInfo) {
    const response = await fetch(`${this.apiBaseUrl}/api/obd2/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vehicleInfo,
        sessionName: `Analysis ${new Date().toLocaleString()}`,
        tags: ['analysis', 'visualization']
      })
    });
    
    const { session } = await response.json();
    return session.sessionId;
  }

  async addDataPoints(sessionId, dataPoints) {
    for (const point of dataPoints) {
      await fetch(`${this.apiBaseUrl}/api/obd2/sessions/${sessionId}/data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(point)
      });
    }
  }

  async analyzeWithVisualizations(sessionId, vehicleContext) {
    // Step 1: Request analysis
    const analysisPrompt = `
      Analyze OBD2 diagnostic session ${sessionId} and create comprehensive visualizations.
      
      Generate these specific matplotlib charts:
      1. Time series plot of RPM, speed, and engine temperature over time
      2. Correlation heatmap showing relationships between all parameters
      3. Statistical box plots to identify outliers and anomalies
      
      Include detailed analysis of any anomalies or concerning patterns found.
    `;

    const response = await fetch(`${this.apiBaseUrl}/api/responses/chat/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: analysisPrompt,
        vehicleContext,
        includeVisualization: true
      })
    });

    const analysis = await response.json();
    
    // Step 2: Wait for backend processing
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Step 3: Fetch generated plots with retry
    let plots = [];
    for (let retry = 0; retry < 3; retry++) {
      const plotsResponse = await fetch(
        `${this.apiBaseUrl}/api/plots/session/${sessionId}`
      );
      const data = await plotsResponse.json();
      
      if (data.plots && data.plots.length > 0) {
        plots = data.plots;
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Step 4: Load plot data
    const chartsWithData = await Promise.all(
      plots.map(async (plot) => {
        const base64Response = await fetch(
          `${this.apiBaseUrl}/api/plots/${plot.id}/base64`
        );
        const { base64Data } = await base64Response.json();
        return {
          ...plot,
          dataUrl: `data:image/png;base64,${base64Data}`
        };
      })
    );

    return {
      analysis: analysis.message,
      charts: chartsWithData,
      sessionId
    };
  }
}

// Usage
const service = new OBD2AnalysisService();

async function runCompleteAnalysis() {
  // Create session
  const sessionId = await service.createSession({
    year: 2019,
    make: 'Honda',
    model: 'Civic',
    vin: '1HGCV1F37KA123456'
  });
  
  // Add sample data
  const sampleData = generateSampleOBD2Data(); // Your data
  await service.addDataPoints(sessionId, sampleData);
  
  // Run analysis
  const results = await service.analyzeWithVisualizations(sessionId, {
    year: 2019,
    make: 'Honda',
    model: 'Civic'
  });
  
  console.log('Analysis:', results.analysis);
  console.log('Charts:', results.charts);
  
  return results;
}
```

This comprehensive guide should help you properly integrate with the OBD2 analysis backend API and successfully generate visualizations.