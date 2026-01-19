// Use VITE_API_URL for production, fallback to /api for local dev with Vite proxy
const API_BASE = import.meta.env.VITE_API_URL || '/api';
import { getTodayString } from '../lib/utils';

interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}

class ApiService {
    private token: string | null = null;

    setToken(token: string | null) {
        this.token = token;
    }

    getToken(): string | null {
        return this.token;
    }

    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        const token = this.getToken();

        const headers: HeadersInit = {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
            ...options.headers,
        };

        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers,
        });

        const data: ApiResponse<T> = await response.json();

        if (!response.ok || !data.success) {
            if (response.status === 401) {
                // Notify auth store to clear session
                window.dispatchEvent(new Event('auth:unauthorized'));
            }
            throw new Error(data.error || 'An error occurred');
        }

        return data.data as T;
    }

    // Auth
    async register(name: string, email: string, password: string) {
        return this.request<{ user: User; token: string }>('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ name, email, password }),
        });
    }

    async login(email: string, password: string) {
        return this.request<{ user: User; token: string }>('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
    }

    async getMe() {
        return this.request<{ user: User }>('/auth/me');
    }

    // Daily Logs
    async getDailyLogs(page = 1, limit = 30) {
        return this.request<{ logs: DailyLog[]; pagination: Pagination }>(
            `/daily-logs?page=${page}&limit=${limit}`
        );
    }

    async getDailyLog(date: string) {
        return this.request<{ log: DailyLog | null; date: string }>(
            `/daily-logs/${date}`
        );
    }

    async upsertDailyLog(log: Partial<DailyLog>) {
        return this.request<{ log: DailyLog }>('/daily-logs', {
            method: 'POST',
            body: JSON.stringify(log),
        });
    }

    async deleteDailyLog(date: string) {
        return this.request<{ message: string }>(`/daily-logs/${date}`, {
            method: 'DELETE',
        });
    }

    // Dashboard
    async getSummary(range: 'today' | 'week' | 'month' | 'all' = 'today') {
        const today = getTodayString();
        return this.request<DashboardSummary>(`/dashboard/summary?range=${range}&clientDate=${today}`);
    }

    async getStreak() {
        return this.request<StreakData>('/dashboard/streak');
    }

    async getWeekly() {
        return this.request<{ weekly: WeeklyData[] }>('/dashboard/weekly');
    }

    async getHeatmap(year: number) {
        return this.request<{ year: number; days: HeatmapDay[] }>(
            `/dashboard/heatmap?year=${year}`
        );
    }

    async getInsights() {
        return this.request<Insights>('/dashboard/insights');
    }

    // DSA Problems
    async getDSAProblems(page = 1, limit = 20, topic?: string, difficulty?: string) {
        let url = `/dsa-problems?page=${page}&limit=${limit}`;
        if (topic) url += `&topic=${topic}`;
        if (difficulty) url += `&difficulty=${difficulty}`;
        return this.request<{ problems: DSAProblem[]; pagination: Pagination }>(url);
    }

    async createDSAProblem(problem: Partial<DSAProblem>) {
        return this.request<{ problem: DSAProblem }>('/dsa-problems', {
            method: 'POST',
            body: JSON.stringify(problem),
        });
    }

    async updateDSAProblem(id: string, problem: Partial<DSAProblem>) {
        return this.request<{ problem: DSAProblem }>(`/dsa-problems/${id}`, {
            method: 'PUT',
            body: JSON.stringify(problem),
        });
    }

    async deleteDSAProblem(id: string) {
        return this.request<{ message: string }>(`/dsa-problems/${id}`, {
            method: 'DELETE',
        });
    }

    async getDSAProblem(id: string) {
        return this.request<{ problem: DSAProblem }>(`/dsa-problems/${id}`);
    }

    // Backend Topics
    async getBackendTopics(page = 1, limit = 20, category?: string) {
        let url = `/backend-topics?page=${page}&limit=${limit}`;
        if (category) url += `&category=${category}`;
        return this.request<{ topics: BackendTopic[]; pagination: Pagination }>(url);
    }

    async createBackendTopic(topic: Partial<BackendTopic>) {
        return this.request<{ topic: BackendTopic }>('/backend-topics', {
            method: 'POST',
            body: JSON.stringify(topic),
        });
    }

    async updateBackendTopic(id: string, topic: Partial<BackendTopic>) {
        return this.request<{ topic: BackendTopic }>(`/backend-topics/${id}`, {
            method: 'PUT',
            body: JSON.stringify(topic),
        });
    }

    async deleteBackendTopic(id: string) {
        return this.request<{ message: string }>(`/backend-topics/${id}`, {
            method: 'DELETE',
        });
    }

    async getBackendTopic(id: string) {
        return this.request<{ topic: BackendTopic }>(`/backend-topics/${id}`);
    }

    // Project Studies
    async getProjectStudies(page = 1, limit = 20) {
        return this.request<{ studies: ProjectStudy[]; pagination: Pagination }>(
            `/project-studies?page=${page}&limit=${limit}`
        );
    }

    async createProjectStudy(study: Partial<ProjectStudy>) {
        return this.request<{ study: ProjectStudy }>('/project-studies', {
            method: 'POST',
            body: JSON.stringify(study),
        });
    }

    async updateProjectStudy(id: string, study: Partial<ProjectStudy>) {
        return this.request<{ study: ProjectStudy }>(`/project-studies/${id}`, {
            method: 'PUT',
            body: JSON.stringify(study),
        });
    }

    async deleteProjectStudy(id: string) {
        return this.request<{ message: string }>(`/project-studies/${id}`, {
            method: 'DELETE',
        });
    }

    // Profile & Settings
    async updateProfile(data: { name?: string; timezone?: string; targets?: { dsa: number; backend: number; project: number } }) {
        const response = await this.request<{ user: User }>('/auth/profile', {
            method: 'PUT',
            body: JSON.stringify(data),
        });
        return response.user;
    }

    async updateAIKey(apiKey: string) {
        return this.request<{ message: string }>('/auth/ai-key', {
            method: 'PUT',
            body: JSON.stringify({ apiKey }),
        });
    }

    // Roadmap
    async getRoadmap() {
        return this.request<{ nodes: any[]; edges: any[] }>('/roadmap');
    }

    async syncRoadmap(nodes: any[], edges: any[]) {
        return this.request<{ message: string }>('/roadmap/sync', {
            method: 'POST',
            body: JSON.stringify({ nodes, edges }),
        });
    }

    async updateNodeStatus(nodeId: string, status: string, label: string) {
        return this.request<{ data: any }>(`/roadmap/node/${nodeId}`, {
            method: 'PATCH',
            body: JSON.stringify({ status, label }),
        });
    }

    async exportData() {
        return this.request<{ data: any }>('/auth/export');
    }

    async deleteAccount() {
        return this.request<{ message: string }>('/auth/account', {
            method: 'DELETE',
        });
    }

    // Interview Simulator
    // Interview Simulator
    async startInterview(config: { duration: number; questionCount: number; difficulty: string; language: string; topics?: string[] }) {
        return this.request<InterviewSession>('/interview/start', {
            method: 'POST',
            body: JSON.stringify(config),
        });
    }

    async submitInterviewCode(sessionId: string, questionIndex: number, code: string) {
        return this.request<{ status: 'pass' | 'fail'; feedback: string; score: number }>('/interview/submit', {
            method: 'POST',
            body: JSON.stringify({ sessionId, questionIndex, code }),
        });
    }

    async runInterviewCode(sessionId: string, questionIndex: number, code: string) {
        return this.request<{ output: string; status: 'error' | 'success' }>('/interview/run', {
            method: 'POST',
            body: JSON.stringify({ sessionId, questionIndex, code }),
        });
    }

    async endInterview(sessionId: string) {
        return this.request<InterviewSession>('/interview/end', {
            method: 'POST',
            body: JSON.stringify({ sessionId }),
        });
    }

    async getInterviewHistory() {
        return this.request<InterviewSession[]>('/interview/history');
    }

    async getInterviewSession(sessionId: string) {
        return this.request<InterviewSession>(`/interview/${sessionId}`);
    }
}

// Types
export interface InterviewSession {
    _id: string;
    config: {
        duration: number;
        questionCount: number;
        difficulty: 'easy' | 'medium' | 'hard';
        language?: string;
    };
    questions: {
        problemName: string;
        description: string;
        status: 'pending' | 'solved' | 'failed';
        userCode?: string;
        feedback?: string;
        score?: number;
    }[];
    status: 'in-progress' | 'completed' | 'aborted';
    totalScore: number;
    startedAt: string;
    endedAt?: string;
}

export interface User {
    _id: string;
    name: string;
    email: string;
    timezone: string;
    targets?: {
        dsa: number;
        backend: number;
        project: number;
    };
    createdAt: string;
}

export interface DailyLog {
    _id: string;
    userId: string;
    date: string;
    dsaHours: number;
    backendHours: number;
    projectHours: number;
    exerciseCompleted: boolean;
    sleepHours: number;
    dsaProblemsSolved: number;
    notes: string;
    isActive?: boolean;
    totalHours?: number;
}

export interface Pagination {
    page: number;
    limit: number;
    total: number;
    pages: number;
}

export interface StreakData {
    currentStreak: number;
    longestStreak: number;
    lastActiveDate: string | null;
    isActiveToday: boolean;
    streakAtRisk: boolean;
}

export interface WeeklyData {
    date: string;
    dsaHours: number;
    backendHours: number;
    projectHours: number;
    totalHours: number;
}

export interface HeatmapDay {
    date: string;
    intensity: number;
    totalHours: number;
}

export interface DashboardSummary {
    range: string;
    startDate: string;
    endDate: string;
    summary: {
        totalDsaHours: number;
        totalBackendHours: number;
        totalProjectHours: number;
        totalHours: number;
        activeDays: number;
        exerciseDays: number;
        avgSleepHours: number;
        totalProblemsSolved: number;
        dsaDueCount: number;
        backendDueCount: number;
    };
    today?: TodayProgress;
}

export interface TodayProgress {
    log: {
        dsaHours: number;
        backendHours: number;
        projectHours: number;
        exerciseCompleted: boolean;
        sleepHours: number;
        dsaProblemsSolved: number;
        totalHours: number;
        isActive: boolean;
    } | null;
    streak: {
        current: number;
        longest: number;
        atRisk: boolean;
    };
    targets: {
        dsa: { current: number; target: number; percent: number };
        backend: { current: number; target: number; percent: number };
        project: { current: number; target: number; percent: number };
    };
}

export interface Insights {
    strongestTopic: string | null;
    weakestTopic: string | null;
    avgDailyHours: number;
    consistencyPercent: number;
    totalProblems: number;
    totalHours: number;
    inactivityWarning: boolean;
    daysSinceLastActivity: number;
}

export interface DSAProblem {
    _id: string;
    userId: string;
    problemName: string;
    platform: string;
    topic: string;
    difficulty: 'easy' | 'medium' | 'hard';
    timeSpent: number;
    status: 'solved' | 'revisit' | 'attempted';
    patternLearned: string;
    mistakes: string;
    solutionLink: string;
    date: string;
    // DSA 2.0
    solutionCode?: string;
    timeComplexity?: string;
    spaceComplexity?: string;
    companyTags?: string[];
    nextReviewDate?: string;
    reviewStage?: number;
}

export interface BackendTopic {
    _id: string;
    userId: string;
    topicName: string;
    category: string;
    type: string;
    status: string;
    filesModified: string;
    bugsFaced: string;
    notes: string;
    date: string;
    // Backend Topics 2.0
    subTopics?: {
        id: string;
        text: string;
        isCompleted: boolean;
    }[];
    resources?: {
        title: string;
        url: string;
        type: 'video' | 'article' | 'docs' | 'course';
    }[];
    // SRS
    nextReviewDate?: string;
    reviewStage?: number;
    difficulty?: 'easy' | 'medium' | 'hard';
    timeSpent?: string;
}

export interface ProjectStudy {
    _id: string;
    projectName: string;
    repoUrl: string;
    moduleStudied: string;
    flowUnderstanding: string;
    involvedTables: string;
    questions: string;
    notes: string;
    date: string;
    // Project Studies 2.0
    architectureDiagram?: string;
    keyTakeaways?: string[];
    tasks?: {
        id: string;
        text: string;
        status: 'todo' | 'in-progress' | 'done';
    }[];
}

export const api = new ApiService();
