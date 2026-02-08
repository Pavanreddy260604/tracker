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

        // INFRA: Cleanup empty sessions for this user before creating a new one
        // This prevents accumulating "New Chat" orphans that were never used.
        await ChatSession.deleteMany({
            userId: req.userId,
            messages: { $size: 0 },
            createdAt: { $lt: new Date(Date.now() - 5 * 60 * 1000) } // Older than 5 mins
        });

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

        // 1. ATOMIC: Save User Message
        // Use findOneAndUpdate to ensure atomic append and return updated doc if needed
        const session = await ChatSession.findOneAndUpdate(
            { _id: sessionId, userId: req.userId },
            {
                $push: { messages: { role: 'user', content: message, timestamp: new Date() } },
                $set: { updatedAt: new Date() }
            },
            { new: true }
        );

        if (!session) return res.status(404).json({ success: false, error: 'Session not found' });

        // Update title if it's the first message
        if (session.messages.length === 1 && session.title === 'New Chat') {
            await ChatSession.updateOne(
                { _id: sessionId },
                { $set: { title: message.substring(0, 30) + (message.length > 30 ? '...' : '') } }
            );
        }

        // 2. Prepare Context (Last 20 messages)
        const contextMessages = session.messages.slice(-20).map(m => ({
            role: m.role,
            content: m.content
        }));

        // 3. Stream Response
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Transfer-Encoding', 'chunked');

        try {
            // User requested Ollama (local) usage.
            // We now initialize OllamaService with userId to enable "System Awareness" tools.
            const ollamaService = new OllamaService('mistral', req.userId);

            // Our upgraded OllamaService.chat() now handles Tools automatically and returns full text.
            // (We simulate streaming for the frontend for now, or we could update frontend to handle non-stream)
            const responseText = await ollamaService.chat(message, contextMessages);

            if (responseText) {
                res.write(responseText);

                // Save Assistant Response
                await ChatSession.updateOne(
                    { _id: sessionId },
                    {
                        $push: { messages: { role: 'assistant', content: responseText, timestamp: new Date() } },
                        $set: { updatedAt: new Date() }
                    }
                );
            }
            res.end();

        } catch (streamError) {
            console.error("Chat processing failed:", streamError);
            if (!res.writableEnded) res.end();
        }

    } catch (error) {
        console.error('Chat Error:', error);
        if (!res.headersSent) res.status(500).json({ success: false, error: 'Message failed' });
    }
});

// PATCH /api/chat/:id
// Update session (e.g. title)
router.patch('/:id', authenticate, async (req: any, res) => {
    try {
        const { title } = req.body;
        const updateData: any = {};
        if (title) updateData.title = title;

        const session = await ChatSession.findOneAndUpdate(
            { _id: req.params.id, userId: req.userId },
            { $set: updateData },
            { new: true }
        );

        if (!session) return res.status(404).json({ success: false, error: 'Session not found' });
        res.json({ success: true, data: session });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to update session' });
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
