// Interview Simulator API Service
import { baseApi, API_BASE } from './base.api';
import type { InterviewSession } from './types';

export const interviewApi = {
    async startInterview(config: {
        duration: number;
        questionCount: number;
        difficulty: string;
        language: string;
        topics?: string[]
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

    async submitInterviewCode(sessionId: string, questionIndex: number, code: string) {
        return baseApi.request<{ status: 'pass' | 'fail'; feedback: string; score: number }>('/interview/submit', {
            method: 'POST',
            body: JSON.stringify({ sessionId, questionIndex, code }),
        });
    },

    async runInterviewCode(sessionId: string, questionIndex: number, code: string) {
        return baseApi.request<{ output: string; status: 'error' | 'success' }>('/interview/run', {
            method: 'POST',
            body: JSON.stringify({ sessionId, questionIndex, code }),
        });
    },

    async endInterview(sessionId: string) {
        return baseApi.request<InterviewSession>('/interview/end', {
            method: 'POST',
            body: JSON.stringify({ sessionId }),
        });
    },

    async getInterviewHistory() {
        return baseApi.request<InterviewSession[]>('/interview/history');
    },

    async getInterviewSession(sessionId: string) {
        return baseApi.request<InterviewSession>(`/interview/${sessionId}`);
    }
};
