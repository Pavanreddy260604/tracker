import request from 'supertest';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { jest } from '@jest/globals';
import interviewRoutes from '../../routes/interview.js';
import * as interviewService from '../../services/interview.service.js';
import { executionQueueService } from '../../services/execution/executionQueue.service.js';
import { proctoringAttestationService } from '../../services/proctoring/attestation.service.js';

jest.mock('../../middleware/auth.js', () => ({
    authenticate: (req: Request & { userId?: string }, _res: Response, next: NextFunction) => {
        req.userId = 'user123';
        next();
    },
}));

jest.mock('../../middleware/advancedRateLimiter.js', () => ({
    rateLimits: {
        interviewStart: (_req: Request, _res: Response, next: NextFunction) => next(),
        write: (_req: Request, _res: Response, next: NextFunction) => next(),
        codeExecution: (_req: Request, _res: Response, next: NextFunction) => next(),
        proctoring: (_req: Request, _res: Response, next: NextFunction) => next(),
        aiChat: (_req: Request, _res: Response, next: NextFunction) => next(),
        api: (_req: Request, _res: Response, next: NextFunction) => next(),
    },
}));

jest.mock('../../services/interview.service.js', () => ({
    startInterview: jest.fn(),
    nextSection: jest.fn(),
    submitSection: jest.fn(),
    getSession: jest.fn(),
    updateProctoring: jest.fn(),
    getAnalytics: jest.fn(),
    submitCode: jest.fn(),
    runCode: jest.fn(),
    chatWithAI: jest.fn(),
    endInterview: jest.fn(),
    getHistory: jest.fn(),
    deleteSession: jest.fn(),
    clearHistory: jest.fn(),
}));

jest.mock('../../services/execution/executionQueue.service.js', () => ({
    executionQueueService: {
        enqueue: jest.fn(),
        waitForResult: jest.fn(),
    },
}));

jest.mock('../../services/proctoring/attestation.service.js', () => ({
    proctoringAttestationService: {
        generateSessionSecret: jest.fn(),
        verifyEvent: jest.fn(),
        assessViolation: jest.fn(),
    },
}));

jest.mock('../../infrastructure/redis.js', () => ({
    redis: {
        lrange: jest.fn().mockResolvedValue([]),
    },
}));

jest.mock('../../infrastructure/monitoring.js', () => ({
    logger: {
        audit: jest.fn(),
        info: jest.fn(),
        error: jest.fn(),
        security: jest.fn(),
    },
    interviewMetrics: {
        interviewStarted: { add: jest.fn() },
        interviewCompleted: { add: jest.fn() },
        interviewTerminated: { add: jest.fn() },
        proctoringViolation: { add: jest.fn() },
        aiRequest: { add: jest.fn() },
        aiRequestFailed: { add: jest.fn() },
        codeExecuted: { add: jest.fn() },
        codeExecutionFailed: { add: jest.fn() },
        scoreDistribution: { record: jest.fn() },
    },
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
            sections: [{ id: 'section-1' }],
            toObject: () => ({
                _id: 'session123',
                status: 'start',
                sections: [{ id: 'section-1' }],
            }),
        });
        (proctoringAttestationService.generateSessionSecret as jest.Mock).mockResolvedValue('proof-secret');

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
        expect(response.body.data.proctoringSecret).toBe('proof-secret');
        expect(interviewService.startInterview).toHaveBeenCalledWith(expect.objectContaining({
            userId: 'user123',
            language: 'javascript'
        }));
    });

    it('submits code and returns the normalized controller response', async () => {
        (interviewService.getSession as jest.Mock).mockResolvedValue({
            currentSectionIndex: 0,
            config: { language: 'javascript' },
            sections: [
                {
                    questions: [
                        {
                            type: 'coding',
                            questionId: 'question-1',
                            testCases: [{ input: '[2,7,11,15],9', expectedOutput: '[0,1]' }],
                        },
                    ],
                },
            ],
        });
        (executionQueueService.enqueue as jest.Mock).mockResolvedValue('job-1');
        (executionQueueService.waitForResult as jest.Mock).mockResolvedValue({
            status: 'completed',
            executionTimeMs: 15,
            results: [
                {
                    testCaseIndex: 0,
                    actualOutput: '[0,1]',
                    stdout: '',
                    stderr: '',
                    passed: true,
                },
            ],
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
        expect(executionQueueService.enqueue).toHaveBeenCalledWith(
            'javascript',
            'function twoSum() { return [0, 1]; }',
            [{ input: '[2,7,11,15],9', expectedOutput: '[0,1]' }],
            'session123',
            'user123',
            'question-1'
        );
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
