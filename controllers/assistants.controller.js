import OpenAI from 'openai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Creates a new assistant
 * @route POST /api/openai/assistants
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Assistant object or error
 */
export const createAssistant = async (req, res) => {
  try {
    const { 
      name, 
      description, 
      instructions, 
      model = "gpt-4o", 
      tools = [], 
      file_ids = [] 
    } = req.body;

    // Validate required fields
    if (!name || !instructions) {
      return res.status(400).json({ 
        error: 'Missing required fields', 
        details: 'Both name and instructions are required' 
      });
    }

    // Create assistant using OpenAI API
    const assistant = await openai.beta.assistants.create({
      name,
      description,
      instructions,
      model,
      tools,
      file_ids
    });

    // Return the created assistant
    return res.status(201).json(assistant);
  } catch (error) {
    console.error('Error creating assistant:', error);
    
    // Handle API-specific errors
    if (error.status) {
      return res.status(error.status).json({
        error: 'OpenAI API Error',
        message: error.message,
        type: error.type
      });
    }
    
    // Generic error handling
    return res.status(500).json({ 
      error: 'Failed to create assistant',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Lists all assistants
 * @route GET /api/openai/assistants
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} List of assistants or error
 */
export const listAssistants = async (req, res) => {
  try {
    const { 
      limit = 20, 
      order = 'desc', 
      after, 
      before 
    } = req.query;

    // Prepare query params
    const queryParams = {
      limit: parseInt(limit),
      order
    };

    // Add pagination params if provided
    if (after) queryParams.after = after;
    if (before) queryParams.before = before;

    // Fetch assistants from OpenAI
    const assistants = await openai.beta.assistants.list(queryParams);

    return res.status(200).json(assistants);
  } catch (error) {
    console.error('Error listing assistants:', error);
    
    // Handle API-specific errors
    if (error.status) {
      return res.status(error.status).json({
        error: 'OpenAI API Error',
        message: error.message,
        type: error.type
      });
    }
    
    // Generic error handling
    return res.status(500).json({ 
      error: 'Failed to list assistants',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Retrieves a specific assistant
 * @route GET /api/openai/assistants/:assistantId
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Assistant object or error
 */
export const getAssistant = async (req, res) => {
  try {
    const { assistantId } = req.params;

    if (!assistantId) {
      return res.status(400).json({ 
        error: 'Missing assistant ID', 
        details: 'Assistant ID is required in the URL path' 
      });
    }

    // Retrieve assistant from OpenAI
    const assistant = await openai.beta.assistants.retrieve(assistantId);

    return res.status(200).json(assistant);
  } catch (error) {
    console.error(`Error retrieving assistant ${req.params.assistantId}:`, error);
    
    // Handle 404 errors specifically
    if (error.status === 404) {
      return res.status(404).json({
        error: 'Assistant not found',
        message: `No assistant found with ID: ${req.params.assistantId}`
      });
    }
    
    // Handle other API-specific errors
    if (error.status) {
      return res.status(error.status).json({
        error: 'OpenAI API Error',
        message: error.message,
        type: error.type
      });
    }
    
    // Generic error handling
    return res.status(500).json({ 
      error: 'Failed to retrieve assistant',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Updates an existing assistant
 * @route PUT /api/openai/assistants/:assistantId
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Updated assistant object or error
 */
export const updateAssistant = async (req, res) => {
  try {
    const { assistantId } = req.params;
    const { 
      name, 
      description, 
      instructions, 
      model, 
      tools, 
      file_ids 
    } = req.body;

    if (!assistantId) {
      return res.status(400).json({ 
        error: 'Missing assistant ID', 
        details: 'Assistant ID is required in the URL path' 
      });
    }

    // Prepare update data, only including fields that are provided
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (instructions !== undefined) updateData.instructions = instructions;
    if (model !== undefined) updateData.model = model;
    if (tools !== undefined) updateData.tools = tools;
    if (file_ids !== undefined) updateData.file_ids = file_ids;

    // Update assistant
    const updatedAssistant = await openai.beta.assistants.update(
      assistantId,
      updateData
    );

    return res.status(200).json(updatedAssistant);
  } catch (error) {
    console.error(`Error updating assistant ${req.params.assistantId}:`, error);
    
    // Handle 404 errors specifically
    if (error.status === 404) {
      return res.status(404).json({
        error: 'Assistant not found',
        message: `No assistant found with ID: ${req.params.assistantId}`
      });
    }
    
    // Handle other API-specific errors
    if (error.status) {
      return res.status(error.status).json({
        error: 'OpenAI API Error',
        message: error.message,
        type: error.type
      });
    }
    
    // Generic error handling
    return res.status(500).json({ 
      error: 'Failed to update assistant',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Deletes an assistant
 * @route DELETE /api/openai/assistants/:assistantId
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Deletion confirmation or error
 */
export const deleteAssistant = async (req, res) => {
  try {
    const { assistantId } = req.params;

    if (!assistantId) {
      return res.status(400).json({ 
        error: 'Missing assistant ID', 
        details: 'Assistant ID is required in the URL path' 
      });
    }

    // Delete assistant
    const deletionResult = await openai.beta.assistants.del(assistantId);

    return res.status(200).json(deletionResult);
  } catch (error) {
    console.error(`Error deleting assistant ${req.params.assistantId}:`, error);
    
    // Handle 404 errors specifically
    if (error.status === 404) {
      return res.status(404).json({
        error: 'Assistant not found',
        message: `No assistant found with ID: ${req.params.assistantId}`
      });
    }
    
    // Handle other API-specific errors
    if (error.status) {
      return res.status(error.status).json({
        error: 'OpenAI API Error',
        message: error.message,
        type: error.type
      });
    }
    
    // Generic error handling
    return res.status(500).json({ 
      error: 'Failed to delete assistant',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Creates a thread for an assistant
 * @route POST /api/openai/assistants/threads
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Thread object or error
 */
export const createThread = async (req, res) => {
  try {
    const { messages = [] } = req.body;

    // Create thread
    const thread = await openai.beta.threads.create({
      messages
    });

    return res.status(201).json(thread);
  } catch (error) {
    console.error('Error creating thread:', error);
    
    // Handle API-specific errors
    if (error.status) {
      return res.status(error.status).json({
        error: 'OpenAI API Error',
        message: error.message,
        type: error.type
      });
    }
    
    // Generic error handling
    return res.status(500).json({ 
      error: 'Failed to create thread',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Adds a message to a thread
 * @route POST /api/openai/assistants/threads/:threadId/messages
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Message object or error
 */
export const addMessage = async (req, res) => {
  try {
    const { threadId } = req.params;
    const { 
      role = 'user', 
      content, 
      file_ids = [],
      metadata = {} 
    } = req.body;

    if (!threadId) {
      return res.status(400).json({ 
        error: 'Missing thread ID', 
        details: 'Thread ID is required in the URL path' 
      });
    }

    if (!content) {
      return res.status(400).json({ 
        error: 'Missing content', 
        details: 'Message content is required' 
      });
    }

    // Add message to thread
    const message = await openai.beta.threads.messages.create(
      threadId,
      {
        role,
        content,
        file_ids,
        metadata
      }
    );

    return res.status(201).json(message);
  } catch (error) {
    console.error(`Error adding message to thread ${req.params.threadId}:`, error);
    
    // Handle 404 errors specifically
    if (error.status === 404) {
      return res.status(404).json({
        error: 'Thread not found',
        message: `No thread found with ID: ${req.params.threadId}`
      });
    }
    
    // Handle other API-specific errors
    if (error.status) {
      return res.status(error.status).json({
        error: 'OpenAI API Error',
        message: error.message,
        type: error.type
      });
    }
    
    // Generic error handling
    return res.status(500).json({ 
      error: 'Failed to add message to thread',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Retrieves messages from a thread
 * @route GET /api/openai/assistants/threads/:threadId/messages
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} List of messages or error
 */
export const getMessages = async (req, res) => {
  try {
    const { threadId } = req.params;
    const { 
      limit = 20, 
      order = 'desc', 
      after, 
      before 
    } = req.query;

    if (!threadId) {
      return res.status(400).json({ 
        error: 'Missing thread ID', 
        details: 'Thread ID is required in the URL path' 
      });
    }

    // Prepare query params
    const queryParams = {
      limit: parseInt(limit),
      order
    };

    // Add pagination params if provided
    if (after) queryParams.after = after;
    if (before) queryParams.before = before;

    // Retrieve messages
    const messages = await openai.beta.threads.messages.list(
      threadId,
      queryParams
    );

    return res.status(200).json(messages);
  } catch (error) {
    console.error(`Error retrieving messages from thread ${req.params.threadId}:`, error);
    
    // Handle 404 errors specifically
    if (error.status === 404) {
      return res.status(404).json({
        error: 'Thread not found',
        message: `No thread found with ID: ${req.params.threadId}`
      });
    }
    
    // Handle other API-specific errors
    if (error.status) {
      return res.status(error.status).json({
        error: 'OpenAI API Error',
        message: error.message,
        type: error.type
      });
    }
    
    // Generic error handling
    return res.status(500).json({ 
      error: 'Failed to retrieve messages',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Creates a run (sends thread to assistant for processing)
 * @route POST /api/openai/assistants/threads/:threadId/runs
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Run object or error
 */
export const createRun = async (req, res) => {
  try {
    const { threadId } = req.params;
    const { 
      assistant_id, 
      instructions,
      tools,
      metadata = {}
    } = req.body;

    if (!threadId) {
      return res.status(400).json({ 
        error: 'Missing thread ID', 
        details: 'Thread ID is required in the URL path' 
      });
    }

    if (!assistant_id) {
      return res.status(400).json({ 
        error: 'Missing assistant ID', 
        details: 'Assistant ID is required' 
      });
    }

    // Prepare run data
    const runData = {
      assistant_id,
      metadata
    };

    // Add optional fields if provided
    if (instructions) runData.instructions = instructions;
    if (tools) runData.tools = tools;

    // Create run
    const run = await openai.beta.threads.runs.create(
      threadId,
      runData
    );

    return res.status(201).json(run);
  } catch (error) {
    console.error(`Error creating run for thread ${req.params.threadId}:`, error);
    
    // Handle 404 errors specifically
    if (error.status === 404) {
      return res.status(404).json({
        error: 'Thread or assistant not found',
        message: error.message
      });
    }
    
    // Handle other API-specific errors
    if (error.status) {
      return res.status(error.status).json({
        error: 'OpenAI API Error',
        message: error.message,
        type: error.type
      });
    }
    
    // Generic error handling
    return res.status(500).json({ 
      error: 'Failed to create run',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Retrieves the status of a run
 * @route GET /api/openai/assistants/threads/:threadId/runs/:runId
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Run object or error
 */
export const getRun = async (req, res) => {
  try {
    const { threadId, runId } = req.params;

    if (!threadId || !runId) {
      return res.status(400).json({ 
        error: 'Missing parameters', 
        details: 'Both thread ID and run ID are required in the URL path' 
      });
    }

    // Retrieve run
    const run = await openai.beta.threads.runs.retrieve(
      threadId,
      runId
    );

    return res.status(200).json(run);
  } catch (error) {
    console.error(`Error retrieving run ${req.params.runId} for thread ${req.params.threadId}:`, error);
    
    // Handle 404 errors specifically
    if (error.status === 404) {
      return res.status(404).json({
        error: 'Thread or run not found',
        message: error.message
      });
    }
    
    // Handle other API-specific errors
    if (error.status) {
      return res.status(error.status).json({
        error: 'OpenAI API Error',
        message: error.message,
        type: error.type
      });
    }
    
    // Generic error handling
    return res.status(500).json({ 
      error: 'Failed to retrieve run',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Submits tool outputs for a run requiring action
 * @route POST /api/openai/assistants/threads/:threadId/runs/:runId/submit-tool-outputs
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Updated run object or error
 */
export const submitToolOutputs = async (req, res) => {
  try {
    const { threadId, runId } = req.params;
    const { tool_outputs } = req.body;

    if (!threadId || !runId) {
      return res.status(400).json({ 
        error: 'Missing parameters', 
        details: 'Both thread ID and run ID are required in the URL path' 
      });
    }

    if (!tool_outputs || !Array.isArray(tool_outputs) || tool_outputs.length === 0) {
      return res.status(400).json({ 
        error: 'Missing or invalid tool outputs', 
        details: 'tool_outputs must be a non-empty array of tool output objects' 
      });
    }

    // Submit tool outputs
    const run = await openai.beta.threads.runs.submitToolOutputs(
      threadId,
      runId,
      {
        tool_outputs
      }
    );

    return res.status(200).json(run);
  } catch (error) {
    console.error(`Error submitting tool outputs for run ${req.params.runId}:`, error);
    
    // Handle 404 errors specifically
    if (error.status === 404) {
      return res.status(404).json({
        error: 'Thread or run not found',
        message: error.message
      });
    }
    
    // Handle other API-specific errors
    if (error.status) {
      return res.status(error.status).json({
        error: 'OpenAI API Error',
        message: error.message,
        type: error.type
      });
    }
    
    // Generic error handling
    return res.status(500).json({ 
      error: 'Failed to submit tool outputs',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Cancels a run that is in progress
 * @route POST /api/openai/assistants/threads/:threadId/runs/:runId/cancel
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Updated run object or error
 */
export const cancelRun = async (req, res) => {
  try {
    const { threadId, runId } = req.params;

    if (!threadId || !runId) {
      return res.status(400).json({ 
        error: 'Missing parameters', 
        details: 'Both thread ID and run ID are required in the URL path' 
      });
    }

    // Cancel run
    const run = await openai.beta.threads.runs.cancel(
      threadId,
      runId
    );

    return res.status(200).json(run);
  } catch (error) {
    console.error(`Error canceling run ${req.params.runId}:`, error);
    
    // Handle 404 errors specifically
    if (error.status === 404) {
      return res.status(404).json({
        error: 'Thread or run not found',
        message: error.message
      });
    }
    
    // Handle other API-specific errors
    if (error.status) {
      return res.status(error.status).json({
        error: 'OpenAI API Error',
        message: error.message,
        type: error.type
      });
    }
    
    // Generic error handling
    return res.status(500).json({ 
      error: 'Failed to cancel run',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Creates a thread and run in one operation
 * @route POST /api/openai/assistants/thread-runs
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Thread and run objects or error
 */
export const createThreadAndRun = async (req, res) => {
  try {
    const { 
      assistant_id, 
      thread = {}, 
      instructions,
      tools,
      metadata = {}
    } = req.body;

    if (!assistant_id) {
      return res.status(400).json({ 
        error: 'Missing assistant ID', 
        details: 'Assistant ID is required' 
      });
    }

    // Prepare request data
    const requestData = {
      assistant_id,
      thread,
      metadata
    };

    // Add optional fields if provided
    if (instructions) requestData.instructions = instructions;
    if (tools) requestData.tools = tools;

    // Create thread and run
    const threadRun = await openai.beta.threads.createAndRun(requestData);

    return res.status(201).json(threadRun);
  } catch (error) {
    console.error('Error creating thread and run:', error);
    
    // Handle 404 errors specifically
    if (error.status === 404) {
      return res.status(404).json({
        error: 'Assistant not found',
        message: error.message
      });
    }
    
    // Handle other API-specific errors
    if (error.status) {
      return res.status(error.status).json({
        error: 'OpenAI API Error',
        message: error.message,
        type: error.type
      });
    }
    
    // Generic error handling
    return res.status(500).json({ 
      error: 'Failed to create thread and run',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};