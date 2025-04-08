import express from 'express';
import Image from '../models/image.model.js';
import protectRoute from "../middleware/protectRoute.js";
import axios from 'axios';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Helper function to validate if URL points to an image
const isValidImageUrl = async (url) => {
  if (!url) return true;
  
  try {
    if (url.startsWith('data:image/') || url.includes('/proxy-image')) {
      return true;
    }

    const response = await axios.head(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 5000,
      validateStatus: (status) => status < 400
    });
    
    const contentType = response.headers['content-type'];
    return contentType && (
      contentType.startsWith('image/') || 
      contentType.includes('application/octet-stream')
    );
  } catch (error) {
    console.error('Error validating image URL:', error);
    return true;
  }
};

// Helper function to get image explanation from OpenAI
const getImageExplanation = async (imageUrl, prompt = "Describe this image in detail.") => {
  try {
    const imageResponse = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const contentType = imageResponse.headers['content-type'];
    if (!contentType || !contentType.startsWith('image/')) {
      throw new Error('Invalid image content type');
    }

    const base64Image = Buffer.from(imageResponse.data).toString('base64');

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

    return {
      explanation: response.choices[0].message.content,
      responseId: response.id,
      usage: response.usage
    };
  } catch (error) {
    console.error('Error getting image explanation:', error);
    return null;
  }
};

// POST /api/response-images - Create new image with explanation
router.post('/response-images', protectRoute, async (req, res) => {
    try {
        const { imageUrl, thumbnailUrl, title, source, link, originalUrl, prompt } = req.body;
        
        // Validate required fields
        if (!imageUrl) {
            return res.status(400).json({ error: 'imageUrl is required' });
        }
        if (!thumbnailUrl) {
            return res.status(400).json({ error: 'thumbnailUrl is required' });
        }
        if (!source) {
            return res.status(400).json({ error: 'source is required' });
        }
        if (!link) {
            return res.status(400).json({ error: 'link is required' });
        }

        // Validate the main image URL
        const isValidImage = await isValidImageUrl(imageUrl);
        if (!isValidImage) {
            return res.status(400).json({ 
                error: 'Invalid image URL. URL must point to an actual image file.' 
            });
        }

        // Get image explanation from OpenAI
        const explanation = await getImageExplanation(imageUrl, prompt);

        const imageData = {
            title: title || 'Untitled',
            imageUrl,
            thumbnailUrl,
            source,
            link,
            originalUrl: originalUrl || imageUrl,
            timestamp: new Date(),
            explanation: explanation || null
        };
        
        const savedImage = await Image.create(imageData);
        res.status(201).json(savedImage);
    } catch (error) {
        console.error('Failed to save image with explanation:', error);
        res.status(500).json({ 
            error: 'Failed to save image with explanation',
            details: error.message 
        });
    }
});

// GET /api/response-images - Get all images with explanations
router.get('/response-images', protectRoute, async (req, res) => {
  try {
    const images = await Image.find().sort({ timestamp: -1 });
    res.json(images);
  } catch (error) {
    console.error('Failed to fetch images:', error);
    res.status(500).json({ error: 'Failed to fetch images' });
  }
});

// DELETE /api/response-images/:id - Delete an image
router.delete('/response-images/:id', protectRoute, async (req, res) => {
  try {
    const { id } = req.params;
    const deletedImage = await Image.findByIdAndDelete(id);
    
    if (!deletedImage) {
      return res.status(404).json({ error: 'Image not found' });
    }
    
    res.json({ message: 'Image deleted successfully' });
  } catch (error) {
    console.error('Failed to delete image:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

export default router; 