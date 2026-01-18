import { cn } from '../../lib/utils';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string;
    error?: string;
}

export function Textarea({
    label,
    error,
    className,
    rows = 4,
    ...props
}: TextareaProps) {
    return (
        <div className="space-y-1.5">
            {label && (
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {label}
                </label>
            )}
            <textarea
                rows={rows}
                className={cn(
                    'w-full px-4 py-3 text-[15px] bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-xl',
                    'text-gray-900 dark:text-white placeholder-gray-500 resize-none',
                    'transition-all duration-200',
                    'focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20',
                    'hover:border-gray-300 dark:hover:border-white/20',
                    error && 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20',
                    className
                )}
                {...props}
            />
            {error && (
                <p className="text-sm text-red-400">{error}</p>
            )}
        </div>
    );
}
