
import express from 'express';
import { UserActivity } from '../models/UserActivity';
import { authenticate } from '../middleware/auth';

const router = express.Router();

router.use(authenticate);

// POST /api/activity - Log a user activity
router.post('/', async (req, res) => {
    try {
        const { type, description, metadata } = req.body;

        const activity = new UserActivity({
            userId: req.userId,
            type,
            description,
            metadata
        });

        await activity.save();

        // Optional: Keep only last 1000 activities per user to prevent bloat
        // This could be moved to a background job

        res.status(201).json({ success: true });
    } catch (error) {
        console.error('Failed to log activity:', error);
        res.status(500).json({ error: 'Failed to log activity' });
    }
});

// GET /api/activity/history - Get recent activity for context
router.get('/history', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit as string) || 20;

        const activities = await UserActivity.find({ userId: req.userId })
            .sort({ timestamp: -1 })
            .limit(limit);

        res.json(activities);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch activity history' });
    }
});

export const activityRoutes = router;
