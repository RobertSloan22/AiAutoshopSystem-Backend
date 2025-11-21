# Quick Start: Analysis Storage API

## 🎯 What You Need to Know

The OBD2 system now stores each analysis with a unique `analysisId` that you can use to retrieve the analysis and its plots anytime.

---

## 📝 Basic Usage

### 1. Run Analysis and Get ID
```bash
POST /api/obd2/sessions/:sessionId/analyze
Content-Type: application/json

{
  "analysisType": "comprehensive",
  "includeVisualization": true
}
```

**Response includes:**
```json
{
  "success": true,
  "analysisId": "analysis_lqz8x9_k2p4m1",  // ← SAVE THIS!
  "analysisUrl": "/api/obd2/analysis/analysis_lqz8x9_k2p4m1",
  "visualizations": [...],
  "enhancedAnalysis": {...}
}
```

### 2. Retrieve Analysis by ID
```bash
GET /api/obd2/analysis/analysis_lqz8x9_k2p4m1
```

**Response includes:**
- Full analysis text
- Structured data (health scores, anomalies, recommendations)
- All plots as base64
- Context information

---

## 🚀 Frontend Examples

### React: Display Analysis
```jsx
function AnalysisDisplay({ analysisId }) {
  const [analysis, setAnalysis] = useState(null);

  useEffect(() => {
    fetch(`/api/obd2/analysis/${analysisId}`)
      .then(res => res.json())
      .then(data => setAnalysis(data));
  }, [analysisId]);

  if (!analysis) return <div>Loading...</div>;

  return (
    <div>
      <h1>Health Score: {analysis.structuredData.healthScores.overall}/100</h1>
      {analysis.plots.map((plot, i) => (
        <img
          key={i}
          src={`data:${plot.mimeType};base64,${plot.base64}`}
          alt={plot.description}
        />
      ))}
    </div>
  );
}
```

### JavaScript: Display Plots
```javascript
async function showPlots(analysisId) {
  const response = await fetch(`/api/obd2/analysis/${analysisId}/plots`);
  const { plots } = await response.json();

  plots.forEach(plot => {
    const img = document.createElement('img');
    img.src = `data:${plot.mimeType};base64,${plot.base64}`;
    document.body.appendChild(img);
  });
}
```

---

## 🔑 Key Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/obd2/sessions/:sessionId/analyze` | Run analysis, get ID |
| `GET` | `/api/obd2/analysis/:analysisId` | Get full analysis |
| `GET` | `/api/obd2/analysis/:analysisId/plots` | Get only plots |
| `GET` | `/api/obd2/sessions/:sessionId/analyses` | List all analyses |
| `DELETE` | `/api/obd2/analysis/:analysisId` | Delete analysis |

---

## 📊 Response Structure

### Full Analysis Response
```json
{
  "success": true,
  "analysisId": "analysis_lqz8x9_k2p4m1",
  "sessionId": "507f1f77bcf86cd799439011",
  "structuredData": {
    "healthScores": {
      "overall": 85,
      "engine": 90,
      "fuel": 80,
      "emissions": 85
    },
    "anomalies": {
      "inRange": [...],
      "outOfRange": [...],
      "critical": [...]
    },
    "recommendations": [
      {
        "priority": "high",
        "action": "Check fuel system",
        "reason": "Fuel trim out of range"
      }
    ]
  },
  "plots": [
    {
      "filename": "obd2_dashboard_1234.png",
      "base64": "iVBORw0KG...",
      "mimeType": "image/png",
      "description": "Comprehensive dashboard"
    }
  ]
}
```

---

## 💡 Best Practices

### ✅ DO:
- **Save the `analysisId`** from POST response
- **Use `/analysis/:analysisId`** for retrieving data
- **Use `/analysis/:analysisId/plots`** for image galleries
- **Cache analysis IDs** in your application
- **Paginate** when listing many analyses

### ❌ DON'T:
- **Don't** parse plots from session endpoint (slower)
- **Don't** fetch full list without pagination
- **Don't** forget to handle 404 errors

---

## 🎨 Data You Get

### Health Scores
```javascript
analysis.structuredData.healthScores = {
  overall: 85,    // 0-100
  engine: 90,
  fuel: 80,
  emissions: 85,
  cooling: 88,
  electrical: 92
}
```

### Recommendations
```javascript
analysis.structuredData.recommendations = [
  {
    priority: "high",           // critical, high, medium, low
    action: "Diagnose DTC P0171",
    reason: "System running lean",
    affectedParameters: ["fuelTrimLongB1", "o2B1S1Voltage"],
    dtcCodes: ["P0171"]
  }
]
```

### Anomalies
```javascript
analysis.structuredData.anomalies = {
  inRange: [...],       // Parameters within normal range
  outOfRange: [...],    // Parameters outside normal range
  critical: [...]       // Critical issues requiring attention
}
```

### Plots
```javascript
analysis.plots = [
  {
    filename: "obd2_dashboard.png",
    base64: "iVBORw0KGgoAAAA...",  // Use this to display
    mimeType: "image/png",
    description: "Comprehensive multi-panel dashboard",
    generatedAt: "2025-01-15T10:30:00Z"
  }
]
```

---

## 🔍 Common Patterns

### Pattern 1: Run Analysis, Save ID
```javascript
// Run analysis
const result = await fetch('/api/obd2/sessions/SESSION_ID/analyze', {
  method: 'POST',
  body: JSON.stringify({ analysisType: 'comprehensive' })
});

const { analysisId } = await result.json();

// Save to your database/state
saveAnalysisId(analysisId);
```

### Pattern 2: Display Later
```javascript
// Retrieve analysis anytime
const analysis = await fetch(`/api/obd2/analysis/${analysisId}`)
  .then(r => r.json());

// Display health
console.log('Health:', analysis.structuredData.healthScores.overall);

// Display plots
analysis.plots.forEach(plot => {
  showImage(`data:${plot.mimeType};base64,${plot.base64}`);
});
```

### Pattern 3: List All Analyses
```javascript
// Get all analyses for a session
const { analyses } = await fetch(`/api/obd2/sessions/SESSION_ID/analyses?limit=10`)
  .then(r => r.json());

analyses.forEach(a => {
  console.log(`${a.analysisType}: Health ${a.healthScore}, ${a.plotCount} plots`);
});
```

---

## 📈 Performance Tips

1. **Listings**: Use `/sessions/:sessionId/analyses` (excludes heavy plot data)
2. **Plots Only**: Use `/analysis/:analysisId/plots` (no text data)
3. **Full Data**: Use `/analysis/:analysisId` (everything)
4. **Pagination**: Always set `?limit=10` for lists
5. **Caching**: Cache analysisId in your frontend

---

## ⚡ Quick Reference

### Analysis ID Format
```
analysis_[timestamp]_[random]
Example: analysis_lqz8x9_k2p4m1
```

### Response Times
- Get by ID: ~50-150ms
- Get plots only: ~30-100ms
- List analyses: ~20-80ms
- Run analysis: ~30-60 seconds

### File Sizes
- Single plot: ~70-270 KB (base64)
- Full analysis: ~300 KB average

---

## 🆘 Troubleshooting

### Analysis Not Found (404)
```javascript
// Check if analysis exists
const response = await fetch(`/api/obd2/analysis/${analysisId}`);
if (!response.ok) {
  console.error('Analysis not found or deleted');
}
```

### Large Responses
```javascript
// For list views, plots are excluded automatically
const { analyses } = await fetch(`/api/obd2/sessions/${sessionId}/analyses`)
  .then(r => r.json());

// Each item has plotCount but not the actual base64 data
analyses.forEach(a => console.log(`Has ${a.plotCount} plots`));
```

---

## 📚 Full Documentation

For complete API documentation, see: `/docs/ANALYSIS_STORAGE_API.md`

For visualization enhancements, see: `/docs/OBD2_VISUALIZATION_ENHANCEMENTS.md`

---

**That's it!** You now have everything you need to store and retrieve OBD2 analyses with comprehensive multi-plot visualizations. 🎉
