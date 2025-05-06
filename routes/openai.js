import express from 'express';
import OpenAI from 'openai';
import axios from 'axios';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import ImageAnalysis from '../models/imageAnalysis.model.js';
import sharp from 'sharp';

dotenv.config();

const router = express.Router();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Set up multer storage for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max file size
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

/**
 * POST /api/openai/upload-image
 * 
 * Handles image uploads, resizes them if needed, saves them to the server, and returns the URL
 * 
 * Expects a multipart form data with:
 *  - image: The image file to upload
 * 
 * Returns:
 *  - { imageUrl: string } on success
 *  - { error: string } on failure
 */
router.post('/upload-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }

    const imagePath = path.join(process.cwd(), 'uploads', req.file.filename);
    
    // Get original image size
    const originalStats = fs.statSync(imagePath);
    const originalSizeInMB = originalStats.size / (1024 * 1024);
    console.log(`Original image size: ${originalSizeInMB.toFixed(2)} MB`);
    
    // Resize image if larger than 800px on any dimension and convert to JPEG
    let imageBuffer;
    try {
      // Process the image with Sharp - resize and optimize
      imageBuffer = await sharp(imagePath)
        .resize({
          width: 800,  // Max width of 800px
          height: 800, // Max height of 800px
          fit: 'inside', // Maintain aspect ratio
          withoutEnlargement: true // Don't enlarge smaller images
        })
        .jpeg({ quality: 80 }) // Convert to JPEG with 80% quality
        .toBuffer();
      
      // Save the resized image back to disk
      await fs.promises.writeFile(imagePath, imageBuffer);
      
      console.log(`Resized image saved to ${imagePath}`);
    } catch (resizeError) {
      console.error('Error resizing image:', resizeError);
      // If resize fails, use the original file
      imageBuffer = await fs.promises.readFile(imagePath);
    }
    
    // Convert to base64
    const base64Image = imageBuffer.toString('base64');
    const contentType = 'image/jpeg'; // After resize, it's always JPEG
    const dataUri = `data:${contentType};base64,${base64Image}`;
    
    // Log the image size
    const sizeInMB = imageBuffer.length / (1024 * 1024);
    console.log(`Processed image size: ${sizeInMB.toFixed(2)} MB (${imageBuffer.length} bytes)`);
    
    // Check image size for OpenAI limit (20MB)
    if (sizeInMB > 20) {
      return res.status(400).json({
        error: 'Image size exceeds OpenAI limit of 20MB',
        details: `Image is ${sizeInMB.toFixed(2)} MB, must be under 20MB`
      });
    }

    // Create server URL for reference (not used for OpenAI)
    const serverUrl = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 5000}`;
    const imageUrl = `${serverUrl}/uploads/${req.file.filename}`;

    return res.status(200).json({
      imageUrl: dataUri, // Return the base64 data URI instead of a URL
      originalUrl: imageUrl, // Keep the original URL for reference
      contentType: contentType,
      filename: req.file.filename,
      sizeInMB: sizeInMB.toFixed(2)
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    return res.status(500).json({
      error: 'Failed to upload image',
      details: error.message
    });
  }
});

/**
 * 
 * 
 * Route for The main dashboard, user drops in an image, the explination will be sent to the realtime voice
 * agent int the appiication. 
 */
router.post('/dashboard-image', async (req, res) => {
  const { imageUrl, prompt } = req.body;

  // Validate required fields
  if (!imageUrl || !prompt) {
    return res.status(400).json({ 
      error: 'Missing required fields',
      details: 'Both imageUrl and prompt are required'
    });
  }

  try {
    console.log('Processing image explanation request...');
    
    // Create a system message for automotive technical advisor
    const systemMessage = "You are an Automotive Expert";

    // Clean up user prompt - remove any "You are..." preambles
    let cleanedPrompt = prompt;
    if (prompt.toLowerCase().includes('you are an automotive expert') || 
        prompt.toLowerCase().includes('you are a mechanic') || 
        prompt.toLowerCase().includes('as an automotive')) {
      // Extract just the actual question/request part after these introductions
      const promptParts = prompt.split('.');
      if (promptParts.length > 1) {
        // Skip the "You are..." introduction and use the rest
        cleanedPrompt = promptParts.slice(1).join('.').trim();
        console.log(`Cleaned up prompt from: "${prompt}" to: "${cleanedPrompt}"`);
      }
    }

    // For initial requests, we don't send a conversation_id so OpenAI will generate a new one
    const requestPayload = {
      model: "gpt-4o",
      user: "Technician",
      input: [{
        role: "system",
        content: [
          { type: "input_text", text: systemMessage }
        ]
      }, {
        role: "user",
        content: [
          { type: "input_text", text: `As an Automotive Technical Advisor, provide a definitive technical analysis of this image. ${cleanedPrompt} State facts directly and include specific measurements, specifications, and relevant technical details.` },
          { type: "input_image", image_url: imageUrl }
        ],
        stream: true,
      }],
      max_output_tokens: 1000
    };
    
    // Only add conversation_id if one was explicitly provided
    if (req.body.conversationId) {
      console.log(`Using existing conversation ID: ${req.body.conversationId}`);
      requestPayload.conversation_id = req.body.conversationId;
    } else {
      console.log('No conversation ID provided, a new one will be generated');
    }

    // Create a response using the Responses API
    const response = await openai.responses.create(requestPayload);
    
    console.log(`Response received with conversation ID: ${response.conversation_id}`);
    
    // Ensure we have a valid conversationId to satisfy MongoDB validation
    const conversationId = response.conversation_id || `fallback-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    
    // Return the response with the conversation ID prominently included
    return res.status(200).json({
      explanation: response.output_text,
      responseId: response.id,
      conversationId: conversationId,
      status: 'success'
    });

  } catch (error) {
    console.error('Error processing image explanation:', error);
    
    // Provide more specific error messages
    if (error.response) {
      return res.status(error.response.status).json({
        error: 'Failed to process image',
        details: error.response.data || error.message
      });
    }
    
    return res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/openai/explain-image
 * 
 * Unified endpoint that handles both base64 and URL-based image processing using the Responses API
 * 
 * Expects a JSON body containing:
 *  - imageUrl: URL of the image to analyze or base64 data URI
 *  - prompt: Specific question or instruction about the image
 *  - userId: (optional) ID of the user making the request
 * 
 * Returns:
 *  - { explanation: string, responseId: string, conversationId: string, status: string } on success
 *  - { error: string, details?: string } on failure
 */
router.post('/explain-image', async (req, res) => {
  const { imageUrl, prompt, userId } = req.body;

  // Validate required fields
  if (!imageUrl || !prompt) {
    return res.status(400).json({ 
      error: 'Missing required fields',
      details: 'Both imageUrl and prompt are required'
    });
  }

  try {
    console.log('Processing image explanation request...');
    
    // First, check if we already have this analysis in the database
    const existingAnalysis = await ImageAnalysis.findOne({ 
      imageUrl, 
      prompt 
    }).sort({ createdAt: -1 }).exec();

    // If we have a recent analysis (less than 24 hours old), return it
    if (existingAnalysis && 
        (new Date() - new Date(existingAnalysis.createdAt)) < 24 * 60 * 60 * 1000) {
      console.log(`Using cached analysis for image with ID: ${existingAnalysis._id}`);
      
      return res.status(200).json({
        explanation: existingAnalysis.explanation,
        responseId: existingAnalysis.responseId,
        conversationId: existingAnalysis.conversationId,
        status: 'success',
        fromCache: true
      });
    }
    
    // Create a system message for automotive technical advisor
    const systemMessage = "You are an expert Automotive Technical Advisor with extensive knowledge in vehicle systems, diagnostics, and technical specifications. Your responses must be direct, definitive, and authoritative. Never use tentative language like 'appears to be' or 'seems to be'. Instead, state facts directly and confidently. Focus on providing precise technical information, including specific measurements, specifications, and industry-standard terminology. Maintain a professional tone while delivering clear, assertive analysis.";

    // Clean up user prompt - remove any "You are..." preambles
    let cleanedPrompt = prompt;
    if (prompt.toLowerCase().includes('you are an automotive expert') || 
        prompt.toLowerCase().includes('you are a mechanic') || 
        prompt.toLowerCase().includes('as an automotive')) {
      // Extract just the actual question/request part after these introductions
      const promptParts = prompt.split('.');
      if (promptParts.length > 1) {
        // Skip the "You are..." introduction and use the rest
        cleanedPrompt = promptParts.slice(1).join('.').trim();
        console.log(`Cleaned up prompt from: "${prompt}" to: "${cleanedPrompt}"`);
      }
    }

    // For initial requests, we don't send a conversation_id so OpenAI will generate a new one
    const requestPayload = {
      model: "gpt-4o",
      user: "Technician",
      input: [{
        role: "system",
        content: [
          { type: "input_text", text: systemMessage }
        ]
      }, {
        role: "user",
        content: [
          { type: "input_text", text: `As an Automotive Technical Advisor, provide a definitive technical analysis of this image. ${cleanedPrompt} State facts directly and include specific measurements, specifications, and relevant technical details.` },
          { type: "input_image", image_url: imageUrl }
        ],
        
      }],
      max_output_tokens: 1000
    };
    
    // Only add conversation_id if one was explicitly provided
    if (req.body.conversationId) {
      console.log(`Using existing conversation ID: ${req.body.conversationId}`);
      requestPayload.conversation_id = req.body.conversationId;
    } else {
      console.log('No conversation ID provided, a new one will be generated');
    }

    // Create a response using the Responses API
    const response = await openai.responses.create(requestPayload);
    
    console.log(`Response received with conversation ID: ${response.conversation_id}`);
    
    // Ensure we have a valid conversationId to satisfy MongoDB validation
    const conversationId = response.conversation_id || `fallback-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    
    // Save the analysis to the database
    const newAnalysis = new ImageAnalysis({
      imageUrl,
      prompt,
      explanation: response.output_text,
      responseId: response.id,
      conversationId: conversationId,
      userId: userId || null,
      metadata: {
        model: requestPayload.model,
        timestamp: new Date().toISOString()
      }
    });
    
    await newAnalysis.save();
    console.log(`Saved image analysis to database with ID: ${newAnalysis._id}`);
    
    // Return the response with the conversation ID prominently included
    return res.status(200).json({
      explanation: response.output_text,
      responseId: response.id,
      conversationId: conversationId,
      status: 'success'
    });

  } catch (error) {
    console.error('Error processing image explanation:', error);
    
    // Provide more specific error messages
    if (error.response) {
      return res.status(error.response.status).json({
        error: 'Failed to process image',
        details: error.response.data || error.message
      });
    }
    
    return res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/openai/explain-image/follow-up
 * 
 * Answers follow-up questions about a previously explained image using the Responses API
 * 
 * Expects a JSON body containing:
 *  - imageUrl: URL of the image being discussed
 *  - question: The follow-up question from the user
 *  - conversationId: The conversation ID from the previous explanation
 *  - context: (optional) Additional context like vehicle information
 * 
 * Returns:
 *  - { answer: string, responseId: string, conversationId: string, status: string } on success
 *  - { error: string, details?: string } on failure
 */
router.post('/explain-image/follow-up', async (req, res) => {
  const { imageUrl, question, conversationId, context } = req.body;

  // Validate required fields
  if (!imageUrl || !question) {
    return res.status(400).json({ 
      error: 'Missing required fields',
      details: 'Both imageUrl and question are required'
    });
  }

  try {
    console.log('--------------------------------------------');
    console.log(`Processing follow-up question for previous analysis: ${conversationId}`);
    console.log(`Question: "${question}"`);
    console.log(`Image URL: ${imageUrl.substring(0, 50)}...`);
    
    // Prepare context for the vehicle if available
    let userMessage = question;
    if (context) {
      const vehicleInfo = `Vehicle Information: ${context.vehicleYear || ''} ${context.vehicleMake || ''} ${context.vehicleModel || ''} ${context.vehicleEngine ? `with ${context.vehicleEngine} engine` : ''}`;
      userMessage = `${vehicleInfo}\n\n${question}`;
      console.log(`Added vehicle context: ${vehicleInfo}`);
    }

    // Instead of using conversation_id, we'll use a system message to establish context
    const systemMessage = "You are an expert Automotive Technical Advisor. This is a follow-up question about an automotive part or system shown in the image. Maintain context from any previous explanations but focus on answering this specific question directly and authoritatively.";

    // Create request payload without conversation_id
    const requestPayload = {
      model: "gpt-4o",
      user: "Technician",
      input: [{
        role: "system",
        content: [
          { type: "input_text", text: systemMessage }
        ]
      }, {
        role: "user",
        content: [
          { type: "input_text", text: `This is a follow-up question about the automotive component in the image. Previous conversation ID was: ${conversationId}. The question is: ${userMessage}` },
          { type: "input_image", image_url: imageUrl }
        ]
      }],
      max_output_tokens: 1500
    };
    
    console.log('Sending follow-up request to OpenAI with payload:');
    console.log(JSON.stringify({
      ...requestPayload,
      input: requestPayload.input.map(item => ({
        ...item,
        content: item.content.map(c => 
          c.type === 'input_image' ? 
          { type: c.type, image_url: '[IMAGE_URL_REDACTED]' } : 
          c
        )
      }))
    }, null, 2));

    // Create a response using the Responses API
    const response = await openai.responses.create(requestPayload);
    
    // Generate a new conversation ID if none returned
    const responseConversationId = response.conversation_id || `fallback-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    
    console.log(`Follow-up response received with ID: ${response.id}`);
    console.log(`Response text length: ${response.output_text.length} characters`);
    console.log('--------------------------------------------');

    return res.status(200).json({
      answer: response.output_text,
      responseId: response.id,
      conversationId: responseConversationId,
      status: 'success'
    });

  } catch (error) {
    console.error('Error processing follow-up question:', error);
    
    // Provide more specific error messages
    if (error.response) {
      return res.status(error.response.status).json({
        error: 'Failed to process follow-up question',
        details: error.response.data || error.message
      });
    }
    
    return res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/openai/validate-image
 * 
 * Validates and processes an image URL to ensure it works with OpenAI endpoints
 * 
 * Expects a JSON body containing:
 *  - imageUrl: URL of the image to validate
 * 
 * Returns:
 *  - { isValid: boolean, processedUrl?: string, error?: string } on success
 */
router.post('/validate-image', async (req, res) => {
  const { imageUrl } = req.body;

  if (!imageUrl) {
    return res.status(400).json({
      isValid: false,
      error: 'Image URL is required'
    });
  }

  // Already a data URI, just validate it
  if (imageUrl.startsWith('data:image/')) {
    try {
      const dataUriParts = imageUrl.match(/^data:([^;]+);base64,(.*)$/);
      if (!dataUriParts) {
        return res.status(400).json({
          isValid: false,
          error: 'Invalid data URI format'
        });
      }
      
      const contentType = dataUriParts[1];
      const base64Data = dataUriParts[2];
      
      // Validate base64
      try {
        const buffer = Buffer.from(base64Data, 'base64');
        const sizeInBytes = buffer.length;
        const sizeInMB = sizeInBytes / (1024 * 1024);
        
        console.log(`Image size: ${sizeInMB.toFixed(2)} MB (${sizeInBytes} bytes)`);
        
        // Check if image exceeds OpenAI's limit (20MB)
        if (sizeInMB > 20) {
          return res.status(400).json({
            isValid: false,
            error: `Image size (${sizeInMB.toFixed(2)} MB) exceeds OpenAI's 20MB limit`
          });
        }
      } catch (e) {
        return res.status(400).json({
          isValid: false,
          error: 'Invalid base64 encoding'
        });
      }
      
      return res.status(200).json({
        isValid: true,
        processedUrl: imageUrl,
        contentType: contentType
      });
    } catch (error) {
      return res.status(400).json({
        isValid: false,
        error: 'Invalid data URI'
      });
    }
  }

  try {
    // Add URL validation
    try {
      new URL(imageUrl);
    } catch (e) {
      return res.status(400).json({
        isValid: false,
        error: 'Invalid URL format'
      });
    }

    // Validate the URL and get the image with timeout
    const imageResponse = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 5000 // 5 second timeout
    });

    // Validate content type
    const contentType = imageResponse.headers['content-type'];
    if (!contentType || !contentType.startsWith('image/')) {
      return res.status(400).json({
        isValid: false,
        error: `URL does not point to a valid image. Content type: ${contentType}`
      });
    }

    // Check image size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (imageResponse.data.length > maxSize) {
      return res.status(400).json({
        isValid: false,
        error: 'Image size exceeds maximum limit of 10MB'
      });
    }

    // Log image size
    const sizeInBytes = imageResponse.data.length;
    const sizeInMB = sizeInBytes / (1024 * 1024);
    console.log(`External image size: ${sizeInMB.toFixed(2)} MB (${sizeInBytes} bytes)`);

    // Convert to base64 for OpenAI compatibility
    const base64Image = Buffer.from(imageResponse.data).toString('base64');
    const processedUrl = `data:${contentType};base64,${base64Image}`;

    return res.status(200).json({
      isValid: true,
      processedUrl,
      contentType
    });

  } catch (error) {
    console.error('Error validating image:', error);
    
    // More specific error messages
    if (error.code === 'ECONNABORTED') {
      return res.status(408).json({
        isValid: false,
        error: 'Request timeout while fetching image'
      });
    }
    
    if (error.response) {
      return res.status(error.response.status).json({
        isValid: false,
        error: `Failed to fetch image: ${error.response.statusText}`
      });
    }
    
    return res.status(500).json({
      isValid: false,
      error: 'Failed to validate image'
    });
  }
});

/**
 * POST /api/openai/question-with-image
 * 
 * Handles user questions about automotive components/systems and returns both technical explanation
 * and relevant technical diagrams.
 * 
 * Expects a JSON body containing:
 *  - question: The user's technical question about a vehicle component or system
 *  - context: (optional) Additional context like vehicle make, model, year
 * 
 * Returns:
 *  - { textResponse: string, sources: array, images: array } on success
 *  - { error: string } on failure
 */
router.post('/question-with-image', async (req, res) => {
  const { question, context } = req.body;

  if (!question) {
    return res.status(400).json({ error: 'Question is required' });
  }

  try {
    // Enhance the question with automotive context
    const enhancedQuestion = context ? 
      `${question} for a ${context.year || ''} ${context.make || ''} ${context.model || ''}`.trim() :
      question;

    // Create a system message focused on automotive technical expertise
    const systemMessage = `You are an expert Automotive Technical Advisor specializing in vehicle systems, 
    components, and technical documentation. When analyzing questions:
    1. Focus on finding the most relevant technical diagrams and schematics
    2. Explain the diagrams and schematics and how they relate to the question
    3. Emphasize safety-critical information when relevant
    4. The Diagrams have to have meta data that is relevant to the question
    5. Use industry-standard terminology`;

    // Use the Responses API instead of Chat Completions
    const response = await openai.responses.create({
      model: "gpt-4o",
      user: "Technician",
      input: [{
        role: "system",
        content: [
          { type: "input_text", text: systemMessage }
        ]
      }, {
        role: "user",
        content: [
          { type: "input_text", text: `Get technical diagrams for the following question: ${enhancedQuestion}. Include specific references to technical diagrams that would be helpful.` }
        ]
      }],
      max_output_tokens: 1000
    });

    if (!response || !response.output_text) {
      throw new Error('No response received from OpenAI');
    }

    const textResponse = response.output_text;

    // Now perform a web search to find relevant diagrams
    const searchQuery = `${enhancedQuestion} technical diagram schematic automotive`;
    let images = [];
    let sources = [];

    try {
      // Use axios to perform a web search (you might want to use a proper search API here)
      const searchResponse = await axios.get('https://www.googleapis.com/customsearch/v1', {
        params: {
          key: process.env.GOOGLE_API_KEY,
          cx: process.env.GOOGLE_SEARCH_ENGINE_ID,
          q: searchQuery,
          searchType: 'image',
          num: 5,
          imgType: 'photo',
          safe: 'active'
        }
      });

      if (searchResponse.data && searchResponse.data.items) {
        images = searchResponse.data.items
          .filter(item => {
            const url = item.link.toLowerCase();
            return url.endsWith('.jpg') || 
                   url.endsWith('.jpeg') || 
                   url.endsWith('.png') || 
                   url.endsWith('.gif');
          })
          .map(item => ({
            url: item.link,
            title: item.title,
            source: item.image.contextLink
          }));

        // Add sources
        sources = searchResponse.data.items.map(item => ({
          title: item.title,
          url: item.image.contextLink
        }));
      }
    } catch (searchError) {
      console.error('Error performing image search:', searchError);
      // Continue without images if search fails
    }

    // Convert image URLs to use our proxy
    const proxiedImages = images.map(img => ({
      ...img,
      url: `/api/openai/proxy-image?url=${encodeURIComponent(img.url)}`
    }));

    return res.status(200).json({
      textResponse,
      responseId: response.id,
      conversationId: response.conversation_id,
      sources,
      images: proxiedImages
    });

  } catch (error) {
    console.error('Error in question-with-image:', error);

    // Handle specific OpenAI API errors
    if (error.response?.status === 429) {
      return res.status(429).json({
        error: 'Rate limit exceeded. Please try again later.',
        details: error.message
      });
    }

    if (error.response?.status === 400) {
      return res.status(400).json({
        error: 'Invalid request to AI service',
        details: error.message
      });
    }

    // Handle network errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ECONNABORTED') {
      return res.status(503).json({
        error: 'Service temporarily unavailable',
        details: 'Could not connect to AI service'
      });
    }

    return res.status(500).json({ 
      error: 'Failed to process request',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * POST /api/openai/question
 * 
 * Handles user questions about automotive components/systems and returns technical explanation
 * without using Google Custom Search API for image retrieval.
 * 
 * Expects a JSON body containing:
 *  - question: The user's technical question about a vehicle component or system
 *  - context: (optional) Additional context like vehicle make, model, year
 * 
 * Returns:
 *  - { textResponse: string, sources: array, images: array } on success
 *  - { error: string } on failure
 */
router.post('/question', async (req, res) => {
  const { question, context } = req.body;

  if (!question) {
    return res.status(400).json({ error: 'Question is required' });
  }

  try {
    // Enhance the question with automotive context
    const enhancedQuestion = context ? 
      `${question} for a ${context.year || ''} ${context.make || ''} ${context.model || ''}`.trim() :
      question;

    // Create a system message focused on automotive technical expertise
    const systemMessage = `You are an expert Automotive Technical Advisor specializing in vehicle systems, 
    components, and technical documentation. When analyzing questions:
    1. Focus on finding the most relevant technical diagrams and schematics
    2. Explain the diagrams and schematics and how they relate to the question
    3. Emphasize safety-critical information when relevant
    4. Provide detailed explanations about the relevant components and systems
    5. Use industry-standard terminology`;

    // Use the Responses API 
    const response = await openai.responses.create({
      model: "gpt-4o",
      user: "Technician",
      input: [{
        role: "system",
        content: [
          { type: "input_text", text: systemMessage }
        ]
      }, {
        role: "user",
        content: [
          { type: "input_text", text: `Answer the following question: ${enhancedQuestion}. Include specific references to technical diagrams that would be helpful.` }
        ]
      }],
      max_output_tokens: 1000
    });

    if (!response || !response.output_text) {
      throw new Error('No response received from OpenAI');
    }

    const textResponse = response.output_text;

    // Return the response with empty images and sources arrays
    // to maintain API compatibility with question-with-image endpoint
    return res.status(200).json({
      textResponse,
      responseId: response.id,
      conversationId: response.conversation_id,
      sources: [],
      images: []
    });

  } catch (error) {
    console.error('Error in question endpoint:', error);

    // Handle specific OpenAI API errors
    if (error.response?.status === 429) {
      return res.status(429).json({
        error: 'Rate limit exceeded. Please try again later.',
        details: error.message
      });
    }

    if (error.response?.status === 400) {
      return res.status(400).json({
        error: 'Invalid request to AI service',
        details: error.message
      });
    }

    // Handle network errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ECONNABORTED') {
      return res.status(503).json({
        error: 'Service temporarily unavailable',
        details: 'Could not connect to AI service'
      });
    }

    return res.status(500).json({ 
      error: 'Failed to process request',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * GET /api/openai/proxy-image
 * 
 * Proxies an image from an external URL to handle CORS and security concerns.
 * 
 * Query Parameters:
 *  - url: The URL of the image to proxy
 * 
 * Returns:
 *  - The image data with appropriate content type
 *  - Various error status codes on failure
 */
router.get('/proxy-image', async (req, res) => {
  try {
    const imageUrl = req.query.url;
    
    if (!imageUrl || typeof imageUrl !== 'string') {
      return res.status(400).json({
        error: 'URL parameter is required and must be a string'
      });
    }

    // Validate URL format
    try {
      new URL(imageUrl);
    } catch (e) {
      return res.status(400).json({
        error: 'Invalid URL format'
      });
    }

    // Fetch the image with axios
    const response = await axios({
      method: 'get',
      url: imageUrl,
      responseType: 'stream',
      timeout: 5000, // 5 second timeout
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    // Validate content type
    const contentType = response.headers['content-type'];
    if (!contentType || !contentType.startsWith('image/')) {
      return res.status(400).json({
        error: 'URL does not point to a valid image'
      });
    }

    // Set appropriate headers
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour

    // Stream the response
    response.data.pipe(res);
  } catch (error) {
    console.error('Proxy image error:', error);

    // Handle specific error cases
    if (error.code === 'ECONNABORTED') {
      return res.status(408).json({
        error: 'Request timeout while fetching image'
      });
    }

    if (error.response) {
      return res.status(error.response.status).json({
        error: `Failed to fetch image: ${error.response.statusText}`
      });
    }

    return res.status(500).json({
      error: 'Error proxying image',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/openai/test-google-search
 * 
 * Test endpoint to verify Google Custom Search API setup
 * 
 * Returns:
 *  - { success: true, images: array } on success
 *  - { error: string } on failure
 */
router.get('/test-google-search', async (req, res) => {
  try {
    // Verify environment variables
    if (!process.env.GOOGLE_API_KEY || !process.env.GOOGLE_SEARCH_ENGINE_ID) {
      return res.status(500).json({
        error: 'Google API credentials not configured',
        details: 'Please check GOOGLE_API_KEY and GOOGLE_SEARCH_ENGINE_ID in .env file'
      });
    }

    // Test search query
    const searchResponse = await axios.get('https://www.googleapis.com/customsearch/v1', {
      params: {
        key: process.env.GOOGLE_API_KEY,
        cx: process.env.GOOGLE_SEARCH_ENGINE_ID,
        q: 'car engine diagram',
        searchType: 'image',
        num: 3,
        imgType: 'photo',
        safe: 'active'
      }
    });

    if (!searchResponse.data || !searchResponse.data.items) {
      return res.status(500).json({
        error: 'Invalid response from Google API',
        details: searchResponse.data
      });
    }

    const images = searchResponse.data.items.map(item => ({
      url: item.link,
      title: item.title,
      thumbnail: item.image.thumbnailLink,
      source: item.image.contextLink
    }));

    return res.status(200).json({
      success: true,
      images
    });

  } catch (error) {
    console.error('Google Search API test error:', error);

    if (error.response?.data?.error?.message) {
      return res.status(500).json({
        error: 'Google API Error',
        details: error.response.data.error.message
      });
    }

    return res.status(500).json({
      error: 'Failed to test Google Search API',
      details: error.message
    });
  }
});

/**
 * GET /api/openai/image-analysis/:conversationId
 * 
 * Retrieves saved image analyses by conversation ID
 * 
 * Query Parameters:
 *  - userId: (optional) Filter by user ID
 * 
 * Returns:
 *  - { analyses: Array } on success
 *  - { error: string } on failure
 */
router.get('/image-analysis/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { userId } = req.query;
    
    if (!conversationId) {
      return res.status(400).json({ 
        error: 'Missing conversationId parameter'
      });
    }
    
    const query = { conversationId };
    
    // Add userId filter if provided
    if (userId) {
      query.userId = userId;
    }
    
    const analyses = await ImageAnalysis.find(query)
      .sort({ createdAt: -1 })
      .limit(10);
      
    if (!analyses || analyses.length === 0) {
      return res.status(404).json({
        error: 'No image analyses found with the specified conversationId'
      });
    }
    
    return res.status(200).json({
      analyses: analyses.map(analysis => ({
        id: analysis._id,
        imageUrl: analysis.imageUrl,
        prompt: analysis.prompt,
        explanation: analysis.explanation,
        responseId: analysis.responseId,
        conversationId: analysis.conversationId,
        createdAt: analysis.createdAt,
        metadata: analysis.metadata
      }))
    });
    
  } catch (error) {
    console.error('Error retrieving image analyses:', error);
    return res.status(500).json({
      error: 'Failed to retrieve image analyses',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/openai/image-analysis/by-image
 * 
 * Retrieves saved image analyses by image URL and optional prompt
 * 
 * Query Parameters:
 *  - imageUrl: The URL of the image
 *  - prompt: (optional) The exact prompt used for analysis
 * 
 * Returns:
 *  - { analyses: Array } on success
 *  - { error: string } on failure
 */
router.get('/image-analysis/by-image', async (req, res) => {
  try {
    const { imageUrl, prompt } = req.query;
    
    if (!imageUrl) {
      return res.status(400).json({ 
        error: 'Missing imageUrl parameter'
      });
    }
    
    const query = { imageUrl };
    
    // Add prompt filter if provided
    if (prompt) {
      query.prompt = prompt;
    }
    
    const analyses = await ImageAnalysis.find(query)
      .sort({ createdAt: -1 })
      .limit(5);
      
    if (!analyses || analyses.length === 0) {
      return res.status(404).json({
        error: 'No image analyses found for the specified image URL'
      });
    }
    
    return res.status(200).json({
      analyses: analyses.map(analysis => ({
        id: analysis._id,
        imageUrl: analysis.imageUrl,
        prompt: analysis.prompt,
        explanation: analysis.explanation,
        responseId: analysis.responseId,
        conversationId: analysis.conversationId,
        createdAt: analysis.createdAt,
        metadata: analysis.metadata
      }))
    });
    
  } catch (error) {
    console.error('Error retrieving image analyses by image URL:', error);
    return res.status(500).json({
      error: 'Failed to retrieve image analyses',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * components:
 *   schemas:
 *     OpenAIResponse:
 *       type: object
 *       required:
 *         - prompt
 *       properties:
 *         prompt:
 *           type: string
 *           description: The input prompt
 *         response:
 *           type: string
 *           description: The AI-generated response
 *         model:
 *           type: string
 *           description: The OpenAI model used
 *         tokens:
 *           type: integer
 *           description: Number of tokens used
 *         temperature:
 *           type: number
 *           format: float
 *           description: Temperature setting for generation
 */

/**
 * @swagger
 * /api/openai/chat:
 *   post:
 *     summary: Generate a chat response using OpenAI
 *     tags: [OpenAI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - prompt
 *             properties:
 *               prompt:
 *                 type: string
 *                 description: The chat prompt
 *               model:
 *                 type: string
 *                 enum: [gpt-3.5-turbo, gpt-4]
 *                 description: OpenAI model to use
 *               temperature:
 *                 type: number
 *                 format: float
 *                 minimum: 0
 *                 maximum: 2
 *                 description: Controls randomness in the response
 *               maxTokens:
 *                 type: integer
 *                 description: Maximum number of tokens to generate
 *     responses:
 *       200:
 *         description: Chat response generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OpenAIResponse'
 *       400:
 *         description: Invalid input
 *       429:
 *         description: Rate limit exceeded
 */

/**
 * @swagger
 * /api/openai/completion:
 *   post:
 *     summary: Generate a text completion using OpenAI
 *     tags: [OpenAI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - prompt
 *             properties:
 *               prompt:
 *                 type: string
 *                 description: The completion prompt
 *               model:
 *                 type: string
 *                 enum: [text-davinci-003, gpt-3.5-turbo-instruct]
 *                 description: OpenAI model to use
 *               temperature:
 *                 type: number
 *                 format: float
 *                 minimum: 0
 *                 maximum: 2
 *                 description: Controls randomness in the response
 *               maxTokens:
 *                 type: integer
 *                 description: Maximum number of tokens to generate
 *     responses:
 *       200:
 *         description: Completion generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OpenAIResponse'
 *       400:
 *         description: Invalid input
 *       429:
 *         description: Rate limit exceeded
 */

export default router;