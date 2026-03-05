import express from 'express';
import { z } from 'zod';
import { UserActivity } from '../models/UserActivity.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

const activityCreateSchema = z.object({
    type: z.enum(['navigation', 'click', 'edit', 'create', 'delete', 'search', 'command']),
    description: z.string().trim().min(1).max(500),
    metadata: z.object({
        path: z.string().max(500).optional(),
        component: z.string().max(200).optional(),
        targetId: z.string().max(200).optional(),
        details: z.unknown().optional(),
    }).strict().optional(),
    timestamp: z.coerce.date().optional(),
}).strict();

const historyQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
});

// POST /api/activity - Log a user activity
router.post('/', async (req, res) => {
    try {
        const parsed = activityCreateSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                success: false,
                error: parsed.error.errors[0].message,
            });
        }

        const { type, description, metadata } = parsed.data;

        const activity = new UserActivity({
            userId: req.userId,
            type,
            description,
            metadata
        });

        await activity.save();

        // Optional: Keep only last 1000 activities per user to prevent bloat
        // This could be moved to a background job

        res.status(201).json({ success: true, data: null });
    } catch (error) {
        console.error('Failed to log activity:', error);
        res.status(500).json({ success: false, error: 'Failed to log activity' });
    }
});

// GET /api/activity/history - Get recent activity for context
router.get('/history', async (req, res) => {
    try {
        const parsedQuery = historyQuerySchema.safeParse({ limit: req.query.limit });
        if (!parsedQuery.success) {
            return res.status(400).json({
                success: false,
                error: parsedQuery.error.errors[0].message,
            });
        }
        const { limit } = parsedQuery.data;

        const activities = await UserActivity.find({ userId: req.userId })
            .sort({ timestamp: -1 })
            .limit(limit);

        res.json({ success: true, data: activities });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch activity history' });
    }
});

export const activityRoutes = router;
