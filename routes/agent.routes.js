import express from 'express';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const router = express.Router();
const openai = new OpenAI();

// POST route for chat completions
router.post('/chat/completions', async (req, res) => {
  try {
    const { model, messages } = req.body;

    const completion = await openai.chat.completions.create({
      model,
      messages,
    });

    res.json(completion);
  } catch (error) {
    console.error("Error in /chat/completions:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST route for realtime sessions
router.post('/realtime', async (req, res) => {
  try {
    const { model, sdp } = req.body;
    
    if (!sdp) {
      throw new Error('No SDP provided in request body');
    }

    console.log('Sending SDP to OpenAI:', sdp);
    
    const response = await fetch(
      `https://api.openai.com/v1/realtime?model=${model}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/sdp",
        },
        body: sdp
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API responded with status: ${response.status}. ${errorText}`);
    }

    const answerSdp = await response.text();
    console.log('Received SDP from OpenAI:', answerSdp);
    
    res.json({ sdp: answerSdp });
  } catch (error) {
    console.error("Error in /realtime:", error);
    res.status(500).json({ 
      error: error.message,
      details: error.response?.data || error.stack
    });
  }
});

// GET route for realtime sessions
router.get('/session', async (req, res) => {
  try {
    const response = await fetch(
      "https://api.openai.com/v1/realtime/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "whisper-1",
        }),
      }
    );
    
    if (!response.ok) {
      throw new Error(`OpenAI API responded with status: ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Error in /session:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router; 