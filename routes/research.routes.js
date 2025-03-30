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
 *  - trim: Vehicle trim level (optional)
 *  - engine: Engine type (optional)
 *  - transmission: Transmission type (optional)
 *  - mileage: Vehicle mileage (optional)
 *  - dtcCodes: Array of DTC codes (optional)
 *
 * Returns:
 *  - { result: string } on success, containing the research analysis
 *  - { error: string } on failure
 */
router.post('/', async (req, res) => {
  const { vin, year, make, model, problem, trim, engine, transmission, mileage, dtcCodes } = req.body;

  // Validate required fields
  if (!vin || !year || !make || !model || !problem) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  try {
    // Note: Escape literal curly braces in the JSON structure by doubling them.
    const prompt = PromptTemplate.fromTemplate(`
You are an expert automotive technician with access to comprehensive technical information specifically for {make} {model} vehicles.
Analyze the following vehicle problem and provide a highly detailed and specific response in JSON format.
Include exact specifications, connector pin numbers, component locations, and test procedures specific to this exact model and year.

Vehicle Details:
VIN: {vin}
Year: {year}
Make: {make}
Model: {model}
Trim: {trim}
Engine: {engine}
Transmission: {transmission}
Mileage: {mileage}
DTC Codes: {dtcCodes}

Problem Description: {problem}

For each diagnostic step, include:
- Exact component location information
- Specific connector identification (with pin numbers)
- Normal operating values with appropriate units
- Detailed test procedures referencing the factory service manual
- Required specialty tools with part numbers
- System-specific precautions

Include these additional data points:
- Model-year specific information (even if it varies from similar models)
- Common failure patterns specific to this exact vehicle configuration
- Technical service bulletins (TSBs) with document numbers
- Factory service manual references with section numbers
- Exact OEM part numbers for recommended parts

Your response MUST be in this JSON format:
{{
  "diagnosticSteps": [
    {{
      "step": "string",
      "details": "string",
      "componentLocation": "string",
      "connectorInfo": "string",
      "tools": ["string"],
      "expectedReadings": "string",
      "normalValueRanges": "string",
      "factoryServiceManualRef": "string", 
      "notes": "string"
    }}
  ],
  "possibleCauses": [
    {{
      "cause": "string",
      "likelihood": "High|Medium|Low",
      "explanation": "string",
      "modelSpecificNotes": "string",
      "commonSymptomsForThisCause": ["string"]
    }}
  ],
  "recommendedFixes": [
    {{
      "fix": "string",
      "difficulty": "Easy|Moderate|Complex",
      "estimatedCost": "string",
      "professionalOnly": boolean,
      "parts": ["string"],
      "oemPartNumbers": ["string"],
      "torqueSpecs": "string",
      "laborHours": "string",
      "specialTools": ["string"],
      "procedureOverview": "string"
    }}
  ],
  "technicalNotes": {{
      "commonIssues": ["string"],
      "serviceIntervals": ["string"],
      "recalls": ["string"],
      "tsbs": ["string"],
      "manufacturerSpecificNotes": "string",
      "knownGoodValues": "string"
  }},
  "references": [
    {{
      "source": "string",
      "documentNumber": "string",
      "url": "string",
      "type": "TSB|Manual|Forum|Recall",
      "relevance": "string",
      "pageNumbers": "string"
    }}
  ]
}}

Provide a comprehensive analysis focusing on EXACT information for this specific vehicle. Include precise specifications, part numbers, connector details, and accurate diagnostic values.
`);

    const modelInstance = new ChatOpenAI({
      modelName: 'gpt-4o',
      temperature: 0.1,  // Lower temperature for more precise, specific outputs
      openAIApiKey: process.env.OPENAI_API_KEY,
      configuration: {
        timeout: 120000,  // Increased timeout to 2 minutes for more thorough research
        maxRetries: 3,
        retryDelay: 1000,
      }
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
      trim: trim || 'Not specified',
      engine: engine || 'Not specified',
      transmission: transmission || 'Not specified',
      mileage: mileage || 'Not specified',
      dtcCodes: dtcCodes ? dtcCodes.join(', ') : 'None reported'
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

// Add new vehicle-specific questions endpoint with enhanced detail
router.post('/vehicle-question', async (req, res) => {
  const { vin, year, make, model, dtcCode, question, trim, engine, transmission, mileage } = req.body;

  // Validate required fields
  if (!year || !make || !model || !question) {
    return res.status(400).json({ error: 'Missing required fields. Year, make, model, and question are required.' });
  }

  try {
    const model = new OpenAI({
      modelName: 'gpt-4o',  // Upgraded from o3-mini for more detailed responses
      temperature: 0.1,     // Lower temperature for more specific answers
      openAIApiKey: process.env.OPENAI_API_KEY,
      configuration: {
        timeout: 60000,     // Increased timeout for more comprehensive answers
      }
    });

    // Construct a detailed system prompt for more specific responses
    const systemPrompt = `You are an expert automotive technician with comprehensive knowledge of vehicle systems, diagnostics, and repair procedures specific to ${year} ${make} ${model} vehicles.
Provide extremely detailed, accurate, and practical information.

When responding:
1. Include exact specifications, values, and measurements with proper units
2. Reference specific component locations on this exact vehicle
3. Mention any model-year specific information that might differ from other years
4. Provide precise connector pin numbers and wire colors where relevant
5. Include factory service manual references where applicable
6. Specify exact OEM part numbers for any recommended parts
7. Note any technical service bulletins or recalls related to the issue
8. Describe proper test procedures with expected values
9. Note torque specifications for fasteners
10. Reference specific tools required for the job

Focus on giving information that is SPECIFIC to this exact vehicle configuration, not generic advice.`;

    // Construct a detailed user prompt with all available vehicle information
    const detailedPrompt = `On a ${year} ${make} ${model}${trim ? ` ${trim}` : ''}${engine ? ` with ${engine} engine` : ''}${transmission ? ` and ${transmission} transmission` : ''}${mileage ? ` at ${mileage} miles` : ''}${dtcCode ? ` with DTC code ${dtcCode}` : ''}${vin ? `, VIN: ${vin}` : ''}, ${question}

Please provide specific information for this exact vehicle, including precise specifications, part numbers, connector details, and test values.`;

    const response = await model.invoke([
      {
        role: "system",
        content: systemPrompt
      },
      {
        role: "user",
        content: detailedPrompt
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
