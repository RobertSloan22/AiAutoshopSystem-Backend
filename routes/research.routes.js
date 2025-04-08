// routes/research.routes.js
import express from 'express';
import { OpenAI } from '@langchain/openai';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import dotenv from 'dotenv';
import axios from 'axios';
import { z } from 'zod';

dotenv.config();

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Research:
 *       type: object
 *       required:
 *         - query
 *         - type
 *       properties:
 *         query:
 *           type: string
 *           description: The research query or topic
 *         type:
 *           type: string
 *           enum: [vehicle, part, service, general]
 *           description: Type of research
 *         results:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               source:
 *                 type: string
 *                 description: Source of the information
 *               content:
 *                 type: string
 *                 description: The research content
 *               confidence:
 *                 type: number
 *                 format: float
 *                 description: Confidence score of the result
 *         status:
 *           type: string
 *           enum: [pending, in-progress, completed, failed]
 *           description: Status of the research
 */

/**
 * @swagger
 * /api/research:
 *   post:
 *     summary: Create a new research request
 *     tags: [Research]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - query
 *               - type
 *             properties:
 *               query:
 *                 type: string
 *                 description: The research query
 *               type:
 *                 type: string
 *                 enum: [vehicle, part, service, general]
 *                 description: Type of research
 *     responses:
 *       201:
 *         description: Research request created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Research'
 *       400:
 *         description: Invalid input
 */

/**
 * @swagger
 * /api/research/{id}:
 *   get:
 *     summary: Get research results by ID
 *     tags: [Research]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Research ID
 *     responses:
 *       200:
 *         description: Research results
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Research'
 *       404:
 *         description: Research not found
 */

// Comprehensive schema for validating research responses
const VehicleResearchSchema = z.object({
  diagnosticSteps: z.array(z.object({
    step: z.string(),
    details: z.string(),
    componentLocation: z.string(),
    connectorInfo: z.string(),
    tools: z.array(z.string()),
    expectedReadings: z.string(),
    normalValueRanges: z.string(),
    factoryServiceManualRef: z.string(),
    notes: z.string(),
    diagnosticImages: z.array(z.string()).optional(),
    waveformPatterns: z.string().optional(),
    specialPrecautions: z.string().optional()
  })),
  possibleCauses: z.array(z.object({
    cause: z.string(),
    likelihood: z.string(),
    explanation: z.string(),
    modelSpecificNotes: z.string(),
    commonSymptomsForThisCause: z.array(z.string()),
    technicalBackground: z.string().optional(),
    failureRate: z.string().optional(),
    vehicleSubsystemAffected: z.string().optional()
  })),
  recommendedFixes: z.array(z.object({
    fix: z.string(),
    difficulty: z.string(),
    estimatedCost: z.string(),
    professionalOnly: z.boolean(),
    parts: z.array(z.string()),
    oemPartNumbers: z.array(z.string()),
    torqueSpecs: z.string(),
    laborHours: z.string(),
    specialTools: z.array(z.string()),
    procedureOverview: z.string(),
    commonPitfalls: z.array(z.string()).optional(),
    postRepairVerification: z.string().optional(),
    warrantyConsiderations: z.string().optional()
  })),
  technicalNotes: z.object({
    commonIssues: z.array(z.string()),
    serviceIntervals: z.array(z.string()),
    recalls: z.array(z.string()),
    tsbs: z.array(z.string()),
    manufacturerSpecificNotes: z.string(),
    knownGoodValues: z.string(),
    systemDiagrams: z.array(z.string()).optional(),
    preventativeMaintenance: z.array(z.string()).optional()
  }),
  references: z.array(z.object({
    source: z.string(),
    documentNumber: z.string(),
    url: z.string(),
    type: z.string(),
    relevance: z.string(),
    pageNumbers: z.string(),
    publicationDate: z.string().optional(),
    publisher: z.string().optional()
  }))
});

// Helper function to process AI responses with error handling
async function processAIResponse(chain, data, retries = 3, delay = 1000) {
  let lastError;
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      console.log(`Attempt ${attempt + 1}: Making AI request`);
      const result = await chain.invoke(data);
      
      // Get the actual content from the AI message
      let messageContent;
      if (typeof result === 'string') {
        messageContent = result;
      } else {
        messageContent = result.content || result.text || (result.messages?.[0]?.content);
      }
      
      if (!messageContent) {
        throw new Error('Empty response from AI');
      }
      
      // Clean up the response by removing markdown code block syntax
      const cleanedContent = typeof messageContent === 'string' 
        ? messageContent
            .replace(/```json\n?/g, '')
            .replace(/```\n?/g, '')
            .trim()
        : messageContent;
      
      // First try to parse the cleaned content directly
      try {
        const parsedResult = JSON.parse(cleanedContent);
        return parsedResult;
      } catch (parseError) {
        // Attempt to extract JSON from the response if parsing fails
        const jsonMatch = typeof cleanedContent === 'string' ? cleanedContent.match(/\{[\s\S]*\}/) : null;
        if (jsonMatch) {
          // Clean up any trailing commas before closing braces
          const cleanedJson = jsonMatch[0].replace(/,(\s*[}\]])/g, '$1');
          return JSON.parse(cleanedJson);
        }
        throw new Error('No valid JSON found in AI response');
      }
    } catch (error) {
      console.error(`Attempt ${attempt + 1} failed:`, error);
      lastError = error;
      
      if (attempt < retries - 1) {
        console.log(`Waiting ${delay}ms before next attempt...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 1.5; // Exponential backoff
      }
    }
  }
  
  throw new Error(`Failed after ${retries} attempts. Last error: ${lastError.message}`);
}

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
 *  - { result: object } on success, containing the detailed research analysis
 *  - { error: string } on failure
 */
router.post('/', async (req, res) => {
  const { vin, year, make, model, problem, trim, engine, transmission, mileage, dtcCodes } = req.body;

  // Validate required fields
  if (!year || !make || !model || !problem) {
    return res.status(400).json({ error: 'Missing required fields. Year, make, model, and problem are required.' });
  }

  try {
    console.log(`Processing research request for ${year} ${make} ${model}`);
    console.log(`Problem: ${problem}`);
    
    // Note: Escape literal curly braces in the JSON structure by doubling them.
    const initialPrompt = PromptTemplate.fromTemplate(`
You are a master diagnostic technician with 30 years of experience working specifically with {make} vehicles. 
You have extensive knowledge of the {year} {make} {model} including its technical specifications, common failure points, 
and manufacturer-specific diagnostic procedures. Provide an extremely detailed and technical analysis of the following problem.

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

Include these critical elements in your response:
1. EXACT component locations (e.g., "Located at the rear of cylinder head, 15cm from firewall, underneath the EGR tube, accessible after removing the upper intake plenum. Reference point: 8cm above cylinder #4 spark plug, offset 12cm towards passenger side from centerline. Requires removal of heat shield P/N TD73-1234 for access.")
2. SPECIFIC connector details (e.g., "C113 connector (black 16-pin, P/N TD73-14489-BA), PIN 6 (BRN/YEL - sensor ground) and PIN 7 (GRN/WHT - 5V reference). Connector is indexed with primary lock tab on top side. Secondary CPA lock must be removed using special tool 310-123.")
3. PRECISE testing procedures (e.g., "Measure resistance between PIN 2 and ground with KOEO, specification is 4.5-5.5 kΩ at 20°C with a tolerance of ±0.5 kΩ. Test conditions: ambient temperature 15-25°C, battery voltage >12.4V, key in ON position for >2 seconds. Use DMM with minimum 10MΩ impedance. Verify zero offset before testing.")
4. ACTUAL part numbers (e.g., "OEM part #TD73-12K910-AC (2019-2020) superseded by #TD73-12K910-AD (2021+). Includes O-rings P/N: TD73-9229-A (upper) and TD73-9229-B (lower). Kit components: sensor assembly, gasket P/N TD73-9229-C, mounting bolts P/N N804192-S426.")
5. EXACT diagnostic values (e.g., "MAP sensor voltage should be 0.45V ± 0.05V at idle (650-750 RPM, engine at operating temperature 85-95°C), increasing linearly to 4.5V ± 0.2V at WOT. Barometric pressure compensation: add 0.02V per 1000ft above sea level. Response time must be <50ms from 0.5V to 4.0V.")
6. FACTORY SERVICE MANUAL references (e.g., "Refer to FSM section 303-14a, pages 27-32, procedure 'Fuel Injector Circuit Testing and Diagnosis'. Supplemental procedures: TSB 21-2345 'Updated Fuel Injector Testing Parameters', Workshop Manual section W12-303-14, Wiring Diagram 23456-A, Sheet 2 of 4.")

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
      "notes": "string",
      "specialPrecautions": "string"
    }}
  ],
  "possibleCauses": [
    {{
      "cause": "string",
      "likelihood": "High|Medium|Low",
      "explanation": "string",
      "modelSpecificNotes": "string",
      "commonSymptomsForThisCause": ["string"],
      "technicalBackground": "string",
      "failureRate": "string",
      "vehicleSubsystemAffected": "string"
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
      "procedureOverview": "string",
      "commonPitfalls": ["string"],
      "postRepairVerification": "string",
      "warrantyConsiderations": "string"
    }}
  ],
  "technicalNotes": {{
      "commonIssues": ["string"],
      "serviceIntervals": ["string"],
      "recalls": ["string"],
      "tsbs": ["string"],
      "manufacturerSpecificNotes": "string",
      "knownGoodValues": "string",
      "preventativeMaintenance": ["string"]
  }},
  "references": [
    {{
      "source": "string",
      "documentNumber": "string",
      "url": "string",
      "type": "TSB|Manual|Forum|Recall",
      "relevance": "string",
      "pageNumbers": "string",
      "publicationDate": "string",
      "publisher": "string"
    }}
  ]
}}

Never use placeholder values like "Refer to manufacturer specifications" or "Check the service manual" - provide the EXACT values, specifications, and procedures that would be found in those sources.
`);

    const chatModel = new ChatOpenAI({
      modelName: 'o3-mini',
      openAIApiKey: process.env.OPENAI_API_KEY,
      configuration: {
        timeout: 120000,  // 2 minute timeout
        maxRetries: 3,
        retryDelay: 1000,
      }
    });

    // Create a chain using RunnableSequence
    const chain = RunnableSequence.from([
      initialPrompt,
      chatModel,
      new StringOutputParser()
    ]);

    const vehicleData = {
      vin: vin || 'Not provided',
      year,
      make,
      model,
      problem,
      trim: trim || 'Not specified',
      engine: engine || 'Not specified',
      transmission: transmission || 'Not specified',
      mileage: mileage || 'Not specified',
      dtcCodes: dtcCodes ? dtcCodes.join(', ') : 'None reported'
    };

    console.log('Invoking AI with vehicle data');
    // Process the response with retries and error handling
    const parsedResult = await processAIResponse(chain, vehicleData);
    
    // Attempt to validate with schema
    try {
      const validatedResult = VehicleResearchSchema.parse(parsedResult);
      console.log('Successfully validated research results schema');
      return res.status(200).json({ result: validatedResult });
    } catch (validationError) {
      console.warn('Schema validation warning:', validationError.message);
      // Return the data anyway, even if validation fails
      return res.status(200).json({ 
        result: parsedResult,
        warning: 'Response structure may not match expected schema'
      });
    }

  } catch (error) {
    console.error('Error processing research request:', error);
    return res.status(500).json({ 
      error: 'Failed to process vehicle research request',
      details: process.env.NODE_ENV === 'development' ? error.message : 'An internal server error occurred'
    });
  }
});

/**
 * POST /api/research/technical-details
 * 
 * Get in-depth technical details about a specific vehicle component or system
 */
router.post('/technical-details', async (req, res) => {
  const { year, make, model, component, system, vin, trim, engine } = req.body;
  
  if (!year || !make || !model || (!component && !system)) {
    return res.status(400).json({ 
      error: 'Missing required fields. Year, make, model, and either component or system are required.' 
    });
  }
  
  try {
    const chatModel = new ChatOpenAI({
      modelName: 'o3-mini',
      openAIApiKey: process.env.OPENAI_API_KEY,
      configuration: {
        timeout: 60000
      }
    });
    
    const prompt = PromptTemplate.fromTemplate(`
As a factory-trained {make} master technician, provide extremely detailed technical specifications and service information 
for the {component || system} on a {year} {make} {model}{trim ? ' ' + trim : ''}{engine ? ' with ' + engine : ''}.

Include:
1. Exact specifications with proper units
2. Precise component locations and mounting details
3. Wiring diagrams connection points and pin designations
4. Normal operating parameters and testing procedures
5. Service procedures with torque specifications
6. OEM part numbers and supersession information
7. Common failure modes specific to this make/model/year
8. Technical Service Bulletins that affect this component/system
9. Factory calibration procedures where applicable
10. Special tools required for service

Your response should contain technical information at the level you would find in the factory service manual. Include exact values, 
measurements, specifications, and procedures - not generic information.

Provide your response in this JSON format:
{{
  "componentName": "string",
  "systemOverview": "string",
  "specifications": [
    {{
      "name": "string",
      "value": "string",
      "unit": "string",
      "notes": "string"
    }}
  ],
  "location": "string",
  "wiringDetails": {{
    "connectorIdentification": "string",
    "pinouts": ["string"],
    "wireColors": ["string"],
    "circuitDiagrams": ["string"]
  }},
  "operationParameters": [
    {{
      "parameter": "string",
      "normalRange": "string",
      "testingProcedure": "string"
    }}
  ],
  "serviceProcedures": [
    {{
      "procedure": "string",
      "steps": ["string"],
      "torqueSpecs": ["string"],
      "specialNotes": "string"
    }}
  ],
  "partInformation": [
    {{
      "description": "string",
      "oemPartNumber": "string",
      "supersededBy": "string",
      "fitmentNotes": "string"
    }}
  ],
  "commonIssues": [
    {{
      "issue": "string",
      "symptoms": ["string"],
      "rootCause": "string",
      "fixApproach": "string"
    }}
  ],
  "technicalBulletins": [
    {{
      "bulletinNumber": "string",
      "title": "string",
      "date": "string",
      "description": "string"
    }}
  ],
  "specialTools": [
    {{
      "toolName": "string",
      "toolNumber": "string",
      "purpose": "string",
      "alternative": "string"
    }}
  ]
}}
`);
    
    const chain = RunnableSequence.from([
      prompt,
      chatModel,
      new StringOutputParser()
    ]);
    
    const technicalData = await processAIResponse(chain, {
      year,
      make,
      model,
      component: component || '',
      system: system || '',
      trim: trim || '',
      engine: engine || ''
    });
    
    return res.status(200).json({ result: technicalData });
    
  } catch (error) {
    console.error('Error processing technical details request:', error);
    return res.status(500).json({
      error: 'Failed to retrieve technical details',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Add embeddings endpoint
router.post('/embeddings', async (req, res) => {
  try {
    const model = new OpenAI({
      modelName: 'text-embedding-3-small',
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

/**
 * POST /api/research/vehicle-question
 * 
 * Enhanced endpoint for answering vehicle-specific questions with highly technical details
 */
router.post('/vehicle-question', async (req, res) => {
  const { vin, year, make, model, dtcCode, question, trim, engine, transmission, mileage, includeHistory } = req.body;

  // Validate required fields
  if (!year || !make || !model || !question) {
    return res.status(400).json({ error: 'Missing required fields. Year, make, model, and question are required.' });
  }

  try {
    // Determine if we should include web search for latest information
    const shouldIncludeWebSearch = question.toLowerCase().includes('latest') || 
                                  question.toLowerCase().includes('update') ||
                                  question.toLowerCase().includes('recall') ||
                                  question.toLowerCase().includes('tsb') ||
                                  question.toLowerCase().includes('bulletin');
    
    const chatModel = new OpenAI({
      modelName: 'o3-mini',
      openAIApiKey: process.env.OPENAI_API_KEY,
      configuration: {
        timeout: 60000,
      }
    });

    // Construct a detailed system prompt for more specific responses
    const systemPrompt = `You are a factory-trained master technician for ${make} with 25+ years of experience specializing in ${model} vehicles. You have extensive knowledge of all technical specifications, repair procedures, and service information. 

When responding, you must provide:
1. EXACT specifications with proper units (not "refer to service manual")
2. SPECIFIC component locations (with detailed descriptions of where to find them)
3. PRECISE test values and parameters (with actual numbers, not ranges where possible)
4. FACTORY part numbers where relevant
5. DETAILED step-by-step procedures, not general guidance
6. TECHNICAL background information explaining the systems involved
7. CONNECTOR pin identification and wire colors where applicable
8. TORQUE specifications for all fasteners mentioned
9. SERVICE manual references with section numbers

Include manufacturer-specific terminology, tool numbers, and procedures that would ONLY be known by someone with access to factory service information for ${make}.

Your response MUST be comprehensive, technical, and specifically tailored to the exact ${year} ${make} ${model}${trim ? ` ${trim}` : ''}${engine ? ` with ${engine} engine` : ''}.`;

    // Construct a detailed user prompt with all available vehicle information
    const detailedPrompt = `On a ${year} ${make} ${model}${trim ? ` ${trim}` : ''}${engine ? ` with ${engine} engine` : ''}${transmission ? ` and ${transmission} transmission` : ''}${mileage ? ` at ${mileage} miles` : ''}${dtcCode ? ` with DTC code ${dtcCode}` : ''}${vin ? `, VIN: ${vin}` : ''}, ${question}

Provide the most technically detailed answer possible, including exact specifications, procedures, and values specific to this particular vehicle configuration.`;

    let response;
    if (shouldIncludeWebSearch) {
      // Use the latest model with web search capability
      response = await chatModel.responses.create({
        model: "o3-mini",
        max_tokens: 1500,
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: detailedPrompt
          }
        ],
        tools: [{ type: "web_search" }]
      });
      
      // Extract relevant content from response
      let finalResponse = '';
      let sources = [];
      
      if (response.choices && response.choices.length > 0) {
        finalResponse = response.choices[0].message.content;
        
        // Extract sources if available
        if (response.choices[0].message.tool_calls) {
          sources = response.choices[0].message.tool_calls
            .filter(call => call.type === 'web_search')
            .map(call => call.function.arguments.url || call.function.arguments)
            .filter(Boolean);
        }
      }
      
      return res.status(200).json({ 
        result: finalResponse,
        sources: sources.length > 0 ? sources : undefined
      });
    } else {
      // Use regular LLM call for non-web-search questions
      response = await chatModel.invoke([
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
    }
  } catch (error) {
    console.error('Error processing vehicle question:', error);
    return res.status(500).json({ 
      error: 'Failed to process vehicle question',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/research/service-bulletin
 * 
 * Provides information about Technical Service Bulletins for a specific vehicle
 */
router.post('/service-bulletin', async (req, res) => {
  const { year, make, model, category, symptom, dtcCode, component } = req.body;
  
  if (!year || !make || !model) {
    return res.status(400).json({ error: 'Missing required fields. Year, make, and model are required.' });
  }
  
  try {
    const chatModel = new ChatOpenAI({
      modelName: 'o3-mini',
      openAIApiKey: process.env.OPENAI_API_KEY,
    });
    
    // Use web search to get up-to-date TSB information
    const webPrompt = PromptTemplate.fromTemplate(`
Search for technical service bulletins for {year} {make} {model}{category ? ' related to ' + category : ''}{symptom ? ' with symptoms: ' + symptom : ''}{dtcCode ? ' with DTC code ' + dtcCode : ''}{component ? ' affecting the ' + component : ''}. 
Find the most relevant, recent, and specific TSBs that match these criteria. Include TSB number, release date, affected VIN range, title, and summary of the repair procedure.
`);
    
    const webChain = RunnableSequence.from([
      webPrompt,
      chatModel
    ]);
    
    // Invoke with web search capability
    const webResponse = await chatModel.responses.create({
      model: "o3-mini",
      max_tokens: 1500,
      input: await webPrompt.format({
        year,
        make,
        model,
        category: category || '',
        symptom: symptom || '',
        dtcCode: dtcCode || '',
        component: component || ''
      }),
      tools: [{ type: "web_search" }]
    });
    
    // Extract the content and format it
    const tsbPrompt = PromptTemplate.fromTemplate(`
Based on this search information about TSBs for {year} {make} {model}:

{tsbInfo}

Create a comprehensive, structured list of the most relevant technical service bulletins. 
Format your response as a JSON array of TSB objects with these fields:
1. bulletinNumber: The TSB identifier
2. title: A descriptive title of the issue
3. publishDate: When the TSB was published
4. affectedVins: VIN range or specific criteria for affected vehicles
5. category: System category (engine, transmission, electrical, etc.)
6. symptoms: Array of symptoms that indicate this issue
7. repairProcedure: Summary of the recommended repair
8. parts: Array of parts required (with part numbers if available)
9. laborTime: Estimated repair time
10. source: Where this information came from

Only include TSBs that are specifically for the {year} {make} {model}, not generic TSBs or those for other models.
`);
    
    const tsbChain = RunnableSequence.from([
      tsbPrompt,
      chatModel,
      new StringOutputParser()
    ]);
    
    const processedTsbInfo = await tsbChain.invoke({
      year,
      make,
      model,
      tsbInfo: webResponse.content || webResponse.output_text || "No specific TSB information found"
    });
    
    // Try to extract JSON
    try {
      const cleanedContent = processedTsbInfo
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      
      const jsonMatch = cleanedContent.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const bulletins = JSON.parse(jsonMatch[0]);
        return res.status(200).json({ 
          result: bulletins,
          count: bulletins.length,
          source: "Combined AI and web search results"
        });
      } else {
        // No valid JSON array found, return the raw text
        return res.status(200).json({
          result: cleanedContent,
          warning: "Could not parse structured bulletin data"
        });
      }
    } catch (parseError) {
      console.error("Error parsing TSB JSON:", parseError);
      return res.status(200).json({
        result: processedTsbInfo,
        warning: "Could not parse structured bulletin data"
      });
    }
  } catch (error) {
    console.error('Error processing service bulletin request:', error);
    return res.status(500).json({
      error: 'Failed to retrieve service bulletin information',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;
