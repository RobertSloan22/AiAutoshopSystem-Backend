import dotenv from 'dotenv';
dotenv.config();

import path from "path";
import { fileURLToPath } from 'url';
import express from "express";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import cors from "cors";
import helmet from 'helmet';
import bodyParser from 'body-parser';
import http from 'http';
import swaggerUi from 'swagger-ui-express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { specs } from './swagger.js';
import lmStudioRoutes from './routes/lmStudio.routes.js';
import licensePlateRoutes from './routes/licensePlate.routes.js';
import blenderRoutes from './routes/blenderRoutes.js';
import { initializeBlender } from './blender.js';
import authRoutes from "./routes/auth.routes.js";
import researchRoutes from './routes/research.routes.js';
import researchServiceRoutes from './routes/research.service.simple.js';
import researchO3ServiceRoutes from './routes/research.o3.service.js';
import multiagentResearchRoutes from './routes/multiagent-research.routes.js';
import integratedResearchRoutes from './routes/integrated-research.routes.js';
import researchResultRoutes from './routes/researchResult.routes.js';
import messageRoutes from "./routes/message.routes.js";
import userRoutes from "./routes/user.routes.js";
import agentproxyRoutes from "./routes/agentproxy.routes.js"
import agentRoutes from "./routes/agent.routes.js"
import invoiceRoutes from "./routes/invoice.routes.js";
import appointmentRoutes from "./routes/appointmentRoutes.js";
import customerRoutes from './routes/customerRoutes.js';
import dtcRoutes from './routes/dtc.routes.js';
import vehicleRoutes from "./routes/vehicle.routes.js";
import serviceRoutes from "./routes/service.routes.js";
import partsRoutes from "./routes/parts.routes.js";
import technicianRoutes from "./routes/technician.routes.js";
import diagramRoutes from './routes/diagram.routes.js';
import diagramGenerateRoutes from './routes/diagram-generate.routes.js';
import conversationRoutes from './routes/conversation.routes.js';
import notesRoutes from './routes/notes.routes.js';
import connectToMongoDB from "./db/connectToMongoDB.js";
import searchRoutes from './routes/search.routes.js';
import serperRoutes from './routes/serper.routes.js';
import imageRoutes from './routes/image.routes.js';
import proxyRoutes from './routes/proxy.routes.js';
import forumCrawlerRoutes from './routes/forumCrawler.js';
import localRoutes from './routes/local.routes.js';
import localResearchRoutes from './routes/localResearch.routes.js';
import imageanalysisRoutes from './routes/imageanalysis.routes.js';
import localresearchServiceRoutes from './routes/localresearch.service.js';
import embeddingsRoutes from './routes/embeddings.routes.js';
import vectorStoreRoutes from './routes/vectorStore.routes.js';
import openaiRoutes from './routes/openai.js';
import assistantsRoutes from './routes/assistants.routes.js';
import assistantsV2Routes from './routes/assistant-v2.routes.js';
import turnResponseRoutes from './routes/turnResponse.routes.js';
import functionRoutes from './routes/functions.routes.js';
import responseImageRoutes from './routes/responseImage.routes.js';
import agentReportsRoutes from './routes/agent-reports.routes.js';
import vehicleQuestionsRoutes from './routes/vehicle-questions.routes.js';
import plateToVinRoutes from './routes/plateToVin.js';
import serpRoutes from './routes/serp.routes.js';
import { VectorService } from './services/VectorService.js';
import { MemoryVectorService } from './services/MemoryVectorService.js';
import memoryVectorRoutes from './routes/memoryVector.routes.js';
import responsesRoutes from './routes/responses.js';
import imagesRoutes from './routes/images.js';
import plotsRoutes from './routes/plots.routes.js';
import plotsFallbackRoutes from './routes/plots-fallback.routes.js';
import elizaProxyRoutes from './routes/elizaProxy.routes.js';
import obd2Routes from './routes/obd2.routes.js';
import obd2RealtimeService from './services/OBD2RealtimeService.js';
import diagnosticAgentsRoutes from './routes/diagnostic-agents.js';
import uiGenerationRoutes from './routes/ui-generation.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 5000; // Using 5002 to avoid conflicts

// Create Express app and HTTP server
const app = express();
const server = http.createServer(app);

// Connect to MongoDB first
console.log('Connecting to MongoDB...');
mongoose.connect(process.env.MONGO_DB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((error) => {
    console.error('MongoDB connection error:', error);
    process.exit(1); // Exit if we can't connect to the database
  });

// Define allowed origins (keep your existing list)
const allowedOrigins = [
  // APIs
  'https://us-license-plate-to-vin.p.rapidapi.com',

  // Local development URLs
  'http://127.0.0.1:5501',
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:3500',
  'http://localhost:3005',
  'http://localhost:3001',
  'http://localhost:8080',
  'http://localhost:8081',
  'http://localhost:8000',
  'https://dist-buvoyv9rj-robmit2023s-projects.vercel.app/backgrounddashboard',
  // IP addresses
  'http://192.168.56.1:1234',
  'http://192.168.1.124:8000',
  'http://99.37.183.149:5000',
  'http://99.37.183.149:3000',
  'https://99.37.183.149:5000',

  // Production domains - Make sure we have all variations
  'https://noobtoolai.com',
  'http://noobtoolai.com',
  'https://www.noobtoolai.com',
  'http://www.noobtoolai.com',
  'https://noobtoolai.com/backgrounddashboard',

  // Vercel deployment domains
  'https://dist-pc85lqajg-robmit2023s-projects.vercel.app',
  'https://dist-4ibg6nara-robmit2023s-projects.vercel.app',
  'https://dist-u5xg1a2y5-robmit2023s-projects.vercel.app',
  'https://noobtoolai.com',

  // ngrok domains - support all variations
  'https://b8a5-66-42-19-48.ngrok-free.app',
  'https://eliza.ngrok.app',
  'https://dist-robertsloan22-robmit2023s-projects.vercel.app',
  'https://dist-qag1jwj8y-robmit2023s-projects.vercel.app',
  'wss://eliza.ngrok.app',
  'http://eliza.ngrok.app',
  'https://eliza.ngrok-free.app',
  'http://eliza.ngrok-free.app',
  'wss://eliza.ngrok-free.app',
  // Wildcard for any ngrok domain
  'https://*.ngrok.app',
  'https://*.ngrok-free.app',
  'wss://*.ngrok.app',
  'wss://*.ngrok-free.app',

  // App protocols
  'app://*',
  'file://*',
  'electron://*',
  
  // OBD2-specific origins (if needed)
  // Add any specific OBD2 frontend URLs here
  // 'https://your-obd2-frontend.vercel.app',
];

// Single CORS middleware configuration
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or same-origin)
    if (!origin) return callback(null, true);

    // Always allow localhost development
    if (origin.startsWith('http://localhost:') || origin.startsWith('https://localhost:')) {
      return callback(null, origin);
    }

    // Always allow noobtoolai.com (your main domain)
    if (origin === 'https://noobtoolai.com' || origin.endsWith('noobtoolai.com')) {
      return callback(null, origin);
    }

    // Always allow your specific Vercel URLs
    if (origin.includes('vercel.app') ||
        origin.includes('vercel.com/robmit2023s-projects')) {
      return callback(null, origin);
    }

    // Always allow ngrok domains
    if (origin.includes('ngrok.app') ||
        origin.includes('ngrok-free.app') ||
        origin.includes('ngrok.io')) {
      return callback(null, origin);
    }

    // Check against allowedOrigins list
    if (allowedOrigins.includes(origin)) {
      return callback(null, origin);
    }

    // For development only - remove this in production
    if (process.env.NODE_ENV === 'development') {
      console.log(`Dev mode: Allowing CORS from ${origin}`);
      return callback(null, origin);
    }

    // Block all other origins in production
    console.log(`CORS blocked: ${origin}`);
    callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'Sec-WebSocket-Key', 'Sec-WebSocket-Protocol', 'Sec-WebSocket-Version', 'Sec-WebSocket-Extensions'],
  exposedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'Sec-WebSocket-Accept', 'Sec-WebSocket-Protocol', 'Sec-WebSocket-Version', 'Sec-WebSocket-Extensions'],
  maxAge: 86400 // 24 hours
}));

// Preflight handling
app.options('*', cors());

// Special handling for OPTIONS requests to eliza endpoint
app.options('/eliza/*', (req, res) => {
  const origin = req.headers.origin;
  // Set CORS headers
  res.header('Access-Control-Allow-Origin', origin);
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400'); // 24 hours
  res.status(200).end();
});

// Parse JSON and URL-encoded data
app.use(express.json({ limit: '50mb' }));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());

// Initialize Blender functionality
initializeBlender(app);

// Proxy middleware setup
// Proxy requests to Eliza system
app.use('/eliza', createProxyMiddleware({
  target: 'http://localhost:3000',
  changeOrigin: true,
  ws: true,
  pathRewrite: {
    '^/eliza': '/' // rewrite path
  },
  // Add these settings:
  timeout: 60000, // Increase timeout to 60 seconds
  proxyTimeout: 60000,
  // Configure larger limits for proxy
  maxBodyLength: 10 * 1024 * 1024, // 10MB max body length
  // Handle CORS headers correctly
  onProxyRes: (proxyRes, req, res) => {
    // Get the origin from the request
    const origin = req.headers.origin;

    // If there's an origin header, ensure proper CORS headers are set
    if (origin) {
      // For preflight OPTIONS requests and regular requests
      proxyRes.headers['Access-Control-Allow-Origin'] = origin;
      proxyRes.headers['Access-Control-Allow-Credentials'] = 'true';
      proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS, PATCH';
      proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With, Accept, Origin';
      proxyRes.headers['Access-Control-Max-Age'] = '86400'; // 24 hours
    }

    console.log('Eliza proxy response to origin:', origin);
  },
  // Better request handling
  onProxyReq: (proxyReq, req, res) => {
    // Add origin header to forwarded request if missing
    if (!proxyReq.getHeader('origin') && req.headers.origin) {
      proxyReq.setHeader('origin', req.headers.origin);
    }

    // Set appropriate content length if possible
    if (req.body) {
      const bodyData = JSON.stringify(req.body);
      proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
      // Stream body to request
      proxyReq.write(bodyData);
    }

    console.log('Eliza proxy request from origin:', req.headers.origin);
  },
  // Handle connection errors better
  onError: (err, req, res) => {
    console.error('Eliza proxy error:', err);
    if (!res.headersSent) {
      res.writeHead(502, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': req.headers.origin || '*',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, Origin'
      });
      res.end(JSON.stringify({
        error: "Eliza service is currently unavailable",
        message: err.message,
        code: "SERVICE_UNAVAILABLE"
      }));
    }
  }
}));
// CORRECTED WebSocket proxy - removes duplicate headers

// OPTIONS handler for WebSocket endpoint
app.options('/ws', (req, res) => {
  const origin = req.headers.origin;
  res.header('Access-Control-Allow-Origin', origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Sec-WebSocket-Key, Sec-WebSocket-Protocol, Sec-WebSocket-Version, Sec-WebSocket-Extensions');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400');
  res.status(200).end();
});

// FIXED WebSocket proxy - prevents header duplication
app.use('/ws', createProxyMiddleware({
  target: 'http://localhost:8001',
  changeOrigin: true,
  ws: true,
  followRedirects: false,
  ignorePath: false,
  timeout: 60000,
  proxyTimeout: 60000,

  // Handle WebSocket upgrade - FIXED to prevent header duplication
  onProxyReqWs: (proxyReq, req, socket, options, head) => {
    console.log('🚀 Research WebSocket Proxy: Upgrade request');
    console.log('🌐 Origin:', req.headers.origin);
    console.log('📡 URL:', req.url);

    // IMPORTANT: Remove any existing headers that might cause conflicts
    // Let the proxy handle WebSocket headers automatically

    // Only set essential headers, don't duplicate WebSocket headers
    proxyReq.setHeader('Host', 'localhost:8001');

    // Forward the origin without modification
    if (req.headers.origin) {
      proxyReq.setHeader('Origin', req.headers.origin);
    }

    // Forward client information
    proxyReq.setHeader('X-Forwarded-For', req.connection.remoteAddress || req.socket.remoteAddress);
    proxyReq.setHeader('X-Real-IP', req.connection.remoteAddress || req.socket.remoteAddress);

    // Extract client_id from query params ONLY
    const url = new URL(`http://localhost${req.url}`);
    const clientId = url.searchParams.get('client_id');
    if (clientId) {
      proxyReq.setHeader('X-Client-ID', clientId);
      console.log('🔑 Forwarding client_id:', clientId);
    }

    // DO NOT manually set WebSocket headers - let http-proxy-middleware handle them
    // DO NOT set: Sec-WebSocket-Key, Sec-WebSocket-Version, etc.

    console.log('📝 Headers being sent to Python service:', {
      host: proxyReq.getHeader('Host'),
      origin: proxyReq.getHeader('Origin'),
      'x-forwarded-for': proxyReq.getHeader('X-Forwarded-For'),
      'x-client-id': proxyReq.getHeader('X-Client-ID')
    });
  },

  // Handle successful connection
  onProxyReqWsComplete: () => {
    console.log('✅ Research WebSocket proxy connection established successfully');
  },

  // Handle errors with better logging
  onError: (err, req, res) => {
    console.error('❌ Research WebSocket Proxy Error:', err.message);
    console.error('❌ Error code:', err.code);
    console.error('❌ Request headers:', req.headers);

    const isWebSocket = req.headers.upgrade && req.headers.upgrade.toLowerCase() === 'websocket';

    if (isWebSocket) {
      console.error('❌ WebSocket connection failed - likely header conflict');
      if (req.socket && !req.socket.destroyed) {
        req.socket.destroy();
      }
      return;
    }

    // Only handle HTTP errors
    if (res && !res.headersSent) {
      const origin = req.headers.origin;
      res.writeHead(502, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': origin || '*',
        'Access-Control-Allow-Credentials': 'true'
      });
      res.end(JSON.stringify({
        error: 'Research WebSocket service unavailable',
        message: err.message,
        details: 'Check for header conflicts or service availability',
        target: 'http://localhost:8001'
      }));
    }
  },

  // CRITICAL: Remove duplicate CORS headers from Python service response
  onProxyRes: (proxyRes, req, res) => {
    // Remove any CORS headers that might be set by the Python service
    // to prevent conflicts with our proxy's CORS headers
    delete proxyRes.headers['access-control-allow-origin'];
    delete proxyRes.headers['access-control-allow-credentials'];
    delete proxyRes.headers['access-control-allow-methods'];
    delete proxyRes.headers['access-control-allow-headers'];

    // Set our own CORS headers
    const origin = req.headers.origin;
    if (origin) {
      proxyRes.headers['access-control-allow-origin'] = origin;
      proxyRes.headers['access-control-allow-credentials'] = 'true';
    }

    console.log('🔧 Proxy response headers cleaned and set');
  }
}));
// Add research WebSocket proxy route - use the same enhanced configuration
app.use('/research-ws', createProxyMiddleware({
  target: 'http://localhost:8001',
  changeOrigin: true,
  ws: true,
  pathRewrite: {
    '^/research-ws': '/'  // Map to root path for compatibility
  },
  // Add WebSocket-specific settings
  websocket: true,
  // Increase timeouts significantly for ngrok tunneling
  timeout: 120000, // 2 minutes
  proxyTimeout: 120000,
  // Handle WebSocket-specific events
  onProxyReqWs: (proxyReq, req, socket, options, head) => {
    // Log WebSocket connection attempts
    console.log(`Research WebSocket connection attempt from ${req.headers.origin || 'unknown origin'} to /research-ws`);

    // Preserve original headers that help with WebSocket protocol negotiation
    if (req.headers['sec-websocket-protocol']) {
      proxyReq.setHeader('Sec-WebSocket-Protocol', req.headers['sec-websocket-protocol']);
    }

    // Make sure host header is set properly
    proxyReq.setHeader('Host', 'localhost:8001');

    // Add client IP to headers for logging
    proxyReq.setHeader('X-Forwarded-For', req.connection.remoteAddress);

    // Extract client_id if provided in query string
    const url = new URL(`http://localhost${req.url}`);
    const clientId = url.searchParams.get('client_id');
    if (clientId) {
      // Forward client_id in a header
      proxyReq.setHeader('X-Client-ID', clientId);
      console.log(`Forwarding client_id: ${clientId}`);
    }
  },
  // Better error logging for WebSocket connections
  onError: (err, req, res) => {
    console.error('Research WebSocket proxy error:', err.message || err);

    // Check if this is a WebSocket upgrade request
    const isWebSocketRequest = req.headers.upgrade &&
      req.headers.upgrade.toLowerCase() === 'websocket';

    if (isWebSocketRequest) {
      // WebSocket errors can't use normal response methods
      console.error(`Research WebSocket connection failed: ${err.message || 'Unknown error'}`);
      // Try to close socket with error if possible
      if (req.socket && !req.socket.destroyed) {
        req.socket.end();
      }
      return;
    }

    // Handle HTTP requests with proper error response
    if (res && !res.headersSent) {
      // Set CORS headers for error responses too
      const origin = req.headers.origin || '*';
      res.writeHead(502, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true'
      });
      res.end(JSON.stringify({
        error: "Research WebSocket service is currently unavailable",
        message: err.message || 'Connection error',
        code: "RESEARCH_WEBSOCKET_UNAVAILABLE"
      }));
    }
  }
}))

// Data Analysis endpoint for installing dependencies
app.use('/install-data-analysis-deps', createProxyMiddleware({
  target: 'http://localhost:8001',
  changeOrigin: true,
  pathRewrite: {
    '^/install-data-analysis-deps': '/install-data-analysis-deps'
  },
  onError: (err, req, res) => {
    console.error('Data analysis dependency installation error:', err);
    if (res.writeHead && !res.headersSent) {
      res.writeHead(502);
      res.end("Data analysis server is currently unavailable");
    }
  }
}));

// Research and Data Analysis REST API endpoints
app.use('/fastagent/research', createProxyMiddleware({
  target: 'http://localhost:8001',
  changeOrigin: true,
  onError: (err, req, res) => {
    console.error('Research API error:', err);
    if (res.writeHead && !res.headersSent) {
      res.writeHead(502);
      res.end("Research service is currently unavailable");
    }
  }
}));

app.use('/upload', createProxyMiddleware({
  target: 'http://localhost:8001',
  changeOrigin: true,
  onError: (err, req, res) => {
    console.error('Upload API error:', err);
    if (res.writeHead && !res.headersSent) {
      res.writeHead(502);
      res.end("Upload service is currently unavailable");
    }
  }
}));

app.use('/analysis', createProxyMiddleware({
  target: 'http://localhost:8001',
  changeOrigin: true,
  onError: (err, req, res) => {
    console.error('Analysis API error:', err);
    if (res.writeHead && !res.headersSent) {
      res.writeHead(502);
      res.end("Analysis service is currently unavailable");
    }
  }
}));


app.use('/visualization', createProxyMiddleware({
  target: 'http://localhost:8001',
  changeOrigin: true,
  onError: (err, req, res) => {
    console.error('Visualization API error:', err);
    if (res.writeHead && !res.headersSent) {
      res.writeHead(502);
      res.end("Visualization service is currently unavailable");
    }
  }
}));

// =====================================================
// OBD2 HTTP Service Integration
// =====================================================

console.log('✅ OBD2 HTTP-based service integrated');

// =====================================================
// End OBD2 HTTP Service Integration
// =====================================================

// API Routes
app.use("/api/auth", authRoutes);
// Enable research routes
app.use("/api/research", researchRoutes);
app.use("/api/research1", researchServiceRoutes);
app.use("/api/researcho3/o3", researchO3ServiceRoutes);
app.use("/api/multiagent-research", multiagentResearchRoutes);
// Integrated research bot - direct endpoint
app.use("/api/integrated-research", integratedResearchRoutes);

// Research progress tracking
import researchProgressRoutes from './routes/researchProgress.routes.js';
import apiRoutes from './routes/api.routes.js';

// Add the new API routes
app.use("/api/", apiRoutes);

app.use("/api/research-progress", researchProgressRoutes);
// Research results endpoints
app.use("/api/research-results", researchResultRoutes);
app.use("/api/agent-reports", agentReportsRoutes); // Agent reports endpoint

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});
app.use("/api/agentproxy", agentproxyRoutes);
app.use("/api/local", localRoutes);
app.use("/api/agent", agentRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/users", userRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/lmStudio', lmStudioRoutes);
app.use(dtcRoutes);
app.use("/api/vehicles", vehicleRoutes);
// Forum crawler disabled to reduce vector service startup overhead
// app.use('/api/forum-crawler', forumCrawlerRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/parts", partsRoutes);
app.use("/api/technicians", technicianRoutes);
app.use('/api/diagram', diagramRoutes);
//app.use('/api', diagramGenerateRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/serper', serperRoutes);
app.use('/api', imageRoutes);
app.use('/api', proxyRoutes);
app.use('/api/imageanalysis', imageanalysisRoutes);
app.use('/api/researchl', localResearchRoutes);
app.use('/api/rservice', localresearchServiceRoutes);
app.use('/api/embeddings', embeddingsRoutes);
// Vector store routes disabled to reduce startup overhead
app.use('/api/vector-store', vectorStoreRoutes);
app.use('/api/assistants', assistantsRoutes);
app.use('/api/assistants-v2', assistantsV2Routes);
app.use('/api/openai', openaiRoutes);
app.use('/api/v1/responses', turnResponseRoutes);
app.use('/api/turn_response', turnResponseRoutes);
app.use('/api/functions', functionRoutes);
app.use('/api', responseImageRoutes);
app.use("/api/vehicle-questions", vehicleQuestionsRoutes);
app.use('/api/license-plate', licensePlateRoutes);
app.use('/api/plate-to-vin', plateToVinRoutes);
app.use('/api/serp', serperRoutes);
// Memory vector routes disabled to reduce startup overhead
// app.use('/api/memory-vector', memoryVectorRoutes);
app.use('/api/responses', responsesRoutes);
app.use('/api/images', imagesRoutes);
app.use('/api/plots', plotsRoutes);
app.use('/api/plots/fallback', plotsFallbackRoutes);
app.use('/api/ui', uiGenerationRoutes);

// Register Eliza proxy router for direct communication with Eliza system
app.use('/api/eliza-direct', elizaProxyRoutes);

// Register OBD2 data routes
app.use('/api/obd2', obd2Routes);
import analysisDashboardRoutes from './routes/analysisDashboard.routes.js';

// Register analysis dashboard routes
app.use('/api/analysis', analysisDashboardRoutes);

// Register diagnostic agents routes
app.use('/api/diagnostic-agents', diagnosticAgentsRoutes);

// Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
  customSiteTitle: "Automotive AI Platform API Documentation",
  customfavIcon: "/favicon.ico",
  customCss: '.swagger-ui .topbar { display: none }'
}));


// Chrome Extension Routes
app.post('/api/diagnostic-data', async (req, res) => {
  try {
    const { extensionData, sessionId } = req.body;
    
    console.log('📥 Received diagnostic data from Chrome extension:', {
      sessionId,
      dtcCodes: extensionData?.dtcCodes?.length || 0,
      vehicleInfo: extensionData?.vehicleInfo?.length || 0,
      diagnosticText: extensionData?.diagnosticText?.length || 0,
      pageUrl: extensionData?.pageUrl,
      pageTitle: extensionData?.pageTitle
    });

    // Store the data (you can save to MongoDB or process immediately)
    const processedData = {
      sessionId,
      extensionData,
      timestamp: new Date(),
      status: 'received'
    };

    // If you have DTC codes, you might want to trigger additional processing
    if (extensionData?.dtcCodes?.length > 0) {
      console.log('🔧 DTC codes detected, ready for diagnostic agent processing:', extensionData.dtcCodes);
    }

    // If you have diagnostic text, you might want to analyze it
    if (extensionData?.diagnosticText?.length > 0) {
      console.log('📝 Diagnostic text extracted from page:', extensionData.diagnosticText.length, 'items');
    }

    res.json({ 
      success: true, 
      message: 'Diagnostic data received and processed successfully',
      sessionId,
      dataReceived: {
        dtcCodes: extensionData?.dtcCodes?.length || 0,
        vehicleInfo: extensionData?.vehicleInfo?.length || 0,
        diagnosticText: extensionData?.diagnosticText?.length || 0,
        hasPageData: !!(extensionData?.pageUrl && extensionData?.pageTitle)
      }
    });
  } catch (error) {
    console.error('❌ Error processing diagnostic data from extension:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process diagnostic data',
      message: error.message
    });
  }
});







// Base URL route
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Automotive AI Platform</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          margin: 0;
          padding: 0;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
        }
        .container {
          text-align: center;
          padding: 2rem;
          background: white;
          border-radius: 10px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          max-width: 600px;
          margin: 1rem;
        }
        h1 {
          color: #2c3e50;
          margin-bottom: 1rem;
        }
        p {
          color: #34495e;
          line-height: 1.6;
        }
        .logo {
          font-size: 2.5rem;
          margin-bottom: 1rem;
          color: #3498db;
        }
        .info {
          text-align: left;
          margin-top: 1.5rem;
          padding: 1rem;
          background: #f8f9fa;
          border-radius: 5px;
        }
        .route {
          font-family: monospace;
          background: #eee;
          padding: 0.2rem 0.4rem;
          border-radius: 3px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">🚗</div>
        <h1>Automotive AI Platform</h1>
        <p>Welcome to the Automotive AI Platform API the tool for noobs. This is the backend service for our automotive intelligence system.</p>

        <div class="info">
          <h3>Available Proxy Routes:</h3>
          <ul>
            <li><span class="route">/api/*</span> - Main backend services</li>
            <li><span class="route">/eliza</span> - Eliza chat system</li>
            <li><span class="route">/ws</span> - WebSocket server</li>
            <li><span class="route">/research-ws</span> - Research WebSocket server</li>
            <li><span class="route">/research</span> - Research REST API</li>
            <li><span class="route">/upload</span> - File upload for analysis</li>
            <li><span class="route">/analysis</span> - Data analysis API</li>
            <li><span class="route">/visualization</span> - Visualization API</li>
            <li><span class="route">/install-data-analysis-deps</span> - Install data analysis dependencies</li>
          </ul>
        </div>
      </div>
    </body>
    </html>
  `);
});

// API error handling with CORS headers
app.use('/api', (err, req, res, next) => {
  console.error('API error:', err);

  // Make sure CORS headers are set even on error responses
  const origin = req.headers.origin;
  if (origin && (allowedOrigins.includes(origin) || origin.includes('vercel.app'))) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  }

  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));

  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/dist/index.html"));
  });
} else {
  app.get("*", (req, res) => {
    // Set CORS headers even on 404 responses
    const origin = req.headers.origin;
    if (origin && (allowedOrigins.includes(origin) || origin.includes('vercel.app'))) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
    }

    res.status(404).json({ message: "API endpoint not found" });
  });
}

// Initialize VectorService (DISABLED to reduce startup overhead)
async function initializeServices() {
  try {
    console.log('Vector Services initialization DISABLED to reduce startup overhead');
    console.log('Vector services can be enabled by setting ENABLE_VECTOR_SERVICES=true');

    // Only initialize vector services if explicitly enabled
    if (process.env.ENABLE_VECTOR_SERVICES === 'true') {
      console.log('Initializing Vector Services...');

      // Initialize persistent vector storage
      await VectorService.initialize({
        useLocal: process.env.USE_LOCAL_STORAGE !== 'false',
        useOpenAI: process.env.USE_OPENAI_STORAGE === 'true',
        useDualStorage: process.env.USE_DUAL_STORAGE === 'true',
        chromaUrl: process.env.CHROMA_URL,
        localEmbeddingUrl: process.env.LOCAL_EMBEDDING_URL,
        openaiApiKey: process.env.OPENAI_API_KEY
      });
      console.log('Persistent Vector Service initialized successfully');

      // Initialize memory vector storage
      // Create default instance
      await MemoryVectorService.initialize('default', {
        localEmbeddingUrl: process.env.LOCAL_EMBEDDING_URL,
        useOpenAI: false // Default to local embeddings for memory store
      });

      // Create a session-specific instance for temporary user interactions
      await MemoryVectorService.initialize('user_sessions', {
        localEmbeddingUrl: process.env.LOCAL_EMBEDDING_URL,
        useOpenAI: false
      });

      // Create a forum-crawler instance for temporary forum crawling
      await MemoryVectorService.initialize('forum_crawler', {
        localEmbeddingUrl: process.env.LOCAL_EMBEDDING_URL,
        useOpenAI: false
      });

      console.log('Memory Vector Service initialized successfully');
    }
  } catch (error) {
    console.error('Error initializing Vector Services:', error);
    // Don't exit - the server should still start, but vector services might be limited
  }
}

// Import the agent service starter
import { startAgentService } from './services/agentService.js';
import obd2WebSocketService from './services/obd2WebSocketService.js';
// Import the RealtimeRelay
import { RealtimeRelay } from './services/RealtimeRelay.js';
// Import child_process to start agent service
import { spawn } from 'child_process';

// Start the server
server.listen(PORT, async () => {
  console.log(`Server Running on port ${PORT}`);

  // Add upgrade listener to better handle WebSocket connections
  server.on('upgrade', (req, socket, head) => {
    const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;
    console.log(`WebSocket upgrade request for path: ${pathname}`);

    // Log important headers for debugging
    console.log('WebSocket Headers:', {
      upgrade: req.headers.upgrade,
      connection: req.headers.connection,
      origin: req.headers.origin,
      'sec-websocket-key': req.headers['sec-websocket-key'] ? '(present)' : '(missing)',
      'sec-websocket-version': req.headers['sec-websocket-version']
    });

    // Continue with normal processing - http-proxy-middleware will handle the rest
  });

  await initializeServices();

  // Initialize OBD2 WebSocket service
  obd2WebSocketService.initialize(server);
  obd2WebSocketService.startHealthCheck();

  // Start periodic cleanup of old sessions
  setInterval(() => {
    obd2WebSocketService.cleanupOldSessions(24); // Clean up sessions older than 24 hours
  }, 60 * 60 * 1000); // Run every hour

  // =====================================================
  // OBD2 Data Cleanup Job
  // =====================================================
  
  // Cleanup old OBD2 data periodically (optional)
  if (process.env.ENABLE_OBD2_CLEANUP === 'true') {
    const OBD2_CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
    const OBD2_DATA_RETENTION_DAYS = parseInt(process.env.OBD2_DATA_RETENTION_DAYS) || 365;

    setInterval(async () => {
      try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - OBD2_DATA_RETENTION_DAYS);
        
        // Import the models (you may need to adjust the import path)
        const { DiagnosticSession, OBD2DataPoint, DTCEvent } = await import('./routes/obd2.routes.js');
        
        // Delete old completed sessions and their data
        const oldSessions = await DiagnosticSession.find({
          status: 'completed',
          startTime: { $lt: cutoffDate }
        }).select('_id');
        
        const sessionIds = oldSessions.map(s => s._id);
        
        if (sessionIds.length > 0) {
          await OBD2DataPoint.deleteMany({ sessionId: { $in: sessionIds } });
          await DTCEvent.deleteMany({ sessionId: { $in: sessionIds } });
          await DiagnosticSession.deleteMany({ _id: { $in: sessionIds } });
          
          console.log(`🧹 Cleaned up ${sessionIds.length} old OBD2 sessions`);
        }
      } catch (error) {
        console.error('❌ OBD2 cleanup error:', error);
      }
    }, OBD2_CLEANUP_INTERVAL);
  }

  // Start the agent service (client service)
  startAgentService();

  // Start the separate agent service server
  console.log('🚀 Starting Agent Research Service...');
  const agentServiceProcess = spawn('npm', ['start'], {
    cwd: path.join(__dirname, 'agent-service'),
    stdio: 'inherit',
    shell: true
  });

  agentServiceProcess.on('error', (error) => {
    console.error('❌ Failed to start Agent Research Service:', error);
  });

  agentServiceProcess.on('exit', (code) => {
    console.warn(`⚠️ Agent Research Service exited with code ${code}`);
  });

  console.log('✅ Agent Research Service started on port 3003');

  // Initialize the OpenAI Realtime API relay
  if (process.env.OPENAI_API_KEY) {
    try {
      const realtimeRelay = new RealtimeRelay(process.env.OPENAI_API_KEY, server);
      realtimeRelay.initialize();
      console.log('OpenAI Realtime API relay initialized successfully');
    } catch (error) {
      console.error('Failed to initialize OpenAI Realtime API relay:', error);
    }
  } else {
    console.warn('OPENAI_API_KEY not provided, Realtime API relay not initialized');
  }
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, cleaning up services...');
  obd2RealtimeService.shutdown();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, cleaning up services...');
  obd2RealtimeService.shutdown();
  process.exit(0);
});

export default app;
