import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    title: {
      type: String,
      required: true,
      maxlength: 200
    },
    items: [{
      id: String,
      role: String,
      formatted: {
        text: { type: String, maxlength: 10000 }
      },
      metadata: {
        conversation_id: String,
        timestamp: String
      }
    }],
    realtimeEvents: [{
      type: {
        type: String
      },
      timestamp: {
        type: Date
      },
      data: mongoose.Schema.Types.Mixed
    }],
    lastExchange: {
      userMessage: { type: String, maxlength: 1000 },
      assistantMessage: { type: String, maxlength: 1000 }
    },
    keyPoints: [{ type: String, maxlength: 500 }],
    notes: [{
      timestamp: Date,
      topic: { type: String, maxlength: 200 },
      tags: [{ type: String, maxlength: 50 }],
      keyPoints: [{ type: String, maxlength: 500 }],
      codeExamples: [{
        language: { type: String, maxlength: 50 },
        code: { type: String, maxlength: 5000 }
      }],
      resources: [{ type: String, maxlength: 500 }]
    }]
  },
  { timestamps: true,
    validate: {
      validator: function(doc) {
        const size = Buffer.from(JSON.stringify(doc)).length;
        return size <= 16000000; // 16MB limit (MongoDB's document size limit)
      },
      message: 'Document size exceeds MongoDB limit'
    }
  }
);

const Conversation = mongoose.model("Conversation", conversationSchema);

export default Conversation;