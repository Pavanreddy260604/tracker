import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import { getTodayProgress, getInsights } from '../services/stats.service.js';
import { calculateStreak } from '../services/streak.service.js';
import { getWeeklyData, getYearlyHeatmap, getSummary } from '../services/aggregation.service.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/dashboard/summary
 * Unified summary endpoint with range parameter
 * 
 * Query params:
 * - range: 'today' | 'week' | 'month' | 'all'
 */
router.get('/summary', async (req: Request, res: Response) => {
    try {
        const range = (req.query.range as string) || 'today';
        const clientDate = (req.query.clientDate as string);
        const today = clientDate || getTodayString();

        let startDate: string;
        const endDate = today;

        switch (range) {
            case 'week':
                startDate = getDateOffset(today, -6);
                break;
            case 'month':
                startDate = getDateOffset(today, -29);
                break;
            case 'all':
                startDate = '2020-01-01';
                break;
            default: // today
                startDate = today;
        }

        const [summary, todayProgress] = await Promise.all([
            getSummary(req.userId!, startDate, endDate),
            range === 'today' ? getTodayProgress(req.userId!, today) : null,
        ]);

        res.json({
            success: true,
            data: {
                range,
                startDate,
                endDate,
                summary,
                ...(todayProgress && { today: todayProgress }),
            },
        });
    } catch (error) {
        console.error('Summary error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch summary',
        });
    }
});

/**
 * GET /api/dashboard/streak
 * Get current and longest streak
 */
router.get('/streak', async (req: Request, res: Response) => {
    try {
        const today = getTodayString();
        const streak = await calculateStreak(req.userId!, today);

        res.json({
            success: true,
            data: streak,
        });
    } catch (error) {
        console.error('Streak error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch streak',
        });
    }
});

/**
 * GET /api/dashboard/weekly
 * Get last 7 days data for bar chart
 */
router.get('/weekly', async (req: Request, res: Response) => {
    try {
        const today = getTodayString();
        const weeklyData = await getWeeklyData(req.userId!, today);

        res.json({
            success: true,
            data: { weekly: weeklyData },
        });
    } catch (error) {
        console.error('Weekly error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch weekly data',
        });
    }
});

/**
 * GET /api/dashboard/heatmap
 * Get yearly heatmap data
 * 
 * Query params:
 * - year: number (default: current year)
 */
router.get('/heatmap', async (req: Request, res: Response) => {
    try {
        const year = parseInt(req.query.year as string) || new Date().getFullYear();
        const heatmapData = await getYearlyHeatmap(req.userId!, year);

        res.json({
            success: true,
            data: {
                year,
                days: heatmapData,
            },
        });
    } catch (error) {
        console.error('Heatmap error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch heatmap',
        });
    }
});

/**
 * GET /api/dashboard/insights
 * Get premium analytics insights
 */
router.get('/insights', async (req: Request, res: Response) => {
    try {
        const today = getTodayString();
        const insights = await getInsights(req.userId!, today);

        res.json({
            success: true,
            data: insights,
        });
    } catch (error) {
        console.error('Insights error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch insights',
        });
    }
});

// Helper functions
function getTodayString(): string {
    return new Date().toISOString().split('T')[0];
}

function getDateOffset(dateStr: string, days: number): string {
    const date = new Date(dateStr + 'T00:00:00Z');
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().split('T')[0];
}

export default router;
