import request from 'supertest';
import express from 'express';
import { jest } from '@jest/globals';
import { InterviewSession } from '../../models/InterviewSession';
import interviewRoutes from '../../routes/interview';
import { OllamaService } from '../../services/ollama.service';

// Mock dependencies
jest.mock('../../middleware/auth.js', () => ({
    authenticate: (req: any, res: any, next: any) => {
        req.user = { _id: 'user123' };
        req.userId = 'user123';
        next();
    }
}));

// Mock Ollama Service
jest.mock('../../services/ollama.service', () => {
    return {
        OllamaService: jest.fn().mockImplementation(() => ({
            generateQuestions: jest.fn().mockResolvedValue([
                {
                    title: 'Two Sum',
                    description: 'Find two numbers...',
                    signature: 'function twoSum(nums, target) {}'
                }
            ]),
            evaluateCode: jest.fn().mockResolvedValue({
                status: 'pass',
                feedback: 'Great solution!',
                score: 100
            })
        }))
    };
});

// Mock Mongoose Model
const mockSave = jest.fn();
const mockFindOne = jest.fn();
const mockFind = jest.fn();

jest.mock('../../models/InterviewSession', () => ({
    InterviewSession: jest.fn().mockImplementation((data) => ({
        ...data,
        save: mockSave,
        markModified: jest.fn(),
        questions: data.questions || [],
        toObject: () => data
    }))
}));

(InterviewSession as any).findOne = mockFindOne;
(InterviewSession as any).find = mockFind;

const app = express();
app.use(express.json());
app.use('/api/interview', interviewRoutes);

describe('Interview Routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockSave.mockResolvedValue(true);
    });

    it('should start a new interview session', async () => {
        const res = await request(app)
            .post('/api/interview/start')
            .send({
                duration: 30,
                questionCount: 1,
                difficulty: 'easy'
            });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(InterviewSession).toHaveBeenCalled(); // Constructor called
    });

    it('should submit code and get evaluation', async () => {
        const mockSession = {
            _id: 'session123',
            userId: 'user123',
            questions: [{
                problemName: 'Two Sum',
                description: 'Desc',
                status: 'pending'
            }],
            markModified: jest.fn(),
            save: mockSave
        };
        mockFindOne.mockResolvedValue(mockSession);

        const res = await request(app)
            .post('/api/interview/submit')
            .send({
                sessionId: 'session123',
                questionIndex: 0,
                code: 'console.log("hello")'
            });

        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe('pass');
        expect(res.body.data.score).toBe(100);
        expect(mockSession.save).toHaveBeenCalled();
    });
});
