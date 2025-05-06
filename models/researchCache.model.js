import mongoose from "mongoose";

const researchCacheSchema = new mongoose.Schema(
  {
    vehicleInfo: {
      vin: { type: String, default: null },
      year: { type: String, required: true },
      make: { type: String, required: true },
      model: { type: String, required: true },
      trim: { type: String, default: null },
      engine: { type: String, default: null },
      transmission: { type: String, default: null },
      mileage: { type: String, default: null }
    },
    problem: {
      type: String,
      required: true
    },
    dtcCodes: {
      type: [String],
      default: []
    },
    result: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      required: false
    }
  },
  { 
    timestamps: true,
    // Add index for all the search fields
    index: {
      "vehicleInfo.year": 1,
      "vehicleInfo.make": 1,
      "vehicleInfo.model": 1,
      problem: 1
    }
  }
);

// Create compound index for faster lookups
researchCacheSchema.index({ 
  "vehicleInfo.year": 1, 
  "vehicleInfo.make": 1, 
  "vehicleInfo.model": 1, 
  problem: 1 
});

// Index for DTC code search
researchCacheSchema.index({ dtcCodes: 1 });

const ResearchCache = mongoose.model("ResearchCache", researchCacheSchema);

export default ResearchCache; 