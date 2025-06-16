import ResearchResult from '../models/researchResult.model.js';

/**
 * Save a research result to the database
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const saveResearchResult = async (req, res) => {
  try {
    const { query, result, sources, metadata, userId, tags } = req.body;

    // Validate required fields
    if (!query || !result) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'Query and result are required fields'
      });
    }

    // Create a new research result
    const newResearchResult = new ResearchResult({
      query,
      result,
      sources: sources || [],
      metadata: metadata || {},
      userId: userId || null,
      tags: tags || [],
      status: 'completed'
    });

    // Save to database
    await newResearchResult.save();

    res.status(201).json({
      success: true,
      message: 'Research result saved successfully',
      data: {
        id: newResearchResult._id,
        query: newResearchResult.query,
        createdAt: newResearchResult.createdAt
      }
    });
  } catch (error) {
    console.error('[ResearchResultController] Save error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save research result',
      message: error.message || 'An unexpected error occurred'
    });
  }
};

/**
 * Get a research result by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getResearchResultById = async (req, res) => {
  try {
    const { id } = req.params;

    // Find the research result by ID
    const researchResult = await ResearchResult.findById(id);

    if (!researchResult) {
      return res.status(404).json({
        success: false,
        error: 'Research result not found',
        message: `No research result found with ID: ${id}`
      });
    }

    res.status(200).json({
      success: true,
      data: researchResult
    });
  } catch (error) {
    console.error('[ResearchResultController] GetById error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve research result',
      message: error.message || 'An unexpected error occurred'
    });
  }
};

/**
 * Get all research results with pagination and filtering
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getResearchResults = async (req, res) => {
  try {
    const { page = 1, limit = 10, userId, tags, search, startDate, endDate, status } = req.query;
    
    // Build query based on filters
    const query = {};
    
    // Filter by userId if provided
    if (userId) {
      query.userId = userId;
    }
    
    // Filter by tags if provided
    if (tags) {
      const tagArray = tags.split(',').map(tag => tag.trim());
      query.tags = { $in: tagArray };
    }
    
    // Filter by status if provided
    if (status) {
      query.status = status;
    }
    
    // Filter by date range if provided
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }
    
    // Search by text if provided
    if (search) {
      query.$text = { $search: search };
    }
    
    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    
    // Fetch results with pagination
    const results = await ResearchResult.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);
    
    // Get total count for pagination
    const total = await ResearchResult.countDocuments(query);
    
    res.status(200).json({
      success: true,
      data: results,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('[ResearchResultController] GetAll error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve research results',
      message: error.message || 'An unexpected error occurred'
    });
  }
};

/**
 * Update a research result by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const updateResearchResult = async (req, res) => {
  try {
    const { id } = req.params;
    const { tags, metadata, status } = req.body;
    
    // Find the research result
    const researchResult = await ResearchResult.findById(id);
    
    if (!researchResult) {
      return res.status(404).json({
        success: false,
        error: 'Research result not found',
        message: `No research result found with ID: ${id}`
      });
    }
    
    // Update allowed fields
    if (tags) researchResult.tags = tags;
    if (metadata) researchResult.metadata = { ...researchResult.metadata, ...metadata };
    if (status) researchResult.status = status;
    
    // Save updates
    await researchResult.save();
    
    res.status(200).json({
      success: true,
      message: 'Research result updated successfully',
      data: {
        id: researchResult._id,
        query: researchResult.query,
        updatedAt: researchResult.updatedAt
      }
    });
  } catch (error) {
    console.error('[ResearchResultController] Update error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update research result',
      message: error.message || 'An unexpected error occurred'
    });
  }
};

/**
 * Delete a research result by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const deleteResearchResult = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find and delete the research result
    const researchResult = await ResearchResult.findByIdAndDelete(id);
    
    if (!researchResult) {
      return res.status(404).json({
        success: false,
        error: 'Research result not found',
        message: `No research result found with ID: ${id}`
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Research result deleted successfully',
      data: {
        id: id
      }
    });
  } catch (error) {
    console.error('[ResearchResultController] Delete error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete research result',
      message: error.message || 'An unexpected error occurred'
    });
  }
};

/**
 * Search research results by query text
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const searchResearchResults = async (req, res) => {
  try {
    const { query, limit = 10 } = req.query;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters',
        message: 'Search query is required'
      });
    }
    
    // Search using MongoDB text index
    const results = await ResearchResult.find(
      { $text: { $search: query } },
      { score: { $meta: "textScore" } }
    )
    .sort({ score: { $meta: "textScore" }, createdAt: -1 })
    .limit(parseInt(limit));
    
    res.status(200).json({
      success: true,
      data: results,
      count: results.length
    });
  } catch (error) {
    console.error('[ResearchResultController] Search error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search research results',
      message: error.message || 'An unexpected error occurred'
    });
  }
};