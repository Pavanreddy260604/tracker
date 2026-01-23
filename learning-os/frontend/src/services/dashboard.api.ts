// Dashboard API Service
import { baseApi } from './base.api';
import { getTodayString } from '../lib/utils';
import type { DashboardSummary, StreakData, WeeklyData, HeatmapDay, Insights } from './types';

export const dashboardApi = {
    async getSummary(range: 'today' | 'week' | 'month' | 'all' = 'today') {
        const today = getTodayString();
        return baseApi.request<DashboardSummary>(`/dashboard/summary?range=${range}&clientDate=${today}`);
    },

    async getStreak() {
        return baseApi.request<StreakData>('/dashboard/streak');
    },

    async getWeekly() {
        return baseApi.request<{ weekly: WeeklyData[] }>('/dashboard/weekly');
    },

    async getHeatmap(year: number) {
        return baseApi.request<{ year: number; days: HeatmapDay[] }>(`/dashboard/heatmap?year=${year}`);
    },

    async getInsights() {
        return baseApi.request<Insights>('/dashboard/insights');
    }
};
