import request from 'supertest';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { jest } from '@jest/globals';
import projectStudyRoutes from '../../routes/projectStudies.js';
import { ProjectStudy } from '../../models/ProjectStudy.js';
import { knowledgeSync } from '../../services/knowledgeSync.service.js';

jest.mock('../../models/ProjectStudy.js', () => ({
    ProjectStudy: {
        create: jest.fn(),
        findOneAndUpdate: jest.fn(),
        findOneAndDelete: jest.fn(),
        find: jest.fn(),
        countDocuments: jest.fn(),
        findOne: jest.fn(),
    }
}));

jest.mock('../../middleware/auth.js', () => ({
    authenticate: (req: Request & { userId?: string }, _res: Response, next: NextFunction) => {
        req.userId = 'user123';
        next();
    }
}));

jest.mock('../../middleware/rateLimiter.js', () => ({
    writeLimiter: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

jest.mock('../../services/knowledgeSync.service.js', () => ({
    knowledgeSync: {
        syncProjectStudy: jest.fn().mockResolvedValue(undefined),
        deleteFromVector: jest.fn().mockResolvedValue(undefined),
    }
}));

const app = express();
app.use(express.json());
app.use('/api/project-studies', projectStudyRoutes);

describe('Project Study Routes Integration', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('rejects invalid GitHub URLs', async () => {
        const response = await request(app)
            .post('/api/project-studies')
            .send({
                projectName: 'Test Project',
                repoUrl: 'not-a-github-url.com',
                moduleStudied: 'Auth',
                flowUnderstanding: 'Test flow',
                date: '2024-02-24'
            });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('valid GitHub URL');
    });

    it('creates a project study and triggers knowledge sync', async () => {
        (ProjectStudy.create as jest.Mock).mockResolvedValue({
            _id: 'study123',
            projectName: 'Test Project',
            user: 'user123'
        });

        const response = await request(app)
            .post('/api/project-studies')
            .send({
                projectName: 'Test Project',
                repoUrl: 'https://github.com/user/repo',
                moduleStudied: 'Auth',
                flowUnderstanding: 'Test flow',
                date: '2024-02-24'
            });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(ProjectStudy.create).toHaveBeenCalledWith(expect.objectContaining({
            user: 'user123',
            repoUrl: 'https://github.com/user/repo'
        }));
        expect(knowledgeSync.syncProjectStudy).toHaveBeenCalledWith(expect.objectContaining({
            _id: 'study123'
        }));
    });

    it('updates an existing study with the current route contract', async () => {
        (ProjectStudy.findOneAndUpdate as jest.Mock).mockResolvedValue({
            _id: 'study123',
            projectName: 'Updated Project',
            coreComponents: 'Table A, Table B'
        });

        const response = await request(app)
            .put('/api/project-studies/study123')
            .send({
                projectName: 'Updated Project',
                coreComponents: 'Table A, Table B'
            });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(ProjectStudy.findOneAndUpdate).toHaveBeenCalledWith(
            { _id: 'study123', user: 'user123' },
            { $set: { projectName: 'Updated Project', coreComponents: 'Table A, Table B' } },
            { new: true, runValidators: true }
        );
        expect(knowledgeSync.syncProjectStudy).toHaveBeenCalledWith(expect.objectContaining({
            _id: 'study123'
        }));
    });
});
