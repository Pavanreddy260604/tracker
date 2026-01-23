// Daily Logs API Service
import { baseApi } from './base.api';
import type { DailyLog, Pagination } from './types';

export const dailyLogsApi = {
    async getDailyLogs(page = 1, limit = 30) {
        return baseApi.request<{ logs: DailyLog[]; pagination: Pagination }>(
            `/daily-logs?page=${page}&limit=${limit}`
        );
    },

    async getDailyLog(date: string) {
        return baseApi.request<{ log: DailyLog | null; date: string }>(
            `/daily-logs/${date}`
        );
    },

    async upsertDailyLog(log: Partial<DailyLog>) {
        return baseApi.request<{ log: DailyLog }>('/daily-logs', {
            method: 'POST',
            body: JSON.stringify(log),
        });
    },

    async deleteDailyLog(date: string) {
        return baseApi.request<{ message: string }>(`/daily-logs/${date}`, {
            method: 'DELETE',
        });
    }
};
