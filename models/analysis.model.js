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

  // Visualizations/plots with raw data for frontend access
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
    },
    // Raw data arrays for frontend interactive components
    rawData: {
      datasets: [mongoose.Schema.Types.Mixed], // Array of data series used in the plot
      labels: [mongoose.Schema.Types.Mixed],   // X-axis labels/timestamps
      parameters: [String],                    // OBD2 parameters plotted (e.g., 'rpm', 'engineTemp')
      dataRange: {
        startTime: Date,
        endTime: Date,
        totalPoints: Number
      },
      chartConfig: mongoose.Schema.Types.Mixed // Chart.js compatible configuration
    },
    // Plot metadata for frontend rendering
    plotMetadata: {
      plotType: {
        type: String,
        enum: ['time_series', 'scatter', 'histogram', 'correlation', 'anomaly', 'dashboard'],
        default: 'time_series'
      },
      axes: mongoose.Schema.Types.Mixed,
      colors: [String], // Color scheme used
      interactive: { type: Boolean, default: true }
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
  },

  // Intelligent Diagnostic Session linking
  idsId: { type: String, index: true }, // Reference to IntelligentDiagnosticSession
  idsStage: { type: String, enum: ['inspection', 'analysis-repair', 'verification-testdriving'] } // Which IDS stage this analysis belongs to

}, {
  timestamps: true,
  // Automatically create createdAt and updatedAt fields
});

// Indexes for efficient queries
AnalysisSchema.index({ sessionId: 1, timestamp: -1 });
AnalysisSchema.index({ analysisType: 1, status: 1 });
AnalysisSchema.index({ 'context.dtcCodes': 1 });
AnalysisSchema.index({ tags: 1 });
AnalysisSchema.index({ idsId: 1, idsStage: 1 });

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

// Method to add plot to analysis with raw data
AnalysisSchema.methods.addPlot = function(plotData) {
  this.plots.push({
    filename: plotData.filename,
    base64: plotData.base64,
    mimeType: plotData.mimeType || 'image/png',
    description: plotData.description,
    generatedAt: new Date(),
    rawData: plotData.rawData || {
      datasets: [],
      labels: [],
      parameters: [],
      dataRange: {},
      chartConfig: {}
    },
    plotMetadata: plotData.plotMetadata || {
      plotType: plotData.plotType || 'time_series',
      axes: plotData.axes || {},
      colors: plotData.colors || [],
      interactive: true
    }
  });
};

// Method to add plot with structured data for frontend compatibility
AnalysisSchema.methods.addInteractivePlot = function(plotData, rawDataArrays, parameters) {
  const processedData = this.processRawDataForFrontend(rawDataArrays, parameters);
  
  this.plots.push({
    filename: plotData.filename,
    base64: plotData.base64,
    mimeType: plotData.mimeType || 'image/png',
    description: plotData.description,
    generatedAt: new Date(),
    rawData: processedData,
    plotMetadata: {
      plotType: plotData.plotType || 'time_series',
      axes: {
        x: { label: plotData.xLabel || 'Time', unit: plotData.xUnit || '', type: 'datetime' },
        y: { label: plotData.yLabel || parameters.join(', '), unit: plotData.yUnit || '', type: 'linear' }
      },
      colors: plotData.colors || ['#3b82f6', '#ef4444', '#10b981', '#f59e0b'],
      interactive: true
    }
  });
};

// Helper method to process raw OBD2 data for frontend consumption
AnalysisSchema.methods.processRawDataForFrontend = function(rawDataArrays, parameters) {
  if (!rawDataArrays || !Array.isArray(rawDataArrays) || rawDataArrays.length === 0) {
    return { datasets: [], labels: [], parameters: [], dataRange: {}, chartConfig: {} };
  }

  const datasets = [];
  const labels = rawDataArrays.map(point => point.timestamp || point.time);
  const startTime = new Date(Math.min(...labels.map(l => new Date(l))));
  const endTime = new Date(Math.max(...labels.map(l => new Date(l))));

  parameters.forEach((param, index) => {
    const data = rawDataArrays.map(point => point[param]).filter(val => val !== null && val !== undefined);
    if (data.length > 0) {
      datasets.push({
        label: param,
        data: data,
        parameter: param,
        unit: this.getParameterUnit(param),
        color: this.getParameterColor(param, index)
      });
    }
  });

  return {
    datasets,
    labels,
    parameters,
    dataRange: {
      startTime,
      endTime,
      totalPoints: rawDataArrays.length
    },
    chartConfig: {
      type: 'line',
      responsive: true,
      scales: {
        x: { type: 'time', time: { unit: 'second' } },
        y: { beginAtZero: false }
      }
    }
  };
};

// Helper method to get parameter units
AnalysisSchema.methods.getParameterUnit = function(parameter) {
  const units = {
    rpm: 'RPM',
    speed: 'km/h',
    engineTemp: '°C',
    intakeTemp: '°C',
    throttlePosition: '%',
    engineLoad: '%',
    fuelLevel: '%',
    batteryVoltage: 'V',
    maf: 'g/s',
    map: 'kPa'
  };
  return units[parameter] || '';
};

// Helper method to get parameter colors
AnalysisSchema.methods.getParameterColor = function(parameter, index) {
  const colorMap = {
    rpm: '#3b82f6',
    speed: '#10b981', 
    engineTemp: '#ef4444',
    intakeTemp: '#f59e0b',
    throttlePosition: '#8b5cf6',
    engineLoad: '#06b6d4',
    fuelLevel: '#84cc16',
    batteryVoltage: '#f97316'
  };
  const defaultColors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];
  return colorMap[parameter] || defaultColors[index % defaultColors.length];
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
