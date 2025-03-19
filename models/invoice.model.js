import mongoose from "mongoose";

const invoiceSchema = new mongoose.Schema(
	{
		customerId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Customer',
			required: true,
		},
		vehicleId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Vehicle',
			required: true,
		},
		customerName: {
			type: String,
			required: true,
		},
		customerEmail: {
			type: String,
			required: true,
		},
		phoneNumber: {
			type: String,
			required: false,
		},
		address: {
			type: String,
			required: false,
		},
		city: {
			type: String,
			required: false,
		},
		zipCode: {
			type: String,
			required: false,
		},
		invoiceDate: {
			type: Date,
			default: Date.now,
			required: true,
		},
		vehicleYear: {
			type: String,
			required: false,
		},
		vehicleMake: {
			type: String,
			required: false,
		},
		vehicleModel: {
			type: String,
			required: false,
		},
		vehicleVin: {
			type: String,
			required: false,
		},
		vehicleMileage: {
			type: String,
			required: false,
		},
		vehicleEngine: {
			type: String,
			required: false,
		},
		vehicleTransmission: {
			type: String,
			required: false,
		},
		notes: {
			type: String,
			required: false,
		},
		laborItems: [{
			description: String,
			hours: Number,
			ratePerHour: Number
		}],
		partsItems: [{
			partNumber: String,
			description: String,
			quantity: Number,
			price: Number
		}],
		subtotal: {
			type: Number,
			required: true,
			default: 0
		},
		tax: {
			type: Number,
			required: true,
			default: 0
		},
		total: {
			type: Number,
			required: true,
			default: 0
		},
		status: {
			type: String,
			enum: ['draft', 'completed', 'billed'],
			default: 'draft',
			required: true
		}
	},
	{ timestamps: true }
);

const Invoice = mongoose.model("Invoice", invoiceSchema);

export default Invoice;
