import type { StateStorage } from 'zustand/middleware';

/**
 * Safe storage wrapper that handles restricted contexts (iframes, private mode, etc.)
 */
export const safeStorage: StateStorage = {
    getItem: (name: string): string | null => {
        try {
            return localStorage.getItem(name);
        } catch {
            console.warn(`[Storage] localStorage not available for key: ${name}`);
            return null;
        }
    },
    setItem: (name: string, value: string): void => {
        try {
            localStorage.setItem(name, value);
        } catch {
            console.warn(`[Storage] localStorage not available, ${name} will not persist`);
        }
    },
    removeItem: (name: string): void => {
        try {
            localStorage.removeItem(name);
        } catch {
            console.warn(`[Storage] localStorage not available for removal of: ${name}`);
        }
    },
};

/**
 * Simple wrapper for non-Zustand usage
 */
export const storage = {
    get: <T>(key: string, defaultValue: T): T => {
        const val = safeStorage.getItem(key);
        if (val === null || val instanceof Promise) return defaultValue;
        try {
            return JSON.parse(val) as T;
        } catch {
            return val as unknown as T;
        }
    },
    set: (key: string, value: any): void => {
        const val = typeof value === 'string' ? value : JSON.stringify(value);
        safeStorage.setItem(key, val);
    },
    remove: (key: string): void => {
        safeStorage.removeItem(key);
    }
};


