import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { ResearchManager } from './manager.js';

const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(
  cors({
    origin:
      process.env.NODE_ENV === 'production'
        ? [
            'https://noobtoolai.com',
            'https://nooresearch.ngrok.app',
            'https://dist-kvg71wfhu-robmit2023s-projects.vercel.app',
            /^https:\/\/.*\.vercel\.app$/, // Allow all Vercel domains
          ]
        : [
            'http://localhost:3000',
            'http://localhost:5173', // Vite dev server
            'http://127.0.0.1:3000',
            'http://127.0.0.1:5173', // Vite dev server
            'http://192.168.1.143:3000',
            'http://192.168.1.143:5173', // Vite dev server
          ],
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control'],
  }),
);

app.use(express.json());

// Health check endpoint - matches frontend /research/health
app.get('/research/health', (req, res) => {
  res.json({ status: 'ok', service: 'research-bot' });
});

// Regular research endpoint - matches frontend /research/research
app.post('/research/research', async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Query parameter is required and must be a string',
      });
    }

    console.log(`[Server] Starting research for query: ${query}`);

    const researchManager = new ResearchManager();
    const result = await researchManager.performResearch(query);

    res.json({
      success: true,
      query,
      result,
    });
  } catch (error) {
    console.error('[Server] Research error:', error);
    res.status(500).json({
      success: false,
      error: 'Research failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Streaming research endpoint - matches frontend /research/research/stream
app.post('/research/research/stream', async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Query parameter is required and must be a string',
      });
    }

    // Set up Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    console.log(`[Server] Starting streaming research for query: ${query}`);

    const researchManager = new ResearchManager();

    // Set up progress callback
    const sendProgress = (event, data) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const result = await researchManager.performResearchWithProgress(
        query,
        sendProgress,
      );

      // Send final result
      sendProgress('complete', {
        success: true,
        query,
        result,
      });

      res.end();
    } catch (error) {
      console.error('[Server] Streaming research error:', error);
      sendProgress('error', {
        success: false,
        error: 'Research failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      res.end();
    }
  } catch (error) {
    console.error('[Server] Streaming setup error:', error);
    res.status(500).json({
      success: false,
      error: 'Streaming setup failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Legacy endpoints for backward compatibility
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'research-bot' });
});

app.post('/research', async (req, res) => {
  // Redirect to new endpoint
  req.url = '/research/research';
  app._router.handle(req, res);
});

app.post('/research/stream', async (req, res) => {
  // Redirect to new endpoint
  req.url = '/research/research/stream';
  app._router.handle(req, res);
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Research bot server running on http://0.0.0.0:${PORT}`);
  console.log(`Health check: http://0.0.0.0:${PORT}/research/health`);
  console.log(
    `Research endpoint: POST http://0.0.0.0:${PORT}/research/research`,
  );
  console.log(
    `Streaming endpoint: POST http://0.0.0.0:${PORT}/research/research/stream`,
  );
  console.log(
    `\nAccess from other devices on your network using your machine's IP address`,
  );
});