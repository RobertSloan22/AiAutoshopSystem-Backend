import express from 'express';
import axios from 'axios';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { z } from 'zod';
import { OpenAI as LangChainOpenAI } from '@langchain/openai';
import PartsRetriever from '../parts.service.js';
import { OpenAIEmbeddings } from '@langchain/openai';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import crypto from 'crypto';
import { DiagnosticSessionManager } from './session-manager.js';
import { io as sharedIo } from '../socket/socket.js';
import OpenAI from 'openai';
import { VectorService } from '../services/VectorService.js';
import { MemoryVectorService } from '../services/MemoryVectorService.js';

const router = express.Router();
const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});
const sessionManager = new DiagnosticSessionManager();
const vectorStore = new MemoryVectorStore(new OpenAIEmbeddings());

// Define constants for vector service
const MEMORY_INSTANCE_NAME = 'research_service_memory';
const VECTOR_COLLECTION_NAME = 'unified_research';

/**
 * @swagger
 * components:
 *   schemas:
 *     ResearchService:
 *       type: object
 *       required:
 *         - serviceType
 *         - parameters
 *       properties:
 *         serviceType:
 *           type: string
 *           enum: [diagnostic, maintenance, repair]
 *           description: Type of service research
 *         parameters:
 *           type: object
 *           properties:
 *             vehicleMake:
 *               type: string
 *               description: Vehicle manufacturer
 *             vehicleModel:
 *               type: string
 *               description: Vehicle model
 *             vehicleYear:
 *               type: integer
 *               description: Vehicle year
 *             symptoms:
 *               type: array
 *               items:
 *                 type: string
 *               description: List of symptoms or issues
 *         results:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               diagnosis:
 *                 type: string
 *                 description: Diagnostic result
 *               recommendations:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Recommended actions
 *               parts:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Required parts
 */

/**
 * @swagger
 * /api/research/service:
 *   post:
 *     summary: Request service research
 *     tags: [Research Service]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - serviceType
 *               - parameters
 *             properties:
 *               serviceType:
 *                 type: string
 *                 enum: [diagnostic, maintenance, repair]
 *                 description: Type of service research
 *               parameters:
 *                 type: object
 *                 properties:
 *                   vehicleMake:
 *                     type: string
 *                   vehicleModel:
 *                     type: string
 *                   vehicleYear:
 *                     type: integer
 *                   symptoms:
 *                     type: array
 *                     items:
 *                       type: string
 *     responses:
 *       200:
 *         description: Service research results
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ResearchService'
 *       400:
 *         description: Invalid input
 */

// Updated Service Research Schema with new diagnostic details and partsAvailability section
const ServiceResearchSchema = z.object({
    diagnosticSteps: z.array(z.object({
        step: z.string(),
        details: z.string(),
        componentsTested: z.array(z.string()),
        testingProcedure: z.string(),
        tools: z.array(z.string()),
        expectedReadings: z.string(),
        normalRanges: z.string(),
        componentLocation: z.string(),
        circuitDiagram: z.string().optional(),
        componentPartNumbers: z.array(z.string()).optional()
    })),
    possibleCauses: z.array(z.object({
        cause: z.string(),
        technicalExplanation: z.string(),
        diagnosticEvidence: z.string(),
        modelSpecificNotes: z.string(),
        relatedComponents: z.array(z.string())
    })),
    recommendedFixes: z.array(z.object({
        fix: z.string(),
        technicalRequirements: z.string(),
        parts: z.array(z.string()),
        oemPartNumbers: z.array(z.string()),
        torqueSpecifications: z.string(),
        clearanceSpecifications: z.string(),
        calibrationProcedures: z.string().optional(),
        specialTools: z.array(z.string()),
        technicalProcedure: z.array(z.string()),
        serviceManualReference: z.string(),
        componentLocation: z.string(),
        removalSteps: z.array(z.string()),
        installationSteps: z.array(z.string()),
        testingSpecifications: z.string(),
        programmingRequirements: z.string().optional()
    })),
    technicalNotes: z.object({
        commonIssues: z.array(z.string()),
        serviceIntervals: z.array(z.string()),
        recalls: z.array(z.string()),
        tsbs: z.array(z.string()),
        manufacturerSpecificInfo: z.string(),
        technicalBulletins: z.array(z.string()).optional()
    }),
    references: z.array(z.object({
        source: z.string(),
        url: z.string().optional(),
        type: z.string(),
        relevance: z.string(),
        pageReference: z.string().optional(),
        technicalContent: z.string().optional()
    }))
});

// Detailed Research Schema remains unchanged
const DetailedResearchSchema = z.object({
    title: z.string(),
    category: z.string(),
    detailedDescription: z.string(),
    additionalSteps: z.array(z.string()).optional(),
    warnings: z.array(z.string()).optional(),
    expertTips: z.array(z.string()).optional(),
    relatedIssues: z.array(z.string()).optional(),
    estimatedTime: z.string().optional(),
    requiredExpertise: z.string().optional(),
    additionalResources: z.array(z.object({
        title: z.string(),
        url: z.string().optional(),
        description: z.string()
    })).optional()
});

// Schema for test result submission
const TestResultSchema = z.object({
    sessionId: z.string(),
    stepNumber: z.number(),
    testResults: z.object({
        readings: z.array(z.object({
            testPoint: z.string(),
            value: z.string(),
            unit: z.string().optional()
        })).optional(),
        visualInspection: z.array(z.object({
            component: z.string(),
            condition: z.string(),
            notes: z.string().optional()
        })).optional(),
        scanToolData: z.array(z.object({
            pid: z.string(),
            value: z.string(),
            status: z.string().optional()
        })).optional(),
        additionalObservations: z.string().optional()
    }),
    timestamp: z.string()
});

// Schema for diagnostic session
const DiagnosticSessionSchema = z.object({
    sessionId: z.string(),
    vehicleInfo: z.object({
        year: z.number(),
        make: z.string(),
        model: z.string(),
        vin: z.string().optional(),
        engine: z.string().optional(),
        transmission: z.string().optional()
    }),
    initialSymptoms: z.array(z.string()),
    currentStep: z.number(),
    stepHistory: z.array(z.object({
        stepNumber: z.number(),
        action: z.string(),
        results: z.any(),
        timestamp: z.string(),
        analysis: z.string()
    })),
    currentDiagnosis: z.object({
        possibleCauses: z.array(z.object({
            cause: z.string(),
            probability: z.number(),
            evidence: z.array(z.string())
        })),
        eliminatedCauses: z.array(z.string()),
        nextStepRationale: z.string()
    })
});

// Helper function to get parts availability using AutoZone
async function getPartsAvailability(partName, vehicle, location = 'local') {
    try {
        const partsRetriever = new PartsRetriever();
        const searchResults = await partsRetriever.searchParts(partName, vehicle);
        
        // Get detailed information for each part
        const detailedResults = await Promise.all(
            searchResults.slice(0, 3).map(async (result) => {
                try {
                    const details = await partsRetriever.getPartDetails(result.url);
                    return {
                        part: partName,
                        supplier: 'AutoZone',
                        availability: details.availability.inStore || details.availability.online,
                        cost: details.pricing.sale || details.pricing.regular,
                        url: result.url,
                        brand: result.brand,
                        partNumber: result.partNumber,
                        warranty: details.warranty,
                        specifications: details.specifications
                    };
                } catch (error) {
                    console.error(`Error getting details for part ${result.url}:`, error);
                    return result;
                }
            })
        );

        return detailedResults;
    } catch (error) {
        console.error(`Error fetching parts availability for ${partName}:`, error.message);
        return [];
    }
}

// Helper function to make LLM requests with smaller chunks
async function getLLMResponse(model, prompt, data, retries = 3, delay = 1000) {
    let lastError;
    
    for (let i = 0; i < retries; i++) {
        try {
            const chain = RunnableSequence.from([
                prompt,
                model,
                new StringOutputParser()
            ]);
            
            const result = await chain.invoke(data);
            
            if (!result) {
                throw new Error('Empty response from LLM');
            }

            // Clean and prepare the response
            let jsonStr = result;
            
            // If the response is wrapped in markdown code blocks, remove them
            jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
            
            // Try to find JSON object in the response if it's not already JSON
            if (!jsonStr.trim().startsWith('{')) {
                const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
                if (!jsonMatch) {
                    throw new Error('No JSON found in response');
                }
                jsonStr = jsonMatch[0];
            }

            // Clean the JSON string
            jsonStr = jsonStr.trim();
            
            // Convert numbered list items into proper string array format
            jsonStr = jsonStr.replace(/("[\w]+Steps":\s*\[)([^[\]]*?)(\])/g, (match, start, steps, end) => {
                const formattedSteps = steps.split(/\n/)
                    .map(step => step.trim())
                    .filter(step => step)
                    .map(step => {
                        step = step.replace(/^\d+\.\s*/, '').trim();
                        return `"${step.replace(/"/g, '\\"')}"`;
                    })
                    .join(',');
                return `${start}${formattedSteps}${end}`;
            });
            
            // Verify the JSON is valid
            try {
                const parsed = JSON.parse(jsonStr);
                if (!parsed || typeof parsed !== 'object') {
                    throw new Error('Invalid JSON structure');
                }
                return parsed;
            } catch (jsonError) {
                console.error('Invalid JSON response:', jsonStr);
                throw new Error(`Invalid JSON response: ${jsonError.message}`);
            }
        } catch (error) {
            lastError = error;
            console.error(`LLM request attempt ${i + 1} failed:`, error);
            
            if (i < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
            }
        }
    }
    
    throw new Error(`Failed after ${retries} attempts. Last error: ${lastError.message}`);
}

// Update helper functions to use session manager
async function storeSession(session) {
    await sessionManager.storeSession(session);
}

async function getSession(sessionId) {
    return await sessionManager.getSession(sessionId);
}

async function updateSession(session) {
    await sessionManager.updateSession(session);
}

async function getInitialAssessment(vehicleInfo, symptoms) {
    const prompt = `As an automotive diagnostic expert, analyze these symptoms for a ${vehicleInfo.year} ${vehicleInfo.make} ${vehicleInfo.model} with ${vehicleInfo.mileage} miles:
    
    Symptoms: ${symptoms}
    
    Provide a structured initial assessment including:
    1. Potential causes (most likely to least likely)
    2. Recommended diagnostic steps
    3. Estimated severity (low/medium/high)
    4. Safety considerations`;

    const completion = await openaiClient.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 1000
    });

    return completion.choices[0].message.content;
}

// Initialize the vector services during module loading
async function initializeVectorServices() {
  try {
    // Initialize VectorService for persistent storage
    await VectorService.initialize({
      collectionName: VECTOR_COLLECTION_NAME
    });
    console.log(`Initialized VectorService with collection: ${VECTOR_COLLECTION_NAME}`);
    
    // Initialize MemoryVectorService for temporary storage
    await MemoryVectorService.initialize(MEMORY_INSTANCE_NAME);
    console.log(`Initialized MemoryVectorService instance: ${MEMORY_INSTANCE_NAME}`);
    
    return true;
  } catch (error) {
    console.error('Error initializing vector services:', error);
    // Continue even if initialization fails
    return false;
  }
}

// Initialize vector services on module load
initializeVectorServices().catch(console.error);

// Enhanced vector store search function - modified to use all available vector services
async function searchVectorStore(query, metadata = {}, limit = 5) {
    try {
        // Try memory vector store first (fastest)
        try {
            // Check if the memory vector store has content
            if (MemoryVectorService.getSize(MEMORY_INSTANCE_NAME) > 0) {
                console.log(`Searching MemoryVectorService instance: ${MEMORY_INSTANCE_NAME}`);
                const memoryResults = await MemoryVectorService.similaritySearch(MEMORY_INSTANCE_NAME, query, limit);
                
                // Apply filters manually if any
                const filteredResults = Object.keys(metadata).length > 0 
                    ? memoryResults.filter(doc => {
                        // Check each filter criteria
                        for (const [key, value] of Object.entries(metadata)) {
                            // For nested objects like vehicleInfo.make
                            if (key.includes('.')) {
                                const [parent, child] = key.split('.');
                                if (!doc.metadata[parent] || doc.metadata[parent][child] !== value) {
                                    return false;
                                }
                            } else if (doc.metadata[key] !== value) {
                                return false;
                            }
                        }
                        return true;
                    })
                    : memoryResults;
                
                if (filteredResults.length > 0) {
                    console.log(`Found ${filteredResults.length} results in MemoryVectorService`);
                    return filteredResults.map(doc => ({
                        content: doc.pageContent,
                        metadata: doc.metadata,
                        score: doc._distance || 1.0 // Similarity score if available
                    }));
                }
            }
        } catch (memoryError) {
            console.error('Error searching MemoryVectorService:', memoryError);
            // Continue to next vector store
        }
        
        // Then try unified vector store
        try {
            if (VectorService.initialized) {
                console.log(`Searching VectorService collection: ${VECTOR_COLLECTION_NAME}`);
                const vectorResults = await VectorService.similaritySearch(query, limit, metadata);
                
                if (vectorResults.length > 0) {
                    console.log(`Found ${vectorResults.length} results in VectorService`);
                    return vectorResults.map(doc => ({
                        content: doc.pageContent,
                        metadata: doc.metadata,
                        score: doc._distance || 1.0
                    }));
                }
            }
        } catch (vectorError) {
            console.error('Error searching VectorService:', vectorError);
            // Continue to original vector store
        }
        
        // Fall back to original vector store implementation
        console.log('Using original vector store search implementation');
        const results = await vectorStore.similaritySearch(query, limit, metadata);
        return results.map(doc => ({
            content: doc.pageContent,
            metadata: doc.metadata,
            score: doc.score // Similarity score if available
        }));
    } catch (error) {
        console.error('Error searching vector store:', error);
        throw error;
    }
}

// Modified storeResearchInVectorDB to use all available vector services
async function storeResearchInVectorDB(researchData, metadata = {}) {
    try {
        // Prepare documents for storage
        const documents = [];

        // Split into smaller, focused chunks for better retrieval
        if (researchData.diagnosticSteps) {
            researchData.diagnosticSteps.forEach((step, index) => {
                documents.push({
                    pageContent: `Diagnostic Step ${index + 1}:\n${step.step}\n${step.details}`,
                    metadata: {
                        ...metadata,
                        type: 'diagnostic_step',
                        stepNumber: index + 1,
                        timestamp: new Date().toISOString()
                    }
                });
            });
        }

        if (researchData.possibleCauses) {
            researchData.possibleCauses.forEach((cause, index) => {
                documents.push({
                    pageContent: `Possible Cause ${index + 1}:\n${cause.cause}\nExplanation: ${cause.explanation || cause.technicalExplanation || ''}`,
                    metadata: {
                        ...metadata,
                        type: 'possible_cause',
                        causeNumber: index + 1,
                        timestamp: new Date().toISOString()
                    }
                });
            });
        }

        if (researchData.recommendedFixes) {
            researchData.recommendedFixes.forEach((fix, index) => {
                const procedure = fix.procedureOverview || 
                                 (fix.technicalProcedure ? fix.technicalProcedure.join('\n') : '');
                documents.push({
                    pageContent: `Recommended Fix ${index + 1}:\n${fix.fix}\nProcedure: ${procedure}`,
                    metadata: {
                        ...metadata,
                        type: 'recommended_fix',
                        fixNumber: index + 1,
                        timestamp: new Date().toISOString()
                    }
                });
            });
        }

        if (researchData.technicalNotes) {
            Object.entries(researchData.technicalNotes).forEach(([key, value]) => {
                documents.push({
                    pageContent: `Technical Note - ${key}:\n${Array.isArray(value) ? value.join('\n') : value}`,
                    metadata: {
                        ...metadata,
                        type: 'technical_note',
                        noteType: key,
                        timestamp: new Date().toISOString()
                    }
                });
            });
        }

        // Store in all available vector services
        const storePromises = [];
        
        // 1. Store in original vector store
        storePromises.push(
            vectorStore.addDocuments(documents)
                .then(() => console.log(`Stored ${documents.length} documents in original vector store`))
                .catch(error => console.error('Error storing in original vector store:', error))
        );
        
        // 2. Store in unified VectorService if available
        if (VectorService.initialized) {
            storePromises.push(
                VectorService.addDocuments(documents)
                    .then(() => console.log(`Stored ${documents.length} documents in VectorService`))
                    .catch(error => console.error('Error storing in VectorService:', error))
            );
        }
        
        // 3. Store in MemoryVectorService for temporary fast access
        storePromises.push(
            MemoryVectorService.addDocuments(MEMORY_INSTANCE_NAME, documents)
                .then(() => console.log(`Stored ${documents.length} documents in MemoryVectorService`))
                .catch(error => console.error('Error storing in MemoryVectorService:', error))
        );
        
        // Wait for all storage operations to complete
        await Promise.allSettled(storePromises);
        
        console.log(`Successfully stored ${documents.length} documents in all vector databases`);
        return true;
    } catch (error) {
        console.error('Error storing research in vector database:', error);
        return false;
    }
}

/**
 * @swagger
 * /api/research/vector-search:
 *   post:
 *     summary: Search the vector database for relevant research information
 *     tags: [Research Service]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - query
 *             properties:
 *               query:
 *                 type: string
 *                 description: The search query
 *               filters:
 *                 type: object
 *                 description: Metadata filters for the search
 *               limit:
 *                 type: number
 *                 description: Maximum number of results to return
 *     responses:
 *       200:
 *         description: Search results from the vector database
 */
router.post('/vector-search', async (req, res) => {
    try {
        const { query, filters = {}, limit = 5 } = req.body;

        if (!query) {
            return res.status(400).json({
                success: false,
                error: 'Query is required'
            });
        }

        const results = await searchVectorStore(query, filters, limit);

        // Process results to make them more useful for the frontend agent
        const processedResults = results.map(result => {
            // Parse the content if it's JSON
            let parsedContent;
            try {
                parsedContent = JSON.parse(result.content);
            } catch {
                parsedContent = result.content;
            }

            return {
                content: parsedContent,
                metadata: result.metadata,
                score: result.score,
                timestamp: result.metadata.timestamp
            };
        });

        res.json({
            success: true,
            results: processedResults,
            totalResults: processedResults.length
        });

    } catch (error) {
        console.error('Vector search error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Service research endpoint
router.post('/service', async (req, res) => {
    const { serviceRequest, vehicle, customer } = req.body;
    let parsedResults = {};  // Declare parsedResults at the top level
    try {
        // Initialize LangChain components with more powerful model
        const chatModel = new ChatOpenAI({
            modelName: 'o3-mini',  // Upgraded from gpt-4o-mini for more detailed responses
            openAIApiKey: process.env.OPENAI_API_KEY,
            configuration: {
                timeout: 90000,    // Increased timeout to 90 seconds for more thorough research
                maxRetries: 3,
                retryDelay: 1000,
            },
        });

        // Split research into smaller chunks
        const baseData = {
            customerName: `${customer.firstName} ${customer.lastName}`,
            vehicleYear: vehicle.year,
            vehicleMake: vehicle.make,
            vehicleModel: vehicle.model,
            vin: vehicle.vin,
            serviceType: serviceRequest.serviceType,
            description: serviceRequest.description,
            priority: serviceRequest.priority,
            additionalNotes: serviceRequest.additionalNotes
        };

        // 1. Initial Diagnostic Assessment with enhanced prompt
        const initialAssessmentPrompt = PromptTemplate.fromTemplate(`
You are an expert automotive technician with extensive experience diagnosing issues on {vehicleMake} {vehicleModel} vehicles.
Provide a comprehensive technical diagnostic assessment focused specifically on this exact vehicle and problem.
Focus on detailed diagnostic procedures, testing points, and component-specific information for this exact vehicle model and year.

Vehicle Information:
Year: {vehicleYear} Make: {vehicleMake} Model: {vehicleModel}
VIN: {vin}

Service Request:
Type: {serviceType}
Description: {description}
Priority: {priority}
Additional Notes: {additionalNotes}

Include:
- Model-specific known issues and failure points
- Technical service bulletins specific to this problem
- Exact component locations and identifiers
- Specific harness connector IDs and pin numbers
- Precise testing points and procedures
- Expected values and readings for tests
- Required specialized tools and equipment

Your assessment should be highly technical and specific to help an experienced technician diagnose this exact issue.

Response format:
{
    "initialAssessment": {
        "problemAnalysis": "<analysis>",
        "vehicleSpecificConsiderations": "<considerations>",
        "knownIssuesForThisModel": ["<issue1>", "<issue2>"],
        "initialSteps": [
            {
                "step": "<step description>",
                "purpose": "<purpose>",
                "specificTestPoints": "<test points>",
                "expectedValues": "<values>",
                "requiredTools": "<tools>"
            }
        ]
    }
}
`);

        // 2. Technical Analysis Prompt with enhanced detail requirements
        const technicalAnalysisPrompt = PromptTemplate.fromTemplate(`
As an expert {vehicleMake} technician, provide extremely detailed diagnostic procedures specific to this issue on this exact {vehicleYear} {vehicleMake} {vehicleModel}.
Focus on precise measurements, specific component checks, and exact testing procedures for this vehicle.

Vehicle Information:
Year: {vehicleYear} Make: {vehicleMake} Model: {vehicleModel}
VIN: {vin}

Issue Description: {description}

Required details:
- Exact connector pin numbers and test point locations
- Specific component identifiers and part numbers
- Precise measurement values and ranges
- Factory service manual references with page numbers
- Required specialized tools with part numbers
- Step-by-step diagnostic flow for this specific issue
- Known good values for all measurements
- Circuit diagrams references if applicable

IMPORTANT: All arrays must contain properly formatted strings. For testingSteps, provide each step as a complete string without numbering.

Provide response in JSON format with:
{{
    "diagnosticProcedures": [
        {{
            "procedure": string,
            "components": [string],
            "componentLocation": string,
            "connectorIdentifiers": string,
            "testingSteps": [string],
            "requiredTools": [string],
            "expectedReadings": string,
            "normalValueRange": string,
            "serviceManualReference": string,
            "circuitDiagramReference": string,
            "componentPartNumbers": [string]
        }}
    ]
}}

Example format for testingSteps:
"testingSteps": [
    "Connect scan tool to DLC connector C101 pins 6 and 14 for CAN communication",
    "Measure voltage at ECM connector C156 pin 24 (should read 5.0V ± 0.1V)",
    "Check resistance between ECM pin C157-12 and sensor connector C234-1 (should read < 0.5 ohms)"
]
`);

        // 3. Repair Solutions Prompt with enhanced detail requirements
        const repairSolutionsPrompt = PromptTemplate.fromTemplate(`
Based on the diagnostic information, provide extremely detailed repair procedures specific to a {vehicleYear} {vehicleMake} {vehicleModel}.
Focus on exact technical specifications and procedures required for this repair.

Vehicle Information:
Year: {vehicleYear} Make: {vehicleMake} Model: {vehicleModel}
Issue: {description}

Required technical details:
- Exact torque specifications with bolt sizes and thread pitches
- Specific part numbers (OEM and common aftermarket)
- Detailed removal and installation sequences
- Required specialty tools with part numbers
- Precise electrical specifications and testing values
- Component locations specific to this model/trim
- Service manual page references for procedures
- Technical specifications for component setup/programming
- Calibration procedures if required
- Clearances and adjustment specifications

Provide response in JSON format with:
{{
    "possibleCauses": [
        {{
            "cause": string,
            "technicalExplanation": string,
            "diagnosticEvidence": string,
            "modelSpecificNotes": string,
            "relatedComponents": [string]
        }}
    ],
    "repairSolutions": [
        {{
            "solution": string,
            "technicalRequirements": string,
            "parts": [string],
            "oemPartNumbers": [string],
            "torqueSpecifications": string,
            "clearanceSpecifications": string,
            "calibrationProcedures": string,
            "specialTools": [string],
            "technicalProcedure": [string],
            "serviceManualReference": string,
            "componentLocation": string,
            "removalSteps": [string],
            "installationSteps": [string],
            "testingSpecifications": string,
            "programmingRequirements": string
        }}
    ]
}}
`);

        // 4. Technical Information Prompt
        const technicalInfoPrompt = PromptTemplate.fromTemplate(`
Provide relevant technical information, service bulletins, and recalls for this vehicle and issue.

Vehicle Information:
Year: {vehicleYear} Make: {vehicleMake} Model: {vehicleModel}
VIN: {vin}
Issue: {description}

Provide response in JSON format with:
{{
    "technicalNotes": {{
        "commonIssues": [string],
        "serviceIntervals": [string],
        "recalls": [string],
        "tsbs": [string]
    }}
}}
`);

        // Process each step sequentially with error handling
        try {
            // 1. Initial Assessment
            console.log('Starting initial assessment...');
            const initialAssessment = await getLLMResponse(chatModel, initialAssessmentPrompt, baseData);
            parsedResults.initialAssessment = initialAssessment;
            console.log('Initial assessment completed');

            // 2. Technical Analysis
            console.log('Starting technical analysis...');
            const technicalAnalysis = await getLLMResponse(chatModel, technicalAnalysisPrompt, baseData);
            parsedResults.diagnosticProcedures = technicalAnalysis.diagnosticProcedures;
            console.log('Technical analysis completed');

            // 3. Repair Solutions
            console.log('Starting repair solutions analysis...');
            const repairSolutions = await getLLMResponse(chatModel, repairSolutionsPrompt, baseData);
            const repairData = repairSolutions;
            parsedResults.possibleCauses = repairData.possibleCauses;
            parsedResults.repairSolutions = repairData.repairSolutions;
            console.log('Repair solutions completed');

            // 4. Technical Information
            console.log('Starting technical information gathering...');
            const technicalInfo = await getLLMResponse(chatModel, technicalInfoPrompt, baseData);
            parsedResults.technicalNotes = technicalInfo.technicalNotes;
            console.log('Technical information completed');
        } catch (error) {
            console.error('Error during research steps:', error);
            // Continue with partial results if we have any
            if (Object.keys(parsedResults).length === 0) {
                throw error; // Re-throw if we have no results at all
            }
        }

        // Format into final schema with enhanced fields
        const formattedResult = {
            diagnosticSteps: parsedResults.diagnosticProcedures 
                ? parsedResults.diagnosticProcedures.map(proc => ({
                    step: proc.procedure,
                    details: Array.isArray(proc.testingSteps) ? proc.testingSteps.join('\n') : proc.testingSteps || '',
                    componentsTested: proc.components || [],
                    testingProcedure: Array.isArray(proc.testingSteps) ? proc.testingSteps.join('\n') : proc.testingSteps || '',
                    tools: proc.requiredTools || [],
                    expectedReadings: proc.expectedReadings || '',
                    normalRanges: proc.normalValueRange || '',
                    componentLocation: proc.componentLocation || '',
                    notes: proc.serviceManualReference || ''
                }))
                : [],
            possibleCauses: parsedResults.possibleCauses 
                ? parsedResults.possibleCauses.map(cause => ({
                    cause: cause.cause,
                    likelihood: cause.likelihood,
                    explanation: cause.explanation,
                    modelSpecificNotes: cause.modelSpecificNotes || '',
                    commonSigns: cause.commonSigns || []
                }))
                : [],
            recommendedFixes: parsedResults.repairSolutions 
                ? parsedResults.repairSolutions.map(solution => ({
                    fix: solution.solution,
                    difficulty: solution.difficulty,
                    estimatedCost: solution.estimatedCost || 'Unknown',
                    professionalOnly: solution.difficulty === 'Complex',
                    parts: solution.parts || [],
                    laborHours: solution.laborHours || '',
                    specialTools: solution.specialTools || [],
                    procedureSteps: solution.procedureSteps || []
                }))
                : [],
            technicalNotes: parsedResults.technicalNotes 
                ? {
                    commonIssues: parsedResults.technicalNotes.commonIssues || [],
                    serviceIntervals: parsedResults.technicalNotes.serviceIntervals || [],
                    recalls: parsedResults.technicalNotes.recalls || [],
                    tsbs: parsedResults.technicalNotes.tsbs || [],
                    manufacturerSpecificInfo: parsedResults.technicalNotes.manufacturerSpecificInfo || '',
                    preventativeMaintenance: parsedResults.technicalNotes.preventativeMaintenance || []
                }
                : {
                    commonIssues: [],
                    serviceIntervals: [],
                    recalls: [],
                    tsbs: []
                },
            references: [] // Can be populated from technical info if needed
        };

        // Validate the formatted result
        let validatedResult;
        try {
            validatedResult = ServiceResearchSchema.parse(formattedResult);
        } catch (validationError) {
            console.error('Schema validation error:', validationError);
            // Send partial results even if validation fails
            return res.json({
                success: true,
                result: formattedResult,
                warning: 'Some data may be incomplete or invalid'
            });
        }

        // Get parts availability if needed
        if (validatedResult.recommendedFixes && validatedResult.recommendedFixes.length > 0) {
            try {
                const partsSet = new Set();
                validatedResult.recommendedFixes.forEach(fix => {
                    if (fix.parts) {
                        fix.parts.forEach(part => partsSet.add(part));
                    }
                });

                const location = customer.location || 'local';
                const partsArray = Array.from(partsSet);
                
                // Process parts availability sequentially to avoid overwhelming the API
                const partsAvailability = [];
                for (const partName of partsArray) {
                    try {
                        const partResults = await getPartsAvailability(partName, vehicle, location);
                        partsAvailability.push(...partResults);
                    } catch (partError) {
                        console.error(`Error fetching availability for part ${partName}:`, partError);
                    }
                }

                if (partsAvailability.length > 0) {
                    validatedResult.partsAvailability = partsAvailability;
                }
            } catch (partsError) {
                console.error('Error processing parts availability:', partsError);
            }
        }

        // After validating the result and before returning response
        if (validatedResult) {
            // Store in vector database with relevant metadata
            await storeResearchInVectorDB(validatedResult, {
                vehicleInfo: {
                    year: vehicle.year,
                    make: vehicle.make,
                    model: vehicle.model,
                    vin: vehicle.vin
                },
                serviceType: serviceRequest.serviceType,
                customerInfo: {
                    id: customer.id,
                    location: customer.location
                }
            });
        }

        // Return the research results
        res.json({
            success: true,
            result: validatedResult
        });

    } catch (error) {
        console.error('Service research error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            partialResults: Object.keys(parsedResults || {}).length > 0 ? parsedResults : undefined
        });
    }
});

// Detail research endpoint
router.post('/detail', async (req, res) => {
    const { vin, year, make, model, category, item, originalProblem } = req.body;

    try {
        const chatModel = new ChatOpenAI({
            modelName: 'o3-mini',
            openAIApiKey: process.env.OPENAI_API_KEY,
            configuration: {
                timeout: 60000, // 60 second timeout
                maxRetries: 3,
                retryDelay: 1000,
            },
        });

        const detailPrompt = PromptTemplate.fromTemplate(`
You are an expert automotive technician providing detailed information about a specific aspect of a vehicle problem.
Your response must be a valid JSON object matching the specified schema. Do not include markdown formatting or code blocks.
Your assessment should be helpful to the already seasoned technician so the information needs to be in depth and detailed. Not just the basics.

Vehicle Information:
Year: {year}
Make: {make}
Model: {model}
VIN: {vin}

Original Problem: {originalProblem}

Category: {category}
Item Details: {itemDetails}

Provide an in-depth analysis of this specific item. Include:
1. A clear title for this specific item.
2. Detailed description explaining the core concepts.
3. Additional steps or considerations where applicable.
4. Any important warnings or safety considerations.
5. Expert tips and best practices.
6. Related issues or complications to watch for.
7. Estimated time for this specific item.
8. Required expertise level.
9. Additional resources or references.
10. Parts information including part numbers, any special details on installation, and any other relevant information.

The response must be a valid JSON object with this exact structure:
{{
    "title": "string",
    "category": "string",
    "detailedDescription": "string",
    "additionalSteps": ["string"],
    "warnings": ["string"],
    "expertTips": ["string"],
    "relatedIssues": ["string"],
    "estimatedTime": "string",
    "requiredExpertise": "string",
    "parts": [
        {{
            "partNumber": "string",
            "installationDetails": "string"
        }}
    ],
    "additionalResources": [
        {{
            "title": "string",
            "url": "string",
            "description": "string"
        }}
    ],
    "parts": [
        {{
            "partNumber": "string",
            "installationDetails": "string"
        }}
    ]
}}

Focus on providing deep, technical insights specific to this make/model while maintaining safety and manufacturer guidelines.
`);

        const chain = RunnableSequence.from([
            detailPrompt,
            chatModel,
            new StringOutputParser()
        ]);

        console.log('Invoking LLM with data:', {
            year,
            make,
            model,
            vin,
            originalProblem,
            category,
            itemDetails: JSON.stringify(item)
        });

        let result;
        try {
            // Add timeout handling
            result = await Promise.race([
                chain.invoke({
                    year,
                    make,
                    model,
                    vin,
                    originalProblem,
                    category,
                    itemDetails: JSON.stringify(item)
                }),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('LLM request timed out after 60 seconds')), 60000)
                )
            ]);
            console.log('Raw LLM response:', result);
        } catch (chainError) {
            console.error('Error in chain execution:', chainError);
            if (chainError.message.includes('timed out')) {
                return res.status(504).json({
                    success: false,
                    error: 'Request timed out. The model is taking longer than expected to respond. Please try again.',
                    details: process.env.NODE_ENV === 'development' ? chainError.message : undefined
                });
            }
            throw new Error(`Chain execution failed: ${chainError.message}`);
        }

        if (!result) {
            console.error('Empty response received from LLM');
            throw new Error('Empty response from LLM');
        }

        if (typeof result !== 'string') {
            console.error('Unexpected response type:', typeof result);
            console.error('Response:', result);
            throw new Error(`Unexpected response type: ${typeof result}`);
        }

        // Clean up the response by removing markdown code block syntax if present
        const cleanedContent = result
            .replace(/```json\n?/g, '')
            .replace(/```\n?/g, '')
            .trim();

        console.log('Cleaned content:', cleanedContent);

        // Try to find JSON object in the response if it's not already JSON
        let jsonStr = cleanedContent;
        if (!jsonStr.trim().startsWith('{')) {
            const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                console.error('No JSON found in cleaned content');
                throw new Error('No JSON found in response');
            }
            jsonStr = jsonMatch[0];
        }

        try {
            const parsedResult = JSON.parse(jsonStr);
            console.log('Parsed result:', parsedResult);
            
            // Ensure all required fields are present with default values
            const defaultResult = {
                title: '',
                category: category || '',
                detailedDescription: '',
                additionalSteps: [],
                warnings: [],
                expertTips: [],
                relatedIssues: [],
                estimatedTime: '',
                requiredExpertise: '',
                additionalResources: [],
                parts: []
            };

            // Merge parsed result with defaults
            const mergedResult = { ...defaultResult, ...parsedResult };
            console.log('Merged result:', mergedResult);

            // Ensure arrays are properly formatted
            if (mergedResult.additionalSteps) {
                mergedResult.additionalSteps = mergedResult.additionalSteps.map(step => 
                    typeof step === 'object' ? JSON.stringify(step) : step
                );
            }

            // Ensure additionalResources have descriptions
            if (mergedResult.additionalResources) {
                mergedResult.additionalResources = mergedResult.additionalResources.map(resource => ({
                    title: resource.title || '',
                    url: resource.url || '',
                    description: resource.description || resource.title || 'No description provided'
                }));
            }

            const validatedResult = DetailedResearchSchema.parse(mergedResult);
            
            // Store in vector database
            await storeResearchInVectorDB(validatedResult, {
                vehicleInfo: {
                    year,
                    make,
                    model,
                    vin
                },
                category,
                itemType: 'detail',
                originalProblem
            });

            return res.status(200).json({ 
                success: true, 
                result: validatedResult 
            });
        } catch (parseError) {
            console.error('Error parsing or validating response:', parseError);
            console.error('Raw response:', jsonStr);
            return res.status(500).json({ 
                success: false,
                error: 'Failed to parse or validate AI response',
                details: process.env.NODE_ENV === 'development' ? parseError.message : undefined,
                rawResponse: process.env.NODE_ENV === 'development' ? jsonStr : undefined
            });
        }
    } catch (error) {
        console.error('Detail research error:', error);
        return res.status(500).json({
            success: false,
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
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
            success: false,
            error: 'Failed to generate embeddings',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @swagger
 * /api/research/diagnostic-session:
 *   post:
 *     summary: Start a new interactive diagnostic session
 *     tags: [Interactive Diagnostic]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - vehicleInfo
 *               - symptoms
 *             properties:
 *               vehicleInfo:
 *                 type: object
 *                 properties:
 *                   year: 
 *                     type: number
 *                   make:
 *                     type: string
 *                   model:
 *                     type: string
 *                   vin:
 *                     type: string
 *               symptoms:
 *                 type: array
 *                 items:
 *                   type: string
 */
router.post('/diagnostic-session', async (req, res) => {
    try {
        const { vehicleInfo, symptoms } = req.body;
        
        // Generate session ID
        const sessionId = crypto.randomUUID();

        // Initialize diagnostic session with first step
        const chatModel = new ChatOpenAI({
            modelName: 'o3-mini',
            openAIApiKey: process.env.OPENAI_API_KEY,
            configuration: {
                timeout: 60000,
                maxRetries: 3
            }
        });

        const initialAnalysisPrompt = PromptTemplate.fromTemplate(`
You are an expert diagnostic technician. Based on the following vehicle information and symptoms,
determine the most logical first diagnostic step and potential causes.

Vehicle: {year} {make} {model}
Symptoms: {symptoms}

Analyze the symptoms and provide:
1. Initial possible causes ranked by probability
2. The most logical first diagnostic step with specific test points and expected values
3. Technical rationale for this diagnostic approach

Response should be in JSON format:
{{
    "possibleCauses": [
        {{
            "cause": string,
            "probability": number (0-1),
            "evidence": [string]
        }}
    ],
    "nextStep": {{
        "action": string,
        "testPoints": [string],
        "expectedValues": [string],
        "requiredTools": [string],
        "technicalRationale": string
    }}
}}
`);

        const initialAnalysis = await getLLMResponse(
            chatModel,
            initialAnalysisPrompt,
            {
                year: vehicleInfo.year,
                make: vehicleInfo.make,
                model: vehicleInfo.model,
                symptoms: symptoms.join(', ')
            }
        );

        // Create new diagnostic session
        const session = {
            sessionId,
            vehicleInfo,
            initialSymptoms: symptoms,
            currentStep: 1,
            stepHistory: [],
            currentDiagnosis: {
                possibleCauses: initialAnalysis.possibleCauses,
                eliminatedCauses: [],
                nextStepRationale: initialAnalysis.nextStep.technicalRationale
            },
            nextStep: initialAnalysis.nextStep
        };

        // Store session in database or cache
        await storeSession(session);

        res.json({
            success: true,
            sessionId,
            currentStep: session.currentStep,
            nextStep: session.nextStep,
            currentDiagnosis: session.currentDiagnosis
        });

    } catch (error) {
        console.error('Error starting diagnostic session:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/research/diagnostic-step:
 *   post:
 *     summary: Submit diagnostic step results and get next step
 *     tags: [Interactive Diagnostic]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sessionId
 *               - stepNumber
 *               - testResults
 */
router.post('/diagnostic-step', async (req, res) => {
    try {
        const { sessionId, stepNumber, testResults } = req.body;
        
        // Validate test results
        const validatedResults = TestResultSchema.parse({
            sessionId,
            stepNumber,
            testResults,
            timestamp: new Date().toISOString()
        });

        // Retrieve session
        const session = await getSession(sessionId);
        if (!session) {
            throw new Error('Session not found');
        }

        const chatModel = new ChatOpenAI({
            modelName: 'o3-mini',
            openAIApiKey: process.env.OPENAI_API_KEY,
            configuration: {
                timeout: 60000,
                maxRetries: 3
            }
        });

        const analysisPrompt = PromptTemplate.fromTemplate(`
You are an expert diagnostic technician analyzing test results and determining next steps.

Vehicle: {year} {make} {model}
Initial Symptoms: {symptoms}
Current Step: {stepNumber}
Test Results: {testResults}

Previous Diagnosis:
{previousDiagnosis}

Previous Step History:
{stepHistory}

Based on these results:
1. Update the probability of each possible cause
2. Eliminate any causes that can be ruled out
3. Determine the next most logical diagnostic step
4. Provide technical rationale for the next step

Response should be in JSON format:
{
    "resultAnalysis": string,
    "updatedCauses": [
        {
            "cause": string,
            "probability": number,
            "evidence": [string]
        }
    ],
    "eliminatedCauses": [string],
    "nextStep": {
        "action": string,
        "testPoints": [string],
        "expectedValues": [string],
        "requiredTools": [string],
        "technicalRationale": string
    }
}
`);

        const analysis = await getLLMResponse(
            chatModel,
            analysisPrompt,
            {
                year: session.vehicleInfo.year,
                make: session.vehicleInfo.make,
                model: session.vehicleInfo.model,
                symptoms: session.initialSymptoms.join(', '),
                stepNumber: stepNumber,
                testResults: JSON.stringify(testResults),
                previousDiagnosis: JSON.stringify(session.currentDiagnosis),
                stepHistory: JSON.stringify(session.stepHistory)
            }
        );

        // Update session with new information
        session.stepHistory.push({
            stepNumber,
            action: session.nextStep.action,
            results: testResults,
            timestamp: validatedResults.timestamp,
            analysis: analysis.resultAnalysis
        });

        session.currentStep += 1;
        session.currentDiagnosis = {
            possibleCauses: analysis.updatedCauses,
            eliminatedCauses: [...session.currentDiagnosis.eliminatedCauses, ...analysis.eliminatedCauses],
            nextStepRationale: analysis.nextStep.technicalRationale
        };
        session.nextStep = analysis.nextStep;

        // Store updated session
        await updateSession(session);

        res.json({
            success: true,
            sessionId,
            currentStep: session.currentStep,
            resultAnalysis: analysis.resultAnalysis,
            nextStep: session.nextStep,
            currentDiagnosis: session.currentDiagnosis,
            isDiagnosisComplete: analysis.updatedCauses.some(cause => cause.probability > 0.9)
        });

    } catch (error) {
        console.error('Error processing diagnostic step:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.post('/research', async (req, res) => {
    try {
        const { vehicleInfo, symptoms, sessionId } = req.body;

        // Check for existing session
        let session = sessionId ? await sessionManager.getSession(sessionId) : null;

        if (session) {
            // Update existing session
            session.currentStep++;
            await sessionManager.updateSession(session);
        } else {
            // Create new session
            session = {
                sessionId: crypto.randomUUID(),
                vehicleInfo,
                initialSymptoms: symptoms,
                currentStep: 1,
                currentDiagnosis: null,
                history: []
            };

            // Find similar past sessions
            const similarSessions = await sessionManager.findSimilarSessions(
                `${vehicleInfo.make} ${vehicleInfo.model} ${symptoms}`,
                3
            );

            // Use similar sessions to enhance initial assessment
            let additionalContext = '';
            if (similarSessions.length > 0) {
                additionalContext = `\nConsider these similar cases:\n${
                    similarSessions.map(s => 
                        `- ${s.session.vehicleInfo.make} ${s.session.vehicleInfo.model}: ${s.session.initialSymptoms} -> ${s.session.currentDiagnosis}`
                    ).join('\n')
                }`;
            }

            // Get initial assessment with enhanced context
            const initialAssessment = await getInitialAssessment(
                vehicleInfo,
                symptoms + additionalContext
            );

            session.currentDiagnosis = initialAssessment;
            session.history.push({
                step: 1,
                action: 'initial_assessment',
                result: initialAssessment
            });

            await sessionManager.storeSession(session);
        }

        res.json({
            sessionId: session.sessionId,
            currentStep: session.currentStep,
            diagnosis: session.currentDiagnosis,
            history: session.history
        });

    } catch (error) {
        console.error('Research endpoint error:', error);
        res.status(500).json({ error: error.message });
    }
});

export function initializeWebSocket(server) {
    // Use the shared Socket.IO instance
    if (sharedIo) {
        console.log('Using shared WebSocket server instance');
        
        // Add research-specific event handlers
        sharedIo.on('connection', (socket) => {
            console.log('Client connected to research service:', socket.id);

            socket.on('vector-search', async (data) => {
                try {
                    const { query, filters, limit } = data;
                    const results = await searchVectorStore(query, filters, limit);
                    socket.emit('vector-search-results', {
                        success: true,
                        results,
                        totalResults: results.length
                    });
                } catch (error) {
                    console.error('Real-time vector search error:', error);
                    socket.emit('vector-search-results', {
                        success: false,
                        error: error.message
                    });
                }
            });
        });

        return sharedIo;
    }

    console.error('Shared WebSocket server not initialized');
    return null;
}

export default router;
