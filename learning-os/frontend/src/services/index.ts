// API Services - Barrel Export
// Re-exports all domain-specific APIs for easy importing

// Base infrastructure
export { baseApi, API_BASE } from './base.api';
export type { ApiResponse } from './base.api';

// Domain services
export { authApi } from './auth.api';
export { dashboardApi } from './dashboard.api';
export { dailyLogsApi } from './dailyLogs.api';
export { dsaApi } from './dsa.api';
export { backendApi } from './backend.api';
export { projectsApi } from './projects.api';
export { interviewApi } from './interview.api';
export { chatApi } from './chat.api';

// Types
export type {
    User,
    DailyLog,
    Pagination,
    StreakData,
    WeeklyData,
    HeatmapDay,
    TodayProgress,
    DashboardSummary,
    Insights,
    DSAProblem,
    BackendTopic,
    ProjectStudy,
    InterviewSession,
    ChatSession,
} from './types';
