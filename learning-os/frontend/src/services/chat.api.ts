// Chat API Service
import { baseApi, API_BASE } from './base.api';
import type { ChatSession } from './types';

export const chatApi = {
    async getChatHistory() {
        return baseApi.request<ChatSession[]>('/chat/history');
    },

    async getChatSession(id: string) {
        return baseApi.request<ChatSession>(`/chat/${id}`);
    },

    async createChatSession(message?: string, model?: string) {
        return baseApi.request<ChatSession>('/chat', {
            method: 'POST',
            body: JSON.stringify({ message, model })
        });
    },

    async sendChatMessage(
        sessionId: string,
        message: string,
        onChunk?: (chunk: string) => void,
        signal?: AbortSignal
    ) {
        if (!onChunk) {
            return baseApi.request('/chat/' + sessionId + '/message', {
                method: 'POST',
                body: JSON.stringify({ message })
            });
        }

        const token = baseApi.getToken();
        const response = await fetch(`${API_BASE}/chat/${sessionId}/message`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token && { Authorization: `Bearer ${token}` })
            },
            body: JSON.stringify({ message }),
            signal
        });

        if (!response.ok) throw new Error('Message failed');

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) return;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            onChunk(chunk);
        }
    },

    async updateChatSession(id: string, updates: { title?: string }) {
        return baseApi.request<ChatSession>(`/chat/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(updates)
        });
    },

    async deleteChatSession(id: string) {
        return baseApi.request<{ success: boolean }>(`/chat/${id}`, { method: 'DELETE' });
    }
};
