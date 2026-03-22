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
                    className="block text-[10px] sm:text-xs font-semibold uppercase tracking-[0.14em] text-text-tertiary"
                >
                    {label}
                </label>
            )}
            <div className="relative">
                {leftIcon && (
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary">
                        {leftIcon}
                    </div>
                )}
                <input
                    id={inputId}
                    type={isPassword && showPassword ? 'text' : type}
                    className={cn(
                        'w-full px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm min-h-[30px] sm:min-h-[36px] rounded-md sm:rounded-lg transition-colors duration-150',
                        'bg-console-surface border border-border-subtle',
                        'text-text-primary',
                        'placeholder:text-text-disabled',
                        'hover:border-border-strong',
                        'focus:outline-none focus:border-accent-primary focus:ring-4 focus:ring-accent-focus/20',
                        leftIcon && 'pl-10',
                        isPassword && 'pr-10',
                        error && 'border-status-error/50 focus:border-status-error focus:ring-status-error/10',
                        className
                    )}
                    {...props}
                />
                {isPassword && (
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary transition-colors"
                    >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                )}
            </div>
            {error && (
                <p className="text-xs font-medium text-status-error animate-slide-down">{error}</p>
            )}
        </div>
    );
}
