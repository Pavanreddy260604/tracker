import request from 'supertest';
import express from 'express';
import { jest } from '@jest/globals';
import { ProjectStudy } from '../../models/ProjectStudy';
import projectStudyRoutes from '../../routes/projectStudies';

const app = express();
app.use(express.json());
app.use('/api/project-studies', projectStudyRoutes);

// Mock the ProjectStudy model
jest.mock('../../models/ProjectStudy', () => ({
    ProjectStudy: {
        find: jest.fn(),
        findOne: jest.fn(),
        findOneAndUpdate: jest.fn(),
        create: jest.fn(),
    }
}));

// Mock authentication middleware
jest.mock('../../middleware/auth', () => ({
    auth: (req: any, res: any, next: any) => {
        req.user = { id: 'user123' };
        next();
    }
}));

describe('Project Study Routes Integration', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /api/project-studies', () => {
        it('should fail with invalid GitHub URL', async () => {
            const res = await request(app)
                .post('/api/project-studies')
                .send({
                    projectName: 'Test Project',
                    repoUrl: 'not-a-github-url.com',
                    moduleStudied: 'Auth',
                    flowUnderstanding: 'Test flow',
                    date: '2024-02-24'
                });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('valid GitHub URL');
        });

        it('should succeed with valid GitHub URL', async () => {
            // @ts-expect-error - jest mock
            (ProjectStudy.create as jest.Mock).mockResolvedValue({
                _id: 'study123',
                projectName: 'Test Project'
            });

            const res = await request(app)
                .post('/api/project-studies')
                .send({
                    projectName: 'Test Project',
                    repoUrl: 'https://github.com/user/repo',
                    moduleStudied: 'Auth',
                    flowUnderstanding: 'Test flow',
                    date: '2024-02-24'
                });

            expect(res.status).toBe(201);
        });
    });

    describe('PUT /api/project-studies/:id', () => {
        it('should update and refresh updatedAt via pre-hook logic (simulated)', async () => {
            const mockUpdate = {
                projectName: 'Updated Project',
                coreComponents: 'Table A, Table B'
            };

            // @ts-expect-error - jest mock
            (ProjectStudy.findOneAndUpdate as jest.Mock).mockResolvedValue({
                _id: 'study123',
                ...mockUpdate,
                updatedAt: new Date()
            });

            const res = await request(app)
                .put('/api/project-studies/study123')
                .send(mockUpdate);

            expect(res.status).toBe(200);
            expect(ProjectStudy.findOneAndUpdate).toHaveBeenCalled();
        });
    });
});
