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

// Helper function to get image explanation from OpenAI
const getImageExplanation = async (imageUrl, prompt = "Describe this image in detail.") => {
  try {
    // Enhanced headers to mimic a browser request
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Referer': new URL(imageUrl).origin,
      'Sec-Fetch-Dest': 'image',
      'Sec-Fetch-Mode': 'no-cors',
      'Sec-Fetch-Site': 'cross-site',
      'Pragma': 'no-cache',
      'Cache-Control': 'no-cache',
      'Origin': new URL(imageUrl).origin,
      'Connection': 'keep-alive'
    };

    // First try to get the image directly
    try {
      const imageResponse = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        headers,
        timeout: 10000,
        validateStatus: (status) => status < 400,
        maxRedirects: 5
      });

      const contentType = imageResponse.headers['content-type'];
      if (!contentType || !contentType.startsWith('image/')) {
        throw new Error('Invalid image content type');
      }

      const base64Image = Buffer.from(imageResponse.data).toString('base64');

      // Create the vision API request
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
                  url: `data:${contentType};base64,${base64Image}`,
                  detail: "high" // Use high detail for better analysis
                }
              }
            ]
          }
        ],
        max_tokens: 1000
      });

      if (!response.choices?.[0]?.message?.content) {
        throw new Error('No explanation generated');
      }

      return {
        explanation: response.choices[0].message.content,
        responseId: response.id,
        usage: response.usage,
        model: response.model
      };
    } catch (directError) {
      console.error('Direct image fetch failed:', directError.message);
      
      // For trusted domains that block direct access, try to fetch the page first
      const trustedDomains = ['hyundai.oempartsonline.com'];
      const urlObj = new URL(imageUrl);
      
      if (trustedDomains.includes(urlObj.hostname)) {
        // Try to fetch the page and extract the actual image URL
        const pageResponse = await axios.get(imageUrl, {
          headers: {
            ...headers,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
          },
          timeout: 10000,
          validateStatus: (status) => status < 400,
          maxRedirects: 5
        });

        const html = pageResponse.data;
        const imgMatch = html.match(/<img[^>]+src="([^"]+)"/);
        
        if (imgMatch && imgMatch[1]) {
          const actualImageUrl = new URL(imgMatch[1], imageUrl).href;
          
          // Try to fetch the actual image
          const imageResponse = await axios.get(actualImageUrl, {
            responseType: 'arraybuffer',
            headers,
            timeout: 10000,
            validateStatus: (status) => status < 400,
            maxRedirects: 5
          });

          const contentType = imageResponse.headers['content-type'];
          if (!contentType || !contentType.startsWith('image/')) {
            throw new Error('Invalid image content type from extracted URL');
          }

          const base64Image = Buffer.from(imageResponse.data).toString('base64');

          // Create the vision API request with the actual image
          const response = await openai.chat.completions.create({
            model: "gpt-4-vision-preview",
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
                      url: `data:${contentType};base64,${base64Image}`,
                      detail: "high"
                    }
                  }
                ]
              }
            ],
            max_tokens: 1000
          });

          if (!response.choices?.[0]?.message?.content) {
            throw new Error('No explanation generated');
          }

          return {
            explanation: response.choices[0].message.content,
            responseId: response.id,
            usage: response.usage,
            model: response.model
          };
        }
      }
      
      throw directError; // Re-throw the original error if we couldn't handle it
    }
  } catch (error) {
    console.error('Error getting image explanation:', error);
    if (error.response?.data?.error) {
      console.error('OpenAI API error:', error.response.data.error);
    }
    return null;
  }
};

// Helper function to extract actual image URL from search result
const extractActualImageUrl = async (searchUrl) => {
  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Referer': new URL(searchUrl).origin,
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1'
    };

    const pageResponse = await axios.get(searchUrl, {
      headers,
      timeout: 10000,
      validateStatus: (status) => status < 400,
      maxRedirects: 5
    });

    const html = pageResponse.data;
    
    // Look for image tags with valid extensions
    const imgRegex = /<img[^>]+src="([^"]+\.(png|jpg|jpeg|webp|gif))"/gi;
    const matches = [...html.matchAll(imgRegex)];
    
    if (matches.length > 0) {
      // Return the first valid image URL found
      return new URL(matches[0][1], searchUrl).href;
    }

    return null;
  } catch (error) {
    console.error('Error extracting image URL:', error);
    return null;
  }
};

// Helper function to validate if URL points to an image
const isValidImageUrl = async (url) => {
  if (!url) return false;
  
  try {
    // If it's already a proxied URL or data URL, consider it valid
    if (url.startsWith('data:image/') || url.includes('/proxy-image')) {
      return true;
    }

    // Check if URL ends with valid image extensions
    const validExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
    const urlObj = new URL(url);
    const hasValidExtension = validExtensions.some(ext => 
      urlObj.pathname.toLowerCase().endsWith(ext)
    );

    if (!hasValidExtension) {
      // If no valid extension, try to extract image URL from the page
      const actualImageUrl = await extractActualImageUrl(url);
      if (!actualImageUrl) {
        return false;
      }
      return actualImageUrl;
    }

    // If URL has valid extension, validate it's actually an image
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Referer': urlObj.origin,
      'Sec-Fetch-Dest': 'image',
      'Sec-Fetch-Mode': 'no-cors',
      'Sec-Fetch-Site': 'cross-site',
      'Pragma': 'no-cache',
      'Cache-Control': 'no-cache',
      'Origin': urlObj.origin,
      'Connection': 'keep-alive'
    };

    const response = await axios.head(url, {
      headers,
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
    return false;
  }
};

router.post('/images', protectRoute, async (req, res) => {
    try {
        const { imageUrl, thumbnailUrl, title, source, link, originalUrl, prompt } = req.body;
        
        // Validate the main image URL and get actual image URL if needed
        const validatedImageUrl = await isValidImageUrl(imageUrl);
        if (!validatedImageUrl) {
            return res.status(400).json({ 
                error: 'Invalid image URL. URL must point to an actual image file with valid extension (.png, .jpg, .jpeg, .webp, or .gif).' 
            });
        }

        // Get image explanation using the validated image URL
        const explanation = await getImageExplanation(validatedImageUrl, prompt);
        
        if (!explanation) {
            return res.status(500).json({ 
                error: 'Failed to generate image explanation',
                details: 'The image could not be processed for explanation'
            });
        }

        // Create image record with explanation
        const imageData = {
            title: title || 'Untitled',
            imageUrl: validatedImageUrl, // Use the validated image URL
            thumbnailUrl: thumbnailUrl || validatedImageUrl,
            source: source || new URL(validatedImageUrl).hostname,
            link: link || validatedImageUrl,
            originalUrl: originalUrl || validatedImageUrl,
            timestamp: new Date(),
            explanation: explanation
        };
        
        const savedImage = await Image.create(imageData);
        res.status(201).json(savedImage);
    } catch (error) {
        console.error('Failed to save image:', error);
        res.status(500).json({ 
            error: 'Failed to save image',
            details: error.message 
        });
    }
});

router.get('/images', protectRoute, async (req, res) => {
  try {
    const images = await Image.find().sort({ timestamp: -1 }); // Sort by newest first
    res.json(images);
  } catch (error) {
    console.error('Failed to fetch images:', error);
    res.status(500).json({ error: 'Failed to fetch images' });
  }
});

router.delete('/images/:id', protectRoute, async (req, res) => {
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