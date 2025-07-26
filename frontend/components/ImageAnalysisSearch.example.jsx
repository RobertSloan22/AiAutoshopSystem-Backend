import React from 'react';
import ImageAnalysisSearch from './ImageAnalysisSearch';

// Example usage component
const ImageAnalysisSearchExample = () => {
  const handleAnalysisSelect = (analysis) => {
    console.log('Selected analysis:', analysis);
    
    // Example: Open analysis in a new tab/modal
    // or navigate to analysis detail page
    // or use the analysis data in your application
  };

  const currentUserId = 'user123'; // Get from auth context

  return (
    <div>
      <h1>Image Analysis Search Demo</h1>
      
      <ImageAnalysisSearch 
        userId={currentUserId}
        onAnalysisSelect={handleAnalysisSelect}
      />
      
      {/* Example integration scenarios: */}
      
      {/* 1. As part of a dashboard */}
      <div style={{ marginTop: '40px' }}>
        <h2>Dashboard Integration</h2>
        <p>This component can be embedded in your main dashboard:</p>
        <div style={{ border: '1px solid #ddd', padding: '20px', borderRadius: '8px' }}>
          <ImageAnalysisSearch 
            userId={currentUserId}
            onAnalysisSelect={(analysis) => {
              // Handle selection in dashboard context
              window.location.href = `/analysis/${analysis.id}`;
            }}
          />
        </div>
      </div>

      {/* 2. As a standalone search page */}
      <div style={{ marginTop: '40px' }}>
        <h2>Standalone Search Page</h2>
        <p>Use as a dedicated search interface with full functionality.</p>
      </div>

      {/* 3. Integration with other components */}
      <div style={{ marginTop: '40px' }}>
        <h2>Integration Examples</h2>
        <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px' }}>
          <h3>Common Integration Patterns:</h3>
          <ul>
            <li>Embed in vehicle diagnostic dashboard</li>
            <li>Use in technician workflow tools</li>
            <li>Integrate with customer service interfaces</li>
            <li>Add to report generation systems</li>
            <li>Connect to inventory management</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ImageAnalysisSearchExample;