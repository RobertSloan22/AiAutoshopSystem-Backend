// routes/research.service.simple.js - Simplified research service without expensive vectorization
// import dotenv
import dotenv from 'dotenv';
dotenv.config();

// 
import express from 'express';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { z } from 'zod';
import PartsRetriever from '../parts.service.js';
import crypto from 'crypto';
import OpenAI from 'openai';

const router = express.Router();
const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Simple in-memory session storage (replace with database in production)
const sessions = new Map();

// Keep the same schemas for consistent API responses
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

// Simplified session management without vector storage
class SimpleSessionManager {
    storeSession(session) {
        sessions.set(session.sessionId, {
            ...session,
            lastAccessed: Date.now()
        });
        return Promise.resolve();
    }

    getSession(sessionId) {
        const session = sessions.get(sessionId);
        if (session) {
            session.lastAccessed = Date.now();
            return Promise.resolve(session);
        }
        return Promise.resolve(null);
    }

    updateSession(session) {
        return this.storeSession(session);
    }

    // Simple similarity search using string matching instead of vectors
    findSimilarSessions(query, limit = 3) {
        const queryLower = query.toLowerCase();
        const allSessions = Array.from(sessions.values());
        
        const scored = allSessions
            .map(session => {
                const sessionText = `${session.vehicleInfo?.make} ${session.vehicleInfo?.model} ${session.initialSymptoms?.join(' ')}`.toLowerCase();
                const words = queryLower.split(' ');
                let score = 0;
                
                words.forEach(word => {
                    if (sessionText.includes(word)) {
                        score++;
                    }
                });
                
                return { session, score };
            })
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
            
        return Promise.resolve(scored);
    }

    // Cleanup old sessions (call periodically)
    cleanup() {
        const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
        for (const [sessionId, session] of sessions.entries()) {
            if (session.lastAccessed < cutoff) {
                sessions.delete(sessionId);
            }
        }
    }
}

const sessionManager = new SimpleSessionManager();

// Cleanup old sessions every hour
setInterval(() => {
    sessionManager.cleanup();
}, 60 * 60 * 1000);

// Helper function to get parts availability (kept from original)
async function getPartsAvailability(partName, vehicle, location = 'local') {
    try {
        const partsRetriever = new PartsRetriever();
        const searchResults = await partsRetriever.searchParts(partName, vehicle);
        
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

// Simplified LLM helper without vector operations
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
            
            // Remove markdown code blocks
            jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
            
            // Find JSON object in the response
            if (!jsonStr.trim().startsWith('{')) {
                const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
                if (!jsonMatch) {
                    throw new Error('No JSON found in response');
                }
                jsonStr = jsonMatch[0];
            }

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

// Simplified search function (no vector operations)
async function simpleSearch(query, filters = {}, limit = 5) {
    // Simple keyword-based search through stored sessions
    const queryLower = query.toLowerCase();
    const results = [];
    
    for (const [sessionId, session] of sessions.entries()) {
        if (results.length >= limit) break;
        
        // Simple text matching
        const sessionText = JSON.stringify(session).toLowerCase();
        if (sessionText.includes(queryLower)) {
            // Check filters
            let matches = true;
            for (const [key, value] of Object.entries(filters)) {
                if (key.includes('.')) {
                    const [parent, child] = key.split('.');
                    if (!session[parent] || session[parent][child] !== value) {
                        matches = false;
                        break;
                    }
                } else if (session[key] !== value) {
                    matches = false;
                    break;
                }
            }
            
            if (matches) {
                results.push({
                    content: sessionText,
                    metadata: {
                        sessionId,
                        vehicleInfo: session.vehicleInfo,
                        type: 'session_data',
                        timestamp: new Date(session.lastAccessed).toISOString()
                    },
                    score: 1.0
                });
            }
        }
    }
    
    return results;
}

// Simplified search endpoint (no vector operations)
router.post('/vector-search', async (req, res) => {
    try {
        const { query, filters = {}, limit = 5 } = req.body;

        if (!query) {
            return res.status(400).json({
                success: false,
                error: 'Query is required'
            });
        }

        const results = await simpleSearch(query, filters, limit);

        const processedResults = results.map(result => {
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
        console.error('Search error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Main service research endpoint (simplified, no vector storage)
router.post('/service', async (req, res) => {
    const { serviceRequest, vehicle, customer } = req.body;
    let parsedResults = {};
    
    try {
        // Use a more cost-effective model
        const chatModel = new ChatOpenAI({
            modelName: 'gpt-4o-mini', // More cost-effective than o3-mini
            openAIApiKey: process.env.OPENAI_API_KEY,
            configuration: {
                timeout: 60000,
                maxRetries: 3,
                retryDelay: 1000,
            },
        });

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

        // Combine all prompts into a single comprehensive request to reduce API calls
        const comprehensivePrompt = PromptTemplate.fromTemplate(`
You are an expert automotive technician with extensive experience diagnosing issues on {vehicleMake} {vehicleModel} vehicles.
Provide a comprehensive technical diagnostic assessment focused specifically on this exact vehicle and problem.

Vehicle Information:
Year: {vehicleYear} Make: {vehicleMake} Model: {vehicleModel}
VIN: {vin}

Service Request:
Type: {serviceType}
Description: {description}
Priority: {priority}
Additional Notes: {additionalNotes}

Provide a complete diagnostic and repair analysis in JSON format with:
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
    ],
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
    ],
    "technicalNotes": {{
        "commonIssues": [string],
        "serviceIntervals": [string],
        "recalls": [string],
        "tsbs": [string],
        "manufacturerSpecificInfo": string
    }}
}}
`);

        console.log('Starting comprehensive analysis...');
        const comprehensiveResult = await getLLMResponse(chatModel, comprehensivePrompt, baseData);
        
        // Format into final schema
        const formattedResult = {
            diagnosticSteps: comprehensiveResult.diagnosticProcedures 
                ? comprehensiveResult.diagnosticProcedures.map(proc => ({
                    step: proc.procedure,
                    details: Array.isArray(proc.testingSteps) ? proc.testingSteps.join('\n') : proc.testingSteps || '',
                    componentsTested: proc.components || [],
                    testingProcedure: Array.isArray(proc.testingSteps) ? proc.testingSteps.join('\n') : proc.testingSteps || '',
                    tools: proc.requiredTools || [],
                    expectedReadings: proc.expectedReadings || '',
                    normalRanges: proc.normalValueRange || '',
                    componentLocation: proc.componentLocation || '',
                    circuitDiagram: proc.circuitDiagramReference || '',
                    componentPartNumbers: proc.componentPartNumbers || []
                }))
                : [],
            possibleCauses: comprehensiveResult.possibleCauses || [],
            recommendedFixes: comprehensiveResult.repairSolutions 
                ? comprehensiveResult.repairSolutions.map(solution => ({
                    fix: solution.solution,
                    technicalRequirements: solution.technicalRequirements || '',
                    parts: solution.parts || [],
                    oemPartNumbers: solution.oemPartNumbers || [],
                    torqueSpecifications: solution.torqueSpecifications || '',
                    clearanceSpecifications: solution.clearanceSpecifications || '',
                    calibrationProcedures: solution.calibrationProcedures || '',
                    specialTools: solution.specialTools || [],
                    technicalProcedure: solution.technicalProcedure || [],
                    serviceManualReference: solution.serviceManualReference || '',
                    componentLocation: solution.componentLocation || '',
                    removalSteps: solution.removalSteps || [],
                    installationSteps: solution.installationSteps || [],
                    testingSpecifications: solution.testingSpecifications || '',
                    programmingRequirements: solution.programmingRequirements || ''
                }))
                : [],
            technicalNotes: comprehensiveResult.technicalNotes || {
                commonIssues: [],
                serviceIntervals: [],
                recalls: [],
                tsbs: [],
                manufacturerSpecificInfo: ''
            },
            references: [] // Can be populated if needed
        };

        // Validate the formatted result
        let validatedResult;
        try {
            validatedResult = ServiceResearchSchema.parse(formattedResult);
        } catch (validationError) {
            console.error('Schema validation error:', validationError);
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
                
                const partsAvailability = [];
                for (const partName of partsArray.slice(0, 3)) { // Limit to 3 parts to reduce API calls
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

        // Store in simple session storage (no vector operations)
        const sessionId = crypto.randomUUID();
        await sessionManager.storeSession({
            sessionId,
            vehicleInfo: vehicle,
            serviceRequest,
            customer,
            researchResult: validatedResult,
            timestamp: new Date().toISOString()
        });

        res.json({
            success: true,
            result: validatedResult,
            sessionId
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

// Detail research endpoint (simplified)
router.post('/detail', async (req, res) => {
    const { vin, year, make, model, category, item, originalProblem } = req.body;

    try {
        const chatModel = new ChatOpenAI({
            modelName: 'gpt-4o-mini', // More cost-effective
            openAIApiKey: process.env.OPENAI_API_KEY,
            configuration: {
                timeout: 60000,
                maxRetries: 3,
                retryDelay: 1000,
            },
        });

        const detailPrompt = PromptTemplate.fromTemplate(`
You are an expert automotive technician providing detailed information about a specific aspect of a vehicle problem.
Your response must be a valid JSON object matching the specified schema.

Vehicle Information:
Year: {year}
Make: {make}
Model: {model}
VIN: {vin}

Original Problem: {originalProblem}
Category: {category}
Item Details: {itemDetails}

Provide an in-depth analysis of this specific item in JSON format:
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
    "additionalResources": [
        {{
            "title": "string",
            "url": "string",
            "description": "string"
        }}
    ]
}}
`);

        const result = await getLLMResponse(chatModel, detailPrompt, {
            year,
            make,
            model,
            vin,
            originalProblem,
            category,
            itemDetails: JSON.stringify(item)
        });

        // Ensure all required fields are present
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
            additionalResources: []
        };

        const mergedResult = { ...defaultResult, ...result };

        // Ensure additionalResources have descriptions
        if (mergedResult.additionalResources) {
            mergedResult.additionalResources = mergedResult.additionalResources.map(resource => ({
                title: resource.title || '',
                url: resource.url || '',
                description: resource.description || resource.title || 'No description provided'
            }));
        }

        const validatedResult = DetailedResearchSchema.parse(mergedResult);
        
        // Store in simple session storage
        const sessionId = crypto.randomUUID();
        await sessionManager.storeSession({
            sessionId,
            vehicleInfo: { year, make, model, vin },
            category,
            itemType: 'detail',
            originalProblem,
            detailResult: validatedResult,
            timestamp: new Date().toISOString()
        });

        return res.status(200).json({ 
            success: true, 
            result: validatedResult,
            sessionId
        });

    } catch (error) {
        console.error('Detail research error:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Simplified diagnostic session endpoints
router.post('/diagnostic-session', async (req, res) => {
    try {
        const { vehicleInfo, symptoms } = req.body;
        const sessionId = crypto.randomUUID();

        const chatModel = new ChatOpenAI({
            modelName: 'gpt-4o-mini',
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

Response should be in JSON format:
{{
    "possibleCauses": [
        {{
            "cause": string,
            "probability": number,
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

        await sessionManager.storeSession(session);

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

router.post('/diagnostic-step', async (req, res) => {
    try {
        const { sessionId, stepNumber, testResults } = req.body;
        
        const validatedResults = TestResultSchema.parse({
            sessionId,
            stepNumber,
            testResults,
            timestamp: new Date().toISOString()
        });

        const session = await sessionManager.getSession(sessionId);
        if (!session) {
            throw new Error('Session not found');
        }

        const chatModel = new ChatOpenAI({
            modelName: 'gpt-4o-mini',
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

Based on these results, provide analysis in JSON format:
{{
    "resultAnalysis": string,
    "updatedCauses": [
        {{
            "cause": string,
            "probability": number,
            "evidence": [string]
        }}
    ],
    "eliminatedCauses": [string],
    "nextStep": {{
        "action": string,
        "testPoints": [string],
        "expectedValues": [string],
        "requiredTools": [string],
        "technicalRationale": string
    }}
}}
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
                testResults: JSON.stringify(testResults)
            }
        );

        // Update session
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

        await sessionManager.updateSession(session);

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

// Simple research endpoint
router.post('/research', async (req, res) => {
    try {
        const { vehicleInfo, symptoms, sessionId } = req.body;

        let session = sessionId ? await sessionManager.getSession(sessionId) : null;

        if (session) {
            session.currentStep++;
            await sessionManager.updateSession(session);
        } else {
            session = {
                sessionId: crypto.randomUUID(),
                vehicleInfo,
                initialSymptoms: symptoms,
                currentStep: 1,
                currentDiagnosis: null,
                history: []
            };

            // Simple similarity search instead of vector operations
            const similarSessions = await sessionManager.findSimilarSessions(
                `${vehicleInfo.make} ${vehicleInfo.model} ${symptoms}`,
                3
            );

            let additionalContext = '';
            if (similarSessions.length > 0) {
                additionalContext = `\nConsider these similar cases:\n${
                    similarSessions.map(s => 
                        `- ${s.session.vehicleInfo.make} ${s.session.vehicleInfo.model}: ${s.session.initialSymptoms} -> ${s.session.currentDiagnosis}`
                    ).join('\n')
                }`;
            }

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

// Remove embeddings endpoint (not needed without vectors)
// Remove WebSocket initialization (simplified service)

export default router;