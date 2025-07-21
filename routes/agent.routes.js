import express from 'express';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const router = express.Router();
const openai = new OpenAI();



  // Session route - GET /api/session
  router.get('/api/session', async (req, res) => {
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
            model: "gpt-4o-realtime-preview-2025-06-03",
          }),
        }
      );
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Error in /session:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // Responses route - POST /api/responses
  router.post('/api/responses', async (req, res) => {
    const body = req.body;

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    try {
      if (body.text?.format?.type === 'json_schema') {
        const response = await openai.responses.parse({
          ...body,
          stream: false,
        });
        res.json(response);
      } else {
        const response = await openai.responses.create({
          ...body,
          stream: false,
        });
        res.json(response);
      }
    } catch (err) {
      console.error('responses proxy error', err);
      res.status(500).json({ error: 'failed' });
    }
  });

router.post('/realtime/sessions', async (req, res) => {
  try {
    let sdp = req.body.sdp || req.body;
    if (!sdp || typeof sdp !== 'string') {
      sdp = '';
      req.setEncoding('utf8');
      req.on('data', chunk => { sdp += chunk; });
      await new Promise(resolve => req.on('end', resolve));
    }
    if (!sdp) {
      return res.status(400).json({ error: 'No SDP provided in request body' });
    }

    const response = await fetch(
      `https://api.openai.com/v1/realtime?model=gpt-4o-realtime`,
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
      return res.status(500).json({ error: errorText });
    }

    const answerSdp = await response.text();
    if (!answerSdp) {
      return res.status(500).json({ error: 'No SDP received from OpenAI' });
    }

    // Return the SDP as JSON, not plain text!
    res.json({ sdp: answerSdp });
  } catch (error) {
    console.error("Error in POST /realtime/sessions:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

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
      `https://api.openai.com/v1/realtime?model=${model || "gpt-4o-realtime"}`,
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
router.get('/realtime/sessions', async (req, res) => {
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
          model: "gpt-4o-realtime",
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


router.get('/realtime/sessions', async (req, res) => {
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
          model: "gpt-4o-realtime",
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`OpenAI API responded with status: ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Error in GET /realtime/sessions:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router; 
