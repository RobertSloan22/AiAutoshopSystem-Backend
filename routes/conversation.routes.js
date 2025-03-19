import express from 'express';
import {
  getAllConversations,
  getConversationById,
  createConversation,
  deleteConversation,
  searchConversations,
  getRecentConversations
} from '../controllers/conversation.controller.js';
import protectRoute from "../middleware/protectRoute.js";

const router = express.Router();

router.use(protectRoute);

router.get('/recent', protectRoute, getRecentConversations);
router.get('/:id', protectRoute, getConversationById);
router.post('/', protectRoute, createConversation);
router.delete('/:id', protectRoute, deleteConversation);
router.get('/search', protectRoute, searchConversations);

export default router; 