# Frontend OBD2 Raw Data Access Guide

This guide shows how to access and display raw OBD2 analysis data in your frontend application using the enhanced analysis system.

## API Endpoint

Get analysis data with raw data arrays:

```javascript
const response = await fetch(`/api/obd2/analysis/${sessionId}`);
const analysis = await response.json();
```

## Data Structure

Each analysis contains enhanced plots with both images and raw data:

```javascript
{
  _id: "analysis_id",
  sessionId: "session_id", 
  plots: [
    {
      filename: "plot_name.png",
      base64: "iVBORw0KGgoAAAANSUhEUgAA...", // Base64 image
      mimeType: "image/png",
      rawData: {
        datasets: [
          {
            label: "Engine RPM",
            data: [800, 1200, 1500, 2000, 2500],
            borderColor: "rgb(75, 192, 192)",
            backgroundColor: "rgba(75, 192, 192, 0.2)"
          }
        ],
        labels: ["10:30:00", "10:30:05", "10:30:10", "10:30:15", "10:30:20"],
        parameters: ["ENGINE_RPM", "VEHICLE_SPEED"],
        dataRange: {
          startTime: "2024-01-15T10:30:00Z",
          endTime: "2024-01-15T10:35:00Z",
          pointCount: 60
        },
        chartConfig: {
          type: "line",
          options: {
            responsive: true,
            scales: {
              y: { beginAtZero: true }
            }
          }
        }
      },
      plotMetadata: {
        plotType: "time_series",
        xAxis: "time",
        yAxis: "rpm",
        interactive: true
      }
    }
  ]
}
```

## Frontend Implementation Examples

### 1. Display Generated Plot Image

```javascript
function displayPlotImage(plot) {
  const img = document.createElement('img');
  img.src = `data:${plot.mimeType};base64,${plot.base64}`;
  img.alt = `Analysis plot: ${plot.filename}`;
  document.getElementById('plot-container').appendChild(img);
}
```

### 2. Create Interactive Chart.js Visualization

```javascript
import { Chart } from 'chart.js/auto';

function createInteractiveChart(plot, canvasId) {
  const ctx = document.getElementById(canvasId).getContext('2d');
  
  new Chart(ctx, {
    type: plot.rawData.chartConfig.type || 'line',
    data: {
      labels: plot.rawData.labels,
      datasets: plot.rawData.datasets
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: `OBD2 Analysis: ${plot.rawData.parameters.join(', ')}`
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Time'
          }
        },
        y: {
          title: {
            display: true,
            text: plot.plotMetadata.yAxis || 'Value'
          }
        }
      }
    }
  });
}
```

### 3. React Component Example

```jsx
import React, { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';

function OBD2AnalysisChart({ sessionId }) {
  const [analysisData, setAnalysisData] = useState(null);

  useEffect(() => {
    fetch(`/api/obd2/analysis/${sessionId}`)
      .then(res => res.json())
      .then(data => setAnalysisData(data));
  }, [sessionId]);

  if (!analysisData) return <div>Loading...</div>;

  return (
    <div>
      {analysisData.plots.map((plot, index) => (
        <div key={index} className="analysis-plot">
          <h3>Plot: {plot.filename}</h3>
          
          {/* Display original generated image */}
          <img 
            src={`data:${plot.mimeType};base64,${plot.base64}`}
            alt={`Analysis plot ${index + 1}`}
            style={{ maxWidth: '100%', marginBottom: '20px' }}
          />
          
          {/* Interactive Chart.js version */}
          <Line
            data={{
              labels: plot.rawData.labels,
              datasets: plot.rawData.datasets
            }}
            options={{
              responsive: true,
              plugins: {
                title: {
                  display: true,
                  text: `Parameters: ${plot.rawData.parameters.join(', ')}`
                }
              }
            }}
          />
          
          {/* Data info */}
          <div className="data-info">
            <p>Data Points: {plot.rawData.dataRange.pointCount}</p>
            <p>Time Range: {plot.rawData.dataRange.startTime} to {plot.rawData.dataRange.endTime}</p>
            <p>Parameters: {plot.rawData.parameters.join(', ')}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
```

### 4. Vue.js Example

```vue
<template>
  <div class="obd2-analysis">
    <div v-for="(plot, index) in plots" :key="index" class="plot-container">
      <h3>{{ plot.filename }}</h3>
      
      <!-- Original plot image -->
      <img :src="`data:${plot.mimeType};base64,${plot.base64}`" 
           :alt="`Plot ${index + 1}`" />
      
      <!-- Interactive chart -->
      <canvas :ref="`chart-${index}`"></canvas>
    </div>
  </div>
</template>

<script>
import { Chart } from 'chart.js/auto';

export default {
  props: ['sessionId'],
  data() {
    return {
      plots: []
    };
  },
  async mounted() {
    const response = await fetch(`/api/obd2/analysis/${this.sessionId}`);
    const analysis = await response.json();
    this.plots = analysis.plots;
    
    this.$nextTick(() => {
      this.createCharts();
    });
  },
  methods: {
    createCharts() {
      this.plots.forEach((plot, index) => {
        const canvas = this.$refs[`chart-${index}`][0];
        new Chart(canvas, {
          type: 'line',
          data: {
            labels: plot.rawData.labels,
            datasets: plot.rawData.datasets
          },
          options: {
            responsive: true,
            plugins: {
              title: {
                display: true,
                text: plot.rawData.parameters.join(', ')
              }
            }
          }
        });
      });
    }
  }
};
</script>
```

## Available Data Fields

### rawData Object
- `datasets[]`: Chart.js compatible dataset array with labels, data, colors
- `labels[]`: X-axis labels (usually timestamps)
- `parameters[]`: OBD2 parameter names (ENGINE_RPM, VEHICLE_SPEED, etc.)
- `dataRange`: Time span and data point information
- `chartConfig`: Recommended Chart.js configuration

### plotMetadata Object
- `plotType`: Type of visualization (time_series, scatter, bar)
- `xAxis`: X-axis data type description
- `yAxis`: Y-axis data type description  
- `interactive`: Boolean indicating if plot supports interaction

## Common OBD2 Parameters

The system automatically detects these parameters from your session data:
- `ENGINE_RPM`: Engine revolutions per minute
- `VEHICLE_SPEED`: Vehicle speed (mph/kph)
- `THROTTLE_POS`: Throttle position percentage
- `ENGINE_LOAD`: Engine load percentage
- `COOLANT_TEMP`: Engine coolant temperature
- `INTAKE_TEMP`: Intake air temperature
- `MAF`: Mass air flow rate
- `FUEL_PRESSURE`: Fuel system pressure

## Error Handling

```javascript
async function getAnalysisData(sessionId) {
  try {
    const response = await fetch(`/api/obd2/analysis/${sessionId}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const analysis = await response.json();
    
    if (!analysis.plots || analysis.plots.length === 0) {
      console.warn('No plots found in analysis data');
      return null;
    }
    
    return analysis;
  } catch (error) {
    console.error('Failed to fetch analysis data:', error);
    return null;
  }
}
```

## Performance Tips

1. **Lazy Loading**: Load plot data only when needed
2. **Caching**: Cache analysis results to avoid repeated API calls  
3. **Pagination**: For sessions with many plots, implement pagination
4. **Chart Destruction**: Properly destroy Chart.js instances when components unmount

```javascript
// React cleanup example
useEffect(() => {
  return () => {
    // Destroy charts when component unmounts
    Chart.getChart('my-canvas')?.destroy();
  };
}, []);
```

This enhanced system provides both static plot images and interactive raw data access, giving you maximum flexibility for frontend visualization needs.