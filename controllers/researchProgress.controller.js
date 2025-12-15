import ResearchProgress from '../models/researchProgress.model.js';

/**
 * Get progress for a specific research task
 */
export const getResearchProgress = async (req, res) => {
  try {
    const { researchId } = req.params;
    
    if (!researchId) {
      return res.status(400).json({
        success: false,
        error: 'Research ID is required'
      });
    }
    
    // Find the research progress
    const progress = await ResearchProgress.findOne({ researchId });
    
    if (!progress) {
      return res.status(404).json({
        success: false,
        error: 'Research progress not found'
      });
    }
    
    // Return the progress data
    res.json({
      success: true,
      progress: {
        researchId: progress.researchId,
        query: progress.query,
        status: progress.status,
        overallProgress: progress.overallProgress,
        questions: progress.questions,
        subtasks: progress.subtasks.map(task => ({
          agentId: task.agentId,
          description: task.description,
          status: task.status,
          progress: task.progress,
          startedAt: task.startedAt,
          completedAt: task.completedAt,
          errorMessage: task.errorMessage
        })),
        logs: progress.logs.slice(-20), // Return the latest 20 log entries
        startedAt: progress.startedAt,
        completedAt: progress.completedAt,
        errorMessage: progress.errorMessage
      }
    });
  } catch (error) {
    console.error('[ResearchProgressController] Error getting research progress:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get research progress',
      message: error.message
    });
  }
};

/**
 * Create a new research progress entry
 */
export const createResearchProgress = async (req, res) => {
  try {
    const { researchId, query, userId } = req.body;
    
    if (!researchId || !query) {
      return res.status(400).json({
        success: false,
        error: 'Research ID and query are required'
      });
    }
    
    // Check if progress already exists
    const existingProgress = await ResearchProgress.findOne({ researchId });
    
    if (existingProgress) {
      return res.status(409).json({
        success: false,
        error: 'Research progress already exists for this ID'
      });
    }
    
    // Create new progress entry
    const newProgress = new ResearchProgress({
      researchId,
      query,
      status: 'pending',
      userId: userId || null,
      startedAt: new Date()
    });
    
    // Add initial log
    newProgress.addLog('Research task created', 'system');
    
    // Save to database
    await newProgress.save();
    
    res.status(201).json({
      success: true,
      message: 'Research progress tracking initialized',
      researchId: newProgress.researchId
    });
  } catch (error) {
    console.error('[ResearchProgressController] Error creating research progress:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create research progress',
      message: error.message
    });
  }
};

/**
 * Update research progress
 */
export const updateResearchProgress = async (req, res) => {
  try {
    const { researchId } = req.params;
    const {
      agentId,
      status,
      progress,
      message,
      questions,
      errorMessage,
      result
    } = req.body;
    
    if (!researchId) {
      return res.status(400).json({
        success: false,
        error: 'Research ID is required'
      });
    }
    
    // Find the research progress
    let researchProgress = await ResearchProgress.findOne({ researchId });
    
    if (!researchProgress) {
      return res.status(404).json({
        success: false,
        error: 'Research progress not found'
      });
    }
    
    // Update agentId specific progress
    if (agentId && progress) {
      // Create subtask if it doesn't exist
      const description = message || `Task for agent ${agentId}`;
      researchProgress.addSubtask(agentId, description);
      
      // Update progress
      researchProgress.updateSubtaskProgress(agentId, progress, status);
    }
    
    // Add log message if provided
    if (message) {
      const level = status === 'error' ? 'error' : 'info';
      researchProgress.addLog(message, agentId || 'system', level);
    }
    
    // Update questions if provided
    if (questions && Array.isArray(questions)) {
      researchProgress.questions = questions;
    }
    
    // Update error message if provided
    if (errorMessage) {
      researchProgress.errorMessage = errorMessage;
      researchProgress.status = 'error';
    }
    
    // Update final result if provided
    if (result) {
      researchProgress.result = result;
      researchProgress.status = 'completed';
      researchProgress.completedAt = new Date();
      researchProgress.overallProgress = 100;
    }
    
    // Update overall status based on subtasks
    researchProgress.updateOverallStatus();
    
    // Save changes
    await researchProgress.save();
    
    res.json({
      success: true,
      message: 'Research progress updated',
      currentStatus: researchProgress.status,
      overallProgress: researchProgress.overallProgress
    });
  } catch (error) {
    console.error('[ResearchProgressController] Error updating research progress:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update research progress',
      message: error.message
    });
  }
};

/**
 * Get all research progress entries
 */
export const getAllResearchProgress = async (req, res) => {
  try {
    const { status, limit = 10, userId } = req.query;
    
    // Build query
    const query = {};
    
    if (status) {
      query.status = status;
    }
    
    if (userId) {
      query.userId = userId;
    }
    
    // Get progress entries
    const progressEntries = await ResearchProgress.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .select('researchId query status overallProgress startedAt completedAt userId');
    
    res.json({
      success: true,
      count: progressEntries.length,
      progress: progressEntries
    });
  } catch (error) {
    console.error('[ResearchProgressController] Error getting all research progress:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get research progress entries',
      message: error.message
    });
  }
};