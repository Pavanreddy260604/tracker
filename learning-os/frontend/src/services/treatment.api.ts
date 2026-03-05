import { baseApi } from './base.api';

export interface Beat {
    name: string;
    description: string;
}

export interface Act {
    name: string;
    beats: Beat[];
}

export interface Treatment {
    _id: string;
    bibleId: string;
    logline: string;
    style: string;
    acts: Act[];
}

class TreatmentApi {
    async generateTreatment(logline: string, style: string = 'Save The Cat'): Promise<Act[]> {
        const data = await baseApi.request<{ acts: Act[] }>('/script/treatment/generate', {
            method: 'POST',
            body: JSON.stringify({ logline, style })
        });
        return data.acts;
    }

    async saveTreatment(bibleId: string, logline: string, acts: Act[], style: string = 'Save The Cat'): Promise<Treatment> {
        return baseApi.request<Treatment>('/script/treatment/save', {
            method: 'POST',
            body: JSON.stringify({ bibleId, logline, acts, style })
        });
    }

    async getTreatments(bibleId: string): Promise<Treatment[]> {
        return baseApi.request<Treatment[]>(`/script/treatment/bible/${bibleId}`);
    }

    async convertToScenes(treatmentId: string): Promise<void> {
        await baseApi.request('/script/treatment/convert', {
            method: 'POST',
            body: JSON.stringify({ treatmentId })
        });
    }
}

export const treatmentApi = new TreatmentApi();
