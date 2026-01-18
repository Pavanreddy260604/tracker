import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { DSAProblem } from '../models/DSAProblem.js';
import { authenticate } from '../middleware/auth.js';
import { writeLimiter } from '../middleware/rateLimiter.js';

const router = Router();
router.use(authenticate);

// Validation schema
const dsaProblemSchema = z.object({
    problemName: z.string().min(1).max(200),
    platform: z.enum(['leetcode', 'gfg', 'codeforces', 'codechef', 'hackerrank', 'other']).default('leetcode'),
    topic: z.string().min(1).max(100),
    difficulty: z.enum(['easy', 'medium', 'hard']),
    timeSpent: z.number().min(0).max(1440).default(0),
    status: z.enum(['solved', 'revisit', 'attempted']).default('solved'),
    patternLearned: z.string().max(500).default(''),
    mistakes: z.string().max(1000).default(''),
    solutionLink: z.string().max(500).default(''),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    // DSA 2.0 Fields
    nextReviewDate: z.string().optional(), // ISODate string
    reviewStage: z.number().optional(),
    reviewInterval: z.number().optional(),
    easeFactor: z.number().optional(),
    solutionCode: z.string().optional(),
    timeComplexity: z.string().max(50).optional(),
    spaceComplexity: z.string().max(50).optional(),
    companyTags: z.array(z.string()).optional(),
});

/**
 * GET /api/dsa-problems
 */
router.get('/', async (req: Request, res: Response) => {
    try {
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const requestedLimit = parseInt(req.query.limit as string) || 20;
        const limit = Math.min(Math.max(1, requestedLimit), 100); // Cap at 100 max
        const topic = req.query.topic as string;
        const difficulty = req.query.difficulty as string;

        const filter: Record<string, unknown> = { userId: req.userId };
        if (topic) filter.topic = topic;
        if (difficulty) filter.difficulty = difficulty;

        const [problems, total] = await Promise.all([
            DSAProblem.find(filter)
                .sort({ date: -1, createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            DSAProblem.countDocuments(filter),
        ]);

        res.json({
            success: true,
            data: {
                problems,
                pagination: { page, limit, total, pages: Math.ceil(total / limit) },
            },
        });
    } catch (error) {
        console.error('Get problems error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch problems' });
    }
});

/**
 * POST /api/dsa-problems
 */
router.post('/', writeLimiter, async (req: Request, res: Response) => {
    try {
        const result = dsaProblemSchema.safeParse(req.body);
        if (!result.success) {
            res.status(400).json({ success: false, error: result.error.errors[0].message });
            return;
        }

        const problem = await DSAProblem.create({
            ...result.data,
            userId: req.userId,
        });

        res.status(201).json({ success: true, data: { problem } });
    } catch (error) {
        console.error('Create problem error:', error);
        res.status(500).json({ success: false, error: 'Failed to create problem' });
    }
});

/**
 * GET /api/dsa-problems/:id
 */
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const problem = await DSAProblem.findOne({
            _id: req.params.id,
            userId: req.userId,
        }).lean();

        if (!problem) {
            res.status(404).json({ success: false, error: 'Problem not found' });
            return;
        }

        res.json({ success: true, data: { problem } });
    } catch (error) {
        console.error('Get problem error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch problem' });
    }
});

/**
 * PUT /api/dsa-problems/:id
 */
router.put('/:id', writeLimiter, async (req: Request, res: Response) => {
    try {
        const result = dsaProblemSchema.partial().safeParse(req.body);
        if (!result.success) {
            res.status(400).json({ success: false, error: result.error.errors[0].message });
            return;
        }

        const problem = await DSAProblem.findOneAndUpdate(
            { _id: req.params.id, userId: req.userId },
            { $set: result.data },
            { new: true, runValidators: true }
        );

        if (!problem) {
            res.status(404).json({ success: false, error: 'Problem not found' });
            return;
        }

        res.json({ success: true, data: { problem } });
    } catch (error) {
        console.error('Update problem error:', error);
        res.status(500).json({ success: false, error: 'Failed to update problem' });
    }
});

/**
 * DELETE /api/dsa-problems/:id
 */
router.delete('/:id', writeLimiter, async (req: Request, res: Response) => {
    try {
        const problem = await DSAProblem.findOneAndDelete({
            _id: req.params.id,
            userId: req.userId,
        });

        if (!problem) {
            res.status(404).json({ success: false, error: 'Problem not found' });
            return;
        }

        res.json({ success: true, data: { message: 'Problem deleted' } });
    } catch (error) {
        console.error('Delete problem error:', error);
        res.status(500).json({ success: false, error: 'Failed to delete problem' });
    }
});

export default router;
