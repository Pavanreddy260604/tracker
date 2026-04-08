import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import * as planService from '../services/planService';

export const getTodayPlan = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const userId = (req.user as any)?.userId;
        const token = req.headers.authorization?.split(' ')[1];

        if (!userId || !token) {
           res.status(401).json({ message: 'Authentication required' });
           return;
        }

        const overview = await planService.getTodayOverview(userId, token);
        res.json(overview);
    } catch (error: any) {
        res.status(500).json({ message: 'Error aggregating daily plan', error: error.message });
    }
};
