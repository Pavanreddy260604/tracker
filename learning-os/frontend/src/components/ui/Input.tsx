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
    ...props
}: InputProps) {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';

    return (
        <div className="space-y-1.5">
            {label && (
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
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
                    type={isPassword && showPassword ? 'text' : type}
                    className={cn(
                        'w-full px-4 py-3 text-[15px] bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-xl',
                        'text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400',
                        'transition-all duration-200',
                        'focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20',
                        'hover:border-gray-300 dark:hover:border-white/20',
                        leftIcon && 'pl-10',
                        isPassword && 'pr-10',
                        error && 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20',
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
