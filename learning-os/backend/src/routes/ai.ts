import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { AIService } from '../services/ai.service.js';
import multer from 'multer';

const router = express.Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// POST /api/ai/chat
router.post('/chat', authenticate, upload.single('image'), async (req: any, res) => {
    try {
        const { message, history, model } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return res.status(400).json({
                success: false,
                error: 'API Key is required. Please add GEMINI_API_KEY to .env'
            });
        }

        const aiService = new AIService(apiKey, req.user._id.toString(), model || 'gemini-2.0-flash');

        // Handle Image if present (Vision API)
        const imageParts: any[] = [];
        if (req.file) {
            imageParts.push({
                inlineData: {
                    data: req.file.buffer.toString('base64'),
                    mimeType: req.file.mimetype,
                },
            });
        }

        const response = await aiService.chat(message, JSON.parse(history || '[]'), imageParts);

        res.json({ success: true, response });
    } catch (error: any) {
        console.error('AI Route Error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'AI Service Failed'
        });
    }
});

export default router;
