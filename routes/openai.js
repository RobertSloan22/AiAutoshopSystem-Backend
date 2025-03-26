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
 * Expects a JSON body containing:
 *  - imageUrl: URL of the image to analyze
 *  - prompt: Specific question or instruction about the image
 * 
 * Returns:
 *  - { explanation: string, responseId: string, status: string, usage: object } on success
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

    // Convert to base64
    const base64Image = Buffer.from(imageResponse.data).toString('base64');

    // Make the OpenAI API call
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { 
              type: "text", 
              text: prompt 
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

    // Log the response structure for debugging
    console.log('OpenAI Response:', JSON.stringify(response, null, 2));

    return res.status(200).json({
      explanation: response.choices[0].message.content,
      responseId: response.id,
      status: 'success',
      usage: response.usage
    });

  } catch (error) {
    console.error('Error processing image explanation:', error);
    
    // Provide more specific error messages
    if (error.response) {
      return res.status(error.response.status).json({
        error: 'Failed to fetch image',
        details: error.response.data || error.message
      });
    }
    
    return res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router; 