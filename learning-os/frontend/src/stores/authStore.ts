import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../services/api';
import type { User } from '../services/api';

interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;

    // Actions
    login: (email: string, password: string) => Promise<void>;
    register: (name: string, email: string, password: string) => Promise<void>;
    logout: () => void;
    checkAuth: () => Promise<void>;
    clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,

            login: async (email: string, password: string) => {
                set({ isLoading: true, error: null });
                try {
                    const { user, token } = await api.login(email, password);
                    api.setToken(token);
                    set({
                        user,
                        token,
                        isAuthenticated: true,
                        isLoading: false,
                    });
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'Login failed';
                    set({ error: message, isLoading: false });
                    throw error;
                }
            },

            register: async (name: string, email: string, password: string) => {
                set({ isLoading: true, error: null });
                try {
                    const { user, token } = await api.register(name, email, password);
                    api.setToken(token);
                    set({
                        user,
                        token,
                        isAuthenticated: true,
                        isLoading: false,
                    });
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'Registration failed';
                    set({ error: message, isLoading: false });
                    throw error;
                }
            },

            logout: () => {
                api.setToken(null);
                set({
                    user: null,
                    token: null,
                    isAuthenticated: false,
                    error: null,
                });
            },

            checkAuth: async () => {
                const { token } = get();
                if (!token) {
                    set({ isAuthenticated: false });
                    return;
                }

                set({ isLoading: true });
                try {
                    api.setToken(token);
                    const { user } = await api.getMe();
                    set({
                        user,
                        isAuthenticated: true,
                        isLoading: false,
                    });
                } catch {
                    // Token invalid or expired
                    api.setToken(null);
                    set({
                        user: null,
                        token: null,
                        isAuthenticated: false,
                        isLoading: false,
                    });
                }
            },

            clearError: () => set({ error: null }),
        }),
        {
            name: 'auth-storage',
            partialize: (state) => ({
                token: state.token,
                user: state.user,
            }),
            // CRITICAL: Sync token to API service when store is rehydrated from localStorage
            onRehydrateStorage: () => {
                return (state) => {
                    if (state?.token) {
                        api.setToken(state.token);
                    }
                };
            },
        }
    )
);
// Listener for API 401 Unauthorized events
if (typeof window !== 'undefined') {
    window.addEventListener('auth:unauthorized', () => {
        useAuthStore.getState().logout();
    });
}
