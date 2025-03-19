import OpenAI from 'openai';
import config from '../config/config.js';

const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

// Get embeddings for a single text
export const getSingleEmbedding = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const embedding = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text
    });
    res.json({ embedding: embedding.data[0].embedding });
  } catch (error) {
    console.error('Error getting embedding:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get embeddings for multiple texts
export const getBatchEmbeddings = async (req, res) => {
  try {
    const { texts } = req.body;
    if (!texts || !Array.isArray(texts)) {
      return res.status(400).json({ error: 'Array of texts is required' });
    }

    const embedding = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: texts
    });
    res.json({ embeddings: embedding.data.map(e => e.embedding) });
  } catch (error) {
    console.error('Error getting embeddings:', error);
    res.status(500).json({ error: error.message });
  }
}; 