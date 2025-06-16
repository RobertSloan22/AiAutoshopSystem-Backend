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

const ResearchResult = mongoose.model("ResearchResult", researchResultSchema);

export default ResearchResult;