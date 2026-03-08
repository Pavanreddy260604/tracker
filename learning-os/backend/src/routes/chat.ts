import express from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { ChatSession } from '../models/ChatSession.js';
import { AIServiceError } from '../services/aiClient.service.js';
import { AIChatService } from '../services/aiChat.service.js';

const router = express.Router();
const aiChat = new AIChatService();

const modelPattern = /^[a-zA-Z0-9:._-]+$/;

const createSessionSchema = z.object({
    message: z.string().trim().min(1).max(4000).optional(),
    model: z.string().trim().min(1).max(64).regex(modelPattern, 'Invalid model identifier').optional(),
    assistantType: z.enum(['learning-os', 'script-writer']).optional(),
}).strict();

const messageSchema = z.object({
    message: z.string().trim().min(1).max(4000),
    assistantType: z.enum(['learning-os', 'script-writer']).optional(),
}).strict();

const updateSessionSchema = z.object({
    title: z.string().trim().min(1).max(120),
}).strict();

const toSessionTitle = (message?: string) =>
    message ? message.substring(0, 30) + (message.length > 30 ? '...' : '') : 'New Chat';

const getSystemPrompt = (assistantType: 'learning-os' | 'script-writer') => {
    if (assistantType === 'script-writer') {
        return `You are an AI Script Engineering Assistant.

Your role is similar to a coding assistant but for screenplays and scene-based storytelling. You help edit, modify, and maintain story coherence across multiple scenes.

Follow these rules strictly:

1. Treat the screenplay like a structured system, not plain text. The story consists of:
- Characters
- Scenes
- Timeline
- Character arcs
- World rules
- Dialogue

2. When the user requests a change (for example: change character traits, modify a scene, alter tone, remove events), you must:
- Identify which scenes are affected
- Update only necessary parts
- Preserve narrative continuity and character consistency
- Ensure timeline and story logic remain valid

3. Do not rewrite the entire script unless requested. Make surgical edits like a code assistant modifying specific functions.

4. Always output these sections in this exact order:
CHANGE SUMMARY
- List of scenes affected
- Characters affected
- Narrative implications

PATCH
- Show only modified scenes or dialogue blocks

CONTINUITY CHECK
- Verify timeline consistency
- Verify character motivations
- Identify potential contradictions

5. Maintain global story memory for:
- Character goals
- Unresolved plot points
- Emotional arcs
- Major events

6. While editing scenes:
- Preserve existing tone unless instructed otherwise
- Maintain character voice
- Keep cause-effect relationships logical

7. If a requested change creates contradictions, propose 2-3 solutions.

Editing style:
- Behave like version control for stories
- Scenes are modules
- Edits are patches
- Prioritize coherence, structure, and minimal meaningful changes`;
    }

    return `You are the "Learning OS Copilot", a specialized AI assistant in this workspace.
Identify as the Learning OS Copilot. Be a senior software engineer and mentor.
You have access to tools to see the user's roadmap, logs, and DSA progress-use them if the user asks about their state.`;
};

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
        const parsed = createSessionSchema.safeParse(req.body ?? {});
        if (!parsed.success) {
            return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
        }
        const { message, model, assistantType } = parsed.data;

        // INFRA: Cleanup empty sessions for this user before creating a new one
        // This prevents accumulating "New Chat" orphans that were never used.
        await ChatSession.deleteMany({
            userId: req.userId,
            messages: { $size: 0 },
            createdAt: { $lt: new Date(Date.now() - 5 * 60 * 1000) } // Older than 5 mins
        });

        const session = new ChatSession({
            userId: req.userId,
            title: toSessionTitle(message),
            messages: [],
            metadata: {
                model: model || 'mistral',
                assistantType: assistantType || 'learning-os'
            }
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
        const parsed = messageSchema.safeParse(req.body ?? {});
        if (!parsed.success) {
            return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
        }
        const { message, assistantType: requestedAssistantType } = parsed.data;
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
                { $set: { title: toSessionTitle(message) } }
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
            // We now initialize AIChatService with userId to enable "System Awareness" tools.
            const sessionModel = typeof session.metadata?.model === 'string' && session.metadata.model.trim().length > 0
                ? session.metadata.model
                : undefined;
            const assistantType = requestedAssistantType
                ? requestedAssistantType
                : (session.metadata?.assistantType === 'script-writer' ? 'script-writer' : 'learning-os');

            if (requestedAssistantType && session.metadata?.assistantType !== requestedAssistantType) {
                await ChatSession.updateOne(
                    { _id: sessionId },
                    { $set: { 'metadata.assistantType': requestedAssistantType } }
                );
            }

            const systemPrompt = getSystemPrompt(assistantType);
            const chatService = new AIChatService(sessionModel, req.userId);

            let assistantText = '';

            try {
                for await (const chunk of chatService.generateChatStream(contextMessages, systemPrompt)) {
                    if (!chunk) continue;
                    assistantText += chunk;
                    res.write(chunk);
                }
            } catch (streamingError) {
                console.warn('[chat] Streaming API unavailable, falling back to buffered response:', streamingError);
                const responseText = await chatService.chat(
                    message,
                    [{ role: 'system', content: systemPrompt }, ...contextMessages]
                );
                if (responseText) {
                    // Keep fallback chunks small so the UI still gets incremental feedback.
                    const chunkSize = 8;
                    for (let i = 0; i < responseText.length; i += chunkSize) {
                        const chunk = responseText.slice(i, i + chunkSize);
                        assistantText += chunk;
                        res.write(chunk);
                        await new Promise(resolve => setTimeout(resolve, 4));
                    }
                }
            }

            if (assistantText.trim().length > 0) {
                // Save Assistant Response
                await ChatSession.updateOne(
                    { _id: sessionId },
                    {
                        $push: { messages: { role: 'assistant', content: assistantText, timestamp: new Date() } },
                        $set: { updatedAt: new Date() }
                    }
                );
            }
            res.end();

        } catch (streamError) {
            console.error("Chat processing failed:", streamError);
            if (!res.writableEnded) {
                const message = streamError instanceof AIServiceError
                    ? streamError.message
                    : 'AI chat processing failed.';
                res.write(message);
                res.end();
            }
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
        const parsed = updateSessionSchema.safeParse(req.body ?? {});
        if (!parsed.success) {
            return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
        }

        const session = await ChatSession.findOneAndUpdate(
            { _id: req.params.id, userId: req.userId },
            { $set: parsed.data },
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



