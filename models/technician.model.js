import mongoose from 'mongoose';

const technicianSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    specialization: {
        type: String,
        required: true,
        enum: ['General', 'Electrical', 'Engine', 'Transmission', 'Body Work', 'Diagnostics']
    },
    certifications: [{
        name: String,
        issueDate: Date,
        expiryDate: Date
    }],
    avatar: {
        type: String,
        default: ''
    },
    status: {
        type: String,
        enum: ['active', 'on_leave', 'unavailable'],
        default: 'active'
    },
    experience: {
        type: Number,
        required: true,
        min: 0
    },
    rating: {
        type: Number,
        min: 0,
        max: 5,
        default: 0
    },
    completedServices: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

const Technician = mongoose.model('Technician', technicianSchema);

export default Technician; 