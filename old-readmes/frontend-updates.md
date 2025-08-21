# Frontend Updates for Research API

The backend has been updated with enhanced research result handling. Here are the changes you should make to your frontend code:

## 1. Adjust `getFullResult` method in the ApiClient

Update your `getFullResult` method in the ResearchBot component to better handle the updated backend:

```typescript
async getFullResult(researchId: string) {
  try {
    // First, try the direct approach
    const response = await axiosInstance.get(`/api/research-results/${researchId}`);
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('Invalid response format from research API');
  } catch (error) {
    console.error('Direct ID lookup failed:', error);
    
    // If the direct approach fails and it looks like a UUID, try the new specialized endpoints
    if (researchId.includes('-')) {
      console.log('Trying specialized lookup methods for UUID:', researchId);
      
      // Try the by-research-id endpoint
      try {
        const searchResponse = await axiosInstance.get(`/api/research-results/by-research-id/${researchId}`);
        if (searchResponse.data.success && searchResponse.data.data) {
          return searchResponse.data.data;
        }
      } catch (searchError) {
        console.warn('Research ID lookup failed:', searchError);
      }
      
      // Try the by-uuid endpoint
      try {
        const uuidResponse = await axiosInstance.get(`/api/research-results/by-uuid/${researchId}`);
        if (uuidResponse.data.success && uuidResponse.data.data) {
          return uuidResponse.data.data;
        }
      } catch (uuidError) {
        console.warn('UUID lookup failed:', uuidError);
      }
      
      // Try the by-trace-id endpoint
      try {
        const traceResponse = await axiosInstance.get(`/api/research-results/by-trace-id/${researchId}`);
        if (traceResponse.data.success && traceResponse.data.data) {
          return traceResponse.data.data;
        }
      } catch (traceError) {
        console.warn('Trace ID lookup failed:', traceError);
      }
    }
    
    // Fall back to search as a last resort
    try {
      const listResponse = await axiosInstance.get(`/api/research-results/search?query=${encodeURIComponent(researchId)}`);
      if (listResponse.data.success && listResponse.data.data && listResponse.data.data.length > 0) {
        // Look for exact match first
        const exactMatch = listResponse.data.data.find(item => 
          item.researchId === researchId || 
          item.uuid === researchId ||
          item.traceId === researchId
        );
        
        if (exactMatch) {
          return exactMatch;
        }
        
        // If no exact match, return the first result
        return listResponse.data.data[0];
      }
    } catch (listError) {
      console.warn('List search failed:', listError);
    }
    
    throw error;
  }
}
```

## 2. Update the startResearch method to include vehicle and DTC information

```typescript
async startResearch(query: string) {
  const payload = {
    query: query.trim(),
    vehicle: selectedVehicle ? {
      year: selectedVehicle.year,
      make: selectedVehicle.make,
      model: selectedVehicle.model,
      vin: selectedVehicle.vin,
      engine: selectedVehicle.engine,
      transmission: selectedVehicle.transmission
    } : undefined,
    dtcCode: dtcCode || undefined,
    useMultiAgent: useMultiAgentMode,
    // Add these if you want to store them for cross-referencing
    uuid: crypto.randomUUID(), // Generate a client-side UUID for tracking
    sessionId: localStorage.getItem('sessionId') || undefined
  };
  
  console.log('Starting research with payload:', payload);
  
  try {
    // Rest of your existing code...
  } catch (error) {
    // Error handling...
  }
}
```

## 3. Update the extractResearchResult function to handle our new formatted response

```typescript
const extractResearchResult = (data: any, originalQuery: string): ResearchResult => {
  // If the response has our new formatted structure with reportSections
  if (data.fullMarkdown) {
    return {
      markdownReport: data.fullMarkdown,
      shortSummary: data.summary || originalQuery,
      followUpQuestions: data.followUpQuestions || [],
      searchPlan: data.searchPlan,
      searchResults: data.searchResults,
      reportSections: data.reportSections,
      ...data // Include all original data for debugging
    };
  }
  
  // Fall back to the existing extraction method for backward compatibility
  const possibleContent = [
    data.result?.finalReport,
    data.result?.markdownReport,
    data.result?.content,
    data.result?.report?.markdownReport,
    data.result?.report?.content,
    data.markdownReport,
    data.content,
    data.finalReport
  ];
  
  const possibleSummary = [
    data.result?.summary,
    data.result?.shortSummary,
    data.result?.report?.shortSummary,
    data.summary,
    data.shortSummary,
    originalQuery
  ];
  
  const possibleQuestions = [
    data.result?.followUpQuestions,
    data.result?.report?.followUpQuestions,
    data.followUpQuestions,
    data.questions
  ];
  
  // Find first valid content
  const markdownReport = possibleContent.find(content => 
    typeof content === 'string' && content.trim().length > 0
  ) || JSON.stringify(data.result || data, null, 2);
  
  const shortSummary = possibleSummary.find(summary => 
    typeof summary === 'string' && summary.trim().length > 0
  ) || 'Research Results';
  
  const followUpQuestions = possibleQuestions.find(questions => 
    Array.isArray(questions) && questions.length > 0
  ) || [];
  
  return {
    markdownReport,
    shortSummary,
    followUpQuestions,
    ...data // Include all original data for debugging
  };
};
```

## 4. Update the ResearchResults component to render sections if available

Enhance your ResearchResults component to take advantage of the new structured data:

```tsx
{showFullReport && (
  <div className="p-6">
    {result.reportSections ? (
      // Render structured sections if available
      <div className="space-y-8">
        {result.reportSections.map((section, index) => (
          <div key={index} className={`section level-${section.level}`} id={section.id}>
            {section.level === 1 ? (
              <h1 className="text-3xl font-bold text-white mb-6 mt-8 border-b border-blue-500/30 pb-3">
                {section.title}
              </h1>
            ) : (
              <h2 className="text-2xl font-semibold text-blue-200 mb-4 mt-8">
                {section.title}
              </h2>
            )}
            <div className="section-body text-white mb-4 leading-relaxed">
              {section.content}
            </div>
          </div>
        ))}
      </div>
    ) : (
      // Fall back to full markdown rendering
      <div className="prose prose-blue max-w-none">
        <ReactMarkdown
          components={markdownComponents}
          className="research-content"
        >
          {result.markdownReport}
        </ReactMarkdown>
      </div>
    )}
  </div>
)}
```

## 5. Add a format parameter when fetching research results lists

When retrieving lists of research results:

```typescript
async getSavedResearch(page = 1, limit = 10) {
  try {
    const response = await axiosInstance.get(`/api/research-results?page=${page}&limit=${limit}&format=summary`);
    if (response.data.success) {
      return response.data.data || [];
    }
    throw new Error('Failed to fetch saved research');
  } catch (error) {
    console.error('Error fetching saved research:', error);
    return [];
  }
}
```

## 6. Update searchSavedResearch to use the format parameter

```typescript
async searchSavedResearch(searchTerm: string) {
  try {
    const response = await axiosInstance.get(`/api/research-results/search?query=${encodeURIComponent(searchTerm)}&format=summary`);
    if (response.data.success) {
      return response.data.data || [];
    }
    throw new Error('Search failed');
  } catch (error) {
    console.error('Error searching saved research:', error);
    return [];
  }
}
```

By implementing these changes, your frontend will work seamlessly with the enhanced backend API and take advantage of the new structured data format.