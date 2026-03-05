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
}


export const scriptWriterApi = new ScriptWriterApi();
