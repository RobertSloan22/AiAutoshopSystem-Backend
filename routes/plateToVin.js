import express from 'express';
import { getVinFromPlate } from '../controllers/plateToVinController.js';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     PlateToVinResponse:
 *       type: object
 *       required:
 *         - licensePlate
 *         - state
 *       properties:
 *         licensePlate:
 *           type: string
 *           description: The license plate number
 *         state:
 *           type: string
 *           description: State where the vehicle is registered
 *         vin:
 *           type: string
 *           description: Vehicle Identification Number
 *         make:
 *           type: string
 *           description: Vehicle manufacturer
 *         model:
 *           type: string
 *           description: Vehicle model
 *         year:
 *           type: integer
 *           description: Vehicle year
 *         confidence:
 *           type: number
 *           format: float
 *           description: Confidence score of the match
 */

/**
 * @swagger
 * /api/plate-to-vin:
 *   post:
 *     summary: Convert license plate to VIN
 *     tags: [Plate to VIN]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - licensePlate
 *               - state
 *             properties:
 *               licensePlate:
 *                 type: string
 *                 description: License plate number
 *               state:
 *                 type: string
 *                 description: State code (e.g., CA, NY)
 *     responses:
 *       200:
 *         description: VIN information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PlateToVinResponse'
 *       400:
 *         description: Invalid input
 *       404:
 *         description: No matching vehicle found
 *       429:
 *         description: Rate limit exceeded
 */

// Route to get VIN from license plate
router.get('/lookup', getVinFromPlate);

export default router;