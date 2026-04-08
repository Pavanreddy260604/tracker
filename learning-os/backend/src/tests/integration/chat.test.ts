import request from 'supertest';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import chatRoutes from '../../routes/chat.js';
import { ChatSession } from '../../models/ChatSession.js';

var generateChatStreamMock = jest.fn((_messages: unknown, _systemPrompt?: string) => (async function* () {
    yield 'Analysis response.';
})());

var chatFallbackMock = jest.fn().mockResolvedValue('Fallback response.');

jest.mock('../../models/ChatSession.js', () => ({
    ChatSession: {
        findOneAndUpdate: jest.fn(),
        updateOne: jest.fn(),
        deleteOne: jest.fn(),
    },
}));

jest.mock('../../middleware/auth.js', () => ({
    authenticate: (req: Request & { userId?: string }, _res: Response, next: NextFunction) => {
        req.userId = 'user123';
        next();
    },
}));

jest.mock('../../services/aiChat.service.js', () => ({
    AIChatService: jest.fn().mockImplementation(() => ({
        generateChatStream: generateChatStreamMock,
        chat: chatFallbackMock,
    })),
}));

const app = express();
app.use(express.json());
app.use('/api/chat', chatRoutes);

describe('Chat Routes Integration', () => {
    const conversationId = new mongoose.Types.ObjectId().toString();

    beforeEach(() => {
        jest.clearAllMocks();
        (ChatSession.updateOne as jest.Mock).mockResolvedValue({ acknowledged: true });
    });

    it('accepts structured script-writer context and forwards it into a conversation-first system prompt', async () => {
        (ChatSession.findOneAndUpdate as jest.Mock).mockResolvedValue({
            _id: conversationId,
            title: 'Scene chat',
            messages: [
                { role: 'assistant', content: 'Earlier answer', timestamp: new Date() },
                { role: 'user', content: 'Why is this scene weak?', timestamp: new Date() },
            ],
            metadata: {
                model: 'mistral',
                assistantType: 'script-writer',
            },
        });

        const response = await request(app)
            .post(`/api/chat/${conversationId}/message`)
            .send({
                message: 'Why is this scene weak?',
                assistantType: 'script-writer',
                context: {
                    project: {
                        title: 'Karna',
                        logline: 'An abandoned child is raised in secrecy.',
                        genre: 'Drama',
                        tone: 'Epic',
                        language: 'Telugu',
                    },
                    scene: {
                        id: 'scene-1',
                        name: 'INT. RIVERBANK - DAY',
                    },
                    script: {
                        excerpt: 'ADHIRATHA lifts the basket from the water.',
                    },
                    selection: {
                        text: 'ADHIRATHA\nWhat child is this?',
                        lineStart: 14,
                        lineEnd: 18,
                        charCount: 31,
                    },
                    assistantPreferences: {
                        defaultMode: 'ask',
                        replyLanguage: 'Telugu',
                        transliteration: false,
                        savedDirectives: ['keep dialogue in Telugu'],
                    },
                },
            });

        expect(response.status).toBe(200);
        expect(response.text).toContain('Analysis response.');
        expect(generateChatStreamMock).toHaveBeenCalledTimes(1);

        const [_contextMessages, systemPrompt] = generateChatStreamMock.mock.calls[0];
        expect(systemPrompt).toContain('conversation-first');
        expect(systemPrompt).toContain('ACTIVE SCRIPT CONTEXT');
        expect(systemPrompt).toContain('Title: Karna');
        expect(systemPrompt).toContain('Scene: INT. RIVERBANK - DAY');
        expect(systemPrompt).toContain('Lines: 14-18');
        expect(systemPrompt).toContain('keep dialogue in Telugu');
        expect(systemPrompt).not.toContain('CHANGE SUMMARY');
    });

    it('rejects malformed structured context before hitting the chat backend', async () => {
        const response = await request(app)
            .post(`/api/chat/${conversationId}/message`)
            .send({
                message: 'Hello',
                assistantType: 'script-writer',
                context: {
                    selection: {
                        text: '',
                    },
                },
            });

        expect(response.status).toBe(400);
        expect(generateChatStreamMock).not.toHaveBeenCalled();
        expect(ChatSession.findOneAndUpdate).not.toHaveBeenCalled();
    });
});
