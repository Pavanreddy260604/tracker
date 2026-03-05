import { useState, useCallback, useEffect, useRef } from 'react';

interface AutoSaveOptions<T> {
    onSave: (data: T) => Promise<void>;
    debounceMs?: number;
    enabled?: boolean;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function useAutoSave<T>({ onSave, debounceMs = 3000, enabled = true }: AutoSaveOptions<T>) {
    const [status, setStatus] = useState<SaveStatus>('idle');
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [error, setError] = useState<string | null>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const prevDataRef = useRef<string>('');

    const triggerSave = useCallback(async (data: T) => {
        const dataString = JSON.stringify(data);
        if (dataString === prevDataRef.current) return;

        setStatus('saving');
        try {
            await onSave(data);
            prevDataRef.current = dataString;
            setLastSaved(new Date());
            setStatus('saved');
            setError(null);

            // Revert to idle after 3 seconds
            setTimeout(() => setStatus(prev => prev === 'saved' ? 'idle' : prev), 3000);
        } catch (err) {
            console.error('AutoSave Error:', err);
            setStatus('error');
            setError(err instanceof Error ? err.message : 'Connection lost');
        }
    }, [onSave]);

    const handleChange = useCallback((data: T) => {
        if (!enabled) return;

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
            triggerSave(data);
        }, debounceMs);
    }, [enabled, debounceMs, triggerSave]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return {
        status,
        lastSaved,
        error,
        handleChange,
        forceSave: triggerSave
    };
}
