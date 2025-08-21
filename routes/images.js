import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const router = express.Router();

// Image metadata storage (in production, use a database)
const imageMetadata = new Map();

// Serve generated chart/plot images
router.get('/charts/:imageId', async (req, res) => {
  try {
    const { imageId } = req.params;
    const { download, format = 'png', quality = 'high' } = req.query;
    
    // Get metadata
    const metadata = imageMetadata.get(imageId);
    if (!metadata) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Check if file exists
    const imagePath = metadata.path;
    try {
      await fs.access(imagePath);
    } catch {
      // Remove stale metadata
      imageMetadata.delete(imageId);
      return res.status(404).json({ error: 'Image file not found' });
    }

    // Set headers
    const filename = metadata.filename || `chart_${imageId}.png`;
    const mimeType = metadata.mimeType || 'image/png';
    
    if (download === 'true') {
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    } else {
      res.setHeader('Content-Disposition', 'inline');
    }
    
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    res.setHeader('ETag', metadata.etag);
    res.setHeader('X-Image-ID', imageId);
    res.setHeader('X-Generated-At', metadata.createdAt);

    // Check if client has cached version
    if (req.headers['if-none-match'] === metadata.etag) {
      return res.status(304).end();
    }

    // Read and serve file
    const imageBuffer = await fs.readFile(imagePath);
    
    // Update access time
    metadata.lastAccessed = new Date().toISOString();
    
    res.send(imageBuffer);
    
  } catch (error) {
    console.error('Error serving image:', error);
    res.status(500).json({ error: 'Failed to serve image' });
  }
});

// Get image metadata
router.get('/charts/:imageId/info', async (req, res) => {
  try {
    const { imageId } = req.params;
    const metadata = imageMetadata.get(imageId);
    
    if (!metadata) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Check if file still exists
    try {
      const stats = await fs.stat(metadata.path);
      const info = {
        id: imageId,
        filename: metadata.filename,
        mimeType: metadata.mimeType,
        size: stats.size,
        createdAt: metadata.createdAt,
        lastAccessed: metadata.lastAccessed,
        dimensions: metadata.dimensions,
        executionId: metadata.executionId,
        description: metadata.description,
        tags: metadata.tags || []
      };
      
      res.json(info);
    } catch {
      imageMetadata.delete(imageId);
      res.status(404).json({ error: 'Image file not found' });
    }
    
  } catch (error) {
    console.error('Error getting image info:', error);
    res.status(500).json({ error: 'Failed to get image information' });
  }
});

// List all available images
router.get('/charts', async (req, res) => {
  try {
    const { limit = 50, offset = 0, executionId, tag } = req.query;
    
    let images = Array.from(imageMetadata.entries()).map(([id, metadata]) => ({
      id,
      filename: metadata.filename,
      createdAt: metadata.createdAt,
      executionId: metadata.executionId,
      description: metadata.description,
      tags: metadata.tags || [],
      url: `/api/images/charts/${id}`
    }));

    // Filter by executionId if provided
    if (executionId) {
      images = images.filter(img => img.executionId === executionId);
    }

    // Filter by tag if provided
    if (tag) {
      images = images.filter(img => img.tags.includes(tag));
    }

    // Sort by creation date (newest first)
    images.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Apply pagination
    const total = images.length;
    images = images.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    res.json({
      images,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: total > parseInt(offset) + parseInt(limit)
      }
    });
    
  } catch (error) {
    console.error('Error listing images:', error);
    res.status(500).json({ error: 'Failed to list images' });
  }
});

// Delete an image
router.delete('/charts/:imageId', async (req, res) => {
  try {
    const { imageId } = req.params;
    const metadata = imageMetadata.get(imageId);
    
    if (!metadata) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Delete file
    try {
      await fs.unlink(metadata.path);
    } catch (error) {
      console.warn('File already deleted or not found:', error.message);
    }

    // Remove metadata
    imageMetadata.delete(imageId);
    
    res.json({ message: 'Image deleted successfully' });
    
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

// Bulk delete images
router.delete('/charts', async (req, res) => {
  try {
    const { imageIds, executionId, olderThan } = req.body;
    
    let imagesToDelete = [];
    
    if (imageIds && Array.isArray(imageIds)) {
      imagesToDelete = imageIds;
    } else if (executionId) {
      imagesToDelete = Array.from(imageMetadata.entries())
        .filter(([id, metadata]) => metadata.executionId === executionId)
        .map(([id]) => id);
    } else if (olderThan) {
      const cutoffDate = new Date(olderThan);
      imagesToDelete = Array.from(imageMetadata.entries())
        .filter(([id, metadata]) => new Date(metadata.createdAt) < cutoffDate)
        .map(([id]) => id);
    }

    const results = {
      deleted: 0,
      errors: []
    };

    for (const imageId of imagesToDelete) {
      try {
        const metadata = imageMetadata.get(imageId);
        if (metadata) {
          await fs.unlink(metadata.path).catch(() => {}); // Ignore file deletion errors
          imageMetadata.delete(imageId);
          results.deleted++;
        }
      } catch (error) {
        results.errors.push({ imageId, error: error.message });
      }
    }
    
    res.json(results);
    
  } catch (error) {
    console.error('Error bulk deleting images:', error);
    res.status(500).json({ error: 'Failed to bulk delete images' });
  }
});

// Get image thumbnail (smaller version)
router.get('/charts/:imageId/thumbnail', async (req, res) => {
  try {
    const { imageId } = req.params;
    const metadata = imageMetadata.get(imageId);
    
    if (!metadata) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // For now, serve the original image with cache headers
    // In production, you might want to generate actual thumbnails
    const imagePath = metadata.path;
    
    try {
      await fs.access(imagePath);
    } catch {
      imageMetadata.delete(imageId);
      return res.status(404).json({ error: 'Image file not found' });
    }

    res.setHeader('Content-Type', metadata.mimeType || 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=7200'); // Cache thumbnails longer
    res.setHeader('X-Image-Type', 'thumbnail');
    
    const imageBuffer = await fs.readFile(imagePath);
    res.send(imageBuffer);
    
  } catch (error) {
    console.error('Error serving thumbnail:', error);
    res.status(500).json({ error: 'Failed to serve thumbnail' });
  }
});

// Register image (used by PythonExecutionService)
export const registerImage = (imagePath, options = {}) => {
  const imageId = options.id || crypto.randomUUID();
  const filename = options.filename || path.basename(imagePath);
  const now = new Date().toISOString();
  
  const metadata = {
    id: imageId,
    path: imagePath,
    filename,
    mimeType: options.mimeType || 'image/png',
    createdAt: now,
    lastAccessed: now,
    executionId: options.executionId,
    description: options.description,
    tags: options.tags || [],
    dimensions: options.dimensions,
    etag: crypto.createHash('md5').update(`${imagePath}-${now}`).digest('hex')
  };
  
  imageMetadata.set(imageId, metadata);
  return imageId;
};

// Get image metadata (for internal use)
export const getImageMetadata = (imageId) => {
  return imageMetadata.get(imageId);
};

// Cleanup old images
export const cleanupOldImages = async (maxAgeMs = 24 * 60 * 60 * 1000) => { // 24 hours
  const now = Date.now();
  let cleaned = 0;
  
  for (const [imageId, metadata] of imageMetadata.entries()) {
    const createdAt = new Date(metadata.createdAt).getTime();
    if (now - createdAt > maxAgeMs) {
      try {
        await fs.unlink(metadata.path).catch(() => {}); // Ignore errors
        imageMetadata.delete(imageId);
        cleaned++;
      } catch (error) {
        console.warn(`Failed to cleanup image ${imageId}:`, error.message);
      }
    }
  }
  
  console.log(`Cleaned up ${cleaned} old images`);
  return cleaned;
};

export default router;