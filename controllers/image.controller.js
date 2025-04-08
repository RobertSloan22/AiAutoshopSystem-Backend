import axios from 'axios';
import Image from '../models/image.model.js';

// Helper function to validate image URL extension
const hasValidImageExtension = (url) => {
  const validExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
  try {
    const urlObj = new URL(url);
    return validExtensions.some(ext => 
      urlObj.pathname.toLowerCase().endsWith(ext)
    );
  } catch (error) {
    return false;
  }
};

// Helper function to validate image URL is accessible and has correct content type
const validateImageAccessibility = async (url) => {
  try {
    const response = await axios.head(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 3000 // 3 second timeout
    });

    const contentType = response.headers['content-type'];
    
    // Check if content type is an image
    if (!contentType || !contentType.startsWith('image/')) {
      console.log(`Invalid content type for ${url}: ${contentType}`);
      return false;
    }

    return true;
  } catch (error) {
    console.log(`Failed to validate image: ${url} - ${error.message}`);
    return false;
  }
};

// Helper function to save image to database
const saveImage = async (imageData) => {
  try {
    const image = await Image.create({
      title: imageData.title || 'Untitled',
      imageUrl: imageData.imageUrl,
      thumbnailUrl: imageData.thumbnail || imageData.imageUrl,
      source: imageData.source || new URL(imageData.imageUrl).hostname,
      link: imageData.link || imageData.imageUrl,
      originalUrl: imageData.imageUrl,
      timestamp: new Date()
    });
    return image;
  } catch (error) {
    console.error('Failed to save image:', error);
    return null;
  }
};

export const searchImages = async (req, res) => {
  try {
    const { query, num = 5 } = req.body;
    
    const response = await axios.post('https://google.serper.dev/images', {
      q: query,
      num: Math.min(100, Math.max(20, num * 2)) // Increase initial results pool
    }, {
      headers: {
        'X-API-KEY': process.env.VITE_SERPER_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    // First filter: Apply extension validation
    let results = (response.data.images || []).filter(image => 
      image.imageUrl && hasValidImageExtension(image.imageUrl)
    );

    console.log(`Found ${results.length} images with valid extensions`);

    // Second filter: Content-type validation (async)
    results = await Promise.all(
      results.map(async (image) => {
        // Validate image accessibility and content-type
        const isValidImage = await validateImageAccessibility(image.imageUrl);
        return isValidImage ? image : null;
      })
    );

    // Remove null results (failed validation)
    results = results.filter(Boolean);
    
    console.log(`Found ${results.length} images with valid content types`);

    // Limit results to requested number
    results = results.slice(0, num);

    // Save each image to the database
    const savedImages = await Promise.all(
      results.map(async (image) => {
        const savedImage = await saveImage(image);
        return savedImage || image; // Return original image if save fails
      })
    );

    // Log results for debugging
    console.log('Image search results:', {
      totalResults: response.data.images?.length || 0,
      validImages: results.length,
      finalResults: savedImages.length
    });

    res.json({ 
      images: savedImages,
      metadata: {
        originalQuery: query,
        totalResults: response.data.images?.length || 0,
        validImages: results.length,
        finalResults: savedImages.length
      }
    });
  } catch (error) {
    console.error('Serper API error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Search failed',
      message: error.response?.data?.message || error.message
    });
  }
};