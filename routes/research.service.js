import express from 'express';
import axios from 'axios';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { z } from 'zod';

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

// Helper function to query parts availability using the Bing Web Search API
async function getPartsAvailability(partName, location = 'local') {
    try {
        const subscriptionKey = process.env.BING_SEARCH_API_KEY;
        if (!subscriptionKey) {
            throw new Error('BING_SEARCH_API_KEY is not set in environment variables');
        }
        const endpoint = 'https://api.bing.microsoft.com/v7.0/search';
        const query = `${partName} automotive parts supplier ${location}`;
        const response = await axios.get(endpoint, {
            params: { q: query, textDecorations: true, textFormat: 'HTML' },
            headers: { 'Ocp-Apim-Subscription-Key': subscriptionKey }
        });
        // Process response to extract basic supplier info.
        const results = response.data.webPages && response.data.webPages.value 
            ? response.data.webPages.value.map(item => ({
                part: partName,
                supplier: item.name,
                availability: 'Check website', // Placeholder – actual availability would require further parsing
                cost: 'Check website',         // Placeholder – pricing info is usually not in the search snippet
                url: item.url
            }))
            : [];
        return results;
    } catch (error) {
        console.error(`Error fetching parts availability for ${partName}:`, error.message);
        return [];
    }
}

// Service research endpoint
router.post('/service', async (req, res) => {
    const { serviceRequest, vehicle, customer } = req.body;
    try {
        // Initialize LangChain components
        const model = new ChatOpenAI({
            modelName: 'gpt-4-turbo-preview',
            temperature: 0.2
        });

        // Updated research prompt with additional diagnostic details and parts availability section
        const researchPrompt = PromptTemplate.fromTemplate(`
You are an expert automotive technician and service advisor. Analyze the following service request and provide a detailed response in JSON format.

Customer Information:
Name: {customerName}
Vehicle: {vehicleYear} {vehicleMake} {vehicleModel}
VIN: {vin}

Service Request:
Type: {serviceType}
Description: {description}
Priority: {priority}
Additional Notes: {additionalNotes}

For each diagnostic step, include:
1. Clear step-by-step instructions.
2. List of components to be tested.
3. Detailed testing procedure (how and where to perform the test).
4. Specific tools and equipment needed.
5. Expected readings or measurements with acceptable ranges.
6. Common pitfalls or mistakes to avoid.
7. Safety precautions specific to this step.
8. Time estimates for completion.
9. Required skill level.
10. Alternative methods if applicable.

For possible causes, include:
1. Detailed explanation of each cause.
2. Symptoms associated with each cause.
3. Frequency of occurrence in this specific model.
4. Related systems that may be affected.
5. Diagnostic indicators specific to each cause.
6. Pricing for the parts and labor to fix the problem.
7. Estimated time to fix the problem.
8. Estimated cost to fix the problem.

For recommended fixes, include:
1. Step-by-step repair procedures.
2. What to test for at each step.
3. What readings to expect.
4. Required parts with OEM and aftermarket options.
5. Specialized tools needed.
6. Labor time estimates.
7. Technical skill requirements.
8. Safety precautions.
9. Quality control checks after repair.
10. Break-in or adaptation procedures if needed.

Additionally, include a new section **partsAvailability** that lists, for each part mentioned in the recommended fixes:
- Part name.
- Supplier name.
- Availability status (e.g., In stock, Out of stock, Limited).
- Cost (as displayed on the supplier website).
- URL to the supplier's website (if available).

Include all relevant technical details, cost estimates, and manufacturer-specific information.

Response must be valid JSON matching this structure:
{schema}

Focus on how to start the diagnosis, what to look for, which components to check, what tools to use, what readings should be expected, and manufacturer-specific guidelines.
Split the diagnosis into steps and provide a step-by-step guide for each step.
Do not be overly generic; be specific and detailed.
Include all relevant technical details and cost estimates.
        `);

        // Create the chain
        const chain = RunnableSequence.from([
            researchPrompt,
            model,
            new StringOutputParser()
        ]);

        // Run the chain
        const result = await chain.invoke({
            customerName: `${customer.firstName} ${customer.lastName}`,
            vehicleYear: vehicle.year,
            vehicleMake: vehicle.make,
            vehicleModel: vehicle.model,
            vin: vehicle.vin,
            serviceType: serviceRequest.serviceType,
            description: serviceRequest.description,
            priority: serviceRequest.priority,
            additionalNotes: serviceRequest.additionalNotes,
            schema: JSON.stringify(ServiceResearchSchema.shape, null, 2)
        });

        // Parse and validate the result
        let parsedResult = JSON.parse(result);
        // Validate initial output
        let validatedResult = ServiceResearchSchema.parse(parsedResult);

        // --- Parts Availability Integration ---
        // Aggregate parts from recommended fixes (if any)
        const partsSet = new Set();
        if (validatedResult.recommendedFixes) {
            validatedResult.recommendedFixes.forEach(fix => {
                if (fix.parts) {
                    fix.parts.forEach(part => partsSet.add(part));
                }
            });
        }

        // Use customer location if available, otherwise default to 'local'
        const location = customer.location || 'local';

        // For each unique part, get availability details via web search
        const partsArray = Array.from(partsSet);
        const partsPromises = partsArray.map(partName => getPartsAvailability(partName, location));
        const partsResultsArrays = await Promise.all(partsPromises);
        // Flatten the array of arrays into a single array
        const partsAvailability = partsResultsArrays.flat();

        // Attach partsAvailability if any results were found
        if (partsAvailability.length > 0) {
            validatedResult.partsAvailability = partsAvailability;
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
            error: error.message
        });
    }
});

// Detail research endpoint (unchanged)
router.post('/detail', async (req, res) => {
    const { vin, year, make, model, category, item, originalProblem } = req.body;

    try {
        // Initialize LangChain components
        const model = new ChatOpenAI({
            modelName: 'gpt-4-turbo-preview',
            temperature: 0.2
        });

        // Create the detail research prompt
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

The response must be a valid JSON object with this exact structure (no additional formatting or markdown):
{schema}

Focus on providing deep, technical insights specific to this make/model while maintaining safety and manufacturer guidelines.
        `);

        // Create the chain
        const chain = RunnableSequence.from([
            detailPrompt,
            model,
            new StringOutputParser()
        ]);

        // Run the chain
        const result = await chain.invoke({
            year,
            make,
            model,
            vin,
            originalProblem,
            category,
            itemDetails: JSON.stringify(item),
            schema: JSON.stringify(DetailedResearchSchema.shape, null, 2)
        });

        // Clean the result string to ensure it's valid JSON
        const cleanResult = result.trim().replace(/^```json\s*|\s*```$/g, '');
        
        // Parse and validate the result
        const parsedResult = JSON.parse(cleanResult);
        const validatedResult = DetailedResearchSchema.parse(parsedResult);

        // Return the detailed research results
        res.json({
            success: true,
            result: validatedResult
        });

    } catch (error) {
        console.error('Detail research error:', error);
        if (error instanceof SyntaxError) {
            console.error('Raw response:', result);
        }
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;
