import express from 'express';
import OpenAI from 'openai';
import { MODEL } from '../config/constants.js';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Ensure environment variables are loaded
dotenv.config();

const router = express.Router();

// Initialize OpenAI with API key from environment variables
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Middleware to log API requests
router.use((req, res, next) => {
  console.log(`API Request: ${req.method} ${req.originalUrl}`);
  // Check if OpenAI API key is set
  if (!process.env.OPENAI_API_KEY) {
    console.warn('⚠️ WARNING: OPENAI_API_KEY is not set in environment variables');
  }
  next();
});

// API route for GET /api/functions/get_joke
router.get('/functions/get_joke', async (req, res) => {
  try {
    // Fetch a programming joke
    const jokeRes = await fetch("https://v2.jokeapi.dev/joke/Programming");
    if (!jokeRes.ok) throw new Error("Failed to fetch joke");

    const jokeData = await jokeRes.json();

    // Format joke response based on its type
    const joke =
      jokeData.type === "twopart"
        ? `${jokeData.setup} - ${jokeData.delivery}`
        : jokeData.joke;

    return res.status(200).json({ joke });
  } catch (error) {
    console.error("Error fetching joke:", error);
    return res.status(500).json({ error: "Could not fetch joke" });
  }
});

// API route for GET /api/functions/get_weather
router.get('/functions/get_weather', async (req, res) => {
  try {
    const location = req.query.location;
    const unit = req.query.unit;

    // 1. Get coordinates for the city
    const geoRes = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${location}&format=json`
    );
    const geoData = await geoRes.json();

    if (!geoData.length) {
      return res.status(404).json({ error: "Invalid location" });
    }

    const { lat, lon } = geoData[0];

    // 2. Fetch weather data from Open-Meteo
    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m&temperature_unit=${
        unit ?? "celsius"
      }`
    );

    if (!weatherRes.ok) {
      throw new Error("Failed to fetch weather data");
    }

    const weather = await weatherRes.json();

    // 3. Get current UTC time in ISO format
    const now = new Date();
    const currentHourISO = now.toISOString().slice(0, 13) + ":00";

    // 4. Get current temperature
    const index = weather.hourly.time.indexOf(currentHourISO);
    const currentTemperature =
      index !== -1 ? weather.hourly.temperature_2m[index] : null;

    if (currentTemperature === null) {
      return res.status(500).json({ error: "Temperature data unavailable" });
    }

    return res.status(200).json({ temperature: currentTemperature });
  } catch (error) {
    console.error("Error getting weather:", error);
    return res.status(500).json({ error: "Error getting weather" });
  }
});

// API route for POST /api/turn_response
router.post('/turn_response', async (req, res) => {
  try {
    const { messages, tools } = req.body;
    console.log("Received messages:", messages);

    const events = await openai.responses.create({
      model: MODEL,
      input: messages,
      tools,
      stream: true,
      parallel_tool_calls: false,
    });

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // Stream the response
    for await (const event of events) {
      // Sending all events to the client
      const data = JSON.stringify({
        event: event.type,
        data: event,
      });
      res.write(`data: ${data}\n\n`);
    }
    
    // End the response
    res.end();
  } catch (error) {
    console.error("Error in POST handler:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// API route for POST /api/vector_stores/create_store
router.post('/vector_stores/create_store', async (req, res) => {
  const { name } = req.body;
  try {
    const vectorStore = await openai.vectorStores.create({
      name,
    });
    return res.status(200).json(vectorStore);
  } catch (error) {
    console.error("Error creating vector store:", error);
    return res.status(500).send("Error creating vector store");
  }
});

// API route for POST /api/vector_stores/add_file
router.post('/vector_stores/add_file', async (req, res) => {
  const { vectorStoreId, fileId } = req.body;
  try {
    const vectorStore = await openai.vectorStores.files.create(
      vectorStoreId,
      {
        file_id: fileId,
      }
    );
    return res.status(200).json(vectorStore);
  } catch (error) {
    console.error("Error adding file:", error);
    return res.status(500).send("Error adding file");
  }
});

// API route for POST /api/vector_stores/upload_file
router.post('/vector_stores/upload_file', async (req, res) => {
  try {
    const { fileObject } = req.body;
    
    if (!fileObject || !fileObject.content || !fileObject.name) {
      return res.status(400).json({
        error: "Invalid file object - must contain 'content' and 'name' properties"
      });
    }
    
    // Create a temporary file
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const tempDir = path.join(__dirname, '..', 'temp');
    
    // Create temp directory if it doesn't exist
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const tempFileName = `temp_${Date.now()}_${fileObject.name}`;
    const tempFilePath = path.join(tempDir, tempFileName);
    const fileBuffer = Buffer.from(fileObject.content, "base64");
    
    // Write buffer to temporary file
    fs.writeFileSync(tempFilePath, fileBuffer);
    
    // Use the OpenAI SDK to upload the file
    const file = await openai.files.create({
      file: fs.createReadStream(tempFilePath),
      purpose: "assistants",
    });
    
    // Clean up the temporary file
    fs.unlinkSync(tempFilePath);

    return res.status(200).json(file);
  } catch (error) {
    console.error("Error uploading file:", error);
    return res.status(500).json({
      error: "Error uploading file",
      message: error.message
    });
  }
});

// API route for GET /api/vector_stores/retrieve_store
router.get('/vector_stores/retrieve_store', async (req, res) => {
  const vectorStoreId = req.query.vector_store_id;
  try {
    const vectorStore = await openai.vectorStores.retrieve(
      vectorStoreId || ""
    );
    return res.status(200).json(vectorStore);
  } catch (error) {
    console.error("Error fetching vector store:", error);
    return res.status(500).send("Error fetching vector store");
  }
});

// API route for GET /api/vector_stores/list_files
router.get('/vector_stores/list_files', async (req, res) => {
  const vectorStoreId = req.query.vector_store_id;

  try {
    const vectorStore = await openai.vectorStores.files.list(
      vectorStoreId || ""
    );
    return res.status(200).json(vectorStore);
  } catch (error) {
    console.error("Error fetching files:", error);
    return res.status(500).send("Error fetching files");
  }
});

// API route for GET /api/container_files/content
router.get('/container_files/content', async (req, res) => {
  const fileId = req.query.file_id;
  const containerId = req.query.container_id;
  const filename = req.query.filename;
  
  if (!fileId) {
    return res.status(400).json({ error: "Missing file_id" });
  }
  
  try {
    const url = containerId
      ? `https://api.openai.com/v1/containers/${containerId}/files/${fileId}/content`
      : `https://api.openai.com/v1/container-files/${fileId}/content`;
    
    // Log API call for debugging
    console.log(`Fetching container file from ${url}`);
    console.log(`Using OpenAI API key: ${process.env.OPENAI_API_KEY ? 'Key is set (not showing for security)' : 'Key is NOT set'}`);
    
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
    });
    
    if (!response.ok) throw new Error(`Failed to fetch file: ${response.status}`);
    
    // Get the response as an array buffer and convert to Buffer
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Set appropriate headers
    res.setHeader('Content-Type', response.headers.get('Content-Type') || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename=${filename ?? fileId}`);
    
    // Send the file content
    return res.send(buffer);
  } catch (err) {
    console.error("Error fetching container file", err);
    return res.status(500).json({ error: "Failed to fetch file" });
  }
});

// API health check route
router.get('/health', async (req, res) => {
  try {
    const openaiApiKeyStatus = process.env.OPENAI_API_KEY 
      ? 'Available' 
      : 'Missing - API calls will fail';
      
    res.status(200).json({
      status: 'OK',
      message: 'API routes are working correctly',
      timestamp: new Date().toISOString(),
      openaiApiKeyStatus: openaiApiKeyStatus,
      routes: [
        '/api/functions/get_joke',
        '/api/functions/get_weather',
        '/api/turn_response',
        '/api/vector_stores/create_store',
        '/api/vector_stores/add_file',
        '/api/vector_stores/upload_file',
        '/api/vector_stores/retrieve_store',
        '/api/vector_stores/list_files',
        '/api/container_files/content',
        '/api/openai/assistants'
      ]
    });
  } catch (error) {
    res.status(500).json({
      status: 'Error',
      message: 'API routes health check failed',
      error: error.message
    });
  }
});

export default router;