import request from 'supertest';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { jest } from '@jest/globals';
import interviewRoutes from '../../routes/interview.js';
import * as interviewService from '../../services/interview.service.js';

jest.mock('../../middleware/auth.js', () => ({
    authenticate: (req: Request & { userId?: string }, _res: Response, next: NextFunction) => {
        req.userId = 'user123';
        next();
    },
}));

jest.mock('../../middleware/rateLimiter.js', () => ({
    apiLimiter: (_req: Request, _res: Response, next: NextFunction) => next(),
    interviewWriteLimiter: (_req: Request, _res: Response, next: NextFunction) => next(),
    writeLimiter: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

jest.mock('../../services/interview.service.js', () => ({
    startInterview: jest.fn(),
    nextSection: jest.fn(),
    submitSection: jest.fn(),
    updateProctoring: jest.fn(),
    getAnalytics: jest.fn(),
    submitCode: jest.fn(),
    runCode: jest.fn(),
    chatWithAI: jest.fn(),
    endInterview: jest.fn(),
    getHistory: jest.fn(),
    getSession: jest.fn(),
    deleteSession: jest.fn(),
    clearHistory: jest.fn(),
}));

const app = express();
app.use(express.json());
app.use('/api/interview', interviewRoutes);

describe('Interview Routes Integration', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('starts a new interview session with the current controller contract', async () => {
        (interviewService.startInterview as jest.Mock).mockResolvedValue({
            _id: 'session123',
            status: 'start',
            sections: [{ id: 'section-1' }]
        });

        const response = await request(app)
            .post('/api/interview/start')
            .send({
                duration: 90,
                language: 'javascript',
                hasCameraAccess: true,
                strictMode: false,
                sectionsConfig: [
                    {
                        name: 'Warm-up',
                        type: 'coding',
                        duration: 30,
                        questionCount: 2,
                        questionsConfig: [{ difficulty: 'easy', topics: ['Array'] }]
                    }
                ]
            });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(interviewService.startInterview).toHaveBeenCalledWith(expect.objectContaining({
            userId: 'user123',
            language: 'javascript'
        }));
    });

    it('submits code and returns the normalized controller response', async () => {
        (interviewService.submitCode as jest.Mock).mockResolvedValue({
            status: 'pass',
            score: 100,
            summary: { passed: 1, total: 1 }
        });

        const response = await request(app)
            .post('/api/interview/submit')
            .send({
                sessionId: 'session123',
                questionIndex: 0,
                code: 'function twoSum() { return [0, 1]; }'
            });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe('pass');
        expect(response.body.data.score).toBe(100);
        expect(interviewService.submitCode).toHaveBeenCalledWith({
            userId: 'user123',
            sessionId: 'session123',
            questionIndex: 0,
            code: 'function twoSum() { return [0, 1]; }'
        });
    });

    it('surfaces service validation errors for unsupported languages', async () => {
        (interviewService.startInterview as jest.Mock).mockRejectedValue(
            Object.assign(new Error('Unsupported interview language. Use JavaScript, Python, Java, C++, or Go.'), {
                statusCode: 400
            })
        );

        const response = await request(app)
            .post('/api/interview/start')
            .send({
                language: 'brainfuck',
                sectionsConfig: [
                    {
                        name: 'Warm-up',
                        type: 'coding',
                        duration: 30,
                        questionCount: 1,
                    }
                ]
            });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toMatch(/unsupported interview language/i);
    });
});
