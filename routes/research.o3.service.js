import express from 'express';
import { OpenAI } from 'openai';
import { z } from 'zod';
import PartsRetriever from '../parts.service.js';

const router = express.Router();

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Reuse the same schemas from research.service.js
const ServiceResearchSchema = z.object({
    diagnosticSteps: z.array(z.object({
        step: z.string(),
        details: z.string(),
        componentsTested: z.array(z.string()).optional(),
        testingProcedure: z.string().optional(),
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

// Helper function to make O3-mini API requests
async function getO3Response(prompt, retries = 3, delay = 1000) {
    let lastError;
    
    for (let i = 0; i < retries; i++) {
        try {
            const response = await openai.responses.create({
                model: "o3-mini",
                input: [
                    {
                        role: "user",
                        content: prompt,
                    },
                ],
            });

            if (!response.output_text) {
                throw new Error('Empty response from O3-mini');
            }

            // Clean and prepare the response
            let jsonStr = response.output_text;
            
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
            console.error(`O3-mini request attempt ${i + 1} failed:`, error);
            
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
    let parsedResults = {};

    try {
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
        const initialAssessmentPrompt = `
You are an expert automotive technician. Provide an initial assessment for this service request.
Focus on basic problem analysis, initial diagnostic steps, and safety considerations.

Vehicle Information:
Year: ${baseData.vehicleYear} Make: ${baseData.vehicleMake} Model: ${baseData.vehicleModel}
VIN: ${baseData.vin}

Service Request:
Type: ${baseData.serviceType}
Description: ${baseData.description}
Priority: ${baseData.priority}
Additional Notes: ${baseData.additionalNotes}

Provide response in JSON format with:
{
    "initialAssessment": {
        "problemAnalysis": string,
        "safetyConsiderations": [string],
        "initialSteps": [
            {
                "step": string,
                "purpose": string,
                "safetyNotes": string
            }
        ]
    }
}`;

        // 2. Technical Analysis Prompt
        const technicalAnalysisPrompt = `
As an expert technician, provide detailed diagnostic procedures for this issue.
Focus on specific tests, measurements, and component checks.

Vehicle Information:
Year: ${baseData.vehicleYear} Make: ${baseData.vehicleMake} Model: ${baseData.vehicleModel}
VIN: ${baseData.vin}

Issue Description: ${baseData.description}

IMPORTANT: All arrays must contain properly formatted strings. For testingSteps, provide each step as a complete string without numbering.

Provide response in JSON format with:
{
    "diagnosticProcedures": [
        {
            "procedure": string,
            "components": [string],
            "testingSteps": [string],
            "requiredTools": [string],
            "expectedReadings": string
        }
    ]
}`;

        // 3. Repair Solutions Prompt
        const repairSolutionsPrompt = `
Based on the diagnostic information, provide possible causes and repair solutions.
Focus on specific repair procedures and parts requirements.

Vehicle Information:
Year: ${baseData.vehicleYear} Make: ${baseData.vehicleMake} Model: ${baseData.vehicleModel}
Issue: ${baseData.description}

Provide response in JSON format with:
{
    "possibleCauses": [
        {
            "cause": string,
            "likelihood": string,
            "explanation": string
        }
    ],
    "repairSolutions": [
        {
            "solution": string,
            "difficulty": string,
            "parts": [string],
            "estimatedCost": string,
            "laborHours": string
        }
    ]
}`;

        // 4. Technical Information Prompt
        const technicalInfoPrompt = `
Provide relevant technical information, service bulletins, and recalls for this vehicle and issue.

Vehicle Information:
Year: ${baseData.vehicleYear} Make: ${baseData.vehicleMake} Model: ${baseData.vehicleModel}
VIN: ${baseData.vin}
Issue: ${baseData.description}

Provide response in JSON format with:
{
    "technicalNotes": {
        "commonIssues": [string],
        "serviceIntervals": [string],
        "recalls": [string],
        "tsbs": [string]
    }
}`;

        // Process each step sequentially with error handling
        try {
            // 1. Initial Assessment
            console.log('Starting initial assessment...');
            const initialAssessment = await getO3Response(initialAssessmentPrompt);
            parsedResults.initialAssessment = initialAssessment;
            console.log('Initial assessment completed');

            // 2. Technical Analysis
            console.log('Starting technical analysis...');
            const technicalAnalysis = await getO3Response(technicalAnalysisPrompt);
            parsedResults.diagnosticProcedures = technicalAnalysis.diagnosticProcedures;
            console.log('Technical analysis completed');

            // 3. Repair Solutions
            console.log('Starting repair solutions analysis...');
            const repairSolutions = await getO3Response(repairSolutionsPrompt);
            const repairData = repairSolutions;
            parsedResults.possibleCauses = repairData.possibleCauses;
            parsedResults.repairSolutions = repairData.repairSolutions;
            console.log('Repair solutions completed');

            // 4. Technical Information
            console.log('Starting technical information gathering...');
            const technicalInfo = await getO3Response(technicalInfoPrompt);
            parsedResults.technicalNotes = technicalInfo.technicalNotes;
            console.log('Technical information completed');
        } catch (error) {
            console.error('Error during research steps:', error);
            if (Object.keys(parsedResults).length === 0) {
                throw error;
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
            references: []
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
        const detailPrompt = `
You are an expert automotive technician providing detailed information about a specific aspect of a vehicle problem.
Your response must be a valid JSON object matching the specified schema. Do not include markdown formatting or code blocks.

Vehicle Information:
Year: ${year}
Make: ${make}
Model: ${model}
VIN: ${vin}

Original Problem: ${originalProblem}

Category: ${category}
Item Details: ${JSON.stringify(item)}

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
{
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
        {
            "title": "string",
            "url": "string",
            "description": "string"
        }
    ]
}`;

        console.log('Invoking O3-mini with data:', {
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
            result = await getO3Response(detailPrompt);
            console.log('Parsed result:', result);
            
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
            const mergedResult = { ...defaultResult, ...result };
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
            return res.status(500).json({ 
                success: false,
                error: 'Failed to parse or validate AI response',
                details: process.env.NODE_ENV === 'development' ? parseError.message : undefined
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
        const response = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: req.body.input,
        });

        res.json(response);
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