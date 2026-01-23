// DSA Problems API Service
import { baseApi } from './base.api';
import type { DSAProblem, Pagination } from './types';

export const dsaApi = {
    async getDSAProblems(page = 1, limit = 20, topic?: string, difficulty?: string) {
        let url = `/dsa-problems?page=${page}&limit=${limit}`;
        if (topic) url += `&topic=${topic}`;
        if (difficulty) url += `&difficulty=${difficulty}`;
        return baseApi.request<{ problems: DSAProblem[]; pagination: Pagination }>(url);
    },

    async getDSAProblem(id: string) {
        return baseApi.request<{ problem: DSAProblem }>(`/dsa-problems/${id}`);
    },

    async createDSAProblem(problem: Partial<DSAProblem>) {
        return baseApi.request<{ problem: DSAProblem }>('/dsa-problems', {
            method: 'POST',
            body: JSON.stringify(problem),
        });
    },

    async updateDSAProblem(id: string, problem: Partial<DSAProblem>) {
        return baseApi.request<{ problem: DSAProblem }>(`/dsa-problems/${id}`, {
            method: 'PUT',
            body: JSON.stringify(problem),
        });
    },

    async deleteDSAProblem(id: string) {
        return baseApi.request<{ message: string }>(`/dsa-problems/${id}`, {
            method: 'DELETE',
        });
    }
};
