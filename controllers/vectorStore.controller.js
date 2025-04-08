import OpenAI from 'openai';
import config from '../config/config.js';

// Debug logging for configuration
console.log('OpenAI API Key configured:', !!config.openai.apiKey);

if (!config.openai.apiKey) {
  throw new Error('OpenAI API key is not configured. Please check your environment variables.');
}

const openai = new OpenAI({
  apiKey: config.openai.apiKey
});

// Store data in OpenAI vector store
export const storeData = async (req, res) => {
  try {
    const { researchData, vehicleInfo, problem } = req.body;
    
    // Format the data into a single text for embedding
    const textToEmbed = `
      Research: ${JSON.stringify(researchData)}
      Vehicle: ${JSON.stringify(vehicleInfo)}
      Problem: ${problem}
    `.trim();

    console.log('Generating embedding for text:', textToEmbed.substring(0, 100) + '...');

    // Generate embedding
    const embedding = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: textToEmbed
    });

    console.log('Successfully generated embedding');

    // Store in OpenAI vector store
    const vectorStore = await openai.beta.vector_stores.create({
      name: "vehicle_research_store"
    });

    const { id: vectorStoreId } = vectorStore;

    await openai.beta.vector_stores.files.upload(
      vectorStoreId,
      {
        content: textToEmbed,
        embedding: embedding.data[0].embedding,
        metadata: { researchData, vehicleInfo, problem }
      }
    );

    console.log('Successfully stored in OpenAI vector store');
    res.json({ success: true, message: 'Data stored successfully in OpenAI vector store' });
  } catch (error) {
    console.error('Vector store error:', error);
    res.status(500).json({
      error: error.message,
      details: error.toString(),
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Query OpenAI vector store
export const queryData = async (req, res) => {
  try {
    const { query, limit = 5 } = req.body;

    console.log('Generating embedding for query:', query);

    // Generate query embedding
    const embedding = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query
    });

    console.log('Successfully generated query embedding');

    // Search OpenAI vector store
    const searchResults = await openai.beta.vector_stores.search({
      vectorStoreName: "vehicle_research_store",
      queryEmbedding: embedding.data[0].embedding,
      matchThreshold: 0.7,
      matchCount: limit
    });

    console.log(`Found ${searchResults.length} matches`);
    res.json({ results: searchResults });
  } catch (error) {
    console.error('Vector store query error:', error);
    res.status(500).json({
      error: error.message,
      details: error.toString(),
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};
