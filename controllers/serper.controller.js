import axios from 'axios';

export const searchImages = async (req, res) => {
  try {
    const { query, num = 5 } = req.body;
    
    // Append filters to the query for technical diagrams
    const refinedQuery = `${query} "technical diagram" OR "schematic" OR "blueprint" -stock -photo -clipart`;

    const response = await axios.post('https://google.serper.dev/images', {
      q: refinedQuery,
      num
    }, {
      headers: {
        'X-API-KEY': process.env.VITE_SERPER_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('Serper API error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Search failed',
      message: error.response?.data?.message || error.message
    });
  }
};
