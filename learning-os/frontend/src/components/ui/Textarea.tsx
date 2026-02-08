import { useEffect, useRef } from 'react';
import { cn } from '../../lib/utils';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string;
    error?: string;
    autoResize?: boolean;
}

export function Textarea({
    label,
    error,
    className,
    rows = 3,
    autoResize = false,
    value,
    onChange,
    ...props
}: TextareaProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize logic
    useEffect(() => {
        if (!autoResize || !textareaRef.current) return;

        const adjustHeight = () => {
            const el = textareaRef.current;
            if (el) {
                el.style.height = 'auto'; // Reset to calculate scrollHeight correctly
                el.style.height = `${el.scrollHeight}px`;
            }
        };

        adjustHeight();
    }, [value, autoResize]);

    // Handle change to trigger resize
    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        if (onChange) onChange(e);
        // Force re-adjust immediately
        if (autoResize) {
            e.target.style.height = 'auto';
            e.target.style.height = `${e.target.scrollHeight}px`;
        }
    };

    return (
        <div className="space-y-1.5">
            {label && (
                <label className="block text-xs font-medium text-[var(--sw-text-muted)] uppercase tracking-wider">
                    {label}
                </label>
            )}
            <textarea
                ref={textareaRef}
                rows={rows}
                value={value}
                onChange={handleChange}
                className={cn(
                    'w-full px-4 py-3 text-sm bg-[var(--sw-surface)] border border-[var(--sw-border)] rounded-lg',
                    'text-[var(--sw-text)] placeholder-[var(--sw-text-muted)]',
                    'transition-all duration-200 resize-none overflow-hidden', // hidden overflow for auto-resize
                    'focus:outline-none focus:border-[var(--sw-accent)] focus:ring-1 focus:ring-[var(--sw-accent)]/20',
                    'hover:border-[var(--sw-text-muted)]',
                    error && 'border-[var(--github-danger)] focus:border-[var(--github-danger)] focus:ring-[var(--github-danger)]/20',
                    className
                )}
                {...props}
            />
            {error && (
                <p className="text-xs text-[var(--github-danger)]">{error}</p>
            )}
        </div>
    );
}
