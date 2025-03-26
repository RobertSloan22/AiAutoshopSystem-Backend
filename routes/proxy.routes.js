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
    console.log('Proxy request details:', {
      originalUrl: url,
      decodedUrl,
      explain,
      prompt,
      timestamp: new Date().toISOString()
    });

    // Check if URL is from a known blocked domain
    const blockedDomains = [
      'hyundai.oempartsonline.com',
      'toyota.parts.com',
      'honda.parts.com',
      'nissan.parts.com',
      'ford.parts.com',
      'gm.parts.com'
    ];

    const urlObj = new URL(decodedUrl);
    if (blockedDomains.some(domain => urlObj.hostname.includes(domain))) {
      console.log('Blocked domain detected:', {
        domain: urlObj.hostname,
        url: decodedUrl
      });
      return res.status(403).json({
        error: 'Access to this domain is blocked',
        details: 'This website does not allow direct image access. Please try a different image source.',
        domain: urlObj.hostname
      });
    }
    
    // Enhanced headers to mimic a browser request
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
      'Connection': 'keep-alive',
      'sec-ch-ua': '"Not A(Brand";v="99", "Google Chrome";v="120", "Chromium";v="120"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'Upgrade-Insecure-Requests': '1'
    };

    console.log('Request headers:', headers);

    try {
      const response = await axios({
        method: 'get',
        url: decodedUrl,
        responseType: 'stream',
        headers,
        timeout: 10000,
        validateStatus: (status) => status < 400,
        maxRedirects: 5
      });

      // Check if the response is actually an image
      const contentType = response.headers['content-type'];
      if (!contentType || !contentType.startsWith('image/')) {
        console.error('Invalid content type received:', {
          contentType,
          url: decodedUrl,
          headers: response.headers
        });
        return res.status(400).json({
          error: 'Invalid content type',
          details: 'The URL does not point to a valid image file',
          contentType
        });
      }

      console.log('Direct proxy response:', {
        status: response.status,
        contentType,
        url: response.config.url,
        finalUrl: response.request.res.responseUrl
      });

      // Forward the content type and other relevant headers
      res.set('Content-Type', contentType);
      res.set('Cache-Control', 'public, max-age=31536000');
      
      // If explanation is requested, get it and store in database
      if (explain === 'true') {
        const finalImageUrl = response.request.res.responseUrl || decodedUrl;
        console.log('Getting explanation for image:', {
          originalUrl: decodedUrl,
          finalImageUrl,
          contentType
        });

        const explanation = await getImageExplanation(finalImageUrl, prompt);
        
        if (!explanation) {
          console.error('Failed to generate explanation for:', finalImageUrl);
          return res.status(500).json({ 
            error: 'Failed to generate image explanation',
            details: 'The image could not be processed for explanation'
          });
        }

        console.log('Successfully generated explanation for:', finalImageUrl);

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

        const savedImage = await Image.create(imageData);
        console.log('Saved image record:', {
          id: savedImage._id,
          imageUrl: savedImage.imageUrl,
          source: savedImage.source
        });
      }
      
      // Pipe the image data to the response
      response.data.pipe(res);
    } catch (proxyError) {
      console.error('Direct proxy attempt failed:', {
        error: proxyError.message,
        url: decodedUrl,
        status: proxyError.response?.status,
        headers: proxyError.response?.headers
      });

      // If we get a 403, return a more helpful error message
      if (proxyError.response?.status === 403) {
        return res.status(403).json({
          error: 'Access denied',
          details: 'This website does not allow direct image access. Please try a different image source.',
          domain: urlObj.hostname
        });
      }
      
      // For other errors, try the fallback method
      try {
        const pageResponse = await axios.get(decodedUrl, {
          headers: {
            ...headers,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
          }
        });

        console.log('Page fetch response:', {
          status: pageResponse.status,
          contentType: pageResponse.headers['content-type'],
          url: pageResponse.config.url
        });

        // Extract the actual image URL from the page content
        const html = pageResponse.data;
        const imgRegex = /<img[^>]+src="([^"]+\.(png|jpg|jpeg|webp|gif))"/gi;
        const matches = [...html.matchAll(imgRegex)];
        
        if (matches.length > 0) {
          const actualImageUrl = new URL(matches[0][1], decodedUrl).href;
          console.log('Found valid image URL in page:', {
            originalUrl: decodedUrl,
            actualImageUrl,
            extension: matches[0][2]
          });
          
          // Try to fetch the actual image
          const imageResponse = await axios({
            method: 'get',
            url: actualImageUrl,
            responseType: 'stream',
            headers,
            timeout: 10000,
            validateStatus: (status) => status < 400,
            maxRedirects: 5
          });

          console.log('Actual image response:', {
            status: imageResponse.status,
            contentType: imageResponse.headers['content-type'],
            url: imageResponse.config.url,
            finalUrl: imageResponse.request.res.responseUrl
          });

          res.set('Content-Type', imageResponse.headers['content-type']);
          res.set('Cache-Control', 'public, max-age=31536000');

          // If explanation is requested, get it and store in database
          if (explain === 'true') {
            const finalImageUrl = imageResponse.request.res.responseUrl || actualImageUrl;
            console.log('Getting explanation for extracted image:', {
              originalUrl: decodedUrl,
              extractedUrl: actualImageUrl,
              finalImageUrl,
              contentType: imageResponse.headers['content-type']
            });

            const explanation = await getImageExplanation(finalImageUrl, prompt);
            
            if (!explanation) {
              console.error('Failed to generate explanation for extracted image:', finalImageUrl);
              return res.status(500).json({ 
                error: 'Failed to generate image explanation',
                details: 'The image could not be processed for explanation'
              });
            }

            console.log('Successfully generated explanation for extracted image:', finalImageUrl);

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

            const savedImage = await Image.create(imageData);
            console.log('Saved extracted image record:', {
              id: savedImage._id,
              imageUrl: savedImage.imageUrl,
              source: savedImage.source
            });
          }

          imageResponse.data.pipe(res);
        } else {
          console.error('No valid image URLs found in page:', {
            url: decodedUrl,
            contentLength: html.length
          });
          return res.status(400).json({
            error: 'No valid images found',
            details: 'The page does not contain any valid image URLs with supported extensions (.png, .jpg, .jpeg, .webp, .gif)'
          });
        }
      } catch (fallbackError) {
        console.error('Fallback proxy attempt failed:', {
          error: fallbackError.message,
          url: decodedUrl,
          status: fallbackError.response?.status
        });
        res.status(500).json({ 
          error: 'Failed to proxy image',
          details: process.env.NODE_ENV === 'development' ? {
            directError: proxyError.message,
            fallbackError: fallbackError.message
          } : 'Unable to access the image. The website may be blocking access or the image may not exist.'
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
      details: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred while processing the image.'
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