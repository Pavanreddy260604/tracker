import { create } from 'zustand';
import { api } from '../services/api';
import type { DashboardSummary, StreakData, WeeklyData, HeatmapDay, Insights, DailyLog } from '../services/api';
import { getTodayString } from '../lib/utils';

interface DataState {
    // Dashboard data
    summary: DashboardSummary | null;
    streak: StreakData | null;
    weekly: WeeklyData[];
    heatmap: HeatmapDay[];
    insights: Insights | null;

    // Today's log
    todayLog: DailyLog | null;

    // Loading states
    isLoading: boolean;
    error: string | null;

    // Actions
    fetchDashboard: () => Promise<void>;
    fetchStreak: () => Promise<void>;
    fetchWeekly: () => Promise<void>;
    fetchHeatmap: (year?: number) => Promise<void>;
    fetchInsights: () => Promise<void>;
    fetchTodayLog: () => Promise<void>;
    updateTodayLog: (log: Partial<DailyLog>) => Promise<void>;
    deleteTodayLog: () => Promise<void>;
    clearError: () => void;
}

export const useDataStore = create<DataState>()((set, get) => ({
    summary: null,
    streak: null,
    weekly: [],
    heatmap: [],
    insights: null,
    todayLog: null,
    isLoading: false,
    error: null,

    fetchDashboard: async () => {
        set({ isLoading: true, error: null });
        try {
            const summary = await api.getSummary('today');
            set({ summary, isLoading: false });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to fetch dashboard';
            set({ error: message, isLoading: false });
        }
    },

    fetchStreak: async () => {
        try {
            const streak = await api.getStreak();
            set({ streak });
        } catch (error) {
            console.error('Failed to fetch streak:', error);
        }
    },

    fetchWeekly: async () => {
        try {
            const { weekly } = await api.getWeekly();
            set({ weekly });
        } catch (error) {
            console.error('Failed to fetch weekly data:', error);
        }
    },

    fetchHeatmap: async (year = new Date().getFullYear()) => {
        try {
            const { days } = await api.getHeatmap(year);
            set({ heatmap: days });
        } catch (error) {
            console.error('Failed to fetch heatmap:', error);
        }
    },

    fetchInsights: async () => {
        try {
            const insights = await api.getInsights();
            set({ insights });
        } catch (error) {
            console.error('Failed to fetch insights:', error);
        }
    },

    fetchTodayLog: async () => {
        try {
            const { log } = await api.getDailyLog(getTodayString());
            set({ todayLog: log });
        } catch (error) {
            console.error('Failed to fetch today log:', error);
        }
    },

    updateTodayLog: async (logData: Partial<DailyLog>) => {
        const today = getTodayString();
        const currentLog = get().todayLog;

        try {
            const { log } = await api.upsertDailyLog({
                ...currentLog,
                ...logData,
                date: today,
            });
            set({ todayLog: log });

            // Refresh streak and summary after update
            get().fetchStreak();
            get().fetchDashboard();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to save log';
            set({ error: message });
            throw error;
        }
    },

    deleteTodayLog: async () => {
        const today = getTodayString();
        try {
            await api.deleteDailyLog(today);
            set({ todayLog: null });

            // Refresh streak and summary
            get().fetchStreak();
            get().fetchDashboard();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to delete log';
            set({ error: message });
            throw error;
        }
    },

    clearError: () => set({ error: null }),
}));
