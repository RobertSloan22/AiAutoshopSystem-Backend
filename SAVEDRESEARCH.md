# Saved Research Frontend Integration Guide

This guide explains how to integrate the saved research functionality into your frontend application.

## API Client Setup

Add these methods to your API client file (e.g., `api.js` or `researchService.js`):

```javascript
// Research results API methods
export const getResearchResults = async (params = {}) => {
  const queryString = new URLSearchParams(params).toString();
  const response = await fetch(`/api/research-results?${queryString}`);
  return response.json();
};

export const getResearchResultById = async (id) => {
  const response = await fetch(`/api/research-results/${id}`);
  return response.json();
};

export const searchResearchResults = async (query, limit = 10) => {
  const response = await fetch(`/api/research-results/search?query=${encodeURIComponent(query)}&limit=${limit}`);
  return response.json();
};

export const updateResearchResult = async (id, data) => {
  const response = await fetch(`/api/research-results/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  return response.json();
};

export const deleteResearchResult = async (id) => {
  const response = await fetch(`/api/research-results/${id}`, {
    method: 'DELETE',
  });
  return response.json();
};
```

## Update Research Component

Modify your research component to save the returned ID:

```javascript
// When receiving results from research API
const handleResearchSubmit = async (query) => {
  setLoading(true);
  try {
    const result = await performResearch(query);
    setResearchResult(result);
    
    // Store the saved research ID if available
    if (result.savedResearchId) {
      // Save this ID for later reference
      setCurrentResearchId(result.savedResearchId);
    }
  } catch (error) {
    console.error("Research failed:", error);
    setError("Research failed. Please try again.");
  } finally {
    setLoading(false);
  }
};
```

## Research History Component

Add a component to display research history:

```jsx
function ResearchHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  useEffect(() => {
    async function fetchHistory() {
      try {
        const response = await getResearchResults({
          page,
          limit: 10,
          // Add any filters you want
        });
        
        setHistory(response.data);
        setTotalPages(response.pagination.pages);
      } catch (error) {
        console.error("Failed to fetch research history:", error);
      } finally {
        setLoading(false);
      }
    }
    
    fetchHistory();
  }, [page]);
  
  const navigateToDetail = (id) => {
    // Navigate to detail page using your router
    // e.g., navigate(`/research/${id}`);
  };
  
  return (
    <div className="research-history">
      <h2>Recent Research</h2>
      {loading ? (
        <p>Loading history...</p>
      ) : (
        <>
          <ul className="research-list">
            {history.map(item => (
              <li key={item._id} className="research-item">
                <h3>{item.query}</h3>
                <p>Date: {new Date(item.createdAt).toLocaleString()}</p>
                <div className="tags">
                  {item.tags.map(tag => (
                    <span key={tag} className="tag">{tag}</span>
                  ))}
                </div>
                <button 
                  onClick={() => navigateToDetail(item._id)}
                  className="view-button"
                >
                  View Details
                </button>
              </li>
            ))}
          </ul>
          
          {/* Pagination controls */}
          <div className="pagination">
            <button 
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </button>
            <span>Page {page} of {totalPages}</span>
            <button 
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
```

## Research Detail Component

Add a component to display a specific research result:

```jsx
function ResearchDetail({ id }) {
  const [research, setResearch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [tags, setTags] = useState([]);
  
  useEffect(() => {
    async function fetchResearch() {
      try {
        const response = await getResearchResultById(id);
        setResearch(response.data);
        setTags(response.data.tags || []);
      } catch (error) {
        console.error("Failed to fetch research:", error);
      } finally {
        setLoading(false);
      }
    }
    
    if (id) {
      fetchResearch();
    }
  }, [id]);
  
  const handleSaveTags = async () => {
    try {
      await updateResearchResult(id, { tags });
      setEditing(false);
    } catch (error) {
      console.error("Failed to update tags:", error);
    }
  };
  
  const handleDelete = async () => {
    if (confirm("Are you sure you want to delete this research?")) {
      try {
        await deleteResearchResult(id);
        // Navigate back to history
        // e.g., navigate('/research/history');
      } catch (error) {
        console.error("Failed to delete research:", error);
      }
    }
  };
  
  if (loading) return <p>Loading research...</p>;
  if (!research) return <p>Research not found</p>;
  
  return (
    <div className="research-detail">
      <h2>Research: {research.query}</h2>
      <p>Date: {new Date(research.createdAt).toLocaleString()}</p>
      
      {/* Tags section */}
      <div className="tags-section">
        <h3>Tags</h3>
        {editing ? (
          <div className="tag-editor">
            <input 
              type="text" 
              value={tags.join(', ')}
              onChange={e => setTags(e.target.value.split(',').map(tag => tag.trim()))}
              placeholder="Enter tags separated by commas"
            />
            <button onClick={handleSaveTags}>Save</button>
            <button onClick={() => setEditing(false)}>Cancel</button>
          </div>
        ) : (
          <>
            <div className="tags">
              {research.tags.map(tag => (
                <span key={tag} className="tag">{tag}</span>
              ))}
            </div>
            <button onClick={() => setEditing(true)}>Edit Tags</button>
          </>
        )}
      </div>
      
      {/* Display the research result using your existing result components */}
      <div className="research-content">
        <ResearchResultDisplay result={research.result} />
      </div>
      
      {/* Actions */}
      <div className="actions">
        <button onClick={handleDelete} className="delete-button">
          Delete Research
        </button>
      </div>
    </div>
  );
}
```

## Research Search Component

Add a component to search for research:

```jsx
function ResearchSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query) return;
    
    setLoading(true);
    try {
      const response = await searchResearchResults(query);
      setResults(response.data);
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setLoading(false);
    }
  };
  
  const navigateToDetail = (id) => {
    // Navigate to detail page using your router
    // e.g., navigate(`/research/${id}`);
  };
  
  return (
    <div className="research-search">
      <h2>Search Research</h2>
      
      <form onSubmit={handleSearch}>
        <input 
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search for past research"
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>
      
      {results.length > 0 ? (
        <ul className="search-results">
          {results.map(item => (
            <li key={item._id} className="search-result">
              <h3>{item.query}</h3>
              <p>Date: {new Date(item.createdAt).toLocaleString()}</p>
              <button onClick={() => navigateToDetail(item._id)}>
                View Details
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p>{loading ? 'Searching...' : 'No results found'}</p>
      )}
    </div>
  );
}
```

## Update Routes

Update your routing configuration to include the new views:

```jsx
// In your routing setup (React Router example)
<Routes>
  {/* Existing routes */}
  <Route path="/research" element={<ResearchPage />} />
  
  {/* New routes */}
  <Route path="/research/history" element={<ResearchHistory />} />
  <Route path="/research/:id" element={<ResearchDetail />} />
  <Route path="/research/search" element={<ResearchSearch />} />
</Routes>
```

## Add Navigation

Add navigation links to your research pages:

```jsx
<nav className="research-nav">
  <ul>
    <li><Link to="/research">New Research</Link></li>
    <li><Link to="/research/history">Research History</Link></li>
    <li><Link to="/research/search">Search Research</Link></li>
  </ul>
</nav>
```

## Add CSS Styles

Add styles for the new components (example):

```css
.research-list {
  list-style: none;
  padding: 0;
}

.research-item {
  border: 1px solid #ddd;
  padding: 15px;
  margin-bottom: 15px;
  border-radius: 5px;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin: 10px 0;
}

.tag {
  background-color: #e0e0e0;
  padding: 3px 8px;
  border-radius: 3px;
  font-size: 0.8rem;
}

.view-button {
  background-color: #007bff;
  color: white;
  border: none;
  padding: 5px 10px;
  border-radius: 3px;
  cursor: pointer;
}

.delete-button {
  background-color: #dc3545;
  color: white;
  border: none;
  padding: 5px 10px;
  border-radius: 3px;
  cursor: pointer;
  margin-top: 20px;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  margin-top: 20px;
}

.research-nav ul {
  display: flex;
  list-style: none;
  padding: 0;
  gap: 20px;
}

.research-nav a {
  text-decoration: none;
  color: #007bff;
  font-weight: bold;
}
```

This guide provides all the components and configurations needed to integrate saved research functionality into your frontend. Adjust the styling and component structure to match your application's design system.