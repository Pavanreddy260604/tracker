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

export interface Scene {
    _id: string;
    bibleId: string;
    sequenceNumber: number;
    slugline: string;
    summary: string;
    content: string;
    status: 'planned' | 'drafted' | 'reviewed' | 'final';
    goal?: string;
    critique?: CritiqueResult;
}

const API_URL = import.meta.env.VITE_SCRIPT_SERVICE_URL || 'http://localhost:5001/api';

// Auth helper - pulls token from persisted auth store
const getToken = () => {
    const raw = localStorage.getItem('auth-storage');
    if (raw) {
        try {
            const parsed = JSON.parse(raw);
            if (parsed?.state?.token) return parsed.state.token as string;
        } catch {
            // ignore parse errors
        }
    }
    return localStorage.getItem('token');
};

const getAuthHeaders = (): HeadersInit => {
    const token = getToken();
    return {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
};

export const projectApi = {
    // Projects (Bibles)
    listProjects: async (_userId?: string): Promise<Bible[]> => {
        const res = await fetch(`${API_URL}/bible`, {
            headers: getAuthHeaders(),
        });
        if (!res.ok) throw new Error('Failed to fetch projects');
        const json = await res.json();
        return json.data;
    },

    createProject: async (_userId: string, data: Partial<Bible>): Promise<Bible> => {
        const res = await fetch(`${API_URL}/bible`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ ...data }),
        });
        if (!res.ok) throw new Error('Failed to create project');
        const json = await res.json();
        return json.data;
    },

    getProject: async (id: string): Promise<Bible> => {
        const res = await fetch(`${API_URL}/bible/${id}`, {
            headers: getAuthHeaders(),
        });
        if (!res.ok) throw new Error('Failed to fetch project');
        const json = await res.json();
        return json.data;
    },

    // Scenes
    listScenes: async (bibleId: string): Promise<Scene[]> => {
        const res = await fetch(`${API_URL}/scene/bible/${bibleId}`, {
            headers: getAuthHeaders(),
        });
        if (!res.ok) throw new Error('Failed to fetch scenes');
        const json = await res.json();
        return json.data;
    },

    createScene: async (bibleId: string, data: Partial<Scene>): Promise<Scene> => {
        const res = await fetch(`${API_URL}/scene`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ bibleId, ...data }),
        });
        if (!res.ok) throw new Error('Failed to create scene');
        const json = await res.json();
        return json.data;
    },

    updateScene: async (sceneId: string, data: Partial<Scene>): Promise<Scene> => {
        const res = await fetch(`${API_URL}/scene/${sceneId}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Failed to update scene');
        const json = await res.json();
        return json.data;
    },

    // Delete a scene
    deleteScene: async (sceneId: string): Promise<void> => {
        const res = await fetch(`${API_URL}/scene/${sceneId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        if (!res.ok) throw new Error('Failed to delete scene');
    },

    // Update a project
    updateProject: async (projectId: string, data: Partial<Bible>): Promise<Bible> => {
        const res = await fetch(`${API_URL}/bible/${projectId}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Failed to update project');
        const json = await res.json();
        return json.data;
    },

    // Delete a project (and all its scenes)
    deleteProject: async (projectId: string): Promise<void> => {
        const res = await fetch(`${API_URL}/bible/${projectId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        if (!res.ok) throw new Error('Failed to delete project');
    },

    // Generation
    generateScene: async (sceneId: string, _userId: string, options: any): Promise<ReadableStream> => {
        const res = await fetch(`${API_URL}/scene/${sceneId}/generate`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ ...options }),
        });
        if (!res.ok || !res.body) throw new Error('Generation failed');
        return res.body;
    },

    // Critique
    critiqueScene: async (sceneId: string): Promise<CritiqueResult> => {
        const res = await fetch(`${API_URL}/scene/${sceneId}/critique`, {
            method: 'POST',
            headers: getAuthHeaders(),
        });
        if (!res.ok) throw new Error('Critique failed');
        const json = await res.json();
        return json.data;
    },

    // Export
    exportProject: async (bibleId: string, format: 'fountain' | 'txt' | 'json'): Promise<void> => {
        const res = await fetch(`${API_URL}/bible/${bibleId}/export?format=${format}`, {
            headers: getAuthHeaders(),
        });
        if (!res.ok) throw new Error('Export failed');

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

