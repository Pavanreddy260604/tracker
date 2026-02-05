import { create } from 'zustand';
import { treatmentApi } from '../services/treatment.api';
import type { Treatment, Act } from '../services/treatment.api';

interface TreatmentStore {
    treatments: Treatment[];
    currentPreview: Act[] | null;
    isLoading: boolean;
    error: string | null;

    loadTreatments: (bibleId: string) => Promise<void>;
    generatePreview: (logline: string, style?: string) => Promise<void>;
    saveCurrentTreatment: (bibleId: string, logline: string) => Promise<void>;
    convertToScenes: (treatmentId: string) => Promise<void>;
    clearPreview: () => void;
}

export const useTreatmentStore = create<TreatmentStore>((set, get) => ({
    treatments: [],
    currentPreview: null,
    isLoading: false,
    error: null,

    loadTreatments: async (bibleId: string) => {
        set({ isLoading: true, error: null });
        try {
            const treatments = await treatmentApi.getTreatments(bibleId);
            set({ treatments, isLoading: false });
        } catch (error: any) {
            set({ error: error.message, isLoading: false });
        }
    },

    generatePreview: async (logline: string, style = 'Save The Cat') => {
        set({ isLoading: true, error: null, currentPreview: null });
        try {
            const acts = await treatmentApi.generateTreatment(logline, style);
            set({ currentPreview: acts, isLoading: false });
        } catch (error: any) {
            set({ error: error.message, isLoading: false });
        }
    },

    saveCurrentTreatment: async (bibleId: string, logline: string) => {
        const { currentPreview } = get();
        if (!currentPreview) return;

        set({ isLoading: true, error: null });
        try {
            const newTreatment = await treatmentApi.saveTreatment(bibleId, logline, currentPreview);
            set(state => ({
                treatments: [newTreatment, ...state.treatments],
                currentPreview: null,
                isLoading: false
            }));
        } catch (error: any) {
            set({ error: error.message, isLoading: false });
        }
    },

    convertToScenes: async (treatmentId: string) => {
        set({ isLoading: true, error: null });
        try {
            await treatmentApi.convertToScenes(treatmentId);
            set({ isLoading: false });
        } catch (error: any) {
            set({ error: error.message, isLoading: false });
        }
    },

    clearPreview: () => set({ currentPreview: null, error: null })
}));
