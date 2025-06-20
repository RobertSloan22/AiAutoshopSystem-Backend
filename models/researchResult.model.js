import mongoose from "mongoose";

const researchResultSchema = new mongoose.Schema(
  {
    query: {
      type: String,
      required: true,
      index: true
    },
    result: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    sources: {
      type: [String],
      default: []
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false
    },
    tags: {
      type: [String],
      default: []
    },
    status: {
      type: String,
      enum: ["pending", "in-progress", "completed", "failed"],
      default: "completed"
    },
    // Vehicle context information
    vehicle: {
      year: String,
      make: String,
      model: String,
      vin: String,
      engine: String,
      transmission: String
    },
    dtcCode: String,
    
    // Add these UUID fields to handle different ID formats
    researchId: { type: String, index: true }, // UUID from research system
    uuid: { type: String, index: true },       // Alternative UUID field
    originalId: { type: String, index: true }, // Original ID from request
    sessionId: { type: String, index: true },  // Session ID if available
    traceId: { type: String, index: true },    // Trace ID for debugging
    
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  { 
    timestamps: true
  }
);

// Create indexes for faster searching
researchResultSchema.index({ query: 'text' });
researchResultSchema.index({ tags: 1 });
researchResultSchema.index({ userId: 1 });
researchResultSchema.index({ status: 1 });
researchResultSchema.index({ createdAt: -1 });
researchResultSchema.index({ researchId: 1 });
researchResultSchema.index({ uuid: 1 });
researchResultSchema.index({ originalId: 1 });
researchResultSchema.index({ traceId: 1 });
researchResultSchema.index({ "vehicle.vin": 1 });
researchResultSchema.index({ dtcCode: 1 });

const ResearchResult = mongoose.model("ResearchResult", researchResultSchema);

export default ResearchResult;