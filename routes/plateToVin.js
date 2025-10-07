import express from 'express';
import axios from 'axios';
import protectRoute from "../middleware/protectRoute.js";

const router = express.Router();

router.post('/lookup', async (req, res) => {
  console.log('=== PLATE LOOKUP REQUEST STARTED ===');
  console.log('Request body:', req.body);
  
  // Handle both { plate, state } and { params: { plate, state } }
  const { plate, state } = req.body.params || req.body;
  
  if (!plate || !state) {
    console.log('Missing plate or state');
    return res.status(400).json({ error: 'Plate and state are required' });
  }
  
  console.log('API Key exists:', !!process.env.PLATETOVIN_API_KEY);
  
  if (!process.env.PLATETOVIN_API_KEY) {
    return res.status(500).json({ error: 'PlateToVin API key is not configured' });
  }
  
  try {
    console.log('Making request to PlateToVin API...');
    console.log('Request data:', { state, plate });
    
    const response = await axios({
      method: 'POST',
      url: 'https://platetovin.com/api/convert',
      headers: {
        'Authorization': process.env.PLATETOVIN_API_KEY.trim(),
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      data: {
        state: state,
        plate: plate
      }
    });
    
    console.log('SUCCESS! Response status:', response.status);
    console.log('Response data:', response.data);
    
    res.json(response.data);
  } catch (error) {
    console.log('=== ERROR OCCURRED ===');
    console.log('Error message:', error.message);
    console.log('Response status:', error.response?.status);
    console.log('Response data:', error.response?.data);
    
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || error.response?.data || 'Failed to lookup license plate'
    });
  }
});

export default router;