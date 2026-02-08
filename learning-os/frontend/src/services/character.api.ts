import { SCRIPT_SERVICE_URL } from "./scriptWriter.api";

const CHARACTER_SERVICE_URL = SCRIPT_SERVICE_URL.replace('/script', '') + '/character';

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

export interface Character {
    _id: string;
    bibleId: string;
    name: string;
    role: 'protagonist' | 'antagonist' | 'supporting' | 'minor';
    voice?: {
        description?: string;
        accent?: string;
    };
    traits?: string[];
    motivation?: string;
}

class CharacterApi {

    async getCharacters(bibleId: string): Promise<Character[]> {
        const response = await fetch(`${CHARACTER_SERVICE_URL}/bible/${bibleId}`, {
            headers: getAuthHeaders()
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Failed to load characters');
        }
        return data.data || [];
    }

    async createCharacter(character: Partial<Character>): Promise<Character> {
        const response = await fetch(`${CHARACTER_SERVICE_URL}`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(character)
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Failed to create character');
        }
        return data.data;
    }

    async updateCharacter(id: string, updates: Partial<Character>): Promise<Character> {
        const response = await fetch(`${CHARACTER_SERVICE_URL}/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(updates)
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Failed to update character');
        }
        return data.data;
    }

    async deleteCharacter(id: string): Promise<void> {
        const response = await fetch(`${CHARACTER_SERVICE_URL}/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Failed to delete character');
        }
    }
}

export const characterApi = new CharacterApi();
