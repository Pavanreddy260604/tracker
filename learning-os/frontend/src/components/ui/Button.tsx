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
    const baseStyles = 'inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-[background-color,border-color,color,box-shadow,transform] duration-150 focus:outline-none focus:ring-4 focus:ring-accent-focus/20 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] gpu-accelerated';

    const variants = {
        primary: 'bg-accent-primary text-white border border-accent-primary-dark shadow-premium hover:bg-accent-primary-dark',
        secondary: 'bg-console-surface border border-border-subtle text-text-primary hover:bg-console-surface-2 hover:border-border-strong shadow-sm',
        ghost: 'bg-transparent text-text-secondary hover:bg-console-surface-2 hover:text-text-primary',
        danger: 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 active:bg-red-500/30',
    };

    const sizes = {
        sm: 'px-2 py-1 text-[10px] sm:text-[11px] min-h-[24px] sm:min-h-[28px]',
        md: 'px-2.5 py-1.5 text-[11px] sm:text-xs min-h-[28px] sm:min-h-[32px]',
        lg: 'px-3 py-2 text-xs sm:text-sm min-h-[32px] sm:min-h-[36px]',
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
