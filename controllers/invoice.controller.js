import Customer from "../models/customer.model.js";
import Vehicle from "../models/vehicle.model.js";
import Invoice from "../models/invoice.model.js";

// Create a new invoice
export const createInvoice = async (req, res) => {
    try {
        const {
            customerName,
            customerEmail,
            phoneNumber,
            address,
            city,
            zipCode,
            vehicleYear,
            vehicleMake,
            vehicleModel,
            vehicleVin,
            vehicleMileage,
            vehicleEngine,
            vehicleTransmission,
            laborItems,
            partsItems,
            subtotal,
            tax,
            total,
            status,
            notes
        } = req.body;

        // First, try to find existing customer by email
        let customer = await Customer.findOne({ email: customerEmail });
        
        if (customer) {
            // Update customer information if needed
            customer = await Customer.findByIdAndUpdate(
                customer._id,
                {
                    phoneNumber: phoneNumber || customer.phoneNumber,
                    address: address || customer.address,
                    city: city || customer.city,
                    zipCode: zipCode || customer.zipCode
                },
                { new: true }
            );
        } else {
            // Create new customer if doesn't exist
            const [firstName, ...lastNameParts] = customerName.split(' ');
            const lastName = lastNameParts.join(' ');
            
            customer = new Customer({
                firstName,
                lastName,
                email: customerEmail,
                phoneNumber,
                address,
                city,
                zipCode
            });
            await customer.save();
        }

        // Check if vehicle exists for this customer
        let vehicle = await Vehicle.findOne({ 
            customerId: customer._id,
            vin: vehicleVin 
        });

        if (!vehicle) {
            // Create new vehicle
            vehicle = new Vehicle({
                customerId: customer._id,
                year: vehicleYear,
                make: vehicleMake,
                model: vehicleModel,
                vin: vehicleVin,
                mileage: vehicleMileage,
                engine: vehicleEngine,
                transmission: vehicleTransmission
            });
            await vehicle.save();
        }

        // Create the invoice with references to customer and vehicle
        const newInvoice = new Invoice({
            customerId: customer._id,
            vehicleId: vehicle._id,
            customerName,
            customerEmail,
            phoneNumber,
            address,
            city,
            zipCode,
            vehicleYear,
            vehicleMake,
            vehicleModel,
            vehicleVin,
            vehicleMileage,
            vehicleEngine,
            vehicleTransmission,
            laborItems,
            partsItems,
            subtotal,
            tax,
            total,
            status,
            notes,
            invoiceDate: new Date()
        });

        const savedInvoice = await newInvoice.save();

        // Add invoice reference to customer
        await Customer.findByIdAndUpdate(
            customer._id,
            { $push: { invoices: savedInvoice._id } }
        );

        res.status(201).json(savedInvoice);
    } catch (error) {
        console.error("Error in createInvoice: ", error);
        res.status(500).json({ error: error.message });
    }
};

// Get all invoices
export const getAllInvoices = async (req, res) => {
    try {
        const invoices = await Invoice.find()
            .populate('customerId')
            .populate('vehicleId')
            .sort({ createdAt: -1 });
        res.status(200).json(invoices);
    } catch (error) {
        console.error("Error in getAllInvoices: ", error);
        res.status(500).json({ error: "Error fetching invoices" });
    }
};

// Get single invoice by ID
export const getInvoiceById = async (req, res) => {
    try {
        const invoice = await Invoice.findById(req.params.id)
            .populate('customerId')
            .populate('vehicleId');
        
        if (!invoice) {
            return res.status(404).json({ error: "Invoice not found" });
        }
        
        res.status(200).json(invoice);
    } catch (error) {
        console.error("Error in getInvoiceById: ", error);
        res.status(500).json({ error: "Error fetching invoice" });
    }
};

// Update invoice
export const updateInvoice = async (req, res) => {
    try {
        const updatedInvoice = await Invoice.findByIdAndUpdate(
            req.params.id,
            { ...req.body, lastModified: new Date() },
            { new: true }
        ).populate('customerId').populate('vehicleId');

        if (!updatedInvoice) {
            return res.status(404).json({ error: "Invoice not found" });
        }
        res.status(200).json(updatedInvoice);
    } catch (error) {
        console.error("Error in updateInvoice: ", error);
        res.status(500).json({ error: "Error updating invoice" });
    }
};

// Delete invoice
export const deleteInvoice = async (req, res) => {
    try {
        const invoice = await Invoice.findById(req.params.id);
        if (!invoice) {
            return res.status(404).json({ error: "Invoice not found" });
        }

        // Remove invoice reference from customer
        await Customer.findByIdAndUpdate(
            invoice.customerId,
            { $pull: { invoices: invoice._id } }
        );

        await Invoice.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: "Invoice deleted successfully" });
    } catch (error) {
        console.error("Error in deleteInvoice: ", error);
        res.status(500).json({ error: "Error deleting invoice" });
    }
};

// Get invoices by customer ID
export const getInvoicesByCustomer = async (req, res) => {
    try {
        const invoices = await Invoice.find({ customerId: req.params.id })
            .populate('vehicleId')
            .sort({ createdAt: -1 });
        res.status(200).json(invoices);
    } catch (error) {
        console.error("Error in getInvoicesByCustomer: ", error);
        res.status(500).json({ error: "Error fetching customer invoices" });
    }
};

// Get recent invoices
export const getRecentInvoices = async (req, res) => {
    try {
        const recentInvoices = await Invoice.find()
            .populate('customerId')
            .populate('vehicleId')
            .sort({ createdAt: -1 })
            .limit(5);
        res.status(200).json(recentInvoices);
    } catch (error) {
        console.error('Error in getRecentInvoices:', error);
        res.status(500).json({ error: 'Failed to fetch recent invoices' });
    }
};




