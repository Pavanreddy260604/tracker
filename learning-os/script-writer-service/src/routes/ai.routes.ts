
import express from 'express';
import { aiServiceManager, AIProvider } from '../services/ai.manager';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

// GET /api/ai/provider
// Get current active provider
router.get('/provider', (req, res) => {
    res.json({
        success: true,
        data: {
            provider: aiServiceManager.getProvider()
        }
    });
});

// POST /api/ai/provider
// Switch provider
router.post('/provider', (req, res) => {
    const { provider } = req.body;

    if (!provider || !['ollama', 'gemini', 'groq'].includes(provider)) {
        return res.status(400).json({ error: 'Invalid provider. Use "ollama", "gemini", or "groq".' });
    }

    aiServiceManager.setProvider(provider as AIProvider);

    res.json({
        success: true,
        data: {
            provider: aiServiceManager.getProvider(),
            message: `Switched AI Service to ${provider.toUpperCase()}`
        }
    });
});

export const aiRoutes = router;
