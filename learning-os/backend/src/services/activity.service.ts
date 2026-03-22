import mongoose from 'mongoose';
import { DailyLog } from '../models/DailyLog.js';

export const activityService = {
    /**
     * Record activity for a user on a specific date (defaults to today)
     * This ensures the day is marked as active for streak calculations.
     */
    async recordActivity(userId: string, type: 'dsa' | 'backend' | 'project', amount: number = 0.5) {
        const today = new Date().toISOString().split('T')[0];
        const userObjectId = new mongoose.Types.ObjectId(userId);

        const update: any = {};
        if (type === 'dsa') {
            update.$inc = { dsaHours: amount, dsaProblemsSolved: amount > 0 ? 1 : 0 };
        } else if (type === 'backend') {
            update.$inc = { backendHours: amount };
        } else if (type === 'project') {
            update.$inc = { projectHours: amount };
        }

        try {
            await DailyLog.findOneAndUpdate(
                { userId: userObjectId, date: today },
                update,
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
        } catch (error) {
            console.error('[ActivityService] Failed to record activity:', error);
        }
    }
};
