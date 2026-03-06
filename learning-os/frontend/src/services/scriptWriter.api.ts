export interface ScriptTemplates {
    formats: {
        id: string;
        name: string;
        description: string;
    }[];
    styles: {
        id: string;
        name: string;
        description: string;
    }[];
}

export interface ScriptRequest {
    userId?: string; // kept optional for backward compatibility, server now derives from token
    idea: string;
    format: string;
    style: string;
    language?: string;
    duration?: number;
    genre?: string;
    tone?: string;
    transliteration?: boolean;
    bibleId?: string;
    characterIds?: string[];
    sceneLength?: 'short' | 'medium' | 'long' | 'extended';
    currentContent?: string;
    model?: string;
}

export interface ScriptHistoryItem {
    _id: string;
    title: string;
    prompt: string;
    format: string;
    style: string;
    status: 'generating' | 'completed' | 'failed' | 'draft';
    createdAt: string;
}

export interface IScriptDetail {
    _id: string;
    content: string;
    title: string;
    metadata: any;
}

export interface IMasterScript {
    _id: string;
    title: string;
    director: string;
    description?: string;
    tags: string[];
    language: string; // PH Multilingual RAG
    rawContent: string;
    status: 'pending' | 'processing' | 'indexed' | 'failed';
    processedChunks: number;
    createdAt: string;
}


// Microservice runs on a different port (5003)


import { baseApi } from './base.api';



class ScriptWriterApi {

    async getTemplates(): Promise<ScriptTemplates> {
        return baseApi.request<ScriptTemplates>('/script/templates');
    }

    async getHistory(_userId?: string): Promise<ScriptHistoryItem[]> {
        return baseApi.request<ScriptHistoryItem[]>('/script/history');
    }

    async getScript(id: string): Promise<IScriptDetail> {
        return baseApi.request<IScriptDetail>(`/script/history/${id}`);
    }

    async generateScriptStream(
        request: ScriptRequest,
        onChunk: (chunk: string) => void,
        signal?: AbortSignal
    ): Promise<void> {
        await baseApi.streamRequest('/script/generate', request, onChunk, signal);
    }

    async ingestVoiceSample(bibleId: string, file: File, characterId?: string): Promise<{ success: boolean, count: number }> {
        const formData = new FormData();
        formData.append('bibleId', bibleId);
        formData.append('file', file);
        if (characterId) {
            formData.append('characterId', characterId);
        }

        return baseApi.request<{ success: boolean, count: number }>('/script/voice/ingest', {
            method: 'POST',
            body: formData
        });
    }

    async getAIProvider(): Promise<'ollama' | 'groq'> {
        const data = await baseApi.request<{ provider: 'ollama' | 'groq' }>('/script/ai/provider');
        return data.provider;
    }

    async setAIProvider(provider: 'ollama' | 'groq'): Promise<'ollama' | 'groq'> {
        const data = await baseApi.request<{ provider: 'ollama' | 'groq' }>('/script/ai/provider', {
            method: 'POST',
            body: JSON.stringify({ provider })
        });
        return data.provider;
    }

    async getVoiceSources(bibleId: string, characterId?: string): Promise<any[]> {
        return baseApi.request<any[]>(`/script/voice/sources?bibleId=${bibleId}${characterId ? `&characterId=${characterId}` : ''}`);
    }

    async deleteVoiceSource(bibleId: string, source: string, characterId?: string): Promise<void> {
        await baseApi.request('/script/voice/delete-source', {
            method: 'DELETE',
            body: JSON.stringify({ bibleId, source, characterId })
        });
    }

    // Admin Master Scripts (PH 23)
    async getMasterScripts(): Promise<IMasterScript[]> {
        return baseApi.request<IMasterScript[]>('/script/admin/master-scripts');
    }

    async createMasterScript(data: Partial<IMasterScript> & { file?: File }): Promise<IMasterScript> {
        if (data.file) {
            // Use FormData for file uploads
            const formData = new FormData();
            if (data.title) formData.append('title', data.title);
            if (data.director) formData.append('director', data.director);
            if (data.language) formData.append('language', data.language);
            if (data.tags && Array.isArray(data.tags)) formData.append('tags', JSON.stringify(data.tags));
            else if (data.tags) formData.append('tags', data.tags as any);
            if (data.rawContent) formData.append('rawContent', data.rawContent);
            formData.append('file', data.file);

            return baseApi.request<IMasterScript>('/script/admin/master-scripts', {
                method: 'POST',
                body: formData
            });
        }

        // Fallback to standard JSON if no file is provided
        return baseApi.request<IMasterScript>('/script/admin/master-scripts', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async processMasterScript(id: string): Promise<{ message: string, scriptId: string }> {
        return baseApi.request<{ message: string, scriptId: string }>(`/script/admin/master-scripts/${id}/process`, {
            method: 'POST'
        });
    }

    // Assisted Edit / Assistant Flow (PH 35/36)
    async assistedEditStream(
        sceneId: string,
        instruction: string,
        onChunk: (chunk: string) => void,
        options: { language?: string } = {},
        signal?: AbortSignal
    ): Promise<void> {
        await baseApi.streamRequest(`/script/scene/${sceneId}/assisted-edit`, {
            instruction,
            ...options
        }, onChunk, signal);
    }

    async commitEdit(sceneId: string): Promise<{ success: boolean }> {
        return baseApi.request<{ success: boolean }>(`/script/scene/${sceneId}/commit-edit`, {
            method: 'POST'
        });
    }

    async discardEdit(sceneId: string): Promise<{ success: boolean }> {
        return baseApi.request<{ success: boolean }>(`/script/scene/${sceneId}/discard-edit`, {
            method: 'POST'
        });
    }

    async getAssistantHistory(sceneId: string): Promise<any[]> {
        const response = await baseApi.request<{ success: boolean, data: any[] }>(`/script/scene/${sceneId}/assistant-history`);
        return response.data || [];
    }

    async deleteAssistantHistory(sceneId: string, messageId?: string): Promise<any[]> {
        const response = await baseApi.request<{ success: boolean, data: any[] }>(`/script/scene/${sceneId}/assistant-history`, {
            method: 'DELETE',
            body: JSON.stringify({ messageId })
        });
        return response.data;
    }

    async updateAssistantHistory(sceneId: string, messageId: string, content: string): Promise<any[]> {
        const response = await baseApi.request<{ success: boolean, data: any[] }>(`/script/scene/${sceneId}/assistant-history`, {
            method: 'PUT',
            body: JSON.stringify({ messageId, content })
        });
        return response.data;
    }
}


export const scriptWriterApi = new ScriptWriterApi();
