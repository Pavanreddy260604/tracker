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
                <label className="block text-[10px] sm:text-xs font-medium text-gray-700 dark:text-gray-300">
                    {label}
                </label>
            )}
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className={cn(
                    'w-full px-2.5 py-1.5 sm:px-3 sm:py-2 text-[11px] sm:text-sm min-h-[30px] sm:min-h-[36px] bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-md sm:rounded-lg',
                    'text-gray-900 dark:text-white appearance-none cursor-pointer',
                    'transition-colors duration-150',
                    'focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20',
                    'hover:border-gray-300 dark:hover:border-white/20',
                    error && 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20',
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
                <option value="" disabled className="bg-white dark:bg-[#1c2128] text-gray-500">
                    {placeholder}
                </option>
                {options.map((option) => (
                    <option
                        key={option.value}
                        value={option.value}
                        className="bg-white dark:bg-[#1c2128] text-gray-900 dark:text-white"
                    >
                        {option.label}
                    </option>
                ))}
            </select>
            {error && (
                <p className="text-sm text-red-400">{error}</p>
            )}
        </div>
    );
}
