import express from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { RoadmapNode } from '../models/RoadmapNode.js';
import { RoadmapEdge } from '../models/RoadmapEdge.js';

const router = express.Router();

const ROADMAP_STATUSES = ['todo', 'in-progress', 'done'] as const;
const ROADMAP_CATEGORIES = ['general', 'dsa', 'backend', 'database', 'frontend', 'devops', 'system', 'security', 'api', 'language', 'tools', 'terminal'] as const;
const ROADMAP_PRIORITIES = ['low', 'medium', 'high'] as const;

const roadmapSyncSchema = z.object({
    nodes: z.array(z.object({
        id: z.string().optional(),
        nodeId: z.string().optional(),
        roadmapId: z.string().optional(),
        type: z.string().optional(),
        data: z.object({
            label: z.string().min(1).max(200).optional(),
            status: z.enum(ROADMAP_STATUSES).optional(),
            description: z.string().max(5000).optional(),
            category: z.enum(ROADMAP_CATEGORIES).optional(),
            priority: z.enum(ROADMAP_PRIORITIES).optional(),
            estimatedHours: z.number().min(0).max(10000).optional(),
            resourceUrl: z.string().max(2000).optional()
        }).optional(),
        position: z.object({
            x: z.number().finite(),
            y: z.number().finite()
        }).optional()
    }).passthrough()).max(500),
    edges: z.array(z.object({
        id: z.string().optional(),
        edgeId: z.string().optional(),
        roadmapId: z.string().optional(),
        source: z.string().min(1).max(200),
        target: z.string().min(1).max(200)
    }).passthrough()).max(2000)
}).strict();

const patchNodeSchema = z.object({
    status: z.enum(ROADMAP_STATUSES).optional(),
    label: z.string().min(1).max(200).optional(),
    description: z.string().max(5000).optional(),
    category: z.enum(ROADMAP_CATEGORIES).optional(),
    priority: z.enum(ROADMAP_PRIORITIES).optional(),
    estimatedHours: z.number().min(0).max(10000).optional(),
    resourceUrl: z.string().max(2000).optional()
}).strict().refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required.'
});

// GET /api/roadmap
// Fetch all nodes and edges for the user
router.get('/', authenticate, async (req, res) => {
    try {
        const [nodes, edges] = await Promise.all([
            RoadmapNode.find({ userId: req.userId }).sort({ createdAt: 1 }),
            RoadmapEdge.find({ userId: req.userId })
        ]);
        res.json({ success: true, data: { nodes, edges } });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/roadmap/sync
// Batch update/save nodes and edges
router.post('/sync', authenticate, async (req, res) => {
    try {
        const parsed = roadmapSyncSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                success: false,
                error: parsed.error.errors[0].message
            });
        }

        const { nodes, edges } = parsed.data;

        // Clear and re-insert for the user
        await Promise.all([
            RoadmapNode.deleteMany({ userId: req.userId }),
            RoadmapEdge.deleteMany({ userId: req.userId })
        ]);

        // Map nodes with all new fields
        const typedNodes = nodes.map((n: any) => ({
            userId: req.userId,
            roadmapId: n.roadmapId || 'default',
            nodeId: n.nodeId || n.id,
            type: n.type || 'roadmap',
            data: {
                label: n.data?.label || 'Unnamed',
                status: n.data?.status || 'todo',
                description: n.data?.description || '',
                category: n.data?.category || 'general',
                priority: n.data?.priority || 'medium',
                estimatedHours: n.data?.estimatedHours || 0,
                resourceUrl: n.data?.resourceUrl || ''
            },
            position: n.position || { x: 0, y: 0 }
        }));

        const typedEdges = edges.map((e: any) => ({
            userId: req.userId,
            roadmapId: e.roadmapId || 'default',
            edgeId: e.edgeId || e.id,
            source: e.source,
            target: e.target
        }));

        if (typedNodes.length > 0) {
            await RoadmapNode.insertMany(typedNodes);
        }
        if (typedEdges.length > 0) {
            await RoadmapEdge.insertMany(typedEdges);
        }

        res.json({ success: true, message: 'Roadmap synced successfully' });
    } catch (error: any) {
        console.error('Roadmap sync error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// PATCH /api/roadmap/node/:nodeId
// Update single node (supports all fields)
router.patch('/node/:nodeId', authenticate, async (req, res) => {
    try {
        const parsed = patchNodeSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                success: false,
                error: parsed.error.errors[0].message
            });
        }

        const { status, label, description, category, priority, estimatedHours, resourceUrl } = parsed.data;

        const updateFields: Record<string, any> = {};
        if (status !== undefined) updateFields['data.status'] = status;
        if (label !== undefined) updateFields['data.label'] = label;
        if (description !== undefined) updateFields['data.description'] = description;
        if (category !== undefined) updateFields['data.category'] = category;
        if (priority !== undefined) updateFields['data.priority'] = priority;
        if (estimatedHours !== undefined) updateFields['data.estimatedHours'] = estimatedHours;
        if (resourceUrl !== undefined) updateFields['data.resourceUrl'] = resourceUrl;

        const node = await RoadmapNode.findOneAndUpdate(
            { userId: req.userId, nodeId: req.params.nodeId },
            { $set: updateFields },
            { new: true }
        );

        if (!node) {
            return res.status(404).json({ success: false, error: 'Node not found' });
        }

        res.json({ success: true, data: node });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/roadmap/stats
// Get roadmap statistics
router.get('/stats', authenticate, async (req, res) => {
    try {
        const nodes = await RoadmapNode.find({ userId: req.userId });

        const stats = {
            total: nodes.length,
            done: nodes.filter(n => n.data.status === 'done').length,
            inProgress: nodes.filter(n => n.data.status === 'in-progress').length,
            todo: nodes.filter(n => n.data.status === 'todo').length,
            totalHours: nodes.reduce((sum, n) => sum + (n.data.estimatedHours || 0), 0),
            completedHours: nodes.filter(n => n.data.status === 'done').reduce((sum, n) => sum + (n.data.estimatedHours || 0), 0),
            byCategory: {} as Record<string, number>,
            byPriority: { high: 0, medium: 0, low: 0 }
        };

        nodes.forEach(n => {
            const cat = n.data.category || 'general';
            stats.byCategory[cat] = (stats.byCategory[cat] || 0) + 1;

            const pri = n.data.priority || 'medium';
            if (pri in stats.byPriority) {
                stats.byPriority[pri as keyof typeof stats.byPriority]++;
            }
        });

        res.json({ success: true, data: stats });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
