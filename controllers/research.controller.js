// Using proxy to the agent service rather than direct import
// The research functionality is provided by the agent service running on port 3001

import axios from 'axios';
import ResearchResult from '../models/researchResult.model.js';

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

    // Save the research result to the database
    try {
      const researchData = response.data;
      
      // Create a new research result entry
      const newResearchResult = new ResearchResult({
        query,
        result: researchData,
        sources: researchData.sources || [],
        metadata: {
          timestamp: new Date().toISOString(),
          source: 'agent_service'
        },
        userId: req.user?.id || null,
        tags: ['agent-research'],
        status: 'completed'
      });
      
      // Save to database
      await newResearchResult.save();
      console.log(`[ResearchController] Saved research result with ID: ${newResearchResult._id}`);
      
      // Add the saved research ID to the response
      const responseWithId = {
        ...response.data,
        savedResearchId: newResearchResult._id
      };
      
      // Return the response from the agent service with saved ID
      res.json(responseWithId);
    } catch (saveError) {
      console.error('[ResearchController] Error saving research result:', saveError);
      // Still return the original response even if saving fails
      res.json(response.data);
    }
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

    // Store the complete result for saving when stream ends
    let completeResult = '';
    let finalResult = null;

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
        const chunkStr = chunk.toString();
        completeResult += chunkStr;
        res.write(chunk);
        
        // Try to parse the last complete event as JSON to capture the final result
        try {
          // Look for data: JSON pattern in the chunk
          const matches = chunkStr.match(/data: ({.*})/g);
          if (matches && matches.length > 0) {
            // Get the last match
            const lastMatch = matches[matches.length - 1];
            // Extract the JSON part
            const jsonStr = lastMatch.replace('data: ', '');
            // Parse JSON
            const jsonData = JSON.parse(jsonStr);
            // Update the final result if this is a complete result
            if (jsonData && jsonData.result) {
              finalResult = jsonData;
            }
          }
        } catch (parseError) {
          // Ignore parse errors - they're expected for partial chunks
        }
      });

      response.data.on('end', async () => {
        // Save the complete research result to the database if we have a final result
        if (finalResult) {
          try {
            // Create a new research result entry
            const newResearchResult = new ResearchResult({
              query,
              result: finalResult,
              sources: finalResult.sources || [],
              metadata: {
                timestamp: new Date().toISOString(),
                source: 'agent_service_stream',
                isStreamResult: true
              },
              userId: req.user?.id || null,
              tags: ['agent-research', 'streaming'],
              status: 'completed'
            });
            
            // Save to database
            await newResearchResult.save();
            console.log(`[ResearchController] Saved streaming research result with ID: ${newResearchResult._id}`);
            
            // Send a final event with the saved ID
            res.write(`event: saved\n`);
            res.write(`data: ${JSON.stringify({
              savedResearchId: newResearchResult._id
            })}\n\n`);
          } catch (saveError) {
            console.error('[ResearchController] Error saving streaming research result:', saveError);
          }
        }
        
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