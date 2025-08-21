# Dual Image Serving Implementation

## Overview

Your system now supports **both** base64 embedded images AND API-served images, giving you maximum flexibility for different use cases:

- **Base64 embedding** for immediate rendering (no additional requests)
- **API serving** for better performance, caching, and bandwidth efficiency

## Backend Implementation

### New API Endpoints

#### **GET** `/api/images/charts/:imageId`
Serves the full-resolution chart image.

```bash
curl http://localhost:5000/api/images/charts/abc123-def456-ghi789
```

**Query Parameters:**
- `download=true` - Forces download instead of inline display
- `format=png` - Image format (future use)
- `quality=high` - Quality setting (future use)

#### **GET** `/api/images/charts/:imageId/thumbnail`
Serves a thumbnail version (currently same as full image).

#### **GET** `/api/images/charts/:imageId/info`
Returns metadata about the image.

```json
{
  "id": "abc123-def456-ghi789",
  "filename": "engine_performance_chart.png",
  "mimeType": "image/png",
  "size": 156789,
  "createdAt": "2024-01-10T12:00:00.000Z",
  "executionId": "exec_123456",
  "description": "Engine performance analysis chart",
  "tags": ["python", "engine", "performance"]
}
```

#### **GET** `/api/images/charts`
Lists all available chart images with pagination and filtering.

```bash
# List all images
curl http://localhost:5000/api/images/charts

# Filter by execution ID
curl http://localhost:5000/api/images/charts?maf_sensor_wavform.png

# Filter by tag
curl http://localhost:5000/api/images/charts?tag=engine

# Pagination
curl http://localhost:5000/api/images/charts?limit=10&offset=20
```

#### **DELETE** `/api/images/charts/:imageId`
Deletes a specific image and its metadata.

#### **DELETE** `/api/images/charts` (Bulk Delete)
Bulk delete images by various criteria.

```json
{
  "imageIds": ["id1", "id2", "id3"],
  // OR
  "executionId": "exec_123456",
  // OR  
  "olderThan": "2024-01-09T00:00:00.000Z"
}
```

### Response Format

Python execution now returns **both** formats:

```json
{
  "success": true,
  "output": "Chart generated successfully",
  "plots": [
    {
      "path": "/tmp/python_outputs/chart_123.png",
      "imageId": "abc123-def456-ghi789",
      "url": "/api/images/charts/abc123-def456-ghi789",
      "thumbnailUrl": "/api/images/charts/abc123-def456-ghi789/thumbnail",
      "data": "data:image/png;base64,iVBORw0KGgoAAAANS..." // Full base64 for immediate use
    }
  ]
}
```

## Frontend Integration

### Option 1: Use Base64 for Immediate Rendering

```jsx
const ChartDisplay = ({ charts }) => {
  return (
    <div className="charts-container">
      {charts.map((chart, index) => (
        <div key={index} className="chart-item">
          {/* Immediate rendering with base64 */}
          <img 
            src={chart.data} 
            alt={`Chart ${index + 1}`}
            className="chart-image"
          />
          
          {/* Optional: Show API URL for sharing */}
          <div className="chart-actions">
            <button 
              onClick={() => window.open(chart.url, '_blank')}
              className="view-full-button"
            >
              View Full Size
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
```

### Option 2: Use API URLs for Better Performance

```jsx
const ChartDisplay = ({ charts }) => {
  return (
    <div className="charts-container">
      {charts.map((chart, index) => (
        <div key={index} className="chart-item">
          {/* Load via API with proper caching */}
          <img 
            src={chart.url} 
            alt={`Chart ${index + 1}`}
            loading="lazy"
            className="chart-image"
            onError={(e) => {
              // Fallback to base64 if API fails
              if (chart.data) {
                e.target.src = chart.data;
              }
            }}
          />
          
          <div className="chart-actions">
            <a 
              href={`${chart.url}?download=true`}
              download
              className="download-button"
            >
              Download
            </a>
          </div>
        </div>
      ))}
    </div>
  );
};
```

### Option 3: Progressive Enhancement

```jsx
import React, { useState, useEffect } from 'react';

const ProgressiveChart = ({ chart }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [useAPI, setUseAPI] = useState(true);

  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  const handleImageError = () => {
    // Fallback to base64 if API serving fails
    setUseAPI(false);
  };

  return (
    <div className="progressive-chart">
      {/* Show base64 immediately if available */}
      {!imageLoaded && chart.data && (
        <img 
          src={chart.data} 
          alt="Chart preview"
          className="chart-preview"
          style={{ filter: 'blur(2px)', opacity: 0.7 }}
        />
      )}
      
      {/* Load high-quality version via API */}
      <img 
        src={useAPI ? chart.url : chart.data}
        alt="Chart"
        className={`chart-main ${imageLoaded ? 'loaded' : 'loading'}`}
        onLoad={handleImageLoad}
        onError={handleImageError}
        loading="lazy"
      />
      
      <div className="chart-metadata">
        <small>ID: {chart.imageId}</small>
        <a href={chart.url} target="_blank" rel="noopener noreferrer">
          Open in new tab
        </a>
      </div>
    </div>
  );
};
```

### Advanced: Chart Gallery with API Integration

```jsx
import React, { useState, useEffect } from 'react';

const ChartGallery = ({ executionId }) => {
  const [charts, setCharts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadCharts();
  }, [executionId, filter]);

  const loadCharts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (executionId) params.set('executionId', executionId);
      if (filter !== 'all') params.set('tag', filter);
      
      const response = await fetch(`/api/images/charts?${params}`);
      const data = await response.json();
      setCharts(data.images);
    } catch (error) {
      console.error('Failed to load charts:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteChart = async (imageId) => {
    try {
      await fetch(`/api/images/charts/${imageId}`, {
        method: 'DELETE'
      });
      setCharts(charts.filter(chart => chart.id !== imageId));
    } catch (error) {
      console.error('Failed to delete chart:', error);
    }
  };

  const bulkDelete = async () => {
    try {
      const imageIds = charts.map(chart => chart.id);
      await fetch('/api/images/charts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageIds })
      });
      setCharts([]);
    } catch (error) {
      console.error('Failed to bulk delete:', error);
    }
  };

  return (
    <div className="chart-gallery">
      <div className="gallery-controls">
        <select 
          value={filter} 
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All Charts</option>
          <option value="python">Python Generated</option>
          <option value="engine">Engine Analysis</option>
          <option value="performance">Performance</option>
        </select>
        
        <button onClick={loadCharts} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
        
        <button onClick={bulkDelete} className="danger">
          Delete All
        </button>
      </div>

      <div className="charts-grid">
        {charts.map(chart => (
          <div key={chart.id} className="chart-card">
            <img 
              src={chart.url}
              alt={chart.filename}
              loading="lazy"
            />
            <div className="chart-info">
              <h4>{chart.filename}</h4>
              <p>{chart.description}</p>
              <small>{new Date(chart.createdAt).toLocaleString()}</small>
              
              <div className="chart-tags">
                {chart.tags.map(tag => (
                  <span key={tag} className="tag">{tag}</span>
                ))}
              </div>
              
              <div className="chart-actions">
                <a href={chart.url} target="_blank">View</a>
                <a href={`${chart.url}?download=true`} download>Download</a>
                <button 
                  onClick={() => deleteChart(chart.id)}
                  className="danger"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
```

## Benefits of Dual Implementation

### Base64 Embedding
✅ **Immediate rendering** - No additional HTTP requests  
✅ **Works offline** - Embedded in response  
✅ **Simple implementation** - Direct img src usage  
✅ **Guaranteed availability** - No 404 errors  

❌ **Large response size** - Increases bandwidth  
❌ **No caching** - Re-sent with every response  
❌ **Memory intensive** - Stored in memory  

### API Serving
✅ **Better performance** - Smaller JSON responses  
✅ **HTTP caching** - Browser and CDN cacheable  
✅ **Shareable URLs** - Can link directly to images  
✅ **Scalable** - Separate from API responses  
✅ **Bandwidth efficient** - Only load when needed  

❌ **Additional requests** - Requires separate HTTP calls  
❌ **Potential 404s** - Images might be cleaned up  
❌ **Complex implementation** - More error handling needed  

## Best Practices

### 1. Use Appropriate Method by Context

```jsx
// For immediate display (chat messages)
<img src={chart.data} alt="Chart" />

// For galleries and persistent views  
<img src={chart.url} alt="Chart" loading="lazy" />
```

### 2. Implement Graceful Fallbacks

```jsx
const ChartImage = ({ chart }) => (
  <img 
    src={chart.url}
    alt="Chart"
    onError={(e) => {
      if (chart.data && e.target.src !== chart.data) {
        e.target.src = chart.data;
      }
    }}
  />
);
```

### 3. Optimize for Your Use Case

- **Real-time chat**: Use base64 for immediate rendering
- **Gallery views**: Use API URLs with lazy loading
- **Sharing**: Always use API URLs
- **Mobile apps**: Consider API URLs to reduce memory usage

### 4. Implement Proper Error Handling

```jsx
const [imageStatus, setImageStatus] = useState('loading');

<img 
  src={chart.url}
  onLoad={() => setImageStatus('loaded')}
  onError={() => {
    setImageStatus('error');
    // Try fallback or show error message
  }}
/>
```

### 5. Cache Management

```jsx
// Preload important images
const preloadCharts = (charts) => {
  charts.forEach(chart => {
    const img = new Image();
    img.src = chart.url;
  });
};
```

## Production Considerations

1. **Image Cleanup**: Set up automatic cleanup of old images
2. **Rate Limiting**: Implement rate limiting for image API endpoints
3. **Authentication**: Add auth to image endpoints if needed
4. **CDN Integration**: Serve images through a CDN for better performance
5. **Monitoring**: Monitor image storage usage and API performance
6. **Backup**: Consider backing up important charts

## Environment Variables

Add these to your `.env` file:

```env
# Image serving configuration
IMAGE_CLEANUP_INTERVAL=3600000  # 1 hour in milliseconds
IMAGE_MAX_AGE=86400000          # 24 hours in milliseconds
IMAGE_CACHE_CONTROL=3600        # 1 hour cache control
```

This dual implementation gives you the best of both worlds - immediate rendering when needed and efficient serving for performance-critical scenarios.