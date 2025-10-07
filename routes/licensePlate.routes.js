import express from 'express';
import axios from 'axios';
import protectRoute from "../middleware/protectRoute.js";

const router = express.Router();

router.get('/lookup', async (req, res) => {
  const { plate, state } = req.query;
  
  if (!plate || !state) {
    return res.status(400).json({ error: 'Plate and state are required' });
  }
  
  if (!process.env.PLATETOVIN_API_KEY) {
    return res.status(500).json({ error: 'PlateToVin API key is not configured' });
  }
  
  try {
    // Log what we're sending
    console.log('API Key:', process.env.PLATETOVIN_API_KEY);
    console.log('Plate:', plate);
    console.log('State:', state);
    
    const response = await axios({
      method: 'POST',
      url: 'https://platetovin.com/api/convert',
      headers: {
        'Authorization': process.env.PLATETOVIN_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      data: {
        state: state,
        plate: plate
      },
      validateStatus: false // This will prevent axios from throwing on non-2xx status
    });
    
    console.log('Response status:', response.status);
    console.log('Response data:', response.data);
    
    if (response.status === 200) {
      res.json(response.data);
    } else {
      res.status(response.status).json(response.data);
    }
    
  } catch (error) {
    console.error('License plate lookup error:', error.message);
    console.error('Status:', error.response?.status);
    console.error('Response data:', error.response?.data);
    console.error('Request headers:', error.config?.headers);
    
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || error.response?.data || 'Failed to lookup license plate'
    });
  }
});

export default router;
