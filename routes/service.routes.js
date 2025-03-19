import express from 'express';
import ServiceRecord from '../models/serviceRecord.model.js';
import Technician from '../models/technician.model.js';
import protectRoute from "../middleware/protectRoute.js";

const router = express.Router();

// Create new service request
router.post('/requests', protectRoute, async (req, res) => {
    try {
        const {
            customerId,
            vehicleId,
            serviceType,
            description,
            priority,
            preferredDate,
            additionalNotes,
            technicianId
        } = req.body;

        const newService = new ServiceRecord({
            customerId,
            vehicleId,
            serviceDate: preferredDate || new Date(),
            serviceType,
            status: 'scheduled',
            technician: technicianId,
            notes: `${description}\n\nAdditional Notes: ${additionalNotes || 'None'}`,
            recommendations: [{
                service: description,
                priority: priority || 'normal'
            }]
        });

        await newService.save();
        
        // Populate customer, vehicle, and technician info
        const populatedService = await ServiceRecord.findById(newService._id)
            .populate('customerId')
            .populate('vehicleId')
            .populate('technician');

        res.status(201).json(populatedService);
    } catch (error) {
        console.error('Service request creation error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get all service records
router.get('/', protectRoute, async (req, res) => {
    try {
        const { status, technician, date } = req.query;
        let query = {};

        if (status) {
            query.status = status;
        }
        if (technician) {
            query.technician = technician;
        }
        if (date) {
            const searchDate = new Date(date);
            query.serviceDate = {
                $gte: searchDate,
                $lt: new Date(searchDate.setDate(searchDate.getDate() + 1))
            };
        }

        const services = await ServiceRecord.find(query)
            .populate('technician')
            .populate('customerId')
            .populate('vehicleId')
            .populate('parts.partId')
            .sort({ serviceDate: -1 });
        res.json(services);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get service records for a vehicle
router.get('/vehicle/:vehicleId', protectRoute, async (req, res) => {
    try {
        const services = await ServiceRecord.find({ vehicleId: req.params.vehicleId })
            .populate('technician')
            .populate('customerId')
            .populate('parts.partId')
            .sort({ serviceDate: -1 });
        res.json(services);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get service records for a technician
router.get('/technician/:technicianId', protectRoute, async (req, res) => {
    try {
        const { status } = req.query;
        let query = { technician: req.params.technicianId };
        
        if (status) {
            query.status = status;
        }

        const services = await ServiceRecord.find(query)
            .populate('customerId')
            .populate('vehicleId')
            .populate('parts.partId')
            .sort({ serviceDate: -1 });
        res.json(services);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create new service record
router.post('/', protectRoute, async (req, res) => {
    try {
        const newService = new ServiceRecord(req.body);
        await newService.save();
        
        const populatedService = await ServiceRecord.findById(newService._id)
            .populate('technician')
            .populate('customerId')
            .populate('vehicleId')
            .populate('parts.partId');
            
        res.status(201).json(populatedService);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Update service record
router.put('/:id', protectRoute, async (req, res) => {
    try {
        const updatedService = await ServiceRecord.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        ).populate('technician')
         .populate('customerId')
         .populate('vehicleId')
         .populate('parts.partId');

        if (!updatedService) {
            return res.status(404).json({ error: 'Service record not found' });
        }

        res.json(updatedService);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Assign technician to service
router.patch('/:id/assign', protectRoute, async (req, res) => {
    try {
        const { technicianId } = req.body;
        
        // Verify technician exists and is active
        const technician = await Technician.findById(technicianId);
        if (!technician) {
            return res.status(404).json({ error: 'Technician not found' });
        }
        if (technician.status !== 'active') {
            return res.status(400).json({ error: 'Technician is not available' });
        }

        const service = await ServiceRecord.findByIdAndUpdate(
            req.params.id,
            { 
                technician: technicianId,
                status: 'assigned'
            },
            { new: true }
        ).populate('technician')
         .populate('customerId')
         .populate('vehicleId');

        if (!service) {
            return res.status(404).json({ error: 'Service record not found' });
        }

        res.json(service);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Update service status
router.patch('/:id/status', protectRoute, async (req, res) => {
    try {
        const { status } = req.body;
        if (!['scheduled', 'assigned', 'in-progress', 'completed', 'cancelled'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const service = await ServiceRecord.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        ).populate('technician')
         .populate('customerId')
         .populate('vehicleId');

        if (!service) {
            return res.status(404).json({ error: 'Service record not found' });
        }

        // If service is completed, update technician's stats
        if (status === 'completed' && service.technician) {
            await Technician.findByIdAndUpdate(
                service.technician,
                { $inc: { completedServices: 1 } }
            );
        }

        res.json(service);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

export default router; 