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
import { QdrantClient } from '@qdrant/js-client-rest';
import OpenAI from 'openai';
import crypto from 'crypto';
// Import the unified vector services
import { VectorService } from '../services/VectorService.js';
import { MemoryVectorService } from '../services/MemoryVectorService.js';

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

// Configuration constants
const RESEARCH_COLLECTION_NAME = 'vehicle_research';
const VECTOR_COLLECTION_NAME = 'vehicle_research_store';
const MEMORY_INSTANCE_NAME = 'vehicle_research_memory';
const DEBUG_MODE = process.env.NODE_ENV === 'development';

// Configure Qdrant client for legacy support
const qdrantClient = new QdrantClient({ 
  url: process.env.QDRANT_URL || 'http://localhost:6333' 
});

// Initialize vector services for research
async function initializeVectorServices() {
  try {
    // Initialize all vector services in parallel
    const initPromises = [];
    
    // 1. Initialize Qdrant collection (legacy)
    initPromises.push(
      (async () => {
        try {
          const collections = await qdrantClient.getCollections();
          const collectionExists = collections.collections.some(
            collection => collection.name === RESEARCH_COLLECTION_NAME
          );

          if (!collectionExists) {
            console.log(`Creating Qdrant collection: ${RESEARCH_COLLECTION_NAME}`);
            
            // Vector size for text-embedding-3-small is 1536
            await qdrantClient.createCollection(RESEARCH_COLLECTION_NAME, {
              vectors: {
                size: 1536,
                distance: 'Cosine'
              }
            });
            
            console.log(`Collection ${RESEARCH_COLLECTION_NAME} created successfully`);
          } else {
            console.log(`Collection ${RESEARCH_COLLECTION_NAME} already exists`);
          }
          return true;
        } catch (error) {
          console.error('Error initializing Qdrant collection:', error);
          return false;
        }
      })()
    );
    
    // 2. Initialize primary VectorService
    initPromises.push(
      VectorService.initialize({
        collectionName: VECTOR_COLLECTION_NAME,
        useOpenAI: true,   // Use OpenAI for vehicle research for highest quality
        useLocal: true     // Also use local for redundancy
      })
      .then(() => {
        console.log(`Initialized VectorService with collection: ${VECTOR_COLLECTION_NAME}`);
        return true;
      })
      .catch(error => {
        console.error('Error initializing VectorService:', error);
        return false;
      })
    );
    
    // 3. Initialize memory vector service
    if (!MemoryVectorService.hasInstance(MEMORY_INSTANCE_NAME)) {
      initPromises.push(
        MemoryVectorService.initialize(MEMORY_INSTANCE_NAME)
          .then(() => {
            console.log(`Initialized MemoryVectorService instance: ${MEMORY_INSTANCE_NAME}`);
            return true;
          })
          .catch(error => {
            console.error('Error initializing MemoryVectorService:', error);
            return false;
          })
      );
    } else {
      console.log(`MemoryVectorService instance ${MEMORY_INSTANCE_NAME} already exists`);
    }
    
    // Wait for all initialization to complete
    const results = await Promise.allSettled(initPromises);
    
    // Log initialization results
    if (DEBUG_MODE) {
      console.log('Vector services initialization results:', 
        results.map((r, i) => `Service ${i}: ${r.status}`));
    }
    
    // Return true if at least one service initialized successfully
    return results.some(r => r.status === 'fulfilled' && r.value === true);
  } catch (error) {
    console.error('Error in initializeVectorServices:', error);
    return false;
  }
}

// Initialize services on startup
initializeVectorServices().catch(err => {
  console.error('Failed to initialize vector services:', err);
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

// Function to store research data in vector database
async function storeResearchInVectorDB(formattedResult, metadata) {
  try {
    // Check if formattedResult is valid
    if (!formattedResult || typeof formattedResult !== 'object') {
      throw new Error('Invalid research data format');
    }
    
    // Prepare text for embedding - combine relevant sections
    const textToEmbed = [
      ...formattedResult.diagnosticSteps.map(step => `${step.step}: ${step.details}`),
      ...formattedResult.possibleCauses.map(cause => `${cause.cause}: ${cause.explanation}`),
      ...formattedResult.recommendedFixes.map(fix => `${fix.fix}: ${fix.procedureOverview || ''}`),
      formattedResult.technicalNotes.commonIssues.join('. '),
      formattedResult.technicalNotes.manufacturerSpecificNotes || formattedResult.technicalNotes.manufacturerSpecificInfo || ''
    ].filter(Boolean).join('\n\n');
    
    // If there's no text to embed, log an error and return
    if (!textToEmbed || textToEmbed.trim() === '') {
      console.error('No valid text to embed in the research data');
      console.log('Research data structure:', JSON.stringify({
        diagnosticSteps: formattedResult.diagnosticSteps?.length || 0,
        possibleCauses: formattedResult.possibleCauses?.length || 0,
        recommendedFixes: formattedResult.recommendedFixes?.length || 0,
        technicalNotes: Object.keys(formattedResult.technicalNotes || {})
      }));
      throw new Error('No valid text to embed in the research data');
    }
    
    // Create a valid UUID for this research data 
    const uniqueId = crypto.randomUUID();
    console.log(`Generated valid UUID for vector storage: ${uniqueId}`);
    
    // Create document for vector services
    const document = {
      pageContent: textToEmbed,
      metadata: {
        // Store metadata for filtering and retrieval
        vehicleInfo: metadata.vehicleInfo || {},
        problem: metadata.problem || '',
        dtcCodes: metadata.dtcCodes || [],
        timestamp: metadata.timestamp || new Date().toISOString(),
        id: uniqueId,
        
        // Store important section counts for reference
        diagnosticStepsCount: formattedResult.diagnosticSteps?.length || 0,
        possibleCausesCount: formattedResult.possibleCauses?.length || 0,
        recommendedFixesCount: formattedResult.recommendedFixes?.length || 0,
        
        // Add full research data
        researchData: formattedResult
      }
    };
    
    console.log(`Prepared document for vector storage with ${textToEmbed.length} characters of text`);
    
    // Parallel storage in multiple vector stores
    const storePromises = [];
    
    // 1. Store in VectorService (primary storage)
    if (VectorService.initialized) {
      storePromises.push(
        VectorService.addDocuments([document], { collection: VECTOR_COLLECTION_NAME })
          .then((result) => {
            console.log(`Successfully stored research data in VectorService with ID: ${uniqueId}`);
            console.log(`VectorService result:`, result);
            return true;
          })
          .catch(error => {
            console.error('Error storing in VectorService:', error);
            return false;
          })
      );
    } else {
      console.warn('VectorService not initialized, skipping primary storage');
    }
    
    // 2. Store in MemoryVectorService for fast retrieval
    if (MemoryVectorService.hasInstance(MEMORY_INSTANCE_NAME)) {
      storePromises.push(
        MemoryVectorService.addDocuments(MEMORY_INSTANCE_NAME, [document])
          .then((result) => {
            console.log(`Successfully stored research data in MemoryVectorService instance: ${MEMORY_INSTANCE_NAME}`);
            console.log(`MemoryVectorService result:`, result);
            return true;
          })
          .catch(error => {
            console.error('Error storing in MemoryVectorService:', error);
            return false;
          })
      );
    } else {
      console.warn(`MemoryVectorService instance ${MEMORY_INSTANCE_NAME} not available, skipping memory storage`);
    }
    
    // 3. Legacy storage in Qdrant directly (for backward compatibility)
    if (process.env.USE_LEGACY_QDRANT !== 'false') {
      try {
        // Generate embeddings using OpenAI client for Qdrant
        const openaiClient = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        });
        
        console.log(`Generating embeddings for Qdrant storage with text length: ${textToEmbed.length}`);
        const embeddingResponse = await openaiClient.embeddings.create({
          model: "text-embedding-3-small",
          input: textToEmbed.substring(0, 8000) // Limit text length if needed
        });
        
        if (!embeddingResponse.data || !embeddingResponse.data[0] || !embeddingResponse.data[0].embedding) {
          throw new Error('Failed to generate embeddings from OpenAI');
        }
        
        const embedding = embeddingResponse.data[0].embedding;
        console.log(`Generated embedding with dimension: ${embedding.length}`);
        
        storePromises.push(
          qdrantClient.upsert(RESEARCH_COLLECTION_NAME, {
            wait: true,
            points: [
              {
                id: uniqueId,
                vector: embedding,
                payload: {
                  // Store metadata for filtering and retrieval
                  vehicleInfo: metadata.vehicleInfo || {},
                  problem: metadata.problem || '',
                  dtcCodes: metadata.dtcCodes || [],
                  timestamp: metadata.timestamp || new Date().toISOString(),
                  
                  // Store content for display
                  content: textToEmbed,
                  
                  // Store important sections for specific retrieval
                  diagnosticStepsCount: formattedResult.diagnosticSteps?.length || 0,
                  possibleCausesCount: formattedResult.possibleCauses?.length || 0,
                  recommendedFixesCount: formattedResult.recommendedFixes?.length || 0,
                  
                  // Store full research data
                  researchData: formattedResult
                }
              }
            ]
          })
          .then(() => {
            console.log(`Successfully stored research data in Qdrant with ID: ${uniqueId}`);
            return true;
          })
          .catch(error => {
            console.error('Error storing in Qdrant:', error);
            return false;
          })
        );
      } catch (embeddingError) {
        console.error('Error generating embeddings for Qdrant:', embeddingError);
        // Continue with other storage methods even if this fails
      }
    }
    
    // Wait for all storage operations to complete
    const results = await Promise.allSettled(storePromises);
    
    // Log storage results in debug mode
    if (DEBUG_MODE) {
      console.log('Vector storage results:', 
        results.map((r, i) => `Store operation ${i}: ${r.status}`));
    }
    
    // Count successful storage operations
    const successCount = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
    console.log(`Successfully stored research data in ${successCount} out of ${storePromises.length} vector databases`);
    
    // Return true if at least one storage operation succeeded
    return results.some(r => r.status === 'fulfilled' && r.value === true);
  } catch (error) {
    console.error('Error in storeResearchInVectorDB:', error);
    throw error;
  }
}

// Function to search for similar research data
async function searchSimilarResearch(query, filter = {}, limit = 5) {
  try {
    console.log(`Searching for research similar to: "${query.substring(0, 50)}..."`, 
      Object.keys(filter).length > 0 ? `with filters: ${JSON.stringify(filter)}` : '');
    
    // Validate and prepare filter
    const preparedFilter = {};
    if (filter.make) {
      preparedFilter['metadata.vehicleInfo.make'] = filter.make;
    }
    if (filter.model) {
      preparedFilter['metadata.vehicleInfo.model'] = filter.model;
    }
    if (filter.year) {
      preparedFilter['metadata.vehicleInfo.year'] = filter.year;
    }
    
    console.log(`Prepared filter for vector search:`, preparedFilter);
    
    let results = [];
    
    // Try searching in MemoryVectorService first (fastest)
    if (MemoryVectorService.hasInstance(MEMORY_INSTANCE_NAME)) {
      try {
        console.log(`Searching MemoryVectorService instance: ${MEMORY_INSTANCE_NAME}`);
        const memoryResults = await MemoryVectorService.similaritySearch(
          MEMORY_INSTANCE_NAME, 
          query, 
          parseInt(limit),
          preparedFilter
        );
        
        if (memoryResults && memoryResults.length > 0) {
          console.log(`Found ${memoryResults.length} results in MemoryVectorService`);
          results = memoryResults;
          return results; // Return immediately for fastest response
        }
      } catch (memoryError) {
        console.error('Error searching MemoryVectorService:', memoryError);
      }
    }
    
    // Try searching in VectorService next (second fastest)
    if (results.length === 0 && VectorService.initialized) {
      try {
        console.log('Searching unified VectorService');
        const vectorResults = await VectorService.similaritySearch(
          query, 
          parseInt(limit), 
          { 
            collection: VECTOR_COLLECTION_NAME,
            filter: preparedFilter
          }
        );
        
        if (vectorResults && vectorResults.length > 0) {
          console.log(`Found ${vectorResults.length} results in VectorService`);
          results = vectorResults;
          return results; // Return immediately for faster response
        }
      } catch (vectorError) {
        console.error('Error searching VectorService:', vectorError);
      }
    }
    
    // Finally, fall back to Qdrant direct search if needed (legacy compatibility)
    if (results.length === 0 && process.env.USE_LEGACY_QDRANT !== 'false') {
      console.log('Falling back to legacy Qdrant search');
      
      // Generate embedding for the query using OpenAI
      const openaiClient = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      
      const embeddingResponse = await openaiClient.embeddings.create({
        model: "text-embedding-3-small",
        input: query
      });
      
      const embedding = embeddingResponse.data[0].embedding;
      
      // Build filter conditions for Qdrant if any
      let filterCondition = {};
      if (filter.make) {
        filterCondition = {
          ...filterCondition,
          "payload.vehicleInfo.make": filter.make
        };
      }
      if (filter.model) {
        filterCondition = {
          ...filterCondition,
          "payload.vehicleInfo.model": filter.model
        };
      }
      if (filter.year) {
        filterCondition = {
          ...filterCondition,
          "payload.vehicleInfo.year": filter.year
        };
      }
      
      const qdrantSearch = {
        vector: embedding,
        limit: parseInt(limit),
        with_payload: true,
        with_vectors: false
      };
      
      // Only add filter if we have conditions
      if (Object.keys(filterCondition).length > 0) {
        qdrantSearch.filter = { must: Object.entries(filterCondition).map(([key, value]) => ({ 
          key, 
          match: { value } 
        }))};
      }
      
      console.log(`Executing Qdrant search with params:`, JSON.stringify(qdrantSearch));
      
      const qdrantResults = await qdrantClient.search(RESEARCH_COLLECTION_NAME, qdrantSearch);
      
      console.log(`Found ${qdrantResults.length} results in Qdrant`);
      
      // Convert Qdrant results to the expected format
      results = qdrantResults.map(result => ({
        pageContent: result.payload.content,
        metadata: {
          vehicleInfo: result.payload.vehicleInfo,
          problem: result.payload.problem,
          dtcCodes: result.payload.dtcCodes,
          timestamp: result.payload.timestamp,
          score: result.score,
          
          // Include full research data if available
          researchData: result.payload.researchData
        }
      }));
    }
    
    return results;
  } catch (error) {
    console.error('Error searching similar research:', error);
    throw error;
  }
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
    
    // Store in vector database
    try {
      await storeResearchInVectorDB(formattedResult, {
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
        dtcCodes: dtcCodes || [],
        problem,
        timestamp: new Date().toISOString(),
        source: 'research_routes'
      });
      console.log('Research data stored in vector database');
    } catch (vectorStoreError) {
      console.error('Error storing in vector database:', vectorStoreError);
      // Continue with response even if vector storage fails
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
    const openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const result = await openaiClient.embeddings.create({
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

/**
 * POST /api/research/search-similar
 * 
 * Search for similar research results based on a query
 */
router.post('/search-similar', async (req, res) => {
  const { query, make, model, year, limit } = req.body;
  
  if (!query) {
    return res.status(400).json({ error: 'Query is required' });
  }
  
  try {
    console.log(`Received search request with query: "${query.substring(0, 50)}..."`);
    console.log(`Filter parameters: make=${make || 'not specified'}, model=${model || 'not specified'}, year=${year || 'not specified'}`);
    console.log(`Result limit: ${limit || 5}`);
    
    // Build filter based on provided parameters
    const filter = {};
    if (make) filter.make = make;
    if (model) filter.model = model;
    if (year) filter.year = parseInt(year) || year; // Ensure numeric if possible
    
    // Log the services available
    console.log(`Available search services:
      - Qdrant: ${process.env.USE_LEGACY_QDRANT !== 'false' ? 'enabled' : 'disabled'}
      - VectorService: ${VectorService.initialized ? 'initialized' : 'not initialized'}
      - MemoryVectorService: ${MemoryVectorService.hasInstance(MEMORY_INSTANCE_NAME) ? 'available' : 'not available'}
    `);
    
    // Search for similar research results
    const searchResults = await searchSimilarResearch(
      query, 
      filter, 
      limit || 5
    );
    
    console.log(`Search completed. Found ${searchResults.length} results`);
    
    // Log sample of the results
    if (searchResults.length > 0) {
      console.log(`First result metadata:`, JSON.stringify(searchResults[0].metadata, null, 2));
    }
    
    return res.status(200).json({
      results: searchResults,
      count: searchResults.length,
      query,
      filters: filter
    });
  } catch (error) {
    console.error('Error searching similar research:', error);
    return res.status(500).json({
      error: 'Failed to search similar research',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;
