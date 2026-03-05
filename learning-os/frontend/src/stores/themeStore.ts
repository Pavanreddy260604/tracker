import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { safeStorage } from '../lib/safeStorage';


type Theme = 'dark' | 'light';

interface ThemeState {
    theme: Theme;
    toggleTheme: () => void;
    setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeState>()(
    persist(
        (set, get) => ({
            theme: 'dark',

            toggleTheme: () => {
                const newTheme = get().theme === 'dark' ? 'light' : 'dark';
                set({ theme: newTheme });
                applyTheme(newTheme);
            },

            setTheme: (theme) => {
                set({ theme });
                applyTheme(theme);
            },
        }),
        {
            name: 'theme-storage',
            storage: createJSONStorage(() => safeStorage),
            onRehydrateStorage: () => {
                return (state) => {
                    if (state?.theme) {
                        applyTheme(state.theme);
                    }
                };
            },
        }
    )
);

function applyTheme(theme: Theme) {
    const root = document.documentElement;
    if (theme === 'light') {
        root.classList.add('light');
        root.classList.remove('dark');
    } else {
        root.classList.add('dark');
        root.classList.remove('light');
    }
}
