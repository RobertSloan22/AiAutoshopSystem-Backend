import axios from 'axios';

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

export const searchImages = async (req, res) => {
  try {
    const { query, num = 5, vehicleInfo } = req.body;
    
    if (!vehicleInfo || !vehicleInfo.year || !vehicleInfo.make || !vehicleInfo.model) {
      return res.status(400).json({ error: 'Vehicle information is required' });
    }

    // Build a basic search query
    const vehicleString = `${vehicleInfo.year} ${vehicleInfo.make} ${vehicleInfo.model}`;
    const engineInfo = vehicleInfo.engine ? ` ${vehicleInfo.engine}` : '';
    
    // Construct final search query with minimal modifiers
    const refinedQuery = `${vehicleString}${engineInfo} ${query} automotive`;

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
    let filteredResults = response.data.images?.filter(image => {
      // First check if the image URL has a valid extension
      if (!hasValidImageExtension(image.imageUrl)) {
        return false;
      }

      // Then check vehicle relevance
      const imageText = `${image.title} ${image.link} ${image.source}`.toLowerCase();
      const vehicleTerms = [
        vehicleInfo.year.toString(),
        vehicleInfo.make.toLowerCase(),
        vehicleInfo.model.toLowerCase()
      ];

      // Must match at least one vehicle term
      return vehicleTerms.some(term => imageText.includes(term));
    }) || [];

    // Take the specified number of results
    const finalResults = filteredResults.slice(0, num);

    // Log filtering results for debugging
    console.log('Image search results:', {
      totalResults: response.data.images?.length || 0,
      filteredResults: filteredResults.length,
      finalResults: finalResults.length,
      validExtensions: finalResults.map(img => new URL(img.imageUrl).pathname)
    });

    res.json({ 
      images: finalResults,
      metadata: {
        originalQuery: query,
        refinedQuery,
        totalResults: response.data.images?.length || 0,
        filteredResults: filteredResults.length,
        finalResults: finalResults.length
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
