// Interview Simulator API Service
import { baseApi, API_BASE } from './base.api';
import type { InterviewRunResult, InterviewSession, InterviewSubmitResult, InterviewAnalytics } from './types';

export const interviewApi = {
    async startInterview(config: {
        duration: number;
        sectionCount: number;
        difficulty: string;
        language: string;
        hasCameraAccess?: boolean;
        strictMode?: boolean;
        enforceFullscreen?: boolean;
        sectionsConfig: {
            name: string;
            type: 'warm-up' | 'coding' | 'sql' | 'behavioral' | 'system-design' | 'mixed';
            duration: number; // in minutes
            questionCount: number;
            difficulty?: string;
            topics?: string[];
            questionsConfig?: { difficulty: string; topics: string[] }[];
        }[];
    }) {
        return baseApi.request<InterviewSession>('/interview/start', {
            method: 'POST',
            body: JSON.stringify(config),
        });
    },

    async chatWithAI(
        data: { message: string; context: any },
        onChunk?: (chunk: string) => void
    ) {
        if (!onChunk) {
            return baseApi.request<{ reply: string }>('/interview/chat', {
                method: 'POST',
                body: JSON.stringify(data),
            });
        }

        // Streaming implementation
        const token = baseApi.getToken();
        const response = await fetch(`${API_BASE}/interview/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token && { Authorization: `Bearer ${token}` })
            },
            body: JSON.stringify({ ...data, stream: true })
        });

        if (!response.ok) throw new Error('AI Chat failed');

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) return { reply: '' };

        let fullReply = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            fullReply += chunk;
            onChunk(chunk);
        }
        return { reply: fullReply };
    },

    async submitInterviewCode(sessionId: string, questionIndex: number, code: string, userAnswer?: string) {
        return baseApi.request<InterviewSubmitResult>('/interview/submit', {
            method: 'POST',
            body: JSON.stringify({ sessionId, questionIndex, code, userAnswer }),
        });
    },

    async runInterviewCode(sessionId: string, questionIndex: number, code: string, customInput?: string, userAnswer?: string) {
        return baseApi.request<InterviewRunResult>('/interview/run', {
            method: 'POST',
            body: JSON.stringify({ sessionId, questionIndex, code, customInput, userAnswer }),
        });
    },

    async endInterview(
        sessionId: string,
        sectionAnswers?: {
            sectionIndex: number;
            answers: { questionIndex: number; userCode?: string; userAnswer?: string; score?: number; timeSpent?: number }[];
        }[]
    ) {
        return baseApi.request<InterviewSession>('/interview/end', {
            method: 'POST',
            body: JSON.stringify({ sessionId, sectionAnswers }),
        });
    },

    async getInterviewHistory() {
        return baseApi.request<InterviewSession[]>('/interview/history');
    },

    async getInterviewSession(sessionId: string) {
        return baseApi.request<InterviewSession>(`/interview/${sessionId}`);
    },

    async nextSection(sessionId: string) {
        return baseApi.request<InterviewSession>(`/interview/${sessionId}/next-section`, {
            method: 'POST',
            body: JSON.stringify({}),
        });
    },

    async submitSection(sessionId: string, answers: { questionIndex: number; userCode?: string; userAnswer?: string; score?: number; timeSpent?: number }[]) {
        return baseApi.request<InterviewSession>(`/interview/${sessionId}/submit-section`, {
            method: 'POST',
            body: JSON.stringify({ answers }),
        });
    },

    async getAnalytics(sessionId: string) {
        return baseApi.request<InterviewAnalytics>(`/interview/${sessionId}/analytics`);
    },

    async updateProctoringData(sessionId: string, proctoringData: {
        tabSwitchCount?: number;
        idleTime?: number;
        lastActivityTime?: string;
        violationType?: string;
        violationMessage?: string;
        timestamp?: string;
    }) {
        return baseApi.request<InterviewSession>(`/interview/${sessionId}/proctoring`, {
            method: 'POST',
            body: JSON.stringify(proctoringData),
        });
    },

    async deleteInterviewSession(sessionId: string) {
        return baseApi.request<{ message: string; deletedId: string }>(`/interview/${sessionId}`, {
            method: 'DELETE',
        });
    },

    async clearInterviewHistory() {
        return baseApi.request<{ message: string; deletedCount: number }>('/interview/history/clear', {
            method: 'DELETE',
        });
    }
};
