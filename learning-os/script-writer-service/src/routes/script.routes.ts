
import express from 'express';
import { scriptGenerator, ScriptRequest } from '../services/scriptGenerator.service';
import { FORMAT_TEMPLATES, STYLE_PROMPTS } from '../prompts/hollywood';
import { Script } from '../models/Script';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// All script routes require authentication
router.use(authenticate);

// GET /api/script/templates - List available formats and styles
router.get('/templates', (req, res) => {
    // Convert maps to arrays for frontend consumption
    const formats = Object.entries(FORMAT_TEMPLATES).map(([id, data]) => ({
        id,
        name: data.name,
        description: data.duration
    }));

    const styles = Object.entries(STYLE_PROMPTS).map(([id, data]) => ({
        id,
        name: data.name,
        description: (data as any).characteristics?.join(', ') || 'Standard style'
    }));

    res.json({
        success: true,
        data: {
            formats,
            styles
        }
    });
});

// GET /api/script/history - List user scripts
router.get('/history', async (req, res) => {
    const userId = req.userId;

    try {
        const scripts = await Script.find({ userId, isDeleted: false })
            .select('title prompt format style status createdAt metadata')
            .sort({ createdAt: -1 })
            .limit(20);

        res.json({
            success: true,
            data: scripts
        });
    } catch (error) {
        console.error('[API] Fetch history error:', error);
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

// GET /api/script/history/:id - Get single script
router.get('/history/:id', async (req, res) => {
    try {
        const script = await Script.findById(req.params.id);

        if (!script || script.userId.toString() !== req.userId) {
            return res.status(404).json({ error: 'Script not found' });
        }

        res.json({
            success: true,
            data: script
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch script' });
    }
});

// POST /api/script/generate - Serialize and stream the script
router.post('/generate', async (req, res) => {
    const request: ScriptRequest = { ...req.body, userId: req.userId as string };

    // Basic Validation
    if (!request.userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }
    if (!request.idea) {
        return res.status(400).json({ error: 'Idea is required' });
    }
    if (!request.format || !FORMAT_TEMPLATES[request.format]) {
        return res.status(400).json({ error: 'Invalid format' });
    }
    if (!request.style || !STYLE_PROMPTS[request.style]) {
        return res.status(400).json({ error: 'Invalid style' });
    }

    // Set headers for simple text streaming
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    try {
        console.log(`[API] Generating script: ${request.format}/${request.style} for user ${request.userId}`);

        for await (const chunk of scriptGenerator.generateScript(request)) {
            res.write(chunk);
        }

        res.end();
    } catch (error: any) {
        console.error('[API] Generation error:', error);
        // If headers haven't been sent (unlikely given streaming), send 500
        if (!res.headersSent) {
            res.status(500).json({ error: 'Generation failed' });
        } else {
            // If streaming started, we can't change status, but we can end the stream
            res.write('\n\n[ERROR: Generation interrupted]');
            res.end();
        }
    }
});

export const scriptRoutes = router;
