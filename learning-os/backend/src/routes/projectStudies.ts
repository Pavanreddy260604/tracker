import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ProjectStudy } from '../models/ProjectStudy.js';
import { authenticate } from '../middleware/auth.js';
import { writeLimiter } from '../middleware/rateLimiter.js';

const router = Router();
router.use(authenticate);

const projectStudySchema = z.object({
    projectName: z.string().min(1).max(200),
    repoUrl: z.string().max(500).default(''),
    moduleStudied: z.string().min(1).max(200),
    flowUnderstood: z.boolean().default(false), // Optional boolean flag
    flowUnderstanding: z.string().default(''), // The detailed explanation
    involvedTables: z.string().default(''),
    questions: z.string().max(3000).default(''),
    notes: z.string().max(5000).default(''),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    // 2.0 Fields
    architectureDiagram: z.string().default(''),
    keyTakeaways: z.array(z.string()).default([]),
    tasks: z.array(z.object({
        id: z.string(),
        text: z.string(),
        status: z.enum(['todo', 'in-progress', 'done'])
    })).default([]),
});

router.get('/', async (req: Request, res: Response) => {
    try {
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const requestedLimit = parseInt(req.query.limit as string) || 20;
        const limit = Math.min(Math.max(1, requestedLimit), 100); // Cap at 100 max
        const projectName = req.query.project as string;

        const filter: Record<string, unknown> = { user: req.userId };
        if (projectName) filter.projectName = projectName;

        const [studies, total] = await Promise.all([
            ProjectStudy.find(filter)
                .sort({ date: -1, createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            ProjectStudy.countDocuments(filter),
        ]);

        res.json({
            success: true,
            data: { studies, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
        });
    } catch (error) {
        console.error('Get studies error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch studies' });
    }
});

router.post('/', writeLimiter, async (req: Request, res: Response) => {
    try {
        const result = projectStudySchema.safeParse(req.body);
        if (!result.success) {
            res.status(400).json({ success: false, error: result.error.errors[0].message });
            return;
        }

        const study = await ProjectStudy.create({ ...result.data, user: req.userId });
        res.status(201).json({ success: true, data: { study } });
    } catch (error) {
        console.error('Create study error:', error);
        res.status(500).json({ success: false, error: 'Failed to create study' });
    }
});

router.put('/:id', writeLimiter, async (req: Request, res: Response) => {
    try {
        const result = projectStudySchema.partial().safeParse(req.body);
        if (!result.success) {
            res.status(400).json({ success: false, error: result.error.errors[0].message });
            return;
        }

        const study = await ProjectStudy.findOneAndUpdate(
            { _id: req.params.id, user: req.userId },
            { $set: result.data },
            { new: true, runValidators: true }
        );

        if (!study) {
            res.status(404).json({ success: false, error: 'Study not found' });
            return;
        }

        res.json({ success: true, data: { study } });
    } catch (error) {
        console.error('Update study error:', error);
        res.status(500).json({ success: false, error: 'Failed to update study' });
    }
});

router.delete('/:id', writeLimiter, async (req: Request, res: Response) => {
    try {
        const study = await ProjectStudy.findOneAndDelete({ _id: req.params.id, user: req.userId });
        if (!study) {
            res.status(404).json({ success: false, error: 'Study not found' });
            return;
        }
        res.json({ success: true, data: { message: 'Study deleted' } });
    } catch (error) {
        console.error('Delete study error:', error);
        res.status(500).json({ success: false, error: 'Failed to delete study' });
    }
});

export default router;
