import express from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { AIClientService, AIServiceError } from '../services/aiClient.service.js';
import multer from 'multer';

const router = express.Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

const modelPattern = /^[a-zA-Z0-9:._\/-]+$/;

const historyMessageSchema = z.object({
    role: z.string().trim().min(1).max(32),
    content: z.string().max(8000),
}).strict();

const aiChatSchema = z.object({
    message: z.string().trim().min(1).max(32000),
    history: z.union([
        z.string(),
        z.array(historyMessageSchema),
    ]).optional(),
    model: z.string().trim().min(1).max(64).regex(modelPattern, 'Invalid model identifier').optional(),
}).strict();

const parseHistory = (rawHistory: unknown) => {
    if (!rawHistory) return [];

    if (Array.isArray(rawHistory)) {
        const parsedHistory = z.array(historyMessageSchema).safeParse(rawHistory);
        if (!parsedHistory.success) {
            throw new Error(parsedHistory.error.errors[0].message);
        }
        return parsedHistory.data;
    }

    if (typeof rawHistory === 'string') {
        const decoded = JSON.parse(rawHistory);
        const parsedHistory = z.array(historyMessageSchema).safeParse(decoded);
        if (!parsedHistory.success) {
            throw new Error(parsedHistory.error.errors[0].message);
        }
        return parsedHistory.data;
    }

    throw new Error('Invalid history format');
};

// POST /api/ai/chat
// Uses Ollama (local) — no API key required
router.post('/chat', authenticate, upload.single('image'), async (req: any, res) => {
    try {
        const parsedBody = aiChatSchema.safeParse(req.body ?? {});
        if (!parsedBody.success) {
            return res.status(400).json({
                success: false,
                error: parsedBody.error.errors[0].message
            });
        }

        const { message, history, model } = parsedBody.data;
        let parsedHistory: Array<{ role: string; content: string }> = [];

        try {
            parsedHistory = parseHistory(history);
        } catch (historyError: any) {
            return res.status(400).json({
                success: false,
                error: historyError.message || 'Invalid history payload'
            });
        }

        // Use Ollama via AIClientService — no API key needed
        const aiClient = new AIClientService(model, req.user._id.toString());

        // Build context messages
        const contextMessages = [
            ...parsedHistory,
            { role: 'user', content: message }
        ];

        const systemPrompt = `You are the "Learning OS Copilot", a high-performance AI assistant integrated into the user's personal Learning Operating System.

WHO YOU ARE:
- You are an expert software architect and mentor.
- You are specifically the "Learning OS Copilot".

CORE PRINCIPLES:
- Help the user master software engineering, build complex systems, and track their progress.
- Be encouraging, highly technical, and insightful.
- Provide full, production-ready code solutions when asked, but always explain the architectural "Why".

TONE: Professional, Insightful, Expert Mentor.`;

        // Try streaming first, fall back to buffered response
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Transfer-Encoding', 'chunked');

        try {
            for await (const chunk of aiClient.generateChatStream(contextMessages, systemPrompt)) {
                if (!chunk) continue;
                res.write(chunk);
            }
            res.end();
        } catch (streamError) {
            // Fallback to non-streaming
            console.warn('[AI Route] Streaming failed, falling back to buffered:', streamError);
            try {
                const response = await aiClient.chat(message, parsedHistory);
                res.write(response);
                res.end();
            } catch (fallbackError) {
                if (!res.writableEnded) {
                    const errorMsg = fallbackError instanceof AIServiceError
                        ? fallbackError.message
                        : 'AI Service unavailable. Make sure Ollama is running.';
                    res.write(errorMsg);
                    res.end();
                }
            }
        }
    } catch (error: any) {
        console.error('AI Route Error:', error);
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                error: error.message || 'AI Service Failed'
            });
        }
    }
});

export default router;
