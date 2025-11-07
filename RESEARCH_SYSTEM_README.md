# Research System Documentation

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)  
3. [Deep Research System](#deep-research-system)
4. [Standard Research Routes](#standard-research-routes)
5. [Multi-Agent Research](#multi-agent-research)
6. [Integrated Research](#integrated-research)
7. [Data Models](#data-models)
8. [API Endpoints](#api-endpoints)
9. [Configuration](#configuration)
10. [Usage Examples](#usage-examples)
11. [Troubleshooting](#troubleshooting)

## Overview

The AiAutoshopSystem Research Backend provides a comprehensive, multi-layered research infrastructure specifically designed for automotive diagnostics, repair procedures, and technical analysis. The system combines several research methodologies:

- **Deep Research System**: Advanced OpenAI Agents framework for comprehensive automotive research
- **Standard Research Routes**: High-performance vehicle diagnostic research with MongoDB caching
- **Multi-Agent Research**: Collaborative AI agent system for complex queries
- **Integrated Research**: Unified interface with progress tracking and result management

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Research System Architecture                  │
├─────────────────────────────────────────────────────────────────┤
│  Frontend Clients                                               │
│  ├─── Web Dashboard                                             │
│  ├─── Mobile Apps                                               │
│  └─── Third-party Integrations                                 │
├─────────────────────────────────────────────────────────────────┤
│  API Gateway (server.js:5005)                                  │
│  ├─── CORS Configuration                                        │
│  ├─── Authentication                                            │
│  └─── Rate Limiting                                             │
├─────────────────────────────────────────────────────────────────┤
│  Research Routes Layer                                          │
│  ├─── /api/deep-research          (OpenAI Agents)              │
│  ├─── /api/research               (Standard with Caching)      │
│  ├─── /api/multiagent-research    (Multi-Agent System)         │
│  ├─── /api/integrated-research    (Unified Interface)          │
│  └─── /api/research-progress      (Progress Tracking)          │
├─────────────────────────────────────────────────────────────────┤
│  Service Layer                                                  │
│  ├─── deepResearchService.js      (Agent Framework)            │
│  ├─── ResearchAgentSystem.js      (LangGraph Workflow)         │
│  ├─── research.controller.js      (Request Processing)         │
│  └─── pythonExecutionService.js   (External Processing)        │
├─────────────────────────────────────────────────────────────────┤
│  Data Layer                                                     │
│  ├─── MongoDB (Primary Storage)                                │
│  │    ├─── ResearchResult Collection                           │
│  │    ├─── ResearchProgress Collection                         │
│  │    └─── ResearchCache Collection                            │
│  ├─── Vector Storage (Optional)                                │
│  │    ├─── Qdrant/ChromaDB                                     │
│  │    └─── OpenAI Embeddings                                   │
│  └─── External APIs                                            │
│       ├─── OpenAI GPT Models                                   │
│       ├─── Web Search APIs                                     │
│       └─── Automotive Data APIs                               │
└─────────────────────────────────────────────────────────────────┘
```

## Deep Research System

### Overview
The Deep Research System uses OpenAI's Agents framework to provide comprehensive automotive research with specialized agents for different aspects of vehicle diagnostics and repair.

### Key Components

#### 1. Agent Architecture
```javascript
// Located in: services/deepResearchService.js
{
  "triage": "Routes queries to appropriate specialized agents",
  "clarifying": "Asks clarifying questions for incomplete queries", 
  "instruction": "Transforms queries into detailed research instructions",
  "research": "Performs comprehensive automotive research with web search"
}
```

#### 2. Specialized Research Methods

**Comprehensive Research**
```javascript
// Endpoint: POST /api/deep-research/conduct
await deepResearchService.conductResearch(query, mockAnswers, options);
```

**Quick Research**
```javascript  
// Endpoint: POST /api/deep-research/quick
await deepResearchService.quickResearch(query, options);
```

**DTC Code Analysis**
```javascript
// Endpoint: POST /api/deep-research/dtc-codes
await deepResearchService.researchDTCCodes(dtcCodes, vehicleInfo);
```

**Parts Compatibility**
```javascript
// Endpoint: POST /api/deep-research/parts-compatibility  
await deepResearchService.researchPartsCompatibility(partQuery, vehicleInfo);
```

#### 3. Agent Configuration

The system uses specialized prompts for automotive focus:

```javascript
// Triage Agent
instructions: `Analyze automotive research queries and determine if clarifications are needed.
For automotive topics like:
- Vehicle diagnostics, OBD2 codes, DTC analysis
- Parts compatibility and sourcing  
- Repair procedures and maintenance
- Technical service bulletins
- Vehicle specifications and systems`

// Research Agent  
instructions: `You are an expert automotive research agent specialized in:
- Vehicle diagnostics and troubleshooting
- OBD2 codes and error analysis  
- Automotive parts research and compatibility
- Technical service bulletins and recalls
- Repair procedures and maintenance
- Industry trends and new technologies`
```

## Standard Research Routes

### Overview
High-performance research system with MongoDB caching, designed for vehicle diagnostic analysis with comprehensive technical details.

### Key Features

#### 1. Vehicle Problem Analysis
```javascript
// Endpoint: POST /api/research
// Request Body:
{
  "vin": "1HGCM82633A123456",
  "year": "2023", 
  "make": "Honda",
  "model": "Accord",
  "problem": "Engine misfiring on cylinder 2",
  "dtcCodes": ["P0302", "P0171"],
  "skipCache": false
}
```

#### 2. Technical Component Details
```javascript
// Endpoint: POST /api/research/technical-details
// Request Body:
{
  "year": "2023",
  "make": "Honda", 
  "model": "Accord",
  "component": "Mass Air Flow Sensor",
  "vin": "1HGCM82633A123456"
}
```

#### 3. Vehicle-Specific Q&A
```javascript
// Endpoint: POST /api/research/vehicle-question
// Request Body:
{
  "year": "2023",
  "make": "Honda",
  "model": "Accord", 
  "question": "What are the torque specifications for the cylinder head bolts?",
  "engine": "2.0L Turbo"
}
```

#### 4. Service Bulletin Research
```javascript
// Endpoint: POST /api/research/service-bulletin
// Request Body:
{
  "year": "2023",
  "make": "Honda",
  "model": "Accord",
  "category": "Engine",
  "symptom": "rough idle"
}
```

### Response Structure

The standard research system returns highly detailed technical information:

```json
{
  "result": {
    "diagnosticSteps": [
      {
        "step": "Test Mass Air Flow Sensor",
        "details": "Located at air intake tube, 15cm from throttle body",
        "componentLocation": "Engine bay, driver side, mounted on air filter housing",
        "connectorInfo": "C113 connector (black 4-pin, P/N 37980-RCA-A01)",
        "tools": ["DVOM", "Scan tool", "MAF cleaner"],
        "expectedReadings": "1.2-1.8V at idle, 3.5-4.5V at 2500 RPM",
        "normalValueRanges": "0.6-5.0V operational range",
        "factoryServiceManualRef": "Section 11-140, Page 11-45",
        "notes": "Clean MAF element before testing",
        "specialPrecautions": "Do not use carburetor cleaner on MAF element"
      }
    ],
    "possibleCauses": [
      {
        "cause": "Contaminated Mass Air Flow Sensor",
        "likelihood": "High",
        "explanation": "Oil vapors and debris can coat the sensing element",
        "modelSpecificNotes": "2023 Accords have revised MAF design prone to contamination",
        "commonSymptomsForThisCause": ["P0171", "P0174", "rough idle", "poor acceleration"],
        "technicalBackground": "Hot wire anemometer type sensor measures air mass flow",
        "failureRate": "15% of vehicles by 60,000 miles",
        "vehicleSubsystemAffected": "Fuel injection system"
      }
    ],
    "recommendedFixes": [
      {
        "fix": "Clean or replace Mass Air Flow Sensor",
        "difficulty": "Easy",
        "estimatedCost": "$25-$180",
        "professionalOnly": false,
        "parts": ["MAF sensor", "MAF cleaner", "O-ring"],
        "oemPartNumbers": ["37980-RCA-A01", "37980-RCA-A02"],
        "torqueSpecs": "MAF sensor mounting bolts: 5.5 Nm (4.1 ft-lb)",
        "laborHours": "0.3 hours",
        "specialTools": ["10mm socket", "Phillips screwdriver"],
        "procedureOverview": "Remove air intake tube, disconnect connector, remove sensor",
        "commonPitfalls": ["Over-tightening mounting bolts", "Using wrong cleaning solvent"],
        "postRepairVerification": "Clear codes, road test, verify fuel trims within ±5%",
        "warrantyConsiderations": "May void warranty if aftermarket parts used"
      }
    ]
  }
}
```

## Multi-Agent Research

### Overview
Collaborative research system using LangGraph for complex automotive queries requiring multiple specialized agents.

### Agent Workflow
```
┌─────────────────────────────────────────────────────────┐
│              Multi-Agent Research Workflow              │
├─────────────────────────────────────────────────────────┤
│  1. Query Decomposition Agent                           │
│     └─── Breaks down complex questions                  │
├─────────────────────────────────────────────────────────┤
│  2. Specialized Research Agents (Parallel)              │
│     ├─── Vehicle Systems Agent                          │
│     ├─── Compliance Agent                               │
│     ├─── OEM Data Agent                                 │
│     └─── Community Forums Agent                         │
├─────────────────────────────────────────────────────────┤
│  3. Response Synthesis Agent                            │
│     └─── Combines and synthesizes findings              │
├─────────────────────────────────────────────────────────┤
│  4. Progress Reporting (WebSocket)                      │
│     └─── Real-time updates to client                    │
└─────────────────────────────────────────────────────────┘
```

### Key Components

#### ResearchAgentSystem.js
Located in: `services/ResearchAgentSystem.js`

```javascript
class ResearchAgentSystem {
  constructor() {
    this.graph = this.createResearchGraph();
    this.progressCallback = null;
  }

  async processResearch(query, progressCallback) {
    this.progressCallback = progressCallback;
    
    const initialState = {
      originalQuery: query,
      decomposedQuestions: [],
      researchResults: [],
      finalResponse: null
    };
    
    return await this.graph.invoke(initialState);
  }
}
```

## Integrated Research

### Overview
Unified research interface that provides a single endpoint for accessing all research capabilities with comprehensive progress tracking.

### Key Features

#### 1. Request Processing
```javascript
// Endpoint: POST /api/integrated-research/research
// Controller: controllers/research.controller.js
export const performResearch = async (req, res) => {
  const { query } = req.body;
  const researchId = crypto.randomUUID();
  
  // Initialize progress tracking
  const newProgress = new ResearchProgress({
    researchId,
    query,
    status: 'pending',
    userId: req.user?.id || null
  });
  
  // Start background processing
  processResearch(researchId, query, req.user?.id);
  
  // Return immediately with research ID
  res.status(202).json({
    success: true,
    message: 'Research request accepted',
    researchId,
    progressUrl: `/api/research-progress/${researchId}`
  });
};
```

#### 2. Progress Tracking
```javascript
// Real-time progress updates
await updateProgress(researchId, {
  agentId: 'vehicle_systems',
  status: 'in_progress',  
  message: 'Researching engine diagnostics',
  progress: {
    current: 2,
    total: 5,
    percentage: 40
  }
});
```

#### 3. Streaming Research
```javascript
// Endpoint: POST /api/integrated-research/research/stream
// Server-Sent Events for real-time updates
res.writeHead(200, {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive'
});
```

## Data Models

### 1. ResearchResult Model
```javascript
// File: models/researchResult.model.js
const researchResultSchema = new mongoose.Schema({
  query: { type: String, required: true, index: true },
  result: { type: mongoose.Schema.Types.Mixed, required: true },
  sources: { type: [String], default: [] },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  tags: { type: [String], default: [] },
  status: { 
    type: String, 
    enum: ["pending", "in-progress", "completed", "failed"],
    default: "completed" 
  },
  // Vehicle context information
  vehicle: {
    year: String,
    make: String, 
    model: String,
    vin: String,
    engine: String,
    transmission: String
  },
  dtcCode: String,
  // UUID fields for different systems
  researchId: String,
  uuid: String,
  originalId: String,
  sessionId: { type: String, index: true },
  traceId: String
});
```

### 2. ResearchProgress Model  
```javascript
// File: models/researchProgress.model.js
const researchProgressSchema = new mongoose.Schema({
  researchId: { type: String, required: true, unique: true },
  query: { type: String, required: true },
  status: { 
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'error'],
    default: 'pending'
  },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  startedAt: { type: Date, default: Date.now },
  completedAt: Date,
  subtasks: [{
    id: String,
    name: String,
    status: { type: String, enum: ['pending', 'in_progress', 'completed', 'error'] },
    progress: {
      current: { type: Number, default: 0 },
      total: { type: Number, default: 1 },
      percentage: { type: Number, default: 0 }
    }
  }],
  questions: [{ 
    question: String,
    category: String,
    agent: String 
  }],
  logs: [{
    timestamp: { type: Date, default: Date.now },
    message: String,
    level: { type: String, enum: ['info', 'warning', 'error'], default: 'info' },
    agentId: String
  }]
});
```

### 3. ResearchCache Model
```javascript  
// File: models/researchCache.model.js
const researchCacheSchema = new mongoose.Schema({
  vehicleInfo: {
    vin: String,
    year: String,
    make: String, 
    model: String,
    trim: String,
    engine: String,
    transmission: String,
    mileage: String
  },
  problem: { type: String, required: true },
  dtcCodes: [String],
  result: { type: mongoose.Schema.Types.Mixed, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
});
```

## API Endpoints

### Deep Research System

| Endpoint | Method | Description | Request Body |
|----------|--------|-------------|--------------|
| `/api/deep-research/conduct` | POST | Comprehensive research | `{ "query": "string", "options": {} }` |
| `/api/deep-research/quick` | POST | Quick research | `{ "query": "string" }` |
| `/api/deep-research/dtc-codes` | POST | DTC code analysis | `{ "dtcCodes": ["P0301"], "vehicleInfo": {} }` |
| `/api/deep-research/parts-compatibility` | POST | Parts compatibility | `{ "partQuery": "string", "vehicleInfo": {} }` |
| `/api/deep-research/health` | GET | Service health check | None |
| `/api/deep-research/initialize` | POST | Manual initialization | None |

### Standard Research Routes

| Endpoint | Method | Description | Request Body |
|----------|--------|-------------|--------------|
| `/api/research` | POST | Vehicle problem analysis | `{ "year": "2023", "make": "Honda", "model": "Accord", "problem": "string", "dtcCodes": [] }` |
| `/api/research/technical-details` | POST | Component technical details | `{ "year": "2023", "make": "Honda", "model": "Accord", "component": "string" }` |
| `/api/research/vehicle-question` | POST | Vehicle-specific Q&A | `{ "year": "2023", "make": "Honda", "model": "Accord", "question": "string" }` |
| `/api/research/service-bulletin` | POST | TSB information | `{ "year": "2023", "make": "Honda", "model": "Accord", "category": "Engine" }` |
| `/api/research/cache/:id` | GET | Get cached research | None |
| `/api/research/cache` | GET | Search cached research | Query params: `year`, `make`, `model`, `dtcCode`, `problem` |
| `/api/research/search-similar` | POST | Find similar research | `{ "query": "string", "make": "Honda", "model": "Accord" }` |

### Integrated Research

| Endpoint | Method | Description | Request Body |
|----------|--------|-------------|--------------|
| `/api/integrated-research/health` | GET | Health check | None |
| `/api/integrated-research/research` | POST | Research request | `{ "query": "string" }` |
| `/api/integrated-research/research/stream` | POST | Streaming research | `{ "query": "string" }` |

### Progress Tracking

| Endpoint | Method | Description | Request Body |
|----------|--------|-------------|--------------|
| `/api/research-progress/:researchId` | GET | Get progress | None |
| `/api/research-progress/:researchId` | PATCH | Update progress | `{ "status": "string", "message": "string" }` |

### Research Results

| Endpoint | Method | Description | Request Body |
|----------|--------|-------------|--------------|
| `/api/research-results` | GET | List research results | Query params: `limit`, `page`, `userId` |
| `/api/research-results/:id` | GET | Get specific result | None |
| `/api/research-results` | POST | Create result | `{ "query": "string", "result": {}, "sources": [] }` |
| `/api/research-results/:id` | PUT | Update result | Research data object |
| `/api/research-results/:id` | DELETE | Delete result | None |

## Configuration

### Environment Variables

```bash
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Database Configuration  
MONGODB_URI=mongodb://localhost:27017/automotive_research

# Vector Storage (Optional)
ENABLE_VECTOR_SERVICES=false
CHROMA_URL=http://localhost:8000
LOCAL_EMBEDDING_URL=http://localhost:11434/api/embeddings

# Service Configuration
PORT=5005
NODE_ENV=development

# Agent Service Configuration  
AGENT_SERVICE_PORT=3003

# Research Configuration
DEFAULT_RESEARCH_TIMEOUT=120000
MAX_RESEARCH_RETRIES=3
CACHE_EXPIRATION_DAYS=30

# Deep Research Configuration
OPENAI_AGENTS_DISABLE_TRACING=1
```

### Model Configuration

```javascript
// Standard Research Models
const MODELS = {
  primary: 'o3-mini',        // Primary research model
  fallback: 'gpt-4o-mini',   // Fallback model
  embeddings: 'text-embedding-3-small'
};

// Deep Research Models
const DEEP_RESEARCH_MODELS = {
  research: 'o4-mini-deep-research-2025-06-26',
  instruction: 'gpt-4o-mini',
  clarifying: 'gpt-4o-mini',
  triage: 'gpt-4o-mini'
};
```

### Caching Configuration

```javascript
// Cache Settings
const CACHE_CONFIG = {
  enabled: true,
  expirationDays: 30,
  maxCacheSize: 10000,
  cleanupInterval: '0 2 * * *' // Daily at 2 AM
};
```

## Usage Examples

### 1. Deep Research - Comprehensive Analysis

```javascript
// Request
const response = await fetch('/api/deep-research/conduct', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: "Why is my 2020 Toyota Camry's engine making a knocking sound at idle, and it has DTC code P0325?",
    options: { verbose: true }
  })
});

// Response
{
  "success": true,
  "research": "Detailed research content with citations...",
  "citations": [
    {
      "title": "Toyota Camry Knock Sensor Diagnostic Procedures",
      "url": "https://techinfo.toyota.com/...",
      "excerpt": "The P0325 code indicates a knock sensor circuit malfunction..."
    }
  ],
  "metadata": {
    "query": "Why is my 2020 Toyota Camry's engine making a knocking sound...",
    "timestamp": "2024-01-15T10:30:00Z",
    "type": "automotive_deep_research"
  }
}
```

### 2. Standard Research - Vehicle Problem Analysis

```javascript
// Request  
const response = await fetch('/api/research', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    year: "2020",
    make: "Toyota", 
    model: "Camry",
    problem: "Engine knocking at idle",
    dtcCodes: ["P0325"],
    engine: "2.5L 4-cylinder",
    mileage: "45000"
  })
});

// Response
{
  "result": {
    "diagnosticSteps": [
      {
        "step": "Test knock sensor circuit",
        "details": "Verify knock sensor wiring and connector integrity",
        "componentLocation": "Engine block, between cylinders 2 and 3, accessible from underneath",
        "connectorInfo": "2-pin connector, gray plastic housing, P/N 90980-11885",
        "tools": ["DVOM", "Scan tool", "Oscilloscope"],
        "expectedReadings": "0.1-4.5V AC during engine knock events",
        "normalValueRanges": "Base voltage: 2.5V DC ±0.1V",
        "factoryServiceManualRef": "Section BE-21, Pages 45-52"
      }
    ],
    "possibleCauses": [
      {
        "cause": "Faulty knock sensor",
        "likelihood": "High", 
        "explanation": "Piezoelectric sensor may have internal failure",
        "modelSpecificNotes": "2020 Camry knock sensors prone to moisture intrusion"
      }
    ],
    "recommendedFixes": [
      {
        "fix": "Replace knock sensor",
        "difficulty": "Moderate",
        "estimatedCost": "$120-$280",
        "parts": ["Knock sensor", "Thread sealant", "Connector pigtail"],
        "oemPartNumbers": ["89615-06010", "90980-11885"],
        "torqueSpecs": "Knock sensor: 20 Nm (15 ft-lb)",
        "laborHours": "1.2 hours"
      }
    ]
  }
}
```

### 3. Integrated Research - With Progress Tracking

```javascript
// Start research
const startResponse = await fetch('/api/integrated-research/research', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: "Complete diagnostic procedure for 2019 Ford F-150 with multiple engine codes P0171, P0174, P0300"
  })
});

// Response
{
  "success": true,
  "message": "Research request accepted and is being processed", 
  "researchId": "123e4567-e89b-12d3-a456-426614174000",
  "progressUrl": "/api/research-progress/123e4567-e89b-12d3-a456-426614174000"
}

// Check progress
const progressResponse = await fetch('/api/research-progress/123e4567-e89b-12d3-a456-426614174000');

// Progress Response
{
  "researchId": "123e4567-e89b-12d3-a456-426614174000",
  "status": "in_progress",
  "overall_progress": 65,
  "subtasks": [
    {
      "id": "decomposer",
      "name": "Breaking down research question",
      "status": "completed",
      "progress": { "current": 1, "total": 1, "percentage": 100 }
    },
    {
      "id": "vehicle_systems", 
      "name": "Researching vehicle systems",
      "status": "in_progress",
      "progress": { "current": 3, "total": 5, "percentage": 60 }
    }
  ]
}
```

### 4. Streaming Research

```javascript
// Start streaming research
const eventSource = new EventSource('/api/integrated-research/research/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: "Diagnostic procedures for BMW X5 transmission problems"
  })
});

// Handle streaming events
eventSource.onmessage = function(event) {
  const data = JSON.parse(event.data);
  console.log('Research update:', data);
};

eventSource.addEventListener('completed', function(event) {
  const result = JSON.parse(event.data);
  console.log('Research completed:', result);
  eventSource.close();
});

eventSource.addEventListener('error', function(event) {
  console.error('Research error:', event.data);
  eventSource.close();
});
```

## Troubleshooting

### Common Issues

#### 1. Deep Research Service Not Initializing
```bash
# Check logs
tail -f logs/server.log | grep "Deep Research"

# Common causes:
# - Missing OPENAI_API_KEY
# - Network connectivity issues  
# - Invalid model names

# Solution:
export OPENAI_API_KEY=your_key_here
npm restart
```

#### 2. MongoDB Connection Issues
```bash
# Check MongoDB status
systemctl status mongod

# Verify connection string
echo $MONGODB_URI

# Test connection
mongo $MONGODB_URI --eval "db.stats()"
```

#### 3. Research Cache Not Working
```javascript
// Clear cache manually
db.researchcaches.deleteMany({
  createdAt: { $lt: new Date(Date.now() - 30*24*60*60*1000) }
});

// Rebuild indexes
db.researchcaches.reIndex();
```

#### 4. Agent Service Communication Issues
```bash
# Check agent service status
curl http://localhost:3003/research/health

# Restart agent service
pm2 restart agent-service

# Check logs
pm2 logs agent-service
```

### Performance Optimization

#### 1. Database Indexing
```javascript
// Essential indexes for performance
db.researchresults.createIndex({ "query": "text" });
db.researchresults.createIndex({ "vehicle.year": 1, "vehicle.make": 1, "vehicle.model": 1 });
db.researchresults.createIndex({ "dtcCode": 1 });
db.researchresults.createIndex({ "createdAt": -1 });

db.researchcaches.createIndex({ 
  "vehicleInfo.year": 1, 
  "vehicleInfo.make": 1, 
  "vehicleInfo.model": 1 
});
db.researchcaches.createIndex({ "problem": "text" });
db.researchcaches.createIndex({ "createdAt": -1 });
```

#### 2. Memory Management
```javascript
// Configure Node.js memory limits
// In package.json scripts:
"start": "node --max-old-space-size=4096 server.js"

// Monitor memory usage
process.memoryUsage(); // Check in application
```

#### 3. Request Rate Limiting
```javascript
// Add to server.js
import rateLimit from 'express-rate-limit';

const researchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 research requests per windowMs
  message: 'Too many research requests, please try again later.'
});

app.use('/api/research', researchLimiter);
app.use('/api/deep-research', researchLimiter);
```

### Monitoring and Logging

#### 1. Health Check Endpoints
```bash
# Check all services
curl http://localhost:5005/health
curl http://localhost:5005/api/deep-research/health
curl http://localhost:5005/api/integrated-research/health
curl http://localhost:3003/research/health
```

#### 2. Performance Metrics
```javascript
// Add to routes for monitoring
import { performance } from 'perf_hooks';

const startTime = performance.now();
// ... research processing ...
const endTime = performance.now();
console.log(`Research completed in ${endTime - startTime} milliseconds`);
```

#### 3. Error Tracking
```javascript
// Centralized error logging
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'logs/research-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/research-combined.log' })
  ]
});
```

## Security Considerations

### 1. API Key Protection
```javascript
// Never expose API keys in client-side code
// Use environment variables
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Implement key rotation strategy
// Monitor API usage and costs
```

### 2. Input Validation
```javascript
import Joi from 'joi';

const researchSchema = Joi.object({
  year: Joi.string().pattern(/^\d{4}$/).required(),
  make: Joi.string().min(1).max(50).required(),
  model: Joi.string().min(1).max(50).required(),
  problem: Joi.string().min(10).max(1000).required(),
  dtcCodes: Joi.array().items(Joi.string().pattern(/^[A-Z]\d{4}$/))
});
```

### 3. Rate Limiting and DDoS Protection
```javascript
// Implement multiple layers of protection
const strictLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 5, // Very strict for expensive operations
});

app.use('/api/deep-research/conduct', strictLimiter);
```

---

## Contributing

When contributing to the research system:

1. **Follow the established patterns** - Each research type has specific interfaces and response formats
2. **Add comprehensive tests** - Include unit tests for new endpoints and integration tests for workflows  
3. **Update documentation** - Keep this README and API documentation current
4. **Monitor performance** - Research operations can be expensive; optimize for efficiency
5. **Maintain backwards compatibility** - Existing clients depend on stable APIs

## Support

For technical support:
- Review the troubleshooting section above
- Check the application logs in `/logs/`
- Monitor the health check endpoints
- Refer to the individual service documentation

---

*Last Updated: 2024-01-15*
*Version: 2.1.0*