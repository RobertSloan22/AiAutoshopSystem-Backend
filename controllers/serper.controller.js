import axios from 'axios';
import Image from '../models/image.model.js';
import stringSimilarity from 'string-similarity';
import pLimit from 'p-limit';

const limit = pLimit(10);

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
const validateImageAccessibility = async (url, retries = 2) => {
  for (let i = 0; i <= retries; i++) {
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
    } catch (err) {
      if (i === retries) return false;
      await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)));
    }
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

const computeSemanticScore = (text, query) => {
  return stringSimilarity.compareTwoStrings(text, query);
};

export const searchImages = async (req, res) => {
  try {
    const { query, num = 100, vehicleInfo } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    // Build search query based on whether vehicle info is provided
    let refinedQuery;
    let isPartQuery = false;
    
    if (vehicleInfo && vehicleInfo.year && vehicleInfo.make && vehicleInfo.model) {
      // Vehicle information is provided
      const vehicleString = `${vehicleInfo.year} ${vehicleInfo.make} ${vehicleInfo.model}`;
      const engineInfo = vehicleInfo.engine ? ` ${vehicleInfo.engine}` : '';
      
      // Determine if the query is for a specific part/component
      const commonPartTerms = ['pump', 'sensor', 'belt', 'module', 'routing', 'circuit', 'filter', 'motor', 'valve', 'relay', 'switch', 'harness'];
      isPartQuery = query.toLowerCase().split(' ').some(word => commonPartTerms.includes(word));
      
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
      refinedQuery = `"${vehicleString}"${engineInfo} ${technicalTerms}`;
    } else {
      // No vehicle information - just use the query as is
      refinedQuery = query;
    }

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

    const trustedSources = ['alldatadiy.com', 'repairpal.com', 'workshop-manuals.com'];

    let filteredResults = await Promise.all(
      (response.data.images || []).map(image => limit(async () => {
        if (!image.imageUrl || !hasValidImageExtension(image.imageUrl)) return null;

        const imageText = `${image.title} ${image.link} ${image.source}`.toLowerCase();
        const isDiagram = isDiagramImage(imageText, image.imageUrl);

        if (!isDiagram) return null;

        image.relevanceScore = 3;

        // If vehicle info is provided, apply vehicle-specific filtering
        if (vehicleInfo && vehicleInfo.year && vehicleInfo.make && vehicleInfo.model) {
          const vehicleTerms = [vehicleInfo.year.toString(), vehicleInfo.make.toLowerCase(), vehicleInfo.model.toLowerCase()];
          const hasMake = imageText.includes(vehicleInfo.make.toLowerCase());
          const hasModel = imageText.includes(vehicleInfo.model.toLowerCase());
          const hasYear = imageText.includes(vehicleInfo.year.toString());
          const hasEngine = vehicleInfo.engine && imageText.includes(vehicleInfo.engine.toLowerCase());
          const hasPart = query.toLowerCase().split(' ').some(word => imageText.includes(word));

          if (isPartQuery) {
            // For part queries, be less restrictive - require at least 2 out of 3 main criteria
            const criteriaCount = (hasMake ? 1 : 0) + (hasModel ? 1 : 0) + (hasPart ? 1 : 0);
            if (criteriaCount < 2) return null;
            
            // Boost score based on matching criteria
            image.relevanceScore += (hasMake ? 2 : 0) + (hasModel ? 2 : 0) + (hasPart ? 3 : 0);
            image.relevanceScore += (hasYear ? 2 : 0) + (hasEngine ? 1 : 0);
          } else {
            // For general queries, require make and at least one other vehicle identifier
            const hasModelOrYear = hasModel || hasYear;
            if (!hasMake || !hasModelOrYear) return null;
            image.relevanceScore += vehicleTerms.filter(term => imageText.includes(term)).length;
          }
        } else {
          // No vehicle info - score based on query match only
          const queryTerms = query.toLowerCase().split(' ');
          const matchingTerms = queryTerms.filter(term => imageText.includes(term));
          if (matchingTerms.length === 0) return null;
          image.relevanceScore += matchingTerms.length * 2;
        }

        const diagramTypes = ['exploded view', 'parts diagram', 'assembly diagram', 'technical drawing', 'repair diagram', 'service diagram'];
        for (const type of diagramTypes) {
          if (imageText.includes(type)) {
            image.relevanceScore += 1;
          }
        }

        if (trustedSources.some(domain => image.link?.includes(domain) || image.source?.includes(domain))) {
          image.relevanceScore += 2;
        }

        image.relevanceScore += Math.floor(computeSemanticScore(imageText, refinedQuery) * 5);

        const isAccessible = await validateImageAccessibility(image.imageUrl);
        if (!isAccessible) return null;

        return image;
      }))
    );

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
    const minResults = Math.min(10, filteredResults.length);
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
      images: savedImages.map(img => ({
        ...img.toObject?.() || img,
        relevanceScore: img.relevanceScore
      })),
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
