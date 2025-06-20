import express from 'express';
import {
  createAssistant,
  listAssistants,
  getAssistant,
  updateAssistant,
  deleteAssistant,
  createThread,
  addMessage,
  getMessages,
  createRun,
  getRun,
  submitToolOutputs,
  cancelRun,
  createThreadAndRun
} from '../controllers/assistants.controller.js';

const router = express.Router();

// Assistant routes
router.post('/', createAssistant);
router.get('/', listAssistants);
router.get('/:assistantId', getAssistant);
router.put('/:assistantId', updateAssistant);
router.delete('/:assistantId', deleteAssistant);

// Thread routes
router.post('/threads', createThread);
router.post('/threads/:threadId/messages', addMessage);
router.get('/threads/:threadId/messages', getMessages);

// Run routes
router.post('/threads/:threadId/runs', createRun);
router.get('/threads/:threadId/runs/:runId', getRun);
router.post('/threads/:threadId/runs/:runId/submit-tool-outputs', submitToolOutputs);
router.post('/threads/:threadId/runs/:runId/cancel', cancelRun);

// Thread and run creation (combined operation)
router.post('/thread-runs', createThreadAndRun);

export default router;