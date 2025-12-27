// routes/research.routes.js
import express from 'express';
import { OpenAI as LangChainOpenAI } from '@langchain/openai';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import dotenv from 'dotenv';
import axios from 'axios';
import { z } from 'zod';
// Remove vector service imports to reduce complexity
// import { QdrantClient } from '@qdrant/js-client-rest';
// import OpenAI from 'openai';
// import crypto from 'crypto';
// import { VectorService } from '../services/VectorService.js';
// import { MemoryVectorService } from '../services/MemoryVectorService.js';
// Import the research cache model
import ResearchCache from '../models/researchCache.model.js';
// Import ResponsesAPIService to use the same image search system as the agent
import ResponsesAPIService from '../services/responsesService.js';
// Import WebSearchService for image search capability
import WebSearchService from '../services/webSearchService.js';

dotenv.config();

const router = express.Router();

// Initialize ResponsesAPIService to use the same webSearchService instance as the agent
const responsesService = new ResponsesAPIService();
// Initialize WebSearchService for image search
const webSearchService = new WebSearchService();

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

// Configuration constants
const DEBUG_MODE = process.env.NODE_ENV === 'development';

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
 *  - userId: User ID for tracking (optional)
 *  - skipCache: Boolean to force fresh research (optional)
 *
 * Returns:
 *  - { result: object } on success, containing the detailed research analysis
 *  - { error: string } on failure
 */
router.post('/', async (req, res) => {
  const { 
    vin, year, make, model, problem, trim, engine, transmission, 
    mileage, dtcCodes, userId, skipCache = false 
  } = req.body;

  // Validate required fields
  if (!year || !make || !model || !problem) {
    return res.status(400).json({ error: 'Missing required fields. Year, make, model, and problem are required.' });
  }

  try {
    console.log(`Processing research request for ${year} ${make} ${model}`);
    console.log(`Problem: ${problem}`);
    
    // If skipCache is false, check for existing cached research
    if (!skipCache) {
      console.log('Checking cache for existing research...');
      
      // Create query for finding cached research
      const cacheQuery = {
        'vehicleInfo.year': year,
        'vehicleInfo.make': make,
        'vehicleInfo.model': model,
        problem: problem
      };
      
      // Add DTC codes to query if provided (any match)
      if (dtcCodes && dtcCodes.length > 0) {
        cacheQuery.dtcCodes = { $in: dtcCodes };
      }
      
      // Check for recent cached research (less than 30 days old)
      const cachedResearch = await ResearchCache.findOne(cacheQuery)
        .sort({ createdAt: -1 })
        .exec();
        
      // If we have a recent analysis (less than 30 days old), return it
      if (cachedResearch && 
          (new Date() - new Date(cachedResearch.createdAt)) < 30 * 24 * 60 * 60 * 1000) {
        console.log(`Using cached research with ID: ${cachedResearch._id}`);
        
        return res.status(200).json({
          result: cachedResearch.result,
          fromCache: true,
          cachedAt: cachedResearch.createdAt
        });
      }
      
      console.log('No recent cached research found. Generating new research...');
    } else {
      console.log('Cache lookup skipped by request.');
    }
    
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
    
    console.log('========== RAW AI RESPONSE ==========');
    console.log(JSON.stringify(parsedResult, null, 2).slice(0, 500) + '...');
    console.log('=====================================');
    
    // After getting parsedResult, format it to match frontend expectations
    const formattedResult = {
      diagnosticSteps: parsedResult.diagnosticSteps?.map(step => ({
        step: step.step || '',
        details: step.details || '',
        componentsTested: step.componentsTested || [],
        testingProcedure: step.testingProcedure || '',
        tools: step.tools || [],
        expectedReadings: step.expectedReadings || '',
        normalRanges: step.normalValueRanges || '',
        componentLocation: step.componentLocation || '',
        notes: step.notes || step.factoryServiceManualRef || ''
      })) || [],
      
      possibleCauses: parsedResult.possibleCauses?.map(cause => ({
        cause: cause.cause || '',
        likelihood: cause.likelihood || 'Medium',
        explanation: cause.explanation || cause.technicalExplanation || '',
        modelSpecificNotes: cause.modelSpecificNotes || '',
        commonSigns: cause.commonSymptomsForThisCause || []
      })) || [],
      
      recommendedFixes: parsedResult.recommendedFixes?.map(fix => ({
        fix: fix.fix || '',
        difficulty: fix.difficulty || 'Moderate',
        estimatedCost: fix.estimatedCost || 'Unknown',
        professionalOnly: fix.professionalOnly || fix.difficulty === 'Complex',
        parts: fix.parts?.map(part => 
          typeof part === 'string' ? 
            { name: part, partNumber: '', estimatedPrice: '', notes: '' } :
            { 
              name: part.name || part,
              partNumber: part.partNumber || '',
              estimatedPrice: part.estimatedPrice || '',
              notes: part.notes || ''
            }
        ) || [],
        laborTime: fix.laborHours || '',
        specialTools: fix.specialTools || [],
        torqueSpecifications: fix.torqueSpecs || '',
        clearanceSpecifications: fix.clearanceSpecifications || '',
        componentLocation: fix.componentLocation || '',
        removalSteps: fix.removalSteps || [],
        installationSteps: fix.installationSteps || []
      })) || [],
      
      technicalNotes: {
        commonIssues: parsedResult.technicalNotes?.commonIssues || [],
        serviceIntervals: parsedResult.technicalNotes?.serviceIntervals || [],
        recalls: parsedResult.technicalNotes?.recalls || [],
        tsbs: parsedResult.technicalNotes?.tsbs || [],
        manufacturerSpecificInfo: parsedResult.technicalNotes?.manufacturerSpecificInfo || '',
        preventativeMaintenance: parsedResult.technicalNotes?.preventativeMaintenance || []
      },
      
      references: parsedResult.references?.map(ref => ({
        source: ref.source || '',
        url: ref.url || '',
        type: ref.type || 'Manual',
        relevance: ref.relevance || 'High'
      })) || []
    };
    
    console.log('========== FORMATTED RESULT STRUCTURE ==========');
    console.log('diagnosticSteps:', formattedResult.diagnosticSteps.length);
    console.log('possibleCauses:', formattedResult.possibleCauses.length);
    console.log('recommendedFixes:', formattedResult.recommendedFixes.length);
    console.log('technicalNotes:', Object.keys(formattedResult.technicalNotes));
    console.log('references:', formattedResult.references.length);
    console.log('=================================================');
    
    // Sample data from each section to verify structure
    if (formattedResult.diagnosticSteps.length > 0) {
      console.log('Sample diagnosticStep:', JSON.stringify(formattedResult.diagnosticSteps[0], null, 2));
    }
    
    if (formattedResult.possibleCauses.length > 0) {
      console.log('Sample possibleCause:', JSON.stringify(formattedResult.possibleCauses[0], null, 2));
    }
    
    if (formattedResult.recommendedFixes.length > 0) {
      console.log('Sample recommendedFix:', JSON.stringify(formattedResult.recommendedFixes[0], null, 2));
    }
    
    // Store in MongoDB cache only (removed vector storage)
    try {
      const newCacheEntry = new ResearchCache({
        vehicleInfo: {
          vin,
          year,
          make,
          model,
          trim,
          engine,
          transmission,
          mileage
        },
        problem,
        dtcCodes: dtcCodes || [],
        result: formattedResult,
        userId: userId || null,
        metadata: {
          timestamp: new Date().toISOString(),
          source: 'research_routes'
        }
      });
      
      await newCacheEntry.save();
      console.log(`Saved research to database cache with ID: ${newCacheEntry._id}`);
    } catch (cacheError) {
      console.error('Error storing in research cache:', cacheError);
      // Continue with response even if cache storage fails
    }

    // Log the final response object right before sending
    console.log('========== SENDING RESPONSE TO FRONTEND ==========');
    console.log('Response structure:', JSON.stringify({ result: 'formattedResult' }, null, 2));
    console.log('Keys in result object:', Object.keys(formattedResult));
    console.log('===================================================');
    
    // Return the formatted result
    return res.status(200).json({ result: formattedResult });

  } catch (error) {
    console.error('Error processing research request:', error);
    return res.status(500).json({ 
      error: 'Failed to process vehicle research request',
      details: process.env.NODE_ENV === 'development' ? error.message : 'An internal server error occurred'
    });
  }
});

/**
 * POST /api/research/steps
 * 
 * Generate diagnostic steps for AI Steps panel using the same detailed prompt template
 * Returns only diagnosticSteps array formatted for the frontend
 */
router.post('/steps', async (req, res) => {
  const { 
    vin, year, make, model, problem, trim, engine, transmission, 
    mileage, dtcCodes, userId, skipCache = false,
    sessionId, liveData, stageContext
  } = req.body;

  // Validate required fields
  if (!year || !make || !model || !problem) {
    return res.status(400).json({ error: 'Missing required fields. Year, make, model, and problem are required.' });
  }

  try {
    console.log(`[Research Steps] Processing diagnostic steps request for ${year} ${make} ${model}`);
    console.log(`[Research Steps] Problem: ${problem}`);
    if (dtcCodes && dtcCodes.length > 0) {
      console.log(`[Research Steps] DTC Codes: ${dtcCodes.join(', ')}`);
    }
    
    // Build enhanced problem description with session and stage context if available
    let enhancedProblem = problem;
    if (stageContext) {
      enhancedProblem += `\n\nStage Context: ${JSON.stringify(stageContext)}`;
    }
    if (liveData && Array.isArray(liveData) && liveData.length > 0) {
      const recentData = liveData.slice(-5);
      enhancedProblem += `\n\nRecent Live Data: ${JSON.stringify(recentData)}`;
    }
    
    // If skipCache is false, check for existing cached research
    if (!skipCache) {
      console.log('[Research Steps] Checking cache for existing research...');
      
      // Create query for finding cached research
      const cacheQuery = {
        'vehicleInfo.year': year,
        'vehicleInfo.make': make,
        'vehicleInfo.model': model,
        problem: problem // Use original problem for cache lookup
      };
      
      // Add DTC codes to query if provided (any match)
      if (dtcCodes && dtcCodes.length > 0) {
        cacheQuery.dtcCodes = { $in: dtcCodes };
      }
      
      // Check for recent cached research (less than 30 days old)
      const cachedResearch = await ResearchCache.findOne(cacheQuery)
        .sort({ createdAt: -1 })
        .exec();
        
      // If we have a recent analysis (less than 30 days old), return just diagnosticSteps
      if (cachedResearch && 
          (new Date() - new Date(cachedResearch.createdAt)) < 30 * 24 * 60 * 60 * 1000) {
        console.log(`[Research Steps] Using cached research with ID: ${cachedResearch._id}`);
        
        // Extract only diagnosticSteps from cached result
        const diagnosticSteps = cachedResearch.result?.diagnosticSteps || [];
        
        return res.status(200).json({
          diagnosticSteps,
          fromCache: true,
          cachedAt: cachedResearch.createdAt
        });
      }
      
      console.log('[Research Steps] No recent cached research found. Generating new steps...');
    } else {
      console.log('[Research Steps] Cache lookup skipped by request.');
    }
    
    // Use the same detailed prompt template as the main research endpoint
    // Modified to focus on diagnosticSteps generation only
    const stepsPrompt = PromptTemplate.fromTemplate(`
You are a master diagnostic technician with 30 years of experience working specifically with {make} vehicles. 
You have extensive knowledge of the {year} {make} {model} including its technical specifications, common failure points, 
and manufacturer-specific diagnostic procedures. Provide an extremely detailed and technical analysis focusing on 
diagnostic steps for the following problem.

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

Your response MUST be in this JSON format with ONLY diagnosticSteps:
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
      stepsPrompt,
      chatModel,
      new StringOutputParser()
    ]);

    const vehicleData = {
      vin: vin || 'Not provided',
      year,
      make,
      model,
      problem: enhancedProblem,
      trim: trim || 'Not specified',
      engine: engine || 'Not specified',
      transmission: transmission || 'Not specified',
      mileage: mileage || 'Not specified',
      dtcCodes: dtcCodes ? dtcCodes.join(', ') : 'None reported'
    };

    console.log('[Research Steps] Invoking AI with vehicle data');
    // Process the response with retries and error handling
    const parsedResult = await processAIResponse(chain, vehicleData);
    
    console.log('[Research Steps] ========== RAW AI RESPONSE ==========');
    console.log(JSON.stringify(parsedResult, null, 2).slice(0, 500) + '...');
    console.log('[Research Steps] =====================================');
    
    // Extract and format only diagnosticSteps
    const diagnosticSteps = parsedResult.diagnosticSteps?.map(step => ({
      step: step.step || '',
      details: step.details || '',
      componentLocation: step.componentLocation || '',
      connectorInfo: step.connectorInfo || '',
      tools: step.tools || [],
      expectedReadings: step.expectedReadings || '',
      normalValueRanges: step.normalValueRanges || '',
      factoryServiceManualRef: step.factoryServiceManualRef || '',
      notes: step.notes || '',
      specialPrecautions: step.specialPrecautions || ''
    })) || [];
    
    console.log('[Research Steps] ========== FORMATTED STEPS ==========');
    console.log(`Generated ${diagnosticSteps.length} diagnostic steps`);
    if (diagnosticSteps.length > 0) {
      console.log('Sample step:', JSON.stringify(diagnosticSteps[0], null, 2));
    }
    console.log('[Research Steps] =====================================');
    
    // Store in MongoDB cache (save full structure for potential future use)
    try {
      const newCacheEntry = new ResearchCache({
        vehicleInfo: {
          vin,
          year,
          make,
          model,
          trim,
          engine,
          transmission,
          mileage
        },
        problem, // Store original problem, not enhanced
        dtcCodes: dtcCodes || [],
        result: {
          diagnosticSteps: diagnosticSteps,
          // Store minimal structure for cache lookup
        },
        userId: userId || null,
        metadata: {
          timestamp: new Date().toISOString(),
          source: 'research_steps_endpoint',
          sessionId: sessionId || null
        }
      });
      
      await newCacheEntry.save();
      console.log(`[Research Steps] Saved research to database cache with ID: ${newCacheEntry._id}`);
    } catch (cacheError) {
      console.error('[Research Steps] Error storing in research cache:', cacheError);
      // Continue with response even if cache storage fails
    }

    // Return only diagnosticSteps array
    return res.status(200).json({ 
      diagnosticSteps,
      fromCache: false
    });

  } catch (error) {
    console.error('[Research Steps] Error processing diagnostic steps request:', error);
    return res.status(500).json({ 
      error: 'Failed to process diagnostic steps request',
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

/**
 * GET /api/research/cache/:id
 * 
 * Retrieve a cached research record by ID
 */
router.get('/cache/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ error: 'Research ID is required' });
    }
    
    const cachedResearch = await ResearchCache.findById(id);
    
    if (!cachedResearch) {
      return res.status(404).json({ error: 'Cached research not found' });
    }
    
    return res.status(200).json({
      result: cachedResearch.result,
      vehicleInfo: cachedResearch.vehicleInfo,
      problem: cachedResearch.problem,
      dtcCodes: cachedResearch.dtcCodes,
      createdAt: cachedResearch.createdAt,
      fromCache: true
    });
    
  } catch (error) {
    console.error('Error retrieving cached research:', error);
    return res.status(500).json({
      error: 'Failed to retrieve cached research',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/research/cache
 * 
 * Search for cached research based on vehicle info and problem
 */
router.get('/cache', async (req, res) => {
  try {
    const { year, make, model, dtcCode, problem, limit = 10 } = req.query;
    
    // Build query based on provided parameters
    const query = {};
    
    if (year) query['vehicleInfo.year'] = year;
    if (make) query['vehicleInfo.make'] = make;
    if (model) query['vehicleInfo.model'] = model;
    if (dtcCode) query.dtcCodes = dtcCode;
    if (problem) query.problem = { $regex: problem, $options: 'i' };
    
    // Require at least one parameter
    if (Object.keys(query).length === 0) {
      return res.status(400).json({ 
        error: 'At least one search parameter is required (year, make, model, dtcCode, or problem)' 
      });
    }
    
    console.log(`Searching cache with query:`, query);
    
    const cachedResearch = await ResearchCache.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .exec();
    
    return res.status(200).json({
      results: cachedResearch.map(item => ({
        id: item._id,
        vehicleInfo: item.vehicleInfo,
        problem: item.problem,
        dtcCodes: item.dtcCodes,
        createdAt: item.createdAt,
        resultSummary: {
          diagnosticSteps: item.result.diagnosticSteps?.length || 0,
          possibleCauses: item.result.possibleCauses?.length || 0,
          recommendedFixes: item.result.recommendedFixes?.length || 0
        }
      })),
      count: cachedResearch.length
    });
    
  } catch (error) {
    console.error('Error searching cached research:', error);
    return res.status(500).json({
      error: 'Failed to search cached research',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/research/search-similar
 * 
 * Simplified search that only uses MongoDB cache (removed vector search)
 */
router.post('/search-similar', async (req, res) => {
  const { query, make, model, year, limit, checkCache = true } = req.body;
  
  if (!query) {
    return res.status(400).json({ error: 'Query is required' });
  }
  
  try {
    console.log(`Received search request with query: "${query.substring(0, 50)}..."`);
    console.log(`Filter parameters: make=${make || 'not specified'}, model=${model || 'not specified'}, year=${year || 'not specified'}`);
    console.log(`Result limit: ${limit || 5}, Check cache: ${checkCache}`);
    
    let results = [];
    
    // Only use MongoDB cache search (removed vector search)
    if (checkCache) {
      try {
        console.log('Checking MongoDB cache for similar research...');
        
        // Create the cache query
        const cacheQuery = {};
        if (make) cacheQuery['vehicleInfo.make'] = make;
        if (model) cacheQuery['vehicleInfo.model'] = model;
        if (year) cacheQuery['vehicleInfo.year'] = year;
        
        // Add a text search for the query term in the problem field
        if (query.length > 3) {
          // Basic keyword search (not as sophisticated as vector search)
          const keywords = query.split(/\s+/).filter(word => word.length > 3);
          if (keywords.length > 0) {
            const regexPattern = keywords.map(word => `(?=.*${word})`).join('');
            cacheQuery.problem = { $regex: new RegExp(regexPattern, 'i') };
          }
        }
        
        const cachedResults = await ResearchCache.find(cacheQuery)
          .sort({ createdAt: -1 })
          .limit(parseInt(limit) || 5)
          .exec();
          
        console.log(`Found ${cachedResults.length} results in MongoDB cache`);
        
        // Format cache results to match expected format
        if (cachedResults.length > 0) {
          results = cachedResults.map(item => ({
            pageContent: item.problem,
            metadata: {
              id: item._id,
              vehicleInfo: item.vehicleInfo,
              problem: item.problem,
              dtcCodes: item.dtcCodes,
              timestamp: item.createdAt,
              score: 1.0, // Default high score for exact matches
              researchData: item.result,
              fromCache: true
            }
          }));
        }
      } catch (cacheError) {
        console.error('Error searching MongoDB cache:', cacheError);
        return res.status(500).json({
          error: 'Failed to search cache',
          details: process.env.NODE_ENV === 'development' ? cacheError.message : undefined
        });
      }
    }
    
    return res.status(200).json({
      results: results,
      count: results.length,
      query,
      filters: { make, model, year },
      note: 'Search limited to cached results only'
    });
  } catch (error) {
    console.error('Error searching similar research:', error);
    return res.status(500).json({
      error: 'Failed to search similar research',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/research/step-images
 * 
 * On-demand image search for diagnostic steps
 * Searches for professional technical images: schematics, diagrams, parts breakdowns, and style pictures
 * Optimized for professional automotive technicians with smart image type selection
 */
router.post('/step-images', async (req, res) => {
  const { 
    stepTitle, 
    stepDescription, 
    stepDetails, 
    componentLocation,
    tools,
    vehicleContext,
    imageCount = 5
  } = req.body;

  if (!stepTitle && !stepDescription) {
    return res.status(400).json({ 
      error: 'Missing required fields. stepTitle or stepDescription is required.' 
    });
  }

  try {
    // Build search query from step information
    let searchQuery = '';
    
    // Start with step title if available
    if (stepTitle) {
      searchQuery = stepTitle;
    }
    
    // Add component location if available (very useful for image search)
    if (componentLocation) {
      searchQuery += ` ${componentLocation}`;
    }
    
    // Add step description if available
    if (stepDescription) {
      // Extract key terms from description (first 50 words)
      const descriptionWords = stepDescription.split(/\s+/).slice(0, 50).join(' ');
      searchQuery += ` ${descriptionWords}`;
    }
    
    // Add tools if available (helps find relevant diagrams)
    if (tools && Array.isArray(tools) && tools.length > 0) {
      searchQuery += ` ${tools.slice(0, 3).join(' ')}`;
    }

    // Smart image type selection based on step content - prioritize technical content
    let imageType = 'diagram'; // Default to diagram for professional content
    const searchText = (searchQuery + ' ' + (stepDetails || '')).toLowerCase();
    
    // Determine image type based on keywords - prioritize technical content
    if (searchText.includes('wiring') || searchText.includes('electrical') || 
        searchText.includes('connector') || searchText.includes('circuit') ||
        searchText.includes('pin') || searchText.includes('voltage') ||
        searchText.includes('sensor') || searchText.includes('harness') ||
        searchText.includes('ecu') || searchText.includes('pcm')) {
      imageType = 'wiring';
    } else if (searchText.includes('part') || searchText.includes('component') ||
               searchText.includes('assembly') || searchText.includes('exploded') ||
               searchText.includes('breakdown') || searchText.includes('disassembly')) {
      imageType = 'parts';
    } else if (searchText.includes('flowchart') || searchText.includes('diagnostic') ||
               searchText.includes('troubleshooting') || searchText.includes('procedure') ||
               searchText.includes('decision tree')) {
      imageType = 'flowchart';
    } else if (searchText.includes('diagram') || searchText.includes('schematic') ||
               searchText.includes('blueprint') || searchText.includes('layout') ||
               searchText.includes('technical drawing')) {
      imageType = 'diagram';
    }

    console.log(`🔍 RESEARCH ROUTES: Using agent to search for ${imageType} images with query: "${searchQuery}"`);

    // Try agent-based search first (preferred method)
    let imageResults;
    try {
      // Use the agent's intelligence to search for images
      imageResults = await responsesService.searchImagesWithAgent({
        stepTitle,
        stepDescription,
        componentLocation,
        tools,
        vehicleContext: vehicleContext || {},
        imageType,
        imageCount: Math.min(imageCount, 10)
      });
    } catch (agentError) {
      console.log(`Agent search failed, falling back to web search: ${agentError.message}`);
      // Fallback to direct web search
      imageResults = await webSearchService.searchTechnicalImages(searchQuery, {
        vehicle_context: vehicleContext || {},
        image_type: imageType
      });
    }

    if (!imageResults.success) {
      return res.status(500).json({
        error: 'Image search failed',
        details: imageResults.error || 'Unknown error'
      });
    }

    // Handle different response formats from agent vs web search
    let images = [];
    if (imageResults.images) {
      // Agent response format
      images = imageResults.images;
    } else if (imageResults.results) {
      // Web search response format
      images = imageResults.results;
    }

    // Limit results to requested count (default 5, max 10)
    const maxImages = Math.min(imageCount, 10);
    const limitedImages = images.slice(0, maxImages);

    // Normalize image structure to match frontend expectations
    const normalizedImages = limitedImages.map((img) => ({
      url: img.image_url || img.url || img.link || '',
      thumbnail_url: img.thumbnail_url || img.image_url || img.url || img.link || '',
      thumbnail: img.thumbnail_url || img.image_url || img.url || img.link || '',
      title: img.title || 'Technical Image',
      source: img.source || 'Search Result',
      link: img.url || img.link || img.image_url || '',
      width: img.width,
      height: img.height
    }));

    return res.status(200).json({
      success: true,
      query: imageResults.query || searchQuery,
      imageType: imageType,
      images: normalizedImages,
      total_results: imageResults.total_results || normalizedImages.length
    });

  } catch (error) {
    console.error('Error processing step image search:', error);
    return res.status(500).json({
      error: 'Failed to retrieve step images',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;
