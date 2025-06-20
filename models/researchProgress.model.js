import mongoose from 'mongoose';

// Schema for a research sub-task
const ResearchSubTaskSchema = new mongoose.Schema({
  agentId: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'error'],
    default: 'pending'
  },
  progress: {
    current: {
      type: Number,
      default: 0
    },
    total: {
      type: Number,
      default: 1
    },
    percentage: {
      type: Number,
      default: 0
    }
  },
  startedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  errorMessage: {
    type: String
  }
});

// Schema for tracking research progress
const ResearchProgressSchema = new mongoose.Schema({
  researchId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  query: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'error'],
    default: 'pending'
  },
  overallProgress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  questions: [{
    id: String,
    question: String,
    category: String,
    completed: {
      type: Boolean,
      default: false
    }
  }],
  subtasks: [ResearchSubTaskSchema],
  logs: [{
    timestamp: {
      type: Date,
      default: Date.now
    },
    message: String,
    agentId: String,
    level: {
      type: String,
      enum: ['info', 'warning', 'error'],
      default: 'info'
    }
  }],
  startedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date
  },
  errorMessage: {
    type: String
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  result: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Method to update progress for a specific subtask
ResearchProgressSchema.methods.updateSubtaskProgress = function(agentId, progress, status) {
  const subtask = this.subtasks.find(task => task.agentId === agentId);
  
  if (subtask) {
    subtask.progress = progress;
    if (status) {
      subtask.status = status;
      
      if (status === 'in_progress' && !subtask.startedAt) {
        subtask.startedAt = new Date();
      } else if (status === 'completed' && !subtask.completedAt) {
        subtask.completedAt = new Date();
      }
    }
  }
  
  // Recalculate overall progress
  this.calculateOverallProgress();
  
  return this;
};

// Method to add a log entry
ResearchProgressSchema.methods.addLog = function(message, agentId, level = 'info') {
  this.logs.push({
    message,
    agentId,
    level,
    timestamp: new Date()
  });
  
  return this;
};

// Method to calculate overall progress
ResearchProgressSchema.methods.calculateOverallProgress = function() {
  if (this.subtasks.length === 0) {
    this.overallProgress = this.status === 'completed' ? 100 : 0;
    return this;
  }
  
  // Sum of all percentages divided by number of subtasks
  const sum = this.subtasks.reduce((acc, task) => acc + task.progress.percentage, 0);
  this.overallProgress = Math.round(sum / this.subtasks.length);
  
  return this;
};

// Update overall status based on subtasks
ResearchProgressSchema.methods.updateOverallStatus = function() {
  if (this.subtasks.length === 0) return this;
  
  // If any subtask has error, mark as error
  if (this.subtasks.some(task => task.status === 'error')) {
    this.status = 'error';
    return this;
  }
  
  // If all subtasks are completed, mark as completed
  if (this.subtasks.every(task => task.status === 'completed')) {
    this.status = 'completed';
    this.completedAt = new Date();
    this.overallProgress = 100;
    return this;
  }
  
  // If any subtask is in progress, mark as in progress
  if (this.subtasks.some(task => task.status === 'in_progress')) {
    this.status = 'in_progress';
    return this;
  }
  
  return this;
};

// Add a new subtask
ResearchProgressSchema.methods.addSubtask = function(agentId, description) {
  const existingSubtask = this.subtasks.find(task => task.agentId === agentId);
  
  if (existingSubtask) {
    existingSubtask.description = description;
    return this;
  }
  
  this.subtasks.push({
    agentId,
    description,
    status: 'pending',
    progress: {
      current: 0,
      total: 1,
      percentage: 0
    }
  });
  
  return this;
};

// Update question status
ResearchProgressSchema.methods.updateQuestionStatus = function(questionId, completed) {
  const question = this.questions.find(q => q.id === questionId);
  
  if (question) {
    question.completed = completed;
  }
  
  return this;
};

// Create the model
const ResearchProgress = mongoose.model('ResearchProgress', ResearchProgressSchema);

export default ResearchProgress;