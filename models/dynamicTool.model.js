import mongoose from "mongoose";

const DynamicToolSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, required: true },
  agentSource: { type: String, required: true },
  parameters: {
    type: { type: String, default: 'object' },
    properties: mongoose.Schema.Types.Mixed,
    required: [String],
    additionalProperties: { type: Boolean, default: false }
  },
  implementation: {
    type: { type: String, enum: ['function', 'api_call', 'webhook', 'ai_generated'], required: true },
    code: String, // JavaScript code for function type
    apiEndpoint: String, // For api_call type
    webhookUrl: String, // For webhook type
    aiPrompt: String, // For ai_generated type
    dependencies: [String], // Required dependencies
    timeout: { type: Number, default: 30000 }
  },
  metadata: {
    version: { type: String, default: '1.0.0' },
    author: String,
    tags: [String],
    uiImpact: {
      type: { type: String, enum: ['modal', 'dashboard', 'panel', 'notification', 'none'] },
      element: String,
      timing: { type: String, enum: ['immediate', 'delayed'], default: 'immediate' },
      delay: { type: Number, default: 0 }
    },
    conflicts: [String],
    dependencies: [String],
    permissions: {
      read: { type: Boolean, default: true },
      write: { type: Boolean, default: false },
      execute: { type: Boolean, default: true }
    }
  },
  status: { 
    type: String, 
    enum: ['draft', 'active', 'deprecated', 'error'], 
    default: 'draft' 
  },
  usage: {
    callCount: { type: Number, default: 0 },
    lastUsed: Date,
    successRate: { type: Number, default: 0 },
    averageExecutionTime: { type: Number, default: 0 }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Tool Execution Context Schema
const ToolExecutionContextSchema = new mongoose.Schema({
  sessionId: { type: String, required: true },
  agentId: { type: String, required: true },
  toolId: { type: String, required: true },
  executionId: { type: String, required: true, unique: true },
  status: { 
    type: String, 
    enum: ['pending', 'running', 'completed', 'failed', 'timeout'], 
    default: 'pending' 
  },
  input: mongoose.Schema.Types.Mixed,
  output: mongoose.Schema.Types.Mixed,
  error: String,
  executionTime: Number,
  timestamp: { type: Date, default: Date.now }
});

const DynamicTool = mongoose.model('DynamicTool', DynamicToolSchema);
const ToolExecutionContext = mongoose.model('ToolExecutionContext', ToolExecutionContextSchema);

export { DynamicTool, ToolExecutionContext };
export default DynamicTool;
