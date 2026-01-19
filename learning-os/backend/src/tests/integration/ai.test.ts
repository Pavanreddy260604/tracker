import request from 'supertest';
import express from 'express';
import { jest } from '@jest/globals';
import aiRoutes from '../../routes/ai';
import { AIService } from '../../services/ai.service';

const app = express();
app.use(express.json());
// Mock auth
app.use((req: any, res, next) => {
    req.user = { _id: 'user123' }; // Fix: match router's req.user usage
    next();
});

// Mock the auth middleware used by the routes
jest.mock('../../middleware/auth', () => ({
    authenticate: (req: any, res: any, next: any) => {
        req.user = { _id: 'user123' };
        req.userId = 'user123';
        next();
    }
}));

app.use('/api/ai', aiRoutes);

// Mock AIService class
const mockChat = jest.fn();
jest.mock('../../services/ai.service', () => {
    return {
        AIService: jest.fn().mockImplementation(() => {
            return {
                chat: mockChat
            };
        })
    };
});

describe('AI Routes Integration', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /api/ai/chat', () => {
        it('should return AI response successfully', async () => {
            const mockResponse = {
                text: 'Hello! I can help you with your learning.',
                toolCalls: []
            };

            mockChat.mockResolvedValue(mockResponse as never);

            const res = await request(app)
                .post('/api/ai/chat')
                .send({
                    message: 'Hi there',
                    history: '[]',
                    model: 'gemini-pro'
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.response).toEqual(mockResponse);
            expect(mockChat).toHaveBeenCalledWith(
                'Hi there',
                expect.any(Array),
                expect.any(Array) // image parts
            );
        });

        it('should handle API errors gracefully', async () => {
            mockChat.mockRejectedValue(new Error('API Quota Exceeded') as never);

            const res = await request(app)
                .post('/api/ai/chat')
                .send({
                    message: 'Hi'
                });

            expect(res.status).toBe(500);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe('API Quota Exceeded');
        });
    });
});
