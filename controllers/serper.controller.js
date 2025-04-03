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
    const { query, num = 50, vehicleInfo } = req.body;
    
    if (!vehicleInfo || !vehicleInfo.year || !vehicleInfo.make || !vehicleInfo.model) {
      return res.status(400).json({ error: 'Vehicle information is required' });
    }

    // Build a basic search query
    const vehicleString = `${vehicleInfo.year} ${vehicleInfo.make} ${vehicleInfo.model}`;
    const engineInfo = vehicleInfo.engine ? ` ${vehicleInfo.engine}` : '';
    
    // Determine if the query is for a specific part/component
    const commonPartTerms = ['pump', 'sensor', 'belt', 'module', 'routing', 'circuit', 'filter', 'motor', 'valve', 'relay', 'switch', 'module', 'harness'];
    const isPartQuery = query.toLowerCase().split(' ').some(word => commonPartTerms.includes(word));
    
    // Construct final search query based on query type
    let technicalTerms;
    if (isPartQuery) {
      // For part queries, focus on diagrams and locations
      technicalTerms = `"${query}" (diagram OR schematic OR "parts diagram" OR "exploded view" OR "repair diagram")`;
    } else if (query.toLowerCase().includes('diagram') || query.toLowerCase().includes('manual')) {
      technicalTerms = query;  // If query already contains technical terms, don't add more
    } else {
      technicalTerms = `${query} (diagram OR schematic OR "repair manual" OR "service manual")`;
    }
    
    // Ensure vehicle specificity in the query
    const refinedQuery = `"${vehicleString}" ${engineInfo} ${technicalTerms}`;

    console.log('Refined search query:', refinedQuery);

    const response = await axios.post('https://google.serper.dev/images', {
      q: refinedQuery,
      num: Math.min(100, Math.max(20, num * 3)) // Increase initial results pool
    }, {
      headers: {
        'X-API-KEY': process.env.VITE_SERPER_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    // Helper function to detect if image is likely a diagram
    const isDiagramImage = (imageText, imageUrl) => {
      const diagramIndicators = [
        'diagram',
        'schematic',
        'exploded view',
        'parts catalog',
        'repair manual',
        'service manual',
        'technical drawing',
        'assembly diagram',
        'wiring diagram'
      ];

      // Check text for strong diagram indicators
      const hasStrongIndicator = diagramIndicators.some(indicator => 
        imageText.includes(indicator)
      );

      // Check URL for diagram-related patterns
      const urlIndicators = [
        'diagram',
        'schematic',
        'manual',
        'repair',
        'parts',
        'exploded'
      ];
      
      const urlText = imageUrl.toLowerCase();
      const hasUrlIndicator = urlIndicators.some(indicator => 
        urlText.includes(indicator)
      );

      return hasStrongIndicator || hasUrlIndicator;
    };

    // Filter results with more lenient criteria
    let filteredResults = await Promise.all(
      (response.data.images || []).map(async (image) => {
        // Basic URL validation
        if (!image.imageUrl || !hasValidImageExtension(image.imageUrl)) {
          return null;
        }

        // Check vehicle relevance with flexible matching
        const imageText = `${image.title} ${image.link} ${image.source}`.toLowerCase();
        const vehicleTerms = [
          vehicleInfo.year.toString(),
          vehicleInfo.make.toLowerCase(),
          vehicleInfo.model.toLowerCase()
        ];

        // Initialize relevance score
        image.relevanceScore = 0;

        // Check if it's likely a diagram
        const isDiagram = isDiagramImage(imageText, image.imageUrl);
        if (!isDiagram) {
          return null; // Filter out non-diagram images
        }
        image.relevanceScore += 3; // Boost score for being a diagram

        // For part queries, require stricter vehicle matching but still reasonable
        if (isPartQuery) {
          // Must match (make AND model) AND contain the part name
          const hasMake = imageText.includes(vehicleInfo.make.toLowerCase());
          const hasModel = imageText.includes(vehicleInfo.model.toLowerCase());
          const hasPart = query.toLowerCase().split(' ').some(word => imageText.includes(word));
          
          // Optional but beneficial matches
          const hasYear = imageText.includes(vehicleInfo.year.toString());
          const hasEngine = vehicleInfo.engine && imageText.includes(vehicleInfo.engine.toLowerCase());
          
          // Require core matches
          if (!hasMake || !hasModel || !hasPart) {
            return null;
          }
          
          // Add to relevance score
          image.relevanceScore += (hasYear ? 2 : 0) + (hasEngine ? 1 : 0);
          image.relevanceScore += hasPart ? 2 : 0; // Boost score for part match
        } else {
          // For non-part queries, use more lenient matching
          const hasMake = imageText.includes(vehicleInfo.make.toLowerCase());
          const hasModelOrYear = vehicleTerms.slice(0, 2).some(term => imageText.includes(term));
          
          if (!hasMake || !hasModelOrYear) {
            return null;
          }
          
          image.relevanceScore += vehicleTerms.filter(term => imageText.includes(term)).length;
        }

        // Check for specific diagram types and boost score accordingly
        const diagramTypes = [
          'exploded view',
          'parts diagram',
          'assembly diagram',
          'technical drawing',
          'repair diagram',
          'service diagram'
        ];

        for (const type of diagramTypes) {
          if (imageText.includes(type)) {
            image.relevanceScore += 1;
          }
        }

        // Validate image accessibility
        const isAccessible = await validateImageAccessibility(image.imageUrl);
        if (!isAccessible) {
          return null;
        }

        return image;
      })
    );

    // Remove null results
    filteredResults = filteredResults.filter(Boolean);
    
    // Sort results by relevance score and matching terms
    filteredResults.sort((a, b) => {
      // First compare relevance scores
      if (a.relevanceScore !== b.relevanceScore) {
        return b.relevanceScore - a.relevanceScore;
      }
      
      // If scores are equal, check for exact query matches
      const textA = `${a.title} ${a.link} ${a.source}`.toLowerCase();
      const textB = `${b.title} ${b.link} ${b.source}`.toLowerCase();
      
      const queryTerms = query.toLowerCase().split(' ');
      const matchesA = queryTerms.filter(term => textA.includes(term)).length;
      const matchesB = queryTerms.filter(term => textB.includes(term)).length;
      
      return matchesB - matchesA;
    });

    // Take the specified number of results, but ensure we have at least some results
    const minResults = Math.min(3, filteredResults.length);
    filteredResults = filteredResults.slice(0, Math.max(minResults, num));

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
