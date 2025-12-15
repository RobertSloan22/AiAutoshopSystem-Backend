# 🔍 Web Search Integration for Auto Parts Pricing & Availability

This system provides real-time web search capabilities for automotive parts pricing and availability through OpenAI's native web search tool.

## 🚀 Features

- **Real-time Parts Pricing** - Current prices from major auto parts retailers
- **Availability Checking** - Live stock information across multiple stores
- **Retailer Comparison** - Automatic price comparison from AutoZone, Advance Auto Parts, O'Reilly's, etc.
- **Structured Data** - Enhanced API responses with parsed pricing, citations, and retailer info
- **Dynamic Frontend** - React components for rich, interactive parts catalogs

## 📋 API Endpoints

### Primary Endpoint: `/api/responses/turn_response`
Enhanced OpenAI Responses API endpoint with web search capabilities.

**Request:**
```json
{
  "messages": [
    {
      "role": "user", 
      "content": "Find brake pad prices for 2020 Toyota Camry"
    }
  ],
  "tools": [
    { "type": "web_search" }
  ]
}
```

**Enhanced Response Structure:**
```json
{
  "output_text": "Traditional text response...",
  "parsed_data": {
    "web_searches": [
      {
        "id": "ws_123456789",
        "status": "completed"
      }
    ],
    "citations": [
      {
        "url": "https://www.autozone.com/brakes/brake-pads/toyota/camry/2020",
        "title": "2020 Toyota Camry Brake Pads - AutoZone",
        "retailer": "AutoZone",
        "text_snippet": "Duralast Gold Brake Pads - $67.99-$89.99"
      }
    ],
    "parts_pricing": [
      {
        "part_name": "Duralast Gold Brake Pads",
        "price_info": {
          "raw": "$67.99-$89.99",
          "min": 67.99,
          "max": 89.99,
          "range": true
        },
        "brand": "Duralast",
        "category": "brake"
      }
    ],
    "retailers": [
      {
        "name": "AutoZone",
        "citations": 2
      }
    ]
  }
}
```

### Additional Endpoints:
- `/api/responses/chat` - Non-streaming chat with web search
- `/api/responses/chat/stream` - Streaming chat with web search
- `/api/responses/chat/analyze` - Analysis with visualization support

## 🛠️ Setup & Configuration

### Environment Variables
No additional API keys required! Uses OpenAI's built-in web search tool.

```bash
# Required (already configured)
OPENAI_API_KEY=your_openai_api_key_here

# Optional legacy keys (for fallback WebSearchService)
SERPER_API_KEY=your_serper_api_key_here
GOOGLE_API_KEY=your_google_api_key_here
GOOGLE_SEARCH_ENGINE_ID=your_search_engine_id_here
```

### Installation
```bash
# Backend is already configured
# No additional setup required

# For frontend components
cd frontend-app
npm install lucide-react
# Install your preferred UI library (shadcn/ui, etc.)
```

## 🎯 Usage Examples

### Basic Parts Search
```javascript
const response = await fetch('/api/responses/turn_response', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [{
      role: 'user',
      content: 'Find oil filter prices for 2019 Honda Civic'
    }],
    tools: [{ type: 'web_search' }]
  })
});

const data = await response.json();
console.log(data.parsed_data.parts_pricing);
```

### Vehicle-Specific Queries
```javascript
const queries = [
  "2020 Toyota Camry brake pad pricing",
  "Ford F150 2018 oil change parts cost", 
  "BMW X5 headlight replacement price comparison",
  "Honda Civic 2021 air filter availability"
];
```

## 🎨 Frontend Integration

### React Component
Located at: `frontend-app/PartsSearchResults.jsx`

```jsx
import PartsSearchResults from './PartsSearchResults';

function App() {
  const [searchResults, setSearchResults] = useState(null);
  
  const searchParts = async (query) => {
    const response = await fetch('/api/responses/turn_response', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: query }],
        tools: [{ type: 'web_search' }]
      })
    });
    
    const data = await response.json();
    setSearchResults(data);
  };

  return (
    <div>
      <input 
        type="text" 
        placeholder="Search for auto parts..." 
        onChange={(e) => searchParts(e.target.value)}
      />
      
      {searchResults && (
        <PartsSearchResults responseData={searchResults} />
      )}
    </div>
  );
}
```

### Dynamic Features
The React component provides:

- **📊 Price Comparison Charts** - Sort by price, show ranges
- **🏪 Retailer Badges** - Visual store availability indicators
- **🔗 Interactive Citations** - Clickable source links
- **🏷️ Category Filtering** - Filter by brake, engine, electrical parts
- **💰 Real-time Pricing** - Live updates from web search

## 🔧 Supported Retailers

The system automatically identifies and categorizes results from:

- **AutoZone** (autozone.com)
- **Advance Auto Parts** (advanceautoparts.com) 
- **O'Reilly Auto Parts** (oreillyauto.com)
- **NAPA Auto Parts** (napa.com)
- **RockAuto** (rockauto.com)
- **PartsGeek** (partsgeek.com)
- **Amazon** (amazon.com)
- **Toyota Parts Deal** (toyotapartsdeal.com)
- **GM Parts Direct** (gmpartsdirect.com)
- **Ford Parts** (fordparts.com)

## 📊 Data Structure

### Parts Categories
- `brake` - Brake pads, rotors, calipers
- `engine` - Oil filters, spark plugs, belts  
- `electrical` - Batteries, alternators, starters
- `suspension` - Shocks, struts, springs
- `body` - Lights, mirrors, bumpers
- `other` - Miscellaneous parts

### Price Information
```javascript
{
  raw: "$67.99-$89.99",    // Original price string
  min: 67.99,              // Minimum price
  max: 89.99,              // Maximum price (if range)
  range: true              // Has price range
}
```

### Brand Recognition
Automatically identifies brands: EBC, Duralast, Carquest, Toyota, PowerStop, Bosch, AC Delco, Motorcraft, OEM, and more.

## 🚀 Advanced Features

### Streaming Responses
```javascript
const response = await fetch('/api/responses/chat/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: "Find brake pad options for my 2020 Toyota Camry",
    vehicleContext: {
      year: "2020",
      make: "Toyota", 
      model: "Camry"
    }
  })
});

// Handle Server-Sent Events
const reader = response.body.getReader();
// Process streaming data...
```

### Analysis with Visualization
```javascript
const response = await fetch('/api/responses/chat/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    question: "Compare brake pad prices across retailers and show trends",
    vehicleContext: { year: "2020", make: "Toyota", model: "Camry" }
  })
});
```

## 🔍 Search Optimization

### Query Best Practices
- Include **vehicle year, make, model** for better results
- Use **specific part names** (e.g., "brake pads" vs "brakes")
- Add **part categories** for broader searches
- Include **brand preferences** if applicable

### Example Queries
```
✅ Good: "2020 Toyota Camry brake pads OEM vs aftermarket pricing"
✅ Good: "Honda Civic 2019 oil filter Bosch vs Fram comparison" 
❌ Poor: "car parts"
❌ Poor: "brake stuff"
```

## 📈 Performance

- **Search Speed**: ~2-3 seconds per query
- **Retailer Coverage**: 10+ major auto parts stores
- **Price Accuracy**: Real-time pricing (subject to retailer updates)
- **Cache Duration**: No caching (always fresh results)

## 🛡️ Error Handling

The system includes robust error handling for:
- Network timeouts
- Retailer website changes
- Price parsing failures
- Missing product information

## 📞 Support

For questions or issues:
1. Check the console logs for detailed error information
2. Verify OpenAI API key is configured
3. Test with simple queries first
4. Review the enhanced response structure

## 🔄 Updates

### Recent Changes
- ✅ Integrated OpenAI native web search tool
- ✅ Added structured data parsing
- ✅ Created React component library
- ✅ Enhanced retailer identification
- ✅ Improved price extraction algorithms

### Roadmap
- 🔲 Add inventory level tracking
- 🔲 Include shipping cost estimates  
- 🔲 Add part compatibility verification
- 🔲 Implement price history tracking
- 🔲 Add user review aggregation

---

*Last Updated: January 2025*
*Version: 1.0.0*