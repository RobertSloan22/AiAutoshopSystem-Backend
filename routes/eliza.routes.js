import express from 'express';
import { getElizaAgent } from '../../../AutoAI-Elizaos/src/elizaServer.js'; // Adjust path if needed

const router = express.Router();

// POST /eliza/message - send user message to Eliza
router.post('/message', async (req, res) => {
  try {
    const { agents } = await getElizaAgent();
    const agent = agents[0]; // fixed ID agent

    const { message, userId, sessionId } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Missing message in request body' });
    }

    const response = await agent.respond({
      input: message,
      userId: userId || 'anon',
      sessionId: sessionId || 'default',
    });

    res.json({ response });
  } catch (error) {
    console.error('Eliza /message error:', error);
    res.status(500).json({ error: 'Eliza failed to process message' });
  }
});

// GET /eliza/agent/:id - get metadata about agent
router.get('/agent/:id', async (req, res) => {
  try {
    const { agents } = await getElizaAgent();
    const agent = agents.find(a => a.agentId === req.params.id);

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    res.json({
      id: agent.agentId,
      name: agent.character.name,
      description: agent.character.description,
    });
  } catch (error) {
    console.error('Eliza /agent/:id error:', error);
    res.status(500).json({ error: 'Failed to get agent info' });
  }
});

export default router;
