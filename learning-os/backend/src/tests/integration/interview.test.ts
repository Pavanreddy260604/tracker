import request from 'supertest';
import express from 'express';
import { jest } from '@jest/globals';
import interviewRoutes from '../../routes/interview';
import { InterviewSession } from '../../models/InterviewSession';
import { Question } from '../../models/Question';
import { ExecutionService } from '../../services/execution.service';
import { QuestionGenerationService } from '../../services/questionGeneration.service';
import { AIJudgeService } from '../../services/aiJudge.service';
import * as aiJudgeServiceModule from '../../services/aiJudge.service';
import * as questionGenerationServiceModule from '../../services/questionGeneration.service';

const mockInterviewSessionSave = jest.fn();
const mockInterviewSessionFindOne = jest.fn();
const mockInterviewSessionFind = jest.fn();

const mockQuestionSave = jest.fn();
const mockQuestionAggregate = jest.fn();
const mockQuestionFindOne = jest.fn();
const mockQuestionFindById = jest.fn();

const mockRunTest = jest.fn();

jest.mock('../../middleware/auth.js', () => ({
    authenticate: (req: any, _res: any, next: any) => {
        req.user = { _id: 'user123' };
        req.userId = 'user123';
        next();
    },
}));

jest.mock('../../middleware/rateLimiter.js', () => ({
    writeLimiter: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../services/aiJudge.service.js', () => {
    const mockAIJudgeInstance = {
        analyzeCode: jest.fn(),
        runCode: jest.fn(),
        generateInterviewFeedback: jest.fn(),
    };
    return {
        __mockAIJudgeInstance: mockAIJudgeInstance,
        AIJudgeService: jest.fn().mockImplementation(() => mockAIJudgeInstance),
    };
});

jest.mock('../../services/questionGeneration.service.js', () => {
    const mockQuestionGenInstance = {
        generateCuratedQuestion: jest.fn(),
        generateQuestions: jest.fn()
    };
    return {
        __mockQuestionGenInstance: mockQuestionGenInstance,
        QuestionGenerationService: jest.fn().mockImplementation(() => mockQuestionGenInstance),
    };
});
jest.mock('../../services/execution.service.js', () => ({ ExecutionService: jest.fn() }));
jest.mock('../../models/InterviewSession.js', () => ({ InterviewSession: jest.fn() }));
jest.mock('../../models/Question.js', () => ({ Question: jest.fn() }));

const app = express();
app.use(express.json());
app.use('/api/interview', interviewRoutes);

const getAIJudgeMock = () => {
    return (aiJudgeServiceModule as any).__mockAIJudgeInstance as {
        analyzeCode: jest.Mock;
        runCode: jest.Mock;
        generateInterviewFeedback: jest.Mock;
    };
};

const getQuestionGenMock = () => {
    return (questionGenerationServiceModule as any).__mockQuestionGenInstance as {
        generateCuratedQuestion: jest.Mock;
        generateQuestions: jest.Mock;
    };
};

describe('Interview Routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        (InterviewSession as unknown as jest.Mock).mockImplementation((data: any) => ({
            ...data,
            save: mockInterviewSessionSave,
            markModified: jest.fn(),
            sections: data.sections || [],
        }));
        (InterviewSession as any).findOne = mockInterviewSessionFindOne;
        (InterviewSession as any).find = mockInterviewSessionFind;

        (Question as unknown as jest.Mock).mockImplementation((data: any) => ({
            ...data,
            save: mockQuestionSave,
        }));
        (Question as any).aggregate = mockQuestionAggregate;
        (Question as any).findOne = mockQuestionFindOne;
        (Question as any).findById = mockQuestionFindById;

        (ExecutionService as unknown as jest.Mock).mockImplementation(() => ({
            runTest: mockRunTest,
        }));

        const aiJudge = getAIJudgeMock();
        const questionGen = getQuestionGenMock();

        // @ts-expect-error - jest mock
        questionGen.generateCuratedQuestion.mockResolvedValue(null);
        // @ts-expect-error - jest mock
        aiJudge.analyzeCode.mockResolvedValue({
            feedback: 'Great job',
            complexityAnalysis: 'O(n) time, O(1) space',
        });
        // @ts-expect-error - jest mock
        aiJudge.generateInterviewFeedback.mockResolvedValue('Your interview performance is good');

        // @ts-expect-error - jest mock
        mockInterviewSessionSave.mockResolvedValue(true);
        // @ts-expect-error - jest mock
        mockQuestionSave.mockResolvedValue(true);
    });

    it('should start a new interview session with sections', async () => {
        // @ts-expect-error - jest mock
        mockQuestionAggregate.mockResolvedValue([
            {
                _id: 'q1',
                title: 'Two Sum',
                difficulty: 'easy',
                description: 'Find two numbers',
                templates: { javascript: 'function twoSum(nums, target) {}' },
                testCases: [
                    { input: '[2,7,11,15]\n9', expectedOutput: '[0,1]', isHidden: false },
                    { input: '[3,2,4]\n6', expectedOutput: '[1,2]', isHidden: true },
                ],
            },
        ]);

        const res = await request(app)
            .post('/api/interview/start')
            .send({
                duration: 90,
                sectionCount: 2,
                difficulty: 'mixed',
                language: 'javascript',
                hasCameraAccess: true,
                strictMode: false,
                sectionsConfig: [
                    {
                        name: 'Warm-up',
                        type: 'warm-up',
                        duration: 10,
                        questionCount: 2,
                        difficulty: 'easy',
                        topics: ['Array', 'String'],
                        questionsConfig: [
                            { difficulty: 'easy', topics: ['Array'] },
                            { difficulty: 'easy', topics: ['String'] },
                        ],
                    },
                    {
                        name: 'Core Coding',
                        type: 'coding',
                        duration: 40,
                        questionCount: 3,
                        difficulty: 'medium',
                        topics: ['Array', 'DP', 'Tree'],
                        questionsConfig: [
                            { difficulty: 'medium', topics: ['Array'] },
                            { difficulty: 'medium', topics: ['DP'] },
                            { difficulty: 'hard', topics: ['Tree'] },
                        ],
                    },
                ],
            });

        expect(res.status).toBe(200);
        expect(InterviewSession).toHaveBeenCalledWith(expect.objectContaining({
            userId: 'user123',
            config: expect.objectContaining({
                duration: 90,
                sectionCount: 2,
                language: 'javascript',
            }),
        }));
        expect(res.body.sections).toHaveLength(2);
    });

    it('should submit code for coding question and return deterministic evaluation', async () => {
        const mockSession = {
            _id: 'session123',
            userId: 'user123',
            config: { language: 'javascript', hasCameraAccess: true, strictMode: false },
            sections: [
                {
                    id: 'section-0',
                    name: 'Warm-up',
                    type: 'warm-up',
                    duration: 10,
                    status: 'start',
                    questions: [
                        {
                            questionId: 'q1',
                            problemName: 'Two Sum',
                            description: 'desc',
                            status: 'pending',
                            type: 'coding',
                        },
                    ],
                },
            ],
            currentSectionIndex: 0,
            markModified: jest.fn(),
            save: mockInterviewSessionSave,
        };

        // @ts-expect-error - jest mock
        mockInterviewSessionFindOne.mockResolvedValue(mockSession);
        // @ts-expect-error - jest mock
        mockQuestionFindById.mockResolvedValue({
            _id: 'q1',
            testCases: [{ input: '[2,7,11,15]\n9', expectedOutput: '[0,1]', isHidden: false }],
        });
        // @ts-expect-error - jest mock
        mockRunTest.mockResolvedValue({
            passed: true,
            actual: '[0,1]',
            error: undefined,
        });

        const res = await request(app)
            .post('/api/interview/submit')
            .send({
                sessionId: 'session123',
                questionIndex: 0,
                code: 'function twoSum(nums, target) { return [0,1]; }',
            });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.status).toBe('pass');
        expect(res.body.data.score).toBe(100);
        expect(res.body.data.summary).toEqual({ passed: 1, total: 1 });

        expect(ExecutionService).toHaveBeenCalledTimes(1);
        expect(mockRunTest).toHaveBeenCalledTimes(1);
        const aiJudge = getAIJudgeMock();
        expect(aiJudge.analyzeCode).toHaveBeenCalledTimes(1);
        expect(mockInterviewSessionSave).toHaveBeenCalled();
    });

    it('should reject unsupported language at start', async () => {
        const res = await request(app)
            .post('/api/interview/start')
            .send({
                duration: 30,
                sectionCount: 1,
                difficulty: 'easy',
                language: 'invalid-lang',
                hasCameraAccess: false,
                strictMode: false,
                sectionsConfig: [
                    {
                        name: 'Basic Section',
                        type: 'coding',
                        duration: 30,
                        questionCount: 1,
                        difficulty: 'easy',
                        topics: ['Array'],
                        questionsConfig: [{ difficulty: 'easy', topics: ['Array'] }],
                    },
                ],
            });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toMatch(/Unsupported interview language/i);
    });
});
