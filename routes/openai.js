import express from 'express';
import OpenAI from 'openai';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * POST /api/openai/explain-image
 * 
 * Unified endpoint that handles both base64 and URL-based image processing
 * 
 * Expects a JSON body containing:
 *  - imageUrl: URL of the image to analyze
 *  - prompt: Specific question or instruction about the image
 *  - useDirectUrl: (optional) boolean to force using direct URL method
 * 
 * Returns:
 *  - { explanation: string, responseId: string, status: string, usage?: object } on success
 *  - { error: string, details?: string } on failure
 */
router.post('/explain-image', async (req, res) => {
  const { imageUrl, prompt, useDirectUrl } = req.body;

  // Validate required fields
  if (!imageUrl || !prompt) {
    return res.status(400).json({ 
      error: 'Missing required fields',
      details: 'Both imageUrl and prompt are required'
    });
  }

  try {
    // First validate the URL and get the image
    const imageResponse = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    // Validate content type
    const contentType = imageResponse.headers['content-type'];
    if (!contentType || !contentType.startsWith('image/')) {
      return res.status(400).json({
        error: 'Invalid URL',
        details: `URL does not point to a valid image. Content type: ${contentType}`
      });
    }

    let response;
    
    if (useDirectUrl) {
      // Use the direct URL method
      response = await openai.responses.create({
        model: "gpt-4o-mini",
        input: [{
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            {
              type: "input_image",
              image_url: imageUrl,
            },
          ],
        }],
      });

      return res.status(200).json({
        explanation: response.output_text,
        responseId: response.id,
        status: 'success'
      });
    } else {
      // Convert to base64 and use the base64 method
      const base64Image = Buffer.from(imageResponse.data).toString('base64');

      response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an expert Automotive Technical Advisor with extensive knowledge in vehicle systems, diagnostics, and technical specifications. Your responses must be direct, definitive, and authoritative. Never use tentative language like 'appears to be' or 'seems to be'. Instead, state facts directly and confidently. Focus on providing precise technical information, including specific measurements, specifications, and industry-standard terminology. Maintain a professional tone while delivering clear, assertive analysis."
          },
          {
            role: "user",
            content: [
              { 
                type: "text", 
                text: `As an Automotive Technical Advisor, provide a definitive technical analysis of this image. ${prompt} State facts directly and include specific measurements, specifications, and relevant technical details.` 
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${contentType};base64,${base64Image}`
                }
              }
            ]
          }
        ],
        max_tokens: 1000
      });

      return res.status(200).json({
        explanation: response.choices[0].message.content,
        responseId: response.id,
        status: 'success',
        usage: response.usage
      });
    }

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

export default router; 