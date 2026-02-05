import { SCRIPT_SERVICE_URL } from "./scriptWriter.api";

const TREATMENT_SERVICE_URL = SCRIPT_SERVICE_URL.replace('/script', '') + '/treatment';

const getToken = () => {
    const raw = localStorage.getItem('auth-storage');
    if (raw) {
        try {
            const parsed = JSON.parse(raw);
            if (parsed?.state?.token) return parsed.state.token as string;
        } catch {
            /* ignore */
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
        const response = await fetch(`${TREATMENT_SERVICE_URL}/generate`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ logline, style })
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.error || 'Failed to generate treatment');
        return data.data.acts;
    }

    async saveTreatment(bibleId: string, logline: string, acts: Act[]): Promise<Treatment> {
        const response = await fetch(`${TREATMENT_SERVICE_URL}/save`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ bibleId, logline, acts })
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.error || 'Failed to save treatment');
        return data.data;
    }

    async getTreatments(bibleId: string): Promise<Treatment[]> {
        const response = await fetch(`${TREATMENT_SERVICE_URL}/bible/${bibleId}`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.error || 'Failed to fetch treatments');
        return data.data;
    }

    async convertToScenes(treatmentId: string): Promise<void> {
        const response = await fetch(`${TREATMENT_SERVICE_URL}/convert`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ treatmentId })
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.error || 'Failed to convert treatment');
    }
}

export const treatmentApi = new TreatmentApi();
