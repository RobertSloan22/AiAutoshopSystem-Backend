# Image Analysis Search Frontend Components

This directory contains comprehensive frontend components for searching and retrieving stored image analysis data from the automotive AI system.

## Components Overview

### 1. ImageAnalysisSearch.jsx
Main search component that provides full access to all stored image analysis data with the following features:

#### Search Modes
- **By Conversation ID**: Find all analyses within a specific conversation thread
- **By Image URL**: Locate analyses for a specific image (with optional prompt filtering)
- **Annotated Analyses**: Search for annotated follow-up analyses linked to original conversations

#### Key Features
- ✅ Real-time search with loading states
- ✅ Advanced filtering (date range, analysis type, sorting)
- ✅ Result preview with thumbnails and metadata
- ✅ Detailed analysis modal viewer
- ✅ Delete functionality with confirmation
- ✅ Responsive design for mobile/desktop
- ✅ Error handling and user feedback
- ✅ Pagination support for large result sets

#### Search Parameters
- `userId` - Filter by user ownership
- `conversationId` - Target specific conversation
- `imageUrl` - Find analyses for specific image
- `prompt` - Match exact prompt text
- `limit` - Control number of results (max 50)
- `analysisType` - Filter by regular/annotated/batch
- `dateRange` - Time-based filtering
- `sortBy` - newest/oldest ordering

### 2. ImageAnalysisSearch.example.jsx
Usage examples and integration patterns showing how to embed the search component in different contexts:

- Dashboard integration
- Standalone search page
- Workflow tool integration
- Customer service interfaces

### 3. imageAnalysisAPI.js
Comprehensive API utility library providing:

#### Core Search Functions
```javascript
// Search by conversation
const result = await ImageAnalysisAPI.searchByConversation('conv-123', { userId: 'user456' });

// Search by image
const result = await ImageAnalysisAPI.searchByImage('data:image/jpeg;base64,...', { prompt: 'engine analysis' });

// Search annotated analyses
const result = await ImageAnalysisAPI.searchAnnotated('original-conv-123', { limit: 20 });

// Advanced search with filters
const result = await ImageAnalysisAPI.advancedSearch({
  searchType: 'conversation',
  query: 'conv-123',
  analysisType: 'annotated',
  dateRange: { start: '2024-01-01', end: '2024-12-31' },
  sortBy: 'newest'
});
```

#### Data Management Functions
```javascript
// Delete analysis
await ImageAnalysisAPI.deleteAnalysis('analysis-123', { userId: 'user456', isAnnotated: true });

// Batch operations
await ImageAnalysisAPI.batchOperation(['id1', 'id2'], 'delete', { userId: 'user456' });

// Export data
await ImageAnalysisAPI.exportAnalyses(analyses, 'json'); // or 'csv'
```

#### Utility Functions
```javascript
// Format dates
AnalysisUtils.formatDate('2024-01-15T10:30:00Z');

// Get analysis type badges
AnalysisUtils.getAnalysisTypeBadge(analysis);

// Validate inputs
AnalysisUtils.isValidConversationId('conv-123');
AnalysisUtils.isValidImageUrl('data:image/jpeg;base64,...');

// Text utilities
AnalysisUtils.truncateText(longText, 100);
AnalysisUtils.getRelativeTime('2024-01-15T10:30:00Z');
```

## API Endpoints Used

The components interface with these backend endpoints:

1. `GET /api/openai/image-analysis/:conversationId` - Search by conversation
2. `GET /api/openai/image-analysis/by-image` - Search by image URL
3. `GET /api/openai/annotated-analyses/:originalConversationId` - Search annotated analyses
4. `DELETE /api/openai/annotated-analysis/:analysisId` - Delete annotated analysis

## Installation & Usage

### Prerequisites
```bash
npm install lucide-react  # For icons
```

### Basic Usage
```jsx
import ImageAnalysisSearch from './components/ImageAnalysisSearch';

function App() {
  const handleAnalysisSelect = (analysis) => {
    console.log('Selected:', analysis);
    // Handle analysis selection
  };

  return (
    <ImageAnalysisSearch 
      userId="current-user-id"
      onAnalysisSelect={handleAnalysisSelect}
    />
  );
}
```

### Advanced Usage with API Helper
```jsx
import ImageAnalysisAPI, { AnalysisUtils } from './utils/imageAnalysisAPI';

// Custom search logic
const performCustomSearch = async () => {
  const result = await ImageAnalysisAPI.advancedSearch({
    searchType: 'conversation',
    query: conversationId,
    analysisType: 'annotated',
    dateRange: { start: '2024-01-01' },
    sortBy: 'newest',
    limit: 25
  });

  if (result.success) {
    setAnalyses(result.data);
  } else {
    setError(result.error);
  }
};

// Export functionality
const exportResults = async (format) => {
  const result = await ImageAnalysisAPI.exportAnalyses(analyses, format);
  if (result.success) {
    alert('Export completed!');
  }
};
```

## Data Structure

### Analysis Object Format
```javascript
{
  id: "analysis-123",
  imageUrl: "data:image/jpeg;base64,/9j/4AAQ...",
  prompt: "Analyze this engine component",
  explanation: "This image shows a damaged cylinder head...",
  responseId: "response-456",
  conversationId: "conv-789",
  createdAt: "2024-01-15T10:30:00Z",
  metadata: {
    model: "gpt-4o",
    timestamp: "2024-01-15T10:30:00Z",
    type: "annotated_analysis",
    originalConversationId: "original-conv-123",
    imageCount: 1
  }
}
```

## Styling & Customization

The components use CSS-in-JS styling that can be customized by:

1. Modifying the `<style jsx>` blocks within components
2. Overriding CSS classes in your application
3. Using CSS custom properties for theme colors
4. Responsive breakpoints for mobile optimization

## Error Handling

All components include comprehensive error handling:

- Network request failures
- Invalid search parameters
- API rate limiting
- Authentication issues
- Data validation errors

## Performance Considerations

- Results are paginated to prevent large data loads
- Images use lazy loading and compression
- Search queries are debounced to reduce API calls
- Client-side filtering for immediate response
- Efficient re-rendering with React hooks

## Integration Examples

### In a Diagnostic Dashboard
```jsx
<div className="dashboard-grid">
  <div className="search-panel">
    <ImageAnalysisSearch 
      userId={user.id}
      onAnalysisSelect={(analysis) => {
        setActiveAnalysis(analysis);
        openDetailPanel();
      }}
    />
  </div>
  <div className="detail-panel">
    {activeAnalysis && <AnalysisDetailView analysis={activeAnalysis} />}
  </div>
</div>
```

### As a Modal Search
```jsx
<Modal isOpen={showSearch}>
  <ImageAnalysisSearch 
    userId={user.id}
    onAnalysisSelect={(analysis) => {
      setSelectedAnalysis(analysis);
      setShowSearch(false);
    }}
  />
</Modal>
```

## Future Enhancements

Potential improvements for the components:

- Real-time updates via WebSocket
- Bulk export to PDF format
- Advanced text search within analyses
- Tagging and categorization
- Sharing and collaboration features
- Integration with external systems
- Offline capability with service workers

## Support

For issues or feature requests related to these components, please refer to the main project documentation or contact the development team.