import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import config from '../config/config.js';

// Debug logging for configuration
console.log('Supabase URL:', config.supabase.url);
console.log('OpenAI API Key configured:', !!config.openai.apiKey);

if (!config.supabase.url) {
  throw new Error('Supabase URL is not configured. Please check your environment variables.');
}

if (!config.supabase.serviceKey) {
  throw new Error('Supabase service key is not configured. Please check your environment variables.');
}

const openai = new OpenAI({
  apiKey: config.openai.apiKey
});

const supabase = createClient(
  config.supabase.url,
  config.supabase.serviceKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    },
    global: {
      headers: {
        'Authorization': `Bearer ${config.supabase.serviceKey}`,
        'apikey': config.supabase.serviceKey,
        'jwt_secret': process.env.JWT_SECRET
      }
    }
  }
);

// Store data in vector store
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

    // Store in Supabase
    const { data, error } = await supabase
      .from('vector_store')
      .insert([
        {
          content: textToEmbed,
          embedding: embedding.data[0].embedding,
          metadata: {
            researchData,
            vehicleInfo,
            problem
          }
        }
      ]);

    if (error) {
      console.error('Supabase insert error:', error);
      throw error;
    }

    console.log('Successfully stored in Supabase');
    res.json({ success: true, data });
  } catch (error) {
    console.error('Vector store error:', error);
    res.status(500).json({ 
      error: error.message,
      details: error.toString(),
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Query vector store
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

    // Search vector store using cosine similarity
    const { data: searchResults, error } = await supabase
      .rpc('match_documents', {
        query_embedding: embedding.data[0].embedding,
        match_threshold: 0.7, // Adjust this threshold as needed
        match_count: limit
      });

    if (error) {
      console.error('Supabase search error:', error);
      throw error;
    }

    console.log(`Found ${searchResults?.length || 0} matches`);
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

// Test connections
export const testConnections = async (req, res) => {
  try {
    console.log('Testing OpenAI connection...');
    // Test OpenAI connection
    const embeddingTest = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: "test"
    });
    console.log('OpenAI connection successful');

    console.log('Testing Supabase connection...');
    // Test Supabase connection
    const { data: supabaseTest, error: supabaseError } = await supabase
      .from('vector_store')
      .select('id')
      .limit(1);

    if (supabaseError) {
      console.error('Supabase connection error:', supabaseError);
      throw supabaseError;
    }
    console.log('Supabase connection successful');

    res.json({ 
      success: true,
      openaiStatus: 'connected',
      supabaseStatus: 'connected',
      supabaseUrl: config.supabase.url
    });
  } catch (error) {
    console.error('Connection test error:', error);
    res.status(500).json({ 
      error: error.message,
      details: error.toString(),
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      openaiStatus: error.message.includes('OpenAI') ? 'error' : 'unknown',
      supabaseStatus: error.message.includes('supabase') ? 'error' : 'unknown',
      supabaseUrl: config.supabase.url
    });
  }
}; 