import express from 'express';
import fetch from 'node-fetch';

const router = express.Router();

const AGENT_SERVICE_URL = 'http://localhost:3000/agent';

router.post('/message', async (req, res) => {
    try {
        const { text, agentName, userId } = req.body;
        
        const response = await fetch(`${AGENT_SERVICE_URL}/message`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text,
                agentName,
                userId,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Agent service error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Error proxying request to agent service:', error);
        res.status(500).json({ 
            error: 'Failed to communicate with agent service',
            details: error.message 
        });
    }
});

export default router;