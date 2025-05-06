# Multi-Agent Research System Setup

This document provides instructions for setting up the LangGraph-based multi-agent research system.

## Required Dependencies

Install the following dependencies:

```bash
npm install @langchain/langgraph @langchain/openai langchain
```

## System Overview

The multi-agent research system uses LangGraph to create a workflow of specialized agents that:

1. Break down a complex research question into domain-specific sub-questions
2. Dispatch specialized agents to research each sub-question
3. Synthesize findings into a comprehensive report

### Agent Types

- **Question Decomposer**: Breaks down complex questions into specific research areas
- **Vehicle Systems Researcher**: Focuses on technical vehicle components and systems
- **Compliance Researcher**: Investigates regulatory, safety, and compliance information
- **OEM Data Researcher**: Gathers manufacturer-specific technical documentation
- **Forum Community Researcher**: Collects real-world user experiences and community insights
- **Response Synthesizer**: Combines all research into a comprehensive final report

## API Endpoints

### Create Research Request

```
POST /api/multiagent-research
```

Request body:
```json
{
  "query": "Your research question here"
}
```

Response:
```json
{
  "id": "uuid",
  "query": "Your research question here",
  "status": "pending",
  "message": "Research request accepted and is being processed"
}
```

### Get Research Results

```
GET /api/multiagent-research/{id}
```

Response:
```json
{
  "id": "uuid",
  "query": "Your research question here",
  "status": "completed",
  "decomposedQuestions": [...],
  "finalReport": "Comprehensive research results..."
}
```

### List Research Requests

```
GET /api/multiagent-research
```

Query parameters:
- `status`: Filter by status (pending, in-progress, completed, failed)
- `limit`: Number of items to return (default: 10)

## Implementation Details

The system is implemented as a service in `services/ResearchAgentSystem.js` and exposed via routes in `routes/multiagent-research.routes.js`.

The research workflow graph is defined using LangGraph and follows these steps:

1. Question decomposition
2. Parallel research by specialized agents
3. Synthesis of findings into a final report

## Integration with Existing Systems

The multi-agent research system leverages the existing VectorService for storing and retrieving research data. Research requests and results are stored in the `multiagent_research` collection.

## Example Usage

```javascript
// Example client-side code for making a research request
async function submitResearch() {
  const response = await fetch('/api/multiagent-research', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: "What are the common causes of transmission failure in a 2015 Toyota Camry and what diagnostic steps should I take?"
    })
  });
  
  const data = await response.json();
  console.log('Research ID:', data.id);
  
  // Poll for results
  checkResearchStatus(data.id);
}

async function checkResearchStatus(id) {
  const response = await fetch(`/api/multiagent-research/${id}`);
  const research = await response.json();
  
  if (research.status === 'completed' || research.status === 'failed') {
    console.log('Research completed:', research);
  } else {
    console.log('Research status:', research.status);
    // Poll again after a delay
    setTimeout(() => checkResearchStatus(id), 5000);
  }
}
``` 