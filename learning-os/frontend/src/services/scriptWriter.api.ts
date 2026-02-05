// ... imports

// ... (rest of imports)

// ...

// ...
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


// Microservice runs on a different port (5001)
export const BASE_SERVICE_URL = import.meta.env.VITE_SCRIPT_SERVICE_URL || 'http://127.0.0.1:5001/api';
export const SCRIPT_SERVICE_URL = `${BASE_SERVICE_URL}/script`;
export const VOICE_SERVICE_URL = `${BASE_SERVICE_URL}/voice`;

const getToken = () => {
    const raw = localStorage.getItem('auth-storage');
    if (raw) {
        try {
            const parsed = JSON.parse(raw);
            if (parsed?.state?.token) return parsed.state.token as string;
        } catch {
            /* ignore parse errors */
        }
    }
    return localStorage.getItem('token');
};

const getAuthHeaders = (): HeadersInit => {
    const token = getToken();
    return {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
};

const getAuthHeadersNoContentType = (): HeadersInit => {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
};

class ScriptWriterApi {

    async getTemplates(): Promise<ScriptTemplates> {
        const response = await fetch(`${SCRIPT_SERVICE_URL}/templates`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();

        if (!data.success) {
            throw new Error('Failed to load templates');
        }

        return data.data;
    }

    async getHistory(_userId?: string): Promise<ScriptHistoryItem[]> {
        const response = await fetch(`${SCRIPT_SERVICE_URL}/history`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();

        if (!data.success) {
            throw new Error('Failed to load history');
        }

        return data.data;
    }

    async getScript(id: string): Promise<IScriptDetail> {
        const response = await fetch(`${SCRIPT_SERVICE_URL}/history/${id}`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();

        if (!data.success) {
            throw new Error('Failed to load script');
        }

        return data.data;
    }

    async generateScriptStream(
        request: ScriptRequest,
        onChunk: (chunk: string) => void,
        signal?: AbortSignal
    ): Promise<void> {
        const headers = getAuthHeaders();
        const response = await fetch(`${SCRIPT_SERVICE_URL}/generate`, {
            method: 'POST',
            headers,
            body: JSON.stringify(request),
            signal
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Generation failed' }));
            throw new Error(error.error || 'Generation failed');
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) return;

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                onChunk(chunk);
            }
        } catch (error: any) {
            if (error.name === 'AbortError') throw error;
            console.error('Stream error:', error);
            throw error;
        } finally {
            reader.releaseLock();
        }
    }

    async ingestVoiceSample(bibleId: string, file: File, characterId?: string): Promise<{ success: boolean, count: number }> {
        const formData = new FormData();
        formData.append('bibleId', bibleId);
        formData.append('file', file);
        if (characterId) {
            formData.append('characterId', characterId);
        }

        const response = await fetch(`${VOICE_SERVICE_URL}/ingest`, {
            method: 'POST',
            headers: getAuthHeadersNoContentType(),
            body: formData
            // assert content-type is automatic with fetch FormData
        });

        if (!response.ok) {
            throw new Error('Upload failed');
        }

        return response.json();
    }
}

export const scriptWriterApi = new ScriptWriterApi();
