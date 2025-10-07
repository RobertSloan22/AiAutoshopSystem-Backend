import express from 'express';
import axios from 'axios';
import protectRoute from "../middleware/protectRoute.js";

const router = express.Router();

router.get('/lookup', protectRoute, async (req, res) => {
  const { plate, state } = req.query;
  
  if (!plate || !state) {
    return res.status(400).json({ error: 'Plate and state are required' });
  }

  if (!process.env.PLATETOVIN_API_KEY) {
    return res.status(500).json({ error: 'PlateToVin API key is not configured' });
  }
  
  try {
    const url = new URL('https://platetovin.com/api/convert');
    
    const headers = {
      'Authorization': process.env.PLATETOVIN_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    const body = {
      state: state,
      plate: plate
    };

    const response = await axios.post(url.toString(), body, { headers });
    res.json(response.data);
  } catch (error) {
    console.error('License plate lookup error:', error);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || 'Failed to lookup license plate'
    });
  }
});

export default router; 