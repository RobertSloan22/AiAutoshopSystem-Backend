// routes/research.routes.js
import express from 'express';
import { OpenAI } from '@langchain/openai';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import dotenv from 'dotenv';

dotenv.config();

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
      modelName: 'gpt-4-turbo-preview',
      temperature: 0.2,
      openAIApiKey: process.env.OPENAI_API_KEY,
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
      // First try to parse the cleaned content directly
      const parsedResult = JSON.parse(cleanedContent);
      return res.status(200).json({ result: JSON.stringify(parsedResult) });
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      console.error('Raw content:', cleanedContent);
      
      // Attempt to extract JSON from the response if parsing fails
      const jsonMatch = typeof cleanedContent === 'string' ? cleanedContent.match(/\{[\s\S]*\}/) : null;
      if (jsonMatch) {
        try {
          // Clean up any trailing commas before closing braces
          const cleanedJson = jsonMatch[0].replace(/,(\s*[}\]])/g, '$1');
          const extractedJson = JSON.parse(cleanedJson);
          return res.status(200).json({ result: JSON.stringify(extractedJson) });
        } catch (extractError) {
          console.error('Error parsing extracted JSON:', extractError);
          console.error('Extracted content:', jsonMatch[0]);
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
      modelName: 'text-embedding-3-small',
      temperature: 0.2,
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    const result = await model.embeddings.create({
      model: "text-embedding-3-small",
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

// Add new route for vehicle-specific questions
router.post('/vehicle-question', async (req, res) => {
  const { vin, year, make, model, dtcCode, question } = req.body;

  // Validate required fields
  if (!year || !make || !model || !question) {
    return res.status(400).json({ error: 'Missing required fields. Year, make, model, and question are required.' });
  }

  try {
    const model = new OpenAI({
      modelName: 'o3-mini',
      temperature: 0.2,
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    // Construct the prompt with vehicle information
    const prompt = `On a ${year} ${make} ${model}${dtcCode ? ` with DTC code ${dtcCode}` : ''}, ${question}`;

    const response = await model.invoke([
      {
        role: "system",
        content: "You are an expert automotive technician with comprehensive knowledge of vehicle systems, diagnostics, and repair procedures. Provide detailed, accurate, and practical information."
      },
      {
        role: "user",
        content: prompt
      }
    ]);

    return res.status(200).json({ 
      result: response.content 
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
