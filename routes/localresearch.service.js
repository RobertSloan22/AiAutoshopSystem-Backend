import express from 'express';
import axios from 'axios';
import { z } from 'zod';

const router = express.Router();

// Define the service research schema
const ServiceResearchSchema = z.object({
    diagnosticSteps: z.array(z.object({
        step: z.string(),
        details: z.string(),
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
    }))
});

// Service research endpoint
router.post('/service', async (req, res) => {
    const { serviceRequest, vehicle, customer } = req.body;

    try {
        const llmServiceEndpoint = 'http://192.168.56.1:1234/v1/chat/completions'; // Adjust this if needed

        const llmResponse = await axios.post(llmServiceEndpoint, {
            model: 'llama-3.2-1b-instruct',  // Replace with your actual model name
            messages: [
                { role: "system", content: "You are an expert automotive technician. Provide a structured JSON response." },
                { role: "user", content: `Customer: ${customer.firstName} ${customer.lastName}\nVehicle: ${vehicle.year} ${vehicle.make} ${vehicle.model}\nVIN: ${vehicle.vin}\nIssue: ${serviceRequest.description}\nPriority: ${serviceRequest.priority}` }
            ],
            temperature: 0.2
        });

        // Extract JSON output from LLM response
        const llmOutput = llmResponse.data.choices[0]?.message?.content;

        // Validate response against schema
        const validatedResult = ServiceResearchSchema.parse(JSON.parse(llmOutput));

        res.json({ success: true, result: validatedResult });

    } catch (error) {
        console.error('Service research error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Detail research endpoint
router.post('/detail', async (req, res) => {
    const { vin, year, make, model, category, item, originalProblem } = req.body;

    try {
        const llmServiceEndpoint = 'http://192.168.56.1:1234/v1/chat/completions';

        const llmResponse = await axios.post(llmServiceEndpoint, {
            model: 'llama-3.2-1b-instruct',
            messages: [
                { role: "system", content: "You are a highly knowledgeable automotive expert. Provide detailed diagnostics in JSON format." },
                { role: "user", content: `Year: ${year}\nMake: ${make}\nModel: ${model}\nVIN: ${vin}\nOriginal Problem: ${originalProblem}\nCategory: ${category}\nItem Details: ${JSON.stringify(item)}` }
            ],
            temperature: 0.2
        });

        const llmOutput = llmResponse.data.choices[0]?.message?.content;
        const validatedResult = ServiceResearchSchema.parse(JSON.parse(llmOutput));

        res.json({ success: true, result: validatedResult });

    } catch (error) {
        console.error('Detail research error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;
