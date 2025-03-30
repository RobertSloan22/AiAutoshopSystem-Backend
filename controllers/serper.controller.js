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
      timeout: 5000 // 5 second timeout
    });

    const contentType = response.headers['content-type'];
    const contentLength = response.headers['content-length'];

    // Check content type
    if (!contentType || !contentType.startsWith('image/')) {
      return false;
    }

    // Check file size (max 10MB)
    if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) {
      return false;
    }

    return true;
  } catch (error) {
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
    const { query, num = 5, vehicleInfo } = req.body;
    
    if (!vehicleInfo || !vehicleInfo.year || !vehicleInfo.make || !vehicleInfo.model) {
      return res.status(400).json({ error: 'Vehicle information is required' });
    }

    // Build a basic search query
    const vehicleString = `${vehicleInfo.year} ${vehicleInfo.make} ${vehicleInfo.model}`;
    const engineInfo = vehicleInfo.engine ? ` ${vehicleInfo.engine}` : '';
    
    // Construct final search query with technical diagram focus
    const technicalTerms = 'technical diagram schematic wiring diagram repair manual';
    const refinedQuery = `${vehicleString}${engineInfo} ${query} ${technicalTerms}`;

    console.log('Refined search query:', refinedQuery);

    const response = await axios.post('https://google.serper.dev/images', {
      q: refinedQuery,
      num: Math.min(30, Math.max(5, num)) // Get more results for filtering
    }, {
      headers: {
        'X-API-KEY': process.env.VITE_SERPER_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    // Filter results to ensure valid image URLs and vehicle relevance
    let filteredResults = await Promise.all(
      (response.data.images || []).map(async (image) => {
        // First check if the image URL has a valid extension
        if (!hasValidImageExtension(image.imageUrl)) {
          return null;
        }

        // Then check vehicle relevance
        const imageText = `${image.title} ${image.link} ${image.source}`.toLowerCase();
        const vehicleTerms = [
          vehicleInfo.year.toString(),
          vehicleInfo.make.toLowerCase(),
          vehicleInfo.model.toLowerCase()
        ];

        // Must match at least one vehicle term
        if (!vehicleTerms.some(term => imageText.includes(term))) {
          return null;
        }

        // Check if the image is likely a technical diagram or schematic
        const technicalKeywords = [
          'diagram',
          'schematic',
          'wiring',
          'technical',
          'manual',
          'repair diagram',
          'service manual',
          'circuit',
          'blueprint',
          'layout'
        ];

        // Require at least one technical keyword in the image metadata
        if (!technicalKeywords.some(keyword => imageText.includes(keyword))) {
          return null;
        }

        // Finally check if the image is accessible and meets OpenAI's requirements
        const isAccessible = await validateImageAccessibility(image.imageUrl);
        if (!isAccessible) {
          return null;
        }

        return image;
      })
    );

    // Remove null results and take the specified number
    filteredResults = filteredResults.filter(Boolean).slice(0, num);

    // Save each image to the database
    const savedImages = await Promise.all(
      filteredResults.map(async (image) => {
        const savedImage = await saveImage(image);
        return savedImage || image; // Return original image if save fails
      })
    );

    // Log filtering results for debugging
    console.log('Image search results:', {
      totalResults: response.data.images?.length || 0,
      filteredResults: filteredResults.length,
      finalResults: savedImages.length,
      validExtensions: savedImages.map(img => new URL(img.imageUrl).pathname)
    });

    res.json({ 
      images: savedImages,
      metadata: {
        originalQuery: query,
        refinedQuery,
        totalResults: response.data.images?.length || 0,
        filteredResults: filteredResults.length,
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
