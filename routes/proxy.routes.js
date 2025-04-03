import express from 'express';
import axios from 'axios';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import Image from '../models/image.model.js';

dotenv.config();

const router = express.Router();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Helper function to get image explanation using OpenAI Vision API
const getImageExplanation = async (imageUrl, prompt = "What's in this image?") => {
  try {
    // Check if the URL is already a data URL (base64)
    if (imageUrl.startsWith('data:image/')) {
      const base64Image = imageUrl.split(',')[1];
      const contentType = imageUrl.split(',')[0].split(':')[1].split(';')[0];
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: {
                  url: `data:${contentType};base64,${base64Image}`
                }
              }
            ]
          }
        ],
        max_tokens: 500
      });

      return response.choices[0].message.content;
    }

    // If it's a direct image URL, use it directly with OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: imageUrl
            }
          ]
        }
      ],
      max_tokens: 500
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error('Error getting image explanation:', error);
    return null;
  }
};

// Proxy image with optional explanation
router.get('/proxy-image', async (req, res) => {
  try {
    const { url, explain, prompt } = req.query;
    
    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    const decodedUrl = decodeURIComponent(url);
    
    // Enhanced headers to mimic a browser request
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Referer': new URL(decodedUrl).origin,
      'Sec-Fetch-Dest': 'image',
      'Sec-Fetch-Mode': 'no-cors',
      'Sec-Fetch-Site': 'cross-site',
      'Pragma': 'no-cache',
      'Cache-Control': 'no-cache',
      'Origin': new URL(decodedUrl).origin,
      'Connection': 'keep-alive'
    };

    try {
      const response = await axios({
        method: 'get',
        url: decodedUrl,
        responseType: 'stream',
        headers,
        timeout: 10000,
        validateStatus: (status) => status < 500,
        maxRedirects: 5
      });
      
      // Check for 404 and other client errors
      if (response.status >= 400) {
        return res.status(response.status).json({
          error: `Image not found or inaccessible`,
          status: response.status,
          url: decodedUrl
        });
      }

      // Forward the content type and other relevant headers
      res.set('Content-Type', response.headers['content-type']);
      res.set('Cache-Control', 'public, max-age=31536000');
      
      // If explanation is requested, get it and store in database
      if (explain === 'true') {
        const finalImageUrl = response.request.res.responseUrl || decodedUrl;

        const explanation = await getImageExplanation(finalImageUrl, prompt);
        
        if (!explanation) {
          return res.status(500).json({ 
            error: 'Failed to generate image explanation',
            details: 'The image could not be processed for explanation'
          });
        }

        // Create image record in database only if we have an explanation
        const imageData = {
          title: 'Proxied Image',
          imageUrl: finalImageUrl,
          thumbnailUrl: finalImageUrl,
          source: new URL(finalImageUrl).hostname,
          link: finalImageUrl,
          originalUrl: finalImageUrl,
          timestamp: new Date(),
          explanation: explanation
        };

        await Image.create(imageData);
      }
      
      // Pipe the image data to the response
      response.data.pipe(res);
    } catch (proxyError) {
      // If the direct proxy fails, try to fetch the page first to get the actual image URL
      try {
        const pageResponse = await axios.get(decodedUrl, {
          headers: {
            ...headers,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
          },
          timeout: 10000,
          validateStatus: (status) => status < 500
        });
        
        // Check for client errors when fetching the page
        if (pageResponse.status >= 400) {
          return res.status(pageResponse.status).json({
            error: `Page not found or inaccessible`,
            status: pageResponse.status,
            url: decodedUrl
          });
        }

        // Extract the actual image URL from the page content
        const html = pageResponse.data;
        const imgRegex = /<img[^>]+src="([^"]+\.(png|jpg|jpeg|webp|gif))"/gi;
        const matches = [...html.matchAll(imgRegex)];
        
        if (matches.length > 0) {
          const actualImageUrl = new URL(matches[0][1], decodedUrl).href;
          
          // Try to fetch the actual image
          const imageResponse = await axios({
            method: 'get',
            url: actualImageUrl,
            responseType: 'stream',
            headers,
            timeout: 10000,
            validateStatus: (status) => status < 500,
            maxRedirects: 5
          });
          
          // Check for client errors when fetching the actual image
          if (imageResponse.status >= 400) {
            return res.status(imageResponse.status).json({
              error: `Image not found or inaccessible`,
              status: imageResponse.status,
              url: actualImageUrl
            });
          }

          res.set('Content-Type', imageResponse.headers['content-type']);
          res.set('Cache-Control', 'public, max-age=31536000');

          // If explanation is requested, get it and store in database
          if (explain === 'true') {
            const finalImageUrl = imageResponse.request.res.responseUrl || actualImageUrl;

            const explanation = await getImageExplanation(finalImageUrl, prompt);
            
            if (!explanation) {
              return res.status(500).json({ 
                error: 'Failed to generate image explanation',
                details: 'The image could not be processed for explanation'
              });
            }

            // Create image record in database only if we have an explanation
            const imageData = {
              title: 'Proxied Image',
              imageUrl: finalImageUrl,
              thumbnailUrl: finalImageUrl,
              source: new URL(finalImageUrl).hostname,
              link: finalImageUrl,
              originalUrl: finalImageUrl,
              timestamp: new Date(),
              explanation: explanation
            };

            await Image.create(imageData);
          }

          imageResponse.data.pipe(res);
        } else {
          throw new Error('No valid image URLs found in page content');
        }
      } catch (fallbackError) {
        res.status(404).json({ 
          error: 'Failed to proxy image',
          details: {
            message: 'The requested image could not be found or is inaccessible',
            directError: proxyError.message,
            fallbackError: fallbackError.message
          }
        });
      }
    }
  } catch (error) {
    console.error('Image proxy error:', {
      error: error.message,
      url: req.query.url,
      stack: error.stack
    });
    res.status(500).json({ 
      error: 'Failed to proxy image',
      details: `Unable to process image request: ${error.message}`
    });
  }
});

// Route to get explanation for a proxied image
router.post('/proxy-image/explain', async (req, res) => {
  try {
    const { url, prompt } = req.body;
    
    if (!url) {
      return res.status(400).json({
        error: 'Image URL is required'
      });
    }

    const explanation = await getImageExplanation(url, prompt);
    
    if (!explanation) {
      return res.status(500).json({
        error: 'Failed to get image explanation',
        details: 'The image could not be processed for explanation'
      });
    }

    // Create image record in database only if we have an explanation
    const imageData = {
      title: 'Proxied Image',
      imageUrl: url,
      thumbnailUrl: url,
      source: new URL(url).hostname,
      link: url,
      originalUrl: url,
      timestamp: new Date(),
      explanation: explanation
    };

    const savedImage = await Image.create(imageData);
    res.json(savedImage);
  } catch (error) {
    console.error('Error getting image explanation:', error);
    res.status(500).json({
      error: 'Failed to get image explanation',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router; 