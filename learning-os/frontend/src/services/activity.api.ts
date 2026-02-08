
import { baseApi } from './base.api';
import type { ApiResponse } from './base.api';

export interface ActivityLog {
    type: 'navigation' | 'click' | 'edit' | 'create' | 'delete' | 'search' | 'command';
    description: string;
    metadata?: any;
    timestamp?: Date;
}

export const activityApi = {
    /**
     * Log a user activity
     */
    async log(activity: ActivityLog): Promise<void> {
        return baseApi.request<void>('/activity', {
            method: 'POST',
            body: JSON.stringify(activity),
        });
    },

    /**
     * Get recent activity history
     */
    async getHistory(limit: number = 20): Promise<ActivityLog[]> {
        return baseApi.request<ActivityLog[]>(`/activity/history?limit=${limit}`);
    }
};
