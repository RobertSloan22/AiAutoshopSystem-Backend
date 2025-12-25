import mongoose from 'mongoose';
import crypto from 'crypto';

// Stage schema for nested stage data
const StageSchema = new mongoose.Schema({
  stage: {
    type: String,
    enum: ['inspection', 'analysis-repair', 'verification-testdriving'],
    required: true
  },
  status: {
    type: String,
    enum: ['not-started', 'in-progress', 'completed'],
    default: 'not-started'
  },
  startTime: Date,
  endTime: Date,
  dtcScanResults: [String],
  readinessMonitorStatus: mongoose.Schema.Types.Mixed,
  freezeFrameData: [mongoose.Schema.Types.Mixed],
  liveDataSessionIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DiagnosticSession'
  }],
  analysisResults: mongoose.Schema.Types.Mixed,
  analysisId: String, // Reference to Analysis document
  stageReport: String, // Generated markdown report for this stage
  notes: String,
  metadata: mongoose.Schema.Types.Mixed
}, { _id: false });

const IntelligentDiagnosticSessionSchema = new mongoose.Schema({
  idsId: {
    type: String,
    unique: true,
    required: true,
    index: true,
    default: () => `IDS_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
  },
  userId: { type: String, index: true },
  vehicleId: { type: String, index: true },
  vin: {
    type: String,
    required: true,
    index: true
  },
  vehicleInfo: {
    make: String,
    model: String,
    year: Number,
    vin: String,
    engine: String,
    transmission: String,
    fuelType: String,
    licensePlate: String,
    licensePlateState: String,
    mileage: Number
  },
  currentStage: {
    type: String,
    enum: ['inspection', 'analysis-repair', 'verification-testdriving'],
    default: 'inspection'
  },
  stages: [StageSchema],
  linkedLiveDataSessions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DiagnosticSession'
  }],
  overallStatus: {
    type: String,
    enum: ['active', 'completed', 'paused'],
    default: 'active',
    index: true
  },
  tags: [String],
  notes: String,
  metadata: mongoose.Schema.Types.Mixed
}, {
  timestamps: true
});

// Indexes for efficient queries
IntelligentDiagnosticSessionSchema.index({ vin: 1, overallStatus: 1, createdAt: -1 });
IntelligentDiagnosticSessionSchema.index({ userId: 1, overallStatus: 1 });
IntelligentDiagnosticSessionSchema.index({ vehicleId: 1, overallStatus: 1 });
IntelligentDiagnosticSessionSchema.index({ currentStage: 1, overallStatus: 1 });

// Helper method to get stage by name
IntelligentDiagnosticSessionSchema.methods.getStage = function(stageName) {
  return this.stages.find(s => s.stage === stageName);
};

// Helper method to check if all required stages are completed
IntelligentDiagnosticSessionSchema.methods.areAllStagesCompleted = function() {
  const requiredStages = ['inspection', 'analysis-repair', 'verification-testdriving'];
  return requiredStages.every(stageName => {
    const stage = this.stages.find(s => s.stage === stageName);
    return stage && stage.status === 'completed';
  });
};

// Helper method to update stage
IntelligentDiagnosticSessionSchema.methods.updateStage = function(stageName, updates) {
  const stageIndex = this.stages.findIndex(s => s.stage === stageName);
  if (stageIndex === -1) {
    // Create new stage if it doesn't exist
    this.stages.push({
      stage: stageName,
      ...updates
    });
  } else {
    // Update existing stage
    Object.assign(this.stages[stageIndex], updates);
  }
  return this.save();
};

// Helper method to link a live data session
IntelligentDiagnosticSessionSchema.methods.linkSession = function(sessionId, stageName) {
  const stage = this.getStage(stageName);
  if (stage) {
    if (!stage.liveDataSessionIds.includes(sessionId)) {
      stage.liveDataSessionIds.push(sessionId);
    }
  }
  if (!this.linkedLiveDataSessions.includes(sessionId)) {
    this.linkedLiveDataSessions.push(sessionId);
  }
  return this.save();
};

// Helper method to associate analysis
IntelligentDiagnosticSessionSchema.methods.associateAnalysis = function(analysisId, analysisResults, stageName) {
  const stage = this.getStage(stageName);
  if (stage) {
    stage.analysisId = analysisId;
    stage.analysisResults = analysisResults;
  }
  return this.save();
};

// Static method to find most recent active IDS for a vehicle
IntelligentDiagnosticSessionSchema.statics.findMostRecentForVehicle = function(vin) {
  return this.findOne({
    vin: vin,
    overallStatus: { $in: ['active', 'paused'] }
  }).sort({ createdAt: -1 });
};

// Static method to find all IDS for a vehicle
IntelligentDiagnosticSessionSchema.statics.findAllForVehicle = function(vin, limit = 10) {
  return this.find({ vin: vin })
    .sort({ createdAt: -1 })
    .limit(limit);
};

export default mongoose.model('IntelligentDiagnosticSession', IntelligentDiagnosticSessionSchema);
