import { Agent, webSearchTool } from '@openai/agents';
import { z } from 'zod';

// ---- Planner Agent ----

const plannerPrompt = `You are a helpful research assistant specializing in automotive repair and diagnostics.
Given a query, come up with a set of web searches to perform to best answer the query.
Focus on automotive-specific sources, technical specifications, repair procedures, and diagnostic information.
Output between 5 and 20 terms to query for.`;

export const webSearchItem = z.object({
  reason: z
    .string()
    .describe('Your reasoning for why this search is important to the automotive query.'),
  query: z.string().describe('The search term to use for the web search.'),
});

export const webSearchPlan = z.object({
  searches: z
    .array(webSearchItem)
    .describe('A list of web searches to perform to best answer the automotive query.'),
});

export const plannerAgent = new Agent({
  name: 'AutomotivePlannerAgent',
  instructions: plannerPrompt,
  model: 'gpt-4o-mini',
  outputType: webSearchPlan,
});

// ---- Search Agent ----

const searchAgentInstructions = `You are an automotive research assistant.
Given a search term, you search the web for that term and produce a concise summary of the results.
Focus on automotive repair information, technical specifications, diagnostic procedures, and parts information.
The summary must be 2-3 paragraphs and less than 300 words. Capture the main points relevant to automotive repair.
Write succinctly, prioritizing actionable repair information and technical details.
This will be consumed by an automotive technician or shop owner, so focus on practical information.
Do not include any additional commentary other than the summary itself.`;

export const searchAgent = new Agent({
  name: 'AutomotiveSearchAgent',
  instructions: searchAgentInstructions,
  tools: [webSearchTool()],
  modelSettings: { toolChoice: 'required' },
});

// ---- Writer Agent ----
const writerPrompt = `You are a senior automotive technician and researcher tasked with writing a comprehensive diagnostic and repair report.
You will be provided with the original automotive query, and research done by automotive specialists.
You should first come up with an outline for the report that describes:
1. Problem identification and diagnosis
2. Technical specifications and requirements
3. Repair procedures and recommendations
4. Parts and tools needed
5. Safety considerations
6. Cost estimates where applicable

Then, generate the report and return that as your final output.
The final output should be in markdown format, and should be detailed and actionable for automotive repair shops.
Aim for 5-10 pages of content, at least 1000 words, focusing on practical repair information.`;

export const reportData = z.object({
  shortSummary: z
    .string()
    .describe('A short 2-3 sentence summary of the automotive issue and recommended solution.'),
  markdownReport: z.string().describe('The comprehensive automotive repair report'),
  followUpQuestions: z
    .array(z.string())
    .describe('Suggested follow-up questions for further automotive research'),
});

export const writerAgent = new Agent({
  name: 'AutomotiveWriterAgent',
  instructions: writerPrompt,
  model: 'gpt-4o-mini',
  outputType: reportData,
});