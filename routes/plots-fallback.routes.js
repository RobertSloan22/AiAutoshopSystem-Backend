import express from 'express';
import Plot from '../models/plot.model.js';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Fallback endpoint to find plots by various criteria
router.post('/find', async (req, res) => {
  try {
    const { 
      sessionId, 
      executionId, 
      timeRange,
      includeOrphaned = false 
    } = req.body;

    console.log('🔍 PLOT FALLBACK: Searching for plots with criteria:', {
      sessionId,
      executionId,
      timeRange,
      includeOrphaned
    });

    let query = {};
    
    // Build query based on provided criteria
    if (sessionId) {
      // Try exact match first
      query.sessionId = sessionId;
    }
    
    if (executionId) {
      query.executionId = executionId;
    }
    
    // If no results with session ID, try time-based search
    let plots = await Plot.find(query)
      .select('-imageData')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    console.log(`🔍 PLOT FALLBACK: Found ${plots.length} plots with primary query`);

    // If no plots found and we have a sessionId, try alternative searches
    if (plots.length === 0 && sessionId) {
      console.log('🔍 PLOT FALLBACK: Trying alternative search methods...');
      
      // Method 1: Search by partial session ID (last 8 characters)
      const partialSessionId = sessionId.slice(-8);
      const regexQuery = {
        $or: [
          { sessionId: { $regex: partialSessionId, $options: 'i' } },
          { 'metadata.sessionId': { $regex: partialSessionId, $options: 'i' } },
          { description: { $regex: partialSessionId, $options: 'i' } }
        ]
      };
      
      plots = await Plot.find(regexQuery)
        .select('-imageData')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();
      
      console.log(`🔍 PLOT FALLBACK: Found ${plots.length} plots with partial sessionId search`);
    }

    // If still no plots and timeRange provided, search by time
    if (plots.length === 0 && timeRange) {
      const { start, end } = timeRange;
      const timeQuery = {
        createdAt: {
          $gte: new Date(start || Date.now() - 300000), // Default to last 5 minutes
          $lte: new Date(end || Date.now())
        }
      };
      
      plots = await Plot.find(timeQuery)
        .select('-imageData')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();
      
      console.log(`🔍 PLOT FALLBACK: Found ${plots.length} plots with time range search`);
    }

    // Include orphaned plots if requested (plots without sessionId)
    if (includeOrphaned && plots.length === 0) {
      const orphanQuery = {
        $or: [
          { sessionId: null },
          { sessionId: { $exists: false } },
          { sessionId: '' }
        ],
        createdAt: { $gte: new Date(Date.now() - 300000) } // Last 5 minutes
      };
      
      plots = await Plot.find(orphanQuery)
        .select('-imageData')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();
      
      console.log(`🔍 PLOT FALLBACK: Found ${plots.length} orphaned plots`);
    }

    // Transform results
    const plotsWithUrls = plots.map(plot => ({
      id: plot.imageId,
      filename: plot.filename,
      sessionId: plot.sessionId,
      executionId: plot.executionId,
      description: plot.description,
      tags: plot.tags,
      createdAt: plot.createdAt,
      url: `/api/plots/${plot.imageId}`,
      thumbnailUrl: `/api/plots/${plot.imageId}/thumbnail`,
      base64Url: `/api/plots/${plot.imageId}/base64`
    }));

    res.json({
      success: true,
      plots: plotsWithUrls,
      searchCriteria: { sessionId, executionId, timeRange, includeOrphaned },
      message: plots.length > 0 
        ? `Found ${plots.length} plots using fallback search`
        : 'No plots found with any search method'
    });

  } catch (error) {
    console.error('❌ PLOT FALLBACK: Error in fallback search:', error);
    res.status(500).json({ 
      error: 'Failed to search for plots',
      message: error.message 
    });
  }
});

// Diagnostic endpoint to check recent plot generation
router.get('/diagnostic/recent', async (req, res) => {
  try {
    const { minutes = 5 } = req.query;
    
    const recentPlots = await Plot.find({
      createdAt: { $gte: new Date(Date.now() - minutes * 60000) }
    })
    .select('imageId filename sessionId executionId createdAt tags')
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

    // Check file system for any plots
    const tmpDir = '/tmp/python_outputs';
    let fileSystemPlots = [];
    
    try {
      const files = await fs.readdir(tmpDir);
      const pngFiles = files.filter(f => f.endsWith('.png'));
      
      for (const file of pngFiles.slice(0, 10)) {
        const stats = await fs.stat(path.join(tmpDir, file));
        fileSystemPlots.push({
          filename: file,
          size: stats.size,
          modified: stats.mtime
        });
      }
    } catch (err) {
      console.log('Could not read file system plots:', err.message);
    }

    res.json({
      databasePlots: {
        count: recentPlots.length,
        plots: recentPlots
      },
      fileSystemPlots: {
        count: fileSystemPlots.length,
        plots: fileSystemPlots
      },
      diagnosticInfo: {
        searchTimeRange: `Last ${minutes} minutes`,
        currentTime: new Date().toISOString(),
        tmpDirectory: tmpDir
      }
    });

  } catch (error) {
    console.error('❌ PLOT DIAGNOSTIC: Error:', error);
    res.status(500).json({ 
      error: 'Diagnostic check failed',
      message: error.message 
    });
  }
});

// Force association of orphaned plots with a session
router.post('/associate', async (req, res) => {
  try {
    const { sessionId, timeWindow = 300000 } = req.body; // Default 5 minutes

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    // Find orphaned plots within time window
    const orphanedPlots = await Plot.find({
      $or: [
        { sessionId: null },
        { sessionId: { $exists: false } },
        { sessionId: '' }
      ],
      createdAt: { $gte: new Date(Date.now() - timeWindow) }
    });

    console.log(`🔧 PLOT ASSOCIATION: Found ${orphanedPlots.length} orphaned plots to associate`);

    // Update them with the session ID
    const updateResult = await Plot.updateMany(
      {
        $or: [
          { sessionId: null },
          { sessionId: { $exists: false } },
          { sessionId: '' }
        ],
        createdAt: { $gte: new Date(Date.now() - timeWindow) }
      },
      {
        $set: { 
          sessionId: sessionId,
          updatedAt: new Date()
        }
      }
    );

    res.json({
      success: true,
      associated: updateResult.modifiedCount,
      message: `Associated ${updateResult.modifiedCount} plots with session ${sessionId}`
    });

  } catch (error) {
    console.error('❌ PLOT ASSOCIATION: Error:', error);
    res.status(500).json({ 
      error: 'Failed to associate plots',
      message: error.message 
    });
  }
});

export default router;