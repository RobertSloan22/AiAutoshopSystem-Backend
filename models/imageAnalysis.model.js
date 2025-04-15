import mongoose from "mongoose";

const imageAnalysisSchema = new mongoose.Schema(
  {
    imageUrl: {
      type: String,
      required: true,
      index: true,
    },
    prompt: {
      type: String,
      required: true,
    },
    explanation: {
      type: String,
      required: true,
    },
    responseId: {
      type: String,
      required: true,
    },
    conversationId: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      required: false,
    }
  },
  { timestamps: true }
);

// Create compound index for faster lookups
imageAnalysisSchema.index({ imageUrl: 1, prompt: 1 });

const ImageAnalysis = mongoose.model("ImageAnalysis", imageAnalysisSchema);

export default ImageAnalysis; 