import express from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { ChatSession } from '../models/ChatSession.js';
import { AIServiceError } from '../services/aiClient.service.js';
import { AIChatService } from '../services/aiChat.service.js';
import { chatRagService } from '../services/chatRag.service.js';
import { knowledgeRagService } from '../services/knowledgeRag.service.js';
import { ChatAttachment } from '../models/ChatAttachment.js';
import multer from 'multer';

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const router = express.Router();

const modelPattern = /^[a-zA-Z0-9:._\/-]+$/;
const assistantPreferencesSchema = z.object({
    defaultMode: z.enum(['ask', 'edit', 'agent']).optional(),
    replyLanguage: z.string().trim().min(1).max(50).optional(),
    transliteration: z.boolean().optional(),
    savedDirectives: z.array(z.string().trim().min(1).max(500)).max(12).optional(),
}).strict();

const selectionContextSchema = z.object({
    text: z.string().trim().min(1).max(12000),
    lineStart: z.number().int().positive().optional(),
    lineEnd: z.number().int().positive().optional(),
    charCount: z.number().int().nonnegative().optional(),
}).strict();

const structuredContextSchema = z.object({
    project: z.object({
        id: z.string().trim().min(1).max(64).optional(),
        title: z.string().trim().min(1).max(200).optional(),
        logline: z.string().trim().min(1).max(1200).optional(),
        genre: z.string().trim().min(1).max(100).optional(),
        tone: z.string().trim().min(1).max(100).optional(),
        language: z.string().trim().min(1).max(50).optional(),
    }).strict().optional(),
    scene: z.object({
        id: z.string().trim().min(1).max(64).optional(),
        name: z.string().trim().min(1).max(200).optional(),
    }).strict().optional(),
    script: z.object({
        excerpt: z.string().trim().min(1).max(12000).optional(),
    }).strict().optional(),
    selection: selectionContextSchema.nullish(),
    reply: z.object({
        language: z.string().trim().min(1).max(50).optional(),
        transliteration: z.boolean().optional(),
    }).strict().optional(),
    assistantPreferences: assistantPreferencesSchema.optional(),
}).strict();

const contextSchema = z.union([
    z.string().trim().min(1).max(16000),
    structuredContextSchema,
]);

const createSessionSchema = z.object({
    message: z.string().trim().min(1).max(32000).optional(),
    model: z.string().trim().min(1).max(64).regex(modelPattern, 'Invalid model identifier').optional(),
    assistantType: z.enum(['learning-os', 'script-writer']).optional(),
    attachmentIds: z.array(z.string()).optional(),
}).strict();

const messageSchema = z.object({
    message: z.string().trim().min(1).max(32000),
    assistantType: z.enum(['learning-os', 'script-writer']).optional(),
    context: contextSchema.optional(),
    images: z.array(z.string().min(1)).optional(),
    attachmentIds: z.array(z.string()).optional(),
}).strict();

const updateSessionSchema = z.object({
    title: z.string().trim().min(1).max(120).optional(),
    model: z.string().trim().min(1).max(64).regex(modelPattern, 'Invalid model identifier').optional(),
    assistantType: z.enum(['learning-os', 'script-writer']).optional(),
}).strict();

const toSessionTitle = (message?: string) =>
    message ? message.substring(0, 30) + (message.length > 30 ? '...' : '') : 'New Chat';

function normalizeScriptWriterContext(context?: z.infer<typeof contextSchema>): string {
    if (!context) return '';
    if (typeof context === 'string') {
        return context.trim().slice(0, 16000);
    }

    const sections: string[] = [];

    if (context.project) {
        const lines = [
            'PROJECT CONTEXT',
            context.project.title ? `Title: ${context.project.title}` : '',
            context.project.logline ? `Logline: ${context.project.logline}` : '',
            context.project.genre ? `Genre: ${context.project.genre}` : '',
            context.project.tone ? `Tone: ${context.project.tone}` : '',
            context.project.language ? `Language: ${context.project.language}` : '',
        ].filter(Boolean);
        if (lines.length > 1) sections.push(lines.join('\n'));
    }

    if (context.scene) {
        const lines = [
            'ACTIVE SCENE',
            context.scene.id ? `Scene ID: ${context.scene.id}` : '',
            context.scene.name ? `Scene: ${context.scene.name}` : '',
        ].filter(Boolean);
        if (lines.length > 1) sections.push(lines.join('\n'));
    }

    if (context.script?.excerpt) {
        sections.push(`OPEN SCRIPT EXCERPT\n${context.script.excerpt.slice(0, 12000)}`);
    }

    if (context.selection?.text) {
        const lines = [
            'ACTIVE SELECTION',
            typeof context.selection.lineStart === 'number' && typeof context.selection.lineEnd === 'number'
                ? `Lines: ${context.selection.lineStart}-${context.selection.lineEnd}`
                : '',
            typeof context.selection.charCount === 'number'
                ? `Characters: ${context.selection.charCount}`
                : '',
            context.selection.text,
        ].filter(Boolean);
        sections.push(lines.join('\n'));
    }

    if (context.reply) {
        const lines = [
            'REPLY PREFERENCES',
            context.reply.language ? `Reply Language: ${context.reply.language}` : '',
            typeof context.reply.transliteration === 'boolean'
                ? `Transliteration: ${context.reply.transliteration ? 'enabled' : 'disabled'}`
                : '',
        ].filter(Boolean);
        if (lines.length > 1) sections.push(lines.join('\n'));
    }

    if (context.assistantPreferences) {
        const directives = context.assistantPreferences.savedDirectives || [];
        const lines = [
            'SAVED ASSISTANT PREFERENCES',
            context.assistantPreferences.defaultMode ? `Default Mode: ${context.assistantPreferences.defaultMode}` : '',
            context.assistantPreferences.replyLanguage ? `Preferred Reply Language: ${context.assistantPreferences.replyLanguage}` : '',
            typeof context.assistantPreferences.transliteration === 'boolean'
                ? `Preferred Transliteration: ${context.assistantPreferences.transliteration ? 'enabled' : 'disabled'}`
                : '',
            directives.length > 0 ? `Directives:\n- ${directives.slice(0, 8).join('\n- ')}` : '',
        ].filter(Boolean);
        if (lines.length > 1) sections.push(lines.join('\n'));
    }

    return sections.join('\n\n').trim();
}

function hasResourceContext(context?: z.infer<typeof contextSchema>): boolean {
    if (!context) return false;
    if (typeof context === 'string') return context.trim().length > 0;

    return Boolean(
        context.project?.title ||
        context.project?.logline ||
        context.project?.genre ||
        context.project?.tone ||
        context.project?.language ||
        context.scene?.id ||
        context.scene?.name ||
        context.script?.excerpt ||
        context.selection?.text
    );
}

function isSpecificQuery(message: string): boolean {
    const text = message.trim().toLowerCase();
    if (!text) return false;

    const genericGreeting = /^(hi|hello|hey|thanks|thank you|ok|okay|cool|test|ping|yo|sup)\b/;
    if (genericGreeting.test(text)) return false;

    const resourceHints = /\b(file|files|document|doc|pdf|attachment|attachments|upload|uploaded|notes|notebook|kb|knowledge base|source|sources|cite|citation|context|from my|in my|from the doc|from the file|in the file|in the doc|in the pdf)\b/;
    const taskHints = /\b(summarize|summary|explain|extract|find|search|compare|analyze|list|quote|show|give me|based on|according to|what does it say)\b/;

    if (resourceHints.test(text) || taskHints.test(text)) return true;
    if (text.length >= 80) return true;
    if (text.includes('?') && text.length >= 20) return true;

    return false;
}

const getSystemPrompt = (
    assistantType: 'learning-os' | 'script-writer',
    normalizedContext = ''
) => {
    if (assistantType === 'script-writer') {
        const basePrompt = `You are a senior screenplay assistant working inside a script editor.

Default behavior:
- Be conversation-first. Normal questions, critique, and choice discussion are the default.
- Ground every answer in the provided script context when it exists.
- Follow the user's stated choices and preferences precisely.
- Only draft rewrites, patches, or replacement text when the user explicitly asks for them.
- If the request is ambiguous between analysis and rewriting, ask a brief clarifying question.
- For non-trivial rewrite requests, first summarize the scope and constraints in 1-2 sentences, then provide the requested output.
- Do not force fixed section headings for ordinary chat.
- Preserve continuity, character voice, and causal logic when discussing or proposing changes.
- If context is insufficient, say what is missing instead of inventing facts.`;

        if (!normalizedContext) {
            return basePrompt;
        }

        return `${basePrompt}\n\n## ACTIVE SCRIPT CONTEXT\n${normalizedContext}`;
    }

    return `You are the "Learning OS Copilot", a specialized AI assistant in this workspace.
Identify as the Learning OS Copilot. Be a senior software engineer and mentor.
You have access to tools to see the user's roadmap, logs, and DSA progress-use them if the user asks about their state.

GROUNDEDNESS RULES:
1. If "RELEVANT DOCUMENT CONTEXT" is provided, you MUST prioritize this information over your general knowledge.
2. If the context contains the answer, cite the filename using (Source: <filename>).
3. If the context is insufficient but relevant, combine it with your knowledge but clearly distinguish what comes from the document.
4. If "RELEVANT KNOWLEDGE BASE CONTEXT" is provided, cite it as (Knowledge Base: <title>).
5. If the user asks about something in their files and the context is missing, explicitly state "I don't see that information in the uploaded files."
6. When you use any provided context, add a short "Sources Summary:" list with 1-line summaries for each cited source.
7. DO NOT hallucinate or make up facts about the user's personal documents.`;
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
        const { message, assistantType: requestedAssistantType, context, images, attachmentIds } = parsed.data;
        const sessionId = req.params.id;

        // 1. ATOMIC: Save User Message
        // Use findOneAndUpdate to ensure atomic append and return updated doc if needed
        const session = await ChatSession.findOneAndUpdate(
            { _id: sessionId, userId: req.userId },
            {
                $push: { 
                    messages: { 
                        role: 'user', 
                        content: message, 
                        timestamp: new Date(),
                        attachmentIds: attachmentIds || []
                    } 
                },
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

        // 3. Resolve assistant type + RAG context
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

        const hasAttachmentIds = Array.isArray(attachmentIds) && attachmentIds.length > 0;
        const sessionHasAttachments = session.messages.some(
            (entry) => Array.isArray(entry.attachmentIds) && entry.attachmentIds.length > 0
        );
        const hasInlineContext = hasResourceContext(context);
        const isSpecific = isSpecificQuery(message);
        const shouldRetrieveChatRag = (hasAttachmentIds || sessionHasAttachments) && isSpecific;
        const shouldRetrieveKnowledgeRag =
            assistantType === 'learning-os' &&
            (hasInlineContext || ((hasAttachmentIds || sessionHasAttachments) && isSpecific));

        const [ragContext, knowledgeContext] = await Promise.all([
            shouldRetrieveChatRag
                ? chatRagService.retrieveContext(
                    req.userId.toString(),
                    sessionId,
                    message,
                    attachmentIds
                ).catch((ragError) => {
                    console.warn('[Chat RAG] Retrieval failed:', ragError);
                    return '';
                })
                : Promise.resolve(''),
            shouldRetrieveKnowledgeRag
                ? knowledgeRagService.retrieveContext(req.userId.toString(), message).catch((ragError) => {
                    console.warn('[Knowledge RAG] Retrieval failed:', ragError);
                    return '';
                })
                : Promise.resolve('')
        ]);

        const normalizedContext = assistantType === 'script-writer'
            ? normalizeScriptWriterContext(context)
            : '';
        const systemPrompt = getSystemPrompt(assistantType, normalizedContext);
        const fullPrompt = [systemPrompt, ragContext, knowledgeContext].filter(Boolean).join('\n\n');

        // 4. Stream Response
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Transfer-Encoding', 'chunked');

        try {
            // User requested Ollama (local) usage.
            // We now initialize AIChatService with userId to enable "System Awareness" tools.
            const chatService = new AIChatService(sessionModel, req.userId);

            let assistantText = '';

            try {
                for await (const chunk of chatService.generateChatStream(contextMessages, fullPrompt)) {
                    if (!chunk) continue;
                    assistantText += chunk;
                    res.write(chunk);
                }
            } catch (streamingError) {
                console.warn('[chat] Streaming API unavailable, falling back to buffered response:', streamingError);
                const responseText = await chatService.chat(
                    message,
                    [{ role: 'system', content: fullPrompt }, ...contextMessages]
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

        const { title, model, assistantType } = parsed.data;
        const updates: Record<string, unknown> = {};

        if (typeof title === 'string') updates.title = title;
        if (typeof model === 'string') updates['metadata.model'] = model;
        if (assistantType) updates['metadata.assistantType'] = assistantType;

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ success: false, error: 'No valid updates provided' });
        }

        const session = await ChatSession.findOneAndUpdate(
            { _id: req.params.id, userId: req.userId },
            { $set: updates },
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
        const sessionId = req.params.id;
        // Clean up RAG data first
        await chatRagService.deleteSessionData(sessionId);
        
        await ChatSession.deleteOne({ _id: sessionId, userId: req.userId });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to delete session' });
    }
});

// POST /api/chat/:id/attachments
// Upload and index a file for RAG
router.post('/:id/attachments', authenticate, upload.single('file'), async (req: any, res) => {
    try {
        const sessionId = req.params.id;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }

        const attachmentId = await chatRagService.indexFile(
            req.userId.toString(),
            sessionId,
            file.originalname,
            file.mimetype,
            file.buffer
        );

        res.json({ success: true, data: { attachmentId } });
    } catch (error: any) {
        console.error('[Chat Attachment] Upload failed:', error);
        res.status(500).json({ success: false, error: error.message || 'Failed to index file' });
    }
});

export default router;
