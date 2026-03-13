import request from 'supertest';
import type { Request, Response } from 'express';
import { jest } from '@jest/globals';
import { createApp } from '../../app.js';

const refreshTokenHandlerSpy = jest.fn();

function mockedRefreshTokenHandler(_req: Request, res: Response) {
    refreshTokenHandlerSpy();
    res.json({ success: true, route: 'refresh' });
}

jest.mock('../../routes/auth.js', () => {
    const express = jest.requireActual('express') as typeof import('express');
    const router = express.Router();
    router.get('/me', (_req: Request, res: Response) => {
        res.json({ success: true, route: 'auth-me' });
    });

    return {
        __esModule: true,
        default: router,
        refreshTokenHandler: mockedRefreshTokenHandler,
    };
});

function buildEmptyRouterModule() {
    const express = jest.requireActual('express') as typeof import('express');
    return {
        __esModule: true,
        default: express.Router(),
    };
}

jest.mock('../../routes/dailyLogs.js', buildEmptyRouterModule);
jest.mock('../../routes/dashboard.js', buildEmptyRouterModule);
jest.mock('../../routes/dsaProblems.js', buildEmptyRouterModule);
jest.mock('../../routes/backendTopics.js', buildEmptyRouterModule);
jest.mock('../../routes/projectStudies.js', buildEmptyRouterModule);
jest.mock('../../routes/ai.js', buildEmptyRouterModule);
jest.mock('../../routes/roadmap.js', buildEmptyRouterModule);
jest.mock('../../routes/interview.js', buildEmptyRouterModule);
jest.mock('../../routes/chat.js', buildEmptyRouterModule);
jest.mock('../../routes/activityRoutes.js', () => {
    const express = jest.requireActual('express') as typeof import('express');
    return {
        __esModule: true,
        activityRoutes: express.Router(),
    };
});

describe('App Routing Integration', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('mounts refresh only on the exact POST /api/auth/refresh path', async () => {
        const app = createApp({
            NODE_ENV: 'test',
            PORT: '5000',
            FRONTEND_URL: 'http://localhost:5173',
            MONGODB_URI: 'mongodb://localhost:27017/test-db',
            JWT_SECRET: 'test-secret-key-for-jwt-signing-32chars',
            JWT_EXPIRES_IN: '7d',
            ENCRYPTION_KEY: '12345678901234567890123456789012',
        });

        const refreshResponse = await request(app).post('/api/auth/refresh');
        const meResponse = await request(app).get('/api/auth/me');
        const duplicateResponse = await request(app).get('/api/auth/refresh/me');

        expect(refreshResponse.status).toBe(200);
        expect(refreshResponse.body.route).toBe('refresh');
        expect(meResponse.status).toBe(200);
        expect(meResponse.body.route).toBe('auth-me');
        expect(duplicateResponse.status).toBe(404);
        expect(refreshTokenHandlerSpy).toHaveBeenCalledTimes(1);
    });
});
