import mongoose from "mongoose";

const activantSchema = new mongoose.Schema(
	{
        workorder: {
            type: String,
            required: true
        },
        serviceWriter: {
            type: String,
        },
        odometerIn: {
            type: Number,
            required: true
        },
        odometerOut: {
            type: String,
            required: true
        },

		customerId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Customer',
			required: false,
		},
		vehicleId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Vehicle',
			required: false,
		},
		customerName: {
			type: String,
			required: false,
		},
		customerEmail: {
			type: String,
			required: false,
		},
		phoneNumber: {
			type: String,
			required: false,
		},
		address: {
			type: String,
			required: false,
		},  
		invoiceDate: {
			type: Date,
			required: false,
		},
        vehicleType: {
			type: String,
			enum: ['Car', 'Truck', 'Van', 'SUV', 'Other'],
			required: false,
		},
		vehicleMake: {
			type: String,
			enum: ['Toyota', 'Honda', 'Ford', 'Chevy', 'Nissan', 'Kia','Subaru','Lexus','Acura','BMW','Mercedes','Audi','Volkswagen','Hyundai','Volvo','Jeep','Mazda','Porsche','Tesla', 'Lincoln','Mercury', 'Cadillac', 'GMC', 'Dodge', 'Chrysler', 'Buick', 'Fiat', 'Other'],
			required: false,
		},  
		vehiclePlate: {
			type: String,
			required: false,
		},
        vehicleVin: {
			type: String,
			required: false,
		},
		vehicleColor: {
			type: String,
			enum: ['Red', 'Blue', 'Green', 'Yellow', 'Black', 'White', 'Gray', 'Other'],
			required: false,
		},
		vehicleMileage: {
			type: String,
			required: false,
		},
		vehicleEngine: {
			type: String,
			enum: ['4cylinder', '6cylinder', '4-cylinder', '6-cylinder', 'V6', 'V8', 'V10', 'V12', 'Other'],
			required: false,
		},
		vehicleTransmission: {
			type: String,
			enum: ['Automatic', 'Manual', 'Other'],
			required: false,
		},  
		vehicleFuelType: {
			type: String,
			enum: ['Gasoline', 'Diesel', 'Electric', 'Hybrid', 'Other'],
			required: false,
		},  
		vehicleDescription: {
			type: String,
			required: false,
		},
		serviceType: {
			type: String,
			enum: ['Oil Change', 'Tire Rotation', 'Brake Inspection', 'Battery Check', 'Emissions Check', 'Electrical Diagnosis', 'Engoine Performance Diagnosis', 'Transmission Fluid Flush', 'All Wheel Drive Service', 'Light Bulb Replacement', 'Other'],
			required: true,
		},
		serviceAmount: {
			type: Number,
			required: false,
		},
		serviceDescription: {
			type: String,
			required: false,
		},
		partsDescription: {
			type: String,
			required: false,
		},
		partsAmount: {
			type: Number,
			required: false,
		},
		laborAmount: {
			type: Number,
			required: false,
		},
		shopSupplyAmount: {
			type: Number,
			required: false,
		},
		totalAmount: {
			type: Number,
			required: false,
		},
		invoiceStatus: {
			type: String,
			enum: ['Pending', 'Paid', 'Overdue'],
			required: false,
		},
		// createdAt, updatedAt => Member since <createdAt>
	},
	{ timestamps: false }
);

const Activant = mongoose.model("Activant", activantSchema);

export default Activant;
