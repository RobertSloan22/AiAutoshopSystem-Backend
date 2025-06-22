# OBD2 Integration System - Complete Implementation Guide

## Overview

This document provides a comprehensive guide for integrating OBD2 data collection, analysis, and visualization into your automotive application using the FastAgent system.

## System Architecture

```
Frontend (Mobile/Web App)
    ↓ Bluetooth OBD2
OBD2 Adapter
    ↓ HTTP/WebSocket
Node.js Backend Server (port 5000)
    ↓ Data Storage
MongoDB Database
    ↓ Analysis Requests
FastAgent Python Server (port 8001)
    ↓ Analysis Results
Frontend Visualization
```

## Quick Start

### 1. Start the System

```bash
# Start the integrated system
python run_integrated_system.py

# Or start individually:
# Terminal 1: Node.js backend
npm start

# Terminal 2: FastAgent server
python robust_server.py
```

### 2. API Endpoints

#### Session Management
```javascript
// Start OBD2 session
POST /api/obd2/session/start
{
  "vehicleId": "vehicle_id_here",
  "adapterInfo": {
    "type": "bluetooth",
    "identifier": "AA:BB:CC:DD:EE:FF"
  }
}

// End OBD2 session
POST /api/obd2/session/end/{sessionId}
```

#### Data Ingestion
```javascript
// Single data point
POST /api/obd2/ingest
{
  "sessionId": "session_uuid",
  "parameters": [
    {
      "pid": "010C",
      "value": 2048
    },
    {
      "pid": "010D", 
      "value": 65
    }
  ],
  "dtcCodes": [
    {
      "code": "P0171",
      "description": "System Too Lean (Bank 1)"
    }
  ],
  "location": {
    "latitude": 40.7128,
    "longitude": -74.0060
  }
}

// Bulk data ingestion
POST /api/obd2/ingest/bulk
{
  "sessionId": "session_uuid",
  "dataPoints": [
    {
      "parameters": [...],
      "timestamp": "2024-01-15T10:30:00Z"
    }
  ]
}
```

#### Analysis
```javascript
// Trigger analysis
POST /api/obd2/analyze/{sessionId}
{
  "analysisType": "performance", // performance, diagnostics, fuel_efficiency, maintenance_prediction, driving_behavior, general
  "options": {}
}

// Get analysis results
GET /api/obd2/analysis/{sessionId}
```

#### Data Retrieval
```javascript
// Get vehicle history
GET /api/obd2/history/{vehicleId}?startDate=2024-01-01&endDate=2024-01-31&limit=50&page=1

// Get current state
GET /api/obd2/current-state/{vehicleId}

// Get DTC history
GET /api/obd2/dtc-history/{vehicleId}?limit=50
```

### 3. WebSocket Integration

#### Connect to Real-time Stream
```javascript
// WebSocket connection
const token = 'your_jwt_token';
const sessionId = 'your_session_id';
const ws = new WebSocket(`ws://localhost:5000/ws/obd2?token=${token}&sessionId=${sessionId}`);

ws.onopen = () => {
  console.log('Connected to OBD2 stream');
  
  // Subscribe to analysis updates
  ws.send(JSON.stringify({
    type: 'subscribe_analysis'
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  switch(data.type) {
    case 'obd2_data':
      handleNewOBD2Data(data.data);
      break;
    case 'vehicle_state':
      updateVehicleState(data.state);
      break;
    case 'analysis_result':
      displayAnalysisResult(data.result);
      break;
    case 'dtc_update':
      updateDTCCodes(data.dtcCodes);
      break;
  }
};
```

## Frontend Integration

### OBD2 Data Collection (Frontend)

```javascript
class OBD2DataCollector {
  constructor(apiBaseUrl, authToken) {
    this.apiBaseUrl = apiBaseUrl;
    this.authToken = authToken;
    this.sessionId = null;
    this.websocket = null;
  }

  async startSession(vehicleId, adapterInfo) {
    const response = await fetch(`${this.apiBaseUrl}/api/obd2/session/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authToken}`
      },
      body: JSON.stringify({ vehicleId, adapterInfo })
    });

    const result = await response.json();
    if (result.success) {
      this.sessionId = result.sessionId;
      this.connectWebSocket();
      return result.sessionId;
    }
    throw new Error(result.error);
  }

  connectWebSocket() {
    const wsUrl = `ws://localhost:5000/ws/obd2?token=${this.authToken}&sessionId=${this.sessionId}`;
    this.websocket = new WebSocket(wsUrl);
    
    this.websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleRealtimeData(data);
    };
  }

  async sendOBD2Data(parameters, dtcCodes = [], location = null) {
    if (!this.sessionId) {
      throw new Error('No active session');
    }

    const response = await fetch(`${this.apiBaseUrl}/api/obd2/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authToken}`
      },
      body: JSON.stringify({
        sessionId: this.sessionId,
        parameters,
        dtcCodes,
        location
      })
    });

    return await response.json();
  }

  async requestAnalysis(analysisType = 'general') {
    const response = await fetch(`${this.apiBaseUrl}/api/obd2/analyze/${this.sessionId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authToken}`
      },
      body: JSON.stringify({ analysisType })
    });

    return await response.json();
  }

  handleRealtimeData(data) {
    // Override this method to handle real-time data
    console.log('Received real-time data:', data);
  }
}
```

### Bluetooth OBD2 Integration Example

```javascript
class BluetoothOBD2Adapter {
  constructor(dataCollector) {
    this.dataCollector = dataCollector;
    this.device = null;
    this.characteristic = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      // Request Bluetooth device
      this.device = await navigator.bluetooth.requestDevice({
        filters: [{ services: ['serial_port'] }],
        optionalServices: ['battery_service']
      });

      // Connect to GATT Server
      const server = await this.device.gatt.connect();
      const service = await server.getPrimaryService('serial_port');
      this.characteristic = await service.getCharacteristic('serial_port_data');

      // Start notifications
      await this.characteristic.startNotifications();
      this.characteristic.addEventListener('characteristicvaluechanged', 
        this.handleOBD2Data.bind(this));

      this.isConnected = true;
      console.log('Connected to OBD2 adapter');

    } catch (error) {
      console.error('Error connecting to OBD2 adapter:', error);
      throw error;
    }
  }

  async sendCommand(command) {
    if (!this.isConnected) {
      throw new Error('Not connected to OBD2 adapter');
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(command + '\r');
    await this.characteristic.writeValue(data);
  }

  handleOBD2Data(event) {
    const decoder = new TextDecoder();
    const response = decoder.decode(event.target.value);
    
    // Parse OBD2 response
    const parsedData = this.parseOBD2Response(response);
    
    if (parsedData.length > 0) {
      // Send to backend
      this.dataCollector.sendOBD2Data(parsedData);
    }
  }

  parseOBD2Response(response) {
    // Parse OBD2 response based on protocol
    // This is a simplified example
    const lines = response.split('\r');
    const parameters = [];

    for (const line of lines) {
      if (line.length >= 4) {
        const pid = line.substring(0, 4);
        const value = parseInt(line.substring(4), 16);
        parameters.push({ pid, value });
      }
    }

    return parameters;
  }

  async requestLiveData() {
    const commands = [
      '010C', // Engine RPM
      '010D', // Vehicle Speed
      '0105', // Engine Coolant Temperature
      '010F', // Intake Air Temperature
      '0111', // Throttle Position
      '0104'  // Engine Load
    ];

    for (const command of commands) {
      await this.sendCommand(command);
      await new Promise(resolve => setTimeout(resolve, 100)); // Wait between commands
    }
  }
}
```

## Available Analysis Types

### 1. Performance Analysis
- Engine RPM patterns
- Speed consistency
- Engine load analysis
- Performance metrics

### 2. Diagnostics Analysis
- DTC code interpretation
- Parameter threshold monitoring
- System health assessment

### 3. Fuel Efficiency Analysis
- Optimal driving range analysis
- Acceleration pattern evaluation
- Efficiency scoring

### 4. Maintenance Prediction
- Component wear prediction
- Maintenance recommendations
- Cost estimation

### 5. Driving Behavior Analysis
- Driving pattern assessment
- Safety scoring
- Behavior recommendations

## Data Visualization

The system provides analysis results with visualization data. Frontend can render:

### Dashboard Components
```javascript
// Example React components for visualization

// Real-time gauges
<EngineRPMGauge value={currentRPM} />
<SpeedGauge value={currentSpeed} />
<CoolantTempGauge value={coolantTemp} />

// Charts
<PerformanceChart data={performanceData} />
<EfficiencyChart data={efficiencyData} />

// Analysis results
<AnalysisResults results={analysisResults} />
<MaintenanceRecommendations items={maintenanceItems} />
```

## Database Schema

### OBD2Data Model
```javascript
{
  vehicleId: ObjectId,
  vin: String,
  sessionId: String,
  userId: ObjectId,
  adapterInfo: {
    type: String,
    identifier: String,
    protocol: String
  },
  parameters: [{
    pid: String,
    name: String,
    value: Mixed,
    unit: String,
    formattedValue: Number,
    timestamp: Date
  }],
  vehicleState: {
    engineRunning: Boolean,
    speed: Number,
    rpm: Number,
    engineLoad: Number,
    coolantTemp: Number,
    fuelLevel: Number
  },
  dtcCodes: [{
    code: String,
    description: String,
    status: String,
    detectedAt: Date
  }],
  analysisResults: [{
    analysisType: String,
    result: Mixed,
    confidence: Number,
    generatedAt: Date
  }]
}
```

## Security Considerations

1. **Authentication**: All API endpoints require JWT authentication
2. **WebSocket Security**: Token-based WebSocket authentication
3. **Data Validation**: Input validation on all endpoints
4. **Rate Limiting**: Implement rate limiting for data ingestion
5. **Data Privacy**: Encrypt sensitive vehicle data

## Performance Optimization

1. **Bulk Ingestion**: Use bulk endpoints for high-frequency data
2. **Data Compression**: Compress large datasets
3. **Caching**: Cache analysis results
4. **Connection Pooling**: Use WebSocket connection pooling
5. **Database Indexing**: Proper indexing on frequently queried fields

## Troubleshooting

### Common Issues

1. **WebSocket Connection Failed**
   - Check JWT token validity
   - Verify session exists
   - Check network connectivity

2. **Analysis Service Unavailable**
   - Ensure FastAgent server is running on port 8001
   - Check Python dependencies are installed
   - Verify FASTAGENT_URL environment variable

3. **Bluetooth Connection Issues**
   - Ensure device supports Web Bluetooth API
   - Check OBD2 adapter compatibility
   - Verify browser permissions

### Debug Endpoints

```javascript
// Check WebSocket service stats
GET /api/obd2/websocket/stats

// Health check
GET /api/obd2/health

// Data quality report
GET /api/obd2/data-quality/{sessionId}
```

## Environment Variables

```bash
# FastAgent integration
FASTAGENT_URL=http://localhost:8001

# MongoDB
MONGO_DB_URI=mongodb://localhost:27017/automotive

# JWT
JWT_SECRET=your_secret_key

# Server
PORT=5000
NODE_ENV=development
```

## Testing

### Unit Tests
```bash
npm test -- --grep "OBD2"
```

### Integration Tests
```bash
# Test data ingestion
curl -X POST http://localhost:5000/api/obd2/ingest \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"sessionId":"test","parameters":[{"pid":"010C","value":2048}]}'

# Test analysis
curl -X POST http://localhost:5000/api/obd2/analyze/test_session \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"analysisType":"performance"}'
```

## Production Deployment

1. **Environment Setup**
   - Set production environment variables
   - Configure MongoDB cluster
   - Set up SSL certificates

2. **Scaling**
   - Use PM2 for Node.js process management
   - Implement Redis for session storage
   - Use load balancers for multiple instances

3. **Monitoring**
   - Set up application monitoring
   - Monitor WebSocket connections
   - Track analysis performance

This integration provides a complete end-to-end solution for OBD2 data collection, real-time streaming, AI-powered analysis, and visualization in your automotive application.