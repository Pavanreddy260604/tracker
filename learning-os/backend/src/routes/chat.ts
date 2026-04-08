import express from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { authenticate } from '../middleware/auth.js';
import { ChatSession } from '../models/ChatSession.js';
import { AIServiceError } from '../services/aiClient.service.js';
import { AIChatService } from '../services/aiChat.service.js';
import { chatRagService } from '../services/chatRag.service.js';
import { knowledgeRagService } from '../services/knowledgeRag.service.js';
import { ChatAttachment } from '../models/ChatAttachment.js';
import multer from 'multer';

const uploadDirectory = path.join(os.tmpdir(), 'learning-os-chat-uploads');
fs.mkdirSync(uploadDirectory, { recursive: true });

const upload = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, callback) => callback(null, uploadDirectory),
        filename: (_req, file, callback) => {
            const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
            callback(null, `${Date.now()}-${safeName}`);
        }
    }),
    limits: {
        fileSize: 50 * 1024 * 1024,
        files: 5
    }
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

const UNTITLED_SESSION_TITLES = new Set(['New Chat', 'New Conversation']);

const isUntitledSessionTitle = (title?: string | null) => UNTITLED_SESSION_TITLES.has(title || '');

const isValidObjectId = (value?: string | null) => Boolean(value && mongoose.Types.ObjectId.isValid(value));

const SUPPORTED_ATTACHMENT_EXTENSIONS = new Set([
    '.txt', '.md', '.markdown', '.json', '.js', '.jsx', '.ts', '.tsx', '.py', '.css', '.scss', '.sass',
    '.html', '.htm', '.xml', '.csv', '.yml', '.yaml', '.toml', '.ini', '.conf', '.log', '.env',
    '.sql', '.sh', '.bash', '.zsh', '.ps1', '.bat', '.cmd',
    '.java', '.kt', '.swift', '.c', '.cpp', '.h', '.hpp', '.go', '.rs', '.rb', '.php', '.lua', '.r',
    '.pdf', '.doc', '.docx', '.xlsx', '.xls'
]);

const SUPPORTED_ATTACHMENT_MIME_TYPES = new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/json',
    'application/javascript',
    'application/x-javascript',
    'application/typescript',
    'application/x-typescript',
    'application/xml',
    'text/xml',
    'text/markdown',
    'text/x-markdown',
    'text/csv',
    'application/csv',
    'application/x-yaml',
    'text/yaml',
    'text/x-yaml',
    'application/x-sh',
    'text/x-shellscript',
    'text/x-python',
    'application/x-python',
    'application/x-httpd-php',
    'text/x-java-source',
    'text/x-c',
    'text/x-c++',
    'text/x-go',
    'text/x-rust',
    'text/x-sql',
]);

const cleanupUploadedFiles = async (files: Array<Express.Multer.File | undefined | null>) => {
    await Promise.all(files.filter(Boolean).map(async (file) => {
        if (!file?.path) return;
        try {
            await fs.promises.unlink(file.path);
        } catch {
            // Ignore cleanup failures for temp files.
        }
    }));
};

const isSupportedAttachment = (file?: Express.Multer.File | null) => {
    if (!file) return false;

    const mimeType = (file.mimetype || '').toLowerCase();
    if (mimeType.startsWith('image/')) {
        return false;
    }

    if (mimeType.startsWith('text/') || SUPPORTED_ATTACHMENT_MIME_TYPES.has(mimeType)) {
        return true;
    }

    const extension = path.extname(file.originalname || '').toLowerCase();
    return SUPPORTED_ATTACHMENT_EXTENSIONS.has(extension);
};

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
    normalizedContext = '',
    conversationId = ''
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

    return `You are a fast, high-signal workspace assistant.

Core rules:
- Answer directly and concisely first. Expand only when useful.
- Use tools silently only when they materially improve accuracy.
- Use analyzeWorkspaceData for trends/data, listChatAttachments for current files, reviewGitHubRepo for GitHub URLs, and scrapeWebpage for webpages.
- Generate charts only when useful, and only as one \`\`\`chart\`\`\` JSON block with { "type", "title", "data", "xAxisKey", "dataKey" }.
- Ground answers in RELEVANT DOCUMENT CONTEXT and cite (Source: <filename>).
- If data is missing, say so plainly. Never hallucinate.

Conversation: ${conversationId}`;
};

const buildChatResponsePlan = async ({
    reqUserId,
    conversationId,
    session,
    message,
    requestedAssistantType,
    context,
    attachmentIds
}: {
    reqUserId: string;
    conversationId: string;
    session: any;
    message: string;
    requestedAssistantType?: 'learning-os' | 'script-writer';
    context?: z.infer<typeof contextSchema>;
    attachmentIds?: string[];
}) => {
    const contextMessages = session.messages.slice(-24).map((entry: any) => ({
        role: entry.role,
        content: entry.content
    }));

    const sessionModel = typeof session.metadata?.model === 'string' && session.metadata.model.trim().length > 0
        ? session.metadata.model
        : undefined;

    const assistantType = requestedAssistantType
        ? requestedAssistantType
        : (session.metadata?.assistantType === 'script-writer' ? 'script-writer' : 'learning-os');

    const hasAttachmentIds = Array.isArray(attachmentIds) && attachmentIds.length > 0;
    const hasInlineContext = hasResourceContext(context);
    const isSpecific = isSpecificQuery(message);
    const shouldInspectConversationAttachments = assistantType === 'learning-os' && !hasAttachmentIds && (hasInlineContext || isSpecific);
    const conversationHasAttachments = shouldInspectConversationAttachments
        ? await ChatAttachment.countDocuments({
            conversationId: new mongoose.Types.ObjectId(conversationId),
            status: 'completed'
        }) > 0
        : false;

    const shouldRetrieveTargetAttachments = assistantType === 'learning-os' && hasAttachmentIds;
    const shouldRetrieveConversationWide = assistantType === 'learning-os' && !hasAttachmentIds && conversationHasAttachments && isSpecific;
    const shouldRetrieveKnowledgeRag = assistantType === 'learning-os' && (hasInlineContext || shouldRetrieveTargetAttachments || shouldRetrieveConversationWide);

    const [ragContext, knowledgeContext] = await Promise.all([
        (shouldRetrieveTargetAttachments || shouldRetrieveConversationWide)
            ? chatRagService.retrieveContext(
                reqUserId,
                conversationId,
                message,
                shouldRetrieveTargetAttachments ? attachmentIds : undefined
            ).catch((ragError) => {
                console.warn('[Chat RAG] Retrieval failed:', ragError);
                return '';
            })
            : Promise.resolve(''),
        shouldRetrieveKnowledgeRag
            ? knowledgeRagService.retrieveContext(reqUserId, message).catch((ragError) => {
                console.warn('[Knowledge RAG] Retrieval failed:', ragError);
                return '';
            })
            : Promise.resolve('')
    ]);

    const normalizedContext = assistantType === 'script-writer'
        ? normalizeScriptWriterContext(context)
        : '';
    const systemPrompt = getSystemPrompt(assistantType, normalizedContext, conversationId);
    const fullPrompt = [systemPrompt, ragContext, knowledgeContext].filter(Boolean).join('\n\n');

    return {
        assistantType,
        contextMessages,
        fullPrompt,
        sessionModel
    };
};

const streamAssistantReply = async ({
    req,
    res,
    chatService,
    contextMessages,
    fullPrompt,
    message,
    conversationId,
    images,
    abortController
}: {
    req: express.Request;
    res: express.Response;
    chatService: AIChatService;
    contextMessages: Array<{ role: string; content: string }>;
    fullPrompt: string;
    message: string;
    conversationId: string;
    images?: string[];
    abortController: AbortController;
}) => {
    const abortSignal = abortController.signal;
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Transfer-Encoding', 'chunked');

    let assistantText = '';
    const handleDisconnect = () => {
        if (!abortSignal.aborted) {
            abortController.abort();
        }
    };

    req.on('close', handleDisconnect);
    res.on('close', handleDisconnect);

    try {
        try {
            for await (const chunk of chatService.generateChatStream(contextMessages, fullPrompt, images, abortSignal)) {
                if (!chunk) continue;
                assistantText += chunk;

                if (abortSignal.aborted) {
                    break;
                }

                if (!res.writableEnded) {
                    res.write(chunk);
                }
            }
        } catch (streamingError) {
            if (abortSignal.aborted) {
                // Client disconnected; keep partial text if any.
            } else {
                console.warn('[chat] Streaming API unavailable, falling back to buffered response:', streamingError);
                const fallbackHistory = [...contextMessages];
                const lastHistoryMessage = fallbackHistory[fallbackHistory.length - 1];
                if (lastHistoryMessage?.role === 'user' && lastHistoryMessage.content === message) {
                    fallbackHistory.pop();
                }
                const responseText = await chatService.chat(
                    message,
                    [{ role: 'system', content: fullPrompt }, ...fallbackHistory]
                );

                if (responseText) {
                    const chunkSize = 8;
                    for (let index = 0; index < responseText.length; index += chunkSize) {
                        if (abortSignal.aborted) break;

                        const chunk = responseText.slice(index, index + chunkSize);
                        assistantText += chunk;
                        if (!res.writableEnded) {
                            res.write(chunk);
                        }
                        await new Promise((resolve) => setTimeout(resolve, 4));
                    }
                }
            }
        }

        if (assistantText.trim().length > 0) {
            await ChatSession.updateOne(
                { _id: conversationId },
                {
                    $push: { messages: { role: 'assistant', content: assistantText, timestamp: new Date() } },
                    $set: { updatedAt: new Date() }
                }
            );
        }

        if (!abortSignal.aborted && !res.writableEnded) {
            res.end();
        }
    } catch (streamError) {
        if (abortSignal.aborted) {
            if (!res.writableEnded) {
                res.end();
            }
            return;
        }

        console.error('Chat processing failed:', streamError);
        if (!res.writableEnded) {
            const errorMessage = streamError instanceof AIServiceError
                ? streamError.message
                : 'AI chat processing failed.';
            res.write(errorMessage);
            res.end();
        }
    } finally {
        req.off('close', handleDisconnect);
        res.off('close', handleDisconnect);
    }
};

// GET /api/chat/history
// List recent chat conversations (sidebar)
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
// Get full conversation details
router.get('/:id', authenticate, async (req: any, res) => {
    try {
        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, error: 'Invalid conversation id' });
        }
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
// Start NEW conversation
router.post('/', authenticate, async (req: any, res) => {
    try {
        const parsed = createSessionSchema.safeParse(req.body ?? {});
        if (!parsed.success) {
            return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
        }
        const { message, model, assistantType } = parsed.data;

        // INFRA: Cleanup empty conversations for this user before creating a new one
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
        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, error: 'Invalid conversation id' });
        }
        const parsed = messageSchema.safeParse(req.body ?? {});
        if (!parsed.success) {
            return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
        }
        const { message, assistantType: requestedAssistantType, context, images, attachmentIds } = parsed.data;
        const conversationId = req.params.id;

        // 1. ATOMIC: Save User Message
        const session = await ChatSession.findOneAndUpdate(
            { _id: conversationId, userId: req.userId },
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

        if (!session) return res.status(404).json({ success: false, error: 'Conversation not found' });

        // Update title if it's the first message
        if (session.messages.length === 1 && isUntitledSessionTitle(session.title)) {
            await ChatSession.updateOne(
                { _id: conversationId },
                { $set: { title: toSessionTitle(message) } }
            );
        }

        if (requestedAssistantType && session.metadata?.assistantType !== requestedAssistantType) {
            await ChatSession.updateOne(
                { _id: conversationId },
                { $set: { 'metadata.assistantType': requestedAssistantType } }
            );
        }

        const { contextMessages, fullPrompt, sessionModel } = await buildChatResponsePlan({
            reqUserId: req.userId.toString(),
            conversationId,
            session,
            message,
            requestedAssistantType,
            context,
            attachmentIds
        });

        const effectiveUserId = (req as any).userId || req.body.userId || 'test-user';
        const chatService = new AIChatService(sessionModel, effectiveUserId);
        const abortController = new AbortController();

        await streamAssistantReply({
            req,
            res,
            chatService,
            contextMessages,
            fullPrompt,
            message,
            conversationId,
            images,
            abortController
        });

    } catch (error) {
        console.error('Chat Error:', error);
        if (!res.headersSent) res.status(500).json({ success: false, error: 'Message failed' });
    }
});

// POST /api/chat/:id/regenerate
// Regenerate the latest assistant reply
router.post('/:id/regenerate', authenticate, async (req: any, res) => {
    try {
        const conversationId = req.params.id;
        if (!isValidObjectId(conversationId)) {
            return res.status(400).json({ success: false, error: 'Invalid conversation id' });
        }

        const session = await ChatSession.findOne({
            _id: conversationId,
            userId: req.userId
        });

        if (!session) {
            return res.status(404).json({ success: false, error: 'Conversation not found' });
        }

        const sessionMessages = Array.isArray(session.messages) ? [...session.messages] : [];
        const trimmedMessages = sessionMessages[sessionMessages.length - 1]?.role === 'assistant'
            ? sessionMessages.slice(0, -1)
            : sessionMessages;

        const lastUserMessage = [...trimmedMessages].reverse().find((entry: any) => entry.role === 'user');
        if (!lastUserMessage) {
            return res.status(400).json({ success: false, error: 'No user message available to regenerate' });
        }

        if (trimmedMessages.length !== sessionMessages.length) {
            await ChatSession.updateOne(
                { _id: conversationId, userId: req.userId },
                {
                    $set: {
                        messages: trimmedMessages,
                        updatedAt: new Date()
                    }
                }
            );
        }

        const sessionForRegeneration = {
            ...session.toObject(),
            messages: trimmedMessages
        };

        const { contextMessages, fullPrompt, sessionModel } = await buildChatResponsePlan({
            reqUserId: req.userId.toString(),
            conversationId,
            session: sessionForRegeneration,
            message: lastUserMessage.content,
            requestedAssistantType: session.metadata?.assistantType,
            attachmentIds: Array.isArray(lastUserMessage.attachmentIds)
                ? lastUserMessage.attachmentIds
                : undefined
        });

        const chatService = new AIChatService(sessionModel, req.userId);
        const abortController = new AbortController();

        await streamAssistantReply({
            req,
            res,
            chatService,
            contextMessages,
            fullPrompt,
            message: lastUserMessage.content,
            conversationId,
            abortController
        });
    } catch (error) {
        console.error('Chat Regenerate Error:', error);
        if (!res.headersSent) {
            res.status(500).json({ success: false, error: 'Failed to regenerate message' });
        }
    }
});

// PATCH /api/chat/:id
// Update session (e.g. title)
router.patch('/:id', authenticate, async (req: any, res) => {
    try {
        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, error: 'Invalid conversation id' });
        }
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
        const conversationId = req.params.id;
        if (!isValidObjectId(conversationId)) {
            return res.status(400).json({ success: false, error: 'Invalid conversation id' });
        }
        // Clean up RAG data first
        await chatRagService.deleteConversationData(conversationId);
        
        await ChatSession.deleteOne({ _id: conversationId, userId: req.userId });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to delete conversation' });
    }
});

// POST /api/chat/:id/attachments
// Upload and index a file for RAG
router.post('/:id/attachments', authenticate, upload.single('file'), async (req: any, res) => {
    try {
        const conversationId = req.params.id;
        const file = req.file;

        if (!isValidObjectId(conversationId)) {
            await cleanupUploadedFiles([file]);
            return res.status(400).json({ success: false, error: 'Invalid conversation id' });
        }

        if (!file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }

        if (file.size > 50 * 1024 * 1024) {
            await cleanupUploadedFiles([file]);
            return res.status(400).json({ success: false, error: 'File exceeds the 50MB limit' });
        }

        if (!isSupportedAttachment(file)) {
            await cleanupUploadedFiles([file]);
            return res.status(400).json({
                success: false,
                error: `Unsupported attachment type for analysis: ${file.originalname}`
            });
        }

        const buffer = await fs.promises.readFile(file.path);
        const attachmentId = await chatRagService.indexFile(
            req.userId.toString(),
            conversationId,
            file.originalname,
            file.mimetype,
            buffer
        );

        res.json({ success: true, data: { attachmentId } });
    } catch (error: any) {
        console.error('[Chat Attachment] Upload failed:', error);
        res.status(500).json({ success: false, error: error.message || 'Failed to index file' });
    } finally {
        await cleanupUploadedFiles([req.file]);
    }
});

// POST /api/chat/:id/attachments/bulk
// Bulk upload and index multiple files
router.post('/:id/attachments/bulk', authenticate, upload.array('files', 5), async (req: any, res) => {
    try {
        const conversationId = req.params.id;
        const files = req.files as Express.Multer.File[];

        if (!isValidObjectId(conversationId)) {
            await cleanupUploadedFiles(files || []);
            return res.status(400).json({ success: false, error: 'Invalid conversation id' });
        }

        if (!files || files.length === 0) {
            return res.status(400).json({ success: false, error: 'No files uploaded' });
        }

        const oversized = files.find(f => f.size > 50 * 1024 * 1024);
        if (oversized) {
            await cleanupUploadedFiles(files);
            return res.status(400).json({ success: false, error: `File ${oversized.originalname} exceeds the 50MB limit` });
        }

        const totalSize = files.reduce((sum, file) => sum + file.size, 0);
        if (totalSize > 100 * 1024 * 1024) {
            await cleanupUploadedFiles(files);
            return res.status(400).json({ success: false, error: 'Bulk upload exceeds the 100MB total limit' });
        }

        const unsupportedFile = files.find((file) => !isSupportedAttachment(file));
        if (unsupportedFile) {
            await cleanupUploadedFiles(files);
            return res.status(400).json({
                success: false,
                error: `Unsupported attachment type for analysis: ${unsupportedFile.originalname}`
            });
        }

        const attachmentIds = await chatRagService.indexFilesBulk(
            req.userId.toString(),
            conversationId,
            await Promise.all(files.map(async (f) => ({
                name: f.originalname,
                type: f.mimetype,
                buffer: await fs.promises.readFile(f.path)
            })))
        );

        res.json({ success: true, data: { attachmentIds } });
    } catch (error: any) {
        console.error('[Chat Bulk Attachment] Upload failed:', error);
        res.status(500).json({ success: false, error: error.message || 'Failed to index files' });
    } finally {
        await cleanupUploadedFiles((req.files as Express.Multer.File[]) || []);
    }
});

export default router;
