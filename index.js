// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const { OpenAI } = require('langchain/llms/openai');
const { PromptTemplate } = require('langchain/prompts');
const { LLMChain } = require('langchain/chains');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.post('/api/research', async (req, res) => {
  const { vin, year, make, model, problem } = req.body;
  if (!vin || !year || !make || !model || !problem) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  try {
    // Create a prompt template with vehicle details and problem description
    const prompt = new PromptTemplate({
      inputVariables: ['vin', 'year', 'make', 'model', 'problem'],
      template: 
`You are an expert automotive repair advisor with access to comprehensive technical information.
Using your expertise, research the following vehicle problem and provide a detailed analysis, including:
- Possible causes
- Recommended diagnostic steps
- Potential fixes or parts that may need to be checked/replaced

Vehicle Details:
VIN: {vin}
Year: {year}
Make: {make}
Model: {model}

Problem Description: {problem}

Please provide your analysis in clear, actionable steps.`,
    });

    // Initialize the OpenAI LLM with the API key from environment variables
    const llm = new OpenAI({
      temperature: 0,
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    // Create an LLM chain with the prompt and llm
    const chain = new LLMChain({ llm, prompt });

    // Run the chain with the provided input values
    const response = await chain.call({
      vin,
      year,
      make,
      model,
      problem,
    });

    return res.status(200).json({ result: response.text });
  } catch (error) {
    console.error('Error processing request:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
