import mongoose from 'mongoose';

const aiDiagnosticStepSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  priority: {
    type: Number,
    required: true,
    min: 1
  },
  category: {
    type: String,
    required: true
  },
  estimatedTime: {
    type: String
  },
  tools: [{
    type: String
  }],
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard', 'expert'],
    default: 'medium'
  },
  order: {
    type: Number,
    required: true
  }
});

const comprehensiveReportSchema = new mongoose.Schema({
  reportId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  vehicleId: {
    type: String,
    index: true
  },
  customerId: {
    type: String,
    index: true
  },
  
  // Report Content
  summary: {
    type: String,
    required: true
  },
  activitySummary: {
    type: String
  },
  analysisResults: {
    type: String
  },
  recommendations: [{
    type: String
  }],
  keyFindings: [{
    type: String
  }],
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
    index: true
  },
  
  // Session Information
  sessionStartTime: {
    type: Date
  },
  sessionEndTime: {
    type: Date
  },
  dataPointsCount: {
    type: Number,
    default: 0
  },
  sessionDuration: {
    type: Number // in seconds
  },
  
  // Vehicle Information
  vehicleMake: {
    type: String
  },
  vehicleModel: {
    type: String
  },
  vehicleYear: {
    type: Number
  },
  vin: {
    type: String,
    maxlength: 17
  },
  mileage: {
    type: Number
  },
  licensePlate: {
    type: String
  },
  
  // Customer Information
  customerName: {
    type: String
  },
  
  // DTC Codes
  dtcCodes: {
    type: [String],
    required: true,
    default: []
  },
  pendingDtcCodes: {
    type: [String],
    default: []
  },
  permanentDtcCodes: {
    type: [String],
    default: []
  },
  priorityDtcCodes: {
    type: [String],
    default: []
  },
  
  // Diagnostic Steps
  aiDiagnosticSteps: [aiDiagnosticStepSchema],
  diagnosticSteps: [{
    type: mongoose.Schema.Types.Mixed
  }],
  
  // Analysis Metadata
  analysisType: {
    type: String
  },
  focusAreas: [{
    type: String
  }],
  monitoredPIDs: [{
    type: String
  }],
  analysisTimestamp: {
    type: Date
  },
  
  // Additional Metadata
  technician: {
    type: String
  },
  location: {
    type: String
  },
  reportVersion: {
    type: String,
    default: '1.0'
  }
}, {
  timestamps: true // This adds createdAt and updatedAt fields automatically
});

// Indexes for performance
comprehensiveReportSchema.index({ sessionId: 1, createdAt: -1 });
comprehensiveReportSchema.index({ vehicleId: 1, createdAt: -1 });
comprehensiveReportSchema.index({ customerId: 1, createdAt: -1 });
comprehensiveReportSchema.index({ priority: 1, createdAt: -1 });
comprehensiveReportSchema.index({ dtcCodes: 1 });

// Methods
comprehensiveReportSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

// Static methods
comprehensiveReportSchema.statics.findBySessionId = function(sessionId) {
  return this.find({ sessionId }).sort({ createdAt: -1 });
};

comprehensiveReportSchema.statics.findLatestBySessionId = function(sessionId) {
  return this.findOne({ sessionId }).sort({ createdAt: -1 });
};

const ComprehensiveReport = mongoose.model('ComprehensiveReport', comprehensiveReportSchema);

export default ComprehensiveReport;