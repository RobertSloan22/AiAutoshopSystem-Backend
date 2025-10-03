import express from 'express';
import Image from '../models/image.model.js';
import protectRoute from "../middleware/protectRoute.js";

const router = express.Router();

router.post('/images', async (req, res) => {
    try {
        const { imageUrl, thumbnailUrl, title, source, link, originalUrl } = req.body;
        
        // Create image record
        const imageData = {
            title: title || 'Untitled',
            imageUrl: imageUrl,
            thumbnailUrl: thumbnailUrl || imageUrl,
            source: source || new URL(imageUrl).hostname,
            link: link || imageUrl,
            originalUrl: originalUrl || imageUrl,
            timestamp: new Date()
        };
        
        const savedImage = await Image.create(imageData);
        res.status(201).json(savedImage);
    } catch (error) {
        console.error('Failed to save image:', error);
        res.status(500).json({ 
            error: 'Failed to save image',
            details: error.message 
        });
    }
});

router.get('/images', async (req, res) => {
  try {
    const images = await Image.find().sort({ timestamp: -1 }); // Sort by newest first
    res.json(images);
  } catch (error) {
    console.error('Failed to fetch images:', error);
    res.status(500).json({ error: 'Failed to fetch images' });
  }
});

router.delete('/images/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deletedImage = await Image.findByIdAndDelete(id);
    
    if (!deletedImage) {
      return res.status(404).json({ error: 'Image not found' });
    }
    
    res.json({ message: 'Image deleted successfully' });
  } catch (error) {
    console.error('Failed to delete image:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

export default router;
