import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { ResearchManager } from './manager.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3003;

// Initialize research manager
const researchManager = new ResearchManager();

// Middleware
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:5000',
    'http://localhost:5173',
    'https://elizaautomotive.ngrok.app',
    'https://noobtoolai.com',
    'https://*.vercel.app'
  ],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/research/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'research-agent-service',
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

// Research endpoint
app.post('/research/research', async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: 'Query parameter is required and must be a string'
      });
    }

    console.log(`[ResearchService] Processing research request: ${query}`);

    const result = await researchManager.performResearch(query);

    res.json({
      success: true,
      message: 'Research completed successfully',
      data: result,
      result: result.result,
      sources: result.sources,
      traceId: result.traceId
    });

  } catch (error) {
    console.error('[ResearchService] Research error:', error);
    res.status(500).json({
      success: false,
      error: 'Research failed',
      message: error.message || 'Unknown error occurred'
    });
  }
});

// Streaming research endpoint
app.post('/research/research/stream', async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: 'Query parameter is required and must be a string'
      });
    }

    console.log(`[ResearchService] Processing streaming research request: ${query}`);

    // Set up Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type'
    });

    // Progress callback function
    const onProgress = (eventType, data) => {
      const sseData = JSON.stringify({
        type: eventType,
        ...data,
        timestamp: new Date().toISOString()
      });
      
      res.write(`event: ${eventType}\n`);
      res.write(`data: ${sseData}\n\n`);
    };

    try {
      const result = await researchManager.performResearchWithProgress(query, onProgress);

      // Send final result
      const finalData = JSON.stringify({
        success: true,
        message: 'Research completed successfully',
        result: result.result,
        sources: result.sources,
        traceId: result.traceId,
        timestamp: new Date().toISOString()
      });

      res.write(`event: complete\n`);
      res.write(`data: ${finalData}\n\n`);
      res.end();

    } catch (error) {
      console.error('[ResearchService] Streaming research error:', error);
      
      const errorData = JSON.stringify({
        success: false,
        error: 'Research failed',
        message: error.message || 'Unknown error occurred',
        timestamp: new Date().toISOString()
      });

      res.write(`event: error\n`);
      res.write(`data: ${errorData}\n\n`);
      res.end();
    }

  } catch (error) {
    console.error('[ResearchService] Streaming setup error:', error);
    res.status(500).json({
      success: false,
      error: 'Streaming setup failed',
      message: error.message || 'Unknown error occurred'
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('[ResearchService] Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
    message: `Endpoint ${req.method} ${req.path} not found`
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Research Agent Service running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/research/health`);
  console.log(`🔍 Research endpoint: http://localhost:${PORT}/research/research`);
  console.log(`📡 Streaming endpoint: http://localhost:${PORT}/research/research/stream`);
  
  // Check for OpenAI API key
  if (!process.env.OPENAI_API_KEY) {
    console.warn('⚠️  OPENAI_API_KEY not set - research functionality may be limited');
  } else {
    console.log('✅ OpenAI API key configured');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

export default app;