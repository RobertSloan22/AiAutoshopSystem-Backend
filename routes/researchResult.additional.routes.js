import express from 'express';
import mongoose from 'mongoose';
import ResearchResult from '../models/researchResult.model.js';
import { formatResearchResult } from '../controllers/researchResult.controller.js';

const router = express.Router();

// Utility function to check if a string is a valid ObjectId
const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id) && /^[0-9a-fA-F]{24}$/.test(id);
};

// Route specifically for research ID lookup
router.get('/by-research-id/:researchId', async (req, res) => {
  try {
    const { researchId } = req.params;
    
    console.log(`Looking up research result by researchId: ${researchId}`);
    
    const result = await ResearchResult.findOne({ researchId });
    
    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Research result not found',
        message: `No research result found for research ID: ${researchId}`
      });
    }
    
    // Format the result using the formatter
    let formattedResult = result;
    try {
      formattedResult = formatResearchResult(result);
    } catch (formatError) {
      console.warn('Error formatting research result:', formatError);
    }
    
    res.status(200).json({
      success: true,
      data: formattedResult
    });
    
  } catch (error) {
    console.error('Error fetching research result by research ID:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve research result',
      message: error.message
    });
  }
});

// Route specifically for UUID lookup
router.get('/by-uuid/:uuid', async (req, res) => {
  try {
    const { uuid } = req.params;
    
    console.log(`Looking up research result by UUID: ${uuid}`);
    
    const result = await ResearchResult.findOne({ uuid });
    
    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Research result not found',
        message: `No research result found for UUID: ${uuid}`
      });
    }
    
    // Format the result using the formatter
    let formattedResult = result;
    try {
      formattedResult = formatResearchResult(result);
    } catch (formatError) {
      console.warn('Error formatting research result:', formatError);
    }
    
    res.status(200).json({
      success: true,
      data: formattedResult
    });
    
  } catch (error) {
    console.error('Error fetching research result by UUID:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve research result',
      message: error.message
    });
  }
});

// Route for trace ID lookup
router.get('/by-trace-id/:traceId', async (req, res) => {
  try {
    const { traceId } = req.params;
    
    console.log(`Looking up research result by traceId: ${traceId}`);
    
    const result = await ResearchResult.findOne({ traceId });
    
    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Research result not found',
        message: `No research result found for trace ID: ${traceId}`
      });
    }
    
    // Format the result using the formatter
    let formattedResult = result;
    try {
      formattedResult = formatResearchResult(result);
    } catch (formatError) {
      console.warn('Error formatting research result:', formatError);
    }
    
    res.status(200).json({
      success: true,
      data: formattedResult
    });
    
  } catch (error) {
    console.error('Error fetching research result by trace ID:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve research result',
      message: error.message
    });
  }
});

// Route for DTC code lookup
router.get('/by-dtc/:dtcCode', async (req, res) => {
  try {
    const { dtcCode } = req.params;
    
    console.log(`Looking up research results by DTC code: ${dtcCode}`);
    
    const results = await ResearchResult.find({ dtcCode })
      .sort({ createdAt: -1 })
      .limit(10);
    
    if (!results || results.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Research results not found',
        message: `No research results found for DTC code: ${dtcCode}`
      });
    }
    
    // Format results if formatter is available
    let formattedResults = results;
    try {
      if (typeof formatResearchResult === 'function') {
        formattedResults = results.map(result => formatResearchResult(result));
      }
    } catch (formatError) {
      console.warn('Error formatting research results:', formatError);
    }
    
    res.status(200).json({
      success: true,
      data: formattedResults
    });
    
  } catch (error) {
    console.error('Error fetching research results by DTC code:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve research results',
      message: error.message
    });
  }
});

// Route for vehicle lookup (by VIN)
router.get('/by-vin/:vin', async (req, res) => {
  try {
    const { vin } = req.params;
    
    console.log(`Looking up research results by VIN: ${vin}`);
    
    const results = await ResearchResult.find({ "vehicle.vin": vin })
      .sort({ createdAt: -1 })
      .limit(10);
    
    if (!results || results.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Research results not found',
        message: `No research results found for VIN: ${vin}`
      });
    }
    
    // Format results if formatter is available
    let formattedResults = results;
    try {
      if (typeof formatResearchResult === 'function') {
        formattedResults = results.map(result => formatResearchResult(result));
      }
    } catch (formatError) {
      console.warn('Error formatting research results:', formatError);
    }
    
    res.status(200).json({
      success: true,
      data: formattedResults
    });
    
  } catch (error) {
    console.error('Error fetching research results by VIN:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve research results',
      message: error.message
    });
  }
});

export default router;