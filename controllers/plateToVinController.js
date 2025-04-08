import axios from 'axios';

/**
 * Get VIN information from license plate
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getVinFromPlate = async (req, res) => {
  const { plate, state } = req.query;

  if (!plate || !state) {
    return res.status(400).json({ error: 'Plate and state are required' });
  }

  if (!process.env.RAPIDAPI_KEY || !process.env.RAPIDAPI_HOST) {
    return res.status(500).json({ error: 'RapidAPI configuration is missing' });
  }

  const options = {
    method: 'GET',
    url: 'https://apibroker-license-plate-search-v1.p.rapidapi.com/license-plate-search',
    params: {
      format: 'json',
      state,
      plate
    },
    headers: {
      'x-rapidapi-key': process.env.RAPIDAPI_KEY,
      'x-rapidapi-host': process.env.RAPIDAPI_HOST
    }
  };

  try {
    const response = await axios.request(options);
    return res.json(response.data);
  } catch (error) {
    console.error('Error fetching license plate information:', error.message);
    return res.status(500).json({ 
      error: 'Failed to fetch license plate information',
      details: error.response?.data || error.message
    });
  }
}; 