import React from 'react';
import { cn } from '../../lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    isLoading?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
}

export function Button({
    children,
    className,
    variant = 'primary',
    size = 'md',
    isLoading = false,
    leftIcon,
    rightIcon,
    disabled,
    ...props
}: ButtonProps) {
    const baseStyles = 'inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0b0f14] disabled:opacity-50 disabled:cursor-not-allowed';

    const variants = {
        primary: 'bg-gray-900 border border-gray-200 dark:bg-gradient-to-b dark:from-gray-800 dark:to-gray-900 dark:border-t dark:border-white/10 text-white hover:bg-gray-800 dark:hover:from-gray-700 dark:hover:to-gray-800 active:scale-[0.98] shadow-sm dark:shadow-lg dark:shadow-black/20',
        secondary: 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 dark:bg-white/5 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white dark:hover:border-white/20 backdrop-blur-sm active:scale-[0.98]',
        ghost: 'bg-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/5 active:scale-[0.98]',
        danger: 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 dark:bg-gradient-to-b dark:from-red-500/10 dark:to-red-500/20 dark:text-red-500 dark:border-red-500/20 dark:hover:from-red-500/20 dark:hover:to-red-500/30 dark:hover:border-red-500/30 active:scale-[0.98]',
    };

    const sizes = {
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-4 py-2.5 text-sm',
        lg: 'px-6 py-3 text-base',
    };

    return (
        <button
            className={cn(baseStyles, variants[variant], sizes[size], className)}
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading ? (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                    />
                    <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                </svg>
            ) : (
                leftIcon
            )}
            {children}
            {rightIcon}
        </button>
    );
}
