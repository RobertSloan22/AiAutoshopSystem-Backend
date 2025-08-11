# Web Search Integration for AI Responses Agent

## Overview

Your AI Responses Agent now has comprehensive web search capabilities integrated directly into the conversation system. The agent can search for current information, technical service bulletins (TSBs), recalls, and technical diagrams to provide up-to-date automotive diagnostic assistance.

## ✅ Implementation Complete

### **New Web Search Service** (`/services/webSearchService.js`)
- **Serper API Integration** - Primary search provider (Google search API)
- **Google Custom Search** - Fallback search provider
- **Specialized automotive search** - Enhanced queries for vehicle-specific content
- **Technical image search** - Finds wiring diagrams, parts diagrams, flowcharts

### **Integration with Responses Agent** (`/services/responsesService.js`)
- **Tool registration** - Web search tools automatically available to OpenAI
- **Enhanced system prompt** - Instructions for when and how to use web search
- **Dual search modes** - General web search + technical image search

### **New API Endpoints**
- `GET /api/responses/websearch/status` - Web search service status
- `GET /api/responses/services/status` - All services status overview

## Web Search Tools Available

### 1. **web_search** 
Search the web for current information, recalls, TSBs, and troubleshooting guides.

**Parameters:**
- `query` (required) - Search query with vehicle details
- `search_type` - general, automotive, technical, recall, tsb
- `max_results` - Number of results (1-10, default: 5)

**Example Usage by AI:**
```json
{
  "query": "2020 Toyota Camry P0301 misfire recall TSB",
  "search_type": "recall",
  "max_results": 5
}
```

### 2. **search_technical_images**
Search for technical images, diagrams, and visual guides.

**Parameters:**
- `query` (required) - Image search query
- `vehicle_context` - Year, make, model for better results
- `image_type` - diagram, wiring, flowchart, parts, general

**Example Usage by AI:**
```json
{
  "query": "engine vacuum diagram",
  "vehicle_context": {
    "year": "2020",
    "make": "Toyota", 
    "model": "Camry"
  },
  "image_type": "diagram"
}
```

## Enhanced System Prompt

The agent now knows to:
- ✅ Search for recalls and TSBs for specific vehicles
- ✅ Find current diagnostic procedures beyond training data
- ✅ Locate technical diagrams when visual explanations help
- ✅ Search for up-to-date repair information
- ✅ Include vehicle context in searches for better results

## Configuration Requirements

### Environment Variables

Add these to your `.env` file:

```env
# Primary web search (Serper API - recommended)
SERPER_API_KEY=your_serper_api_key_here

# Fallback web search (Google Custom Search)
GOOGLE_API_KEY=your_google_api_key_here
GOOGLE_SEARCH_ENGINE_ID=your_search_engine_id_here

# Required for AI agent functionality  
OPENAI_API_KEY=your_openai_api_key_here
```

### Getting API Keys

#### **Serper API (Primary - Recommended)**
1. Visit [serper.dev](https://serper.dev)
2. Sign up and get API key
3. Add `SERPER_API_KEY` to your `.env` file

#### **Google Custom Search (Fallback)**
1. Get Google API key from [Google Cloud Console](https://console.cloud.google.com)
2. Create Custom Search Engine at [cse.google.com](https://cse.google.com)
3. Add both keys to your `.env` file

## Response Format

### Web Search Results
```json
{
  "success": true,
  "query": "2020 Toyota Camry P0301 recall",
  "total_results": 3,
  "results": [
    {
      "title": "Toyota Recalls 2020 Camry for Engine Issues",
      "url": "https://www.nhtsa.gov/recalls/...",
      "snippet": "Toyota recalls 2020 Camry vehicles due to potential engine misfiring...",
      "date": "2024-01-15",
      "source": "nhtsa.gov"
    }
  ]
}
```

### Technical Image Results  
```json
{
  "success": true,
  "query": "2020 Toyota Camry engine vacuum diagram",
  "total_results": 5,
  "results": [
    {
      "title": "2020 Camry Engine Vacuum Routing Diagram",
      "url": "https://example.com/manual-page",
      "image_url": "https://example.com/diagram.jpg",
      "thumbnail_url": "https://example.com/thumb.jpg",
      "source": "toyota.com",
      "width": 800,
      "height": 600
    }
  ]
}
```

## Frontend Integration

### Status Check Example
```javascript
// Check if web search is available
const response = await fetch('/api/responses/websearch/status');
const status = await response.json();

console.log('Web search available:', status.available);
console.log('Services:', status.services);
```

### Conversation Example
```javascript
// The AI agent will automatically use web search when appropriate
const response = await fetch('/api/responses/chat/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: "Are there any recalls for a 2020 Toyota Camry with DTC P0301?",
    vehicleContext: {
      year: "2020",
      make: "Toyota", 
      model: "Camry"
    },
    customerContext: {
      dtcCode: "P0301"
    }
  })
});

// Agent will automatically:
// 1. Use web_search tool to find current recalls
// 2. Search for P0301 specific information  
// 3. Provide up-to-date diagnostic guidance
```

## Use Cases

### 1. **Recall & TSB Search**
- Customer asks about recalls for their specific vehicle
- Agent automatically searches current NHTSA and manufacturer databases
- Provides links to official recall notices and TSBs

### 2. **Current Diagnostic Procedures**
- When standard diagnostic steps don't resolve an issue
- Agent searches for updated procedures and known fixes
- Finds recent forum discussions and technical articles

### 3. **Visual Diagnostic Aids**
- Complex electrical issues requiring wiring diagrams
- Agent searches for and presents relevant technical images
- Helps visualize component locations and connections

### 4. **Parts and Compatibility**
- Questions about part numbers and compatibility
- Agent searches current parts catalogs and availability
- Finds alternative parts and upgrade options

## Service Status and Health

### Check All Services Status
```bash
curl http://localhost:5000/api/responses/services/status
```

**Response:**
```json
{
  "mcp": {
    "connected": false,
    "serverUrl": "http://localhost:3700",
    "availableTools": 0
  },
  "webSearch": {
    "available": true,
    "services": {
      "serper": true,
      "googleSearch": true,
      "openai": true
    },
    "tools": ["web_search", "search_technical_images"]
  },
  "python": {
    "available": true,
    "outputDir": "/tmp/python_outputs"
  }
}
```

## Error Handling

### Service Degradation
- If Serper API fails, automatically falls back to Google Custom Search
- If both search services fail, agent continues without web search capabilities
- All errors are logged and handled gracefully

### Rate Limiting
- Built-in timeout protection (10 seconds per search)
- Automatic retry logic for transient failures
- Respects API rate limits and quotas

## Best Practices

### For AI Agent Usage
1. **Be Specific** - Include vehicle details in search queries
2. **Use Appropriate Search Types** - Use "recall" type for safety issues
3. **Combine with Other Tools** - Use web search + OBD2 data + Python analysis
4. **Verify Results** - Cross-reference search results with known databases

### For Frontend Integration
1. **Check Service Status** - Verify web search is available before relying on it
2. **Handle Offline Mode** - Gracefully degrade when web search unavailable  
3. **Display Source Links** - Always show users where information came from
4. **Cache Results** - Store frequently accessed information locally

## Testing the Integration

<function_calls>
<invoke name="TodoWrite">
<parameter name="todos">[{"id": "1", "content": "Analyze existing web search infrastructure", "status": "completed", "priority": "high"}, {"id": "2", "content": "Integrate web search tool into responses agent", "status": "completed", "priority": "high"}, {"id": "3", "content": "Update system prompt to include web search capabilities", "status": "completed", "priority": "medium"}, {"id": "4", "content": "Test web search integration", "status": "completed", "priority": "medium"}]