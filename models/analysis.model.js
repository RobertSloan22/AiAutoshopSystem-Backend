// models/analysis.model.js - Stores OBD2 analysis results and visualizations

import mongoose from 'mongoose';

const AnalysisSchema = new mongoose.Schema({
  // Unique analysis identifier
  analysisId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  // Reference to diagnostic session
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DiagnosticSession',
    required: true,
    index: true
  },

  // Analysis metadata
  analysisType: {
    type: String,
    enum: ['comprehensive', 'quick_overview', 'anomaly_detection', 'interval_analysis', 'dtc_focused', 'custom'],
    required: true
  },

  // When this analysis was performed
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },

  // Analysis status
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'failed'],
    default: 'pending'
  },

  // How long the analysis took (seconds)
  duration: Number,

  // Analysis results (text output from agent)
  result: {
    type: String,
    required: false
  },

  // Structured analysis data
  structuredData: {
    summary: mongoose.Schema.Types.Mixed,
    anomalies: mongoose.Schema.Types.Mixed,
    healthScores: mongoose.Schema.Types.Mixed,
    recommendations: [mongoose.Schema.Types.Mixed],
    statistics: mongoose.Schema.Types.Mixed
  },

  // Visualizations/plots
  plots: [{
    filename: String,
    base64: String,
    mimeType: {
      type: String,
      default: 'image/png'
    },
    description: String,
    generatedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Context information
  context: {
    dataPointCount: Number,
    timeRange: {
      start: Date,
      end: Date
    },
    dtcCodes: [String],
    vehicleInfo: mongoose.Schema.Types.Mixed,
    customerContext: mongoose.Schema.Types.Mixed
  },

  // AI model information
  modelInfo: {
    model: String,
    reasoningEffort: String,
    tokenUsage: mongoose.Schema.Types.Mixed
  },

  // Error information (if analysis failed)
  error: {
    message: String,
    stack: String,
    timestamp: Date
  },

  // Tags for categorization
  tags: [String],

  // User notes/comments
  notes: String,

  // Sharing settings
  isShared: {
    type: Boolean,
    default: false
  },
  shareCode: String,

  // Soft delete
  isDeleted: {
    type: Boolean,
    default: false
  }

}, {
  timestamps: true,
  // Automatically create createdAt and updatedAt fields
});

// Indexes for efficient queries
AnalysisSchema.index({ sessionId: 1, timestamp: -1 });
AnalysisSchema.index({ analysisType: 1, status: 1 });
AnalysisSchema.index({ 'context.dtcCodes': 1 });
AnalysisSchema.index({ tags: 1 });

// Virtual for analysis URL
AnalysisSchema.virtual('analysisUrl').get(function() {
  return `/api/obd2/analysis/${this.analysisId}`;
});

// Method to generate unique analysis ID
AnalysisSchema.statics.generateAnalysisId = function() {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `analysis_${timestamp}_${randomStr}`;
};

// Method to add plot to analysis
AnalysisSchema.methods.addPlot = function(plotData) {
  this.plots.push({
    filename: plotData.filename,
    base64: plotData.base64,
    mimeType: plotData.mimeType || 'image/png',
    description: plotData.description,
    generatedAt: new Date()
  });
};

// Method to mark analysis as completed
AnalysisSchema.methods.complete = function(result, duration) {
  this.status = 'completed';
  this.result = result;
  this.duration = duration;
  return this.save();
};

// Method to mark analysis as failed
AnalysisSchema.methods.fail = function(error) {
  this.status = 'failed';
  this.error = {
    message: error.message,
    stack: error.stack,
    timestamp: new Date()
  };
  return this.save();
};

const Analysis = mongoose.model('Analysis', AnalysisSchema);

export default Analysis;
