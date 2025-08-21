import mongoose from 'mongoose';

const plotSchema = new mongoose.Schema({
    imageId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    filename: {
        type: String,
        required: true
    },
    originalPath: {
        type: String,
        required: true
    },
    imageData: {
        type: Buffer,
        required: true
    },
    mimeType: {
        type: String,
        default: 'image/png'
    },
    size: {
        type: Number,
        required: true
    },
    dimensions: {
        width: Number,
        height: Number
    },
    executionId: {
        type: String,
        required: true,
        index: true
    },
    description: {
        type: String,
        default: 'Generated plot'
    },
    tags: [{
        type: String,
        index: true
    }],
    pythonCode: {
        type: String
    },
    pythonOutput: {
        type: String
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    vehicleContext: {
        year: String,
        make: String,
        model: String,
        vin: String
    },
    customerContext: {
        name: String,
        dtcCode: String
    },
    sessionId: {
        type: String,
        index: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    lastAccessed: {
        type: Date,
        default: Date.now
    },
    accessCount: {
        type: Number,
        default: 0
    },
    isPublic: {
        type: Boolean,
        default: false
    },
    expiresAt: {
        type: Date,
        index: { expireAfterSeconds: 0 }
    }
}, {
    timestamps: true
});

// Indexes for better query performance
plotSchema.index({ executionId: 1, createdAt: -1 });
plotSchema.index({ tags: 1, createdAt: -1 });
plotSchema.index({ sessionId: 1, createdAt: -1 });
plotSchema.index({ 'vehicleContext.vin': 1 });
plotSchema.index({ createdAt: -1 });

// Virtual for base64 data
plotSchema.virtual('base64Data').get(function() {
    if (this.imageData) {
        return `data:${this.mimeType};base64,${this.imageData.toString('base64')}`;
    }
    return null;
});

// Virtual for API URLs
plotSchema.virtual('url').get(function() {
    return `/api/plots/${this.imageId}`;
});

plotSchema.virtual('thumbnailUrl').get(function() {
    return `/api/plots/${this.imageId}/thumbnail`;
});

// Update last accessed time
plotSchema.methods.updateAccess = function() {
    this.lastAccessed = new Date();
    this.accessCount = (this.accessCount || 0) + 1;
    return this.save();
};

// Set TTL for automatic cleanup (default 7 days)
plotSchema.methods.setExpiration = function(days = 7) {
    this.expiresAt = new Date(Date.now() + (days * 24 * 60 * 60 * 1000));
    return this;
};

// Static method to find plots by execution ID
plotSchema.statics.findByExecutionId = function(executionId, options = {}) {
    const query = this.find({ executionId });
    
    if (options.limit) query.limit(options.limit);
    if (options.sort) query.sort(options.sort);
    else query.sort({ createdAt: -1 });
    
    return query;
};

// Static method to find plots by session ID
plotSchema.statics.findBySessionId = function(sessionId, options = {}) {
    const query = this.find({ sessionId });
    
    if (options.limit) query.limit(options.limit);
    if (options.sort) query.sort(options.sort);
    else query.sort({ createdAt: -1 });
    
    return query;
};

// Static method to find plots by tags
plotSchema.statics.findByTags = function(tags, options = {}) {
    const tagArray = Array.isArray(tags) ? tags : [tags];
    const query = this.find({ tags: { $in: tagArray } });
    
    if (options.limit) query.limit(options.limit);
    if (options.sort) query.sort(options.sort);
    else query.sort({ createdAt: -1 });
    
    return query;
};

// Static method to cleanup old plots
plotSchema.statics.cleanupOld = async function(maxAgeMs = 7 * 24 * 60 * 60 * 1000) {
    const cutoffDate = new Date(Date.now() - maxAgeMs);
    const result = await this.deleteMany({ 
        createdAt: { $lt: cutoffDate },
        isPublic: { $ne: true }
    });
    return result.deletedCount;
};

// Transform output to include virtuals
plotSchema.set('toJSON', { 
    virtuals: true,
    transform: function(doc, ret) {
        // Don't include the raw image data in JSON output by default
        delete ret.imageData;
        return ret;
    }
});

const Plot = mongoose.model('Plot', plotSchema);

export default Plot;