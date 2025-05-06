import express from 'express';
import { 
    createVehicle, 
    getVehicle, 
    updateVehicle, 
    deleteVehicle, 
    getCustomerVehicles,
    getVehicleServiceHistory,
    getAllVehicles,
    getVehiclesByCustomerName,
    getRecentVehicles,
} from '../controllers/vehicleController.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import protectRoute from "../middleware/protectRoute.js";
import Vehicle from "../models/vehicle.model.js";
const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Vehicle:
 *       type: object
 *       required:
 *         - make
 *         - model
 *         - year
 *         - vin
 *       properties:
 *         make:
 *           type: string
 *           description: Vehicle manufacturer
 *         model:
 *           type: string
 *           description: Vehicle model
 *         year:
 *           type: integer
 *           description: Manufacturing year
 *         vin:
 *           type: string
 *           description: Vehicle Identification Number
 *         color:
 *           type: string
 *           description: Vehicle color
 *         licensePlate:
 *           type: string
 *           description: License plate number
 *         ownerId:
 *           type: string
 *           description: ID of the vehicle owner
 */

/**
 * @swagger
 * /api/vehicles:
 *   get:
 *     summary: Get all vehicles
 *     tags: [Vehicles]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of vehicles
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Vehicle'
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/vehicles/{id}:
 *   get:
 *     summary: Get vehicle by ID
 *     tags: [Vehicles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Vehicle ID
 *     responses:
 *       200:
 *         description: Vehicle details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Vehicle'
 *       404:
 *         description: Vehicle not found
 */

/**
 * @swagger
 * /api/vehicles:
 *   post:
 *     summary: Create a new vehicle
 *     tags: [Vehicles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Vehicle'
 *     responses:
 *       201:
 *         description: Vehicle created successfully
 *       400:
 *         description: Invalid input
 */

/**
 * @swagger
 * /api/vehicles/{id}:
 *   put:
 *     summary: Update a vehicle
 *     tags: [Vehicles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Vehicle ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Vehicle'
 *     responses:
 *       200:
 *         description: Vehicle updated successfully
 *       404:
 *         description: Vehicle not found
 */

/**
 * @swagger
 * /api/vehicles/{id}:
 *   delete:
 *     summary: Delete a vehicle
 *     tags: [Vehicles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Vehicle ID
 *     responses:
 *       200:
 *         description: Vehicle deleted successfully
 *       404:
 *         description: Vehicle not found
 */

// Get all vehicles
router.get('/', protectRoute, getAllVehicles);
// Get all vehicles for a customer
router.get('/customer', protectRoute, getVehiclesByCustomerName);
// Get single vehicle
router.get('/:id', protectRoute, getVehicle);

// Add new vehicle
router.post('/', protectRoute, createVehicle);

// Update vehicle
router.put('/:id', protectRoute, updateVehicle);

// Delete vehicle
router.delete('/:id', protectRoute, deleteVehicle);

// Get vehicle service history
router.get('/:id/service-history', protectRoute, getVehicleServiceHistory);

// create a invoices/recent route
router.get('/invoices/recent', protectRoute, getRecentVehicles);

export default router; 