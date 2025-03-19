import Customer from '../models/customer.model.js';
import Invoice from '../models/invoice.model.js';

export const createCustomer = async (req, res) => {
    try {
        console.log('Received create customer request:', req.body);
        
        // Extract customer data from either nested or flat structure
        const customerData = req.body.customerData || req.body;
        
        // Validate required fields
        if (!customerData.firstName || !customerData.lastName) {
            return res.status(400).json({ 
                error: 'First name and last name are required',
                receivedData: customerData
            });
        }

        // Create customer with vehicles if provided
        const customer = new Customer({
            firstName: customerData.firstName,
            lastName: customerData.lastName,
            email: customerData.email || '',
            phoneNumber: customerData.phoneNumber || '',
            address: customerData.address || '',
            city: customerData.city || '',
            zipCode: customerData.zipCode || '',
            notes: customerData.notes || '',
            vehicles: req.body.vehicleData ? [req.body.vehicleData] : []
        });

        await customer.save();
        console.log('Customer created successfully:', customer);

        res.status(201).json({
            message: 'Customer created successfully',
            customer: customer
        });
    } catch (error) {
        console.error('Customer Creation Error:', error);
        res.status(400).json({ 
            error: error.message,
            details: error.errors
        });
    }
};

export const searchCustomers = async (req, res) => {
    try {
        const { term } = req.query;
        
        if (!term) {
            return res.status(400).json({ error: 'Search term required' });
        }

        // Split the search term to handle "LastName, FirstName" format
        const parts = term.split(',').map(part => part.trim());
        
        let searchQuery;
        if (parts.length === 2) {
            // If comma is present, assume "LastName, FirstName" format
            searchQuery = {
                $and: [
                    { lastName: new RegExp(parts[0], 'i') },
                    { firstName: new RegExp(parts[1], 'i') }
                ]
            };
        } else {
            // Otherwise, search across all relevant fields
            searchQuery = {
                $or: [
                    { firstName: new RegExp(term, 'i') },
                    { lastName: new RegExp(term, 'i') },
                    { email: new RegExp(term, 'i') },
                    { phoneNumber: new RegExp(term, 'i') },
                    { address: new RegExp(term, 'i') },
                    { vehicles: { $elemMatch: { $regex: term, $options: 'i' } } }

                ]
            };
        }

        const customers = await Customer.find(searchQuery)
            .limit(10)
            .select('firstName lastName email phoneNumber address city zipCode preferredContact');
            
        res.json(customers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const searchCustomersByLastName = async (req, res) => {
    try {
        const { lastName } = req.query;
        
        if (!lastName) {
            return res.status(400).json({ error: 'Last name is required' });
        }

        const customers = await Customer.find({
            lastName: new RegExp(lastName, 'i')
        })
        .limit(10)
        .select('firstName lastName email phoneNumber address city zipCode preferredContact');
            
        res.json(customers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const updateCustomer = async (req, res) => {
    try {
        const customerId = req.params.id;
        const updateData = {
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            email: req.body.email,
            phoneNumber: req.body.phoneNumber,
            address: req.body.address,
            city: req.body.city,
            zipCode: req.body.zipCode,
            notes: req.body.notes,
            vehicles: req.body.vehicles
            
        };

        // If vehicles data is provided, update it
        if (req.body.vehicles) {
            updateData.vehicles = req.body.vehicles;
        }

        const customer = await Customer.findByIdAndUpdate(
            customerId,
            updateData,
            { new: true, runValidators: true }
        );

        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        res.json(customer);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

export const updateCustomerWithVehicle = async (req, res) => {
    try {
        const customerId = req.params.id;
        const { customerData, vehicleData } = req.body;

        const customer = await Customer.findById(customerId);
        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        // Update customer fields
        customer.firstName = customerData.firstName;
        customer.lastName = customerData.lastName;
        customer.email = customerData.email;
        customer.phoneNumber = customerData.phoneNumber;
        customer.address = customerData.address;
        customer.city = customerData.city;
        customer.zipCode = customerData.zipCode;
        customer.notes = customerData.notes;

        // Handle vehicle update/creation
        if (vehicleData) {
            if (vehicleData._id) {
                // Update existing vehicle
                const vehicleIndex = customer.vehicles.findIndex(v => v._id.toString() === vehicleData._id);
                if (vehicleIndex !== -1) {
                    customer.vehicles[vehicleIndex] = { ...customer.vehicles[vehicleIndex], ...vehicleData };
                }
            } else {
                // Add new vehicle
                customer.vehicles.push(vehicleData);
            }
        }

        await customer.save();

        res.json({
            customer: customer.toObject()
        });
    } catch (error) {
        console.error('Error in updateCustomerWithVehicle:', error);
        res.status(400).json({ error: error.message });
    }
};

export const getCustomer = async (req, res) => {
    try {
        const customer = await Customer.findById(req.params.id);
        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }
        res.json(customer);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getCustomerVehicles = async (req, res) => {
    try {
        const customer = await Customer.findById(req.params.id);
        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }
        res.json(customer.vehicles);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getCustomerInvoices = async (req, res) => {
    try {
        const invoices = await Invoice.find({ customerId: req.params.id });
        res.json(invoices);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getAllCustomers = async (req, res) => {
    try {
        const customers = await Customer.find();
        res.json(customers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const deleteCustomer = async (req, res) => {
    try {
        const customer = await Customer.findByIdAndDelete(req.params.id);
        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        // Delete associated vehicles
        await Vehicle.deleteMany({ customerId: req.params.id });
        
        // Delete associated invoices
        await Invoice.deleteMany({ customerId: req.params.id });

        res.json({ message: 'Customer and associated data deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};