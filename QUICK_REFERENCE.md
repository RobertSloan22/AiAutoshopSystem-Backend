# Backend Analysis System - Quick Reference

## 🚀 Quick Start

### Run Tests
```bash
chmod +x test-analysis-endpoints.sh
./test-analysis-endpoints.sh
```

### Manual Testing

#### 1. Analyze a Session
```bash
curl -X POST http://localhost:5000/api/obd2/sessions/{sessionId}/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "analysisType": "comprehensive",
    "includeVisualization": true
  }'
```

#### 2. Get Cached Analysis
```bash
curl -X GET http://localhost:5000/api/obd2/sessions/{sessionId}/analysis
```

---

## 📋 Schema Changes

### DiagnosticSession (New Fields)
```javascript
{
  analysisResults: Mixed,          // Full analysis response
  analysisTimestamp: Date,         // When analysis was performed
  analysisType: String,            // Type of analysis
  analysisMetadata: {
    dataPointsAnalyzed: Number,    // How many data points were analyzed
    visualizationsGenerated: Number, // Number of charts generated
    analysisVersion: String        // Version of analysis engine
  }
}
```

---

## 🛣️ API Endpoints

### POST /api/obd2/sessions/:sessionId/analyze
**Generate new analysis**

**Request Body:**
```json
{
  "analysisType": "comprehensive",
  "includeVisualization": true,
  "timeRange": {
    "start": "2025-10-07T00:00:00Z",
    "end": "2025-10-07T23:59:59Z"
  }
}
```

**Success Response (200):**
```json
{
  "success": true,
  "sessionId": "...",
  "analysisType": "comprehensive",
  "analysis": { ... },
  "metadata": { ... }
}
```

**Error Responses:**
- `400` - Invalid session ID or no data available
- `404` - Session not found
- `500` - Analysis failed

---

### GET /api/obd2/sessions/:sessionId/analysis
**Retrieve cached analysis**

**Success Response (200):**
```json
{
  "success": true,
  "sessionId": "...",
  "analysisType": "comprehensive",
  "analysisTimestamp": "2025-10-07T10:30:00Z",
  "analysis": { ... },
  "metadata": {
    "dataPointsAnalyzed": 1500,
    "visualizationsGenerated": 1,
    "analysisVersion": "1.0"
  }
}
```

**Error Responses:**
- `400` - Invalid session ID format
- `404` - Session not found or no analysis available
- `500` - Database error

---

## ✅ Validation Flow

```
POST /analyze
    ↓
Is sessionId valid format?
    ↓ No → 400 "Invalid session ID format"
    ↓ Yes
Does session exist?
    ↓ No → 404 "Session not found"
    ↓ Yes
Does session have dataPointCount > 0?
    ↓ No → 400 "No data available"
    ↓ Yes
Do data points exist in DB?
    ↓ No → 400 "Data not committed yet"
    ↓ Yes
Run analysis
    ↓
Persist results
    ↓
Return response
```

---

## 🐛 Common Issues & Solutions

### Issue: "No data available for analysis"
**Cause:** Session has no data points  
**Solution:** Add data to session first using POST /sessions/:sessionId/data

### Issue: "Data not committed yet"
**Cause:** DataAggregator hasn't flushed buffer  
**Solution:** Wait 5 seconds or manually flush buffers

### Issue: "No analysis results available"
**Cause:** Analysis hasn't been run yet  
**Solution:** Run POST /analyze first

### Issue: "Invalid session ID format"
**Cause:** Session ID is not a valid MongoDB ObjectId  
**Solution:** Use valid 24-character hex string

---

## 📊 MongoDB Queries

### Check if session has analysis
```javascript
db.diagnosticsessions.findOne(
  { _id: ObjectId("...") },
  { analysisResults: 1, analysisTimestamp: 1, analysisType: 1 }
)
```

### Find all sessions with analysis
```javascript
db.diagnosticsessions.find(
  { analysisResults: { $exists: true } },
  { _id: 1, analysisTimestamp: 1, analysisType: 1 }
).sort({ analysisTimestamp: -1 })
```

### Delete analysis from session
```javascript
db.diagnosticsessions.updateOne(
  { _id: ObjectId("...") },
  { $unset: { 
    analysisResults: "",
    analysisTimestamp: "",
    analysisType: "",
    analysisMetadata: ""
  }}
)
```

---

## 🔧 Configuration

### Environment Variables
```bash
# MongoDB connection
MONGODB_URI=mongodb://localhost:27017/autoshop

# Redis connection (for real-time features)
REDIS_URL=redis://localhost:6379

# Server port
PORT=5000
```

### Analysis Types
- `summary` - Quick overview
- `comprehensive` - Full analysis (default)
- `performance` - Performance metrics
- `diagnostics` - DTC codes and diagnostics
- `fuel_efficiency` - Fuel economy analysis
- `maintenance` - Maintenance recommendations
- `driving_behavior` - Driving patterns

---

## 📝 Code Snippets

### Frontend: Get or Generate Analysis
```javascript
async function getOrGenerateAnalysis(sessionId) {
  // Try cached first
  let response = await fetch(`/api/obd2/sessions/${sessionId}/analysis`);
  
  if (response.status === 404) {
    // No cached analysis, generate new one
    console.log('Generating new analysis...');
    response = await fetch(`/api/obd2/sessions/${sessionId}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        analysisType: 'comprehensive',
        includeVisualization: true
      })
    });
  }
  
  return response.json();
}
```

### Backend: Manual Analysis Trigger
```javascript
import OBD2AnalysisService from './services/obd2AnalysisService.js';

const analysisService = new OBD2AnalysisService();

const result = await analysisService.executeTool('analyze_obd2_session', {
  sessionId: '507f1f77bcf86cd799439011',
  analysisType: 'comprehensive',
  timeRange: {
    start: new Date('2025-10-07T00:00:00Z'),
    end: new Date('2025-10-07T23:59:59Z')
  }
});
```

---

## 🚨 Error Codes Reference

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Continue |
| 400 | Bad Request | Check request parameters |
| 404 | Not Found | Verify session ID or run analysis |
| 500 | Server Error | Check logs, contact admin |

---

## 📈 Performance Tips

1. **Use GET /analysis first** - Avoid re-analyzing unnecessarily
2. **Cache on client** - Store results in local storage
3. **Batch requests** - Analyze multiple sessions in parallel
4. **Use specific analysis types** - Faster than comprehensive
5. **Set time ranges** - Analyze specific time periods only

---

## 🔍 Debugging

### Enable Debug Logs
```javascript
// In obd2.routes.js, add:
console.log('📊 Session data:', session);
console.log('🔍 Analysis result:', analysisResult);
console.log('💾 Persisting:', response.analysis);
```

### Check Backend Logs
```bash
# Look for these markers
✅ Found X sample data points for analysis
✅ Analysis results persisted for session ...
⚠️ Failed to persist analysis results: ...
❌ Enhanced session analysis failed: ...
```

### Verify Data Flow
```bash
# 1. Check session
curl http://localhost:5000/api/obd2/sessions/{sessionId}

# 2. Check data points
curl http://localhost:5000/api/obd2/sessions/{sessionId}/data?limit=10

# 3. Check analysis
curl http://localhost:5000/api/obd2/sessions/{sessionId}/analysis
```

---

## 📚 Related Documentation

- **Full Implementation Guide:** `BACKEND_ANALYSIS_FIXES_IMPLEMENTED.md`
- **Test Script:** `test-analysis-endpoints.sh`
- **API Documentation:** Server Swagger UI at `/api-docs`
- **Service Code:** `services/obd2AnalysisService.js`
- **Route Handlers:** `routes/obd2.routes.js`

---

## 🆘 Support

**Issues with implementation?**
1. Check logs in console
2. Verify MongoDB is running
3. Ensure data exists in session
4. Run test script to verify setup
5. Check this guide for common issues

**Need help?**
- Review `BACKEND_ANALYSIS_FIXES_IMPLEMENTED.md` for detailed documentation
- Check test script output for examples
- Verify database connections are working

---

**Last Updated:** October 7, 2025  
**Version:** 1.0

