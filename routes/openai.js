import express from 'express';
import OpenAI from 'openai';
import axios from 'axios';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

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
 * Handles image uploads, saves them to the server, and returns the URL
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

    // Create a URL for the uploaded image
    const serverUrl = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 5000}`;
    const imageUrl = `${serverUrl}/uploads/${req.file.filename}`;

    return res.status(200).json({
      imageUrl,
      contentType: req.file.mimetype,
      filename: req.file.filename
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
 * POST /api/openai/explain-image
 * 
 * Unified endpoint that handles both base64 and URL-based image processing using the Responses API
 * 
 * Expects a JSON body containing:
 *  - imageUrl: URL of the image to analyze or base64 data URI
 *  - prompt: Specific question or instruction about the image
 * 
 * Returns:
 *  - { explanation: string, responseId: string, conversationId: string, status: string } on success
 *  - { error: string, details?: string } on failure
 */
router.post('/explain-image', async (req, res) => {
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
    const systemMessage = "You are an expert Automotive Technical Advisor with extensive knowledge in vehicle systems, diagnostics, and technical specifications. Your responses must be direct, definitive, and authoritative. Never use tentative language like 'appears to be' or 'seems to be'. Instead, state facts directly and confidently. Focus on providing precise technical information, including specific measurements, specifications, and industry-standard terminology. Maintain a professional tone while delivering clear, assertive analysis.";

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
          { type: "input_text", text: `As an Automotive Technical Advisor, provide a definitive technical analysis of this image. ${prompt} State facts directly and include specific measurements, specifications, and relevant technical details.` },
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
    
    // Return the response with the conversation ID prominently included
    return res.status(200).json({
      explanation: response.output_text,
      responseId: response.id,
      conversationId: response.conversation_id,
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

  if (!conversationId) {
    console.warn('No conversation ID provided for follow-up question. This may result in an incomplete conversation context.');
    return res.status(400).json({ 
      error: 'Missing conversation ID',
      details: 'A conversation ID is required to maintain context with previous explanations'
    });
  }

  try {
    console.log('--------------------------------------------');
    console.log(`Processing follow-up question with conversation ID: ${conversationId}`);
    console.log(`Question: "${question}"`);
    console.log(`Image URL: ${imageUrl.substring(0, 50)}...`);
    
    // Prepare context for the vehicle if available
    let userMessage = question;
    if (context) {
      const vehicleInfo = `Vehicle Information: ${context.vehicleYear || ''} ${context.vehicleMake || ''} ${context.vehicleModel || ''} ${context.vehicleEngine ? `with ${context.vehicleEngine} engine` : ''}`;
      userMessage = `${vehicleInfo}\n\n${question}`;
      console.log(`Added vehicle context: ${vehicleInfo}`);
    }

    // Create request payload - IMPORTANT: conversation_id must be included
    const requestPayload = {
      model: "gpt-4o",
      user: "Technician",
      conversation_id: conversationId, // This is critical for continuity
      input: [{
        role: "user",
        content: [
          { type: "input_text", text: userMessage },
          { type: "input_image", image_url: imageUrl }
        ],
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

    // Create a response using the Responses API with the existing conversation ID
    const response = await openai.responses.create(requestPayload);
    
    console.log(`Follow-up response received with conversation ID: ${response.conversation_id}`);
    console.log(`Response ID: ${response.id}`);
    console.log(`Response text length: ${response.output_text.length} characters`);
    console.log('--------------------------------------------');

    return res.status(200).json({
      answer: response.output_text,
      responseId: response.id,
      conversationId: response.conversation_id,
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
        Buffer.from(base64Data, 'base64');
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
 * Handles user questions, generates a text response using OpenAI's Responses API, and includes web search results with relevant images.
 * 
 * Expects a JSON body containing:
 *  - question: The user's question
 * 
 * Returns:
 *  - { textResponse: string, sources: array, images: array } on success
 *  - { error: string } on failure
 */
router.post('/question-with-image', async (req, res) => {
  const { question } = req.body;

  if (!question) {
    return res.status(400).json({ error: 'Question is required' });
  }

  try {
    // Use OpenAI's Responses API with web search to generate a response with images
    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      input: question,
      tools: [
        { type: "web_search" }
      ],
      max_output_tokens: 1000  // USING THE CORRECT PARAMETER NAME
    });
    
    // Extract the text response and sources from the result
    let textResponse = '';
    let sources = [];
    let images = [];
    
    // Process the response to extract text, sources, and image URLs
    if (response.output && response.output.length > 0) {
      for (const output of response.output) {
        if (output.type === 'message' && output.content && output.content.length > 0) {
          for (const content of output.content) {
            if (content.type === 'output_text') {
              textResponse += content.text;
              
              // Extract annotations (sources/citations)
              if (content.annotations && content.annotations.length > 0) {
                for (const annotation of content.annotations) {
                  if (annotation.type === 'url_citation') {
                    sources.push({
                      title: annotation.title,
                      url: annotation.url
                    });
                    
                    // Check if URL might contain an image
                    if (annotation.url.match(/\.(jpeg|jpg|gif|png)$/i) || 
                        annotation.title.toLowerCase().includes('image') || 
                        annotation.title.toLowerCase().includes('photo')) {
                      images.push(annotation.url);
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    
    // If no images were found in the citations, attempt to extract image URLs from the response text
    if (images.length === 0) {
      // Look for URLs in the response text that might be images
      const urlRegex = /(https?:\/\/[^\s]+\.(jpeg|jpg|gif|png))/gi;
      const matches = textResponse.match(urlRegex);
      if (matches) {
        images = [...matches];
      }
      
      // If still no images, try to find image URLs in the source URLs
      if (images.length === 0 && sources.length > 0) {
        // Use the first source URL to validate and possibly fetch an image
        try {
          const sourceUrl = sources[0].url;
          const validateResult = await axios.get(sourceUrl, {
            responseType: 'text',
            timeout: 3000
          });
          
          // Look for image URLs in the HTML
          const imgRegex = /<img[^>]+src="([^">]+)"/g;
          let match;
          while ((match = imgRegex.exec(validateResult.data)) !== null) {
            // Only add reasonably sized images (avoid icons)
            if (!match[1].includes('icon') && !match[1].includes('logo')) {
              // Convert relative URLs to absolute
              const imgUrl = new URL(match[1], sourceUrl).href;
              images.push(imgUrl);
              if (images.length >= 3) break; // Limit to 3 images
            }
          }
        } catch (error) {
          console.error('Error fetching images from source:', error);
        }
      }
    }

    return res.status(200).json({
      textResponse,
      sources,
      images
    });
  } catch (error) {
    console.error('Error handling question with image:', error);
    return res.status(500).json({ 
      error: 'Failed to process request',
      details: error.message
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