import request from 'supertest';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { jest } from '@jest/globals';
import roadmapRoutes from '../../routes/roadmap.js';
import { RoadmapNode } from '../../models/RoadmapNode.js';
import { RoadmapEdge } from '../../models/RoadmapEdge.js';

jest.mock('../../middleware/auth.js', () => ({
    authenticate: (req: Request & { userId?: string }, _res: Response, next: NextFunction) => {
        req.userId = '507f1f77bcf86cd799439011';
        next();
    }
}));

jest.mock('../../models/RoadmapNode.js', () => ({
    RoadmapNode: {
        find: jest.fn(),
        bulkWrite: jest.fn(),
        deleteMany: jest.fn(),
        findOneAndUpdate: jest.fn(),
    }
}));

jest.mock('../../models/RoadmapEdge.js', () => ({
    RoadmapEdge: {
        find: jest.fn(),
        bulkWrite: jest.fn(),
        deleteMany: jest.fn(),
    }
}));

const app = express();
app.use(express.json());
app.use('/api/roadmap', roadmapRoutes);

describe('Roadmap Routes Integration', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns nodes and edges for the authenticated user', async () => {
        (RoadmapNode.find as jest.Mock).mockReturnValue({
            sort: jest.fn().mockResolvedValue([{ nodeId: 'n1', data: { label: 'Node 1' } }])
        });
        (RoadmapEdge.find as jest.Mock).mockResolvedValue([{ edgeId: 'e1', source: 'n1', target: 'n2' }]);

        const response = await request(app).get('/api/roadmap');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.nodes).toHaveLength(1);
        expect(response.body.data.edges).toHaveLength(1);
    });

    it('syncs roadmap data with upserts before stale deletion', async () => {
        (RoadmapNode.bulkWrite as jest.Mock).mockResolvedValue({ acknowledged: true });
        (RoadmapEdge.bulkWrite as jest.Mock).mockResolvedValue({ acknowledged: true });
        (RoadmapNode.deleteMany as jest.Mock).mockResolvedValue({ deletedCount: 1 });
        (RoadmapEdge.deleteMany as jest.Mock).mockResolvedValue({ deletedCount: 1 });

        const response = await request(app)
            .post('/api/roadmap/sync')
            .send({
                nodes: [{ id: 'n1', data: { label: 'New Node' } }],
                edges: [{ id: 'e1', source: 'n1', target: 'n2' }]
            });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(RoadmapNode.bulkWrite).toHaveBeenCalledWith([
            {
                updateOne: {
                    filter: expect.objectContaining({ roadmapId: 'default', nodeId: 'n1' }),
                    update: {
                        $set: expect.objectContaining({
                            roadmapId: 'default',
                            nodeId: 'n1',
                            data: expect.objectContaining({ label: 'New Node' })
                        })
                    },
                    upsert: true
                }
            }
        ]);
        expect(RoadmapNode.deleteMany).toHaveBeenCalledWith(expect.objectContaining({
            $nor: [{ roadmapId: 'default', nodeId: 'n1' }]
        }));
        expect(RoadmapEdge.deleteMany).toHaveBeenCalledWith(expect.objectContaining({
            $nor: [{ roadmapId: 'default', edgeId: 'e1' }]
        }));
    });

    it('does not delete existing roadmap data when node upserts fail', async () => {
        (RoadmapNode.bulkWrite as jest.Mock).mockRejectedValue(new Error('bulk write failed'));

        const response = await request(app)
            .post('/api/roadmap/sync')
            .send({
                nodes: [{ id: 'n1', data: { label: 'New Node' } }],
                edges: [{ id: 'e1', source: 'n1', target: 'n2' }]
            });

        expect(response.status).toBe(500);
        expect(response.body.success).toBe(false);
        expect(RoadmapNode.deleteMany).not.toHaveBeenCalled();
        expect(RoadmapEdge.deleteMany).not.toHaveBeenCalled();
    });

    it('updates a single roadmap node', async () => {
        (RoadmapNode.findOneAndUpdate as jest.Mock).mockResolvedValue({
            nodeId: 'n1',
            data: { status: 'done', label: 'Node 1' }
        });

        const response = await request(app)
            .patch('/api/roadmap/node/n1')
            .send({ status: 'done' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.data.status).toBe('done');
        expect(RoadmapNode.findOneAndUpdate).toHaveBeenCalledWith(
            { userId: '507f1f77bcf86cd799439011', nodeId: 'n1' },
            { $set: { 'data.status': 'done' } },
            { new: true }
        );
    });
});
