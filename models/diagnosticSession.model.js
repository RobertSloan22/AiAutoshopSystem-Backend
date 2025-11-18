import mongoose from 'mongoose';

const DiagnosticSessionSchema = new mongoose.Schema({
  userId: { type: String, index: true },
  vehicleId: { type: String, index: true },
  sessionName: String,
  startTime: { type: Date, required: true, index: true },
  endTime: Date,
  duration: Number,
  status: {
    type: String,
    enum: ['active', 'completed', 'paused', 'error', 'cancelled'],
    default: 'active',
    index: true
  },
  dataPointCount: { type: Number, default: 0 },
  sessionType: { type: String, default: 'diagnostic' },
  locationStart: mongoose.Schema.Types.Mixed,
  locationEnd: mongoose.Schema.Types.Mixed,
  weatherConditions: mongoose.Schema.Types.Mixed,
  drivingConditions: String,
  sessionNotes: String,
  tags: [String],
  selectedPids: { type: [String], default: [] },
  pidConfiguration: mongoose.Schema.Types.Mixed,
  sessionConfiguration: mongoose.Schema.Types.Mixed,
  analysis: mongoose.Schema.Types.Mixed,
  aiSummary: String,
  patterns: [mongoose.Schema.Types.Mixed],
  anomalies: [mongoose.Schema.Types.Mixed],
  recommendations: [String],
  exportedFormats: [String],
  lastExportTime: Date,
  isArchived: { type: Boolean, default: false },
  archiveReason: String,
  sourceConnection: {
    type: String,
    enum: ['bluetooth', 'wifi', 'usb', 'simulator', 'file_upload'],
    default: 'bluetooth'
  },
  deviceInfo: mongoose.Schema.Types.Mixed,
  protocolUsed: String,
  dataQuality: {
    completeness: Number,
    accuracy: Number,
    consistency: Number
  },
  alertsGenerated: [mongoose.Schema.Types.Mixed],
  maintenanceInsights: [mongoose.Schema.Types.Mixed],
  complianceChecks: [mongoose.Schema.Types.Mixed],
  performanceMetrics: mongoose.Schema.Types.Mixed
}, {
  timestamps: true
});

DiagnosticSessionSchema.index({ userId: 1, startTime: -1 });
DiagnosticSessionSchema.index({ vehicleId: 1, startTime: -1 });
DiagnosticSessionSchema.index({ status: 1, startTime: -1 });
DiagnosticSessionSchema.index({ sessionType: 1 });
DiagnosticSessionSchema.index({ isArchived: 1 });
DiagnosticSessionSchema.index({ tags: 1 });

export default mongoose.model('DiagnosticSession', DiagnosticSessionSchema);