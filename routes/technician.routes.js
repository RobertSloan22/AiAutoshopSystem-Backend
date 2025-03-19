import express from 'express';
import Technician from '../models/technician.model.js';
import protectRoute from '../middleware/protectRoute.js';

const router = express.Router();

// Get all technicians
router.get('/', protectRoute, async (req, res) => {
    try {
        const technicians = await Technician.find()
            .select('-email -certifications')
            .sort({ name: 1 });
        res.json(technicians);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get technician by ID
router.get('/:id', protectRoute, async (req, res) => {
    try {
        const technician = await Technician.findById(req.params.id);
        if (!technician) {
            return res.status(404).json({ error: 'Technician not found' });
        }
        res.json(technician);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create new technician
router.post('/', protectRoute, async (req, res) => {
    try {
        const newTechnician = new Technician(req.body);
        await newTechnician.save();
        res.status(201).json(newTechnician);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Update technician
router.put('/:id', protectRoute, async (req, res) => {
    try {
        const updatedTechnician = await Technician.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );
        if (!updatedTechnician) {
            return res.status(404).json({ error: 'Technician not found' });
        }
        res.json(updatedTechnician);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Delete technician
router.delete('/:id', protectRoute, async (req, res) => {
    try {
        const deletedTechnician = await Technician.findByIdAndDelete(req.params.id);
        if (!deletedTechnician) {
            return res.status(404).json({ error: 'Technician not found' });
        }
        res.json({ message: 'Technician deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get technician's current workload
router.get('/:id/workload', protectRoute, async (req, res) => {
    try {
        const technician = await Technician.findById(req.params.id);
        if (!technician) {
            return res.status(404).json({ error: 'Technician not found' });
        }

        // Get active services assigned to technician
        const activeServices = await ServiceRecord.find({
            technician: req.params.id,
            status: { $in: ['scheduled', 'in-progress'] }
        }).select('serviceType status serviceDate');

        res.json({
            technician: {
                id: technician._id,
                name: technician.name,
                status: technician.status
            },
            activeServices
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update technician's status
router.patch('/:id/status', protectRoute, async (req, res) => {
    try {
        const { status } = req.body;
        if (!['active', 'on_leave', 'unavailable'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const technician = await Technician.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        );

        if (!technician) {
            return res.status(404).json({ error: 'Technician not found' });
        }

        res.json(technician);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router; 