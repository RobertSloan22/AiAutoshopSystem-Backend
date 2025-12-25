import ComprehensiveReport from '../models/comprehensiveReport.model.js';
import DiagnosticSession from '../models/diagnosticSession.model.js';
import mongoose from 'mongoose';

// POST /api/obd2/sessions/:sessionId/reports
export const saveComprehensiveReport = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const reportData = req.body;

    // Validate sessionId format (must be MongoDB ObjectId)
    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid session ID format',
        message: `Session ID must be a valid MongoDB ObjectId: ${sessionId}`
      });
    }

    // Validate session exists
    const session = await DiagnosticSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
        message: `No session found with ID: ${sessionId}`
      });
    }

    // Generate report ID
    const reportId = `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Validate required fields
    if (!reportData.summary || !reportData.dtcCodes) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: 'Summary and dtcCodes are required fields'
      });
    }

    // Create report
    const report = new ComprehensiveReport({
      reportId,
      sessionId,
      ...reportData,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await report.save();

    res.status(200).json({
      success: true,
      reportId: reportId,
      message: 'Report saved successfully'
    });
  } catch (error) {
    console.error('Error saving comprehensive report:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: error.message,
        details: error.errors
      });
    }

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        error: 'Duplicate report',
        message: 'A report with this ID already exists'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
};

// GET /api/obd2/sessions/:sessionId/reports/latest
export const getLatestReport = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const report = await ComprehensiveReport.findLatestBySessionId(sessionId);

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Not found',
        message: 'No report found for this session'
      });
    }

    res.status(200).json({
      success: true,
      report: report
    });
  } catch (error) {
    console.error('Error fetching latest report:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
};

// GET /api/obd2/sessions/:sessionId/reports
export const getAllReports = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { limit = 10, offset = 0 } = req.query;

    const limitNum = parseInt(limit);
    const offsetNum = parseInt(offset);

    // Validate query parameters
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        success: false,
        error: 'Invalid limit',
        message: 'Limit must be a number between 1 and 100'
      });
    }

    if (isNaN(offsetNum) || offsetNum < 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid offset',
        message: 'Offset must be a non-negative number'
      });
    }

    // Get reports with pagination
    const reports = await ComprehensiveReport.find({ sessionId })
      .sort({ createdAt: -1 })
      .skip(offsetNum)
      .limit(limitNum)
      .select('reportId summary priority createdAt updatedAt');

    // Get total count for pagination info
    const total = await ComprehensiveReport.countDocuments({ sessionId });

    res.status(200).json({
      success: true,
      reports: reports,
      total: total,
      limit: limitNum,
      offset: offsetNum
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
};

// GET /api/obd2/reports/:reportId - Get specific report by ID
export const getReportById = async (req, res) => {
  try {
    const { reportId } = req.params;

    const report = await ComprehensiveReport.findOne({ reportId });

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Not found',
        message: 'Report not found'
      });
    }

    res.status(200).json({
      success: true,
      report: report
    });
  } catch (error) {
    console.error('Error fetching report by ID:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
};

// PUT /api/obd2/reports/:reportId - Update existing report
export const updateReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    const updateData = req.body;

    // Remove fields that shouldn't be updated
    delete updateData.reportId;
    delete updateData.sessionId;
    delete updateData.createdAt;

    const report = await ComprehensiveReport.findOneAndUpdate(
      { reportId },
      { ...updateData, updatedAt: new Date() },
      { new: true, runValidators: true }
    );

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Not found',
        message: 'Report not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Report updated successfully',
      report: report
    });
  } catch (error) {
    console.error('Error updating report:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: error.message,
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
};

// DELETE /api/obd2/reports/:reportId - Delete report
export const deleteReport = async (req, res) => {
  try {
    const { reportId } = req.params;

    const report = await ComprehensiveReport.findOneAndDelete({ reportId });

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Not found',
        message: 'Report not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Report deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting report:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
};

// GET /api/obd2/reports/all - Get all comprehensive reports from database
export const getAllComprehensiveReports = async (req, res) => {
  try {
    const { limit = 20, offset = 0, sortBy = 'createdAt', order = 'desc' } = req.query;

    const limitNum = parseInt(limit);
    const offsetNum = parseInt(offset);

    // Validate query parameters
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 200) {
      return res.status(400).json({
        success: false,
        error: 'Invalid limit',
        message: 'Limit must be a number between 1 and 200'
      });
    }

    if (isNaN(offsetNum) || offsetNum < 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid offset',
        message: 'Offset must be a non-negative number'
      });
    }

    // Build sort object
    const sortOrder = order === 'desc' ? -1 : 1;
    const sortObj = { [sortBy]: sortOrder };

    // Get all reports with pagination and sorting
    const reports = await ComprehensiveReport.find({})
      .sort(sortObj)
      .skip(offsetNum)
      .limit(limitNum)
      .lean(); // Use lean() for better performance when not modifying documents

    // Get total count for pagination info
    const total = await ComprehensiveReport.countDocuments({});

    res.status(200).json({
      success: true,
      data: reports,
      pagination: {
        total,
        limit: limitNum,
        offset: offsetNum,
        pages: Math.ceil(total / limitNum),
        currentPage: Math.floor(offsetNum / limitNum) + 1
      }
    });
  } catch (error) {
    console.error('Error fetching all comprehensive reports:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
};