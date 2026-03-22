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
    id,
    ...props
}: TextareaProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const textareaId = id || (label ? `textarea-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

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
        <div className="space-y-1">
            {label && (
                <label
                    htmlFor={textareaId}
                    className="block text-[10px] sm:text-xs font-semibold text-text-tertiary uppercase tracking-[0.14em]"
                >
                    {label}
                </label>
            )}
            <textarea
                id={textareaId}
                ref={textareaRef}
                rows={rows}
                value={value}
                onChange={handleChange}
                className={cn(
                    'w-full px-2.5 py-2 sm:px-3 sm:py-2.5 text-xs sm:text-sm rounded-md sm:rounded-lg',
                    'bg-console-surface border border-border-subtle',
                    'text-text-primary placeholder:text-text-disabled',
                    'transition-colors duration-150 resize-none overflow-hidden',
                    'focus:outline-none focus:border-accent-primary focus:ring-4 focus:ring-accent-focus/20',
                    'hover:border-border-strong',
                    error && 'border-status-error/50 focus:border-status-error focus:ring-status-error/20',
                    className
                )}
                {...props}
            />
            {error && (
                <p className="text-xs font-medium text-status-error">{error}</p>
            )}
        </div>
    );
}
