// Frontend interfaces (avoiding cross-project dependencies)

export interface Bible {
    _id: string;
    title: string;
    logline: string;
    genre: string;
    tone: string;
    createdAt: string;
}

export interface CritiqueResult {
    score: number;
    grade: string;
    summary: string;
    formattingIssues: string[];
    dialogueIssues: string[];
    pacingIssues: string[];
    suggestions: string[];
}

export interface IScene {
    _id: string;
    bibleId: string;
    sequenceNumber: number;
    slugline: string;
    summary: string;
    content: string;
    status: 'planned' | 'drafted' | 'reviewed' | 'final';
    goal?: string;
    critique?: CritiqueResult;
    lastCritiqueContent?: string;
    highScore?: {
        content: string;
        critique: CritiqueResult;
        savedAt: string;
    };
}

import { baseApi } from './base.api';

export const projectApi = {
    // Projects (Bibles)
    listProjects: async (_userId?: string): Promise<Bible[]> => {
        return baseApi.request<Bible[]>('/script/bible');
    },

    createProject: async (_userId: string, data: Partial<Bible>): Promise<Bible> => {
        return baseApi.request<Bible>('/script/bible', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    getProject: async (id: string): Promise<Bible> => {
        return baseApi.request<Bible>(`/script/bible/${id}`);
    },

    // Scenes
    listScenes: async (bibleId: string): Promise<IScene[]> => {
        return baseApi.request<IScene[]>(`/script/scene/bible/${bibleId}`);
    },

    createScene: async (bibleId: string, data: Partial<IScene>): Promise<IScene> => {
        return baseApi.request<IScene>('/script/scene', {
            method: 'POST',
            body: JSON.stringify({ bibleId, ...data }),
        });
    },

    updateScene: async (sceneId: string, data: Partial<IScene>): Promise<IScene> => {
        return baseApi.request<IScene>(`/script/scene/${sceneId}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },

    // Delete a scene
    deleteScene: async (sceneId: string): Promise<void> => {
        await baseApi.request(`/script/scene/${sceneId}`, {
            method: 'DELETE',
        });
    },

    // Update a project
    updateProject: async (projectId: string, data: Partial<Bible>): Promise<Bible> => {
        return baseApi.request<Bible>(`/script/bible/${projectId}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },

    // Delete a project (and all its scenes)
    deleteProject: async (projectId: string): Promise<void> => {
        await baseApi.request(`/script/bible/${projectId}`, {
            method: 'DELETE',
        });
    },

    // Generation
    generateScene: async (sceneId: string, _userId: string, options: any): Promise<ReadableStream> => {
        const res = await baseApi.requestRaw(`/script/scene/${sceneId}/generate`, {
            method: 'POST',
            body: JSON.stringify({ ...options }),
        });
        if (!res.body) throw new Error('Generation failed: No response body');
        return res.body;
    },

    // Critique
    critiqueScene: async (sceneId: string, content?: string): Promise<CritiqueResult> => {
        console.log('[API] critiqueScene payload:', { sceneId, contentLength: content?.length, contentPreview: content?.slice(0, 50) });
        const data = await baseApi.request<CritiqueResult>(`/script/scene/${sceneId}/critique`, {
            method: 'POST',
            body: JSON.stringify({ content }),
        });
        return data;
    },

    fixScene: async (sceneId: string): Promise<{
        content: string;
        critique: any;
        auditNotes: string;
        isSuperior: boolean;
        benchmarkScore: number;
    }> => {
        const data = await baseApi.request<{
            content: string;
            critique: any;
            auditNotes: string;
            isSuperior: boolean;
            benchmarkScore: number;
        }>(`/script/scene/${sceneId}/fix`, {
            method: 'POST',
        });
        return data;
    },

    // Export
    exportProject: async (bibleId: string, format: 'fountain' | 'txt' | 'json' | 'pdf'): Promise<void> => {
        const res = await baseApi.requestRaw(`/script/bible/${bibleId}/export?format=${format}`);

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `script_export.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    },
};

