import request from 'supertest';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import { jest } from '@jest/globals';
import authRoutes, { refreshTokenHandler } from '../../routes/auth.js';
import { User } from '../../models/User.js';
import { RefreshToken } from '../../models/RefreshToken.js';
import { DailyLog } from '../../models/DailyLog.js';
import { DSAProblem } from '../../models/DSAProblem.js';
import { BackendTopic } from '../../models/BackendTopic.js';
import { ProjectStudy } from '../../models/ProjectStudy.js';
import { ChatSession } from '../../models/ChatSession.js';
import { InterviewSession } from '../../models/InterviewSession.js';
import { PasswordReset } from '../../models/PasswordReset.js';
import { RoadmapNode } from '../../models/RoadmapNode.js';
import { RoadmapEdge } from '../../models/RoadmapEdge.js';
import { UserActivity } from '../../models/UserActivity.js';
import { Subscription } from '../../models/Subscription.js';
import { emailService } from '../../services/email.service.js';

jest.mock('../../models/User.js', () => ({
    User: Object.assign(jest.fn(), {
        findOne: jest.fn(),
        findById: jest.fn(),
        findByIdAndUpdate: jest.fn(),
        findByIdAndDelete: jest.fn(),
    }),
}));

jest.mock('../../models/RefreshToken.js', () => ({
    RefreshToken: {
        create: jest.fn(),
        findOne: jest.fn(),
        deleteOne: jest.fn(),
        deleteMany: jest.fn(),
    },
}));

jest.mock('../../models/DailyLog.js', () => ({ DailyLog: { deleteMany: jest.fn() } }));
jest.mock('../../models/DSAProblem.js', () => ({ DSAProblem: { deleteMany: jest.fn() } }));
jest.mock('../../models/BackendTopic.js', () => ({ BackendTopic: { deleteMany: jest.fn() } }));
jest.mock('../../models/ProjectStudy.js', () => ({ ProjectStudy: { deleteMany: jest.fn() } }));
jest.mock('../../models/ChatSession.js', () => ({ ChatSession: { deleteMany: jest.fn() } }));
jest.mock('../../models/InterviewSession.js', () => ({ InterviewSession: { deleteMany: jest.fn() } }));
jest.mock('../../models/PasswordReset.js', () => ({ PasswordReset: { deleteMany: jest.fn(), create: jest.fn(), findOne: jest.fn() } }));
jest.mock('../../models/RoadmapNode.js', () => ({ RoadmapNode: { deleteMany: jest.fn() } }));
jest.mock('../../models/RoadmapEdge.js', () => ({ RoadmapEdge: { deleteMany: jest.fn() } }));
jest.mock('../../models/UserActivity.js', () => ({ UserActivity: { deleteMany: jest.fn() } }));
jest.mock('../../models/Subscription.js', () => ({ Subscription: { deleteMany: jest.fn() } }));

jest.mock('../../middleware/auth.js', () => ({
    authenticate: (req: Request & { userId?: string; user?: { toJSON: () => Record<string, unknown> } }, _res: Response, next: NextFunction) => {
        req.userId = 'user123';
        req.user = {
            toJSON: () => ({ _id: 'user123', email: 'test@example.com' })
        };
        next();
    }
}));

jest.mock('../../middleware/rateLimiter.js', () => ({
    authLimiter: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

jest.mock('../../middleware/csrf.js', () => ({
    generateCsrfToken: jest.fn().mockReturnValue('csrf-token'),
}));

jest.mock('../../utils/jwt.js', () => ({
    generateToken: jest.fn().mockReturnValue('mock-access-token'),
    generateRefreshToken: jest.fn().mockReturnValue('mock-refresh-token'),
    hashToken: jest.fn((token: string) => `hashed-${token}`),
}));

jest.mock('../../services/email.service.js', () => ({
    emailService: {
        sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
        sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
    }
}));

const app = express();
app.use(cookieParser());
app.use(express.json());
app.post('/api/auth/refresh', refreshTokenHandler);
app.use('/api/auth', authRoutes);

describe('Auth Routes Integration', () => {
    const mockSave = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();

        mockSave.mockResolvedValue(undefined);

        (User as unknown as jest.Mock).mockImplementation((data: Record<string, unknown>) => ({
            ...data,
            _id: 'user123',
            save: mockSave,
            comparePassword: jest.fn().mockResolvedValue(true),
            toJSON: () => ({
                _id: 'user123',
                name: data.name || 'Test User',
                email: data.email || 'test@example.com'
            })
        }));
    });

    it('registers a new user and issues tokens', async () => {
        (User.findOne as jest.Mock).mockResolvedValue(null);
        (RefreshToken.create as jest.Mock).mockResolvedValue({ _id: 'refresh123' });

        const response = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'Test User',
                email: 'test@example.com',
                password: 'Password123'
            });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.token).toBe('mock-access-token');
        expect(User).toHaveBeenCalledWith(expect.objectContaining({
            email: 'test@example.com',
            passwordHash: 'Password123'
        }));
        expect(RefreshToken.create).toHaveBeenCalledWith(expect.objectContaining({
            userId: 'user123',
            token: 'hashed-mock-refresh-token'
        }));
        expect(emailService.sendVerificationEmail).toHaveBeenCalledWith('test@example.com', expect.any(String));
    });

    it('rejects login with an invalid password', async () => {
        (User.findOne as jest.Mock).mockResolvedValue({
            _id: 'user123',
            email: 'test@example.com',
            comparePassword: jest.fn().mockResolvedValue(false),
            toJSON: () => ({ _id: 'user123', email: 'test@example.com' })
        });

        const response = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'test@example.com',
                password: 'WrongPassword123'
            });

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toMatch(/invalid email or password/i);
    });

    it('returns 401 when refresh is called without a cookie', async () => {
        const response = await request(app).post('/api/auth/refresh');

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toMatch(/no refresh token/i);
    });

    it('deletes the full user footprint on account deletion', async () => {
        (User.findByIdAndDelete as jest.Mock).mockResolvedValue({ _id: 'user123' });
        const deleteMocks = [
            DailyLog.deleteMany,
            DSAProblem.deleteMany,
            BackendTopic.deleteMany,
            ProjectStudy.deleteMany,
            ChatSession.deleteMany,
            InterviewSession.deleteMany,
            RefreshToken.deleteMany,
            PasswordReset.deleteMany,
            RoadmapNode.deleteMany,
            RoadmapEdge.deleteMany,
            UserActivity.deleteMany,
            Subscription.deleteMany,
        ] as Array<jest.Mock>;

        deleteMocks.forEach((mock) => mock.mockResolvedValue({ acknowledged: true }));

        const response = await request(app).delete('/api/auth/account');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(User.findByIdAndDelete).toHaveBeenCalledWith('user123');
        expect(ProjectStudy.deleteMany).toHaveBeenCalledWith({ userId: 'user123' });
        expect(ChatSession.deleteMany).toHaveBeenCalledWith({ userId: 'user123' });
        expect(InterviewSession.deleteMany).toHaveBeenCalledWith({ userId: 'user123' });
        expect(RefreshToken.deleteMany).toHaveBeenCalledWith({ userId: 'user123' });
        expect(PasswordReset.deleteMany).toHaveBeenCalledWith({ userId: 'user123' });
        expect(RoadmapNode.deleteMany).toHaveBeenCalledWith({ userId: 'user123' });
        expect(RoadmapEdge.deleteMany).toHaveBeenCalledWith({ userId: 'user123' });
        expect(UserActivity.deleteMany).toHaveBeenCalledWith({ userId: 'user123' });
        expect(Subscription.deleteMany).toHaveBeenCalledWith({ userId: 'user123' });
        expect(response.headers['set-cookie']).toEqual(expect.arrayContaining([expect.stringContaining('refreshToken=;')]));
    });
});
