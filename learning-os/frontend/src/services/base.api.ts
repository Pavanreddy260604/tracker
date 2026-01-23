// Base API infrastructure - shared by all domain services
const API_BASE = import.meta.env.VITE_API_URL || '/api';

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}

/**
 * Base API service with shared request infrastructure.
 * Domain-specific services extend or compose with this.
 */
class BaseApiService {
    private token: string | null = null;

    setToken(token: string | null) {
        this.token = token;
    }

    getToken(): string | null {
        return this.token;
    }

    async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        const token = this.getToken();

        const headers: HeadersInit = {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
            ...options.headers,
        };

        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers,
        });

        const data: ApiResponse<T> = await response.json();

        if (!response.ok || !data.success) {
            if (response.status === 401) {
                window.dispatchEvent(new Event('auth:unauthorized'));
            }
            throw new Error(data.error || 'An error occurred');
        }

        return data.data as T;
    }

    /**
     * Streaming request for chat/AI endpoints
     */
    async streamRequest(
        endpoint: string,
        body: object,
        onChunk: (chunk: string) => void,
        signal?: AbortSignal
    ): Promise<void> {
        const token = this.getToken();
        const response = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token && { Authorization: `Bearer ${token}` })
            },
            body: JSON.stringify(body),
            signal
        });

        if (!response.ok) throw new Error('Request failed');

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) return;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            onChunk(chunk);
        }
    }
}

// Singleton instance shared across all services
export const baseApi = new BaseApiService();
export { API_BASE };
