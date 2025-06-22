import mongoose from 'mongoose';

const obd2ParameterSchema = new mongoose.Schema({
  pid: {
    type: String,
    required: true,
    description: "Parameter ID (e.g., '010C' for Engine RPM)"
  },
  name: {
    type: String,
    required: true,
    description: "Human readable parameter name"
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
    description: "Raw parameter value"
  },
  unit: {
    type: String,
    required: true,
    description: "Unit of measurement (e.g., 'RPM', 'km/h', '°C')"
  },
  formattedValue: {
    type: Number,
    description: "Processed/formatted value for analysis"
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
});

const obd2DataSchema = new mongoose.Schema({
  // Vehicle identification
  vehicleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle',
    required: true,
    index: true
  },
  vin: {
    type: String,
    index: true,
    description: "Vehicle Identification Number"
  },
  
  // Session information
  sessionId: {
    type: String,
    required: true,
    index: true,
    description: "Unique session identifier for grouping related data"
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // OBD2 adapter information
  adapterInfo: {
    type: {
      type: String,
      default: 'bluetooth',
      description: "Type of OBD2 adapter (bluetooth, wifi, usb)"
    },
    identifier: {
      type: String,
      description: "Adapter MAC address or identifier"
    },
    protocol: {
      type: String,
      description: "OBD protocol used (CAN, ISO, etc.)"
    }
  },
  
  // Data collection metadata
  dataCollectionStart: {
    type: Date,
    default: Date.now,
    index: true
  },
  dataCollectionEnd: {
    type: Date,
    index: true
  },
  totalDataPoints: {
    type: Number,
    default: 0
  },
  
  // OBD2 parameters collected
  parameters: [obd2ParameterSchema],
  
  // Diagnostic Trouble Codes
  dtcCodes: [{
    code: {
      type: String,
      required: true,
      description: "DTC code (e.g., 'P0171')"
    },
    description: {
      type: String,
      description: "DTC description"
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'permanent', 'cleared'],
      default: 'confirmed'
    },
    detectedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Vehicle state snapshots
  vehicleState: {
    engineRunning: {
      type: Boolean,
      default: false
    },
    speed: {
      type: Number,
      description: "Vehicle speed in km/h"
    },
    rpm: {
      type: Number,
      description: "Engine RPM"
    },
    engineLoad: {
      type: Number,
      description: "Engine load percentage"
    },
    coolantTemp: {
      type: Number,
      description: "Engine coolant temperature in Celsius"
    },
    fuelLevel: {
      type: Number,
      description: "Fuel level percentage"
    },
    odometer: {
      type: Number,
      description: "Odometer reading in km"
    }
  },
  
  // Geolocation data (if available)
  location: {
    latitude: Number,
    longitude: Number,
    altitude: Number,
    accuracy: Number,
    timestamp: Date
  },
  
  // Analysis results (populated by FastAgent)
  analysisResults: [{
    analysisType: {
      type: String,
      enum: ['performance', 'diagnostics', 'fuel_efficiency', 'maintenance_prediction', 'driving_behavior'],
      required: true
    },
    result: {
      type: mongoose.Schema.Types.Mixed,
      description: "Analysis results from FastAgent"
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      description: "Confidence score of the analysis"
    },
    generatedAt: {
      type: Date,
      default: Date.now
    },
    processingTime: {
      type: Number,
      description: "Processing time in milliseconds"
    }
  }],
  
  // Data quality metrics
  dataQuality: {
    completeness: {
      type: Number,
      min: 0,
      max: 1,
      description: "Percentage of expected parameters received"
    },
    consistency: {
      type: Number,
      min: 0,
      max: 1,
      description: "Data consistency score"
    },
    accuracy: {
      type: Number,
      min: 0,
      max: 1,
      description: "Estimated data accuracy"
    },
    issues: [{
      type: String,
      description: "Data quality issues detected"
    }]
  },
  
  // Metadata
  rawData: {
    type: String,
    description: "Raw OBD2 response data for debugging"
  },
  processingStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending',
    index: true
  },
  processingErrors: [{
    error: String,
    timestamp: { type: Date, default: Date.now },
    severity: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' }
  }],
  
  // System metadata
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'obd2_data'
});

// Indexes for performance
obd2DataSchema.index({ vehicleId: 1, sessionId: 1 });
obd2DataSchema.index({ userId: 1, createdAt: -1 });
obd2DataSchema.index({ 'parameters.timestamp': -1 });
obd2DataSchema.index({ processingStatus: 1, createdAt: -1 });
obd2DataSchema.index({ 'dtcCodes.code': 1 });

// Pre-save middleware to update timestamps and calculate metrics
obd2DataSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Calculate total data points
  this.totalDataPoints = this.parameters.length;
  
  // Calculate basic data quality metrics
  if (this.parameters.length > 0) {
    const expectedParams = ['010C', '010D', '0105', '010F']; // RPM, Speed, Coolant Temp, Intake Air Temp
    const receivedParams = this.parameters.map(p => p.pid);
    const completeness = receivedParams.filter(pid => expectedParams.includes(pid)).length / expectedParams.length;
    
    if (!this.dataQuality) this.dataQuality = {};
    this.dataQuality.completeness = completeness;
  }
  
  next();
});

// Static methods for data analysis
obd2DataSchema.statics.getVehicleDataByDateRange = function(vehicleId, startDate, endDate) {
  return this.find({
    vehicleId,
    createdAt: { $gte: startDate, $lte: endDate }
  }).sort({ createdAt: -1 });
};

obd2DataSchema.statics.getActiveSessionData = function(sessionId) {
  return this.findOne({ sessionId, processingStatus: { $ne: 'completed' } });
};

obd2DataSchema.statics.getDTCHistory = function(vehicleId, limit = 50) {
  return this.find(
    { vehicleId, 'dtcCodes.0': { $exists: true } },
    { dtcCodes: 1, createdAt: 1, vehicleId: 1 }
  ).sort({ createdAt: -1 }).limit(limit);
};

// Instance methods
obd2DataSchema.methods.addParameter = function(pid, name, value, unit, formattedValue) {
  this.parameters.push({
    pid,
    name,
    value,
    unit,
    formattedValue,
    timestamp: new Date()
  });
  return this.save();
};

obd2DataSchema.methods.addDTC = function(code, description, status = 'confirmed') {
  this.dtcCodes.push({
    code,
    description,
    status,
    detectedAt: new Date()
  });
  return this.save();
};

obd2DataSchema.methods.updateVehicleState = function(stateData) {
  this.vehicleState = { ...this.vehicleState, ...stateData };
  return this.save();
};

obd2DataSchema.methods.addAnalysisResult = function(analysisType, result, confidence = 1) {
  this.analysisResults.push({
    analysisType,
    result,
    confidence,
    generatedAt: new Date()
  });
  return this.save();
};

const OBD2Data = mongoose.model('OBD2Data', obd2DataSchema);

export default OBD2Data;