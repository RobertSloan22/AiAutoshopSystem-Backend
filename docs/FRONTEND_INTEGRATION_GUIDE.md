# Frontend Integration Guide - Interval Analysis System

## Quick Start

### 1. Starting a Session

```javascript
// Create new diagnostic session
const response = await fetch('/api/obd2/sessions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'user123',
    vehicleId: 'vehicle456',
    sessionName: 'Diagnostic Check',
    selectedPids: ['rpm', 'speed', 'engineTemp', 'throttlePosition']
  })
});

const { session } = await response.json();
const sessionId = session.sessionId;

// Interval analysis automatically starts!
```

### 2. Polling for Real-time Analysis Results

```javascript
class IntervalAnalysisMonitor {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.displayedIntervals = new Set();
    this.pollInterval = null;
  }

  start() {
    // Poll every 3 seconds for new interval results
    this.pollInterval = setInterval(() => this.checkForUpdates(), 3000);
    console.log('Started monitoring interval analysis');
  }

  stop() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      console.log('Stopped monitoring interval analysis');
    }
  }

  async checkForUpdates() {
    try {
      const response = await fetch(
        `/api/obd2/sessions/${this.sessionId}/interval-analysis`
      );
      const data = await response.json();

      if (!data.success) return;

      // Check each interval type
      const intervals = ['quick_check', 'mid_session_1', 'mid_session_2', 'mid_session_3'];

      for (const intervalKey of intervals) {
        const analysis = data.intervalAnalysis[intervalKey];

        if (analysis && !this.displayedIntervals.has(intervalKey)) {
          this.handleNewAnalysis(intervalKey, analysis);
          this.displayedIntervals.add(intervalKey);
        }
      }

      // Check for final analysis
      if (data.autoAnalysis?.status === 'completed' &&
          !this.displayedIntervals.has('final')) {
        this.handleFinalAnalysis(data.autoAnalysis);
        this.displayedIntervals.add('final');
        this.stop(); // Stop polling after final analysis
      }

    } catch (error) {
      console.error('Failed to fetch interval analysis:', error);
    }
  }

  handleNewAnalysis(intervalKey, analysis) {
    const config = {
      quick_check: {
        title: '⚡ Quick Check (15s)',
        color: 'red',
        priority: 'high'
      },
      mid_session_1: {
        title: '📊 Mid-Session Overview (1min)',
        color: 'blue',
        priority: 'medium'
      },
      mid_session_2: {
        title: '🔍 Health Check (2min)',
        color: 'blue',
        priority: 'medium'
      },
      mid_session_3: {
        title: '🏥 Full Diagnostic (3min)',
        color: 'green',
        priority: 'high'
      }
    };

    const { title, color, priority } = config[intervalKey];

    // Display notification
    this.showNotification({
      title: title,
      message: this.parseAnalysisResult(analysis.result),
      color: color,
      priority: priority,
      plots: analysis.plots
    });

    // Update UI with visualizations
    this.displayPlots(intervalKey, analysis.plots);
  }

  handleFinalAnalysis(autoAnalysis) {
    this.showNotification({
      title: '✅ Final Analysis Complete',
      message: 'Comprehensive diagnostic report with 3-5 visualizations ready',
      color: 'green',
      priority: 'high',
      plots: autoAnalysis.plots
    });

    // Display all final visualizations
    this.displayFinalReport(autoAnalysis);
  }

  parseAnalysisResult(result) {
    // Extract key alerts from the analysis result
    const alerts = result.match(/⚠️ ALERTS: (.*?)(?=\n|$)/);
    if (alerts && alerts[1] !== '[]') {
      return `Issues detected: ${alerts[1]}`;
    }
    return 'All parameters normal';
  }

  showNotification({ title, message, color, priority, plots }) {
    // Example using a notification library
    const notification = {
      title,
      message,
      type: priority === 'high' ? 'warning' : 'info',
      duration: priority === 'high' ? 0 : 5000, // High priority stays until dismissed
      image: plots?.[0]?.base64 ? `data:image/png;base64,${plots[0].base64}` : null
    };

    // Call your notification system
    window.notificationSystem.show(notification);
  }

  displayPlots(intervalKey, plots) {
    if (!plots || plots.length === 0) return;

    plots.forEach((plot, index) => {
      const imageUrl = `data:${plot.mimeType};base64,${plot.base64}`;

      // Add to UI gallery or modal
      const container = document.getElementById(`interval-plots-${intervalKey}`);
      if (container) {
        const img = document.createElement('img');
        img.src = imageUrl;
        img.alt = plot.filename;
        img.className = 'interval-plot';
        container.appendChild(img);
      }
    });
  }

  displayFinalReport(autoAnalysis) {
    const { result, plots } = autoAnalysis;

    // Create report view
    const reportContainer = document.getElementById('final-report');

    // Display analysis text
    const textSection = document.createElement('div');
    textSection.className = 'analysis-text';
    textSection.innerHTML = this.formatAnalysisText(result);
    reportContainer.appendChild(textSection);

    // Display all visualizations in a grid
    const plotGrid = document.createElement('div');
    plotGrid.className = 'plot-grid';

    plots.forEach(plot => {
      const plotCard = document.createElement('div');
      plotCard.className = 'plot-card';

      const img = document.createElement('img');
      img.src = `data:${plot.mimeType};base64,${plot.base64}`;
      img.alt = plot.filename;

      const caption = document.createElement('p');
      caption.textContent = this.formatPlotName(plot.filename);

      plotCard.appendChild(img);
      plotCard.appendChild(caption);
      plotGrid.appendChild(plotCard);
    });

    reportContainer.appendChild(plotGrid);
  }

  formatAnalysisText(text) {
    // Convert markdown-style text to HTML
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>')
      .replace(/⚠️/g, '<span class="alert-icon">⚠️</span>')
      .replace(/✅/g, '<span class="success-icon">✅</span>');
  }

  formatPlotName(filename) {
    // Convert filename to readable title
    return filename
      .replace(/\.png$/, '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }
}

// Usage
const monitor = new IntervalAnalysisMonitor(sessionId);
monitor.start();

// Stop monitoring when session ends or component unmounts
// monitor.stop();
```

### 3. React Component Example

```jsx
import React, { useEffect, useState } from 'react';

function IntervalAnalysisDisplay({ sessionId }) {
  const [analyses, setAnalyses] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(
          `/api/obd2/sessions/${sessionId}/interval-analysis`
        );
        const data = await response.json();

        if (data.success) {
          setAnalyses(data.intervalAnalysis);
          setLoading(false);
        }
      } catch (error) {
        console.error('Failed to fetch interval analysis:', error);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [sessionId]);

  const renderAnalysis = (key, analysis) => {
    const titles = {
      quick_check: '⚡ Quick Check (15s)',
      mid_session_1: '📊 Overview (1min)',
      mid_session_2: '🔍 Health Check (2min)',
      mid_session_3: '🏥 Full Diagnostic (3min)'
    };

    return (
      <div key={key} className="analysis-card">
        <h3>{titles[key]}</h3>
        <p className="timestamp">
          {new Date(analysis.timestamp).toLocaleTimeString()}
        </p>

        <div className="analysis-result">
          {analysis.result.split('\n').map((line, i) => (
            <p key={i} className={line.includes('⚠️') ? 'alert' : ''}>
              {line}
            </p>
          ))}
        </div>

        {analysis.plots?.map((plot, i) => (
          <img
            key={i}
            src={`data:${plot.mimeType};base64,${plot.base64}`}
            alt={plot.filename}
            className="analysis-plot"
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return <div className="loading">Waiting for interval analysis...</div>;
  }

  return (
    <div className="interval-analyses">
      <h2>Real-time Analysis Results</h2>
      {Object.entries(analyses).map(([key, analysis]) =>
        renderAnalysis(key, analysis)
      )}
    </div>
  );
}

export default IntervalAnalysisDisplay;
```

### 4. Vue.js Component Example

```vue
<template>
  <div class="interval-analysis">
    <h2>Real-time Analysis</h2>

    <div v-for="(analysis, key) in analyses" :key="key" class="analysis-card">
      <h3>{{ intervalTitles[key] }}</h3>
      <p class="timestamp">{{ formatTime(analysis.timestamp) }}</p>

      <div class="result" v-html="formatResult(analysis.result)"></div>

      <div v-if="analysis.plots" class="plots">
        <img
          v-for="(plot, i) in analysis.plots"
          :key="i"
          :src="`data:${plot.mimeType};base64,${plot.base64}`"
          :alt="plot.filename"
        />
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'IntervalAnalysis',
  props: {
    sessionId: {
      type: String,
      required: true
    }
  },
  data() {
    return {
      analyses: {},
      pollInterval: null,
      intervalTitles: {
        quick_check: '⚡ Quick Check (15s)',
        mid_session_1: '📊 Overview (1min)',
        mid_session_2: '🔍 Health Check (2min)',
        mid_session_3: '🏥 Full Diagnostic (3min)'
      }
    };
  },
  mounted() {
    this.startPolling();
  },
  beforeUnmount() {
    this.stopPolling();
  },
  methods: {
    async fetchAnalyses() {
      try {
        const response = await fetch(
          `/api/obd2/sessions/${this.sessionId}/interval-analysis`
        );
        const data = await response.json();

        if (data.success) {
          this.analyses = data.intervalAnalysis;
        }
      } catch (error) {
        console.error('Failed to fetch analyses:', error);
      }
    },
    startPolling() {
      this.fetchAnalyses();
      this.pollInterval = setInterval(() => this.fetchAnalyses(), 3000);
    },
    stopPolling() {
      if (this.pollInterval) {
        clearInterval(this.pollInterval);
      }
    },
    formatTime(timestamp) {
      return new Date(timestamp).toLocaleTimeString();
    },
    formatResult(result) {
      return result
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>')
        .replace(/⚠️/g, '<span class="alert">⚠️</span>')
        .replace(/✅/g, '<span class="success">✅</span>');
    }
  }
};
</script>

<style scoped>
.analysis-card {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

.plots img {
  width: 100%;
  max-width: 800px;
  margin: 8px 0;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.alert { color: #f44336; }
.success { color: #4caf50; }
</style>
```

## Timeline View Example

```javascript
// Display analysis results on a timeline
class AnalysisTimeline {
  constructor(containerEl) {
    this.container = containerEl;
    this.events = [];
  }

  addAnalysisEvent(intervalKey, analysis) {
    const event = {
      time: new Date(analysis.timestamp),
      title: this.getTitle(intervalKey),
      type: this.getType(intervalKey),
      analysis: analysis
    };

    this.events.push(event);
    this.events.sort((a, b) => a.time - b.time);
    this.render();
  }

  getTitle(key) {
    const titles = {
      quick_check: 'Quick Check',
      mid_session_1: '1-Minute Overview',
      mid_session_2: '2-Minute Health Check',
      mid_session_3: '3-Minute Full Diagnostic'
    };
    return titles[key] || key;
  }

  getType(key) {
    return key === 'quick_check' ? 'critical' : 'info';
  }

  render() {
    this.container.innerHTML = '';

    this.events.forEach(event => {
      const eventEl = document.createElement('div');
      eventEl.className = `timeline-event ${event.type}`;

      eventEl.innerHTML = `
        <div class="event-marker"></div>
        <div class="event-content">
          <div class="event-time">${event.time.toLocaleTimeString()}</div>
          <div class="event-title">${event.title}</div>
          <div class="event-summary">${this.getSummary(event.analysis)}</div>
        </div>
      `;

      eventEl.addEventListener('click', () => this.showDetails(event));
      this.container.appendChild(eventEl);
    });
  }

  getSummary(analysis) {
    if (analysis.result.includes('⚠️ ALERTS:')) {
      return '⚠️ Issues detected';
    }
    return '✅ All systems normal';
  }

  showDetails(event) {
    // Show modal or expand with full analysis and plots
    const modal = document.createElement('div');
    modal.className = 'analysis-modal';
    modal.innerHTML = `
      <div class="modal-content">
        <h2>${event.title}</h2>
        <p>${event.time.toLocaleString()}</p>
        <pre>${event.analysis.result}</pre>
        ${event.analysis.plots?.map(plot => `
          <img src="data:${plot.mimeType};base64,${plot.base64}" />
        `).join('')}
        <button onclick="this.closest('.analysis-modal').remove()">Close</button>
      </div>
    `;
    document.body.appendChild(modal);
  }
}
```

## Alert System Integration

```javascript
// Priority-based alert system
class AlertManager {
  constructor() {
    this.alerts = [];
  }

  async checkForAlerts(sessionId) {
    const response = await fetch(
      `/api/obd2/sessions/${sessionId}/interval-analysis`
    );
    const data = await response.json();

    // Quick check alerts are highest priority
    if (data.intervalAnalysis.quick_check) {
      this.processQuickCheckAlerts(data.intervalAnalysis.quick_check);
    }
  }

  processQuickCheckAlerts(quickCheck) {
    const result = quickCheck.result;

    // Parse alerts from result
    const alertMatch = result.match(/⚠️ ALERTS: \[(.*?)\]/);
    if (alertMatch && alertMatch[1]) {
      const parameters = alertMatch[1].split(',').map(p => p.trim());

      parameters.forEach(param => {
        this.showAlert({
          level: 'warning',
          title: 'Parameter Out of Range',
          message: `${param} is outside normal operating range`,
          timestamp: new Date(quickCheck.timestamp),
          image: quickCheck.plots?.[0]?.base64
        });
      });
    }
  }

  showAlert({ level, title, message, timestamp, image }) {
    // Integrate with your alert system
    console.log(`[${level.toUpperCase()}] ${title}: ${message}`);

    // Example: Push notification
    if (Notification.permission === 'granted') {
      new Notification(title, {
        body: message,
        icon: image ? `data:image/png;base64,${image}` : null,
        tag: `obd2-alert-${timestamp.getTime()}`
      });
    }
  }
}
```

## CSS Styling Examples

```css
/* Analysis cards */
.analysis-card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  transition: transform 0.2s;
}

.analysis-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

/* Timeline view */
.timeline-event {
  display: flex;
  align-items: flex-start;
  margin-bottom: 16px;
  cursor: pointer;
}

.timeline-event.critical .event-marker {
  background: #f44336;
  animation: pulse 2s infinite;
}

.event-marker {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #2196f3;
  margin-right: 16px;
  flex-shrink: 0;
}

.event-content {
  flex: 1;
  padding: 12px;
  background: #f5f5f5;
  border-radius: 8px;
}

/* Plot grid */
.plot-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.plot-card {
  background: white;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.plot-card img {
  width: 100%;
  border-radius: 4px;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```

## Best Practices

1. **Polling Frequency**: Poll every 3-5 seconds, not more frequently
2. **Cleanup**: Always clear intervals when component unmounts
3. **Image Optimization**: Consider lazy loading for base64 images
4. **Notifications**: Use priority system - high priority for quick_check alerts
5. **Caching**: Cache displayed analyses to avoid re-rendering
6. **Error Handling**: Handle network failures gracefully
7. **Loading States**: Show loading indicators while waiting for first analysis

## Testing

```javascript
// Mock data for testing without active session
const mockAnalysisData = {
  success: true,
  sessionId: 'test123',
  intervalAnalysis: {
    quick_check: {
      timestamp: new Date().toISOString(),
      result: '⚠️ ALERTS: [engineTemp]\n✅ NORMAL: [rpm, speed]',
      plots: [{
        filename: 'quick_check.png',
        base64: '...',
        mimeType: 'image/png'
      }]
    }
  }
};

// Use in development
const response = Promise.resolve({ json: () => Promise.resolve(mockAnalysisData) });
```
