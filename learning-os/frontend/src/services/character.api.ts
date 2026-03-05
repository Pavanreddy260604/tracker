
import { baseApi } from './base.api';





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
        return baseApi.request<Character[]>(`/script/character/bible/${bibleId}`);
    }

    async createCharacter(character: Partial<Character>): Promise<Character> {
        return baseApi.request<Character>('/script/character', {
            method: 'POST',
            body: JSON.stringify(character)
        });
    }

    async updateCharacter(id: string, updates: Partial<Character>): Promise<Character> {
        return baseApi.request<Character>(`/script/character/${id}`, {
            method: 'PUT',
            body: JSON.stringify(updates)
        });
    }

    async deleteCharacter(id: string): Promise<void> {
        await baseApi.request(`/script/character/${id}`, {
            method: 'DELETE'
        });
    }
}

export const characterApi = new CharacterApi();
