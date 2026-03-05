import request from 'supertest';
import express from 'express';
import { jest } from '@jest/globals';
import aiRoutes from '../../routes/ai';
import { AIClientService } from '../../services/aiClient.service';

const app = express();
app.use(express.json());
// Mock auth
app.use((req: any, res, next) => {
    req.user = { _id: 'user123' };
    req.userId = 'user123';
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

// Mock AIClientService
const mockGenerateResponse = jest.fn();
const mockGenerateChatStream = jest.fn();
jest.mock('../../services/aiClient.service', () => {
    return {
        AIClientService: jest.fn().mockImplementation(() => {
            return {
                generateResponse: mockGenerateResponse,
                generateChatStream: mockGenerateChatStream,
                chat: mockGenerateResponse,
            };
        }),
        AIServiceError: class AIServiceError extends Error {
            recoverable = true;
        }
    };
});

describe('AI Routes Integration', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /api/ai/chat', () => {
        it('should return AI response via streaming', async () => {
            // Stream mock: yields one chunk then returns
            mockGenerateChatStream.mockImplementation(async function* () {
                yield 'Hello! ';
                yield 'I can help.';
            });

            const res = await request(app)
                .post('/api/ai/chat')
                .send({
                    message: 'Hi there',
                });

            expect(res.status).toBe(200);
            expect(res.text).toContain('Hello!');
        });

        it('should handle API errors gracefully', async () => {
            mockGenerateChatStream.mockImplementation(async function* () {
                throw new Error('Ollama connection refused');
            });
            mockGenerateResponse.mockRejectedValue(new Error('All models failed') as never);

            const res = await request(app)
                .post('/api/ai/chat')
                .send({
                    message: 'Hi'
                });

            // The route writes an error message to the stream response
            expect(res.status).toBe(200); // Streaming always starts with 200
            expect(res.text).toBeTruthy();
        });
    });
});
