# Deep Research Service - Automotive AI Platform

## Overview

The Deep Research Service provides comprehensive automotive research capabilities using OpenAI's Agents SDK with the Deep Research model. It's specifically designed for automotive systems, diagnostics, and repair information.

## Features

- **Multi-Agent Research Pipeline**: Triage, clarification, instruction building, and deep research agents
- **Automotive Focus**: Specialized for vehicle diagnostics, DTC codes, parts research, and repair procedures  
- **Streaming Support**: Real-time research progress tracking
- **Citation Extraction**: Automatic extraction of source citations from research results
- **Zero Data Retention**: Configurable for enterprise compliance requirements

## Architecture

### Agent Pipeline

1. **Triage Agent** - Analyzes queries and routes to appropriate agents
2. **Clarifying Agent** - Asks follow-up questions for missing context
3. **Instruction Agent** - Transforms queries into detailed research instructions
4. **Research Agent** - Performs deep empirical research using o4-mini-deep-research model

### Key Components

- **Deep Research Service** (`services/deepResearchService.js`)
- **API Routes** (`routes/deepResearch.routes.js`)
- **Integration** with existing server.js

## API Endpoints

### Health Check
```bash
GET /api/deep-research/health
```
Returns service health status and configuration.

### Comprehensive Research  
```bash
POST /api/deep-research/conduct
{
  "query": "Research brake system issues in 2020 Honda Civic",
  "mockAnswers": {},
  "options": {
    "verbose": true,
    "timeout": 300000
  }
}
```

### Quick Research
```bash
POST /api/deep-research/quick
{
  "query": "What causes P0171 code in Toyota engines?",
  "options": {
    "timeout": 60000
  }
}
```

### DTC Code Research
```bash
POST /api/deep-research/dtc-codes
{
  "dtcCodes": ["P0171", "P0174"],
  "vehicleInfo": {
    "year": "2018",
    "make": "Toyota", 
    "model": "Camry",
    "engine": "2.5L 4-cylinder",
    "symptoms": "rough idle, poor fuel economy"
  }
}
```

### Parts Compatibility Research
```bash
POST /api/deep-research/parts-compatibility
{
  "partQuery": "brake pads front ceramic",
  "vehicleInfo": {
    "year": "2020",
    "make": "Honda",
    "model": "Civic",
    "vin": "JHMFC1F39L****"
  }
}
```

## Configuration

### Environment Variables

```bash
# Required
OPENAI_API_KEY=your_openai_api_key_here

# Optional  
MCP_SERVER_URL=https://localhost:8080/mcp
OPENAI_AGENTS_DISABLE_TRACING=1  # For zero data retention
```

### Dependencies

The service requires these npm packages:
- `@openai/agents` - OpenAI Agents SDK
- `openai` - OpenAI API client

## Usage Examples

### Frontend Integration

```javascript
// Quick automotive research
const quickResearch = async (query) => {
  const response = await fetch('/api/deep-research/quick', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });
  return await response.json();
};

// DTC code lookup
const researchDTCCodes = async (codes, vehicleInfo) => {
  const response = await fetch('/api/deep-research/dtc-codes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      dtcCodes: codes,
      vehicleInfo: vehicleInfo 
    })
  });
  return await response.json();
};

// Parts compatibility check
const checkPartsCompatibility = async (partQuery, vehicleInfo) => {
  const response = await fetch('/api/deep-research/parts-compatibility', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      partQuery: partQuery,
      vehicleInfo: vehicleInfo
    })
  });
  return await response.json();
};
```

### Service Methods

```javascript
import deepResearchService from './services/deepResearchService.js';

// Initialize service
await deepResearchService.initialize();

// Conduct comprehensive research
const result = await deepResearchService.conductResearch(
  "Research transmission problems in 2019 Ford F-150",
  {
    "What specific symptoms are occurring?": "Slipping gears, delayed engagement",
    "What transmission type?": "10R80 10-speed automatic"
  }
);

// Quick research for simple queries
const quickResult = await deepResearchService.quickResearch(
  "What is the recommended oil type for Honda Civic 2020?"
);

// Research specific DTC codes
const dtcResult = await deepResearchService.researchDTCCodes(
  ['P0300', 'P0171'], 
  { year: '2019', make: 'Toyota', model: 'Corolla' }
);
```

## Response Format

All endpoints return a standardized response:

```javascript
{
  "success": true,
  "research": "Detailed research content...",
  "citations": [
    {
      "title": "Honda Service Manual",
      "url": "https://example.com/manual",
      "excerpt": "Brake pad specifications...",
      "start_index": 150,
      "end_index": 200
    }
  ],
  "metadata": {
    "query": "Original query",
    "timestamp": "2024-01-15T10:30:00Z",
    "type": "automotive_deep_research"
  }
}
```

## Testing

Run the test script to verify integration:

```bash
node test-deep-research.js
```

This will test:
- Service health check
- Quick research functionality
- DTC code research
- Parts compatibility research

## Troubleshooting

### Common Issues

1. **Service Not Initialized**
   - Ensure `OPENAI_API_KEY` is set in environment
   - Check that the service initializes on server startup

2. **Timeout Errors**
   - Deep research can take several minutes
   - Increase timeout values in requests
   - Monitor OpenAI API rate limits

3. **Agent Configuration Errors**
   - Verify `@openai/agents` package version compatibility
   - Check that all agent handoffs are properly configured

### Debug Mode

Enable verbose logging by setting `options.verbose: true` in requests to see detailed agent interaction flow.

## Integration with Existing Services

The Deep Research Service integrates seamlessly with your existing automotive platform:

- **OBD2 Analysis**: Use DTC research for diagnostic trouble codes
- **Parts Service**: Enhance parts compatibility checking
- **Customer Support**: Provide detailed technical explanations
- **Technician Tools**: Research repair procedures and TSBs

## Security & Compliance

- **Zero Data Retention**: Configurable via `OPENAI_AGENTS_DISABLE_TRACING=1`
- **API Rate Limiting**: Implemented via existing server middleware
- **Input Validation**: All endpoints validate request parameters
- **Error Handling**: Comprehensive error responses without exposing internals

## Future Enhancements

- **Streaming WebSocket Support**: Real-time research progress updates
- **Custom MCP Integration**: Connect to internal automotive databases
- **Research Caching**: Cache frequently requested automotive information
- **Multi-Language Support**: Research in different languages for international use

## Support

For issues or questions about the Deep Research Service:
1. Check server logs for detailed error information
2. Verify OpenAI API key permissions and quotas
3. Test with the included test script
4. Review agent configuration and handoff flows