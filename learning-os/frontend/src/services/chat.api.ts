// Chat API Service
import { baseApi } from './base.api';
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

        await baseApi.streamRequest(
            `/chat/${sessionId}/message`,
            { message },
            onChunk,
            signal
        );
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
