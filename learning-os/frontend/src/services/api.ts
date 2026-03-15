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
import { activityApi } from './activity.api';

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
    logout = authApi.logout;
    getMe = authApi.getMe;
    forgotPassword = authApi.forgotPassword;
    resetPassword = authApi.resetPassword;
    changePassword = authApi.changePassword;
    verifyEmail = authApi.verifyEmail;
    resendVerification = authApi.resendVerification;
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
    auditTopic = backendApi.auditTopic;

    // Project Studies
    getProjectStudies = projectsApi.getProjectStudies;
    createProjectStudy = projectsApi.createProjectStudy;
    updateProjectStudy = projectsApi.updateProjectStudy;
    deleteProjectStudy = projectsApi.deleteProjectStudy;
    analyzeProject = projectsApi.analyzeProject;
    validateProjectFlow = projectsApi.validateProjectFlow;
    pulseProjectAudit = projectsApi.pulseProjectAudit;

    // Interview
    startInterview = interviewApi.startInterview;
    chatWithAI = interviewApi.chatWithAI;
    updateDraft = interviewApi.updateDraft;
    submitInterviewCode = interviewApi.submitInterviewCode;
    runInterviewCode = interviewApi.runInterviewCode;
    endInterview = interviewApi.endInterview;
    getInterviewHistory = interviewApi.getInterviewHistory;
    getInterviewSession = interviewApi.getInterviewSession;
    nextSection = interviewApi.nextSection;
    submitSection = interviewApi.submitSection;
    getAnalytics = interviewApi.getAnalytics;
    updateProctoringData = interviewApi.updateProctoringData;

    // Chat
    getChatHistory = chatApi.getChatHistory;
    getChatSession = chatApi.getChatSession;
    createChatSession = chatApi.createChatSession;
    sendChatMessage = chatApi.sendChatMessage;
    updateChatSession = chatApi.updateChatSession;
    deleteChatSession = chatApi.deleteChatSession;

    // Activity / System Awareness
    logActivity = activityApi.log;
    getActivityHistory = activityApi.getHistory;

    // Roadmap (kept inline as it's small)
    async getRoadmap() {
        const response = await baseApi.request<{ nodes: any[]; edges: any[] }>('/roadmap');
        // The response structure is { nodes: [...], edges: [...] } directly, not wrapped in data
        return response;
    }

    async syncRoadmap(nodes: any[], edges: any[]) {
        const response = await baseApi.request<{ message: string }>('/roadmap/sync', {
            method: 'POST',
            body: JSON.stringify({ nodes, edges }),
        });
        // The sync endpoint returns { message: "..." }
        return response;
    }

    async updateNodeStatus(nodeId: string, status: string, label: string) {
        const response = await baseApi.request<{ data: any }>(`/roadmap/node/${nodeId}`, {
            method: 'PATCH',
            body: JSON.stringify({ status, label }),
        });
        // The update endpoint returns { data: node }
        return response;
    }

    // Generic helpers for new integrations
    async post<T = any>(url: string, body: any, options: any = {}) {
        const isFormData = body instanceof FormData;
        
        // If it's FormData, let the browser set the Content-Type with boundary
        const headers = { ...options.headers };
        if (isFormData) {
            delete headers['Content-Type'];
        } else if (!headers['Content-Type']) {
            headers['Content-Type'] = 'application/json';
        }

        const response = await baseApi.request<T>(url, {
            method: 'POST',
            body: isFormData ? body : JSON.stringify(body),
            headers
        });
        return response;
    }
}

export const api = new ApiService();
