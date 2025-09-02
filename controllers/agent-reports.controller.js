import ResearchResult from '../models/researchResult.model.js';

/**
 * Get all agent reports with pagination and filtering
 */
export const getAllAgentReports = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      status
    } = req.query;

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    // Build filter query
    const filter = {};
    if (status) {
      filter.status = status;
    }

    // Only get reports that have result data (agent-generated reports)
    filter['result.executiveSummary'] = { $exists: true };

    const [reports, total] = await Promise.all([
      ResearchResult.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .select('-__v'),
      ResearchResult.countDocuments(filter)
    ]);

    const pages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: reports,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages
      }
    });
  } catch (error) {
    console.error('Error fetching agent reports:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch agent reports',
      message: error.message
    });
  }
};

/**
 * Get agent report by ID
 */
export const getAgentReportById = async (req, res) => {
  try {
    const { id } = req.params;

    // Try to find by MongoDB ID or researchId
    const report = await ResearchResult.findOne({
      $and: [
        { $or: [{ _id: id }, { researchId: id }] },
        { 'result.executiveSummary': { $exists: true } }
      ]
    }).select('-__v');

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Agent report not found'
      });
    }

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Error fetching agent report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch agent report',
      message: error.message
    });
  }
};

/**
 * Search agent reports by query text
 */
export const searchAgentReports = async (req, res) => {
  try {
    const { q, searchIn = ['query', 'executiveSummary'], limit = 20 } = req.query;

    if (!q || q.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    // Build search conditions
    const searchConditions = [];
    
    if (searchIn.includes('query')) {
      searchConditions.push({ query: { $regex: q, $options: 'i' } });
    }
    
    if (searchIn.includes('executiveSummary')) {
      searchConditions.push({ 'result.executiveSummary': { $regex: q, $options: 'i' } });
    }
    
    if (searchIn.includes('tags')) {
      searchConditions.push({ tags: { $in: [new RegExp(q, 'i')] } });
    }

    const filter = {
      $and: [
        { 'result.executiveSummary': { $exists: true } },
        { $or: searchConditions }
      ]
    };

    const reports = await ResearchResult.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .select('-__v');

    res.json({
      success: true,
      data: reports,
      count: reports.length
    });
  } catch (error) {
    console.error('Error searching agent reports:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search agent reports',
      message: error.message
    });
  }
};

/**
 * Get agent reports by date range
 */
export const getAgentReportsByDateRange = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Both startDate and endDate are required'
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999); // Include entire end date

    const reports = await ResearchResult.find({
      'result.executiveSummary': { $exists: true },
      createdAt: { $gte: start, $lte: end }
    })
      .sort({ createdAt: -1 })
      .select('-__v');

    res.json({
      success: true,
      data: reports,
      count: reports.length
    });
  } catch (error) {
    console.error('Error fetching reports by date:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch reports by date',
      message: error.message
    });
  }
};

/**
 * Get agent reports by vehicle information
 */
export const getAgentReportsByVehicle = async (req, res) => {
  try {
    const { make, model, year, vin } = req.query;

    const vehicleFilter = {};
    if (make) vehicleFilter['vehicle.make'] = new RegExp(make, 'i');
    if (model) vehicleFilter['vehicle.model'] = new RegExp(model, 'i');
    if (year) vehicleFilter['vehicle.year'] = year;
    if (vin) vehicleFilter['vehicle.vin'] = vin;

    const filter = {
      'result.executiveSummary': { $exists: true },
      ...vehicleFilter
    };

    const reports = await ResearchResult.find(filter)
      .sort({ createdAt: -1 })
      .select('-__v');

    res.json({
      success: true,
      data: reports,
      count: reports.length
    });
  } catch (error) {
    console.error('Error fetching reports by vehicle:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch reports by vehicle',
      message: error.message
    });
  }
};

/**
 * Get agent reports by status
 */
export const getAgentReportsByStatus = async (req, res) => {
  try {
    const { status } = req.params;
    const validStatuses = ['pending', 'completed', 'failed'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be one of: pending, completed, failed'
      });
    }

    const reports = await ResearchResult.find({
      'result.executiveSummary': { $exists: true },
      status
    })
      .sort({ createdAt: -1 })
      .select('-__v');

    res.json({
      success: true,
      data: reports,
      count: reports.length
    });
  } catch (error) {
    console.error('Error fetching reports by status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch reports by status',
      message: error.message
    });
  }
};

/**
 * Get statistics about agent reports
 */
export const getAgentReportsStats = async (req, res) => {
  try {
    const baseFilter = { 'result.executiveSummary': { $exists: true } };

    // Get total count and status breakdown
    const [totalReports, statusCounts] = await Promise.all([
      ResearchResult.countDocuments(baseFilter),
      ResearchResult.aggregate([
        { $match: baseFilter },
        { 
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    // Get reports by month (last 12 months)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const reportsByMonth = await ResearchResult.aggregate([
      {
        $match: {
          ...baseFilter,
          createdAt: { $gte: twelveMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      },
      {
        $project: {
          month: {
            $dateToString: {
              format: '%Y-%m',
              date: {
                $dateFromParts: {
                  year: '$_id.year',
                  month: '$_id.month'
                }
              }
            }
          },
          count: 1,
          _id: 0
        }
      }
    ]);

    // Get top search queries
    const topSearchQueries = await ResearchResult.aggregate([
      { $match: baseFilter },
      {
        $group: {
          _id: '$query',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $project: {
          query: '$_id',
          count: 1,
          _id: 0
        }
      }
    ]);

    // Format status counts
    const reportsByStatus = {
      pending: 0,
      completed: 0,
      failed: 0
    };
    
    statusCounts.forEach(item => {
      if (item._id && reportsByStatus.hasOwnProperty(item._id)) {
        reportsByStatus[item._id] = item.count;
      }
    });

    res.json({
      success: true,
      data: {
        totalReports,
        reportsByStatus,
        reportsByMonth,
        topSearchQueries
      }
    });
  } catch (error) {
    console.error('Error fetching report statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch report statistics',
      message: error.message
    });
  }
};

/**
 * Update tags for an agent report
 */
export const updateAgentReportTags = async (req, res) => {
  try {
    const { id } = req.params;
    const { tags } = req.body;

    if (!Array.isArray(tags)) {
      return res.status(400).json({
        success: false,
        error: 'Tags must be an array'
      });
    }

    const report = await ResearchResult.findOneAndUpdate(
      {
        $and: [
          { $or: [{ _id: id }, { researchId: id }] },
          { 'result.executiveSummary': { $exists: true } }
        ]
      },
      { tags },
      { new: true }
    ).select('-__v');

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Agent report not found'
      });
    }

    res.json({
      success: true,
      data: report,
      message: 'Tags updated successfully'
    });
  } catch (error) {
    console.error('Error updating report tags:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update report tags',
      message: error.message
    });
  }
};

/**
 * Delete an agent report
 */
export const deleteAgentReport = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await ResearchResult.findOneAndDelete({
      $and: [
        { $or: [{ _id: id }, { researchId: id }] },
        { 'result.executiveSummary': { $exists: true } }
      ]
    });

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Agent report not found'
      });
    }

    res.json({
      success: true,
      message: 'Agent report deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting agent report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete agent report',
      message: error.message
    });
  }
};