# Frontend Integration Guide for Python Execution

This guide provides everything you need to integrate Python code execution capabilities into your frontend application.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install ws  # If not already installed for WebSocket support
```

### 2. Import and Use Components

```jsx
// App.js
import React from 'react';
import PythonExecutor from './components/PythonExecutor';
import AIAssistantWithPython from './components/AIAssistantWithPython';
import './styles/pythonExecution.css';

function App() {
  return (
    <div className="App">
      <h1>Automotive AI Assistant with Python</h1>
      
      {/* Direct Python execution */}
      <PythonExecutor />
      
      {/* AI Assistant with Python capabilities */}
      <AIAssistantWithPython />
    </div>
  );
}

export default App;
```

### 3. Use React Hooks

```jsx
// Example component using the hooks
import React, { useState } from 'react';
import { usePythonExecution, useAIAssistant } from '../hooks/usePythonExecution';

const MyComponent = () => {
  const { executeCode, isExecuting, results, error } = usePythonExecution();
  const { sendMessage, messages, isLoading } = useAIAssistant();
  
  const runAnalysis = async () => {
    const code = `
import numpy as np
import matplotlib.pyplot as plt

# Sample OBD2 data
rpm_data = [800, 1200, 1800, 2400, 2200]
print(f"Average RPM: {np.mean(rpm_data)}")

# Create plot
plt.figure(figsize=(10, 6))
plt.plot(rpm_data, 'bo-')
plt.title('RPM Data')
plt.show()
    `;
    
    await executeCode(code);
  };
  
  return (
    <div>
      <button onClick={runAnalysis} disabled={isExecuting}>
        {isExecuting ? 'Running...' : 'Analyze Data'}
      </button>
      
      {results && (
        <div>
          <pre>{results.output}</pre>
          {results.plots_data?.map((plot, i) => (
            <img key={i} src={plot.data} alt={`Plot ${i}`} />
          ))}
        </div>
      )}
    </div>
  );
};
```

## 📡 API Endpoints

### Direct Python Execution

```javascript
// POST /api/execute/python
const response = await fetch('/api/execute/python', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    code: 'print("Hello from Python!")',
    save_plots: true,
    plot_filename: 'my_plot'
  })
});

const result = await response.json();
/*
Response format:
{
  success: true,
  output: "Hello from Python!\n",
  error: "",
  plots: ["/tmp/python_outputs/my_plot.png"],
  execution_id: "abc123",
  plots_data: [
    {
      path: "/tmp/python_outputs/my_plot.png",
      data: "data:image/png;base64,iVBORw0KGgoAAAANSU..."
    }
  ]
}
*/
```

### AI Assistant with Python

```javascript
// POST /api/turn_response
const response = await fetch('/api/turn_response', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [
      {
        role: 'user',
        content: 'Calculate the fuel efficiency and create a chart'
      }
    ],
    tools: [
      {
        type: 'function',
        function: {
          name: 'execute_python_code',
          description: 'Execute Python code for calculations and visualizations',
          parameters: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              save_plots: { type: 'boolean', default: true },
              plot_filename: { type: 'string' }
            },
            required: ['code']
          }
        }
      }
    ]
  })
});
```

### Streaming Responses

```javascript
// POST /api/chat/stream
const response = await fetch('/api/chat/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'Analyze this engine data and create visualizations',
    vehicleContext: {
      year: '2020',
      make: 'Toyota',
      model: 'Camry'
    }
  })
});

// Handle Server-Sent Events
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
      console.log('Stream data:', data);
    }
  }
}
```

## 🎨 Styling and Customization

### CSS Classes Available

```css
/* Main containers */
.python-executor          /* Main Python executor component */
.ai-assistant            /* AI assistant component */

/* Controls */
.controls               /* Control panel */
.code-input            /* Code input section */
.code-textarea         /* Code text area */
.execute-btn           /* Execute button */
.example-btn           /* Example buttons */
.prompt-btn           /* Quick prompt buttons */

/* Results */
.results              /* Results container */
.output              /* Text output */
.plots               /* Plots container */
.plot-image          /* Individual plot image */
.execution-info      /* Execution metadata */

/* Messages */
.messages-container   /* Chat messages area */
.message             /* Individual message */
.message.user        /* User message */
.message.assistant   /* AI message */
.tool-calls          /* Tool execution display */
.python-execution    /* Python code display */

/* States */
.loading             /* Loading state */
.error               /* Error state */
```

### Custom Theme Example

```css
/* Custom automotive theme */
.python-executor {
  --primary-color: #1976d2;
  --success-color: #4caf50;
  --warning-color: #ff9800;
  --error-color: #f44336;
  --background-color: #f5f5f5;
  --surface-color: white;
  --text-color: #333;
}

.python-executor.dark-theme {
  --background-color: #121212;
  --surface-color: #1e1e1e;
  --text-color: #e0e0e0;
}
```

## 🔧 Configuration Options

### Environment Variables

```bash
# Backend configuration
PYTHON_SERVER_URL=http://localhost:8000
PYTHON_SERVER_WS_URL=ws://localhost:8000
OPENAI_API_KEY=your_api_key
MCP_SERVER_URL=http://localhost:3700
```

### Frontend Configuration

```javascript
// config.js
export const config = {
  apiBaseURL: process.env.REACT_APP_API_URL || '/api',
  pythonTimeout: 30000, // 30 seconds
  maxExecutionHistory: 10,
  autoSavePlots: true,
  defaultPlotFormat: 'png',
  streamingEnabled: true
};
```

## 📊 Usage Examples

### 1. OBD2 Data Analysis

```javascript
const obd2Code = `
import pandas as pd
import matplotlib.pyplot as plt
import numpy as np

# Sample OBD2 data
data = {
    'time': range(0, 60, 5),
    'rpm': [800, 1200, 1800, 2400, 2200, 1800, 1400, 1000, 900, 850, 800, 780],
    'speed': [0, 10, 25, 45, 50, 40, 30, 20, 10, 5, 0, 0],
    'engine_temp': [85, 87, 89, 91, 93, 92, 90, 88, 86, 85, 84, 83]
}

df = pd.DataFrame(data)

print("Vehicle Performance Analysis:")
print(f"Average RPM: {df['rpm'].mean():.1f}")
print(f"Max Speed: {df['speed'].max()} km/h")
print(f"Engine Temp Range: {df['engine_temp'].min()}-{df['engine_temp'].max()}°C")

# Create dashboard
fig, axes = plt.subplots(2, 2, figsize=(15, 10))

axes[0,0].plot(df['time'], df['rpm'], 'r-o')
axes[0,0].set_title('Engine RPM')
axes[0,0].set_ylabel('RPM')

axes[0,1].plot(df['time'], df['speed'], 'b-s')
axes[0,1].set_title('Vehicle Speed')
axes[0,1].set_ylabel('Speed (km/h)')

axes[1,0].plot(df['time'], df['engine_temp'], 'g-^')
axes[1,0].set_title('Engine Temperature')
axes[1,0].set_ylabel('Temp (°C)')

axes[1,1].scatter(df['rpm'], df['speed'], c=df['engine_temp'], cmap='coolwarm')
axes[1,1].set_title('RPM vs Speed (colored by temp)')
axes[1,1].set_xlabel('RPM')
axes[1,1].set_ylabel('Speed (km/h)')

plt.tight_layout()
plt.show()
`;

await executeCode(obd2Code, { 
  plot_filename: 'obd2_dashboard',
  save_plots: true 
});
```

### 2. Fuel Efficiency Calculator

```javascript
const fuelCode = `
import pandas as pd
import numpy as np

# Trip data
trips = [
    {'distance': 120, 'fuel': 8.5, 'type': 'highway'},
    {'distance': 50, 'fuel': 5.2, 'type': 'city'},
    {'distance': 80, 'fuel': 6.1, 'type': 'mixed'}
]

df = pd.DataFrame(trips)
df['efficiency_kmL'] = df['distance'] / df['fuel']
df['consumption_L100km'] = df['fuel'] / df['distance'] * 100

print("Fuel Efficiency Analysis:")
print(f"Overall efficiency: {df['efficiency_kmL'].mean():.1f} km/L")
print(f"Overall consumption: {df['consumption_L100km'].mean():.1f} L/100km")
print("\\nBy driving type:")
print(df.groupby('type')['efficiency_kmL'].mean().round(1))
`;

await executeCode(fuelCode);
```

### 3. AI Assistant Integration

```javascript
// Send a message that will trigger Python execution
await sendMessage("Analyze the correlation between engine RPM and fuel consumption for my 2020 Toyota Camry. Create a scatter plot showing this relationship and calculate the correlation coefficient.");

// The AI will automatically:
// 1. Generate appropriate Python code
// 2. Execute it with sample or provided data
// 3. Create visualizations
// 4. Return analysis results
```

## 🔍 Troubleshooting

### Common Issues

1. **Python execution timeout**
   ```javascript
   // Increase timeout
   await executeCode(code, { timeout: 60000 }); // 60 seconds
   ```

2. **Plots not displaying**
   ```javascript
   // Check if plots were generated
   if (result.plots_data && result.plots_data.length > 0) {
     console.log('Plots available:', result.plots_data.length);
   } else {
     console.log('No plots generated');
   }
   ```

3. **WebSocket connection issues**
   ```javascript
   // Check server health
   const health = await pythonAPI.getHealth();
   console.log('Server status:', health);
   ```

4. **AI not using Python tool**
   - Ensure the tool is properly included in the request
   - Check that the message clearly requests calculations or visualizations
   - Verify the system prompt includes Python capabilities

### Debug Mode

```javascript
// Enable debug logging
const pythonAPI = new PythonAPI('/api');
pythonAPI.debug = true;

// This will log all requests and responses
await pythonAPI.executeCode(code);
```

## 📦 Dependencies

### Frontend Dependencies
```json
{
  "dependencies": {
    "react": "^18.0.0",
    "ws": "^8.0.0"
  }
}
```

### Backend Dependencies (Already installed)
```json
{
  "dependencies": {
    "express": "^4.18.0",
    "openai": "^4.0.0",
    "axios": "^1.0.0",
    "ws": "^8.0.0"
  }
}
```

## 🚦 Production Considerations

### Security
- Validate all user input before execution
- Implement rate limiting for API endpoints
- Consider sandboxing Python execution
- Sanitize file paths and names

### Performance
- Cache frequently used Python libraries
- Implement connection pooling for Python server
- Consider using worker processes for heavy computations
- Set appropriate timeouts

### Monitoring
- Log all Python executions
- Monitor resource usage
- Track error rates
- Set up alerts for failures

This integration provides a complete solution for adding Python code execution capabilities to your automotive AI assistant frontend!