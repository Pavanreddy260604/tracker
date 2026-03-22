import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import { ObsidianService } from '../services/obsidian.service.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * POST /api/obsidian/sync
 * Trigger a manual sync of learning data to Obsidian
 */
router.post('/sync', async (req: Request, res: Response) => {
    try {
        if (!req.userId) {
            res.status(401).json({ success: false, error: 'Unauthorized' });
            return;
        }

        const result = await ObsidianService.syncAll(req.userId);

        res.json({
            success: true,
            data: {
                message: 'Sync completed successfully',
                filesExported: result.filesExported,
            },
        });
    } catch (error) {
        console.error('[Obsidian Route] Sync Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to sync data to Obsidian',
        });
    }
});

export default router;
