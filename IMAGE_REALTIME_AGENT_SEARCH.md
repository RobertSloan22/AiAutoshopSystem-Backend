# Image Realtime Agent Search Integration Guide

This document details how to integrate your frontend realtime agent with the backend's image search systems for images and diagrams.

## Backend Image Search Architecture

### 1. Serper Advanced Image Search (`/api/serper/images`)
**Primary endpoint for vehicle-specific technical diagrams**

#### Endpoint Details
- **URL**: `POST /api/serper/images`
- **Authentication**: Required (Bearer token)
- **Content-Type**: `application/json`

#### Request Format
```json
{
  "query": "fuel pump wiring",
  "num": 10,
  "vehicleInfo": {
    "year": 2015,
    "make": "Toyota",
    "model": "Camry",
    "engine": "2.5L 4-cylinder"
  }
}
```

#### Response Format
```json
{
  "images": [
    {
      "_id": "generated_id",
      "title": "2015 Toyota Camry Fuel Pump Wiring Diagram",
      "imageUrl": "https://example.com/image.jpg",
      "thumbnailUrl": "https://example.com/thumb.jpg",
      "source": "repairpal.com",
      "link": "https://example.com/source-page",
      "originalUrl": "https://example.com/image.jpg",
      "timestamp": "2024-01-01T00:00:00.000Z",
      "relevanceScore": 8
    }
  ],
  "metadata": {
    "originalQuery": "fuel pump wiring",
    "refinedQuery": "\"2015 Toyota Camry\" 2.5L 4-cylinder \"fuel pump wiring\" (diagram OR schematic OR \"parts diagram\" OR \"exploded view\" OR \"repair diagram\")",
    "totalResults": 45,
    "filteredResults": 12,
    "finalResults": 10
  }
}
```

#### Key Features
- **Vehicle-Specific Filtering**: Automatically filters by year, make, model, engine
- **Diagram Prioritization**: Favors technical diagrams over photos
- **Relevance Scoring**: Advanced scoring system (0-10+)
- **Image Validation**: Checks accessibility and file size
- **Database Persistence**: All results saved to database

### 2. Google Custom Search Diagrams (`/api/search/search/diagrams`)
**Alternative endpoint for general diagram searches**

#### Endpoint Details
- **URL**: `POST /api/search/search/diagrams`
- **Authentication**: Required (Bearer token)
- **Content-Type**: `application/json`

#### Request Format
```json
{
  "query": "brake system",
  "type": "diagram",
  "fileType": "jpg,png,jpeg,pdf"
}
```

#### Response Format
```json
{
  "diagrams": [
    {
      "url": "https://example.com/diagram.png",
      "title": "Brake System Diagram",
      "thumbnail": "https://example.com/thumb.png",
      "sourceUrl": "https://example.com/source",
      "fileType": "png"
    }
  ],
  "count": 5
}
```

### 3. General Image Search (`/api/serp/images`)
**Basic image search functionality**

#### Request Format
```json
{
  "query": "engine parts",
  "num": 10
}
```

## Frontend Realtime Agent Integration

### 1. Authentication Setup
```javascript
// Store JWT token from login
const authToken = localStorage.getItem('authToken');

// Headers for all API calls
const headers = {
  'Authorization': `Bearer ${authToken}`,
  'Content-Type': 'application/json'
};
```

### 2. Realtime Agent Image Search Function

```javascript
class RealtimeImageSearchAgent {
  constructor(apiBaseUrl, authToken) {
    this.apiBaseUrl = apiBaseUrl;
    this.authToken = authToken;
    this.headers = {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    };
  }

  async searchVehicleImages(query, vehicleInfo, options = {}) {
    const requestData = {
      query,
      num: options.num || 10,
      vehicleInfo: {
        year: vehicleInfo.year,
        make: vehicleInfo.make,
        model: vehicleInfo.model,
        engine: vehicleInfo.engine || null
      }
    };

    try {
      const response = await fetch(`${this.apiBaseUrl}/api/serper/images`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return this.processImageResults(data);
    } catch (error) {
      console.error('Vehicle image search failed:', error);
      return { images: [], error: error.message };
    }
  }

  async searchDiagrams(query, options = {}) {
    const requestData = {
      query,
      type: options.type || 'diagram',
      fileType: options.fileType || 'jpg,png,jpeg,pdf'
    };

    try {
      const response = await fetch(`${this.apiBaseUrl}/api/search/search/diagrams`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Diagram search failed:', error);
      return { diagrams: [], error: error.message };
    }
  }

  processImageResults(data) {
    return {
      images: data.images.map(img => ({
        id: img._id,
        url: img.imageUrl,
        thumbnail: img.thumbnailUrl,
        title: img.title,
        source: img.source,
        relevanceScore: img.relevanceScore,
        timestamp: img.timestamp
      })),
      metadata: data.metadata,
      totalResults: data.images.length
    };
  }

  // Intelligent search based on user query
  async intelligentImageSearch(userQuery, vehicleInfo = null) {
    // Detect if query is vehicle-specific
    const isVehicleQuery = vehicleInfo && (
      userQuery.toLowerCase().includes('diagram') ||
      userQuery.toLowerCase().includes('schematic') ||
      userQuery.toLowerCase().includes('wiring') ||
      userQuery.toLowerCase().includes('parts')
    );

    if (isVehicleQuery) {
      // Use advanced vehicle search
      return await this.searchVehicleImages(userQuery, vehicleInfo);
    } else {
      // Use general diagram search
      return await this.searchDiagrams(userQuery);
    }
  }
}
```

### 3. Realtime Agent Implementation Example

```javascript
// Initialize the agent
const imageSearchAgent = new RealtimeImageSearchAgent(
  'http://localhost:3000', // Your backend URL
  authToken
);

// In your realtime agent's message handler
async function handleUserMessage(message, context) {
  // Detect if user is requesting images/diagrams
  const imageRequestPattern = /(show|find|search|get).*(image|diagram|schematic|picture)/i;
  
  if (imageRequestPattern.test(message)) {
    try {
      // Extract search query
      const query = extractSearchQuery(message);
      
      // Get vehicle context if available
      const vehicleInfo = context.vehicleInfo;
      
      // Perform intelligent search
      const results = await imageSearchAgent.intelligentImageSearch(query, vehicleInfo);
      
      if (results.images && results.images.length > 0) {
        // Send images to user
        return {
          type: 'images',
          data: results.images.slice(0, 3), // Limit to top 3 results
          message: `Found ${results.totalResults} relevant images for "${query}"`
        };
      } else {
        return {
          type: 'text',
          message: `Sorry, I couldn't find any relevant images for "${query}". Try being more specific.`
        };
      }
    } catch (error) {
      return {
        type: 'error',
        message: 'Image search temporarily unavailable.'
      };
    }
  }
  
  // Handle other message types...
}

function extractSearchQuery(message) {
  // Simple extraction - you may want to make this more sophisticated
  const patterns = [
    /(?:show|find|search|get).*?(?:image|diagram|schematic|picture).*?(?:of|for)\s+(.+)/i,
    /(?:image|diagram|schematic|picture).*?(?:of|for)\s+(.+)/i,
    /(.+)\s+(?:image|diagram|schematic|picture)/i
  ];
  
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) return match[1].trim();
  }
  
  return message.replace(/(?:show|find|search|get|image|diagram|schematic|picture)/gi, '').trim();
}
```

### 4. Error Handling & Fallbacks

```javascript
async function robustImageSearch(query, vehicleInfo) {
  // Try primary endpoint first
  try {
    const results = await imageSearchAgent.searchVehicleImages(query, vehicleInfo);
    if (results.images.length > 0) return results;
  } catch (error) {
    console.warn('Primary search failed, trying fallback:', error);
  }

  // Fallback to diagram search
  try {
    const diagrams = await imageSearchAgent.searchDiagrams(query);
    return {
      images: diagrams.diagrams.map(d => ({
        url: d.url,
        thumbnail: d.thumbnail,
        title: d.title,
        source: d.sourceUrl
      }))
    };
  } catch (error) {
    console.error('All image searches failed:', error);
    return { images: [], error: 'Image search unavailable' };
  }
}
```

## Configuration Requirements

### Environment Variables (Backend)
```env
VITE_SERPER_API_KEY=your_serper_api_key
GOOGLE_API_KEY=your_google_api_key
GOOGLE_SEARCH_ENGINE_ID=your_search_engine_id
```

### Frontend Configuration
```javascript
const config = {
  apiBaseUrl: process.env.REACT_APP_API_URL || 'http://localhost:3000',
  maxImages: 10,
  timeoutMs: 15000,
  retryAttempts: 2
};
```

## Best Practices

### 1. Query Optimization
- Include vehicle-specific terms when possible
- Use technical terms like "diagram", "schematic", "wiring"
- Be specific about parts (e.g., "fuel pump relay" vs "pump")

### 2. Performance
- Limit concurrent image searches
- Implement caching for repeated queries
- Use thumbnail URLs for preview, full URLs for detailed view

### 3. User Experience
- Show loading states during search
- Provide fallback messages when no results found
- Allow users to refine searches

### 4. Error Handling
- Implement retry logic for failed requests
- Graceful degradation when APIs are unavailable
- Clear error messages for users

## Example User Interactions

1. **User**: "Show me the wiring diagram for the fuel pump"
   - **Agent**: Searches using `/api/serper/images` with vehicle context
   - **Response**: Returns 3-5 relevant fuel pump wiring diagrams

2. **User**: "I need brake system schematics"
   - **Agent**: Uses intelligent search to find brake diagrams
   - **Response**: Displays brake system diagrams and exploded views

3. **User**: "Find engine belt routing diagram"
   - **Agent**: Searches for vehicle-specific belt routing
   - **Response**: Shows serpentine belt routing diagrams

This integration provides your realtime agent with powerful image search capabilities specifically tailored for automotive technical diagrams and images.