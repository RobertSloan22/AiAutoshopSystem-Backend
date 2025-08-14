import express from 'express';
import Plot from '../models/plot.model.js';

const router = express.Router();

// Get a specific plot by imageId
router.get('/:imageId', async (req, res) => {
  try {
    const { imageId } = req.params;
    const { download, format = 'png' } = req.query;
    
    const plot = await Plot.findOne({ imageId });
    if (!plot) {
      return res.status(404).json({ error: 'Plot not found' });
    }

    // Update access statistics
    await plot.updateAccess();

    // Set headers
    const filename = plot.filename || `plot_${imageId}.png`;
    
    if (download === 'true') {
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    } else {
      res.setHeader('Content-Disposition', 'inline');
    }
    
    res.setHeader('Content-Type', plot.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    res.setHeader('X-Plot-ID', imageId);
    res.setHeader('X-Generated-At', plot.createdAt.toISOString());
    res.setHeader('X-Execution-ID', plot.executionId);

    // Send the image data
    res.send(plot.imageData);
    
  } catch (error) {
    console.error('Error serving plot:', error);
    res.status(500).json({ error: 'Failed to serve plot' });
  }
});

// Get plot metadata
router.get('/:imageId/info', async (req, res) => {
  try {
    const { imageId } = req.params;
    const plot = await Plot.findOne({ imageId }).select('-imageData');
    
    if (!plot) {
      return res.status(404).json({ error: 'Plot not found' });
    }

    const info = {
      id: plot.imageId,
      filename: plot.filename,
      mimeType: plot.mimeType,
      size: plot.size,
      dimensions: plot.dimensions,
      executionId: plot.executionId,
      description: plot.description,
      tags: plot.tags,
      pythonCode: plot.pythonCode,
      pythonOutput: plot.pythonOutput,
      vehicleContext: plot.vehicleContext,
      customerContext: plot.customerContext,
      sessionId: plot.sessionId,
      createdAt: plot.createdAt,
      lastAccessed: plot.lastAccessed,
      accessCount: plot.accessCount,
      url: plot.url,
      thumbnailUrl: plot.thumbnailUrl
    };
    
    res.json(info);
    
  } catch (error) {
    console.error('Error getting plot info:', error);
    res.status(500).json({ error: 'Failed to get plot information' });
  }
});

// Get plot as base64 data
router.get('/:imageId/base64', async (req, res) => {
  try {
    const { imageId } = req.params;
    const plot = await Plot.findOne({ imageId });
    
    if (!plot) {
      return res.status(404).json({ error: 'Plot not found' });
    }

    // Update access statistics
    await plot.updateAccess();

    res.json({
      imageId: plot.imageId,
      base64Data: plot.base64Data,
      mimeType: plot.mimeType,
      filename: plot.filename
    });
    
  } catch (error) {
    console.error('Error getting plot base64:', error);
    res.status(500).json({ error: 'Failed to get plot base64 data' });
  }
});

// Get thumbnail (for now, returns the same image with different headers)
router.get('/:imageId/thumbnail', async (req, res) => {
  try {
    const { imageId } = req.params;
    const plot = await Plot.findOne({ imageId });
    
    if (!plot) {
      return res.status(404).json({ error: 'Plot not found' });
    }

    res.setHeader('Content-Type', plot.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=7200'); // Cache thumbnails longer
    res.setHeader('X-Image-Type', 'thumbnail');
    
    res.send(plot.imageData);
    
  } catch (error) {
    console.error('Error serving thumbnail:', error);
    res.status(500).json({ error: 'Failed to serve thumbnail' });
  }
});

// List all plots with filtering and pagination
router.get('/', async (req, res) => {
  try {
    const { 
      limit = 50, 
      offset = 0, 
      executionId, 
      sessionId,
      tag, 
      tags,
      vin,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    
    // Build query
    const query = {};
    
    if (executionId) query.executionId = executionId;
    if (sessionId) query.sessionId = sessionId;
    if (vin) query['vehicleContext.vin'] = vin;
    
    // Handle tags
    if (tag) {
      query.tags = tag;
    } else if (tags) {
      const tagArray = Array.isArray(tags) ? tags : tags.split(',');
      query.tags = { $in: tagArray };
    }
    
    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    // Execute query with pagination
    const plots = await Plot.find(query)
      .select('-imageData') // Don't include binary data in list
      .sort(sort)
      .limit(parseInt(limit))
      .skip(parseInt(offset));
    
    // Get total count for pagination
    const total = await Plot.countDocuments(query);
    
    // Transform to include virtual fields
    const plotList = plots.map(plot => ({
      id: plot.imageId,
      filename: plot.filename,
      mimeType: plot.mimeType,
      size: plot.size,
      dimensions: plot.dimensions,
      executionId: plot.executionId,
      description: plot.description,
      tags: plot.tags,
      vehicleContext: plot.vehicleContext,
      customerContext: plot.customerContext,
      sessionId: plot.sessionId,
      createdAt: plot.createdAt,
      lastAccessed: plot.lastAccessed,
      accessCount: plot.accessCount,
      url: plot.url,
      thumbnailUrl: plot.thumbnailUrl
    }));

    res.json({
      plots: plotList,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: total > parseInt(offset) + parseInt(limit)
      }
    });
    
  } catch (error) {
    console.error('Error listing plots:', error);
    res.status(500).json({ error: 'Failed to list plots' });
  }
});

// Get plots by execution ID
router.get('/execution/:executionId', async (req, res) => {
  try {
    const { executionId } = req.params;
    const { limit = 50, includeData = false } = req.query;
    
    const selectFields = includeData ? '' : '-imageData';
    const plots = await Plot.find({ executionId })
      .select(selectFields)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));
    
    if (includeData === 'true') {
      // Include base64 data for each plot
      const plotsWithData = plots.map(plot => ({
        ...plot.toJSON(),
        base64Data: plot.base64Data
      }));
      res.json(plotsWithData);
    } else {
      res.json(plots);
    }
    
  } catch (error) {
    console.error('Error getting plots by execution ID:', error);
    res.status(500).json({ error: 'Failed to get plots by execution ID' });
  }
});

// Get plots by session ID
router.get('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { limit = 50, includeData = false } = req.query;
    
    const selectFields = includeData ? '' : '-imageData';
    const plots = await Plot.find({ sessionId })
      .select(selectFields)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));
    
    if (includeData === 'true') {
      // Include base64 data for each plot
      const plotsWithData = plots.map(plot => ({
        ...plot.toJSON(),
        base64Data: plot.base64Data
      }));
      res.json(plotsWithData);
    } else {
      res.json(plots);
    }
    
  } catch (error) {
    console.error('Error getting plots by session ID:', error);
    res.status(500).json({ error: 'Failed to get plots by session ID' });
  }
});

// Get plots by tags
router.get('/tags/:tag', async (req, res) => {
  try {
    const { tag } = req.params;
    const { limit = 50, includeData = false } = req.query;
    
    const selectFields = includeData ? '' : '-imageData';
    const plots = await Plot.find({ tags: tag })
      .select(selectFields)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));
    
    if (includeData === 'true') {
      // Include base64 data for each plot
      const plotsWithData = plots.map(plot => ({
        ...plot.toJSON(),
        base64Data: plot.base64Data
      }));
      res.json(plotsWithData);
    } else {
      res.json(plots);
    }
    
  } catch (error) {
    console.error('Error getting plots by tag:', error);
    res.status(500).json({ error: 'Failed to get plots by tag' });
  }
});

// Update plot metadata
router.patch('/:imageId', async (req, res) => {
  try {
    const { imageId } = req.params;
    const allowedUpdates = ['description', 'tags', 'isPublic', 'vehicleContext', 'customerContext'];
    const updates = {};
    
    // Filter allowed updates
    for (const key of allowedUpdates) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }
    
    const plot = await Plot.findOneAndUpdate(
      { imageId },
      updates,
      { new: true, runValidators: true }
    ).select('-imageData');
    
    if (!plot) {
      return res.status(404).json({ error: 'Plot not found' });
    }
    
    res.json(plot);
    
  } catch (error) {
    console.error('Error updating plot:', error);
    res.status(500).json({ error: 'Failed to update plot' });
  }
});

// Delete a plot
router.delete('/:imageId', async (req, res) => {
  try {
    const { imageId } = req.params;
    
    const plot = await Plot.findOneAndDelete({ imageId });
    if (!plot) {
      return res.status(404).json({ error: 'Plot not found' });
    }
    
    res.json({ message: 'Plot deleted successfully', imageId });
    
  } catch (error) {
    console.error('Error deleting plot:', error);
    res.status(500).json({ error: 'Failed to delete plot' });
  }
});

// Bulk delete plots
router.delete('/', async (req, res) => {
  try {
    const { imageIds, executionId, sessionId, olderThan, tag } = req.body;
    
    let query = {};
    
    if (imageIds && Array.isArray(imageIds)) {
      query.imageId = { $in: imageIds };
    } else if (executionId) {
      query.executionId = executionId;
    } else if (sessionId) {
      query.sessionId = sessionId;
    } else if (tag) {
      query.tags = tag;
    } else if (olderThan) {
      query.createdAt = { $lt: new Date(olderThan) };
    } else {
      return res.status(400).json({ error: 'Must specify deletion criteria' });
    }
    
    // Don't delete public plots unless explicitly requested
    if (req.body.includePublic !== true) {
      query.isPublic = { $ne: true };
    }
    
    const result = await Plot.deleteMany(query);
    
    res.json({
      deleted: result.deletedCount,
      message: `Successfully deleted ${result.deletedCount} plots`
    });
    
  } catch (error) {
    console.error('Error bulk deleting plots:', error);
    res.status(500).json({ error: 'Failed to bulk delete plots' });
  }
});

// Cleanup old plots (maintenance endpoint)
router.post('/cleanup', async (req, res) => {
  try {
    const { maxAgeMs = 7 * 24 * 60 * 60 * 1000 } = req.body; // Default 7 days
    
    const deletedCount = await Plot.cleanupOld(maxAgeMs);
    
    res.json({
      message: `Cleanup completed`,
      deletedCount,
      maxAgeMs
    });
    
  } catch (error) {
    console.error('Error during cleanup:', error);
    res.status(500).json({ error: 'Failed to cleanup plots' });
  }
});

// Get plot statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const [
      totalPlots,
      totalSize,
      recentPlots,
      topTags,
      topExecutions
    ] = await Promise.all([
      Plot.countDocuments({}),
      Plot.aggregate([{ $group: { _id: null, totalSize: { $sum: '$size' } } }]),
      Plot.countDocuments({ createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
      Plot.aggregate([
        { $unwind: '$tags' },
        { $group: { _id: '$tags', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      Plot.aggregate([
        { $group: { _id: '$executionId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ])
    ]);
    
    res.json({
      totalPlots,
      totalSizeBytes: totalSize[0]?.totalSize || 0,
      recentPlots,
      topTags: topTags.map(t => ({ tag: t._id, count: t.count })),
      topExecutions: topExecutions.map(e => ({ executionId: e._id, count: e.count }))
    });
    
  } catch (error) {
    console.error('Error getting plot statistics:', error);
    res.status(500).json({ error: 'Failed to get plot statistics' });
  }
});

export default router;