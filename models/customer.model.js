import mongoose from 'mongoose';

const vehicleSchema = new mongoose.Schema({
    year: {
        type: Number,
        required: false
    },
    make: {
        type: String,
        enum: ['bmw', 'mercedes', 'audi', 'volkswagen', 'ford', 'chevrolet', 'cadillac', 'Cadillac', 'chrysler', 'dodge', 'jeep', 'volvo', 'saab', 'porsche', 'lexus', 'mercury', 'buick', 'acura', 'lincoln', 'pontiac', 'honda', 'toyota', 'nissan', 'hyundai', 'kia', 'other'],
        required: false
    },
    model: {
        type: String,
        required: false
    },
    trim: {
        type: String,
        default: null
    },
    vin: {
        type: String,
        sparse: true
    },
    licensePlate: {
        type: String,
        default: null
    },
    color: String,
    mileage: Number,
    engine: {
        type: String,
        enum: ['4-cylinder', '6-cylinder', '8-cylinder', 'electric'],
        required: false
    },
    turbocharged: {
        type: Boolean,
        default: false,
        required: false
    },
    transmission: {
        type: String,
        enum: ['automatic', 'manual', 'cvt'],
        required: false
    },
    fuelType: {
        type: String,
        enum: ['gasoline', 'diesel', 'electric', 'hybrid'],
        required: false
    },
    isAWD: {
        type: Boolean,
        default: false
    },
    is4x4: {
        type: Boolean,
        default: false
    },
    notes: String,
    status: {
        type: String,
        enum: ['active', 'inactive', 'in-service'],
        default: 'active'
    }
});

const customerSchema = new mongoose.Schema({
    _id: {
        type: mongoose.Schema.Types.ObjectId,
        auto: true
    },
    firstName: {
        type: String,
        required: true,
        trim: true
    },
    lastName: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        default: ''
    },
    phoneNumber: {
        type: String,
        default: ''
    },
    workphoneNumber: {
        type: Number,
        required: false
    },
    address: {
        type: String,
        default: ''
    },
    city: {
        type: String,
        default: ''
    },
    zipCode: {
        type: String,
        default: ''
    },
    notes: {
        type: String,
        default: ''
    },
    preferredContact: {
        type: String,
        enum: ['email', 'phone', 'text'],
        default: 'email'
    },
    vehicles: [vehicleSchema]
}, {
    timestamps: true
});

// Add text index for search functionality
customerSchema.index({
    firstName: 'text',
    lastName: 'text',
    email: 'text',
    phoneNumber: 'text',
    address: 'text',
    city: 'text',
    zipCode: 'text',
    notes: 'text',
    vin: 'text',
    licensePlate: 'text',
    make: 'text',
    model: 'text',
    trim: 'text',
    engine: 'text',
    transmission: 'text',
    fuelType: 'text',
    isAWD: 'text',
    is4x4: 'text',
    turbocharged: 'text'
});

const Customer = mongoose.model('Customer', customerSchema);
export default Customer;
