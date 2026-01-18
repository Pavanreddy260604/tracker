import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { DailyLog } from '../models/DailyLog.js';
import { User } from '../models/User.js';
import { authenticate } from '../middleware/auth.js';
import { writeLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Validation schema for daily log
const dailyLogSchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
    dsaHours: z.number().min(0).max(24).default(0),
    backendHours: z.number().min(0).max(24).default(0),
    projectHours: z.number().min(0).max(24).default(0),
    exerciseCompleted: z.boolean().default(false),
    sleepHours: z.number().min(0).max(24).default(0),
    dsaProblemsSolved: z.number().min(0).default(0),
    notes: z.string().max(5000).default(''),
});

/**
 * GET /api/daily-logs
 * Get all daily logs for the authenticated user (paginated)
 */
router.get('/', async (req: Request, res: Response) => {
    try {
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const requestedLimit = parseInt(req.query.limit as string) || 30;
        const limit = Math.min(Math.max(1, requestedLimit), 100); // Cap at 100 max
        const skip = (page - 1) * limit;

        const [logs, total] = await Promise.all([
            DailyLog.find({ userId: req.userId })
                .sort({ date: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            DailyLog.countDocuments({ userId: req.userId }),
        ]);

        res.json({
            success: true,
            data: {
                logs,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit),
                },
            },
        });
    } catch (error) {
        console.error('Get logs error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch logs',
        });
    }
});

/**
 * GET /api/daily-logs/:date
 * Get log for a specific date
 */
router.get('/:date', async (req: Request, res: Response) => {
    try {
        const date = Array.isArray(req.params.date) ? req.params.date[0] : req.params.date;

        // Validate date format
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            res.status(400).json({
                success: false,
                error: 'Date must be in YYYY-MM-DD format',
            });
            return;
        }

        const log = await DailyLog.findOne({
            userId: req.userId,
            date,
        }).lean();

        if (!log) {
            // Return empty log structure for the date
            res.json({
                success: true,
                data: {
                    log: null,
                    date,
                },
            });
            return;
        }

        res.json({
            success: true,
            data: { log },
        });
    } catch (error) {
        console.error('Get log error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch log',
        });
    }
});

/**
 * POST /api/daily-logs
 * Create or update (upsert) daily log
 * 
 * IDEMPOTENT: Uses upsert to prevent duplicates for same user+date
 */
router.post('/', writeLimiter, async (req: Request, res: Response) => {
    try {
        // Validate input
        const result = dailyLogSchema.safeParse(req.body);
        if (!result.success) {
            res.status(400).json({
                success: false,
                error: result.error.errors[0].message,
            });
            return;
        }

        const logData = result.data;

        // ENTERPRISE RESTRICTION: Validate against user targets
        // "Once target is met, don't allow logging again" (prevent exceeding target)
        const user = await User.findById(req.userId);
        if (!user) {
            res.status(404).json({ success: false, error: 'User not found' });
            return;
        }

        const targets = user.targets || { dsa: 6, backend: 4, project: 1 };

        if (logData.dsaHours > targets.dsa) {
            res.status(400).json({
                success: false,
                error: `Cannot log ${logData.dsaHours}h DSA. Daily target is ${targets.dsa}h.`
            });
            return;
        }

        if (logData.backendHours > targets.backend) {
            res.status(400).json({
                success: false,
                error: `Cannot log ${logData.backendHours}h Backend. Daily target is ${targets.backend}h.`
            });
            return;
        }

        if (logData.projectHours > targets.project) {
            res.status(400).json({
                success: false,
                error: `Cannot log ${logData.projectHours}h Project. Daily target is ${targets.project}h.`
            });
            return;
        }

        // Upsert: update if exists, create if not
        const log = await DailyLog.findOneAndUpdate(
            {
                userId: req.userId,
                date: logData.date,
            },
            {
                $set: {
                    ...logData,
                    userId: req.userId,
                },
            },
            {
                upsert: true,
                new: true,
                runValidators: true,
            }
        );

        res.status(201).json({
            success: true,
            data: { log },
        });
    } catch (error) {
        console.error('Upsert log error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to save log',
        });
    }
});

/**
 * DELETE /api/daily-logs/:date
 * Delete a daily log
 */
router.delete('/:date', writeLimiter, async (req: Request, res: Response) => {
    try {
        const { date } = req.params;

        const result = await DailyLog.findOneAndDelete({
            userId: req.userId,
            date,
        });

        if (!result) {
            res.status(404).json({
                success: false,
                error: 'Log not found',
            });
            return;
        }

        res.json({
            success: true,
            data: { message: 'Log deleted' },
        });
    } catch (error) {
        console.error('Delete log error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete log',
        });
    }
});

export default router;
