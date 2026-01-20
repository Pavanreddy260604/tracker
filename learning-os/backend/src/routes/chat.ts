import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { ChatSession } from '../models/ChatSession.js';
import { OllamaService } from '../services/ollama.service.js';

const router = express.Router();
const ollama = new OllamaService();

// GET /api/chat/history
// List recent chat sessions (sidebar)
router.get('/history', authenticate, async (req: any, res) => {
    try {
        const sessions = await ChatSession.find({ userId: req.userId })
            .sort({ updatedAt: -1 })
            .select('title updatedAt createdAt metadata')
            .limit(50);
        res.json({ success: true, data: sessions });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch history' });
    }
});

// GET /api/chat/:id
// Get full session details
router.get('/:id', authenticate, async (req: any, res) => {
    try {
        const session = await ChatSession.findOne({
            _id: req.params.id,
            userId: req.userId
        });
        if (!session) return res.status(404).json({ success: false, error: 'Session not found' });
        res.json({ success: true, data: session });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch session' });
    }
});

// POST /api/chat
// Start NEW session
router.post('/', authenticate, async (req: any, res) => {
    try {
        const { message, model } = req.body; // Optional initial message

        const session = new ChatSession({
            userId: req.userId,
            title: message ? message.substring(0, 30) + (message.length > 30 ? '...' : '') : 'New Chat',
            messages: [],
            metadata: { model: model || 'mistral' }
        });

        if (message) {
            session.messages.push({ role: 'user', content: message, timestamp: new Date() });
        }

        await session.save();
        res.json({ success: true, data: session });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to create session' });
    }
});

// POST /api/chat/:id/message
// Send message & Stream response
router.post('/:id/message', authenticate, async (req: any, res) => {
    try {
        const { message } = req.body;
        const sessionId = req.params.id;

        const session = await ChatSession.findOne({ _id: sessionId, userId: req.userId });
        if (!session) return res.status(404).json({ success: false, error: 'Session not found' });

        // 1. Save User Message
        session.messages.push({ role: 'user', content: message, timestamp: new Date() });
        // Update title if it's the first message and still default
        if (session.messages.length === 1 && session.title === 'New Conversation') {
            session.title = message.substring(0, 30) + (message.length > 30 ? '...' : '');
        }
        await session.save();

        // 2. Prepare Context (Last N messages to avoid context overflow, or full history if supported)
        // Ollama usually handles context window truncation, but sending 1000 messages is slow. 
        // Let's send last 20 messages for context + system prompt.
        const contextMessages = session.messages.slice(-20).map(m => ({
            role: m.role,
            content: m.content
        }));

        // 3. Stream Response
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Transfer-Encoding', 'chunked');

        const systemPrompt = "You are an intelligent, helpful AI assistant built into Learning OS. Be concise, professional, and technically accurate.";

        try {
            const stream = ollama.generateChatStream(contextMessages, systemPrompt);

            let fullReply = "";

            for await (const chunk of stream) {
                res.write(chunk);
                fullReply += chunk;
            }

            // 4. Save Assistant Response AFTER streaming is done
            if (fullReply) {
                // We need to re-fetch to avoid version error? OR just push to found session since we hold the lock logic (simple app)
                // Ideally, atomic update, but simple push is okay here for single user flow.
                await ChatSession.updateOne(
                    { _id: sessionId },
                    {
                        $push: { messages: { role: 'assistant', content: fullReply, timestamp: new Date() } },
                        $set: { updatedAt: new Date() } // Bump updated at
                    }
                );
            }

            res.end();

        } catch (streamError) {
            console.error("Streaming failed:", streamError);
            res.end();
        }

    } catch (error) {
        console.error('Chat Error:', error);
        if (!res.headersSent) res.status(500).json({ success: false, error: 'Message failed' });
    }
});

// DELETE /api/chat/:id
router.delete('/:id', authenticate, async (req: any, res) => {
    try {
        await ChatSession.deleteOne({ _id: req.params.id, userId: req.userId });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to delete session' });
    }
});

export default router;
