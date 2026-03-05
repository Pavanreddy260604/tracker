import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '../../lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    leftIcon?: React.ReactNode;
}

export function Input({
    label,
    error,
    leftIcon,
    className,
    type,
    id,
    ...props
}: InputProps) {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';
    const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

    return (
        <div className="space-y-1 sm:space-y-1.5 w-full">
            {label && (
                <label
                    htmlFor={inputId}
                    className="block text-[10px] sm:text-xs font-medium text-gray-700 dark:text-gray-300"
                >
                    {label}
                </label>
            )}
            <div className="relative">
                {leftIcon && (
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                        {leftIcon}
                    </div>
                )}
                <input
                    id={inputId}
                    type={isPassword && showPassword ? 'text' : type}
                    className={cn(
                        'w-full px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm min-h-[30px] sm:min-h-[36px] rounded-md sm:rounded-lg transition-colors duration-150',
                        'bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-white/10',
                        'text-gray-900 dark:text-white',
                        'placeholder-gray-400 dark:placeholder-gray-500',
                        'hover:border-gray-300 dark:hover:border-white/20',
                        'focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20',
                        leftIcon && 'pl-10',
                        isPassword && 'pr-10',
                        error && 'border-red-500/50 focus:border-red-500 focus:ring-red-500/10',
                        className
                    )}
                    {...props}
                />
                {isPassword && (
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                    >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                )}
            </div>
            {error && (
                <p className="text-sm text-red-400 animate-slide-down">{error}</p>
            )}
        </div>
    );
}
