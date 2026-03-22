// Backend Topics API Service
import { baseApi } from './base.api';
import type { BackendTopic, Pagination } from './types';

export interface BackendTopicAudit {
    score: number;
    gotchas: string[];
    checklist: { task: string; importance: 'high' | 'medium' | 'low' }[];
    summary: string;
}

export const backendApi = {
    async getBackendTopics(page = 1, limit = 20, category?: string) {
        let url = `/backend-topics?page=${page}&limit=${limit}`;
        if (category) url += `&category=${category}`;
        return baseApi.request<{ topics: BackendTopic[]; pagination: Pagination }>(url);
    },

    async getBackendTopic(id: string) {
        return baseApi.request<{ topic: BackendTopic }>(`/backend-topics/${id}`);
    },

    async createBackendTopic(topic: Partial<BackendTopic>) {
        return baseApi.request<{ topic: BackendTopic }>('/backend-topics', {
            method: 'POST',
            body: JSON.stringify(topic),
        });
    },

    async updateBackendTopic(id: string, topic: Partial<BackendTopic>) {
        return baseApi.request<{ topic: BackendTopic }>(`/backend-topics/${id}`, {
            method: 'PUT',
            body: JSON.stringify(topic),
        });
    },

    async deleteBackendTopic(id: string) {
        return baseApi.request<{ message: string }>(`/backend-topics/${id}`, {
            method: 'DELETE',
        });
    },

    async auditTopic(id: string) {
        return baseApi.request<BackendTopicAudit>(`/backend-topics/${id}/audit`, {
            method: 'POST',
            body: JSON.stringify({}),
        });
    },
};
