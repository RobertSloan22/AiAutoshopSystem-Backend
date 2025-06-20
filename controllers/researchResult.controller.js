import mongoose from 'mongoose';
import ResearchResult from '../models/researchResult.model.js';

/**
 * Save a research result to the database
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const saveResearchResult = async (req, res) => {
  try {
    const { 
      query, 
      result, 
      sources, 
      metadata, 
      userId, 
      tags,
      // Additional fields for cross-referencing
      researchId,
      uuid,
      originalId,
      sessionId,
      traceId,
      // Vehicle context
      vehicle,
      dtcCode
    } = req.body;

    console.log('[ResearchResultController] Saving research result:', { 
      query, 
      researchId, 
      uuid,
      traceId
    });

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
      status: 'completed',
      // Add ID fields if provided
      ...(researchId && { researchId }),
      ...(uuid && { uuid }),
      ...(originalId && { originalId }),
      ...(sessionId && { sessionId }),
      ...(traceId && { traceId }),
      // Add vehicle info if provided
      ...(vehicle && { vehicle }),
      ...(dtcCode && { dtcCode })
    });

    // Handle traceId from result object if not directly provided
    if (!traceId && result.traceId) {
      newResearchResult.traceId = result.traceId;
    }

    // Extract potential UUID from result if not directly provided
    if (!uuid && !researchId) {
      // Check various places where UUID might be stored
      const possibleUuids = [
        result.uuid,
        result.researchId,
        result.id,
        result.sessionId,
        result.traceId,
        metadata?.uuid,
        metadata?.researchId,
        metadata?.sessionId,
        metadata?.traceId
      ];

      // Use the first UUID-like string we find
      const foundUuid = possibleUuids.find(id => 
        id && typeof id === 'string' && 
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
      );

      if (foundUuid) {
        newResearchResult.uuid = foundUuid;
      }
    }

    // Save to database
    await newResearchResult.save();

    // Format the result for the response
    const formattedResult = formatResearchResult(newResearchResult);

    res.status(201).json({
      success: true,
      message: 'Research result saved successfully',
      data: {
        id: newResearchResult._id,
        query: newResearchResult.query,
        createdAt: newResearchResult.createdAt,
        researchId: newResearchResult.researchId,
        uuid: newResearchResult.uuid,
        traceId: newResearchResult.traceId,
        formattedResult // Include the formatted result for immediate use
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
    let researchResult = null;
    
    console.log(`[ResearchResultController] Looking up research result with ID: ${id}`);
    
    // Check if this is a valid MongoDB ObjectId
    if (mongoose.Types.ObjectId.isValid(id) && /^[0-9a-fA-F]{24}$/.test(id)) {
      console.log('[ResearchResultController] Using direct ObjectId lookup');
      researchResult = await ResearchResult.findById(id);
    } 
    
    // If not found by direct ID or not a valid ObjectId, try alternative fields
    if (!researchResult) {
      console.log('[ResearchResultController] Using alternative field lookup');
      
      // Try different possible ID fields
      researchResult = await ResearchResult.findOne({
        $or: [
          { researchId: id },
          { uuid: id },
          { originalId: id },
          { sessionId: id },
          { traceId: id }
        ]
      });
    }

    if (!researchResult) {
      return res.status(404).json({
        success: false,
        error: 'Research result not found',
        message: `No research result found with ID: ${id}`
      });
    }

    // Format the research result for frontend display
    const formattedResult = formatResearchResult(researchResult);

    res.status(200).json({
      success: true,
      data: formattedResult
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
 * Helper function to format research results for better frontend display
 * @param {Object} rawResult - The raw research result from the database
 * @returns {Object} Formatted research result
 */
export function formatResearchResult(rawResult) {
  try {
    // Convert to plain object if it's a Mongoose document
    const result = rawResult.toObject ? rawResult.toObject() : { ...rawResult };
    
    // Create a more structured format for frontend rendering
    const formatted = {
      id: result._id,
      query: result.query,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
      status: result.status,
      metadata: result.metadata || {},
      sources: result.sources || [],
      sections: []
    };

    // Check if result contains structured data we can format
    if (result.result) {
      // Add short summary if available
      if (result.result.report && result.result.report.shortSummary) {
        formatted.summary = result.result.report.shortSummary;
      }

      // Add search plan if available
      if (result.result.searchPlan && result.result.searchPlan.searches) {
        formatted.searchPlan = {
          title: "Research Approach",
          searches: result.result.searchPlan.searches.map(search => ({
            query: search.query,
            reason: search.reason
          }))
        };
      }

      // Add search results if available
      if (result.result.searchResults && result.result.searchResults.length > 0) {
        formatted.searchResults = {
          title: "Research Sources",
          results: result.result.searchResults.map((result, index) => ({
            id: index + 1,
            content: result
          }))
        };
      }

      // Process markdown report if available
      if (result.result.report && result.result.report.markdownReport) {
        // Parse markdown to extract sections
        const markdown = result.result.report.markdownReport;
        
        // Extract main sections (h1 and h2 headings)
        const sectionRegex = /^(#{1,2})\s+(.+)$([^#]*)/gm;
        let match;
        let sections = [];
        
        while ((match = sectionRegex.exec(markdown)) !== null) {
          const level = match[1].length;
          const title = match[2].trim();
          const content = match[3].trim();
          
          sections.push({
            level,
            title,
            content,
            id: title.toLowerCase().replace(/[^\w]+/g, '-')
          });
        }
        
        formatted.reportSections = sections;
        
        // Include full markdown for clients that want to render it directly
        formatted.fullMarkdown = markdown;
      }

      // Add follow-up questions if available
      if (result.result.report && result.result.report.followUpQuestions) {
        formatted.followUpQuestions = result.result.report.followUpQuestions;
      }
    }

    return formatted;
  } catch (error) {
    console.error('[formatResearchResult] Error formatting research result:', error);
    // Return the original result if formatting fails
    return rawResult;
  }
}

/**
 * Get all research results with pagination and filtering
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getResearchResults = async (req, res) => {
  try {
    const { page = 1, limit = 10, userId, tags, search, startDate, endDate, status, format = 'full' } = req.query;
    
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
    
    // Format results based on the request
    let formattedResults;
    
    if (format === 'summary') {
      // Provide just summary information for list views
      formattedResults = results.map(result => ({
        id: result._id,
        query: result.query,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
        status: result.status,
        summary: result.result?.report?.shortSummary || '',
        tags: result.tags || []
      }));
    } else if (format === 'compact') {
      // Provide a compact version with essential information
      formattedResults = results.map(result => {
        const formatted = {
          id: result._id,
          query: result.query,
          createdAt: result.createdAt,
          status: result.status,
          summary: result.result?.report?.shortSummary || '',
          hasReport: !!result.result?.report?.markdownReport,
          hasSearchResults: !!(result.result?.searchResults?.length > 0),
          followUpQuestionsCount: result.result?.report?.followUpQuestions?.length || 0
        };
        
        return formatted;
      });
    } else {
      // Full formatting for each result
      formattedResults = results.map(result => formatResearchResult(result));
    }
    
    res.status(200).json({
      success: true,
      data: formattedResults,
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
    const { query, limit = 10, format = 'full' } = req.query;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters',
        message: 'Search query is required'
      });
    }
    
    console.log(`[ResearchResultController] Searching for: ${query}`);
    
    // Enhanced search with multiple fields
    const searchCriteria = {
      $or: [
        // Text search in query field
        { query: { $regex: query, $options: 'i' } },
        
        // Check if query matches any ID fields exactly
        { researchId: query },
        { uuid: query },
        { originalId: query },
        { sessionId: query },
        { traceId: query },
        
        // Search in DTC code
        { dtcCode: { $regex: query, $options: 'i' } },
        
        // Search in vehicle info
        { "vehicle.make": { $regex: query, $options: 'i' } },
        { "vehicle.model": { $regex: query, $options: 'i' } },
        { "vehicle.vin": { $regex: query, $options: 'i' } },
        
        // Search in tags
        { tags: { $regex: query, $options: 'i' } },
        
        // Search in result content if possible
        { "result.summary": { $regex: query, $options: 'i' } },
        { "result.shortSummary": { $regex: query, $options: 'i' } },
        { "result.report.shortSummary": { $regex: query, $options: 'i' } },
      ]
    };
    
    // If text index is available, add it to the search
    try {
      const textSearchResults = await ResearchResult.find(
        { $text: { $search: query } },
        { score: { $meta: "textScore" } }
      )
      .sort({ score: { $meta: "textScore" } })
      .limit(parseInt(limit));
      
      // Get IDs from text search results
      const textSearchIds = textSearchResults.map(result => result._id);
      
      // Add text search results to the OR conditions
      if (textSearchIds.length > 0) {
        searchCriteria.$or.push({ _id: { $in: textSearchIds } });
      }
    } catch (textSearchError) {
      // If text search fails (e.g., no text index), just continue with regex search
      console.warn('[ResearchResultController] Text search failed:', textSearchError.message);
    }
    
    // Execute the search
    const results = await ResearchResult.find(searchCriteria)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));
    
    // Format results based on requested format
    let formattedResults;
    
    if (format === 'summary') {
      // Simplified results for list views
      formattedResults = results.map(result => ({
        _id: result._id,
        query: result.query,
        summary: result.result?.report?.shortSummary || result.result?.shortSummary || '',
        createdAt: result.createdAt,
        tags: result.tags || [],
        vehicle: result.vehicle,
        dtcCode: result.dtcCode,
        researchId: result.researchId,
        uuid: result.uuid,
        traceId: result.traceId
      }));
    } else if (format === 'compact') {
      // Very minimal results
      formattedResults = results.map(result => ({
        _id: result._id,
        query: result.query,
        createdAt: result.createdAt,
        researchId: result.researchId,
        uuid: result.uuid
      }));
    } else {
      // Full formatting for detailed results
      formattedResults = results.map(result => formatResearchResult(result));
    }
    
    res.status(200).json({
      success: true,
      data: formattedResults,
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