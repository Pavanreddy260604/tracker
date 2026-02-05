/**
 * Legacy API Service - Backward Compatibility Layer
 * 
 * This file maintains backward compatibility with existing code that imports
 * from './api'. New code should import from './index' or specific service files.
 * 
 * Example migration:
 *   OLD: import { api } from '../services/api';
 *        api.login(email, password);
 * 
 *   NEW: import { authApi } from '../services';
 *        authApi.login(email, password);
 */

import { baseApi } from './base.api';
import { authApi } from './auth.api';
import { dashboardApi } from './dashboard.api';
import { dailyLogsApi } from './dailyLogs.api';
import { dsaApi } from './dsa.api';
import { backendApi } from './backend.api';
import { projectsApi } from './projects.api';
import { interviewApi } from './interview.api';
import { chatApi } from './chat.api';

// Re-export types for backward compatibility
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
    InterviewTestResult,
    InterviewRunResult,
    InterviewSubmitResult,
    ChatSession,
} from './types';

/**
 * Unified API class that delegates to domain-specific services.
 * Maintained for backward compatibility with existing code.
 */
class ApiService {
    // Token management
    setToken(token: string | null) {
        baseApi.setToken(token);
    }

    getToken(): string | null {
        return baseApi.getToken();
    }

    // Auth
    register = authApi.register;
    login = authApi.login;
    getMe = authApi.getMe;
    updateProfile = authApi.updateProfile;
    updateAIKey = authApi.updateAIKey;
    exportData = authApi.exportData;
    deleteAccount = authApi.deleteAccount;

    // Dashboard
    getSummary = dashboardApi.getSummary;
    getStreak = dashboardApi.getStreak;
    getWeekly = dashboardApi.getWeekly;
    getHeatmap = dashboardApi.getHeatmap;
    getInsights = dashboardApi.getInsights;

    // Daily Logs
    getDailyLogs = dailyLogsApi.getDailyLogs;
    getDailyLog = dailyLogsApi.getDailyLog;
    upsertDailyLog = dailyLogsApi.upsertDailyLog;
    deleteDailyLog = dailyLogsApi.deleteDailyLog;

    // DSA Problems
    getDSAProblems = dsaApi.getDSAProblems;
    getDSAProblem = dsaApi.getDSAProblem;
    createDSAProblem = dsaApi.createDSAProblem;
    updateDSAProblem = dsaApi.updateDSAProblem;
    deleteDSAProblem = dsaApi.deleteDSAProblem;

    // Backend Topics
    getBackendTopics = backendApi.getBackendTopics;
    getBackendTopic = backendApi.getBackendTopic;
    createBackendTopic = backendApi.createBackendTopic;
    updateBackendTopic = backendApi.updateBackendTopic;
    deleteBackendTopic = backendApi.deleteBackendTopic;

    // Project Studies
    getProjectStudies = projectsApi.getProjectStudies;
    createProjectStudy = projectsApi.createProjectStudy;
    updateProjectStudy = projectsApi.updateProjectStudy;
    deleteProjectStudy = projectsApi.deleteProjectStudy;

    // Interview
    startInterview = interviewApi.startInterview;
    chatWithAI = interviewApi.chatWithAI;
    submitInterviewCode = interviewApi.submitInterviewCode;
    runInterviewCode = interviewApi.runInterviewCode;
    endInterview = interviewApi.endInterview;
    getInterviewHistory = interviewApi.getInterviewHistory;
    getInterviewSession = interviewApi.getInterviewSession;

    // Chat
    getChatHistory = chatApi.getChatHistory;
    getChatSession = chatApi.getChatSession;
    createChatSession = chatApi.createChatSession;
    sendChatMessage = chatApi.sendChatMessage;
    updateChatSession = chatApi.updateChatSession;
    deleteChatSession = chatApi.deleteChatSession;

    // Roadmap (kept inline as it's small)
    async getRoadmap() {
        return baseApi.request<{ nodes: any[]; edges: any[] }>('/roadmap');
    }

    async syncRoadmap(nodes: any[], edges: any[]) {
        return baseApi.request<{ message: string }>('/roadmap/sync', {
            method: 'POST',
            body: JSON.stringify({ nodes, edges }),
        });
    }

    async updateNodeStatus(nodeId: string, status: string, label: string) {
        return baseApi.request<{ data: any }>(`/roadmap/node/${nodeId}`, {
            method: 'PATCH',
            body: JSON.stringify({ status, label }),
        });
    }
}

export const api = new ApiService();
