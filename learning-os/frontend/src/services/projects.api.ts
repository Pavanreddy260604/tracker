// Project Studies API Service
import { baseApi } from './base.api';
import type { ProjectStudy, Pagination } from './types';

export const projectsApi = {
    async getProjectStudies(page = 1, limit = 20) {
        return baseApi.request<{ studies: ProjectStudy[]; pagination: Pagination }>(
            `/project-studies?page=${page}&limit=${limit}`
        );
    },

    async getProjectStudy(id: string) {
        return baseApi.request<{ study: ProjectStudy }>(`/project-studies/${id}`);
    },

    async createProjectStudy(study: Partial<ProjectStudy>) {
        return baseApi.request<{ study: ProjectStudy }>('/project-studies', {
            method: 'POST',
            body: JSON.stringify(study),
        });
    },

    async updateProjectStudy(id: string, study: Partial<ProjectStudy>) {
        return baseApi.request<{ study: ProjectStudy }>(`/project-studies/${id}`, {
            method: 'PUT',
            body: JSON.stringify(study),
        });
    },

    async deleteProjectStudy(id: string) {
        return baseApi.request<{ message: string }>(`/project-studies/${id}`, {
            method: 'DELETE',
        });
    }
};
