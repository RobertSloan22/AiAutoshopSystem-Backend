import express from 'express';
import axios from 'axios';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { z } from 'zod';
import { OpenAI } from '@langchain/openai';
import PartsRetriever from '../parts.service.js';

const router = express.Router();

// Updated Service Research Schema with new diagnostic details and partsAvailability section
const ServiceResearchSchema = z.object({
    diagnosticSteps: z.array(z.object({
        step: z.string(),
        details: z.string(),
        componentsTested: z.array(z.string()).optional(),      // New field: list of components to test
        testingProcedure: z.string().optional(),               // New field: detailed testing procedure
        tools: z.array(z.string()).optional(),
        expectedReadings: z.string().optional(),
        notes: z.string().optional()
    })),
    possibleCauses: z.array(z.object({
        cause: z.string(),
        likelihood: z.string(),
        explanation: z.string()
    })),
    recommendedFixes: z.array(z.object({
        fix: z.string(),
        difficulty: z.string(),
        estimatedCost: z.string(),
        professionalOnly: z.boolean().optional(),
        parts: z.array(z.string()).optional()
    })),
    technicalNotes: z.object({
        commonIssues: z.array(z.string()),
        serviceIntervals: z.array(z.string()).optional(),
        recalls: z.array(z.string()).optional(),
        tsbs: z.array(z.string()).optional()
    }),
    references: z.array(z.object({
        source: z.string(),
        url: z.string().optional(),
        type: z.string(),
        relevance: z.string()
    })),
    partsAvailability: z.array(z.object({
        part: z.string(),
        supplier: z.string(),
        availability: z.string(),
        cost: z.string(),
        url: z.string().optional()
    })).optional()
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

// Service research endpoint
router.post('/service', async (req, res) => {
    const { serviceRequest, vehicle, customer } = req.body;
    let parsedResults = {};  // Declare parsedResults at the top level
    try {
        // Initialize LangChain components
        const chatModel = new ChatOpenAI({
            modelName: 'gpt-4o-mini',
            temperature: 0.2,
            openAIApiKey: process.env.OPENAI_API_KEY,
            configuration: {
                timeout: 60000, // 60 second timeout
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

        // 1. Initial Diagnostic Assessment
        const initialAssessmentPrompt = PromptTemplate.fromTemplate(`
You are an expert automotive technician. Provide an initial assessment for this service request.
Focus on basic problem analysis, initial diagnostic steps, and safety considerations.

Vehicle Information:
Year: {vehicleYear} Make: {vehicleMake} Model: {vehicleModel}
VIN: {vin}

Service Request:
Type: {serviceType}
Description: {description}
Priority: {priority}
Additional Notes: {additionalNotes}

Provide response in JSON format with:
{{
    "initialAssessment": {{
        "problemAnalysis": string,
        "safetyConsiderations": [string],
        "initialSteps": [
            {{
                "step": string,
                "purpose": string,
                "safetyNotes": string
            }}
        ]
    }}
}}
`);

        // 2. Technical Analysis Prompt
        const technicalAnalysisPrompt = PromptTemplate.fromTemplate(`
As an expert technician, provide detailed diagnostic procedures for this issue.
Focus on specific tests, measurements, and component checks.

Vehicle Information:
Year: {vehicleYear} Make: {vehicleMake} Model: {vehicleModel}
VIN: {vin}

Issue Description: {description}

IMPORTANT: All arrays must contain properly formatted strings. For testingSteps, provide each step as a complete string without numbering.

Provide response in JSON format with:
{{
    "diagnosticProcedures": [
        {{
            "procedure": string,
            "components": [string],
            "testingSteps": [string],
            "requiredTools": [string],
            "expectedReadings": string
        }}
    ]
}}

Example format for testingSteps:
"testingSteps": [
    "Connect the diagnostic tool to the OBD port",
    "Start the engine and let it idle",
    "Record the sensor readings"
]
`);

        // 3. Repair Solutions Prompt
        const repairSolutionsPrompt = PromptTemplate.fromTemplate(`
Based on the diagnostic information, provide possible causes and repair solutions.
Focus on specific repair procedures and parts requirements.

Vehicle Information:
Year: {vehicleYear} Make: {vehicleMake} Model: {vehicleModel}
Issue: {description}

Provide response in JSON format with:
{{
    "possibleCauses": [
        {{
            "cause": string,
            "likelihood": string,
            "explanation": string
        }}
    ],
    "repairSolutions": [
        {{
            "solution": string,
            "difficulty": string,
            "parts": [string],
            "estimatedCost": string,
            "laborHours": string
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

        // Format into final schema with fallbacks for missing data
        const formattedResult = {
            diagnosticSteps: parsedResults.diagnosticProcedures 
                ? parsedResults.diagnosticProcedures.map(proc => ({
                    step: proc.procedure,
                    details: Array.isArray(proc.testingSteps) ? proc.testingSteps.join('\n') : proc.testingSteps || '',
                    componentsTested: proc.components || [],
                    testingProcedure: Array.isArray(proc.testingSteps) ? proc.testingSteps.join('\n') : proc.testingSteps || '',
                    tools: proc.requiredTools || [],
                    expectedReadings: proc.expectedReadings || ''
                }))
                : [],
            possibleCauses: parsedResults.possibleCauses || [],
            recommendedFixes: parsedResults.repairSolutions 
                ? parsedResults.repairSolutions.map(solution => ({
                    fix: solution.solution,
                    difficulty: solution.difficulty,
                    estimatedCost: solution.estimatedCost || 'Unknown',
                    professionalOnly: solution.difficulty === 'Complex',
                    parts: solution.parts || []
                }))
                : [],
            technicalNotes: parsedResults.technicalNotes || {
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
            modelName: 'gpt-4-turbo-preview',
            temperature: 0.2,
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
    "additionalResources": [
        {{
            "title": "string",
            "url": "string",
            "description": "string"
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
                additionalResources: []
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
            success: false,
            error: 'Failed to generate embeddings',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

export default router;
