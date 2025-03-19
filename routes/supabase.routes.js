import express from 'express';
import { createClient } from '@supabase/supabase-js';
import config from '../config/config.js';

const router = express.Router();

// Initialize Supabase client
const supabase = createClient(
  config.supabase.url,
  config.supabase.serviceKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    },
    global: {
      headers: {
        'Authorization': `Bearer ${config.supabase.serviceKey}`,
        'apikey': config.supabase.serviceKey,
        'jwt_secret': config.supabase.jwtSecret
      }
    }
  }
);

// Test connection endpoint
router.get('/vector-store/test', async (req, res) => {
  try {
    // Test Supabase connection
    const { data, error } = await supabase
      .from('vehicle_research')
      .select('count')
      .limit(1);

    if (error) {
      console.error('Supabase connection error:', error);
      return res.status(500).json({ error });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Connection test error:', error);
    res.status(500).json({ error });
  }
});

// Store data endpoint
router.post('/vector-store/store', async (req, res) => {
  try {
    const { researchData, vehicleInfo, problem } = req.body;
    
    // Format the data into a single text for embedding
    const textToEmbed = `
      Research: ${JSON.stringify(researchData)}
      Vehicle: ${JSON.stringify(vehicleInfo)}
      Problem: ${problem}
    `.trim();

    // Store in Supabase
    const { data, error } = await supabase
      .from('vehicle_research')
      .insert([
        {
          content: textToEmbed,
          metadata: {
            researchData,
            vehicleInfo,
            problem
          }
        }
      ]);

    if (error) {
      console.error('Supabase insert error:', error);
      throw error;
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error('Vector store error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Query endpoint
router.post('/vector-store/query', async (req, res) => {
  try {
    const { query, limit = 5 } = req.body;

    // Query from Supabase
    const { data: searchResults, error } = await supabase
      .from('vehicle_research')
      .select('*')
      .textSearch('content', query)
      .limit(limit);

    if (error) {
      console.error('Supabase search error:', error);
      throw error;
    }

    res.json({ results: searchResults });
  } catch (error) {
    console.error('Vector store query error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router; 