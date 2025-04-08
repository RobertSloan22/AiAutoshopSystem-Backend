import express from 'express';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

/**
 * POST /api/vehicle-questions
 * 
 * Expects a JSON body containing:
 *  - year: Vehicle year
 *  - make: Vehicle make
 *  - model: Vehicle model
 *  - dtcCode: (optional) Diagnostic Trouble Code
 *  - question: The specific question about the vehicle
 */
router.post('/', async (req, res) => {
  const { year, make, model, dtcCode, question } = req.body;

  // Validate required fields
  if (!year || !make || !model || !question) {
    return res.status(400).json({ error: 'Missing required fields. Year, make, model, and question are required.' });
  }

  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    // Construct the prompt with vehicle information
    const prompt = `On a ${year} ${make} ${model}${dtcCode ? ` with DTC code ${dtcCode}` : ''}, ${question}`;

    const response = await openai.responses.create({
      model: "o3-mini",
      input: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    return res.status(200).json({ 
      result: response.output_text 
    });

  } catch (error) {
    console.error('Error processing vehicle question:', error);
    return res.status(500).json({ 
      error: 'Internal server error.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router; 