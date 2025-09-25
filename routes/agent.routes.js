import express from 'express';
import OpenAI from 'openai';
import dotenv from 'dotenv';
// fetch is global in Node 18+

dotenv.config();

const router = express.Router();
const openai = new OpenAI();

const imagesModel = process.env.IMAGES_MODEL || "O4-mini";

// Image generation function for the realtime agent
async function generateImage({
  prompt,
  size = "1024x1024",
  quality = "standard",
  n = 1
}) {
  const result = await openai.images.generate({
    model: imagesModel,
    prompt,
    size,
    quality,
    n,
    response_format: "b64_json"
  });

  const data = result.data?.[0];
  if (!data) throw new Error("Images API returned no data");
  if (data.b64_json) return `data:image/png;base64,${data.b64_json}`;
  if (data.url) return data.url;
  throw new Error("Images API returned neither b64_json nor url");
}

// Web search function for the realtime agent
const searchWeb = async (query, maxResults = 5) => {
  try {
    // Using Brave Search API (free tier: 2000 queries/month)
    const response = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${maxResults}`, {
      headers: {
        'X-Subscription-Token': process.env.BRAVE_API_KEY || 'demo', // Use demo for testing
        'Accept': 'application/json'
      },
      timeout: 10000
    });
    
    if (!response.ok) {
      throw new Error(`Search API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.web?.results?.map(result => ({
      title: result.title,
      url: result.url,
      description: result.description,
      published_time: result.published_time
    })) || [];
  } catch (error) {
    console.error('Web search error:', error);
    return [{ error: 'Search temporarily unavailable' }];
  }
};

// Function definitions for the realtime agent
const REALTIME_FUNCTIONS = [
  {
    name: 'search_web',
    description: 'Search the web for current information, news, or answers to questions',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query to find relevant information'
        },
        max_results: {
          type: 'integer',
          description: 'Maximum number of search results to return (1-10)',
          default: 5
        }
      },
      required: ['query']
    }
  },
  {
    name: 'search_automotive',
    description: 'Search for automotive-specific information like repair guides, part specifications, or diagnostic procedures',
    parameters: {
      type: 'object', 
      properties: {
        query: {
          type: 'string',
          description: 'Automotive search query (e.g., "2019 Honda Civic brake pad replacement")'
        },
        category: {
          type: 'string',
          enum: ['repair', 'parts', 'diagnostics', 'maintenance', 'recalls'],
          description: 'Category of automotive information to focus on'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'generate_image',
    description: 'Generate an image from a text prompt using OpenAI\'s DALL-E',
    parameters: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'Text description of the image to generate'
        },
        size: {
          type: 'string',
          enum: ['256x256', '512x512', '1024x1024'],
          default: '1024x1024',
          description: 'Size of the generated image'
        },
        quality: {
          type: 'string',
          enum: ['standard', 'hd'],
          default: 'standard',
          description: 'Quality of the generated image'
        }
      },
      required: ['prompt']
    }
  }
];



  // Session route - GET /api/session (with function calling support)
  router.get('/api/session', async (req, res) => {
    try {
      const response = await fetch(
        "https://api.openai.com/v1/realtime/sessions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            "Content-Type": "application/json",
            "OpenAI-Beta": "realtime=v1"
          },
          body: JSON.stringify({
            model: "gpt-realtime",
            instructions: "You are an AI automotive assistant with web search and image generation capabilities. You can search for current information, repair guides, part specifications, and diagnostic procedures. You can also generate images from text descriptions to help visualize automotive concepts, parts, or diagrams. When users ask questions that require current information or specific automotive data, use the search functions. When they need visual representations or diagrams, use the image generation function to provide accurate, helpful visuals.",
            tools: REALTIME_FUNCTIONS.map(func => ({ type: 'function', function: func })),
            tool_choice: 'auto'
          }),
          signal: AbortSignal.timeout(10000) // 10s timeout
        }
      );
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Error in /session:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // Responses route - POST /api/responses
  router.post('/api/responses', async (req, res) => {
    const body = req.body;

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    try {
      if (body.text?.format?.type === 'json_schema') {
        const response = await openai.responses.parse({
          ...body,
          stream: false,
        });
        res.json(response);
      } else {
        const response = await openai.responses.create({
          ...body,
          stream: false,
        });
        res.json(response);
      }
    } catch (err) {
      console.error('responses proxy error', err);
      res.status(500).json({ error: 'failed' });
    }
  });

router.post('/realtime/sessions', async (req, res) => {
  try {
    let sdp = req.body.sdp || req.body;
    if (!sdp || typeof sdp !== 'string') {
      sdp = '';
      req.setEncoding('utf8');
      req.on('data', chunk => { sdp += chunk; });
      await new Promise(resolve => req.on('end', resolve));
    }
    if (!sdp) {
      return res.status(400).json({ error: 'No SDP provided in request body' });
    }

    const response = await fetch(
      `https://api.openai.com/v1/realtime?model=gpt-realtime`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/sdp",
          "OpenAI-Beta": "realtime=v1"
        },
        body: sdp,
        signal: AbortSignal.timeout(15000) // 15s timeout for SDP exchange
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      return res.status(500).json({ error: errorText });
    }

    const answerSdp = await response.text();
    if (!answerSdp) {
      return res.status(500).json({ error: 'No SDP received from OpenAI' });
    }

    // Return the SDP as JSON, not plain text!
    res.json({ sdp: answerSdp });
  } catch (error) {
    console.error("Error in POST /realtime/sessions:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// POST route for chat completions (with security limits)
router.post('/chat/completions', async (req, res) => {
  try {
    const { model, messages } = req.body;
    
    // Security: only allow specific models
    const ALLOWED_MODELS = new Set(["gpt-4o", "gpt-4o-mini", "gpt-realtime"]);
    if (!ALLOWED_MODELS.has(model)) {
      return res.status(400).json({ error: "model_not_allowed" });
    }

    const completion = await openai.chat.completions.create({
      model,
      messages,
      max_tokens: 800, // Limit token usage
      timeout: 30000 // 30s timeout
    });

    res.json(completion);
  } catch (error) {
    console.error("Error in /chat/completions:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST route for realtime sessions
router.post('/realtime', async (req, res) => {
  try {
    const { model, sdp } = req.body;
    
    if (!sdp) {
      throw new Error('No SDP provided in request body');
    }

    console.log('Sending SDP to OpenAI:', sdp);
    
    const response = await fetch(
      `https://api.openai.com/v1/realtime?model=${model || "gpt-realtime"}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/sdp",
          "OpenAI-Beta": "realtime=v1"
        },
        body: sdp,
        signal: AbortSignal.timeout(15000) // 15s timeout for SDP exchange
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API responded with status: ${response.status}. ${errorText}`);
    }

    const answerSdp = await response.text();
    console.log('Received SDP from OpenAI:', answerSdp);
    
    res.json({ sdp: answerSdp });
  } catch (error) {
    console.error("Error in /realtime:", error);
    res.status(500).json({ 
      error: error.message,
      details: error.response?.data || error.stack
    });
  }
});

// GET route for realtime sessions (single, clean implementation)
router.get('/realtime/sessions', async (req, res) => {
  try {
    const response = await fetch(
      "https://api.openai.com/v1/realtime/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
          "OpenAI-Beta": "realtime=v1"
        },
        body: JSON.stringify({
          model: "gpt-realtime",
        }),
        signal: AbortSignal.timeout(10000) // 10s timeout
      }
    );
    
    if (!response.ok) {
      throw new Error(`OpenAI API responded with status: ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Error in GET /realtime/sessions:", error);
    if (error.name === 'TimeoutError') {
      res.status(504).json({ error: "Request timeout" });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Create an assistant with code interpreter and file search capabilities
router.post('/assistant/create', async (req, res) => {
  try {
    const { 
      name = "AI Autoshop Assistant",
      instructions = "You are a helpful automotive diagnostic assistant with code interpreter and file search capabilities.",
      model = "gpt-4o-mini"
    } = req.body;

    const assistant = await openai.beta.assistants.create({
      name,
      instructions,
      model,
      tools: [
        { type: "code_interpreter" },
        { type: "file_search" }
      ]
    });

    res.json(assistant);
  } catch (error) {
    console.error("Error creating assistant:", error);
    res.status(500).json({ error: error.message });
  }
});

// Create a thread and run with the assistant
router.post('/assistant/chat', async (req, res) => {
  try {
    const { assistant_id, message, thread_id } = req.body;

    let threadId = thread_id;

    // Create a new thread if one doesn't exist
    if (!threadId) {
      const thread = await openai.beta.threads.create();
      threadId = thread.id;
    }

    // Add the user message to the thread
    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: message
    });

    // Create a run
    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: assistant_id
    });

    // Poll for completion
    let runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
    
    while (runStatus.status !== 'completed' && runStatus.status !== 'failed') {
      await new Promise(resolve => setTimeout(resolve, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
      
      // Handle required actions (tool calls)
      if (runStatus.status === 'requires_action') {
        // For now, we'll just wait for the action to be handled
        // In a real implementation, you'd handle tool outputs here
      }
    }

    // Get the messages
    const messages = await openai.beta.threads.messages.list(threadId);

    res.json({
      thread_id: threadId,
      messages: messages.data,
      run_status: runStatus.status
    });
  } catch (error) {
    console.error("Error in assistant chat:", error);
    res.status(500).json({ error: error.message });
  }
});

// Add image analysis route (using modern Responses API)
router.post('/analyze-image', async (req, res) => {
  try {
    const { image, context, sessionId } = req.body;
    
    if (!image) {
      return res.status(400).json({ error: 'No image provided' });
    }

    // Use modern Responses API with correct payload format
    const response = await openai.responses.create({
      model: 'gpt-4o',
      input: [{
        role: 'user',
        content: [
          { 
            type: 'input_text', 
            text: context || 'Analyze this automotive image and describe notable components, defects, and safety issues.'
          },
          {
            type: 'input_image',
            image_url: `data:image/jpeg;base64,${image}`
          }
        ]
      }],
      max_tokens: 1000,
      timeout: 30000 // 30s timeout
    });

    res.json({
      analysis: response.output_text,
      sessionId,
      usage: response.usage
    });
  } catch (error) {
    console.error("Error in image analysis:", error);
    if (error.name === 'TimeoutError') {
      res.status(504).json({ error: "Analysis timeout" });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Add Realtime image message creation route (for WebRTC data channel)
router.post('/realtime/image-message', async (req, res) => {
  try {
    const { image, context, sessionId } = req.body;
    
    if (!image) {
      return res.status(400).json({ error: 'No image provided' });
    }

    // Create properly formatted Realtime message payload
    const messagePayload = {
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [
          { 
            type: "input_text", 
            text: context || "Analyze this automotive image and describe what you see in detail."
          },
          {
            type: "input_image",
            image_url: `data:image/jpeg;base64,${image}`
          }
        ]
      }
    };

    res.json({
      messagePayload,
      sessionId,
      followUp: { type: "response.create" }
    });
  } catch (error) {
    console.error("Error creating realtime image message:", error);
    res.status(500).json({ error: error.message });
  }
});

// Direct image generation endpoint
router.post('/images/generate', async (req, res) => {
  try {
    const { prompt, size = "1024x1024", quality = "standard" } = req.body || {};
    
    if (!prompt) {
      return res.status(400).json({ error: "prompt is required" });
    }

    const imageDataUrl = await generateImage({ prompt, size, quality });
    
    res.json({
      prompt,
      size,
      quality,
      image_data_url: imageDataUrl
    });
  } catch (error) {
    console.error("Error in /images/generate:", error);
    res.status(500).json({ error: error.message });
  }
});

// Web search endpoint for direct API calls
router.post('/search', async (req, res) => {
  try {
    const { query, max_results = 5, category } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    let searchQuery = query;
    if (category) {
      // Enhance query with automotive context
      const categoryPrefixes = {
        repair: 'automotive repair guide',
        parts: 'car parts specifications',
        diagnostics: 'vehicle diagnostic procedure',
        maintenance: 'car maintenance schedule',
        recalls: 'vehicle recall information'
      };
      searchQuery = `${categoryPrefixes[category]} ${query}`;
    }

    const results = await searchWeb(searchQuery, max_results);
    
    res.json({
      query: searchQuery,
      results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Search endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Function calling handler for realtime sessions
router.post('/function-call', async (req, res) => {
  try {
    const { function_name, arguments: funcArgs, call_id } = req.body;
    
    let result;
    
    switch (function_name) {
      case 'search_web':
        result = await searchWeb(funcArgs.query, funcArgs.max_results);
        break;
        
      case 'search_automotive':
        let autoQuery = funcArgs.query;
        if (funcArgs.category) {
          const categoryPrefixes = {
            repair: 'automotive repair guide',
            parts: 'car parts specifications OEM',
            diagnostics: 'vehicle diagnostic DTC trouble code',
            maintenance: 'car maintenance schedule intervals',
            recalls: 'NHTSA vehicle recall safety'
          };
          autoQuery = `${categoryPrefixes[funcArgs.category]} ${funcArgs.query}`;
        }
        result = await searchWeb(autoQuery, 5);
        break;
        
      case 'generate_image':
        const { prompt, size, quality } = funcArgs || {};
        const imageDataUrl = await generateImage({ prompt, size, quality });
        result = {
          image_data_url: imageDataUrl,
          prompt,
          size: size || '1024x1024',
          quality: quality || 'standard'
        };
        break;
        
      default:
        result = { error: `Unknown function: ${function_name}` };
    }
    
    res.json({
      call_id,
      function_name,
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Function call error:', error);
    res.status(500).json({ 
      call_id: req.body.call_id,
      error: error.message 
    });
  }
});

// Realtime function calling webhook (for server-side function execution)
router.post('/realtime/function-call', async (req, res) => {
  try {
    const { type, function_call } = req.body;
    
    if (type === 'function_call_invocation') {
      const { name, arguments: funcArgs, call_id } = function_call;
      
      let output;
      
      switch (name) {
        case 'search_web':
          const webResults = await searchWeb(funcArgs.query, funcArgs.max_results || 5);
          output = JSON.stringify({
            results: webResults,
            query: funcArgs.query,
            found: webResults.length
          });
          break;
          
        case 'search_automotive':
          let query = funcArgs.query;
          if (funcArgs.category) {
            query = `automotive ${funcArgs.category} ${funcArgs.query}`;
          }
          const autoResults = await searchWeb(query, 5);
          output = JSON.stringify({
            results: autoResults,
            category: funcArgs.category || 'general',
            query: funcArgs.query,
            found: autoResults.length
          });
          break;
          
        case 'generate_image':
          const { prompt, size, quality } = funcArgs || {};
          const imageDataUrl = await generateImage({ prompt, size, quality });
          output = JSON.stringify({
            image_data_url: imageDataUrl,
            prompt,
            size: size || '1024x1024',
            quality: quality || 'standard'
          });
          break;
          
        default:
          output = JSON.stringify({ error: `Unknown function: ${name}` });
      }
      
      // Return function call output for realtime session
      res.json({
        type: 'function_call_output',
        call_id,
        output
      });
    } else {
      res.status(400).json({ error: 'Invalid request type' });
    }
  } catch (error) {
    console.error('Realtime function call error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router; 
