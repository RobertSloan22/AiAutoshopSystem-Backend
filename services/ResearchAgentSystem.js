// services/ResearchAgentSystem.js
import { ChatOpenAI } from '@langchain/openai';
import { StateGraph, Annotation } from '@langchain/langgraph';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { formatDocumentsAsString } from 'langchain/util/document';
import { z } from 'zod';
import axios from 'axios';
import dotenv from 'dotenv';
import { VectorService } from './VectorService.js';

dotenv.config();

// Define agent state schema
const ResearchState = z.object({
  originalQuestion: z.string(),
  decomposedQuestions: z.array(z.object({
    id: z.string(),
    question: z.string(),
    category: z.string(),
    completed: z.boolean().default(false),
    findings: z.string().optional(),
  })).optional(),
  vehicleFindings: z.string().optional(),
  complianceFindings: z.string().optional(),
  oemFindings: z.string().optional(),
  forumFindings: z.string().optional(),
  finalReport: z.string().optional(),
  isComplete: z.boolean().default(false),
});

// Initialize OpenAI chat model
const model = new ChatOpenAI({
  modelName: process.env.OPENAI_MODEL || 'gpt-4-turbo',
  temperature: 0.2,
});

// Question Decomposition Agent
const questionDecomposerTemplate = `You are an expert research coordinator.
Your task is to break down a complex automotive research question into specific sub-questions 
that can be independently investigated by specialized research agents.

Original question: {originalQuestion}

For each sub-question, categorize it into one of these areas:
- vehicle_systems: Technical questions about vehicle components and systems
- compliance: Regulatory, safety, and compliance-related questions
- oem_data: Manufacturer specifications and technical documentation
- community_forums: User experiences and community discussions

Return a JSON array with the following structure:
[
  {
    "id": "unique_id",
    "question": "specific sub-question",
    "category": "one of the categories above"
  }
]

Make sure each sub-question is focused, specific, and can be researched independently.
`;

// Vehicle Systems Research Agent
const vehicleSystemsTemplate = `You are a vehicle systems research expert specializing in 
automotive technology, components, and engineering principles.

Research the following question related to vehicle systems:
{subQuestion}

Use your knowledge of automotive systems, repair procedures, diagnostics, and technical specifications 
to provide a detailed analysis. Focus on:
- Specific technical details about the component or system
- Diagnostic procedures and common failure points
- Engineering principles and design considerations
- Repair techniques and troubleshooting steps

Provide a comprehensive response with specific technical details.
`;

// Compliance Research Agent
const complianceTemplate = `You are a compliance and regulatory research expert in the automotive industry.

Research the following question related to automotive compliance and regulations:
{subQuestion}

Focus on:
- Relevant safety regulations and compliance requirements
- Industry standards and certification processes
- Legal requirements and manufacturer obligations
- Recall information and safety bulletins
- Environmental regulations and emissions standards

Provide a detailed response with specific regulatory information, standards, and compliance details.
`;

// OEM Data Research Agent
const oemDataTemplate = `You are an OEM (Original Equipment Manufacturer) data specialist in the automotive industry.

Research the following question related to OEM specifications and documentation:
{subQuestion}

Focus on:
- Manufacturer-specific technical specifications
- Service bulletin information
- Warranty and recall details
- Engineering specifications and tolerances
- OEM recommended procedures and parts

Provide detailed information directly from manufacturer sources with specific part numbers, specifications, and procedures when applicable.
`;

// Forum and Community Research Agent
const forumDataTemplate = `You are a community insights researcher specializing in automotive user experiences.

Research the following question based on automotive community discussions and user reports:
{subQuestion}

Focus on:
- Common user experiences and reported issues
- DIY solutions and community-developed fixes
- Patterns in user complaints or praise
- Real-world reliability and performance reports
- User-documented modifications and enhancements

Synthesize information from automotive forums, social media, and owner communities to provide insights based on real-world experiences.
`;

// Final Response Synthesis Agent
const synthesisTemplate = `You are an automotive research synthesis expert.

Below are findings from different research specialists investigating various aspects of this question:
Original Question: {originalQuestion}

Vehicle Systems Research:
{vehicleFindings}

Compliance Research:
{complianceFindings}

OEM Data Research:
{oemFindings}

Community Forum Research:
{forumFindings}

Synthesize these findings into a comprehensive, well-organized report that:
1. Directly answers the original question
2. Integrates technical information with real-world experiences
3. Highlights agreements and contradictions between different sources
4. Provides actionable recommendations or next steps where appropriate
5. Acknowledges limitations or areas requiring further research

Your response should be authoritative, balanced, and accessible to someone with basic automotive knowledge.
`;

// Step 1: Question Decomposer Node
const questionDecomposer = async ({ originalQuestion }) => {
  try {
    const promptTemplate = new PromptTemplate({
      template: questionDecomposerTemplate,
      inputVariables: ['originalQuestion'],
    });

    const chain = promptTemplate.pipe(model).pipe(new StringOutputParser());
    const result = await chain.invoke({ originalQuestion });
    
    // Parse the result as JSON
    const decomposedQuestions = JSON.parse(result);
    
    return { decomposedQuestions };
  } catch (error) {
    console.error('Error in question decomposer:', error);
    throw error;
  }
};

// Step 2: Vehicle Systems Research Node
const vehicleSystemsResearcher = async ({ 
  decomposedQuestions, 
  originalQuestion 
}) => {
  try {
    // Filter questions for vehicle systems category
    const vehicleQuestions = decomposedQuestions.filter(
      q => q.category === 'vehicle_systems'
    );
    
    if (vehicleQuestions.length === 0) {
      return { vehicleFindings: "No vehicle systems research required for this query." };
    }

    let allFindings = '';
    
    // Research each vehicle question
    for (const question of vehicleQuestions) {
      const promptTemplate = new PromptTemplate({
        template: vehicleSystemsTemplate,
        inputVariables: ['subQuestion'],
      });
      
      const chain = promptTemplate.pipe(model).pipe(new StringOutputParser());
      const finding = await chain.invoke({ subQuestion: question.question });
      
      allFindings += `Question: ${question.question}\nFindings: ${finding}\n\n`;
      
      // Update the question in decomposedQuestions
      const index = decomposedQuestions.findIndex(q => q.id === question.id);
      if (index !== -1) {
        decomposedQuestions[index].completed = true;
        decomposedQuestions[index].findings = finding;
      }
    }
    
    return { 
      vehicleFindings: allFindings,
      decomposedQuestions 
    };
  } catch (error) {
    console.error('Error in vehicle systems researcher:', error);
    throw error;
  }
};

// Step 3: Compliance Research Node
const complianceResearcher = async ({ 
  decomposedQuestions, 
  originalQuestion 
}) => {
  try {
    // Filter questions for compliance category
    const complianceQuestions = decomposedQuestions.filter(
      q => q.category === 'compliance'
    );
    
    if (complianceQuestions.length === 0) {
      return { complianceFindings: "No compliance research required for this query." };
    }

    let allFindings = '';
    
    // Research each compliance question
    for (const question of complianceQuestions) {
      const promptTemplate = new PromptTemplate({
        template: complianceTemplate,
        inputVariables: ['subQuestion'],
      });
      
      const chain = promptTemplate.pipe(model).pipe(new StringOutputParser());
      const finding = await chain.invoke({ subQuestion: question.question });
      
      allFindings += `Question: ${question.question}\nFindings: ${finding}\n\n`;
      
      // Update the question in decomposedQuestions
      const index = decomposedQuestions.findIndex(q => q.id === question.id);
      if (index !== -1) {
        decomposedQuestions[index].completed = true;
        decomposedQuestions[index].findings = finding;
      }
    }
    
    return { 
      complianceFindings: allFindings,
      decomposedQuestions 
    };
  } catch (error) {
    console.error('Error in compliance researcher:', error);
    throw error;
  }
};

// Step 4: OEM Data Research Node
const oemDataResearcher = async ({ 
  decomposedQuestions, 
  originalQuestion 
}) => {
  try {
    // Filter questions for OEM data category
    const oemQuestions = decomposedQuestions.filter(
      q => q.category === 'oem_data'
    );
    
    if (oemQuestions.length === 0) {
      return { oemFindings: "No OEM data research required for this query." };
    }

    let allFindings = '';
    
    // Research each OEM question
    for (const question of oemQuestions) {
      const promptTemplate = new PromptTemplate({
        template: oemDataTemplate,
        inputVariables: ['subQuestion'],
      });
      
      const chain = promptTemplate.pipe(model).pipe(new StringOutputParser());
      const finding = await chain.invoke({ subQuestion: question.question });
      
      allFindings += `Question: ${question.question}\nFindings: ${finding}\n\n`;
      
      // Update the question in decomposedQuestions
      const index = decomposedQuestions.findIndex(q => q.id === question.id);
      if (index !== -1) {
        decomposedQuestions[index].completed = true;
        decomposedQuestions[index].findings = finding;
      }
    }
    
    return { 
      oemFindings: allFindings,
      decomposedQuestions 
    };
  } catch (error) {
    console.error('Error in OEM data researcher:', error);
    throw error;
  }
};

// Step 5: Forum Community Research Node
const forumResearcher = async ({ 
  decomposedQuestions, 
  originalQuestion 
}) => {
  try {
    // Filter questions for forum/community category
    const forumQuestions = decomposedQuestions.filter(
      q => q.category === 'community_forums'
    );
    
    if (forumQuestions.length === 0) {
      return { forumFindings: "No community forum research required for this query." };
    }

    let allFindings = '';
    
    // Research each forum question
    for (const question of forumQuestions) {
      const promptTemplate = new PromptTemplate({
        template: forumDataTemplate,
        inputVariables: ['subQuestion'],
      });
      
      const chain = promptTemplate.pipe(model).pipe(new StringOutputParser());
      const finding = await chain.invoke({ subQuestion: question.question });
      
      allFindings += `Question: ${question.question}\nFindings: ${finding}\n\n`;
      
      // Update the question in decomposedQuestions
      const index = decomposedQuestions.findIndex(q => q.id === question.id);
      if (index !== -1) {
        decomposedQuestions[index].completed = true;
        decomposedQuestions[index].findings = finding;
      }
    }
    
    return { 
      forumFindings: allFindings,
      decomposedQuestions 
    };
  } catch (error) {
    console.error('Error in forum researcher:', error);
    throw error;
  }
};

// Step 6: Synthesis Node
const responseSynthesizer = async ({ 
  originalQuestion,
  vehicleFindings,
  complianceFindings,
  oemFindings,
  forumFindings
}) => {
  try {
    const promptTemplate = new PromptTemplate({
      template: synthesisTemplate,
      inputVariables: [
        'originalQuestion',
        'vehicleFindings',
        'complianceFindings',
        'oemFindings',
        'forumFindings'
      ],
    });
    
    const chain = promptTemplate.pipe(model).pipe(new StringOutputParser());
    const finalReport = await chain.invoke({
      originalQuestion,
      vehicleFindings: vehicleFindings || "No vehicle systems research was conducted.",
      complianceFindings: complianceFindings || "No compliance research was conducted.",
      oemFindings: oemFindings || "No OEM data research was conducted.",
      forumFindings: forumFindings || "No community forum research was conducted."
    });
    
    return { 
      finalReport,
      isComplete: true
    };
  } catch (error) {
    console.error('Error in response synthesizer:', error);
    throw error;
  }
};

// Define the agent workflow graph
export async function createResearchAgentSystem() {
  // Create a state graph with the research state schema
  const ResearchStateAnnotation = Annotation.Root({
    originalQuestion: Annotation.String({
      default: () => "",
    }),
    decomposedQuestions: Annotation.Array({
      default: () => [],
    }),
    vehicleFindings: Annotation.String({
      default: () => "",
    }),
    complianceFindings: Annotation.String({
      default: () => "",
    }),
    oemFindings: Annotation.String({
      default: () => "",
    }),
    forumFindings: Annotation.String({
      default: () => "",
    }),
    finalReport: Annotation.String({
      default: () => "",
    }),
    isComplete: Annotation.Boolean({
      default: () => false,
    })
  });

  // Create a state graph with the research state schema
  const workflow = new StateGraph(ResearchStateAnnotation);

  // Add nodes to the graph
  workflow.addNode("questionDecomposer", questionDecomposer);
  workflow.addNode("vehicleSystemsResearcher", vehicleSystemsResearcher);
  workflow.addNode("complianceResearcher", complianceResearcher);
  workflow.addNode("oemDataResearcher", oemDataResearcher);
  workflow.addNode("forumResearcher", forumResearcher);
  workflow.addNode("responseSynthesizer", responseSynthesizer);

  // Add edges to the graph
  workflow.addEdge("__start__", "questionDecomposer");
  workflow.addEdge("questionDecomposer", "vehicleSystemsResearcher");
  workflow.addEdge("questionDecomposer", "complianceResearcher");
  workflow.addEdge("questionDecomposer", "oemDataResearcher");
  workflow.addEdge("questionDecomposer", "forumResearcher");
  workflow.addEdge("vehicleSystemsResearcher", "responseSynthesizer");
  workflow.addEdge("complianceResearcher", "responseSynthesizer");
  workflow.addEdge("oemDataResearcher", "responseSynthesizer");
  workflow.addEdge("forumResearcher", "responseSynthesizer");

  // Compile the graph into a runnable
  return workflow.compile();
}

// Function to run the research workflow
export async function runResearchWorkflow(question) {
  try {
    // Create the research agent system
    const researchWorkflow = await createResearchAgentSystem();
    
    // Initial state with the original question
    const initialState = {
      originalQuestion: question,
      isComplete: false
    };
    
    // Execute the workflow
    const finalState = await researchWorkflow.invoke(initialState);
    
    // Return the final result
    return {
      originalQuestion: question,
      finalReport: finalState.finalReport,
      decomposedQuestions: finalState.decomposedQuestions,
      vehicleFindings: finalState.vehicleFindings,
      complianceFindings: finalState.complianceFindings,
      oemFindings: finalState.oemFindings,
      forumFindings: finalState.forumFindings,
    };
  } catch (error) {
    console.error('Error running research workflow:', error);
    throw error;
  }
}

// Export a simplified function for use in routes
export const ResearchAgentSystem = {
  runResearch: runResearchWorkflow
}; 