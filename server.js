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
import lmStudioRoutes from './routes/lmStudio.routes.js';
import licensePlateRoutes from './routes/licensePlate.routes.js';
import authRoutes from "./routes/auth.routes.js";
import researchRoutes from './routes/research.routes.js';
import researchServiceRoutes from './routes/research.service.js';
import researchO3ServiceRoutes from './routes/research.o3.service.js';
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
  'http://localhost:5173',
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

app.use(express.json());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/research", researchRoutes);
app.use("/api/research", researchServiceRoutes);
app.use("/api/research/o3", researchO3ServiceRoutes);
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
app.use('/api', diagramRoutes);
app.use('/api', diagramGenerateRoutes);
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

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  },
  path: '/socket.io/',
  transports: ['websocket', 'polling']
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });

  socket.on('disconnect', (reason) => {
    console.log('Client disconnected:', socket.id, 'Reason:', reason);
  });
});

server.listen(PORT, () => {
  connectToMongoDB();
  console.log(`Server Running on port ${PORT}`);
});