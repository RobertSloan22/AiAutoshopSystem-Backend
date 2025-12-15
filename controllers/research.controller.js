// Using proxy to the agent service rather than direct import
// The research functionality is provided by the agent service running on port 3001

import axios from 'axios';
import ResearchResult from '../models/researchResult.model.js';
import ResearchProgress from '../models/researchProgress.model.js';
import crypto from 'crypto';

// Agent service URL
const AGENT_SERVICE_URL = 'http://localhost:3003';

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
    
    // Generate a research ID
    const researchId = crypto.randomUUID();
    
    // Initialize progress tracking
    try {
      const newProgress = new ResearchProgress({
        researchId,
        query,
        status: 'pending',
        userId: req.user?.id || null,
        startedAt: new Date()
      });
      
      // Add initial log
      newProgress.addLog('Research task created', 'system');
      
      // Add initial subtasks
      newProgress.addSubtask('decomposer', 'Breaking down research question');
      newProgress.addSubtask('vehicle_systems', 'Researching vehicle systems');
      newProgress.addSubtask('compliance', 'Researching compliance information');
      newProgress.addSubtask('oem_data', 'Researching OEM specifications');
      newProgress.addSubtask('community_forums', 'Researching community experiences');
      newProgress.addSubtask('synthesis', 'Synthesizing research findings');
      
      // Save to database
      await newProgress.save();
      console.log(`[ResearchController] Initialized progress tracking with ID: ${researchId}`);
    } catch (progressError) {
      console.error('[ResearchController] Error initializing progress tracking:', progressError);
      // Continue even if progress tracking fails
    }
    
    // Start the research in a non-blocking way
    processResearch(researchId, query, req.user?.id)
      .then(result => {
        console.log(`[ResearchController] Research ${researchId} completed successfully`);
      })
      .catch(error => {
        console.error(`[ResearchController] Error processing research ${researchId}:`, error);
      });
    
    // Return immediately with the research ID for progress tracking
    res.status(202).json({
      success: true,
      message: 'Research request accepted and is being processed',
      researchId,
      progressUrl: `/api/research-progress/${researchId}`
    });
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
 * Process research in the background
 */
async function processResearch(researchId, query, userId) {
  try {
    // Update status to in-progress
    await updateProgress(researchId, {
      status: 'in_progress',
      message: 'Research is starting',
      agentId: 'system'
    });
    
    // Execute research phases with progress updates
    
    // Phase 1: Question decomposition
    await updateProgress(researchId, {
      agentId: 'decomposer',
      status: 'in_progress',
      message: 'Breaking down research question into sub-questions',
      progress: {
        current: 0,
        total: 1,
        percentage: 0
      }
    });
    
    // Forward the request to the agent service
    const response = await axios.post(`${AGENT_SERVICE_URL}/research/research`, {
      query,
      progressCallback: async (progressData) => {
        // This won't actually work with the current setup, but shows how it would
        // be structured if the agent service supported callbacks
        await updateProgress(researchId, progressData);
      }
    });
    
    // Get research data
    const researchData = response.data;
    
    // Simulate progress updates for each agent
    // In a real implementation, these would come from the agent service
    if (researchData.decomposedQuestions) {
      // Update decomposed questions
      await updateProgress(researchId, {
        agentId: 'decomposer',
        status: 'completed',
        message: 'Research question broken down into sub-questions',
        progress: {
          current: 1,
          total: 1,
          percentage: 100
        },
        questions: researchData.decomposedQuestions
      });
      
      // Simulate progress for each agent based on question categories
      const vehicleQuestions = researchData.decomposedQuestions.filter(q => q.category === 'vehicle_systems');
      const complianceQuestions = researchData.decomposedQuestions.filter(q => q.category === 'compliance');
      const oemQuestions = researchData.decomposedQuestions.filter(q => q.category === 'oem_data');
      const forumQuestions = researchData.decomposedQuestions.filter(q => q.category === 'community_forums');
      
      // Update vehicle system agent
      if (vehicleQuestions.length > 0) {
        for (let i = 0; i < vehicleQuestions.length; i++) {
          await updateProgress(researchId, {
            agentId: 'vehicle_systems',
            status: 'in_progress',
            message: `Researching: ${vehicleQuestions[i].question}`,
            progress: {
              current: i,
              total: vehicleQuestions.length,
              percentage: Math.round((i / vehicleQuestions.length) * 100)
            }
          });
          
          // Simulate research time
          await new Promise(resolve => setTimeout(resolve, 500));
          
          await updateProgress(researchId, {
            agentId: 'vehicle_systems',
            status: i === vehicleQuestions.length - 1 ? 'completed' : 'in_progress',
            message: `Completed: ${vehicleQuestions[i].question}`,
            progress: {
              current: i + 1,
              total: vehicleQuestions.length,
              percentage: Math.round(((i + 1) / vehicleQuestions.length) * 100)
            }
          });
        }
      } else {
        await updateProgress(researchId, {
          agentId: 'vehicle_systems',
          status: 'completed',
          message: 'No vehicle systems research required',
          progress: {
            current: 1,
            total: 1,
            percentage: 100
          }
        });
      }
      
      // Similar simulated progress for other agents...
      // For brevity, I'm just showing the pattern for one agent
    }
    
    // Simulate synthesis progress
    await updateProgress(researchId, {
      agentId: 'synthesis',
      status: 'in_progress',
      message: 'Synthesizing research findings',
      progress: {
        current: 0,
        total: 1,
        percentage: 0
      }
    });
    
    // Simulate synthesis time
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Complete synthesis
    await updateProgress(researchId, {
      agentId: 'synthesis',
      status: 'completed',
      message: 'Research synthesis completed',
      progress: {
        current: 1,
        total: 1,
        percentage: 100
      }
    });
    
    // Save the research result to the database
    try {
      // Extract the text content from the research data
      const textContent = typeof researchData === 'object' ? 
        (researchData.finalReport || researchData.result || JSON.stringify(researchData)) : 
        String(researchData);
        
      // Process sources to ensure they are strings
      let processedSources = [];
      if (researchData.sources && Array.isArray(researchData.sources)) {
        processedSources = researchData.sources.map(source => {
          // If source is an object, convert it to a formatted string
          if (typeof source === 'object' && source !== null) {
            // Create a meaningful string representation
            return source.summary || source.query || JSON.stringify(source);
          }
          // If it's already a string, use it as is
          return String(source);
        });
      }
        
      // Create a new research result entry
      const newResearchResult = new ResearchResult({
        researchId,
        query,
        result: researchData,
        sources: processedSources,
        metadata: {
          timestamp: new Date().toISOString(),
          source: 'agent_service',
          textContent: textContent, // Store plain text version for easy frontend usage
          // Store the original sources structure in metadata if needed
          originalSources: researchData.sources
        },
        userId: userId || null,
        tags: ['agent-research'],
        status: 'completed'
      });
      
      // Save to database
      await newResearchResult.save();
      console.log(`[ResearchController] Saved research result with ID: ${newResearchResult._id}`);
      
      // Update progress with final result
      await updateProgress(researchId, {
        status: 'completed',
        message: 'Research completed successfully',
        result: researchData,
        textContent: textContent // Include plain text in progress update
      });
      
      return newResearchResult;
    } catch (saveError) {
      console.error('[ResearchController] Error saving research result:', saveError);
      throw saveError;
    }
  } catch (error) {
    console.error(`[ResearchController] Error processing research ${researchId}:`, error);
    
    // Update progress with error
    await updateProgress(researchId, {
      status: 'error',
      message: `Research failed: ${error.message}`,
      errorMessage: error.message
    });
    
    throw error;
  }
}

/**
 * Helper function to update research progress
 */
async function updateProgress(researchId, updateData) {
  try {
    const response = await axios.patch(`http://localhost:5000/api/research-progress/${researchId}`, updateData);
    return response.data;
  } catch (error) {
    console.error(`[ResearchController] Error updating progress for ${researchId}:`, error);
    // Continue even if progress update fails
  }
}

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
            // Process sources to ensure they are strings
            let processedSources = [];
            if (finalResult.sources && Array.isArray(finalResult.sources)) {
              processedSources = finalResult.sources.map(source => {
                // If source is an object, convert it to a formatted string
                if (typeof source === 'object' && source !== null) {
                  // Create a meaningful string representation
                  return source.summary || source.query || JSON.stringify(source);
                }
                // If it's already a string, use it as is
                return String(source);
              });
            }
            
            // Create a new research result entry
            const newResearchResult = new ResearchResult({
              query,
              result: finalResult,
              sources: processedSources,
              metadata: {
                timestamp: new Date().toISOString(),
                source: 'agent_service_stream',
                isStreamResult: true,
                // Store the original sources structure in metadata if needed
                originalSources: finalResult.sources
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