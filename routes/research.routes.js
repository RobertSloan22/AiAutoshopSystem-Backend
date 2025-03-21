// routes/research.routes.js
import express from 'express';
import { OpenAI } from '@langchain/openai';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';

const router = express.Router();

/**
 * POST /api/research
 *
 * Expects a JSON body containing:
 *  - vin: Vehicle Identification Number
 *  - year: Vehicle year
 *  - make: Vehicle make
 *  - model: Vehicle model
 *  - problem: Description of the vehicle problem
 *
 * Returns:
 *  - { result: string } on success, containing the research analysis
 *  - { error: string } on failure
 */
router.post('/', async (req, res) => {
  const { vin, year, make, model, problem } = req.body;

  // Validate required fields
  if (!vin || !year || !make || !model || !problem) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  try {
    // Note: Escape literal curly braces in the JSON structure by doubling them.
    const prompt = PromptTemplate.fromTemplate(`
You are an expert automotive technician with access to comprehensive technical information.
Analyze the following vehicle problem and provide a detailed response in JSON format with the following structure:

{{
  "diagnosticSteps": [
    {{
      "step": "string",
      "details": "string",
      "tools": ["string"],
      "expectedReadings": "string",
      "notes": "string"
    }}
  ],
  "possibleCauses": [
    {{
      "cause": "string",
      "likelihood": "High|Medium|Low",
      "explanation": "string"
    }}
  ],
  "recommendedFixes": [
    {{
      "fix": "string",
      "difficulty": "Easy|Moderate|Complex",
      "estimatedCost": "string",
      "professionalOnly": boolean,
      "parts": ["string"]
    }}
  ],
  "technicalNotes": {{
      "commonIssues": ["string"],
      "serviceIntervals": ["string"],
      "recalls": ["string"],
      "tsbs": ["string"]
  }},
  "references": [
    {{
      "source": "string",
      "url": "string",
      "type": "TSB|Manual|Forum|Recall",
      "relevance": "string"
    }}
  ]
}}

Vehicle Details:
VIN: {vin}
Year: {year}
Make: {make}
Model: {model}

Problem Description: {problem}

Provide a comprehensive analysis focusing on accurate diagnostic procedures, common causes, and manufacturer-specific information. Include relevant TSBs, recalls, and service information where applicable.
    `);

    const modelInstance = new ChatOpenAI({
      modelName: 'hermes-3-llama-3.2-3b',
      temperature: 0.2,
      openAIApiKey: null,
      configuration: {
        baseURL: 'http://192.168.56.1:1234/v1', // Use environment variable instead of hardcoded key
      },
    });

    // Create a chain using RunnableSequence
    const chain = RunnableSequence.from([prompt, modelInstance]);

    // Execute the chain
    const result = await chain.invoke({
      vin,
      year,
      make,
      model,
      problem,
    });

    // Get the actual content from the AI message
    const messageContent = result.content || result.text || (result.messages?.[0]?.content);
    
    // Clean up the response by removing markdown code block syntax if present
    const cleanedContent = typeof messageContent === 'string' 
      ? messageContent
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim()
      : messageContent;
    
    // Validate that the response is proper JSON
    try {
      const parsedResult = JSON.parse(cleanedContent);
      return res.status(200).json({ result: JSON.stringify(parsedResult) });
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      // Attempt to extract JSON from the response if parsing fails
      const jsonMatch = typeof cleanedContent === 'string' ? cleanedContent.match(/\{[\s\S]*\}/) : null;
      if (jsonMatch) {
        try {
          const extractedJson = JSON.parse(jsonMatch[0]);
          return res.status(200).json({ result: JSON.stringify(extractedJson) });
        } catch (extractError) {
          throw new Error('Failed to parse AI response into valid JSON');
        }
      }
      throw new Error('No valid JSON found in AI response');
    }
  } catch (error) {
    console.error('Error processing research request:', error);
    return res.status(500).json({ 
      error: 'Internal server error.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Add new embeddings proxy endpoint
router.post('/embeddings', async (req, res) => {
  try {
    const model = new OpenAI({
      modelName: 'text-embedding-nomic-embed-text-v1.5',
      temperature: 0.2,
      openAIApiKey: null,
      configuration: {
        baseURL: 'http://192.168.56.1:1234/v1', // Use environment variable instead of hardcoded key
      },// Use environment variable instead of hardcoded key
    });

    const result = await model.embeddings.create({
      model: "text-embedding-nomic-embed-text-v1.5",
      input: req.body.input,
    });

    res.json(result);
  } catch (error) {
    console.error('Error generating embeddings:', error);
    res.status(500).json({ 
      error: 'Failed to generate embeddings',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;
