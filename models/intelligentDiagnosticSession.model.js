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

// Helper method to validate stage progression order
// Returns { valid: boolean, error: string | null }
IntelligentDiagnosticSessionSchema.methods.validateStageProgression = function(stageName, allowSkipStages = false) {
  const stageOrder = ['inspection', 'analysis-repair', 'verification-testdriving'];
  const targetIndex = stageOrder.indexOf(stageName);
  
  if (targetIndex === -1) {
    return { valid: false, error: `Invalid stage name: ${stageName}` };
  }
  
  // First stage can always be started
  if (targetIndex === 0) {
    return { valid: true, error: null };
  }
  
  // If skipping is allowed, allow any stage
  if (allowSkipStages) {
    return { valid: true, error: null };
  }
  
  // Check if previous stage is completed
  const previousStageName = stageOrder[targetIndex - 1];
  const previousStage = this.getStage(previousStageName);
  
  if (!previousStage || previousStage.status !== 'completed') {
    return { 
      valid: false, 
      error: `Cannot start ${stageName} stage. Previous stage ${previousStageName} must be completed first.` 
    };
  }
  
  return { valid: true, error: null };
};

// Helper method to start a stage with single in-progress enforcement
// Ensures only one stage is in-progress at a time (atomic operation)
IntelligentDiagnosticSessionSchema.methods.startStage = function(stageName, allowSkipStages = false) {
  // Validate stage progression
  const validation = this.validateStageProgression(stageName, allowSkipStages);
  if (!validation.valid) {
    throw new Error(validation.error);
  }
  
  // Ensure only one stage is in-progress at a time
  // Reset all other in-progress stages to not-started (unless they're completed)
  this.stages.forEach(stage => {
    if (stage.stage === stageName) {
      // This is the stage we're starting
      stage.status = 'in-progress';
      if (!stage.startTime) {
        stage.startTime = new Date();
      }
    } else if (stage.status === 'in-progress' && stage.status !== 'completed') {
      // Reset other in-progress stages (but don't touch completed stages)
      stage.status = 'not-started';
      stage.startTime = undefined;
    }
  });
  
  // Update current stage
  this.currentStage = stageName;
  
  // Update or create the target stage
  return this.updateStage(stageName, {
    status: 'in-progress',
    startTime: this.getStage(stageName)?.startTime || new Date()
  });
};

// Helper method to ensure IDS state consistency
// Validates and fixes inconsistencies in stage states, currentStage, and overallStatus
IntelligentDiagnosticSessionSchema.methods.ensureConsistentState = function() {
  let needsSave = false;
  
  // Find the stage that is in-progress
  const inProgressStage = this.stages.find(s => s.status === 'in-progress');
  
  // Ensure currentStage matches the in-progress stage (or first stage if none in-progress)
  if (inProgressStage) {
    if (this.currentStage !== inProgressStage.stage) {
      this.currentStage = inProgressStage.stage;
      needsSave = true;
    }
  } else {
    // No stage in-progress - set currentStage to first incomplete stage, or last stage if all complete
    const stageOrder = ['inspection', 'analysis-repair', 'verification-testdriving'];
    let firstIncomplete = stageOrder.find(stageName => {
      const stage = this.getStage(stageName);
      return !stage || stage.status !== 'completed';
    });
    
    if (!firstIncomplete) {
      // All stages completed
      firstIncomplete = stageOrder[stageOrder.length - 1];
    }
    
    if (this.currentStage !== firstIncomplete) {
      this.currentStage = firstIncomplete;
      needsSave = true;
    }
  }
  
  // Ensure overallStatus matches stage completion state
  const allCompleted = this.areAllStagesCompleted();
  if (allCompleted && this.overallStatus !== 'completed') {
    this.overallStatus = 'completed';
    needsSave = true;
  } else if (!allCompleted && this.overallStatus === 'completed') {
    // If not all stages are completed but status says completed, fix it
    this.overallStatus = 'active';
    needsSave = true;
  }
  
  // Ensure no more than one stage is in-progress
  const inProgressStages = this.stages.filter(s => s.status === 'in-progress');
  if (inProgressStages.length > 1) {
    // Keep the first one, reset others
    const firstInProgress = inProgressStages[0];
    inProgressStages.slice(1).forEach(stage => {
      if (stage.status !== 'completed') {
        stage.status = 'not-started';
        stage.startTime = undefined;
        needsSave = true;
      }
    });
    
    // Update currentStage to match the first in-progress stage
    if (this.currentStage !== firstInProgress.stage) {
      this.currentStage = firstInProgress.stage;
      needsSave = true;
    }
  }
  
  return needsSave ? this.save() : Promise.resolve(this);
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
