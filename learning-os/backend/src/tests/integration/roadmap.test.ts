import request from 'supertest';
import express from 'express';
import { jest } from '@jest/globals';
import { RoadmapNode } from '../../models/RoadmapNode';
import { RoadmapEdge } from '../../models/RoadmapEdge';
import roadmapRoutes from '../../routes/roadmap';

const app = express();
app.use(express.json());
// Mock auth middleware usually, but for integration test we might mock logic
// Here we'll just mock the auth middleware to pass through a fake user
app.use((req: any, res, next) => {
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

app.use('/api/roadmap', roadmapRoutes);

// Mock Models
jest.mock('../../models/RoadmapNode', () => ({
    RoadmapNode: {
        find: jest.fn(),
        deleteMany: jest.fn(),
        insertMany: jest.fn(),
        findOneAndUpdate: jest.fn(),
    }
}));

jest.mock('../../models/RoadmapEdge', () => ({
    RoadmapEdge: {
        find: jest.fn(),
        deleteMany: jest.fn(),
        insertMany: jest.fn(),
    }
}));

describe('Roadmap Routes Integration', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /api/roadmap', () => {
        it('should return nodes and edges for the user', async () => {
            const mockNodes = [{ nodeId: 'n1', data: { label: 'Node 1' } }];
            const mockEdges = [{ edgeId: 'e1', source: 'n1', target: 'n2' }];

            // Mock sort chain: sort() is called after find()
            const mockFind = jest.fn().mockReturnValue({
                sort: jest.fn().mockResolvedValue(mockNodes as never)
            });

            // We need to type cast properly for mocking behavior especially with mongoose chaining
            (RoadmapNode.find as jest.Mock).mockImplementation(mockFind as never);
            (RoadmapEdge.find as jest.Mock).mockResolvedValue(mockEdges as never);

            const res = await request(app).get('/api/roadmap');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.nodes).toHaveLength(1);
            expect(res.body.data.edges).toHaveLength(1);
        });
    });

    describe('POST /api/roadmap/sync', () => {
        it('should save nodes and edges', async () => {
            const nodes = [{ id: 'n1', data: { label: 'New Node' } }];
            const edges = [{ id: 'e1', source: 'n1', target: 'n2' }];

            (RoadmapNode.deleteMany as jest.Mock).mockResolvedValue({ deletedCount: 5 } as never);
            (RoadmapEdge.deleteMany as jest.Mock).mockResolvedValue({ deletedCount: 5 } as never);
            (RoadmapNode.insertMany as jest.Mock).mockResolvedValue(nodes as never);
            (RoadmapEdge.insertMany as jest.Mock).mockResolvedValue(edges as never);

            const res = await request(app)
                .post('/api/roadmap/sync')
                .send({ nodes, edges });

            expect(res.status).toBe(200);
            expect(res.body.message).toMatch(/synced successfully/i);
            expect(RoadmapNode.deleteMany).toHaveBeenCalled();
            expect(RoadmapNode.insertMany).toHaveBeenCalled();
        });
    });

    describe('PATCH /api/roadmap/node/:nodeId', () => {
        it('should update a node status', async () => {
            // Fix: ensure the mocked response matches the expected structure
            // Controller returns `node`, so result structure depends on how it's sent back
            // Router: res.json({ success: true, data: node });

            const mockUpdate = { nodeId: 'n1', data: { status: 'done', label: 'Node 1' } };
            (RoadmapNode.findOneAndUpdate as jest.Mock).mockResolvedValue(mockUpdate as never);

            const res = await request(app)
                .patch('/api/roadmap/node/n1')
                .send({ status: 'done' });

            expect(res.status).toBe(200);
            // Check nested structure matches the router response
            expect(res.body.data.data.status).toBe('done');

            expect(RoadmapNode.findOneAndUpdate).toHaveBeenCalledWith(
                expect.objectContaining({ nodeId: 'n1' }),
                expect.any(Object),
                expect.any(Object)
            );
        });
    });
});
