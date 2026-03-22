import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { api } from '../services/api';
import type { User } from '../services/api';
import { activityTracker } from '../services/activity.tracker';

import { safeStorage } from '../lib/safeStorage';

interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    isCheckingAuth: boolean;
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
            isCheckingAuth: false,
            error: null,

            login: async (email: string, password: string) => {
                set({ isLoading: true, error: null });
                try {
                    const { user, token } = await api.login(email, password);
                    api.setToken(token);
                    activityTracker.setToken(token); // Connect tracker
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
                    activityTracker.setToken(token); // Connect tracker
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

            logout: async () => {
                try {
                    await api.logout();
                } catch (e) {
                    console.error('Logout failed silently', e);
                }
                api.setToken(null);
                activityTracker.setToken(null as any); // Clear tracker
                set({
                    user: null,
                    token: null,
                    isAuthenticated: false,
                    error: null,
                });
            },

            checkAuth: async () => {
                if (get().isCheckingAuth) return;

                const { token } = get();
                console.log('[AuthStore] Checking session...', { hasToken: !!token });

                set({ isCheckingAuth: true });

                try {
                    // Try to get user. If token is missing or expired, 
                    // the baseApi interceptor will handle silent refresh automatically.
                    const { user } = await api.getMe();

                    // If it succeeded, update state with whatever token api has now
                    const currentToken = api.getToken();

                    set({
                        user,
                        token: currentToken,
                        isAuthenticated: true,
                        isCheckingAuth: false,
                    });

                    console.log('[AuthStore] Session established', { user: user.email });
                } catch (err) {
                    console.log('[AuthStore] Session invalid', { error: err instanceof Error ? err.message : 'Unknown' });
                    // Token invalid or refresh failed
                    api.setToken(null);
                    set({
                        user: null,
                        token: null,
                        isAuthenticated: false,
                        isCheckingAuth: false,
                    });
                }
            },

            clearError: () => set({ error: null }),
        }),
        {
            name: 'auth-storage',
            storage: createJSONStorage(() => safeStorage),
            partialize: (state) => ({
                user: state.user,
            }),
            onRehydrateStorage: () => {
                return () => {
                    // Do not rehydrate token from storage!
                    // Tokens must remain purely in-memory. 
                    // Session is handled via HttpOnly refreshToken cookie.
                };
            },
        }
    )
);
// Listener for API 401 Unauthorized events
if (typeof window !== 'undefined') {
    window.addEventListener('auth:unauthorized', () => {
        // We only clear local state on unauthorized, no need to call API logout 
        // since the token is already invalid/expired.
        api.setToken(null);
        useAuthStore.setState({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            isCheckingAuth: false,
            error: null,
        });
    });
}
