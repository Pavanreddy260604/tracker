import { cn } from '../../lib/utils';

interface SelectProps {
    value: string;
    onChange: (value: string) => void;
    options: { value: string; label: string }[];
    placeholder?: string;
    label?: string;
    error?: string;
    className?: string;
}

export function Select({
    value,
    onChange,
    options,
    placeholder = 'Select...',
    label,
    error,
    className,
}: SelectProps) {
    return (
        <div className="space-y-1 sm:space-y-1.5 w-full">
            {label && (
                <label className="block text-[10px] sm:text-xs font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                    {label}
                </label>
            )}
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className={cn(
                    'w-full px-2.5 py-1.5 sm:px-3 sm:py-2 text-[11px] sm:text-sm min-h-[30px] sm:min-h-[36px] bg-console-surface border border-border-subtle rounded-md sm:rounded-lg',
                    'text-text-primary appearance-none cursor-pointer',
                    'transition-colors duration-150',
                    'focus:outline-none focus:border-accent-primary focus:ring-4 focus:ring-accent-focus/20',
                    'hover:border-border-strong',
                    error && 'border-status-error/50 focus:border-status-error focus:ring-status-error/20',
                    className
                )}
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%239aa0a6'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 12px center',
                    backgroundSize: '20px',
                    paddingRight: '44px',
                }}
            >
                <option value="" disabled className="bg-console-surface text-text-disabled">
                    {placeholder}
                </option>
                {options.map((option) => (
                    <option
                        key={option.value}
                        value={option.value}
                        className="bg-console-surface text-text-primary"
                    >
                        {option.label}
                    </option>
                ))}
            </select>
            {error && (
                <p className="text-xs font-medium text-status-error">{error}</p>
            )}
        </div>
    );
}
