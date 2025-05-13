import express from "express";
import protectRoute from "../middleware/protectRoute.js";
import refreshTokenMiddleware from "../middleware/refreshTokenMiddleware.js";
import { getUsersForSidebar } from "../controllers/user.controller.js";

const router = express.Router();

// Apply refreshTokenMiddleware before protectRoute to enable automatic token refresh
router.get("/", refreshTokenMiddleware, protectRoute, getUsersForSidebar);

export default router;
