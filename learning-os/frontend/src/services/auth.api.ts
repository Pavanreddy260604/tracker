// Auth API Service
import { baseApi } from './base.api';
import type { User } from './types';

export const authApi = {
    async register(name: string, email: string, password: string) {
        return baseApi.request<{ user: User; token: string }>('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ name, email, password }),
        });
    },

    async login(email: string, password: string) {
        return baseApi.request<{ user: User; token: string }>('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
    },

    async getMe() {
        return baseApi.request<{ user: User }>('/auth/me');
    },

    async updateProfile(data: { name?: string; timezone?: string; targets?: { dsa: number; backend: number; project: number } }) {
        const response = await baseApi.request<{ user: User }>('/auth/profile', {
            method: 'PUT',
            body: JSON.stringify(data),
        });
        return response.user;
    },

    async updateAIKey(apiKey: string) {
        return baseApi.request<{ message: string }>('/auth/ai-key', {
            method: 'PUT',
            body: JSON.stringify({ apiKey }),
        });
    },

    async exportData() {
        return baseApi.request<{ data: any }>('/auth/export');
    },

    async deleteAccount() {
        return baseApi.request<{ message: string }>('/auth/account', {
            method: 'DELETE',
        });
    }
};
