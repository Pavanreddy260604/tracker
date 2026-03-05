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
                    className="block text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
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
                    'bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-white/10',
                    'text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500',
                    'transition-colors duration-150 resize-none overflow-hidden',
                    'focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20',
                    'hover:border-gray-300 dark:hover:border-white/20',
                    error && 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20',
                    className
                )}
                {...props}
            />
            {error && (
                <p className="text-xs text-red-500">{error}</p>
            )}
        </div>
    );
}
