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

    async createChatSession(
        message?: string,
        model?: string,
        assistantType?: 'learning-os' | 'script-writer'
    ) {
        return baseApi.request<ChatSession>('/chat', {
            method: 'POST',
            body: JSON.stringify({ message, model, assistantType })
        });
    },

    async sendChatMessage(
        sessionId: string,
        message: string,
        onChunk?: (chunk: string) => void,
        signal?: AbortSignal,
        assistantType?: 'learning-os' | 'script-writer',
        context?: string
    ) {
        if (!onChunk) {
            return baseApi.request('/chat/' + sessionId + '/message', {
                method: 'POST',
                body: JSON.stringify({ message, assistantType, context })
            });
        }

        await baseApi.streamRequest(
            `/chat/${sessionId}/message`,
            { message, assistantType, context },
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
