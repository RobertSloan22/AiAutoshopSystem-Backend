import express from "express";
import ImageAnalysis from "../models/imageAnalysis.model.js";
import protectRoute from "../middleware/protectRoute.js";

const router = express.Router();

// Get all image analyses
router.get("/", protectRoute, async (req, res) => {
  try {
    const { page = 1, limit = 10, conversationId, userId } = req.query;
    const skip = (page - 1) * limit;
    
    const filter = {};
    if (conversationId) filter.conversationId = conversationId;
    if (userId) filter.userId = userId;
    
    const analyses = await ImageAnalysis.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await ImageAnalysis.countDocuments(filter);
    
    res.status(200).json({
      success: true,
      data: analyses,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("Error in get image analyses:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get image analysis by ID
router.get("/:id", protectRoute, async (req, res) => {
  try {
    const analysis = await ImageAnalysis.findById(req.params.id);
    
    if (!analysis) {
      return res.status(404).json({ success: false, error: "Image analysis not found" });
    }
    
    res.status(200).json({ success: true, data: analysis });
  } catch (error) {
    console.error("Error in get image analysis by ID:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get image analyses by conversation ID
router.get("/conversation/:conversationId", protectRoute, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const analyses = await ImageAnalysis.find({ conversationId })
      .sort({ timestamp: -1 });
    
    res.status(200).json({ success: true, data: analyses });
  } catch (error) {
    console.error("Error in get image analyses by conversation:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete image analysis
router.delete("/:id", protectRoute, async (req, res) => {
  try {
    const deletedAnalysis = await ImageAnalysis.findByIdAndDelete(req.params.id);
    
    if (!deletedAnalysis) {
      return res.status(404).json({ success: false, error: "Image analysis not found" });
    }
    
    res.status(200).json({ success: true, message: "Image analysis deleted successfully" });
  } catch (error) {
    console.error("Error in delete image analysis:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;