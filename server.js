import dotenv from 'dotenv';
dotenv.config();

import path from "path";
import { fileURLToPath } from 'url';
import express from "express";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import cors from "cors";
import { Server } from "socket.io";
import helmet from 'helmet';
import bodyParser from 'body-parser';
import swaggerUi from 'swagger-ui-express';
import { specs } from './swagger.js';
import lmStudioRoutes from './routes/lmStudio.routes.js';
import licensePlateRoutes from './routes/licensePlate.routes.js';
import blenderRoutes from './routes/blenderRoutes.js';
import { initializeBlender } from './blender.js';
import authRoutes from "./routes/auth.routes.js";
import researchRoutes from './routes/research.routes.js';
import researchServiceRoutes from './routes/research.service.js';
import researchO3ServiceRoutes from './routes/research.o3.service.js';
import multiagentResearchRoutes from './routes/multiagent-research.routes.js';
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
import { app, server } from "./socket/socket.js";
import searchRoutes from './routes/search.routes.js';
import serperRoutes from './routes/serper.routes.js';
import imageRoutes from './routes/image.routes.js';
import proxyRoutes from './routes/proxy.routes.js';
import forumCrawlerRoutes from './routes/forumCrawler.js';
import localRoutes from './routes/local.routes.js';
import localResearchRoutes from './routes/localResearch.routes.js';
import localresearchServiceRoutes from './routes/localresearch.service.js';
import embeddingsRoutes from './routes/embeddings.routes.js';
import supabaseRoutes from './routes/supabase.routes.js';
import vectorStoreRoutes from './routes/vectorStore.routes.js';
import openaiRoutes from './routes/openai.js';
import turnResponseRoutes from './routes/turnResponse.routes.js';
import functionRoutes from './routes/functions.routes.js';
import responseImageRoutes from './routes/responseImage.routes.js';
import vehicleQuestionsRoutes from './routes/vehicle-questions.routes.js';
import plateToVinRoutes from './routes/plateToVin.js';
import serpRoutes from './routes/serp.routes.js';
import { VectorService } from './services/VectorService.js';
import { MemoryVectorService } from './services/MemoryVectorService.js';
import memoryVectorRoutes from './routes/memoryVector.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 5000;

// Connect to MongoDB first
console.log('Connecting to MongoDB...');
mongoose.connect(process.env.MONGO_DB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((error) => {
    console.error('MongoDB connection error:', error);
    process.exit(1); // Exit if we can't connect to the database
  });

const allowedOrigins = [
  'https://us-license-plate-to-vin.p.rapidapi.com',
  "http://127.0.0.1:5501/",
  'http://localhost:5173',
  'https://dist-4ibg6nara-robmit2023s-projects.vercel.app/backgrounddashboard',
  'https://b8a5-66-42-19-48.ngrok-free.app',
  'http://localhost:3000',
  'http://localhost:3500',
  'http://localhost:3005',
  'http://localhost:3001',
  'http://localhost:8080',
  'http://localhost:8081',
  'http://localhost:8000',
  'http://192.168.56.1:1234',
  'http://192.168.1.124:8000', // Supabase local URL
  'app://*',
  'file://*',
  'electron://*'
];

app.use(helmet({
  contentSecurityPolicy: false
}));

// Configure CORS for REST API
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());

// Initialize Blender functionality
initializeBlender(app);

app.use("/api/auth", authRoutes);
app.use("/api/research", researchRoutes);
app.use("/api/research", researchServiceRoutes);
app.use("/api/research/o3", researchO3ServiceRoutes);
app.use("/api/multiagent-research", multiagentResearchRoutes);
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
app.use('/api/forum-crawler', forumCrawlerRoutes);
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
app.use('/api/researchl', localResearchRoutes);
app.use('/api/rservice', localresearchServiceRoutes);
app.use('/api/embeddings', embeddingsRoutes);
app.use('/api', supabaseRoutes);
app.use('/api/vector-store', vectorStoreRoutes);
app.use('/api/openai', openaiRoutes);
app.use('/api/v1/responses', turnResponseRoutes);
app.use('/api/functions', functionRoutes);
app.use('/api', responseImageRoutes);
app.use("/api/vehicle-questions", vehicleQuestionsRoutes);
app.use('/api/license-plate', licensePlateRoutes);
app.use('/api/plate-to-vin', plateToVinRoutes);
app.use('/api/serp', serpRoutes);
app.use('/api/memory-vector', memoryVectorRoutes);

// Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
  customSiteTitle: "Automotive AI Platform API Documentation",
  customfavIcon: "/favicon.ico",
  customCss: '.swagger-ui .topbar { display: none }'
}));

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
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">🚗</div>
        <h1>Automotive AI Platform</h1>
        <p>Welcome to the Automotive AI Platform API. This is the backend service for our automotive intelligence system.</p>
      </div>
    </body>
    </html>
  `);
});

// API error handling
app.use('/api', (err, req, res, next) => {
  console.error('API error:', err);
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
    res.status(404).json({ message: "API endpoint not found" });
  });
}

// Initialize VectorService
async function initializeServices() {
  try {
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
  } catch (error) {
    console.error('Error initializing Vector Services:', error);
    // Don't exit - the server should still start, but vector services might be limited
  }
}

// Start the server
server.listen(PORT, async () => {
	console.log(`Server Running on port ${PORT}`);
	await initializeServices();
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

export default app;