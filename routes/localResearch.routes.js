import express from 'express';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { HumanMessage } from "@langchain/core/messages";
import { initializeAgentExecutorWithOptions } from "langchain/agents";

const router = express.Router();

// Initialize the agent tools and model
const agentTools = [new TavilySearchResults({ maxResults: 3 })];

const agentModel = new ChatOpenAI({
  modelName: 'hermes-3-llama-3.2-3b',
  temperature: 0.2,
  openAIApiKey: null,
  configuration: {
    baseURL: 'http://192.168.56.1:1234/v1',
  },
});

let agentExecutor = null;

// Initialize the agent executor
const initializeAgent = async () => {
  agentExecutor = await initializeAgentExecutorWithOptions(
    agentTools,
    agentModel,
    {
      agentType: "openai-functions",
      verbose: true
    }
  );
};

// Initialize the agent when the module loads
initializeAgent().catch(console.error);

/**
 * POST /api/research
 *
 * Expects a JSON body containing:
 *  - vin: Vehicle Identification Number
 *  - year: Vehicle year
 *  - make: Vehicle make
 *  - model: Vehicle model
 *  - problem: Description of the vehicle problem
 *
 * Returns:
 *  - { result: string } on success, containing the research analysis
 *  - { error: string } on failure
 */
router.post('/', async (req, res) => {
  if (!agentExecutor) {
    return res.status(500).json({ error: 'Agent not initialized yet' });
  }
  
  const { vin, year, make, model, problem } = req.body;

  if (!vin || !year || !make || !model || !problem) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  try {
    // First, use the agent to gather relevant information
    const searchQuery = `${year} ${make} ${model} ${problem} common issues technical service bulletins recalls`;
    const agentResult = await agentExecutor.invoke({
      input: searchQuery
    });

    const searchContext = agentResult.output;

    const prompt = new PromptTemplate({
      template: `You are an expert automotive technician with access to extensive vehicle diagnostic databases and technical manuals.
Here is some relevant research information found:
{searchContext}

Analyze the following vehicle problem and provide a detailed response in JSON format structured as follows:

{{
  "diagnosticSteps": [
    {{"step": "string", "details": "string", "tools": ["string"], "multimeter testing": ["string"], "expectedReadings": "string", "obdCodes": ["string"], "visualInspection": "string", "notes": "string"}}
  ],
  "possibleCauses": [
    {{"cause": "string", "likelihood": "High|Medium|Low", "explanation": "string", "vehicleSpecific": "string"}}
  ],
  "recommendedFixes": [
    {{"fix": "string", "difficulty": "Easy|Moderate|Complex", "estimatedCost": "string", "professionalOnly": boolean, "parts": ["string"], "toolsRequired": ["string"], "repairProcedure": "string"}}
  ],
  "technicalNotes": {{"commonIssues": ["string"], "serviceIntervals": ["string"], "recalls": ["string"], "tsbs": ["string"]}},
  "references": [
    {{"source": "string", "url": "string", "type": "TSB|Manual|Forum|Recall", "relevance": "string"}}
  ]
}}

Vehicle Details:
VIN: {vin}
Year: {year}
Make: {make}
Model: {model}

Problem Description: {problem}

Ensure to include all relevant technical details, common failure points, manufacturer-specific guidelines, and any other professional information necessary to perform accurate diagnostics and repairs. Include applicable TSBs, recalls, and service bulletins.`,
      inputVariables: ['vin', 'year', 'make', 'model', 'problem', 'searchContext'],
    });

    const chain = RunnableSequence.from([prompt, agentModel]);

    const result = await chain.invoke({ 
      vin, 
      year, 
      make, 
      model, 
      problem,
      searchContext 
    });

    const messageContent = result?.content || result?.choices?.[0]?.message?.content;

    try {
      const parsedResult = JSON.parse(messageContent);
      return res.status(200).json({ result: parsedResult });
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      const jsonMatch = messageContent?.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const extractedJson = JSON.parse(jsonMatch[0]);
          return res.status(200).json({ result: extractedJson });
        } catch (extractError) {
          console.error('Failed to parse extracted JSON:', extractError);
        }
      }
      return res.status(500).json({ error: 'Failed to parse AI response into valid JSON' });
    }
  } catch (error) {
    console.error('Error processing research request:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
