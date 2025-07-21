# Research Agent Service

This is the backend service that powers the AI Research Bot integration with the AiAutoshopSystem-Backend. It provides OpenAI-powered research agents specialized for automotive diagnostics and repair.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

3. Add your OpenAI API key to the `.env` file:
```
OPENAI_API_KEY=your_openai_api_key_here
PORT=3003
NODE_ENV=development
```

## Running the Service

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

The service will start on port 3003 (or the port specified in your .env file).

## API Endpoints

- `GET /research/health` - Health check endpoint
- `POST /research/research` - Perform research (returns complete result)
- `POST /research/research/stream` - Perform streaming research (Server-Sent Events)

## Integration

This service is designed to work with:
- **Frontend**: research-agent React app (port 3000)
- **Backend**: AiAutoshopSystem-Backend (port 5000)

The backend proxies requests from `/api/integrated-research` to this service on port 3003.

## Architecture

The service uses OpenAI's Agent framework with three specialized agents:

1. **AutomotivePlannerAgent** - Plans research queries specific to automotive needs
2. **AutomotiveSearchAgent** - Performs web searches and summarizes automotive information
3. **AutomotiveWriterAgent** - Synthesizes research into comprehensive repair reports

## Features

- Automotive-specialized research queries
- Real-time progress updates via Server-Sent Events
- Comprehensive repair reports with actionable information
- Integration with AiAutoshopSystem backend for data persistence
- OpenAI trace logging for debugging and optimization