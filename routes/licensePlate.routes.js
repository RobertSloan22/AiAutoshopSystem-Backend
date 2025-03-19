import express from 'express';
import axios from 'axios';
import protectRoute from "../middleware/protectRoute.js";

const router = express.Router();

router.get('/licenseplate', protectRoute, async (req, res) => {
  const { plate, state } = req.query;
  
  try {
    const options = {
      method: 'GET',
      url: 'https://us-license-plate-to-vin.p.rapidapi.com/licenseplate',
      params: { plate, state },
      headers: {
        'x-rapidapi-key': process.env.RAPID_API_KEY,
        'x-rapidapi-host': 'us-license-plate-to-vin.p.rapidapi.com'
      }
    };

    const response = await axios.request(options);
    res.json(response.data);
  } catch (error) {
    console.error('License plate lookup error:', error);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || 'Failed to lookup license plate'
    });
  }
});

export default router; 