// Using proxy to the agent service rather than direct import
// The research functionality is provided by the agent service running on port 3001

import axios from 'axios';

// Agent service URL
const AGENT_SERVICE_URL = 'http://localhost:3001';

/**
 * Handle regular research requests
 */
export const performResearch = async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Query parameter is required and must be a string',
      });
    }

    console.log(`[ResearchController] Starting research for query: ${query}`);

    // Forward the request to the agent service
    const response = await axios.post(`${AGENT_SERVICE_URL}/research/research`, {
      query
    });

    // Return the response from the agent service
    res.json(response.data);
  } catch (error) {
    console.error('[ResearchController] Research error:', error);
    res.status(500).json({
      success: false,
      error: 'Research failed',
      message: error?.response?.data?.message || error?.message || 'Unknown error',
    });
  }
};

/**
 * Handle streaming research requests
 */
export const performStreamingResearch = async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Query parameter is required and must be a string',
      });
    }

    // Set up Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    console.log(`[ResearchController] Starting streaming research for query: ${query}`);

    // Forward the request to the agent service
    // For streaming, we need to make a direct request and pipe the response
    try {
      const response = await axios({
        method: 'post',
        url: `${AGENT_SERVICE_URL}/research/research/stream`,
        data: { query },
        responseType: 'stream',
      });

      // Pipe the agent service response directly to our response
      response.data.on('data', chunk => {
        res.write(chunk);
      });

      response.data.on('end', () => {
        res.end();
      });

      response.data.on('error', (error) => {
        console.error('[ResearchController] Stream error:', error);
        res.write(`event: error\n`);
        res.write(`data: ${JSON.stringify({
          success: false,
          error: 'Research stream failed',
          message: error.message || 'Unknown error'
        })}\n\n`);
        res.end();
      });
    } catch (error) {
      console.error('[ResearchController] Streaming research error:', error);
      res.write(`event: error\n`);
      res.write(`data: ${JSON.stringify({
        success: false,
        error: 'Research failed',
        message: error?.response?.data?.message || error?.message || 'Unknown error'
      })}\n\n`);
      res.end();
    }
  } catch (error) {
    console.error('[ResearchController] Streaming setup error:', error);
    res.status(500).json({
      success: false,
      error: 'Streaming setup failed',
      message: error?.response?.data?.message || error?.message || 'Unknown error'
    });
  }
};

/**
 * Health check endpoint
 */
export const healthCheck = async (req, res) => {
  try {
    // Check if the agent service is running
    const response = await axios.get(`${AGENT_SERVICE_URL}/research/health`);
    
    res.json({ 
      status: 'ok', 
      service: 'integrated-research-bot',
      agent_service: response.data
    });
  } catch (error) {
    console.error('[ResearchController] Health check error:', error);
    res.json({ 
      status: 'warning', 
      service: 'integrated-research-bot',
      agent_service: 'unavailable',
      message: 'Agent service is not running or unreachable'
    });
  }
};