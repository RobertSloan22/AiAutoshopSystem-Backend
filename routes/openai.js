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
 *  - stream: (optional) Boolean flag to request streaming response (default: false)
 * 
 * Returns:
 *  - For non-streaming: { explanation: string, responseId: string, conversationId: string, status: string } on success
 *  - For streaming: Server-Sent Events stream with content chunks
 *  - { error: string, details?: string } on failure
 */
router.post('/explain-image', async (req, res) => {
  const { imageUrl, prompt, userId, stream: shouldStream = false } = req.body;

  // Validate required fields
  if (!imageUrl || !prompt) {
    return res.status(400).json({ 
      error: 'Missing required fields',
      details: 'Both imageUrl and prompt are required'
    });
  }

  try {
    console.log('Processing image explanation request...');
    console.log(`Stream mode: ${shouldStream ? 'enabled' : 'disabled'}`);
    
    // For streaming requests, don't check cache
    if (!shouldStream) {
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
        ]
      }],
      max_output_tokens: 1000
    };
    
    // Add streaming option if requested
    if (shouldStream) {
      requestPayload.stream = true;
    }
    
    // Only add conversation_id if one was explicitly provided
    if (req.body.conversationId) {
      console.log(`Using existing conversation ID: ${req.body.conversationId}`);
      requestPayload.conversation_id = req.body.conversationId;
    } else {
      console.log('No conversation ID provided, a new one will be generated');
    }

    // Handle streaming response
    if (shouldStream) {
      // Set headers for Server-Sent Events
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });
      
      // Create streaming response
      const stream = await openai.responses.create(requestPayload);
      
      // Generate a conversation ID for this analysis
      const conversationId = stream.conversation_id || `img-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      
      // Send session ID first
      res.write(`data: ${JSON.stringify({ 
        type: 'session_started', 
        sessionId: conversationId,
        messageType: 'image_analysis'
      })}\n\n`);
      
      // Setup content buffering
      let contentBuffer = '';
      let lastFlushTime = Date.now();
      let flushTimeout = null;
      let accumulationStartTime = Date.now();
      let fullText = ''; // Keep track of the full response for saving to DB
      
      const flushContentBuffer = () => {
        if (contentBuffer.length > 0) {
          // Remove any leading/trailing whitespace for better display
          const trimmedContent = contentBuffer.trim();
          
          if (trimmedContent.length > 0) {
            res.write(`data: ${JSON.stringify({
              type: 'content',
              content: trimmedContent,
              sessionId: conversationId
            })}\n\n`);
            
            // Add the content to the full text
            fullText += contentBuffer;
            
            // Deliberately add a small delay to let the client process
            setTimeout(() => {}, 10);
          }
          
          contentBuffer = '';
          lastFlushTime = Date.now();
          accumulationStartTime = Date.now();
        }
        
        if (flushTimeout) {
          clearTimeout(flushTimeout);
          flushTimeout = null;
        }
      };
      
      try {
        // Process the stream
        for await (const chunk of stream) {
          if (chunk.choices && chunk.choices.length > 0) {
            const content = chunk.choices[0].text || '';
            
            if (content) {
              // Buffer the content
              contentBuffer += content;
              
              const now = Date.now();
              const totalAccumulationTime = now - accumulationStartTime;
              
              // More sophisticated sentence boundary detection
              const sentenceCompletionRegex = /[.!?]\s+[A-Z]|[.!?]$|\n\n/;
              const hasCompleteSentence = sentenceCompletionRegex.test(contentBuffer);
              
              // Use larger thresholds for image analysis
              const hasLargeContent = contentBuffer.length > 150; // Even larger chunks for image analysis
              const hasBeenCollectingTooLong = totalAccumulationTime > 1200; // 1.2 second max collection
              
              if (hasCompleteSentence || hasLargeContent || hasBeenCollectingTooLong) {
                flushContentBuffer();
              } else {
                if (!flushTimeout) {
                  flushTimeout = setTimeout(flushContentBuffer, 600); // Longer timeout for image analysis
                }
              }
            }
            
            // Handle completion
            if (chunk.choices[0].finish_reason === 'stop') {
              flushContentBuffer(); // Flush any remaining content
              
              // Save the analysis to the database
              try {
                const newAnalysis = new ImageAnalysis({
                  imageUrl,
                  prompt,
                  explanation: fullText,
                  responseId: stream.id || `id-${Date.now()}`,
                  conversationId: conversationId,
                  userId: userId || null,
                  metadata: {
                    model: requestPayload.model,
                    timestamp: new Date().toISOString(),
                    streamMode: true
                  }
                });
                
                await newAnalysis.save();
                console.log(`Saved streamed image analysis to database with ID: ${newAnalysis._id}`);
              } catch (dbError) {
                console.error('Error saving to database:', dbError);
              }
              
              // Send completion event
              res.write(`data: ${JSON.stringify({
                type: 'stream_complete',
                sessionId: conversationId
              })}\n\n`);
              
              // End the response
              res.end();
              break;
            }
          }
        }
      } catch (streamError) {
        console.error('Stream processing error:', streamError);
        
        // Send error event
        res.write(`data: ${JSON.stringify({
          type: 'error',
          error: streamError.message,
          sessionId: conversationId
        })}\n\n`);
        
        // End the response
        res.end();
      }
      
      return; // End function execution here for streaming
    }
    
    // Regular non-streaming request handling
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

/**
 * Image Generation and Editing Routes
 */

/**
 * POST /api/openai/images/generate
 * 
 * Generates an image based on a prompt using DALL-E 3/2
 * 
 * Expects a JSON body containing:
 *  - prompt: Description of the desired image
 *  - model: (optional) "dall-e-3" or "dall-e-2", defaults to "dall-e-3"
 *  - size: (optional) Image size like "1024x1024", "1792x1024", "1024x1792"
 *  - quality: (optional) "standard" or "hd", defaults to "standard"
 *  - n: (optional) Number of images to generate, defaults to 1
 *  - conversationId: (optional) ID for tracking the conversation chain
 * 
 * Returns:
 *  - { images: array, conversationId: string } on success
 *  - { error: string } on failure
 */
router.post('/images/generate', async (req, res) => {
  try {
    const { 
      prompt, 
      model = 'dall-e-3', 
      size = '1024x1024', 
      quality = 'standard', 
      n = 1, 
      conversationId 
    } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    console.log(`Generating image with prompt: "${prompt.substring(0, 50)}..."`);

    // Generate image using OpenAI's API
    const response = await openai.images.generate({
      model,
      prompt,
      n,
      size,
      quality,
      response_format: 'b64_json'
    });

    if (!response || !response.data || response.data.length === 0) {
      throw new Error('No image generated from OpenAI');
    }

    // Process the response
    const images = response.data.map(image => ({
      url: image.url || `data:image/png;base64,${image.b64_json}`,
      revisedPrompt: image.revised_prompt,
      b64_json: image.b64_json
    }));

    // Store generated images with the given conversation ID if provided
    // For a full implementation, consider adding a database model for storing these
    const newConversationId = conversationId || `img-gen-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

    return res.status(200).json({
      images,
      conversationId: newConversationId,
      status: 'success'
    });

  } catch (error) {
    console.error('Error generating image:', error);
    
    // Handle specific errors
    if (error.response?.status === 429) {
      return res.status(429).json({
        error: 'Rate limit exceeded. Please try again later.',
        details: error.message
      });
    }

    return res.status(500).json({ 
      error: 'Failed to generate image',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * POST /api/openai/images/edit
 * 
 * Edits an existing image based on a prompt using DALL-E 2
 * 
 * Expects a multipart form data with:
 *  - image: Base64 data URI or uploaded image file
 *  - prompt: Description of the desired edits
 *  - mask: (optional) Base64 data URI or uploaded mask image file
 *  - model: (optional) "dall-e-2" is the only supported model for edits
 *  - size: (optional) Image size, defaults to "1024x1024"
 *  - n: (optional) Number of images to generate, defaults to 1
 *  - conversationId: (optional) ID for tracking the conversation chain
 * 
 * Returns:
 *  - { images: array, conversationId: string } on success
 *  - { error: string } on failure
 */
router.post('/images/edit', upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'mask', maxCount: 1 }
]), async (req, res) => {
  try {
    const { prompt, model = 'dall-e-2', size = '1024x1024', n = 1, conversationId } = req.body;
    let imageData, maskData;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Handle image from form upload or base64 data URI
    if (req.files && req.files.image && req.files.image[0]) {
      // Get image from uploaded file
      const imagePath = req.files.image[0].path;
      imageData = await fs.promises.readFile(imagePath);
    } else if (req.body.imageBase64) {
      // Get image from base64 data
      const base64Data = req.body.imageBase64.replace(/^data:image\/\w+;base64,/, '');
      imageData = Buffer.from(base64Data, 'base64');
    } else {
      return res.status(400).json({ error: 'An image file or base64 image data is required' });
    }

    // Handle optional mask from form upload or base64 data URI
    if (req.files && req.files.mask && req.files.mask[0]) {
      // Get mask from uploaded file
      const maskPath = req.files.mask[0].path;
      maskData = await fs.promises.readFile(maskPath);
    } else if (req.body.maskBase64) {
      // Get mask from base64 data
      const base64Mask = req.body.maskBase64.replace(/^data:image\/\w+;base64,/, '');
      maskData = Buffer.from(base64Mask, 'base64');
    }

    // Ensure images meet OpenAI requirements
    // Resize and convert images as needed using sharp
    imageData = await sharp(imageData)
      .resize(1024, 1024, { fit: 'inside' }) // DALL-E 2 requires square images
      .toFormat('png')
      .toBuffer();

    if (maskData) {
      maskData = await sharp(maskData)
        .resize(1024, 1024, { fit: 'inside' })
        .toFormat('png')
        .toBuffer();
    }

    console.log(`Editing image with prompt: "${prompt.substring(0, 50)}..."`);

    // Edit image using OpenAI's API
    const requestOptions = {
      model,
      image: imageData,
      prompt,
      n,
      size,
      response_format: 'b64_json'
    };

    // Add mask if provided
    if (maskData) {
      requestOptions.mask = maskData;
    }

    const response = await openai.images.edit(requestOptions);

    if (!response || !response.data || response.data.length === 0) {
      throw new Error('No image generated from OpenAI');
    }

    // Process the response
    const images = response.data.map(image => ({
      url: image.url || `data:image/png;base64,${image.b64_json}`,
      b64_json: image.b64_json
    }));

    // Store edited images with the given conversation ID if provided
    const newConversationId = conversationId || `img-edit-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

    return res.status(200).json({
      images,
      conversationId: newConversationId,
      status: 'success'
    });

  } catch (error) {
    console.error('Error editing image:', error);
    
    // Handle specific errors
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

    return res.status(500).json({ 
      error: 'Failed to edit image',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * POST /api/openai/images/variations
 * 
 * Creates variations of a given image using DALL-E 2
 * 
 * Expects a multipart form data with:
 *  - image: Base64 data URI or uploaded image file 
 *  - model: (optional) "dall-e-2" is the only supported model for variations
 *  - n: (optional) Number of variations to generate, defaults to 1
 *  - size: (optional) Image size, defaults to "1024x1024"
 *  - conversationId: (optional) ID for tracking the conversation chain
 * 
 * Returns:
 *  - { images: array, conversationId: string } on success
 *  - { error: string } on failure  
 */
router.post('/images/variations', upload.single('image'), async (req, res) => {
  try {
    const { model = 'dall-e-2', n = 1, size = '1024x1024', conversationId } = req.body;
    let imageData;

    // Handle image from form upload or base64 data URI
    if (req.file) {
      // Get image from uploaded file
      const imagePath = req.file.path;
      imageData = await fs.promises.readFile(imagePath);
    } else if (req.body.imageBase64) {
      // Get image from base64 data
      const base64Data = req.body.imageBase64.replace(/^data:image\/\w+;base64,/, '');
      imageData = Buffer.from(base64Data, 'base64');
    } else {
      return res.status(400).json({ error: 'An image file or base64 image data is required' });
    }

    // Ensure image meets OpenAI requirements (square, PNG)
    imageData = await sharp(imageData)
      .resize(1024, 1024, { fit: 'fill' }) // Make it square for DALL-E 2
      .toFormat('png')
      .toBuffer();

    console.log('Generating image variations');

    // Create variations using OpenAI's API
    const response = await openai.images.createVariation({
      model,
      image: imageData,
      n,
      size,
      response_format: 'b64_json'
    });

    if (!response || !response.data || response.data.length === 0) {
      throw new Error('No variations generated from OpenAI');
    }

    // Process the response
    const images = response.data.map(image => ({
      url: image.url || `data:image/png;base64,${image.b64_json}`,
      b64_json: image.b64_json
    }));

    // Store variations with the given conversation ID if provided
    const newConversationId = conversationId || `img-var-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

    return res.status(200).json({
      images,
      conversationId: newConversationId,
      status: 'success'
    });

  } catch (error) {
    console.error('Error creating image variations:', error);
    
    // Handle specific errors
    if (error.response?.status === 429) {
      return res.status(429).json({
        error: 'Rate limit exceeded. Please try again later.',
        details: error.message
      });
    }

    return res.status(500).json({ 
      error: 'Failed to create image variations',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * GET /api/openai/images/conversation/:conversationId
 * 
 * Retrieves the conversation history for a given conversation ID
 * 
 * Path Parameters:
 *  - conversationId: The ID of the conversation to retrieve
 * 
 * Returns:
 *  - { conversation: object } on success
 *  - { error: string } on failure
 */
router.get('/images/conversation/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    
    if (!conversationId) {
      return res.status(400).json({ error: 'Conversation ID is required' });
    }
    
    // Note: This is a placeholder. In a real implementation, you would
    // retrieve the conversation history from your database
    
    // Placeholder response for now
    return res.status(200).json({
      conversation: {
        id: conversationId,
        images: [],
        message: "Conversation history retrieval not yet implemented"
      }
    });
    
  } catch (error) {
    console.error('Error retrieving conversation:', error);
    return res.status(500).json({ 
      error: 'Failed to retrieve conversation',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * POST /api/openai/explain-image/annotated
 * 
 * Analyzes an annotated image where users have highlighted or circled specific areas
 * for focused analysis using the Responses API
 * 
 * Expects a multipart form data containing:
 *  - image: The annotated image file (required)
 *  - conversationId: The conversation ID from the original analysis (required)
 *  - question: Specific question about the annotated areas (optional, has default)
 *  - context: (optional) Additional context like vehicle information
 *  - stream: (optional) Boolean flag to request streaming response (default: false)
 * 
 * Returns:
 *  - For non-streaming: { answer: string, responseId: string, conversationId: string, status: string } on success
 *  - For streaming: Server-Sent Events stream with content chunks
 *  - { error: string, details?: string } on failure
 */
router.post('/explain-image/annotated', upload.single('image'), async (req, res) => {
  try {
    const { conversationId, question, context } = req.body;
    const shouldStream = req.body.stream === 'true' || req.body.stream === true;

    // Validate required fields
    if (!req.file) {
      return res.status(400).json({ 
        error: 'Missing annotated image file',
        details: 'An annotated image file is required for analysis'
      });
    }

    if (!conversationId) {
      return res.status(400).json({ 
        error: 'Missing conversation ID',
        details: 'Conversation ID is required to maintain context from the original analysis'
      });
    }

    console.log('--------------------------------------------');
    console.log(`Processing annotated image analysis for conversation: ${conversationId}`);
    console.log(`Uploaded file: ${req.file.filename} (${req.file.size} bytes)`);
    console.log(`Question: "${question || 'Default annotation analysis'}"`);
    console.log(`Stream mode: ${shouldStream ? 'enabled' : 'disabled'}`);

    // Process the uploaded annotated image
    const imagePath = req.file.path;
    let imageBuffer;

    try {
      // Resize and optimize the annotated image if needed
      imageBuffer = await sharp(imagePath)
        .resize({
          width: 1024,  // Max width for optimal processing
          height: 1024, // Max height for optimal processing
          fit: 'inside', // Maintain aspect ratio
          withoutEnlargement: true // Don't enlarge smaller images
        })
        .jpeg({ quality: 85 }) // Higher quality for annotation details
        .toBuffer();
      
      console.log(`Processed annotated image: ${(imageBuffer.length / (1024 * 1024)).toFixed(2)} MB`);
    } catch (resizeError) {
      console.error('Error processing annotated image:', resizeError);
      // If resize fails, use the original file
      imageBuffer = await fs.promises.readFile(imagePath);
    }

    // Convert to base64 data URI
    const base64Image = imageBuffer.toString('base64');
    const dataUri = `data:image/jpeg;base64,${base64Image}`;

    // Check image size for OpenAI limit (20MB)
    const sizeInMB = imageBuffer.length / (1024 * 1024);
    if (sizeInMB > 20) {
      return res.status(400).json({
        error: 'Annotated image size exceeds OpenAI limit of 20MB',
        details: `Image is ${sizeInMB.toFixed(2)} MB, must be under 20MB`
      });
    }

    // Prepare the analysis question
    const defaultQuestion = 'Please analyze the areas I have highlighted or circled in this annotated image. Focus specifically on the annotated regions and provide detailed insights about what you observe in those specific areas. Identify any issues, components, or details that are emphasized by the annotations.';
    const analysisQuestion = question || defaultQuestion;

    // Prepare context for the vehicle if available
    let userMessage = analysisQuestion;
    if (context) {
      try {
        const contextObj = typeof context === 'string' ? JSON.parse(context) : context;
        const vehicleInfo = `Vehicle Information: ${contextObj.vehicleYear || ''} ${contextObj.vehicleMake || ''} ${contextObj.vehicleModel || ''} ${contextObj.vehicleEngine ? `with ${contextObj.vehicleEngine} engine` : ''}`;
        userMessage = `${vehicleInfo}\n\n${analysisQuestion}`;
        console.log(`Added vehicle context: ${vehicleInfo}`);
      } catch (contextError) {
        console.warn('Failed to parse context, using as string:', context);
        userMessage = `${context}\n\n${analysisQuestion}`;
      }
    }

    // Create a specialized system message for annotated image analysis
    const systemMessage = `You are an expert Automotive Technical Advisor analyzing an annotated image. The user has added visual annotations (circles, rectangles, or freehand markings) to highlight specific areas of interest in an automotive component or system. 

Your task is to:
1. Identify and focus on the annotated/highlighted areas in the image
2. Provide detailed technical analysis of what is shown in those specific regions
3. Explain any issues, components, or conditions visible in the annotated areas
4. Use definitive language and avoid tentative phrases
5. Reference the annotations explicitly in your response (e.g., "In the circled area...", "The highlighted region shows...")
6. Provide actionable insights based on what the annotations are pointing out

This is a follow-up analysis to a previous conversation (ID: ${conversationId}), so maintain technical context while focusing specifically on the annotated regions.`;

    // Create request payload for OpenAI Responses API
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
          { type: "input_text", text: `This is an annotated image analysis. Original conversation ID: ${conversationId}. ${userMessage}` },
          { type: "input_image", image_url: dataUri }
        ]
      }],
      max_output_tokens: 1500
    };
    
    // Add streaming if requested
    if (shouldStream) {
      requestPayload.stream = true;
    }

    console.log('Sending annotated image analysis request to OpenAI...');
    console.log(`System message length: ${systemMessage.length} characters`);
    console.log(`User message length: ${userMessage.length} characters`);

    // Handle streaming response
    if (shouldStream) {
      // Set headers for Server-Sent Events
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });
      
      // Create streaming response
      const stream = await openai.responses.create(requestPayload);
      
      // Generate a conversation ID for this annotated analysis
      const responseConversationId = stream.conversation_id || `annotated-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      
      // Send session ID first
      res.write(`data: ${JSON.stringify({ 
        type: 'session_started', 
        sessionId: responseConversationId,
        originalConversationId: conversationId,
        messageType: 'annotated_image_analysis'
      })}\n\n`);
      
      // Setup content buffering
      let contentBuffer = '';
      let lastFlushTime = Date.now();
      let flushTimeout = null;
      let accumulationStartTime = Date.now();
      let fullText = ''; // Keep track of the full response for saving to DB
      
      // Cleanup file after establishing the stream
      try {
        await fs.promises.unlink(imagePath);
        console.log(`Cleaned up uploaded file: ${req.file.filename}`);
      } catch (cleanupError) {
        console.warn('Failed to clean up uploaded file:', cleanupError.message);
      }
      
      const flushContentBuffer = () => {
        if (contentBuffer.length > 0) {
          // Remove any leading/trailing whitespace for better display
          const trimmedContent = contentBuffer.trim();
          
          if (trimmedContent.length > 0) {
            res.write(`data: ${JSON.stringify({
              type: 'content',
              content: trimmedContent,
              sessionId: responseConversationId
            })}\n\n`);
            
            // Add the content to the full text
            fullText += contentBuffer;
            
            // Deliberately add a small delay to let the client process
            setTimeout(() => {}, 10);
          }
          
          contentBuffer = '';
          lastFlushTime = Date.now();
          accumulationStartTime = Date.now();
        }
        
        if (flushTimeout) {
          clearTimeout(flushTimeout);
          flushTimeout = null;
        }
      };
      
      try {
        // Process the stream
        for await (const chunk of stream) {
          if (chunk.choices && chunk.choices.length > 0) {
            const content = chunk.choices[0].text || '';
            
            if (content) {
              // Buffer the content
              contentBuffer += content;
              
              const now = Date.now();
              const totalAccumulationTime = now - accumulationStartTime;
              
              // More sophisticated sentence boundary detection
              const sentenceCompletionRegex = /[.!?]\s+[A-Z]|[.!?]$|\n\n/;
              const hasCompleteSentence = sentenceCompletionRegex.test(contentBuffer);
              
              // Use larger thresholds for image analysis
              const hasLargeContent = contentBuffer.length > 150; // Even larger chunks for image analysis
              const hasBeenCollectingTooLong = totalAccumulationTime > 1200; // 1.2 second max collection
              
              if (hasCompleteSentence || hasLargeContent || hasBeenCollectingTooLong) {
                flushContentBuffer();
              } else {
                if (!flushTimeout) {
                  flushTimeout = setTimeout(flushContentBuffer, 600); // Longer timeout for image analysis
                }
              }
            }
            
            // Handle completion
            if (chunk.choices[0].finish_reason === 'stop') {
              flushContentBuffer(); // Flush any remaining content
              
              // Save the analysis to the database
              try {
                const annotatedAnalysis = new ImageAnalysis({
                  imageUrl: dataUri, // Store the annotated image
                  prompt: `ANNOTATED: ${analysisQuestion}`,
                  explanation: fullText,
                  responseId: stream.id || `id-${Date.now()}`,
                  conversationId: responseConversationId,
                  userId: req.body.userId || null,
                  metadata: {
                    model: requestPayload.model,
                    timestamp: new Date().toISOString(),
                    type: 'annotated_analysis',
                    originalConversationId: conversationId,
                    annotationContext: context || null,
                    streamMode: true
                  }
                });
                
                await annotatedAnalysis.save();
                console.log(`Saved streamed annotated analysis to database with ID: ${annotatedAnalysis._id}`);
              } catch (dbError) {
                console.error('Error saving to database:', dbError);
              }
              
              // Send completion event
              res.write(`data: ${JSON.stringify({
                type: 'stream_complete',
                sessionId: responseConversationId,
                originalConversationId: conversationId
              })}\n\n`);
              
              // End the response
              res.end();
              break;
            }
          }
        }
      } catch (streamError) {
        console.error('Stream processing error:', streamError);
        
        // Send error event
        res.write(`data: ${JSON.stringify({
          type: 'error',
          error: streamError.message,
          sessionId: responseConversationId
        })}\n\n`);
        
        // End the response
        res.end();
      }
      
      return; // End function execution here for streaming
    }

    // Non-streaming response
    const response = await openai.responses.create(requestPayload);

    // Generate a conversation ID for this annotated analysis
    const responseConversationId = response.conversation_id || `annotated-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    
    console.log(`Annotated analysis response received with ID: ${response.id}`);
    console.log(`Response text length: ${response.output_text.length} characters`);
    console.log('--------------------------------------------');

    // Clean up the uploaded file
    try {
      await fs.promises.unlink(imagePath);
      console.log(`Cleaned up uploaded file: ${req.file.filename}`);
    } catch (cleanupError) {
      console.warn('Failed to clean up uploaded file:', cleanupError.message);
    }

    // Optionally save the annotated analysis to database
    try {
      const annotatedAnalysis = new ImageAnalysis({
        imageUrl: dataUri, // Store the annotated image
        prompt: `ANNOTATED: ${analysisQuestion}`,
        explanation: response.output_text,
        responseId: response.id,
        conversationId: responseConversationId,
        userId: req.body.userId || null,
        metadata: {
          model: requestPayload.model,
          timestamp: new Date().toISOString(),
          type: 'annotated_analysis',
          originalConversationId: conversationId,
          annotationContext: context || null
        }
      });
      
      await annotatedAnalysis.save();
      console.log(`Saved annotated analysis to database with ID: ${annotatedAnalysis._id}`);
    } catch (dbError) {
      console.warn('Failed to save annotated analysis to database:', dbError.message);
      // Continue without failing the request
    }

    return res.status(200).json({
      answer: response.output_text,
      responseId: response.id,
      conversationId: responseConversationId,
      originalConversationId: conversationId,
      status: 'success',
      type: 'annotated_analysis'
    });

  } catch (error) {
    console.error('Error processing annotated image analysis:', error);
    
    // Clean up uploaded file in case of error
    if (req.file && req.file.path) {
      try {
        await fs.promises.unlink(req.file.path);
      } catch (cleanupError) {
        console.warn('Failed to clean up file after error:', cleanupError.message);
      }
    }
    
    // Provide more specific error messages
    if (error.response) {
      return res.status(error.response.status).json({
        error: 'Failed to process annotated image',
        details: error.response.data || error.message
      });
    }
    
    if (error.code === 'ECONNREFUSED' || error.code === 'ECONNABORTED') {
      return res.status(503).json({
        error: 'Service temporarily unavailable',
        details: 'Could not connect to AI service'
      });
    }
    
    return res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Failed to analyze annotated image'
    });
  }
});

/**
 * GET /api/openai/annotated-analyses/:originalConversationId
 * 
 * Retrieves all annotated analyses for a given original conversation ID
 * 
 * Path Parameters:
 *  - originalConversationId: The conversation ID from the original image analysis
 * 
 * Query Parameters:
 *  - userId: (optional) Filter by user ID
 *  - limit: (optional) Limit number of results (default: 10, max: 50)
 * 
 * Returns:
 *  - { analyses: Array, count: number } on success
 *  - { error: string } on failure
 */
router.get('/annotated-analyses/:originalConversationId', async (req, res) => {
  try {
    const { originalConversationId } = req.params;
    const { userId, limit = 10 } = req.query;
    
    if (!originalConversationId) {
      return res.status(400).json({ 
        error: 'Missing originalConversationId parameter'
      });
    }
    
    // Validate limit
    const parsedLimit = Math.min(parseInt(limit) || 10, 50);
    
    const query = { 
      'metadata.originalConversationId': originalConversationId,
      'metadata.type': 'annotated_analysis'
    };
    
    // Add userId filter if provided
    if (userId) {
      query.userId = userId;
    }
    
    const analyses = await ImageAnalysis.find(query)
      .sort({ createdAt: -1 })
      .limit(parsedLimit);
      
    const count = await ImageAnalysis.countDocuments(query);
    
    return res.status(200).json({
      analyses: analyses.map(analysis => ({
        id: analysis._id,
        imageUrl: analysis.imageUrl,
        prompt: analysis.prompt,
        explanation: analysis.explanation,
        responseId: analysis.responseId,
        conversationId: analysis.conversationId,
        originalConversationId: analysis.metadata?.originalConversationId,
        createdAt: analysis.createdAt,
        metadata: analysis.metadata
      })),
      count,
      hasMore: count > parsedLimit
    });
    
  } catch (error) {
    console.error('Error retrieving annotated analyses:', error);
    return res.status(500).json({
      error: 'Failed to retrieve annotated analyses',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * DELETE /api/openai/annotated-analysis/:analysisId
 * 
 * Deletes a specific annotated analysis by ID
 * 
 * Path Parameters:
 *  - analysisId: The ID of the annotated analysis to delete
 * 
 * Query Parameters:
 *  - userId: (optional) Verify ownership by user ID
 * 
 * Returns:
 *  - { message: string, deletedId: string } on success
 *  - { error: string } on failure
 */
router.delete('/annotated-analysis/:analysisId', async (req, res) => {
  try {
    const { analysisId } = req.params;
    const { userId } = req.query;
    
    if (!analysisId) {
      return res.status(400).json({ 
        error: 'Missing analysisId parameter'
      });
    }
    
    const query = { 
      _id: analysisId,
      'metadata.type': 'annotated_analysis'
    };
    
    // Add userId filter if provided for ownership verification
    if (userId) {
      query.userId = userId;
    }
    
    const deletedAnalysis = await ImageAnalysis.findOneAndDelete(query);
    
    if (!deletedAnalysis) {
      return res.status(404).json({
        error: 'Annotated analysis not found or access denied'
      });
    }
    
    console.log(`Deleted annotated analysis: ${analysisId}`);
    
    return res.status(200).json({
      message: 'Annotated analysis deleted successfully',
      deletedId: analysisId
    });
    
  } catch (error) {
    console.error('Error deleting annotated analysis:', error);
    return res.status(500).json({
      error: 'Failed to delete annotated analysis',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/openai/explain-image/batch-annotated
 * 
 * Analyzes multiple annotated images in a batch for comparison or comprehensive analysis
 * 
 * Expects a multipart form data containing:
 *  - images: Multiple annotated image files (required, max 5)
 *  - conversationId: The conversation ID from the original analysis (required)
 *  - question: Specific question about the annotated areas (optional)
 *  - context: (optional) Additional context like vehicle information
 *  - comparisonMode: (optional) boolean - whether to compare annotations across images
 * 
 * Returns:
 *  - { answer: string, responseId: string, conversationId: string, imageCount: number, status: string } on success
 *  - { error: string, details?: string } on failure
 */
router.post('/explain-image/batch-annotated', upload.array('images', 5), async (req, res) => {
  try {
    const { conversationId, question, context, comparisonMode = false } = req.body;

    // Validate required fields
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ 
        error: 'Missing annotated image files',
        details: 'At least one annotated image file is required for analysis'
      });
    }

    if (req.files.length > 5) {
      return res.status(400).json({ 
        error: 'Too many images',
        details: 'Maximum 5 annotated images allowed per batch'
      });
    }

    if (!conversationId) {
      return res.status(400).json({ 
        error: 'Missing conversation ID',
        details: 'Conversation ID is required to maintain context from the original analysis'
      });
    }

    console.log('--------------------------------------------');
    console.log(`Processing batch annotated image analysis for conversation: ${conversationId}`);
    console.log(`Number of images: ${req.files.length}`);
    console.log(`Comparison mode: ${comparisonMode}`);

    const processedImages = [];
    
    // Process each uploaded image
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      console.log(`Processing image ${i + 1}: ${file.filename} (${file.size} bytes)`);

      try {
        // Resize and optimize each image
        const imageBuffer = await sharp(file.path)
          .resize({
            width: 800,  // Smaller size for batch processing
            height: 800,
            fit: 'inside',
            withoutEnlargement: true
          })
          .jpeg({ quality: 80 })
          .toBuffer();

        // Convert to base64 data URI
        const base64Image = imageBuffer.toString('base64');
        const dataUri = `data:image/jpeg;base64,${base64Image}`;

        processedImages.push({
          index: i + 1,
          filename: file.filename,
          dataUri: dataUri,
          size: imageBuffer.length
        });

        // Clean up the uploaded file
        await fs.promises.unlink(file.path);
      } catch (processError) {
        console.error(`Error processing image ${i + 1}:`, processError);
        // Continue with other images
      }
    }

    if (processedImages.length === 0) {
      return res.status(400).json({
        error: 'No images could be processed',
        details: 'All uploaded images failed processing'
      });
    }

    // Prepare the analysis question
    const defaultQuestion = comparisonMode 
      ? 'Please analyze and compare the annotated areas across these images. Identify patterns, differences, and relationships between the highlighted regions. Provide a comprehensive analysis of what the annotations are showing across all images.'
      : 'Please analyze the annotated areas in these images. Focus on the highlighted regions in each image and provide detailed insights about what is shown in the annotated areas.';
    
    const analysisQuestion = question || defaultQuestion;

    // Create a specialized system message for batch annotated analysis
    const systemMessage = `You are an expert Automotive Technical Advisor analyzing ${processedImages.length} annotated images${comparisonMode ? ' in comparison mode' : ''}. Each image contains visual annotations (circles, rectangles, or freehand markings) highlighting specific areas of interest.

Your task is to:
1. Analyze the annotated areas in each image systematically
2. ${comparisonMode ? 'Compare and contrast the highlighted regions across all images' : 'Provide detailed analysis of each annotated area'}
3. Reference specific images and annotations in your response (e.g., "In Image 1, the circled area shows...")
4. Identify any issues, components, or conditions visible in the annotated areas
5. ${comparisonMode ? 'Look for patterns, progressions, or differences between the images' : 'Provide actionable insights for each annotated region'}
6. Use definitive technical language and automotive terminology

This is a follow-up analysis to conversation ID: ${conversationId}.`;

    // Prepare user message with context
    let userMessage = `Analyzing ${processedImages.length} annotated images. ${analysisQuestion}`;
    if (context) {
      try {
        const contextObj = typeof context === 'string' ? JSON.parse(context) : context;
        const vehicleInfo = `Vehicle: ${contextObj.vehicleYear || ''} ${contextObj.vehicleMake || ''} ${contextObj.vehicleModel || ''}`;
        userMessage = `${vehicleInfo}\n\n${userMessage}`;
      } catch (contextError) {
        userMessage = `${context}\n\n${userMessage}`;
      }
    }

    // Create content array with text and all images
    const content = [
      { type: "input_text", text: userMessage }
    ];

    // Add all processed images to the content
    processedImages.forEach((img, index) => {
      content.push({
        type: "input_image",
        image_url: img.dataUri
      });
    });

    // Create request payload
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
        content: content
      }],
      max_output_tokens: 2000 // More tokens for batch analysis
    };

    console.log(`Sending batch annotated analysis request to OpenAI...`);
    console.log(`Total images: ${processedImages.length}`);
    console.log(`Total content size: ${JSON.stringify(requestPayload).length} characters`);

    // Create a response using the Responses API
    const response = await openai.responses.create(requestPayload);

    const responseConversationId = response.conversation_id || `batch-annotated-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    
    console.log(`Batch annotated analysis response received with ID: ${response.id}`);
    console.log(`Response text length: ${response.output_text.length} characters`);
    console.log('--------------------------------------------');

    // Save the batch analysis to database
    try {
      const batchAnalysis = new ImageAnalysis({
        imageUrl: `BATCH:${processedImages.length}_IMAGES`, // Special marker for batch
        prompt: `BATCH_ANNOTATED${comparisonMode ? '_COMPARISON' : ''}: ${analysisQuestion}`,
        explanation: response.output_text,
        responseId: response.id,
        conversationId: responseConversationId,
        userId: req.body.userId || null,
        metadata: {
          model: requestPayload.model,
          timestamp: new Date().toISOString(),
          type: 'batch_annotated_analysis',
          originalConversationId: conversationId,
          imageCount: processedImages.length,
          comparisonMode: comparisonMode,
          imageFilenames: processedImages.map(img => img.filename),
          annotationContext: context || null
        }
      });
      
      await batchAnalysis.save();
      console.log(`Saved batch annotated analysis to database with ID: ${batchAnalysis._id}`);
    } catch (dbError) {
      console.warn('Failed to save batch analysis to database:', dbError.message);
    }

    return res.status(200).json({
      answer: response.output_text,
      responseId: response.id,
      conversationId: responseConversationId,
      originalConversationId: conversationId,
      imageCount: processedImages.length,
      comparisonMode: comparisonMode,
      status: 'success',
      type: 'batch_annotated_analysis'
    });

  } catch (error) {
    console.error('Error processing batch annotated image analysis:', error);
    
    // Clean up uploaded files in case of error
    if (req.files) {
      for (const file of req.files) {
        try {
          await fs.promises.unlink(file.path);
        } catch (cleanupError) {
          console.warn(`Failed to clean up file ${file.filename}:`, cleanupError.message);
        }
      }
    }
    
    if (error.response) {
      return res.status(error.response.status).json({
        error: 'Failed to process batch annotated images',
        details: error.response.data || error.message
      });
    }
    
    return res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Failed to analyze batch annotated images'
    });
  }
});

export default router;