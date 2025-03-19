import mongoose from 'mongoose';

const serviceRecordSchema = new mongoose.Schema({
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: true
    },
    vehicleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vehicle',
        required: true
    },
    technician: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Technician'
    },
    serviceDate: {
        type: Date,
        required: true
    },
    completedDate: {
        type: Date
    },
    serviceType: {
        type: String,
        required: true,
        enum: ['maintenance', 'repair', 'diagnostic', 'inspection']
    },
    status: {
        type: String,
        required: true,
        enum: ['scheduled', 'assigned', 'in-progress', 'completed', 'cancelled'],
        default: 'scheduled'
    },
    notes: {
        type: String,
        required: true
    },
    recommendations: [{
        service: String,
        priority: {
            type: String,
            enum: ['low', 'normal', 'high', 'critical'],
            default: 'normal'
        },
        estimatedCost: Number,
        approved: {
            type: Boolean,
            default: false
        }
    }],
    parts: [{
        partId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Part'
        },
        quantity: {
            type: Number,
            required: true,
            min: 1
        },
        cost: Number
    }],
    laborHours: {
        type: Number,
        min: 0
    },
    totalCost: {
        type: Number,
        min: 0
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'partial', 'completed'],
        default: 'pending'
    },
    warranty: {
        type: Boolean,
        default: false
    },
    photos: [{
        url: String,
        description: String,
        uploadedAt: {
            type: Date,
            default: Date.now
        }
    }],
    diagnosticCodes: [{
        code: String,
        description: String,
        severity: {
            type: String,
            enum: ['low', 'medium', 'high'],
            default: 'medium'
        }
    }]
}, {
    timestamps: true
});

// Add index for common queries
serviceRecordSchema.index({ vehicleId: 1, serviceDate: -1 });
serviceRecordSchema.index({ technician: 1, status: 1 });
serviceRecordSchema.index({ customerId: 1 });

const ServiceRecord = mongoose.model('ServiceRecord', serviceRecordSchema);

export default ServiceRecord; 